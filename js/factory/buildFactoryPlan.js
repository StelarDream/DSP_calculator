import { getYieldMultiplier } from './proliferatorMultiplier.js';

// Compiles a built tree (see buildTree.js) down to Factory View's
// aggregated lines - the "compile" step described in the Factory View plan.
//
// A tree node gets its own factory line whenever it's actually running a
// recipe (resolved, expanded, not a cycle guard) - collapsed/leaf/
// needsChoice nodes contribute nothing here, mirroring summarizeTree.js's
// notion of "leaf-like".
//
// Lines are merged by (recipe, proliferation) - two nodes sharing a recipe
// only fold into one line if their proliferation matches *exactly*: same
// mode AND same level. Different level (or one proliferated, one not)
// keeps them on separate lines, since Speed Up/Extra Yield change that
// line's effective machine throughput and so can't share one machine-count
// calculation. "No proliferation" and an explicit opt-out
// ({ mode: null, level: null }, see treeView.js's onClearProliferation)
// are treated as the same "no effect" line - there's no throughput
// difference between them.
//
// Each line's `crafts` is a *ratio*, same spirit as buildTree's qty: how
// many crafts of that recipe happen per 1 unit of the root item, at the
// tree's timeless root qty of 1. It's crafts rather than the node's raw
// item qty because a recipe can be merged in from nodes that consumed
// different results of it (main product at one spot, a byproduct
// elsewhere) - those aren't the same unit, but "one craft of this recipe"
// always is. computeMachineCounts.js turns this ratio into real machines
// once an actual target rate enters the picture.
export function buildFactoryPlan(root, proliferation) {
  const lines = new Map(); // key -> line

  function walk(node) {
    const runsRecipe = node.recipe && !node.isCollapsed && !node.needsChoice && !node.isCycle && !node.isLeaf;

    if (runsRecipe) {
      const { mode, level } = proliferation.get(node.path) ?? {};
      const key = lineKey(node.recipe.id, mode, level);

      if (!lines.has(key)) {
        lines.set(key, {
          recipe: node.recipe,
          mode: mode ?? null,
          level: level ?? null,
          crafts: 0,
          nodePaths: [],
        });
      }

      const line = lines.get(key);
      line.crafts += craftsForNode(node, mode, level);
      line.nodePaths.push(node.path);
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);

  return [...lines.values()].sort((a, b) => b.crafts - a.crafts);
}

// How many crafts of node.recipe this single node represents, in the same
// per-root-unit ratio terms as node.qty - the inverse of buildTree's own
// `yieldScale` for this node (not stored on the node, so recomputed here).
function craftsForNode(node, mode, level) {
  const outputQty = node.recipe.result[node.itemId] ?? 1;
  const yieldMultiplier = getYieldMultiplier(node.recipe, mode, level);
  return node.qty / (outputQty * yieldMultiplier);
}

// mode/level default to null so "never set" and "explicitly cleared" (both
// { mode: null, level: null } and a plain missing entry) land on the same
// key - see the module comment above.
function lineKey(recipeId, mode, level) {
  return `${recipeId}::${mode ?? 'none'}::${level ?? 'none'}`;
}
