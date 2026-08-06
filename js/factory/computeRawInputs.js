import { computeLineRates } from './lineRates.js';

// Raw ("assumed") input rates for Factory View's bottom bar - what still
// has to come from outside the compiled plan - plus `leftover`: everything
// produced that nothing inside the plan asked for.
//
// Deliberately naive about byproducts, matching buildFactoryPlan.js's own
// naive crafts math: any result a line's crafts were actually sized for
// (line.targetedItems - the item(s) some contributing tree node asked for,
// NOT just the recipe's first result key) nets against demand for that
// item elsewhere, same as any normal intermediate product in the chain.
// Every *other* result (an incidental byproduct nothing asked for) never
// nets against anything - it's unconditionally added to `leftover` in
// full, even if some other line happens to want that exact item too.
// That's the point: a byproduct never gets credited toward satisfying a
// *different* node's need, only its own line's targeted demand can be
// satisfied by its own line's targeted production.
//
// Built from the compiled `lines` (post computeMachineCounts) rather than
// the raw tree, so it lines up with each card's own numbers - see memory:
// factory-view-plan.
//
// rootItemId (the tree's own subject) still nets normally against demand
// for it elsewhere in the plan - see the leftover-only exclusion below for
// why that's *not* the same as counting it as supply outright.
export function computeRawInputs(lines, registries, rootItemId) {
  const demandTotals = new Map(); // itemId -> demand
  const primarySupplyTotals = new Map(); // itemId -> supply from primary production only
  const leftoverTotals = new Map(); // itemId -> unconditional byproduct output

  function addTo(map, itemId, amount) {
    map.set(itemId, (map.get(itemId) ?? 0) + amount);
  }

  for (const line of lines) {
    const { demand, output } = computeLineRates(line);

    for (const { itemId, ratePerSec } of demand) {
      addTo(demandTotals, itemId, ratePerSec);
    }

    for (const { itemId, ratePerSec } of output) {
      if (line.targetedItems.has(itemId)) {
        addTo(primarySupplyTotals, itemId, ratePerSec);
      } else if (itemId !== rootItemId) {
        addTo(leftoverTotals, itemId, ratePerSec);
      }
    }
  }

  // Same "close enough to zero counts as fully netted" tolerance as
  // summarizeTree.js - floating-point scale chains rarely land exactly.
  const EPSILON = 1e-6;
  const itemIds = new Set([...demandTotals.keys(), ...primarySupplyTotals.keys(), ...leftoverTotals.keys()]);

  const needed = [];
  const leftover = [];

  for (const itemId of itemIds) {
    const object = registries.objects.get(itemId);
    const demand = demandTotals.get(itemId) ?? 0;
    const primarySupply = primarySupplyTotals.get(itemId) ?? 0;

    // Nets normally even for rootItemId now - a recycling cycle feeding
    // some of the root's own output back into itself (see buildTree.js's
    // qtyBoost/cycleRecycle.js) shows up here as ordinary self-demand
    // against the root's own (now larger) output, same as any other
    // ingredient. Confirmed real: before this fix, a fully-recycled
    // self-loop still showed its full ingredient rate in Raw Inputs
    // because the root's supply was never credited at all to net against.
    const neededRate = demand - primarySupply;
    if (neededRate > EPSILON) needed.push({ itemId, object, ratePerSec: neededRate });

    // Excess primary production (made more than anything currently wants)
    // plus every bit of this item's byproduct output, unconditionally -
    // except for rootItemId's own surplus, which is the plan's intended
    // goal output (already shown as "Output" on its own card), not
    // unclaimed leftover. Only suppressed here, never on the demand side
    // above, so self-consumption still nets while genuine surplus still
    // doesn't get mislabeled as leftover.
    const primarySurplus = Math.max(0, primarySupply - demand);
    const leftoverRate = (itemId === rootItemId ? 0 : primarySurplus) + (leftoverTotals.get(itemId) ?? 0);
    if (leftoverRate > EPSILON) leftover.push({ itemId, object, ratePerSec: leftoverRate });
  }

  needed.sort((a, b) => b.ratePerSec - a.ratePerSec);
  leftover.sort((a, b) => b.ratePerSec - a.ratePerSec);

  return { needed, leftover };
}
