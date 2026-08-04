import { DEFAULT_EXPAND_DEPTH } from './constants.js';

// Recursively expands an item into a tree of what it takes to craft it.
// Pure function of (registries + the two override maps) - no DOM, easy to
// reason about and re-run on every interaction.
//
// A node is a leaf purely because the item isn't craftable (no recipe
// produces it) - collectable/raw items included. Craftable items always
// recurse into their chosen recipe's ingredients.
//
// A *collapsed* craftable node never resolves a recipe at all - collapsed
// is "I'll produce this myself" (bought, stockpiled, whatever), so which
// recipe it *would* use is moot until you actually expand it.
//
// choices:   Map<path, recipeId>  - which recipe an expanded node uses, once
//            decided. Nodes with >1 option and no entry yet render as a
//            choice step instead of guessing - see buildChoiceNode.
// overrides: Map<path, boolean>   - manual expand/collapse toggles. Absent
//            entries fall back to the DEFAULT_EXPAND_DEPTH rule.
export function buildTree(rootItemId, qty, registries, { choices = new Map(), overrides = new Map() } = {}) {
  return buildNode({
    itemId: rootItemId,
    qty,
    path: rootItemId,
    depth: 0,
    ancestors: new Set([rootItemId]),
    registries,
    choices,
    overrides,
  });
}

function buildNode({ itemId, qty, path, depth, ancestors, registries, choices, overrides }) {
  const object = registries.objects.get(itemId);
  const recipeOptions = registries.recipes.byResultItem.get(itemId) ?? [];
  const isLeaf = recipeOptions.length === 0;

  const node = {
    path,
    itemId,
    object,
    qty,
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

  // Anything else this recipe outputs besides the item we asked for - e.g.
  // Energetic Graphite's Refining recipe also spits out surplus Hydrogen.
  // Purely informational (see treeNode.js) - not part of the tree proper.
  node.byproducts = Object.entries(node.recipe.result)
    .filter(([resultId]) => resultId !== itemId)
    .map(([resultId, resultQty]) => ({
      itemId: resultId,
      object: registries.objects.get(resultId),
      qty: resultQty * scale,
    }));

  for (const [ingredientId, ingredientQty] of Object.entries(node.recipe.ingredients)) {
    const childPath = `${path}>${ingredientId}`;

    if (ancestors.has(ingredientId)) {
      // Recipe loops back onto one of its own ancestors (e.g. a byproduct
      // feeding back in) - stop here rather than recursing forever.
      node.children.push({
        path: childPath,
        itemId: ingredientId,
        object: registries.objects.get(ingredientId),
        qty: ingredientQty * scale,
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
      });
      continue;
    }

    node.children.push(buildNode({
      itemId: ingredientId,
      qty: ingredientQty * scale,
      path: childPath,
      depth: depth + 1,
      ancestors: new Set([...ancestors, ingredientId]),
      registries,
      choices,
      overrides,
    }));
  }

  return node;
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
