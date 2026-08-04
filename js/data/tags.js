// Adds the dynamic tags onto each object's tag set, derived from the other
// loaded registries. Data-driven tags ('item'/'building') are already set
// by loadObjects() by the time this runs.
export function applyDynamicTags(objects, registries) {
  for (const collectable of registries.collectables.collectables) {
    objects.get(collectable.result)?.tags.add('collectable');
  }

  for (const itemId of registries.recipes.byResultItem.keys()) {
    objects.get(itemId)?.tags.add('craftable');
  }

  for (const entries of registries.factories.byRecipeType.values()) {
    for (const entry of entries) {
      objects.get(entry.building)?.tags.add('factory');
    }
  }

  for (const entries of registries.collectors.byCollectionType.values()) {
    for (const entry of entries) {
      objects.get(entry.collector)?.tags.add('collector');
    }
  }
}
