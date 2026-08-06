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

    // Recipe hub, choice hub, reuse hub, and manual-supply hub - up to four
    // independent slots. Recipe/choice are mutually exclusive with each
    // other; reuse/manual can each independently be present or absent
    // alongside either of those (or alongside neither, on a fully-supplied
    // node) - see collect() below for how all the present ones share the
    // node's one reserved split row.
    //  - recipe hub: resolved to a recipe *and* has ingredients to connect
    //    it to. A choice pseudo-node (buildTree.js's buildChoiceNode)
    //    carries a `recipe` too but never gets one - no children of its
    //    own to connect it to.
    //  - choice hub: a needsChoice node that's already had reuse and/or
    //    manual supply engaged (suppliedFromLeftover or manualSupply set) -
    //    once either's true, its real recipe options branch out from this
    //    hub exactly like a resolved node's ingredients would (see
    //    collect()'s children loop), just with a "still undecided" look
    //    instead of the recipe's own icon. A needsChoice node with neither
    //    touched has no hub at all - its options are laid out directly as
    //    this node's own children, same as before any of this existed (see
    //    reusePool.js's injectReuseChoices for the "Reuse leftover"/
    //    "Supply myself" cards offered only then).
    //  - reuse hub: how much of this node's demand is drawn from another
    //    node's leftover byproduct output - only offered when there's
    //    actually something to draw on (or already engaged), same pool-
    //    gated condition it's always had.
    //  - manual-supply hub: how much is brought in from outside the tree
    //    entirely (see buildTree.js's manualSupplyOverrides) - no *pool*
    //    to gate on the way reuse has, but there's still a real ceiling:
    //    once reuse alone already covers this node's entire demand, there
    //    is nothing left for manual supply to cover (buildNode would clamp
    //    any request for it straight to 0 - see buildTree.js's `afterReuse`),
    //    so the hub hides rather than sitting there offering an amount
    //    that could never be anything but zero. Doesn't touch the recipe/
    //    choice hub at all - that's still driven purely by whether there's
    //    a genuine remainder left to craft, same as always, independent of
    //    this hub's own visibility.
    node._hasRecipeHub = Boolean(node.recipe) && node.children.length > 0;
    node._hasChoiceHub = node.needsChoice && (node.suppliedFromLeftover > 0 || node.manualSupply > 0);
    const reuseEligible = node._hasRecipeHub || node.isFullySupplied || node._hasChoiceHub;
    node._hasReuseHub = reuseEligible
      && (node.suppliedFromLeftover > 0 || reuseAvailability(root, node.itemId, node.path) > 0);
    node._hasManualHub = reuseEligible && node.qty - (node.suppliedFromLeftover ?? 0) > 0;

    // Every present hub (primary + reuse + manual, up to 3) now sits a
    // full row apart from its neighbors, centered on the node's own
    // row-plus-byproducts extent (see collect()'s split below) - a user-
    // reported fix after 3 hubs sharing the old half-row squeeze rendered
    // as visibly cramped/overlapping. That needs real room reserved, not
    // borrowed from whatever slack a neighboring block happens to have:
    // `hubSlots` present hubs need `hubSlots` consecutive row-slots
    // (`n` hubs spread a full ROW_HEIGHT apart span `n-1` row-heights,
    // i.e. `n` row-slots), so this node's own reserved span has to be at
    // least that tall too, not just tall enough for its own row plus
    // byproducts. `_hubExtraPad` is how much of that (if any) sticks out
    // past the byproduct span on *each* side - assign() below adds it to
    // this node's own row so the hub stack's center still lands exactly
    // on the node-plus-byproducts center, never drifting to one edge of
    // the extra room. An earlier version instead reserved a flat +1 here
    // for the old 2-hub case, which seemed harmless until a byproduct
    // (pinning the node's own row to the top of its block - see below)
    // combined with 2+ children: the reservation inflated blockHeight,
    // which skewed the children-centering `offset` below without moving
    // the pinned node/byproduct rows to match, dragging the computed
    // centerY - and every split hub with it - lower than where the node
    // and its ingredients actually sat. Confirmed by a user screenshot
    // showing exactly that drift - `_hubExtraPad` exists specifically so
    // growing the reservation this time moves the pinned row *with* it.
    const hubSlots = (node._hasRecipeHub || node._hasChoiceHub ? 1 : 0) + (node._hasReuseHub ? 1 : 0) + (node._hasManualHub ? 1 : 0);
    const baseSpan = 1 + node.byproducts.length;
    const ownRows = Math.max(baseSpan, hubSlots);
    node._hubExtraPad = Math.max(0, hubSlots - baseSpan) / 2;
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
      // + _hubExtraPad: leaves room above for however much the hub stack
      // needs to overhang the byproduct span (see measure() above) - a
      // no-op (adds 0) whenever the hubs already fit within it.
      ownRow = rowStart + node._hubExtraPad;
      byproductSpots.set(node.path, node.byproducts.map((_, i) => ({ x, y: (ownRow + 1 + i) * ROW_HEIGHT })));
      maxRow = Math.max(maxRow, ownRow + node.byproducts.length);
    } else if (childOwnRows.length > 0) {
      // Self-resolving: when the hub stack needs more room than a single
      // row, node._blockHeight already grew to fit it (see measure()),
      // which grows `offset` above and recenters the children within the
      // taller block - so their own center (computed here) already lands
      // on the middle of that block, exactly where the hub stack needs to
      // be centered too. No separate _hubExtraPad step needed in this
      // branch.
      ownRow = (childOwnRows[0] + childOwnRows[childOwnRows.length - 1]) / 2;
    } else {
      // No byproducts, no children (e.g. a fully-supplied leaf-like node
      // with just its reuse/manual hubs) - same reasoning as the
      // byproduct branch above, just with nothing else to anchor to.
      ownRow = rowStart + node._hubExtraPad;
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
    const hasManualHub = node._hasManualHub;
    const spots = byproductSpots.get(node.path);

    // The "primary" slot - recipe hub or choice hub, whichever applies
    // (mutually exclusive: a node is either resolved or isn't) - both are
    // junctions real children route through, unlike the reuse/manual hubs.
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
    // float drift the split below would otherwise carry straight through.
    let hubPos = null;
    let choiceHubPos = null;
    let reuseHubPos = null;
    let manualHubPos = null;
    if (hasPrimaryHub || hasReuseHub || hasManualHub) {
      const ys = [pos.y];
      if (spots) ys.push(...spots.map((spot) => spot.y));
      const half = ROW_HEIGHT / 2;
      const rawCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
      const centerY = Math.round(rawCenterY / half) * half;
      const x = pos.x + NODE_WIDTH + (COLUMN_WIDTH - NODE_WIDTH) / 2;

      // Whichever of the up-to-three slots are actually present this node,
      // spread a full ROW_HEIGHT apart (one whole cell, not half) and
      // centered on centerY - reuse above manual above primary (top to
      // bottom), primary last since it's the "main" one and reads
      // naturally at the bottom, closest to where a plain resolved node's
      // hub would sit with neither side hub present at all. 1 slot lands
      // dead-center; 2 lands at ±half a row (1 row apart from each
      // other); 3 adds centerY itself as the middle slot, ±1 full row for
      // the outer two - measure()/assign() above already grew this node's
      // own reserved block to fit that full span, so this never has to
      // borrow space from a neighboring block the way it would have on
      // the tighter half-row spacing this replaced.
      const order = [];
      if (hasReuseHub) order.push('reuse');
      if (hasManualHub) order.push('manual');
      if (hasPrimaryHub) order.push('primary');

      const n = order.length;
      order.forEach((kind, i) => {
        const y = centerY - ((n - 1) / 2) * ROW_HEIGHT + i * ROW_HEIGHT;
        const slotPos = { x, y };
        if (kind === 'reuse') reuseHubPos = slotPos;
        else if (kind === 'manual') manualHubPos = slotPos;
        else if (hasRecipeHub) hubPos = slotPos;
        else choiceHubPos = slotPos;
      });

      if (reuseHubPos) {
        nodes.push({ node, ...reuseHubPos, isReuseHub: true });
        // The card-to-reuse-hub connector - same idea as the card-to-
        // primary-hub edge below, just so the reuse hub doesn't look like
        // it's floating unattached to anything.
        edges.push({ from: pos, to: reuseHubPos });
        maxRow = Math.max(maxRow, reuseHubPos.y / ROW_HEIGHT);
      }
      if (manualHubPos) {
        nodes.push({ node, ...manualHubPos, isManualHub: true });
        edges.push({ from: pos, to: manualHubPos });
        maxRow = Math.max(maxRow, manualHubPos.y / ROW_HEIGHT);
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
