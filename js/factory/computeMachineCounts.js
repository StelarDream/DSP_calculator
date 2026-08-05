import { getSpeedMultiplier } from './proliferatorMultiplier.js';

// Turns buildFactoryPlan's per-root-unit crafts ratio into an actual
// machine count, given a target output rate (items/sec of the tree's root
// item). This is the one place a real time dimension enters Factory View -
// the tree itself stays the timeless/pure-ratio mode (see memory:
// factory-view-plan).
//
// machines = craftsPerSec / craftsPerSecPerMachine, where:
//   craftsPerSec           = line.crafts (per 1 root unit) * targetRate
//   craftsPerSecPerMachine = buildingSpeed * proliferatorSpeed / recipe.time
// Neither Speed Up nor the building's own base speed change how many
// crafts are needed (that's Extra Yield's job, already folded into
// line.crafts by buildFactoryPlan) - they change how fast each machine
// gets through them, so fewer machines cover the same craft rate.
//
// buildingSpeed must already be attached to each line (see
// buildingOptions.js's getBuildingSpeed) - this module doesn't know about
// registries/building choices itself, just the numbers.
//
// A recipe with no craft time (shouldn't normally happen for a resolved
// recipe node, but guards against bad data) reports Infinity rather than
// dividing by zero - "can't compute this" is more honest than a false 0.
export function computeMachineCounts(lines, targetRate) {
  return lines.map((line) => {
    const craftsPerSec = line.crafts * targetRate;
    const speedMultiplier = getSpeedMultiplier(line.recipe, line.mode, line.level);
    const machineSpeed = (line.buildingSpeed ?? 1) * speedMultiplier;
    const craftsPerSecPerMachine = line.recipe.time > 0 ? machineSpeed / line.recipe.time : 0;
    const machines = craftsPerSecPerMachine > 0 ? craftsPerSec / craftsPerSecPerMachine : Infinity;
    return { ...line, craftsPerSec, machines };
  });
}
