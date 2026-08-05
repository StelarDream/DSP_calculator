// Which buildings can run a line's recipe, and picking a speed multiplier
// out of that list - the machine-count math needs a concrete building, not
// just "some assembler or other," since different tiers craft at different
// speeds (see data/factories.json, e.g. Assembling Machine MK.I vs MK.III).
export function getBuildingOptions(recipe, registries) {
  return registries.factories.byRecipeType.get(recipe.type) ?? [];
}

// The chosen (or default - first option) building id for a line, given the
// session's { lineKey -> buildingId } picks. Falls back to whatever the
// user last picked only if it's still a valid option for this recipe type -
// a stale pick (e.g. from before a proliferation edit moved this line to a
// different recipe entirely - can't happen today since key includes
// recipe.id, but harmless to guard anyway) silently falls back to the
// default rather than pointing at nothing.
export function getSelectedBuilding(options, buildingChoice, lineKey) {
  const picked = buildingChoice.get(lineKey);
  if (picked && options.some((opt) => opt.building === picked)) return picked;
  return options[0]?.building ?? null;
}

// The speed multiplier of a specific building option - 1 (no effect) if it
// doesn't match any option, e.g. no options at all for this recipe type.
export function getBuildingSpeed(options, buildingId) {
  const option = options.find((opt) => opt.building === buildingId);
  if (!option) return 1;
  return (option.speed.min + option.speed.max) / 2;
}
