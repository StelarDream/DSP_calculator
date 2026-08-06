// How much of `itemId` is available in the leftover pool for a *specific*
// node to draw on, given the tree as currently built. Deliberately a
// snapshot of the live tree object (already built with whatever reuse
// overrides are currently in effect) rather than a fresh recompute - see
// buildTree.js/summarizeTree.js for how node.byproducts and
// node.suppliedFromLeftover already reflect the current state.
//
// gross = every byproduct of `itemId` anywhere in the tree, full stop.
// reusedElsewhere = how much of that gross total other nodes have already
// claimed - `excludePath` (the node the picker is currently open for) is
// left out of that tally on purpose, so re-opening a node's own existing
// allocation doesn't count it against itself and shrink its own ceiling.
//
// This is what keeps two independent reuse picks from double-claiming the
// same leftover: as long as every picker's max is capped at this number,
// the sum of everyone's suppliedFromLeftover for an item can never exceed
// what that item's byproducts actually produced.
export function reuseAvailability(root, itemId, excludePath) {
  let gross = 0;
  let reusedElsewhere = 0;

  (function walk(node) {
    for (const byproduct of node.byproducts) {
      if (byproduct.itemId === itemId) gross += byproduct.qty;
    }
    if (node.suppliedFromLeftover && node.itemId === itemId && node.path !== excludePath) {
      reusedElsewhere += node.suppliedFromLeftover;
    }
    for (const child of node.children) walk(child);
  })(root);

  return Math.max(0, gross - reusedElsewhere);
}
