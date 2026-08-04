import { fetchJSON } from './utils.js';

// Merged registry of items + buildings + sources: Map<id, { id, description, icon, tags }>.
// `tags` is a Set of strings, starting with the data-driven 'item'/'building'/
// 'source' tag from whichever source list the id came from. Dynamic tags
// (collectable/craftable/factory/collector) get added afterwards by
// applyDynamicTags() once the other registries are loaded - see tags.js.
export async function loadObjects(descriptions) {
  const [itemIds, buildingIds, sourceIds] = await Promise.all([
    fetchJSON('data/tags/items.json'),
    fetchJSON('data/tags/buildings.json'),
    fetchJSON('data/tags/sources.json'),
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

  for (const id of sourceIds) {
    objects.set(id, {
      id,
      description: descriptions[id] ?? null,
      icon: `assets/sources/${id}.png`,
      tags: new Set(['source']),
    });
  }

  return objects;
}
