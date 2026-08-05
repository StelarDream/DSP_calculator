// Raw ("assumed") input rates for Factory View's bottom bar - what still
// has to come from outside the compiled plan, in items/sec at the current
// target rate. Same demand/supply netting idea as summarizeTree.js (a
// byproduct produced somewhere in the tree offsets demand for that same
// item elsewhere), scaled by the tree's root qty=1 -> targetRate items/sec.
//
// wastedPathItems (Set of "<nodePath>::<itemId>" strings, see
// factoryView.js) marks specific lines' byproducts as toggled to waste -
// those never offset anyone else's demand, but still get tallied
// separately as `extra`: production that isn't helping anything, so it's
// worth surfacing even though it doesn't reduce `needed`. A *reused*
// byproduct only counts as `extra` for whatever's left over once it's
// finished offsetting demand elsewhere - same "needed vs leftover" split
// summarizeTree.js does, just renamed here since "leftover" reads as
// per-item excess while `extra` here also folds in wasted-by-choice supply.
export function computeRawInputs(root, wastedPathItems, targetRate) {
  const totals = new Map(); // itemId -> { itemId, object, demand, reusedSupply, wastedSupply }

  function entry(itemId, object) {
    if (!totals.has(itemId)) {
      totals.set(itemId, { itemId, object, demand: 0, reusedSupply: 0, wastedSupply: 0 });
    }
    return totals.get(itemId);
  }

  function walk(node) {
    const leafLike = node.isLeaf || node.isCollapsed || node.needsChoice;

    if (leafLike) {
      entry(node.itemId, node.object).demand += node.qty;
      return;
    }

    for (const byproduct of node.byproducts) {
      const item = entry(byproduct.itemId, byproduct.object);
      if (wastedPathItems.has(`${node.path}::${byproduct.itemId}`)) {
        item.wastedSupply += byproduct.qty;
      } else {
        item.reusedSupply += byproduct.qty;
      }
    }
    for (const child of node.children) walk(child);
  }

  walk(root);

  // Same "close enough to zero counts as fully netted" tolerance as
  // summarizeTree.js - floating-point scale chains rarely land exactly.
  const EPSILON = 1e-6;
  const needed = [];
  const extra = [];

  for (const item of totals.values()) {
    const neededRate = (item.demand - item.reusedSupply) * targetRate;
    if (neededRate > EPSILON) needed.push({ itemId: item.itemId, object: item.object, ratePerSec: neededRate });

    // Reused supply only becomes "extra" once it's covered every bit of
    // demand it could - a wasted byproduct never offsets anything, so all
    // of it counts.
    const reusedSurplus = Math.max(0, item.reusedSupply - item.demand);
    const extraRate = (reusedSurplus + item.wastedSupply) * targetRate;
    if (extraRate > EPSILON) extra.push({ itemId: item.itemId, object: item.object, ratePerSec: extraRate });
  }

  needed.sort((a, b) => b.ratePerSec - a.ratePerSec);
  extra.sort((a, b) => b.ratePerSec - a.ratePerSec);

  return { needed, extra };
}
