import { computeLineRates } from './lineRates.js';
import { isItemReused } from './byproductReuse.js';
import { linePrimaryItemId } from './buildFactoryPlan.js';

// Raw ("assumed") input rates for Factory View's bottom bar - what still
// has to come from outside the compiled plan, in items/sec at the current
// target rate.
//
// Built directly from the compiled `lines` (post computeMachineCounts, so
// craftsPerSec already reflects buildFactoryPlan.js's double-crafting fix)
// rather than re-walking the raw tree. The tree's own per-node qty and
// byproduct figures are exactly the *un*-deduplicated numbers that fix
// exists to correct - e.g. a symmetric recipe whose two separately-demanded
// results (Hydrogen and Antimatter) merge into one Factory View line still
// has two tree nodes independently reporting their own Critical Photon
// demand, so re-deriving raw-input totals from the tree would silently
// reintroduce the same double-counting bug at the ingredient level, even
// though the card above it already shows the corrected, deduplicated
// craft/machine count (see memory: factory-view-plan).
//
// An item counts as `needed` (has to come from outside the plan) whenever
// total demand for it - summed across every line's own ingredients -
// outstrips whatever's reused-supplied by lines that produce it. An item
// no line in this plan produces at all is exactly this with zero supply -
// true raw resources, but also anything the tree left collapsed or
// unresolved, since neither has a line either. Whatever's left over once
// demand is covered (or produced but explicitly toggled to waste, see
// byproductReuse) counts as `extra` instead.
//
// rootItemId (the tree's own subject) is deliberately never counted as
// supply - it's the plan's actual goal output, not surplus, even though
// nothing else in the plan demands it as an ingredient.
export function computeRawInputs(lines, registries, byproductReuse, rootItemId) {
  const totals = new Map(); // itemId -> { itemId, demand, reusedSupply, wastedSupply }

  function entry(itemId) {
    if (!totals.has(itemId)) totals.set(itemId, { itemId, demand: 0, reusedSupply: 0, wastedSupply: 0 });
    return totals.get(itemId);
  }

  for (const line of lines) {
    const { demand, output } = computeLineRates(line);

    for (const { itemId, ratePerSec } of demand) {
      entry(itemId).demand += ratePerSec;
    }

    const primaryItemId = linePrimaryItemId(line);
    for (const { itemId, ratePerSec } of output) {
      if (itemId === rootItemId) continue;
      const item = entry(itemId);
      if (isItemReused(byproductReuse, line.key, itemId, primaryItemId)) {
        item.reusedSupply += ratePerSec;
      } else {
        item.wastedSupply += ratePerSec;
      }
    }
  }

  // Same "close enough to zero counts as fully netted" tolerance as
  // summarizeTree.js - floating-point scale chains rarely land exactly.
  const EPSILON = 1e-6;
  const needed = [];
  const extra = [];

  for (const item of totals.values()) {
    const object = registries.objects.get(item.itemId);

    const neededRate = item.demand - item.reusedSupply;
    if (neededRate > EPSILON) needed.push({ itemId: item.itemId, object, ratePerSec: neededRate });

    // Reused supply only becomes "extra" once it's covered every bit of
    // demand it could - a wasted byproduct never offsets anything, so all
    // of it counts.
    const reusedSurplus = Math.max(0, item.reusedSupply - item.demand);
    const extraRate = reusedSurplus + item.wastedSupply;
    if (extraRate > EPSILON) extra.push({ itemId: item.itemId, object, ratePerSec: extraRate });
  }

  needed.sort((a, b) => b.ratePerSec - a.ratePerSec);
  extra.sort((a, b) => b.ratePerSec - a.ratePerSec);

  return { needed, extra };
}
