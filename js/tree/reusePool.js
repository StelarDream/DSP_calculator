import { buildChoiceNode } from './buildTree.js';

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

// The "Just reuse" pseudo-child itself - not a real ingredient (isLeaf,
// empty children/byproducts), just a stand-in for "supply this whole node
// from leftover instead," rendered by treeNode.js's renderReuseChoiceNode.
function buildReuseChoiceNode(node, available) {
  return {
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
  };
}

// Appends a "Just reuse" pseudo-choice alongside a node's real recipe
// option(s), whenever there's actually leftover to draw on *and* reuse
// hasn't already been engaged for this node - a shortcut for maxing out
// reuse (see treeNode.js's renderReuseChoiceNode) *before* ever picking a
// recipe, since buildTree.js now resolves reuse before recipe choice (see
// its buildNode) - if reuse alone would cover the whole demand, no recipe
// choice is needed at all.
//
// Two cases:
//  - node.needsChoice (>1 real recipe): the card joins the existing
//    options as one more sibling, same as before.
//  - node.autoResolved (exactly 1 recipe, silently defaulted to it - see
//    buildTree.js): retroactively turned into a needsChoice-shaped node
//    too, its already-built recipe/children/byproducts discarded and
//    replaced with a two-card choice (the one real recipe, plus reuse) -
//    "Options.length > 1" (real recipes + the reuse option), not just
//    recipeOptions.length > 1. Otherwise a single-recipe item could never
//    offer reuse as an alternative at all: it never enters the
//    needsChoice branch in the first place, so this card would have
//    nothing to attach to. Skipped once reuse is *already* engaged
//    (suppliedFromLeftover set) - at that point the node has its own
//    reuse hub for adjusting/clearing it (see layoutTree.js's
//    _hasReuseHub), and re-surfacing the same choice on top of that would
//    just undo the visible confirmation the hub already gives it.
//
// Deliberately a post-build mutation pass over the *finished* tree, not
// something buildTree.js does inline - reuseAvailability needs the whole
// tree's byproducts to answer "how much is available," which doesn't
// exist yet mid-recursion (a sibling ingredient later in the same recipe's
// ingredient list, e.g. Antimatter next to Hydrogen, hasn't been built yet
// while Hydrogen's own node is being constructed). Same reasoning as
// treeView.js's applyDefaultProliferation being a separate pass rather
// than living inside buildTree.js.
export function injectReuseChoices(root, registries) {
  (function walk(node) {
    if (node.needsChoice) {
      if (!node.suppliedFromLeftover) {
        const available = reuseAvailability(root, node.itemId, node.path);
        if (available > 0) node.children.push(buildReuseChoiceNode(node, available));
      }
      for (const child of node.children) walk(child);
      return;
    }

    if (node.autoResolved && !node.suppliedFromLeftover) {
      const available = reuseAvailability(root, node.itemId, node.path);
      if (available > 0) {
        const recipe = node.recipe;
        node.needsChoice = true;
        node.recipe = null;
        node.byproducts = [];
        node.children = [
          buildChoiceNode(recipe, node.itemId, node.path, node.depth, registries),
          buildReuseChoiceNode(node, available),
        ];
        return; // the discarded children were the real ingredients - nothing left under this node to walk into
      }
    }

    for (const child of node.children) walk(child);
  })(root);
}
