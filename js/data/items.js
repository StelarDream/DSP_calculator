import { fetchJSON } from './utils.js';

// Map<itemId, { id, description, icon }>
export async function loadItems(descriptions) {
  const ids = await fetchJSON('data/items.json');

  const items = new Map();
  for (const id of ids) {
    items.set(id, {
      id,
      description: descriptions[id] ?? null,
      icon: `assets/items/${id}.png`,
    });
  }

  return items;
}
