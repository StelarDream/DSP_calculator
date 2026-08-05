import { fetchJSON, normalizeRange } from './utils.js';

// Map<recipeType, Array<{ building, speed: {min,max} }>>
export async function loadFactories() {
  const raw = await fetchJSON('data/factories.json');

  const byRecipeType = new Map();
  for (const [recipeType, buildings] of Object.entries(raw)) {
    const entries = Object.entries(buildings).map(([building, stats]) => ({
      building,
      speed: normalizeRange(stats.speed, 1),
    }));
    byRecipeType.set(recipeType, entries);
  }

  return { byRecipeType };
}
