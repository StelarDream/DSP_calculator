function matchesSearch(id, query) {
  if (!query) return true;
  return id.toLowerCase().includes(query.toLowerCase());
}

const FILTER_PREDICATES = {
  items: {
    all: () => true,
    collectable: (id, categories) => categories.collectableItems.has(id),
    craftable: (id, categories) => categories.craftableItems.has(id),
  },
  buildings: {
    all: () => true,
    factories: (id, categories) => categories.factoryBuildings.has(id),
    collectors: (id, categories) => categories.collectorBuildings.has(id),
  },
};

// Picks which entities (items or buildings) belong in the sidebar list for
// the current tab/filter/search combination.
export function selectEntities(state, registries, categories) {
  if (!registries || !categories) return [];

  const { tab, filter, search } = state;
  const source = tab === 'buildings' ? registries.buildings : registries.items;
  const predicate = FILTER_PREDICATES[tab]?.[filter] ?? (() => true);
  const query = search.trim();

  return Array.from(source.values())
    .filter((entity) => predicate(entity.id, categories))
    .filter((entity) => matchesSearch(entity.id, query))
    .sort((a, b) => a.id.localeCompare(b.id));
}
