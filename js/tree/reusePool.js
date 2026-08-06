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

// How much of each item is currently being manually reused across the
// whole tree - itemId -> total suppliedFromLeftover. Shared by
// summarizeTree.js's own sidebar and Factory View's computeRawInputs.js,
// which both need the same number for the same reason: a fully/partially
// reused node never becomes a demand entry of its own (Tree View) or a
// compiled line (Factory View - see buildFactoryPlan.js's runsRecipe),
// so nothing else naturally knows this specific chunk of some other node's
// byproduct output was explicitly claimed rather than left over. Factored
// out here instead of duplicated in both places (used to live inline in
// summarizeTree.js only).
export function computeReusedTotals(root) {
  const totals = new Map();
  (function walk(node) {
    if (node.suppliedFromLeftover) {
      totals.set(node.itemId, (totals.get(node.itemId) ?? 0) + node.suppliedFromLeftover);
    }
    for (const child of node.children) walk(child);
  })(root);
  return totals;
}

// Appends a "Just reuse" pseudo-choice alongside a needsChoice node's real
// recipe options, whenever there's actually leftover to draw on *and*
// reuse hasn't already been engaged for this node - a shortcut for maxing
// out reuse (see treeNode.js's renderReuseChoiceNode) *before* ever
// picking a recipe, since buildTree.js now resolves reuse before recipe
// choice (see its buildNode) - if reuse alone would cover the whole
// demand, no recipe choice is needed at all.
//
// Once suppliedFromLeftover is already set (reuse engaged, even
// partially), this card stops appearing - layoutTree.js instead gives the
// node its own reuse hub for adjusting/clearing that amount (see
// _hasChoiceHub/_hasReuseHub), so offering the same action twice (once as
// an inline card, once as the hub) would just be a duplicate control for
// the same thing.
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
    if (node.needsChoice && !node.suppliedFromLeftover) {
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
