import { ROW_HEIGHT, COLUMN_WIDTH, NODE_WIDTH } from './constants.js';

// Left-to-right node-link layout, in two passes:
//
//  1. measure() - bottom-up - how many row-units tall each node's whole
//     block is: its own row, plus any byproduct rows, plus whatever its
//     children need (whichever is taller).
//  2. assign() - top-down - turns those sizes into actual row positions.
//     A node's children are centered *within* its block - which is only
//     ever taller than what they strictly need when the node's own row(s)
//     don't otherwise fit alongside them, so most nodes see no offset at
//     all. A node with byproducts pins its own row to the top of its block
//     instead of centering on its children, with the byproduct row(s)
//     directly beneath it.
//
// Row units are scoped to each node's own children (via the returned block
// height), not a single counter shared across the whole tree - so one
// branch's depth/byproducts can never force a phantom gap into an unrelated
// sibling branch two columns over.
export function layoutTree(root) {
  const positions = new Map(); // path -> { x, y }
  const byproductSpots = new Map(); // path -> [{ x, y }, ...], same order as node.byproducts
  const reuseSpots = new Map(); // path -> { x, y }, one per node.reuse
  let maxDepth = 0;
  let maxRow = 0;

  function measure(node) {
    maxDepth = Math.max(maxDepth, node.depth);
    // A reuse marker (see buildTree.js's node.reuse / reuseAllocation.js)
    // is a different axis from byproducts - byproducts are what *this*
    // node's own recipe makes, a reuse marker is about *this* node being
    // someone else's demand - but both pin the node's own row to the top
    // of its block the same way, so they share the same row-reservation
    // mechanism.
    const ownRows = 1 + node.byproducts.length + (node.reuse ? 1 : 0);
    const childrenRows = node.children.reduce((sum, child) => sum + measure(child), 0);
    node._blockHeight = Math.max(ownRows, childrenRows);
    return node._blockHeight;
  }

  // Returns the node's own row (not its block's top), since that's what a
  // non-byproduct parent needs to center itself on.
  function assign(node, rowStart) {
    const x = node.depth * COLUMN_WIDTH;

    const childrenRows = node.children.reduce((sum, child) => sum + child._blockHeight, 0);
    const offset = (node._blockHeight - childrenRows) / 2;
    let cursor = rowStart + offset;
    const childOwnRows = node.children.map((child) => {
      const row = assign(child, cursor);
      cursor += child._blockHeight;
      return row;
    });

    let ownRow;
    if (node.byproducts.length > 0 || node.reuse) {
      ownRow = rowStart;
      if (node.byproducts.length > 0) {
        byproductSpots.set(node.path, node.byproducts.map((_, i) => ({ x, y: (ownRow + 1 + i) * ROW_HEIGHT })));
      }
      if (node.reuse) {
        // Directly beneath the node's own row, past any byproduct rows -
        // its own column (same x as the node), not the hub's - see
        // reuseEdgePath in treeCanvas.js for why.
        reuseSpots.set(node.path, { x, y: (ownRow + 1 + node.byproducts.length) * ROW_HEIGHT });
      }
      maxRow = Math.max(maxRow, ownRow + node.byproducts.length + (node.reuse ? 1 : 0));
    } else if (childOwnRows.length > 0) {
      ownRow = (childOwnRows[0] + childOwnRows[childOwnRows.length - 1]) / 2;
    } else {
      ownRow = rowStart;
    }

    maxRow = Math.max(maxRow, ownRow);
    positions.set(node.path, { x, y: ownRow * ROW_HEIGHT });
    return ownRow;
  }

  measure(root);
  assign(root, 0);

  const nodes = [];
  const edges = [];
  const byproductEdges = [];
  const reuseEdges = [];

  (function collect(node) {
    const pos = positions.get(node.path);
    nodes.push({ node, ...pos });

    // The recipe hub - see constants.js/treeNode.js - only exists once
    // there's an actual resolved recipe to show (leaf, collapsed, and
    // needsChoice nodes all have node.recipe === null - see buildTree.js -
    // so that alone is the right gate, no need to re-check those
    // separately) and something on the other side of it to connect to.
    const hasHub = Boolean(node.recipe) && node.children.length > 0;
    const spots = byproductSpots.get(node.path);

    // Horizontally it's the true midpoint of the gap between this node's
    // column and the next - the hub's stored position is a *center* point
    // (see treeCanvas.js's positionNode), not a left edge, so this needs no
    // adjustment for the hub's own width the way a left-edge box would.
    // Vertically it's centered between the extremes of everything it
    // actually connects - this node itself, its ingredients, and any
    // byproducts - so every edge meeting at the hub fans out from a
    // genuinely balanced point. Node included on purpose, not just
    // children/byproducts: when there's no byproduct they'd already be
    // centered on the node's own row anyway (so this changes nothing), but
    // once a byproduct pins the node's row to the *top* of its block
    // instead (see assign() above), leaving the node out biased the center
    // down toward the byproduct/children cluster and away from it.
    let hubPos = null;
    if (hasHub) {
      const ys = [pos.y, ...node.children.map((child) => positions.get(child.path).y)];
      if (spots) ys.push(...spots.map((spot) => spot.y));
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      hubPos = { x: pos.x + NODE_WIDTH + (COLUMN_WIDTH - NODE_WIDTH) / 2, y: centerY };
      nodes.push({ node, ...hubPos, isHub: true });
      edges.push({ from: pos, to: hubPos });
    }

    if (spots) {
      // A byproduct comes from the same craft as everything else this node
      // makes - the hub *is* that craft, so anchoring here (rather than
      // arbitrarily picking one ingredient, the old behavior) is both more
      // accurate and unambiguous regardless of how many ingredients there
      // are. Falls back to the node's own position on the (unlikely)
      // chance there's no hub to anchor to.
      const anchor = hasHub ? hubPos : pos;
      node.byproducts.forEach((byproduct, i) => {
        nodes.push({ node: byproduct, ...spots[i], isByproduct: true });
        byproductEdges.push({ from: anchor, to: spots[i] });
      });
    }

    // The reuse marker (see buildTree.js's node.reuse) connects straight
    // from this node's own card, deliberately *not* through the hub - it's
    // annotating this node's demand, not how this node itself gets made,
    // so it has nothing to do with the hub between this node and its own
    // children (see reuseEdgePath in treeCanvas.js).
    const reuseSpot = reuseSpots.get(node.path);
    if (reuseSpot) {
      nodes.push({ node, ...reuseSpot, isReuse: true });
      reuseEdges.push({ from: pos, to: reuseSpot });
    }

    for (const child of node.children) {
      // Routed through the hub when there is one - fromIsHub tells
      // treeCanvas.js's edgePath not to offset by a full card width, since
      // a hub's position is already a center point, not a card's left edge.
      edges.push({ from: hasHub ? hubPos : pos, to: positions.get(child.path), fromIsHub: hasHub });
      collect(child);
    }
  })(root);

  return {
    nodes,
    edges,
    byproductEdges,
    reuseEdges,
    width: (maxDepth + 1) * COLUMN_WIDTH,
    height: Math.max((maxRow + 1) * ROW_HEIGHT, ROW_HEIGHT),
  };
}
