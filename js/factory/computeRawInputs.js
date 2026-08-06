import { computeLineRates } from './lineRates.js';

// Raw ("assumed") input rates for Factory View's bottom bar - what still
// has to come from outside the compiled plan, in items/sec at the current
// target rate.
//
// Built directly from the compiled `lines` (post computeMachineCounts, so
// craftsPerSec already reflects buildFactoryPlan.js's double-crafting fix
// and any reuse-toggle splitting) rather than re-walking the raw tree. The
// tree's own per-node qty and byproduct figures are exactly the
// *un*-deduplicated numbers that fix exists to correct - re-deriving
// raw-input totals from them would silently reintroduce the same
// double-counting bug at the ingredient level (see memory:
// factory-view-plan).
//
// Every line's entire output counts as supply unconditionally - the
// reuse/waste decision already happened one level up, on the tree (see
// treeView.js's byproductReuse), and is fully baked into which lines
// exist and how big their crafts figures are by the time this runs. A
// line that got split off for running independently (because its tree
// node opted out of sharing) still legitimately *produces* its incidental
// other results - if those aren't needed anywhere, that's exactly what
// `extra` below is for, no separate accounting needed.
//
// An item counts as `needed` (has to come from outside the plan) whenever
// total demand for it - summed across every line's own ingredients -
// outstrips whatever's supplied by lines that produce it. An item no line
// in this plan produces at all is exactly this with zero supply - true
// raw resources, but also anything the tree left collapsed or unresolved,
// since neither has a line either. Whatever's left over once demand is
// covered counts as `extra` instead.
//
// rootItemId (the tree's own subject) is deliberately never counted as
// supply - it's the plan's actual goal output, not surplus, even though
// nothing else in the plan demands it as an ingredient.
export function computeRawInputs(lines, registries, rootItemId) {
  const totals = new Map(); // itemId -> { itemId, demand, supply }

  function entry(itemId) {
    if (!totals.has(itemId)) totals.set(itemId, { itemId, demand: 0, supply: 0 });
    return totals.get(itemId);
  }

  for (const line of lines) {
    const { demand, output } = computeLineRates(line);

    for (const { itemId, ratePerSec } of demand) {
      entry(itemId).demand += ratePerSec;
    }

    for (const { itemId, ratePerSec } of output) {
      if (itemId === rootItemId) continue;
      entry(itemId).supply += ratePerSec;
    }
  }

  // Same "close enough to zero counts as fully netted" tolerance as
  // summarizeTree.js - floating-point scale chains rarely land exactly.
  const EPSILON = 1e-6;
  const needed = [];
  const extra = [];

  for (const item of totals.values()) {
    const object = registries.objects.get(item.itemId);

    const net = item.demand - item.supply;
    if (net > EPSILON) needed.push({ itemId: item.itemId, object, ratePerSec: net });
    else if (-net > EPSILON) extra.push({ itemId: item.itemId, object, ratePerSec: -net });
  }

  needed.sort((a, b) => b.ratePerSec - a.ratePerSec);
  extra.sort((a, b) => b.ratePerSec - a.ratePerSec);

  return { needed, extra };
}
