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
//
// openChoiceMenu: { path } | null - which needsChoice node (if any) has its
// collapsed choice-hub popover open right now (see treeNode.js's
// renderChoiceHub) - the one thing about handler state layout itself needs
// to know, since it changes whether that node's real choice cards get laid
// out as siblings at all (collapsed: no, popover-open or first-ever-view:
// yes) - see _choiceCollapsed below.
export function layoutTree(root, openChoiceMenu) {
  const positions = new Map(); // path -> { x, y }
  const byproductSpots = new Map(); // path -> [{ x, y }, ...], same order as node.byproducts
  let maxDepth = 0;
  let maxRow = 0;

  function measure(node) {
    maxDepth = Math.max(maxDepth, node.depth);

    // A needsChoice node collapses its real choice cards into a single
    // compact "pick a recipe" hub (see treeNode.js's renderChoiceHub) once
    // it's already had *some* reuse applied - otherwise every partial
    // adjustment (nudge the reuse amount down a bit) would dump the full
    // card spread back out, which is what a user actually complained
    // about. First-ever view of a choice (suppliedFromLeftover never set)
    // always shows the cards directly, same as before this existed.
    // Reopened via the hub's own click (onToggleChoiceMenu), tracked here
    // rather than a per-node flag so it survives this node's own rebuilds.
    node._choiceCollapsed = node.needsChoice && node.suppliedFromLeftover > 0 && openChoiceMenu?.path !== node.path;

    // What actually gets laid out as this node's children row(s) - the
    // real ones, unless collapsed behind a choice-hub (nothing to lay out
    // then; the popover renders them separately, off of the hub itself,
    // not as tree siblings).
    const children = node._choiceCollapsed ? [] : node.children;
    node._layoutChildren = children;

    // Recipe hub, choice hub, and reuse hub are three independent slots -
    // a node can have any subset of them (see collect() below):
    //  - recipe hub: resolved to a recipe *and* has ingredients to connect
    //    it to. A choice pseudo-node (buildTree.js's buildChoiceNode)
    //    carries a `recipe` too but never gets one - no children of its
    //    own to connect it to, so this checks real node.children, not the
    //    possibly-collapsed `children` above.
    //  - choice hub: the collapsed placeholder described above.
    //  - reuse hub: node's demand is (at least partly) covered by reuse -
    //    producing the remainder (recipe hub present), fully covered
    //    (isFullySupplied, no recipe resolved at all), or still choosing a
    //    recipe for the remainder but collapsed behind a choice hub. Not
    //    offered on an *un*-collapsed needsChoice node - the inline "Just
    //    reuse" card (reusePool.js's injectReuseChoices) is that same
    //    control already, no need to duplicate it as a floating hub too.
    node._hasRecipeHub = Boolean(node.recipe) && node.children.length > 0;
    node._hasChoiceHub = node._choiceCollapsed;
    const reuseEligible = node._hasRecipeHub || node.isFullySupplied || node._choiceCollapsed;
    node._hasReuseHub = reuseEligible
      && (node.suppliedFromLeftover > 0 || reuseAvailability(root, node.itemId, node.path) > 0);

    // No extra row reserved for the reuse/choice hub split, on purpose -
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
    const childrenRows = children.reduce((sum, child) => sum + measure(child), 0);
    node._blockHeight = Math.max(ownRows, childrenRows);
    return node._blockHeight;
  }

  // Returns the node's own row (not its block's top), since that's what a
  // non-byproduct parent needs to center itself on.
  function assign(node, rowStart) {
    const x = node.depth * COLUMN_WIDTH;
    const children = node._layoutChildren;

    const childrenRows = children.reduce((sum, child) => sum + child._blockHeight, 0);
    const offset = (node._blockHeight - childrenRows) / 2;
    let cursor = rowStart + offset;
    const childOwnRows = children.map((child) => {
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

    const children = node._layoutChildren;
    const hasRecipeHub = node._hasRecipeHub;
    const hasChoiceHub = node._hasChoiceHub;
    const hasReuseHub = node._hasReuseHub;
    const spots = byproductSpots.get(node.path);

    // The "primary" slot - recipe hub or choice-hub placeholder, whichever
    // applies (mutually exclusive: a node is either resolved or isn't).
    const hasPrimaryHub = hasRecipeHub || hasChoiceHub;

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
    //
    // Snapped to the nearest half-row *before* any split below: centering
    // on a mix of pinned-top (byproduct) and offset-centered (children)
    // rows routinely lands on a quarter-row fraction, which a further
    // +-half-row split then carries straight through - a real, visible
    // bug (two nodes with more than one child each ended up a quarter-row
    // off from where either hub actually belonged). Snapping first means
    // the two split positions always land on the same half-row grid
    // everything else in this block was already placed on.
    let hubPos = null;
    let choiceHubPos = null;
    let reuseHubPos = null;
    if (hasPrimaryHub || hasReuseHub) {
      const ys = [pos.y, ...children.map((child) => positions.get(child.path).y)];
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
        // isFullySupplied (or a collapsed choice with no reuse hub, which
        // can't actually happen - see _hasReuseHub's gate - but this
        // branch only needs the reuse case to be correct either way): no
        // primary hub to share the point with, so the reuse hub takes it
        // outright.
        reuseHubPos = { x, y: centerY };
      } else if (hasRecipeHub) {
        hubPos = { x, y: centerY };
      } else {
        choiceHubPos = { x, y: centerY };
      }

      if (reuseHubPos) {
        nodes.push({ node, ...reuseHubPos, isReuseHub: true });
        // The card-to-reuse-hub connector - same idea as the card-to-
        // recipe-hub edge below, just so the reuse hub doesn't look like
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
      // chance there's no recipe hub to anchor to.
      const anchor = hasRecipeHub ? hubPos : pos;
      node.byproducts.forEach((byproduct, i) => {
        nodes.push({ node: byproduct, ...spots[i], isByproduct: true });
        byproductEdges.push({ from: anchor, to: spots[i] });
      });
    }

    for (const child of children) {
      // Routed through the recipe hub when there is one - fromIsHub tells
      // treeCanvas.js's edgePath not to offset by a full card width, since
      // a hub's position is already a center point, not a card's left edge.
      // Never the choice/reuse hub - neither is a junction ingredients
      // flow through.
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
