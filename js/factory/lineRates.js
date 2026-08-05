import { getYieldMultiplier } from './proliferatorMultiplier.js';

// Per-second demand (ingredients consumed) and output (results produced)
// for a single factory line - both scale directly off line.craftsPerSec,
// since buildFactoryPlan already folded Extra Yield's craft-count
// reduction into that figure (fewer crafts happen, but ingredient use per
// craft is unchanged, so ingredient rate is just qty * craftsPerSec).
// Output additionally scales by the yield multiplier - each craft that
// does happen yields more.
//
// Requires computeMachineCounts to have already run (needs
// line.craftsPerSec) - a plain buildFactoryPlan line has crafts (the
// ratio) but no rate yet.
export function computeLineRates(line) {
  const yieldMultiplier = getYieldMultiplier(line.recipe, line.mode, line.level);

  const demand = Object.entries(line.recipe.ingredients).map(([itemId, qty]) => ({
    itemId,
    ratePerSec: qty * line.craftsPerSec,
  }));

  const output = Object.entries(line.recipe.result).map(([itemId, qty]) => ({
    itemId,
    ratePerSec: qty * yieldMultiplier * line.craftsPerSec,
  }));

  return { demand, output };
}
