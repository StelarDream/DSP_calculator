import { fetchJSON } from './utils.js';

// Recipe: { id, type, result: {itemId: qty}, ingredients: {itemId: qty}, chance, time,
//   replicator (manually makeable by hand), proliferation: {speed, chance, yield} }
export async function loadRecipes() {
  const raw = await fetchJSON('data/recipes.json');

  const recipes = raw.map((entry, index) => ({
    id: index,
    type: entry.type,
    result: entry.result,
    ingredients: entry.ingredients,
    chance: entry.chance ?? 1,
    time: entry.time ?? 0,
    replicator: entry.replicator ?? false,
    proliferation: {
      speed: entry.proliferation?.speed ?? false,
      chance: entry.proliferation?.chance ?? false,
      yield: entry.proliferation?.yield ?? false,
    },
  }));

  // Which recipes produce a given item.
  const byResultItem = new Map();
  for (const recipe of recipes) {
    for (const itemId of Object.keys(recipe.result)) {
      if (!byResultItem.has(itemId)) byResultItem.set(itemId, []);
      byResultItem.get(itemId).push(recipe);
    }
  }

  // Which recipes consume a given item (i.e. what it's "used in").
  const byIngredientItem = new Map();
  for (const recipe of recipes) {
    for (const itemId of Object.keys(recipe.ingredients)) {
      if (!byIngredientItem.has(itemId)) byIngredientItem.set(itemId, []);
      byIngredientItem.get(itemId).push(recipe);
    }
  }

  return { recipes, byResultItem, byIngredientItem };
}
