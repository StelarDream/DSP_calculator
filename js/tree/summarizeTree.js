import { computeReusedTotals } from './reusePool.js';

// Aggregates the "outer boundary" of a built tree: every leaf-like node's
// quantity, summed by item - what actually has to come from outside the
// tree (mined, bought, stockpiled...), not the full chain of intermediate
// products.
//
// Deliberately naive about byproducts: a byproduct never reduces demand
// for that same item elsewhere in the tree on its own, even if the numbers
// would otherwise cancel out - it's always counted in full as `leftover`,
// regardless of what `needed` says about that same item. Matches Factory
// View's own computeRawInputs.js, which settled on the same "no automatic
// cross-item netting" behavior after a byproduct silently covering an
// unrelated node's demand turned out to be more confusing than useful (see
// memory: factory-view-plan). The one exception is manual, opt-in reuse
// (node.suppliedFromLeftover - see buildTree.js and treeView.js's reuse
// hub): that's a user decision, not automatic netting, so it's the only
// thing allowed to reduce `leftover` below the raw byproduct total.
//
// A node counts as leaf-like - contributes to demand, isn't recursed into
// further - whenever there's nothing more to decompose it into *right now*:
//   - genuinely not craftable (node.isLeaf)
//   - collapsed - "I'll produce it myself" (see buildTree.js)
//   - a cycle guard - counts only the portion *not* being recycled back
//     into its own ancestor's output (node.recycledQty - see buildTree.js
//     and cycleRecycle.js), same "user's explicit choice, not automatic"
//     treatment reuse gets above.
//   - not yet resolved to a specific recipe (node.needsChoice) - its
//     children are choice *options*, not real ingredients (and don't even
//     have a real qty), so recursing into them would be wrong.
//   - fully covered by reuse and/or manual supply (node.isFullySupplied) -
//     nothing about it is actually being produced, so no byproducts of its
//     own, but see the qty formula below for why this doesn't mean zero
//     demand either.
export function summarizeTree(root) {
  const demandTotals = new Map(); // itemId -> { itemId, object, qty, pending }
  const leftoverTotals = new Map(); // itemId -> { itemId, object, qty }

  function demandEntry(itemId, object) {
    if (!demandTotals.has(itemId)) demandTotals.set(itemId, { itemId, object, qty: 0, pending: false });
    return demandTotals.get(itemId);
  }

  function leftoverEntry(itemId, object) {
    if (!leftoverTotals.has(itemId)) leftoverTotals.set(itemId, { itemId, object, qty: 0 });
    return leftoverTotals.get(itemId);
  }

  function walk(node) {
    const leafLike = node.isLeaf || node.isCollapsed || node.needsChoice || node.isFullySupplied;

    if (leafLike) {
      const e = demandEntry(node.itemId, node.object);
      // node.qty is the node's *full* demand, not just what's left after
      // reuse - only the suppliedFromLeftover portion comes back out here
      // (it's produced elsewhere in the tree, already counted as demand
      // wherever *that* node's own ingredients were built smaller for it),
      // or it'd double-count. manualSupply is deliberately left in: it's
      // brought in from *outside* the tree entirely (see buildTree.js), so
      // unlike reuse there's nothing else in the tree to net it against -
      // it's still real demand, the tool just isn't the one telling you
      // how to make it. isLeaf/isCollapsed nodes never have
      // suppliedFromLeftover/manualSupply set (buildTree.js only resolves
      // either for expanded, recipe-bearing nodes), so this is a no-op for
      // them - same as isFullySupplied nodes with manualSupply === qty
      // (nothing subtracted, full amount counted) vs. suppliedFromLeftover
      // === qty (fully netted, zero demand).
      e.qty += node.qty - (node.suppliedFromLeftover ?? 0) - (node.recycledQty ?? 0);
      if (node.needsChoice) e.pending = true;
      return;
    }

    for (const byproduct of node.byproducts) {
      leftoverEntry(byproduct.itemId, byproduct.object).qty += byproduct.qty;
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);

  // Reuse only ever nets against the *leftover* side (see module comment) -
  // never against `needed`, which already reflects reuse's effect on
  // demand indirectly (a fully/partially reused node produces less, so its
  // own ingredient children were already built smaller by buildTree.js).
  for (const [itemId, reused] of computeReusedTotals(root)) {
    const entry = leftoverTotals.get(itemId);
    if (entry) entry.qty -= reused;
  }

  // Floating-point scale-chain arithmetic rarely lands on an exact zero -
  // treat anything this close to nothing as not worth showing.
  const EPSILON = 1e-6;
  const needed = [...demandTotals.values()].filter((item) => item.qty > EPSILON);
  const leftover = [...leftoverTotals.values()].filter((item) => item.qty > EPSILON);

  needed.sort((a, b) => b.qty - a.qty);
  leftover.sort((a, b) => b.qty - a.qty);

  return { needed, leftover };
}
