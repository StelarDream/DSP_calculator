// Raw ("assumed") input rates for Factory View's bottom bar - what still
// has to come from outside the compiled plan, in items/sec at the current
// target rate. Same demand/supply netting idea as summarizeTree.js (a
// byproduct produced somewhere in the tree offsets demand for that same
// item elsewhere), scaled by the tree's root qty=1 -> targetRate items/sec,
// but with one addition: wastedPathItems lets specific lines' byproducts
// be excluded from supply entirely - Factory View's per-card reuse/waste
// toggle (see factoryView.js). A wasted byproduct still gets produced (it
// shows in that card's own Output list) but doesn't reduce anyone else's
// raw demand for it.
//
// wastedPathItems: Set of "<nodePath>::<itemId>" strings - one entry per
// (contributing node, byproduct item) pair currently toggled to waste.
export function computeRawInputs(root, wastedPathItems, targetRate) {
  const totals = new Map(); // itemId -> { itemId, object, demand, supply }

  function entry(itemId, object) {
    if (!totals.has(itemId)) totals.set(itemId, { itemId, object, demand: 0, supply: 0 });
    return totals.get(itemId);
  }

  function walk(node) {
    const leafLike = node.isLeaf || node.isCollapsed || node.needsChoice;

    if (leafLike) {
      entry(node.itemId, node.object).demand += node.qty;
      return;
    }

    for (const byproduct of node.byproducts) {
      if (wastedPathItems.has(`${node.path}::${byproduct.itemId}`)) continue;
      entry(byproduct.itemId, byproduct.object).supply += byproduct.qty;
    }
    for (const child of node.children) walk(child);
  }

  walk(root);

  // Same "close enough to zero counts as fully netted" tolerance as
  // summarizeTree.js - floating-point scale chains rarely land exactly.
  const EPSILON = 1e-6;
  const needed = [];
  for (const item of totals.values()) {
    const net = (item.demand - item.supply) * targetRate;
    if (net > EPSILON) needed.push({ itemId: item.itemId, object: item.object, ratePerSec: net });
  }
  needed.sort((a, b) => b.ratePerSec - a.ratePerSec);

  return needed;
}
