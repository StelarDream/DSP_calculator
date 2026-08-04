import { fetchJSON } from './utils.js';

// Map<sourceId, { id, icon }>. Sources only have an id + icon for now - no
// descriptions.json entries exist for them yet.
export async function loadSources() {
  const ids = await fetchJSON('data/sources.json');

  const sources = new Map();
  for (const id of ids) {
    sources.set(id, {
      id,
      icon: `assets/sources/${id}.png`,
    });
  }

  return sources;
}
