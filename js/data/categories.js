// Derives id sets for the item/building filter chips from the loaded
// registries, once, so list selection doesn't have to walk the raw
// recipe/factory/collector data on every keystroke.
export function buildCategorySets(registries) {
  const collectableItems = new Set(
    registries.collectables.collectables.map((c) => c.result)
  );

  const craftableItems = new Set(registries.recipes.byResultItem.keys());

  const factoryBuildings = new Set();
  for (const entries of registries.factories.byRecipeType.values()) {
    for (const entry of entries) factoryBuildings.add(entry.building);
  }

  const collectorBuildings = new Set();
  for (const entries of registries.collectors.byCollectionType.values()) {
    for (const entry of entries) collectorBuildings.add(entry.collector);
  }

  return { collectableItems, craftableItems, factoryBuildings, collectorBuildings };
}
