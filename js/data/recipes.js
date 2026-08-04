import { fetchJSON } from './utils.js';

// Recipe: { id, type, result: {itemId: qty}, ingredients: {itemId: qty}, chance, time }
export async function loadRecipes() {
  const raw = await fetchJSON('recipes.json');

  const recipes = raw.map((entry, index) => ({
    id: index,
    type: entry.type,
    result: entry.result,
    ingredients: entry.ingredients,
    chance: entry.chance ?? 1,
    time: entry.time ?? 0,
  }));

  // Which recipes produce a given item.
  const byResultItem = new Map();
  for (const recipe of recipes) {
    for (const itemId of Object.keys(recipe.result)) {
      if (!byResultItem.has(itemId)) byResultItem.set(itemId, []);
      byResultItem.get(itemId).push(recipe);
    }
  }

  return { recipes, byResultItem };
}
