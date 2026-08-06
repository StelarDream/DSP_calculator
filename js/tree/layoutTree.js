import { ROW_HEIGHT, COLUMN_WIDTH, NODE_WIDTH } from './constants.js';
import { reuseAvailability } from './reusePool.js';

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
  let maxDepth = 0;
  let maxRow = 0;

  function measure(node) {
    maxDepth = Math.max(maxDepth, node.depth);
    // Recipe hub and reuse hub are independent - a node can have either,
    // both, or neither (see collect() below):
    //  - recipe hub: node resolved to a recipe *and* actually has
    //    ingredients to connect it to. A choice pseudo-node (see
    //    buildTree.js's buildChoiceNode) carries a `recipe` too but never
    //    gets one - no children of its own to connect it to.
    //  - reuse hub: node's demand is (at least partly) covered by reuse -
    //    either still producing the remainder (recipe hub present too) or
    //    isFullySupplied (recipe never resolved at all - see buildTree.js,
    //    reuse is checked before recipe choice) - and there's something to
    //    show: an active reuse, or leftover currently available to draw on.
    node._hasRecipeHub = Boolean(node.recipe) && node.children.length > 0;
    node._hasReuseHub = (node._hasRecipeHub || node.isFullySupplied)
      && (node.suppliedFromLeftover > 0 || reuseAvailability(root, node.itemId, node.path) > 0);
    // +1 reserved row when there's a reuse hub - it's stacked in the extra
    // vertical space this buys the node's block, not sharing a row with
    // anything else (see collect()'s half-row split below). Getting this
    // gate wrong once already caused a real bug: computing it from
    // "resolved to a recipe" alone (rather than matching _hasRecipeHub
    // exactly) reserved a phantom row for every option in a multi-recipe
    // choice step, since a choice pseudo-node carries a `recipe` too -
    // spread the choice cards out for a hub that could never actually show.
    const ownRows = 1 + node.byproducts.length + (node._hasReuseHub ? 1 : 0);
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
    if (node.byproducts.length > 0) {
      ownRow = rowStart;
      byproductSpots.set(node.path, node.byproducts.map((_, i) => ({ x, y: (ownRow + 1 + i) * ROW_HEIGHT })));
      maxRow = Math.max(maxRow, ownRow + node.byproducts.length);
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

  (function collect(node) {
    const pos = positions.get(node.path);
    nodes.push({ node, ...pos });

    const hasRecipeHub = node._hasRecipeHub;
    const hasReuseHub = node._hasReuseHub;
    const spots = byproductSpots.get(node.path);

    // Horizontally it's the true midpoint of the gap between this node's
    // column and the next - a hub's stored position is a *center* point
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
    // down toward the byproduct/children cluster and away from it. Still
    // meaningful with no children/byproducts at all (isFullySupplied,
    // reuse-hub-only) - ys just collapses to [pos.y], anchoring the reuse
    // hub level with the node's own row.
    let hubPos = null;
    let reuseHubPos = null;
    if (hasRecipeHub || hasReuseHub) {
      const ys = [pos.y, ...node.children.map((child) => positions.get(child.path).y)];
      if (spots) ys.push(...spots.map((spot) => spot.y));
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      const x = pos.x + NODE_WIDTH + (COLUMN_WIDTH - NODE_WIDTH) / 2;

      if (hasRecipeHub && hasReuseHub) {
        // Split the reserved row evenly around the point a lone recipe hub
        // would otherwise sit at - half a row up for the reuse hub, half a
        // row down for the recipe hub - so they read as sharing the middle
        // ground rather than one shoving the other out of the way.
        const half = ROW_HEIGHT / 2;
        reuseHubPos = { x, y: centerY - half };
        hubPos = { x, y: centerY + half };
      } else if (hasReuseHub) {
        // isFullySupplied: no recipe hub to share the point with, so the
        // reuse hub just takes it outright.
        reuseHubPos = { x, y: centerY };
      } else {
        hubPos = { x, y: centerY };
      }

      if (reuseHubPos) {
        nodes.push({ node, ...reuseHubPos, isReuseHub: true });
        maxRow = Math.max(maxRow, reuseHubPos.y / ROW_HEIGHT);
      }
      if (hubPos) {
        nodes.push({ node, ...hubPos, isHub: true });
        edges.push({ from: pos, to: hubPos });
        maxRow = Math.max(maxRow, hubPos.y / ROW_HEIGHT);
      }
    }

    if (spots) {
      // A byproduct comes from the same craft as everything else this node
      // makes - the recipe hub *is* that craft, so anchoring here (rather
      // than arbitrarily picking one ingredient, the old behavior) is both
      // more accurate and unambiguous regardless of how many ingredients
      // there are. Falls back to the node's own position on the (unlikely)
      // chance there's no recipe hub to anchor to.
      const anchor = hasRecipeHub ? hubPos : pos;
      node.byproducts.forEach((byproduct, i) => {
        nodes.push({ node: byproduct, ...spots[i], isByproduct: true });
        byproductEdges.push({ from: anchor, to: spots[i] });
      });
    }

    for (const child of node.children) {
      // Routed through the recipe hub when there is one - fromIsHub tells
      // treeCanvas.js's edgePath not to offset by a full card width, since
      // a hub's position is already a center point, not a card's left edge.
      // Never the reuse hub - it's not a junction ingredients flow through.
      edges.push({ from: hasRecipeHub ? hubPos : pos, to: positions.get(child.path), fromIsHub: hasRecipeHub });
      collect(child);
    }
  })(root);

  return {
    nodes,
    edges,
    byproductEdges,
    width: (maxDepth + 1) * COLUMN_WIDTH,
    height: Math.max((maxRow + 1) * ROW_HEIGHT, ROW_HEIGHT),
  };
}
