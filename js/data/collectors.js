import { fetchJSON, normalizeRange } from './utils.js';

// Map<collectionType, Array<{ collector, speed: {min,max}, chance: {min,max} }>>
export async function loadCollectors() {
  const raw = await fetchJSON('data/collectors.json');

  const byCollectionType = new Map();
  for (const [collectionType, collectorsForType] of Object.entries(raw)) {
    const entries = Object.entries(collectorsForType).map(([collector, stats]) => ({
      collector,
      speed: normalizeRange(stats.speed, 1),
      chance: normalizeRange(stats.chance, 1),
    }));
    byCollectionType.set(collectionType, entries);
  }

  return { byCollectionType };
}
