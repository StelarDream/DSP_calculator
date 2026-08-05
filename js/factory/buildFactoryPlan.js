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
//
// byproductReuse ({ "<lineKey>::<itemId>" -> boolean }, see factoryView.js)
// matters here, not just for the bottom bar's raw-input totals: a single
// craft produces *every* one of the recipe's results at once, so when two
// different tree nodes each demand a different result of the very same
// recipe (e.g. a symmetric recipe that outputs both Hydrogen and
// Antimatter, with one branch of the tree asking for each), one shared
// batch of crafts can satisfy both demands simultaneously - counting them
// separately (the old plain sum) double-crafts. combineItemCrafts below
// takes the max across whichever items are allowed to share a batch this
// way instead of summing them, falling back to a dedicated add-on amount
// for any item explicitly toggled to waste (opting out of being covered
// by someone else's crafts).
export function buildFactoryPlan(root, proliferation, byproductReuse) {
  const lines = new Map(); // key -> line

  function walk(node) {
    const runsRecipe = node.recipe && !node.isCollapsed && !node.needsChoice && !node.isCycle && !node.isLeaf;

    if (runsRecipe) {
      const { mode, level } = proliferation.get(node.path) ?? {};
      const key = lineKey(node.recipe.id, mode, level);

      if (!lines.has(key)) {
        lines.set(key, {
          key,
          recipe: node.recipe,
          mode: mode ?? null,
          level: level ?? null,
          // Crafts needed to satisfy each item this line was actually
          // asked to produce, kept separate per item until
          // combineItemCrafts folds them into the line's final `crafts`
          // below - summing them straight into one number is exactly the
          // double-crafting bug this map exists to avoid.
          craftsByItem: new Map(),
          nodePaths: [],
        });
      }

      const line = lines.get(key);
      const crafts = craftsForNode(node, mode, level);
      line.craftsByItem.set(node.itemId, (line.craftsByItem.get(node.itemId) ?? 0) + crafts);
      line.nodePaths.push(node.path);
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);

  const result = [...lines.values()].map((line) => ({
    key: line.key,
    recipe: line.recipe,
    mode: line.mode,
    level: line.level,
    nodePaths: line.nodePaths,
    crafts: combineItemCrafts(line, byproductReuse),
  }));

  return result.sort((a, b) => b.crafts - a.crafts);
}

// A line's final crafts figure: the biggest of whichever items are allowed
// to share one batch of crafts (the recipe's primary result always can -
// it's never byproduct-toggleable - plus any byproduct still toggled to
// reuse), *plus* a dedicated amount tacked on for any item explicitly
// toggled to waste, since opting out of reuse also means opting out of
// being covered by someone else's crafts.
function combineItemCrafts(line, byproductReuse) {
  const primaryItemId = Object.keys(line.recipe.result)[0];
  let shared = 0;
  let dedicated = 0;

  for (const [itemId, crafts] of line.craftsByItem) {
    const reused = itemId === primaryItemId || (byproductReuse?.get(`${line.key}::${itemId}`) ?? true);
    if (reused) {
      shared = Math.max(shared, crafts);
    } else {
      dedicated += crafts;
    }
  }

  return shared + dedicated;
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
// key - see the module comment above. Exported so callers that need to
// predict a line's key *before* buildFactoryPlan runs again (e.g.
// factoryView.js carrying a building choice over to the line a
// proliferation edit just moved it to) don't have to duplicate the format.
export function lineKey(recipeId, mode, level) {
  return `${recipeId}::${mode ?? 'none'}::${level ?? 'none'}`;
}
