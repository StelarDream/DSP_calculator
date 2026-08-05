// Which buildings can run a line's recipe, and picking a speed multiplier
// out of that list - the machine-count math needs a concrete building, not
// just "some assembler or other," since different tiers craft at different
// speeds (see data/factories.json, e.g. Assembling Machine MK.I vs MK.III).
export function getBuildingOptions(recipe, registries) {
  return registries.factories.byRecipeType.get(recipe.type) ?? [];
}

// The chosen building id for a line, in priority order:
//   1. an explicit per-card pick (buildingChoice, keyed by line)
//   2. the sidebar's per-recipe-type default (defaultBuildingId, see
//      defaultBuildingPanel.js) - "like proliferation," a tree/session-wide
//      fallback that applies unless a specific line overrides it
//   3. plain options[0], if neither of the above is set (or valid)
// Each tier is only used if it actually names a still-valid option for
// this recipe type - a stale pick (e.g. left over from before a
// proliferation edit moved this line to a different recipe entirely -
// can't happen today since key includes recipe.id, but harmless to guard
// anyway) silently falls through to the next tier rather than pointing at
// nothing.
export function getSelectedBuilding(options, buildingChoice, lineKey, defaultBuildingId) {
  const picked = buildingChoice.get(lineKey);
  if (picked && options.some((opt) => opt.building === picked)) return picked;
  if (defaultBuildingId && options.some((opt) => opt.building === defaultBuildingId)) return defaultBuildingId;
  return options[0]?.building ?? null;
}

// The speed multiplier of a specific building option - 1 (no effect) if it
// doesn't match any option, e.g. no options at all for this recipe type.
export function getBuildingSpeed(options, buildingId) {
  const option = options.find((opt) => opt.building === buildingId);
  if (!option) return 1;
  return (option.speed.min + option.speed.max) / 2;
}

// Whether the line's current building is one the user actually picked,
// rather than the auto-selected default (getSelectedBuilding's own
// options[0] fallback) - same validity check that function uses, so a
// stale pick reads as "not explicit" too, not just a plain missing entry.
// Drives the card's "Default" badge (see factoryCard.js).
export function isExplicitBuildingChoice(options, buildingChoice, lineKey) {
  const picked = buildingChoice.get(lineKey);
  return Boolean(picked) && options.some((opt) => opt.building === picked);
}
