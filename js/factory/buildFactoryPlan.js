import { getYieldMultiplier } from './proliferatorMultiplier.js';
import { isItemReused } from './byproductReuse.js';

// Compiles a built tree (see buildTree.js) down to Factory View's
// aggregated lines - the "compile" step described in the Factory View plan.
//
// A tree node gets its own factory line whenever it's actually running a
// recipe (resolved, expanded, not a cycle guard) - collapsed/leaf/
// needsChoice nodes contribute nothing here, mirroring summarizeTree.js's
// notion of "leaf-like".
//
// Nodes first bucket by (recipe, proliferation) - two nodes sharing a
// recipe only fold into the same bucket if their proliferation matches
// *exactly*: same mode AND same level. Different level (or one
// proliferated, one not) keeps them in separate buckets, since Speed
// Up/Extra Yield change the effective machine throughput and so can't
// share one machine-count calculation. "No proliferation" and an explicit
// opt-out ({ mode: null, level: null }, see treeView.js's
// onClearProliferation) are treated as the same "no effect" bucket -
// there's no throughput difference between them.
//
// Each bucket then splits into one or more *lines* (what actually becomes
// a card) via splitBucketIntoLines below - a single recipe can produce
// more than one card once byproduct reuse is toggled off for something.
export function buildFactoryPlan(root, proliferation, byproductReuse) {
  const buckets = new Map(); // baseKey -> bucket

  function walk(node) {
    const runsRecipe = node.recipe && !node.isCollapsed && !node.needsChoice && !node.isCycle && !node.isLeaf;

    if (runsRecipe) {
      const { mode, level } = proliferation.get(node.path) ?? {};
      const baseKey = lineKey(node.recipe.id, mode, level);

      if (!buckets.has(baseKey)) {
        buckets.set(baseKey, {
          recipe: node.recipe,
          mode: mode ?? null,
          level: level ?? null,
          // Crafts needed to satisfy each item this bucket was actually
          // asked to produce, and which node paths asked for it - kept
          // separate per item until splitBucketIntoLines below decides how
          // to fold or split them into real lines. Summing them straight
          // into one number (the old approach) is exactly the
          // double-crafting bug this exists to avoid.
          craftsByItem: new Map(),
          pathsByItem: new Map(),
        });
      }

      const bucket = buckets.get(baseKey);
      const crafts = craftsForNode(node, mode, level);
      bucket.craftsByItem.set(node.itemId, (bucket.craftsByItem.get(node.itemId) ?? 0) + crafts);
      if (!bucket.pathsByItem.has(node.itemId)) bucket.pathsByItem.set(node.itemId, []);
      bucket.pathsByItem.get(node.itemId).push(node.path);
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);

  const result = [];
  for (const [baseKey, bucket] of buckets) {
    result.push(...splitBucketIntoLines(baseKey, bucket, byproductReuse));
  }

  return result.sort((a, b) => b.crafts - a.crafts);
}

// Turns one (recipe, proliferation) bucket into its factory-view lines:
//
// - A single *shared* line covering the recipe's primary result plus
//   whichever other results are still toggled to reuse - one shared batch
//   of crafts, sized to whichever of those items has the biggest
//   independent demand (the rest come along for free as its byproducts,
//   since one craft always produces every result at once).
// - A separate *dedicated* line per item explicitly toggled to waste -
//   "wasted" means the user wants that item produced by its own
//   independent batch of crafts rather than sharing with anything else,
//   and that reads far more honestly as its own card (own building
//   choice, own machine count) than as a hidden add-on folded into the
//   shared line's numbers.
//
// `line.itemId` marks which item a dedicated line exists for - null on
// the shared line, whose display still defaults to the recipe's own
// primary result (Object.keys(recipe.result)[0], see linePrimaryItemId
// below) since that item can never itself be toggled to waste and so is
// always present in the shared group.
function splitBucketIntoLines(baseKey, bucket, byproductReuse) {
  const { recipe, mode, level, craftsByItem, pathsByItem } = bucket;
  const primaryItemId = Object.keys(recipe.result)[0];

  const lines = [];
  let sharedCrafts = 0;
  let sharedPaths = [];

  for (const [itemId, crafts] of craftsByItem) {
    if (isItemReused(byproductReuse, baseKey, itemId, primaryItemId)) {
      sharedCrafts = Math.max(sharedCrafts, crafts);
      sharedPaths = sharedPaths.concat(pathsByItem.get(itemId));
    } else {
      lines.push({
        key: itemLineKey(recipe.id, mode, level, itemId),
        recipe,
        mode,
        level,
        itemId,
        crafts,
        nodePaths: pathsByItem.get(itemId),
      });
    }
  }

  // Always true in practice (the primary result can never be toggled to
  // waste, see factoryCard.js's renderRateList) - guarded anyway rather
  // than assumed, so a bucket with nothing left in the shared group
  // simply doesn't get a shared card instead of showing an empty one.
  if (sharedPaths.length > 0) {
    lines.push({
      key: baseKey,
      recipe,
      mode,
      level,
      itemId: null,
      crafts: sharedCrafts,
      nodePaths: sharedPaths,
    });
  }

  return lines;
}

// Which item a line should be identified by for display and for deciding
// which of its Output rows get a reuse/waste toggle (see factoryCard.js) -
// the item it was split off for if it's a dedicated line, otherwise the
// recipe's own primary result.
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

// mode/level default to null so "never set" and "explicitly cleared" (both
// { mode: null, level: null } and a plain missing entry) land on the same
// key - see the module comment above. Exported so callers that need to
// predict a line's key *before* buildFactoryPlan runs again (e.g.
// factoryView.js carrying a building choice over to the line a
// proliferation edit just moved it to) don't have to duplicate the format.
export function lineKey(recipeId, mode, level) {
  return `${recipeId}::${mode ?? 'none'}::${level ?? 'none'}`;
}

// Same as lineKey, but for a dedicated (single-item) line - itemId null
// or undefined collapses back to the plain shared-line key, so callers
// that don't know in advance whether they're dealing with a shared or
// dedicated line can always reach for this one.
export function itemLineKey(recipeId, mode, level, itemId) {
  const base = lineKey(recipeId, mode, level);
  return itemId ? `${base}::${itemId}` : base;
}
