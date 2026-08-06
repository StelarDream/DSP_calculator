import { getYieldMultiplier } from './proliferatorMultiplier.js';
import { groupNodesByRecipe } from './groupNodesByRecipe.js';

// Compiles a built tree (see buildTree.js) down to Factory View's
// aggregated lines - the "compile" step described in the Factory View plan.
//
// Nodes first bucket by (recipe, proliferation) via groupNodesByRecipe.js -
// two nodes sharing a recipe only fold into the same bucket if their
// proliferation matches exactly. Each bucket then splits into one or more
// *lines* (what actually becomes a card) via splitBucketIntoLines below -
// a single recipe can produce more than one card once its "reuse this
// byproduct" toggle (see treeView.js/treeNode.js) is switched off for one
// of the items it produces.
//
// byproductReuse (Map<path, boolean>, from treeState - see treeView.js) is
// the tree-level toggle: which nodes have opted OUT of sharing a batch of
// crafts with whatever else produces their item as a byproduct elsewhere.
// Absent = reused (the default).
export function buildFactoryPlan(root, proliferation, byproductReuse) {
  const buckets = groupNodesByRecipe(root, proliferation);

  const result = [];
  for (const bucket of buckets.values()) {
    result.push(...splitBucketIntoLines(bucket, byproductReuse));
  }

  return result.sort((a, b) => b.crafts - a.crafts);
}

// Turns one (recipe, proliferation) bucket into its factory-view lines:
//
// - A single *shared* line covering the recipe's primary result plus
//   whichever other results are still toggled to reuse - one shared batch
//   of crafts, sized to whichever of those items has the biggest
//   independent demand (the rest come along for free as its byproducts,
//   since one craft always produces every result at once - this is also
//   what "even partially" covering a smaller demand falls out of
//   automatically, no separate partial-credit logic needed).
// - A separate *dedicated* line per item whose node(s) explicitly opted
//   out of reuse - meaning the user wants that item produced by its own
//   independent batch of crafts rather than sharing with anything else,
//   which reads far more honestly as its own card (own building choice,
//   own machine count) than as a hidden add-on folded into the shared
//   line's numbers.
//
// `line.itemId` marks which item a dedicated line exists for - null on
// the shared line, whose display still defaults to the recipe's own
// primary result (Object.keys(recipe.result)[0], see linePrimaryItemId
// below) since that item can never itself be toggled to waste and so is
// always present in the shared group.
function splitBucketIntoLines(bucket, byproductReuse) {
  const { key: baseKey, recipe, mode, level, nodesByItem } = bucket;
  const primaryItemId = Object.keys(recipe.result)[0];

  const lines = [];
  let sharedCrafts = 0;
  let sharedPaths = [];

  for (const [itemId, nodes] of nodesByItem) {
    const crafts = nodes.reduce((sum, node) => sum + craftsForNode(node, mode, level), 0);
    const paths = nodes.map((node) => node.path);
    // An item counts as reused only if *every* node targeting it agrees -
    // in the overwhelmingly common case there's just one such node, but a
    // lone opt-out among several shouldn't be silently overruled by the
    // others.
    const reused = itemId === primaryItemId || paths.every((path) => byproductReuse?.get(path) ?? true);

    if (reused) {
      sharedCrafts = Math.max(sharedCrafts, crafts);
      sharedPaths = sharedPaths.concat(paths);
    } else {
      lines.push({ key: itemLineKey(recipe.id, mode, level, itemId), recipe, mode, level, itemId, crafts, nodePaths: paths });
    }
  }

  // Always true in practice (the primary result's node, if it has one,
  // can never be toggled to waste) - guarded anyway rather than assumed,
  // so a bucket with nothing left in the shared group simply doesn't get
  // a shared card instead of showing an empty one.
  if (sharedPaths.length > 0) {
    lines.push({ key: baseKey, recipe, mode, level, itemId: null, crafts: sharedCrafts, nodePaths: sharedPaths });
  }

  return lines;
}

// Which item a line should be identified by for display (see
// factoryCard.js) - the item it was split off for if it's a dedicated
// line, otherwise the recipe's own primary result.
export function linePrimaryItemId(line) {
  return line.itemId ?? Object.keys(line.recipe.result)[0];
}

// How many crafts of node.recipe this single node represents, in the same
// per-root-unit ratio terms as node.qty - the inverse of buildTree's own
// `yieldScale` for this node (not stored on the node, so recomputed here).
function craftsForNode(node, mode, level) {
  const outputQty = node.recipe.result[node.itemId] ?? 1;
  const yieldMultiplier = getYieldMultiplier(node.recipe, mode, level);
  return node.qty / (outputQty * yieldMultiplier);
}

// Same key format as groupNodesByRecipe.js's bucketKey, extended for a
// dedicated (single-item) line - itemId null or undefined collapses back
// to the plain shared-line key, so callers that don't know in advance
// whether they're dealing with a shared or dedicated line can always
// reach for this one. Exported so callers that need to predict a line's
// key *before* buildFactoryPlan runs again (e.g. factoryView.js carrying
// a building choice over to the line a proliferation edit just moved it
// to) don't have to duplicate the format.
export function itemLineKey(recipeId, mode, level, itemId) {
  const base = `${recipeId}::${mode ?? 'none'}::${level ?? 'none'}`;
  return itemId ? `${base}::${itemId}` : base;
}
