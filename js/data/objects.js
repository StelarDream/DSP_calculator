import { fetchJSON } from './utils.js';

// Merged registry of items + buildings: Map<id, { id, description, icon, tags }>.
// `tags` is a Set of strings, starting with the data-driven 'item'/'building'
// tag from whichever source list the id came from. Dynamic tags
// (collectable/craftable/factory/collector) get added afterwards by
// applyDynamicTags() once the other registries are loaded - see tags.js.
export async function loadObjects(descriptions) {
  const [itemIds, buildingIds] = await Promise.all([
    fetchJSON('data/items.json'),
    fetchJSON('data/buildings.json'),
  ]);

  const objects = new Map();

  for (const id of itemIds) {
    objects.set(id, {
      id,
      description: descriptions[id] ?? null,
      icon: `assets/items/${id}.png`,
      tags: new Set(['item']),
    });
  }

  for (const id of buildingIds) {
    objects.set(id, {
      id,
      description: descriptions[id] ?? null,
      icon: `assets/buildings/${id}.png`,
      tags: new Set(['building']),
    });
  }

  return objects;
}
