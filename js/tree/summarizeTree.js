// Aggregates the "outer boundary" of a built tree: every leaf-like node's
// quantity, summed by item and netted against any byproduct surplus of that
// same item anywhere in the tree. This is what actually has to come from
// outside the tree (mined, bought, stockpiled...), not the full chain of
// intermediate products.
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
  const totals = new Map(); // itemId -> { itemId, object, demand, supply, pending }

  function entry(itemId, object) {
    if (!totals.has(itemId)) totals.set(itemId, { itemId, object, demand: 0, supply: 0, pending: false });
    return totals.get(itemId);
  }

  function walk(node) {
    const leafLike = node.isLeaf || node.isCollapsed || node.needsChoice;

    if (leafLike) {
      const e = entry(node.itemId, node.object);
      e.demand += node.qty;
      if (node.needsChoice) e.pending = true;
      return;
    }

    for (const byproduct of node.byproducts) {
      entry(byproduct.itemId, byproduct.object).supply += byproduct.qty;
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);

  // Floating-point scale-chain arithmetic rarely lands on an exact zero -
  // treat anything this close as fully netted out rather than showing a
  // stray 0.00 on either side.
  const EPSILON = 1e-6;
  const needed = [];
  const leftover = [];

  for (const item of totals.values()) {
    const net = item.demand - item.supply;
    if (net > EPSILON) {
      needed.push({ ...item, qty: net });
    } else if (net < -EPSILON) {
      leftover.push({ ...item, qty: -net });
    }
  }

  needed.sort((a, b) => b.qty - a.qty);
  leftover.sort((a, b) => b.qty - a.qty);

  return { needed, leftover };
}
