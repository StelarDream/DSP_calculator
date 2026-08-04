import { DEFAULT_EXPAND_DEPTH } from './constants.js';

// Recursively expands an item into a tree of what it takes to craft it.
// Pure function of (registries + the two override maps) - no DOM, easy to
// reason about and re-run on every interaction.
//
// A node is a leaf purely because the item isn't craftable (no recipe
// produces it) - collectable/raw items included. Craftable items always
// recurse into their chosen recipe's ingredients.
//
// choices:   Map<path, recipeId>  - which recipe a node uses, when it has
//            more than one option. Falls back to the first recipe found.
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
    recipeOptions,
    recipe: null,
    isCollapsed: false,
    children: [],
  };

  if (isLeaf) return node;

  const chosenId = choices.get(path);
  node.recipe = recipeOptions.find((r) => r.id === chosenId) ?? recipeOptions[0];

  const expanded = overrides.has(path) ? overrides.get(path) : depth < DEFAULT_EXPAND_DEPTH;
  if (!expanded) {
    node.isCollapsed = true;
    return node;
  }

  // Ratio of each ingredient to *one* craft, scaled by how many of this
  // item's own output the parent actually needs - a recipe that yields 2
  // per craft only needs half as many ingredient crafts per unit.
  const outputQty = node.recipe.result[itemId] ?? 1;
  const scale = qty / outputQty;

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
        recipeOptions: [],
        recipe: null,
        isCollapsed: false,
        children: [],
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
