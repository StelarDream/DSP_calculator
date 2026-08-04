import { fetchJSON, normalizeRange } from './utils.js';

// Map<beltId, { id, speed: {min,max} }>
export async function loadBelts() {
  const raw = await fetchJSON('data/belts.json');

  const belts = new Map();
  for (const [id, speed] of Object.entries(raw)) {
    belts.set(id, { id, speed: normalizeRange(speed, 1) });
  }

  return { belts };
}
