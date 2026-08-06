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
// Deliberately naive about byproducts: if two nodes merged into the same
// line each target a *different* result of that recipe (e.g. a symmetric
// recipe producing both Hydrogen and Antimatter, demanded separately
// elsewhere in the tree), their crafts are summed independently rather
// than shared - each node's demand is satisfied by its own dedicated
// batch of crafts, full stop, with no attempt to credit one node's
// incidental byproduct toward another node's need. Any resulting surplus
// just shows up as plain Leftover in the bottom bar (computeRawInputs.js).
export function buildFactoryPlan(root, proliferation) {
  const lines = new Map(); // key -> line

  function walk(node) {
    // isFullySupplied (see buildTree.js) means this node's entire demand is
    // manually reused from leftover elsewhere - nothing actually crafts
    // here, same reasoning as skipping a collapsed/leaf node.
    const runsRecipe = node.recipe && !node.isCollapsed && !node.needsChoice && !node.isCycle && !node.isLeaf && !node.isFullySupplied;

    if (runsRecipe) {
      const { mode, level } = proliferation.get(node.path) ?? {};
      const key = lineKey(node.recipe.id, mode, level);

      if (!lines.has(key)) {
        lines.set(key, {
          key,
          recipe: node.recipe,
          mode: mode ?? null,
          level: level ?? null,
          crafts: 0,
          nodePaths: [],
          // Every item some contributing node actually asked for - as
          // opposed to a result the recipe happens to also produce that
          // nothing asked for. Not the same as "the recipe's first result
          // key": if only the Antimatter branch of a symmetric recipe is
          // expanded, this line's crafts exist *because* of that demand,
          // so Antimatter is what's targeted here, not Hydrogen - even
          // though Hydrogen happens to be listed first in recipe.result.
          // Drives linePrimaryItemId below, and in turn which of a line's
          // outputs count as normal production (nets against demand
          // elsewhere) vs. incidental byproduct (never does) in
          // computeRawInputs.js.
          targetedItems: new Set(),
        });
      }

      const line = lines.get(key);
      line.crafts += craftsForNode(node, mode, level);
      line.nodePaths.push(node.path);
      line.targetedItems.add(node.itemId);
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);

  return [...lines.values()].sort((a, b) => b.crafts - a.crafts);
}

// Which item a line should be identified by for display (icon/title, see
// factoryCard.js) - the first item any contributing node actually
// targeted, in tree-walk order. Deliberately not "the recipe's first
// result key": that's arbitrary JSON order and can name an item nothing
// in this line's own demand ever asked for (see targetedItems above).
export function linePrimaryItemId(line) {
  return line.targetedItems.values().next().value;
}

// How many crafts of node.recipe this single node represents, in the same
// per-root-unit ratio terms as node.qty - the inverse of buildTree's own
// `yieldScale` for this node (not stored on the node, so recomputed here).
// Uses producedQty (qty minus whatever's manually reused from leftover
// and/or manually supplied from outside the tree - see buildTree.js's
// suppliedFromLeftover/manualSupply), not the raw qty, so a partially
// covered node's machine count reflects only what it's actually producing.
function craftsForNode(node, mode, level) {
  const producedQty = node.qty - (node.suppliedFromLeftover ?? 0) - (node.manualSupply ?? 0);
  const outputQty = node.recipe.result[node.itemId] ?? 1;
  const yieldMultiplier = getYieldMultiplier(node.recipe, mode, level);
  return producedQty / (outputQty * yieldMultiplier);
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
