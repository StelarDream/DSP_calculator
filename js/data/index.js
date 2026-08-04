import { fetchJSON } from './utils.js';
import { loadRecipes } from './recipes.js';
import { loadCollectables } from './collectables.js';
import { loadFactories } from './factories.js';
import { loadCollectors } from './collectors.js';
import { loadObjects } from './objects.js';
import { applyDynamicTags } from './tags.js';
import { loadBelts } from './belts.js';

export async function loadRegistries() {
  const descriptions = await fetchJSON('data/descriptions.json');

  const [recipes, collectables, factories, collectors, objects, belts] = await Promise.all([
    loadRecipes(),
    loadCollectables(),
    loadFactories(),
    loadCollectors(),
    loadObjects(descriptions),
    loadBelts(),
  ]);

  const registries = { recipes, collectables, factories, collectors, objects, belts };
  applyDynamicTags(objects, registries);

  return registries;
}
