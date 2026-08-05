import { PROLIFERATOR_LEVELS } from '../tree/proliferatorLevels.js';

// Pure (recipe, mode, level) -> multiplier lookups, for the machine-count
// math in buildFactoryPlan.js/computeMachineCounts.js. Distinct from
// buildTree.js's own applyYield, which is keyed by tree path instead of a
// bare mode/level pair - factory lines already carry mode/level directly
// (it's their merge key), so there's no path to look anything up by here.
//
// Both guard against a stale setting the current recipe doesn't actually
// support (e.g. left over from a since-changed recipe choice), the same
// way applyYield does - 1 (no effect) rather than a bogus multiplier.
export function getYieldMultiplier(recipe, mode, level) {
  if (mode !== 'yield' || !level || !recipe.proliferation.yield) return 1;
  return PROLIFERATOR_LEVELS.find((l) => l.id === level)?.yield ?? 1;
}

export function getSpeedMultiplier(recipe, mode, level) {
  if (mode !== 'speed' || !level || !recipe.proliferation.speed) return 1;
  return PROLIFERATOR_LEVELS.find((l) => l.id === level)?.speed ?? 1;
}
