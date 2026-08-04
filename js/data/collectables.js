import { fetchJSON } from './utils.js';

// Collectable: { id, type, result, source, rarity }
export async function loadCollectables() {
  const raw = await fetchJSON('collectable.json');

  const collectables = raw.map((entry, index) => ({
    id: index,
    type: entry.type,
    result: entry.result,
    source: entry.source ?? null,
    rarity: entry.rarity ?? 'guaranteed',
  }));

  return { collectables };
}
