import { fetchJSON } from './utils.js';

// Map<buildingId, { id, description, icon }>
export async function loadBuildings(descriptions) {
  const ids = await fetchJSON('data/buildings.json');

  const buildings = new Map();
  for (const id of ids) {
    buildings.set(id, {
      id,
      description: descriptions[id] ?? null,
      icon: `assets/buildings/${id}.png`,
    });
  }

  return buildings;
}
