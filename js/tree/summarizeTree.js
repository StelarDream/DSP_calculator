// Aggregates the "outer boundary" of a built tree: every leaf-like node's
// quantity, summed by item - what actually has to come from outside the
// tree (mined, bought, stockpiled...), not the full chain of intermediate
// products.
//
// Deliberately naive about byproducts: a byproduct never reduces demand
// for that same item elsewhere in the tree, even if the numbers would
// otherwise cancel out - it's always counted in full as `leftover`,
// regardless of what `needed` says about that same item. Matches Factory
// View's own computeRawInputs.js, which settled on the same "no cross-item
// netting" behavior after a byproduct silently covering an unrelated
// node's demand turned out to be more confusing than useful (see memory:
// factory-view-plan).
//
// A node counts as leaf-like - contributes to demand, isn't recursed into
// further - whenever there's nothing more to decompose it into *right now*:
//   - genuinely not craftable (node.isLeaf)
//   - collapsed - "I'll produce it myself" (see buildTree.js)
//   - a cycle guard
//   - not yet resolved to a specific recipe (node.needsChoice) - its
//     children are choice *options*, not real ingredients (and don't even
//     have a real qty), so recursing into them would be wrong.
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
    const leafLike = node.isLeaf || node.isCollapsed || node.needsChoice;

    if (leafLike) {
      const e = demandEntry(node.itemId, node.object);
      e.qty += node.qty;
      if (node.needsChoice) e.pending = true;
      return;
    }

    for (const byproduct of node.byproducts) {
      // reusedQty (see buildTree.js) is the portion already claimed by a
      // reuse link elsewhere in the tree - it left `needed` there (the
      // linked demand's own qty was reduced before this walk ever saw it),
      // so it has to leave `leftover` here too, or it'd read as "free"
      // surplus in both directions at once.
      const qty = byproduct.qty - (byproduct.reusedQty ?? 0);
      if (qty > 0) leftoverEntry(byproduct.itemId, byproduct.object).qty += qty;
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);

  // Floating-point scale-chain arithmetic rarely lands on an exact zero -
  // treat anything this close to nothing as not worth showing.
  const EPSILON = 1e-6;
  const needed = [...demandTotals.values()].filter((item) => item.qty > EPSILON);
  const leftover = [...leftoverTotals.values()].filter((item) => item.qty > EPSILON);

  needed.sort((a, b) => b.qty - a.qty);
  leftover.sort((a, b) => b.qty - a.qty);

  return { needed, leftover };
}
