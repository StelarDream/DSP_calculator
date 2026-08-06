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

    // Recipe hub, choice hub, and reuse hub are three independent slots -
    // a node can have any subset of them (see collect() below):
    //  - recipe hub: resolved to a recipe *and* has ingredients to connect
    //    it to. A choice pseudo-node (buildTree.js's buildChoiceNode)
    //    carries a `recipe` too but never gets one - no children of its
    //    own to connect it to.
    //  - choice hub: a needsChoice node that's already had reuse engaged
    //    (suppliedFromLeftover set) - once that's true, its real recipe
    //    options branch out from this hub exactly like a resolved node's
    //    ingredients would (see collect()'s children loop), just with a
    //    "still undecided" look instead of the recipe's own icon. A
    //    needsChoice node with reuse never touched has no hub at all -
    //    its options are laid out directly as this node's own children,
    //    same as before any of this existed (see reusePool.js's
    //    injectReuseChoices for the "Just reuse" card offered only then).
    //  - reuse hub: node's demand is (at least partly) covered by reuse -
    //    producing the remainder (recipe hub present), fully covered
    //    (isFullySupplied, no recipe resolved at all), or still choosing a
    //    recipe for the remainder (choice hub present).
    node._hasRecipeHub = Boolean(node.recipe) && node.children.length > 0;
    node._hasChoiceHub = node.needsChoice && node.suppliedFromLeftover > 0;
    const reuseEligible = node._hasRecipeHub || node.isFullySupplied || node._hasChoiceHub;
    node._hasReuseHub = reuseEligible
      && (node.suppliedFromLeftover > 0 || reuseAvailability(root, node.itemId, node.path) > 0);

    // No extra row reserved for the reuse-hub half of a split, on purpose -
    // it doesn't need one. collect()'s half-row split lands each hub
    // exactly half a row off of centerY, and centerY itself is always
    // derived from existing ROW_HEIGHT-spaced positions - so the split
    // naturally lands on the same half-row grid the surrounding
    // node/children/byproduct rows already occupy, no dedicated space to
    // carve out. An earlier version *did* reserve +1 here, which seemed
    // harmless until a byproduct (pinning the node's own row to the top of
    // its block - see below) combined with 2+ children: the reservation
    // inflated blockHeight, which skewed the children-centering `offset`
    // below without moving the pinned node/byproduct rows to match,
    // dragging the computed centerY - and both split hubs with it - about
    // half a row lower than where the node and its ingredients actually
    // sat. Confirmed by a user screenshot showing exactly that drift.
    const ownRows = 1 + node.byproducts.length;
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
    const hasChoiceHub = node._hasChoiceHub;
    const hasReuseHub = node._hasReuseHub;
    const spots = byproductSpots.get(node.path);

    // The "primary" slot - recipe hub or choice hub, whichever applies
    // (mutually exclusive: a node is either resolved or isn't) - both are
    // junctions real children route through, unlike the reuse hub.
    const hasPrimaryHub = hasRecipeHub || hasChoiceHub;

    // Horizontally it's the true midpoint of the gap between this node's
    // column and the next - a hub's stored position is a *center* point
    // (see treeCanvas.js's positionNode), not a left edge, so this needs no
    // adjustment for the hub's own width the way a left-edge box would.
    //
    // Vertically it's centered on the node's own extent - its own row plus
    // any byproduct rows - deliberately *not* on where its children end up.
    // A hub represents this node's own craft, not a summary of its whole
    // subtree, and children can end up almost anywhere depending on what
    // *their* own children need: a child with its own multi-recipe choice
    // or deep chain gets centered well below its row-in-isolation (see
    // assign()'s per-node centering), which used to drag this node's hub
    // down along with it even though nothing about this node's own craft
    // changed. Real, reported bug: expanding a child's own options taller
    // visibly pulled the parent's hub *and* reuse hub down with it, off of
    // where the node and its byproduct actually sat. Children still get
    // their edges (routed through the hub below) - they just don't get a
    // vote in where the hub itself sits.
    //
    // Without a byproduct there's only one row to anchor to (pos.y) and
    // nothing to average, but that's already correct: assign() centers a
    // no-byproduct node's own row on its children itself, so pos.y already
    // *is* the right anchor point without this needing to look at children
    // directly.
    //
    // Snapped to the nearest half-row *before* any split below: byproduct
    // rows are always whole-row multiples, but rounding guards against
    // float drift the same half-row split below would otherwise carry
    // straight through.
    let hubPos = null;
    let choiceHubPos = null;
    let reuseHubPos = null;
    if (hasPrimaryHub || hasReuseHub) {
      const ys = [pos.y];
      if (spots) ys.push(...spots.map((spot) => spot.y));
      const half = ROW_HEIGHT / 2;
      const rawCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
      const centerY = Math.round(rawCenterY / half) * half;
      const x = pos.x + NODE_WIDTH + (COLUMN_WIDTH - NODE_WIDTH) / 2;

      if (hasPrimaryHub && hasReuseHub) {
        // Split the reserved row evenly around the point a lone primary
        // hub would otherwise sit at - half a row up for the reuse hub,
        // half a row down for the primary one - so they read as sharing
        // the middle ground rather than one shoving the other out of the
        // way.
        reuseHubPos = { x, y: centerY - half };
        const primaryPos = { x, y: centerY + half };
        if (hasRecipeHub) hubPos = primaryPos; else choiceHubPos = primaryPos;
      } else if (hasReuseHub) {
        // isFullySupplied: no primary hub to share the point with, so the
        // reuse hub takes it outright.
        reuseHubPos = { x, y: centerY };
      } else if (hasRecipeHub) {
        hubPos = { x, y: centerY };
      } else {
        choiceHubPos = { x, y: centerY };
      }

      if (reuseHubPos) {
        nodes.push({ node, ...reuseHubPos, isReuseHub: true });
        // The card-to-reuse-hub connector - same idea as the card-to-
        // primary-hub edge below, just so the reuse hub doesn't look like
        // it's floating unattached to anything.
        edges.push({ from: pos, to: reuseHubPos });
        maxRow = Math.max(maxRow, reuseHubPos.y / ROW_HEIGHT);
      }
      if (hubPos) {
        nodes.push({ node, ...hubPos, isHub: true });
        edges.push({ from: pos, to: hubPos });
        maxRow = Math.max(maxRow, hubPos.y / ROW_HEIGHT);
      }
      if (choiceHubPos) {
        nodes.push({ node, ...choiceHubPos, isChoiceHub: true });
        edges.push({ from: pos, to: choiceHubPos });
        maxRow = Math.max(maxRow, choiceHubPos.y / ROW_HEIGHT);
      }
    }

    if (spots) {
      // A byproduct comes from the same craft as everything else this node
      // makes - the recipe hub *is* that craft, so anchoring here (rather
      // than arbitrarily picking one ingredient, the old behavior) is both
      // more accurate and unambiguous regardless of how many ingredients
      // there are. Falls back to the node's own position on the (unlikely)
      // chance there's no recipe hub to anchor to. Byproducts only ever
      // exist on a resolved node anyway (buildTree.js computes them after
      // choosing a recipe), so hasRecipeHub is the right - and only
      // reachable - case here, never hasChoiceHub.
      const anchor = hasRecipeHub ? hubPos : pos;
      node.byproducts.forEach((byproduct, i) => {
        nodes.push({ node: byproduct, ...spots[i], isByproduct: true });
        byproductEdges.push({ from: anchor, to: spots[i] });
      });
    }

    const primaryHubPos = hubPos ?? choiceHubPos;
    for (const child of node.children) {
      // Routed through the primary hub when there is one - fromIsHub tells
      // treeCanvas.js's edgePath not to offset by a full card width, since
      // a hub's position is already a center point, not a card's left edge.
      // Never the reuse hub - it's not a junction anything flows through.
      edges.push({ from: hasPrimaryHub ? primaryHubPos : pos, to: positions.get(child.path), fromIsHub: hasPrimaryHub });
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
