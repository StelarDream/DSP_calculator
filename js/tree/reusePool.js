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

// Appends a "Just reuse" pseudo-choice alongside a needsChoice node's real
// recipe options, whenever there's actually leftover to draw on - a
// shortcut for maxing out reuse (see treeNode.js's onChooseReuse handler)
// *before* ever picking a recipe, since buildTree.js now resolves reuse
// before recipe choice (see its buildNode) - if reuse alone would cover
// the whole demand, no recipe choice is needed at all.
//
// Deliberately a post-build mutation pass over the *finished* tree, not
// something buildTree.js does inline - reuseAvailability needs the whole
// tree's byproducts to answer "how much is available," which doesn't
// exist yet mid-recursion (a sibling ingredient later in the same recipe's
// ingredient list, e.g. Antimatter next to Hydrogen, hasn't been built yet
// while Hydrogen's own node is being constructed). Same reasoning as
// treeView.js's applyDefaultProliferation being a separate pass rather
// than living inside buildTree.js.
export function injectReuseChoices(root) {
  (function walk(node) {
    if (node.needsChoice) {
      const available = reuseAvailability(root, node.itemId, node.path);
      if (available > 0) {
        node.children.push({
          path: `${node.path}»reuse`,
          parentPath: node.path,
          itemId: node.itemId,
          object: node.object,
          qty: undefined,
          depth: node.depth + 1,
          isLeaf: true,
          isCycle: false,
          isChoice: false,
          isReuseChoice: true,
          needsChoice: false,
          recipeOptions: [],
          recipe: null,
          available,
          isCollapsed: false,
          children: [],
          byproducts: [],
        });
      }
    }
    for (const child of node.children) walk(child);
  })(root);
}
