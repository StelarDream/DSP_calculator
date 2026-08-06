import { DEFAULT_EXPAND_DEPTH } from './constants.js';
import { PROLIFERATOR_LEVELS } from './proliferatorLevels.js';

// Recursively expands an item into a tree of what it takes to craft it.
// Pure function of (registries + the two override maps, plus proliferation)
// - no DOM, easy to reason about and re-run on every interaction.
//
// A node is a leaf purely because the item isn't craftable (no recipe
// produces it) - collectable/raw items included. Craftable items always
// recurse into their chosen recipe's ingredients.
//
// A *collapsed* craftable node never resolves a recipe at all - collapsed
// is "I'll produce this myself" (bought, stockpiled, whatever), so which
// recipe it *would* use is moot until you actually expand it.
//
// choices:       Map<path, recipeId>  - which recipe an expanded node uses,
//                once decided. Nodes with >1 option and no entry yet render
//                as a choice step instead of guessing - see buildChoiceNode.
// overrides:     Map<path, boolean>   - manual expand/collapse toggles.
//                Absent entries fall back to the DEFAULT_EXPAND_DEPTH rule.
// proliferation: Map<path, {mode, level}> - per-node proliferation settings
//                (see treeView.js). Only `mode: 'yield'` feeds into the
//                quantity math here - see applyYield below for why.
// reuseDeltas:   Map<path, {qty, available, on, warning}> - how much of this
//                ingredient position's demand is being covered by a byproduct
//                elsewhere in the tree (see reuseAllocation.js). Computed
//                from a first, reuse-free build of the same tree - treeView.js
//                does that two-pass dance, this function only ever consumes
//                the result. `on: false` entries still carry a `qty` (so the
//                marker can re-offer it) but never actually reduce anything.
// reuseConsumed: Map<path, Map<itemId, qty>> - the mirror image of
//                reuseDeltas, keyed by the *producing* node's path instead -
//                how much of each byproduct that node makes has been claimed
//                by some reuseDelta elsewhere. Purely annotation (see
//                node.byproducts below); the qty math above already accounts
//                for it via reuseDeltas.
export function buildTree(rootItemId, qty, registries, {
  choices = new Map(), overrides = new Map(), proliferation = new Map(),
  reuseDeltas = new Map(), reuseConsumed = new Map(),
} = {}) {
  return buildNode({
    itemId: rootItemId,
    qty,
    path: rootItemId,
    depth: 0,
    ancestors: new Set([rootItemId]),
    registries,
    choices,
    overrides,
    proliferation,
    reuseDeltas,
    reuseConsumed,
  });
}

function buildNode({ itemId, qty, path, depth, ancestors, registries, choices, overrides, proliferation, reuseDeltas, reuseConsumed, qtyBeforeYield }) {
  const object = registries.objects.get(itemId);
  const recipeOptions = registries.recipes.byResultItem.get(itemId) ?? [];
  const isLeaf = recipeOptions.length === 0;

  const node = {
    path,
    itemId,
    object,
    qty,
    // Only set when a parent's Extra Yield made this node's own qty smaller
    // than it'd otherwise be - see the ingredient loop below and
    // treeNode.js's display of it. Undefined (not just equal to qty) is
    // the "nothing to show" case, not zero savings.
    qtyBeforeYield,
    depth,
    isLeaf,
    isCycle: false,
    isChoice: false,
    needsChoice: false,
    recipeOptions,
    recipe: null,
    isCollapsed: false,
    children: [],
    byproducts: [],
    // How much of *this* ingredient position's demand is covered by a
    // byproduct elsewhere in the tree - null when nothing matched. Purely
    // display metadata (see reuseMarker.js): the qty above has already had
    // it subtracted, by the parent's ingredient loop, before this node was
    // ever built - see the childQty computation below.
    reuse: reuseDeltas.get(path) ?? null,
  };

  if (isLeaf) return node;

  const expanded = overrides.has(path) ? overrides.get(path) : depth < DEFAULT_EXPAND_DEPTH;
  if (!expanded) {
    node.isCollapsed = true;
    return node;
  }

  const chosen = recipeOptions.find((r) => r.id === choices.get(path));
  if (!chosen && recipeOptions.length > 1) {
    // More than one way to make this and nothing picked yet - surface the
    // options as the node's "children" instead of guessing one. Resolves
    // into real ingredient children once onChoose records a pick.
    node.needsChoice = true;
    node.children = recipeOptions.map((recipe) => buildChoiceNode(recipe, itemId, path, depth, registries));
    return node;
  }

  node.recipe = chosen ?? recipeOptions[0];

  // Ratio of each ingredient to *one* craft, scaled by how many of this
  // item's own output the parent actually needs - a recipe that yields 2
  // per craft only needs half as many ingredient crafts per unit.
  const outputQty = node.recipe.result[itemId] ?? 1;
  const scale = qty / outputQty;

  // Extra Yield boosts every result of a craft (main product *and* any
  // byproduct) by the same multiplier, so it doesn't change how much
  // byproduct comes out for a given target qty - fewer crafts happen, but
  // each makes proportionally more, and the two cancel out. It only
  // reduces how many crafts are needed, which is what shrinks the
  // *ingredient* side: same inputs per craft, fewer crafts. So byproducts
  // keep using the plain `scale` above, and only ingredients use
  // `yieldScale` below.
  const yieldMultiplier = applyYield(node.recipe, path, proliferation);
  const yieldScale = qty / (outputQty * yieldMultiplier);

  // Anything else this recipe outputs besides the item we asked for - e.g.
  // Energetic Graphite's Refining recipe also spits out surplus Hydrogen.
  // Purely informational (see treeNode.js) - not part of the tree proper.
  // reusedQty (this node's own path is the "producer" side of
  // reuseConsumed - see reuseAllocation.js) never changes the qty actually
  // produced, just how much of it is annotated as spoken for elsewhere.
  const consumedHere = reuseConsumed.get(path);
  node.byproducts = Object.entries(node.recipe.result)
    .filter(([resultId]) => resultId !== itemId)
    .map(([resultId, resultQty]) => ({
      itemId: resultId,
      object: registries.objects.get(resultId),
      qty: resultQty * scale,
      reusedQty: consumedHere?.get(resultId) ?? 0,
    }));

  for (const [ingredientId, ingredientQty] of Object.entries(node.recipe.ingredients)) {
    const childPath = `${path}>${ingredientId}`;
    // A reuseDelta reduces this ingredient position's actual demand before
    // anything downstream ever sees it - the single insertion point that
    // gives both "collapsed: shrinks raw-material demand" and "expanded:
    // shrinks the recipe scale" for free, since both read this same qty.
    // Only ever the *applied* qty (already clamped to what's actually
    // available - see reuseAllocation.js), never negative.
    const reuseDelta = reuseDeltas.get(childPath);
    const reusedQty = reuseDelta?.on ? reuseDelta.qty : 0;
    const childQty = Math.max(0, ingredientQty * yieldScale - reusedQty);
    // Only worth showing "reduced from X" when yield actually shrank it -
    // an untouched node (yieldMultiplier === 1) has nothing to annotate.
    const childQtyBeforeYield = yieldMultiplier > 1 ? ingredientQty * scale : undefined;

    if (ancestors.has(ingredientId)) {
      // Recipe loops back onto one of its own ancestors (e.g. a byproduct
      // feeding back in) - stop here rather than recursing forever.
      node.children.push({
        path: childPath,
        itemId: ingredientId,
        object: registries.objects.get(ingredientId),
        qty: childQty,
        qtyBeforeYield: childQtyBeforeYield,
        depth: depth + 1,
        isLeaf: true,
        isCycle: true,
        isChoice: false,
        needsChoice: false,
        recipeOptions: [],
        recipe: null,
        isCollapsed: false,
        children: [],
        byproducts: [],
        reuse: reuseDeltas.get(childPath) ?? null,
      });
      continue;
    }

    node.children.push(buildNode({
      itemId: ingredientId,
      qty: childQty,
      qtyBeforeYield: childQtyBeforeYield,
      path: childPath,
      depth: depth + 1,
      ancestors: new Set([...ancestors, ingredientId]),
      registries,
      choices,
      overrides,
      proliferation,
      reuseDeltas,
      reuseConsumed,
    }));
  }

  return node;
}

// How much more a single craft yields at this node, if it's got Extra
// Yield active - 1 (no change) otherwise. Guards against a stale setting
// left behind by a recipe edit the same way treeNode.js's activeProlif
// does: only counts if the *current* recipe actually supports yield.
function applyYield(recipe, path, proliferation) {
  const setting = proliferation.get(path);
  if (setting?.mode !== 'yield' || !setting.level || !recipe.proliferation.yield) return 1;
  const level = PROLIFERATOR_LEVELS.find((l) => l.id === setting.level);
  return level?.yield ?? 1;
}

// A pseudo-node standing in for "expand using this recipe" - not a real
// ingredient, so it doesn't recurse and isn't tracked in `ancestors`.
// parentPath is what onChoose(parentPath, recipe.id) records the pick under.
// ingredientIcons is precomputed here (rather than left to the renderer)
// since resolving item icons is what buildTree already has registries for.
function buildChoiceNode(recipe, itemId, parentPath, depth, registries) {
  return {
    path: `${parentPath}»${recipe.id}`,
    parentPath,
    itemId,
    object: undefined,
    qty: undefined,
    depth: depth + 1,
    isLeaf: true,
    isCycle: false,
    isChoice: true,
    needsChoice: false,
    recipeOptions: [],
    recipe,
    ingredientIcons: Object.keys(recipe.ingredients).map((id) => ({
      id,
      icon: registries.objects.get(id)?.icon,
    })),
    isCollapsed: false,
    children: [],
    byproducts: [],
  };
}
