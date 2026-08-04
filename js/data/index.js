import { fetchJSON } from './utils.js';
import { loadRecipes } from './recipes.js';
import { loadCollectables } from './collectables.js';
import { loadFactories } from './factories.js';
import { loadCollectors } from './collectors.js';
import { loadItems } from './items.js';
import { loadBuildings } from './buildings.js';
import { loadBelts } from './belts.js';

export async function loadRegistries() {
  const descriptions = await fetchJSON('data/descriptions.json');

  const [recipes, collectables, factories, collectors, items, buildings, belts] = await Promise.all([
    loadRecipes(),
    loadCollectables(),
    loadFactories(),
    loadCollectors(),
    loadItems(descriptions),
    loadBuildings(descriptions),
    loadBelts(),
  ]);

  return { recipes, collectables, factories, collectors, items, buildings, belts };
}
