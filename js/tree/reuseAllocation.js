// Auto-detects byproduct reuse candidates in a tree and turns them into
// per-node deltas that buildTree.js's second pass consumes (see
// treeView.js's two-pass rerender - this whole module only ever looks at a
// *natural*, reuse-free tree, never the one it's helping to produce).
//
// The feature this exists for: a byproduct produced somewhere in the tree
// (e.g. surplus Hydrogen from refining) often happens to match an ingredient
// demanded somewhere else in the very same tree. Auto-surfacing that as an
// opt-out (not opt-in) link is the whole point - see buildTree.js's header
// comment and the memory this design settled on, after two earlier attempts
// at *automatic* netting (no per-instance visibility or control) got
// reverted for being confusing.

const EPSILON = 1e-6;

// Pool: every byproduct occurrence in the tree, grouped by itemId, in tree
// order. Demand: every ingredient-position occurrence, grouped by itemId,
// also in tree order - "demand" here just means "somebody's ingredient
// slot," regardless of whether that node itself ends up a leaf, collapsed,
// or expanded (buildTree.js's insertion point for the resulting delta
// doesn't care which either).
export function collectReuseCandidates(root) {
  const pools = new Map(); // itemId -> [{ path, qty }]
  const demands = new Map(); // itemId -> [{ path, qty }]
  // What item *this* path itself demands, and what item(s) it produces as
  // byproducts once resolved - see isReciprocal below. A node can be both
  // at once (it's a demand from its parent's point of view, and - if it's
  // expanded with a recipe of its own - a producer from its own point of
  // view), which is exactly what makes the reciprocal case possible.
  const demandItemAt = new Map(); // path -> itemId
  const producedItemsAt = new Map(); // path -> Set<itemId>

  function addPool(itemId, path, qty) {
    if (!pools.has(itemId)) pools.set(itemId, []);
    pools.get(itemId).push({ path, qty });
    if (!producedItemsAt.has(path)) producedItemsAt.set(path, new Set());
    producedItemsAt.get(path).add(itemId);
  }
  function addDemand(itemId, path, qty) {
    if (!demands.has(itemId)) demands.set(itemId, []);
    demands.get(itemId).push({ path, qty });
    demandItemAt.set(path, itemId);
  }

  (function walk(node) {
    for (const byproduct of node.byproducts) {
      addPool(byproduct.itemId, node.path, byproduct.qty);
    }
    for (const child of node.children) {
      // Choice pseudo-nodes (see buildTree.js's buildChoiceNode) aren't
      // real ingredient demand - they don't even have a real qty.
      if (!child.isChoice) addDemand(child.itemId, child.path, child.qty);
      walk(child);
    }
  })(root);

  return { pools, demands, demandItemAt, producedItemsAt };
}

// True when `a` is an ancestor of (or the same node as) `b`, or vice versa -
// paths are `>`-joined chains (see buildTree.js), so this is a cheap prefix
// check rather than needing the actual tree. Excludes a byproduct from
// covering its own upstream demand, which would be a paradox (the craft
// that makes the byproduct would itself shrink because of it).
function related(a, b) {
  if (a === b) return true;
  return a.startsWith(`${b}>`) || b.startsWith(`${a}>`);
}

// Catches the sibling version of that same paradox, which path-prefix
// checking above can't see: two *different* branches whose recipes are
// mirror images of each other (e.g. Critical Photon -> Hydrogen + Antimatter
// byproduct, right next to Critical Photon -> Antimatter + Hydrogen
// byproduct). Naively, each looks like it can fully cover the other's
// demand - but reducing one to 0 means its craft never runs, so its
// "byproduct" never actually exists to cover the other, which was the only
// thing justifying reducing the first one. A source is reciprocal to a
// demand when the *source's own* node is itself a demand for some item Y,
// and the *demand's own* node produces Y as one of its byproducts - i.e.
// each side already leans on the other before either craft has run at all.
function isReciprocal(sourcePath, demandPath, demandItemAt, producedItemsAt) {
  const sourceOwnDemand = demandItemAt.get(sourcePath);
  if (!sourceOwnDemand) return false;
  return producedItemsAt.get(demandPath)?.has(sourceOwnDemand) ?? false;
}

// Turns pools/demands into per-demand-path deltas, honoring manual
// overrides and clamping to whatever's actually left in the pool once every
// earlier demand (in tree order) has drawn from it. `reuseOverrides`:
// Map<demandPath, {on, qty}> - `on` is the explicit toggle, `qty` an
// explicit amount (null/absent falls back to the greedy default: as much of
// the remaining pool as this demand can use).
//
// Returns:
//  - demandDeltas: Map<demandPath, {qty, available, on, warning}> - `qty` is
//    always the amount that *would* apply (clamped to what's on offer),
//    whether or not `on` is true - the marker needs that to render a
//    sensible default even while switched off. `warning` is set only when an
//    explicit override asked for more than the pool can currently cover.
//  - sourceConsumed: Map<sourcePath, Map<itemId, qty>> - only ever reflects
//    links that are actually `on`; the annotation buildTree.js hangs off
//    node.byproducts.
export function allocateReuse(root, reuseOverrides = new Map()) {
  const { pools, demands, demandItemAt, producedItemsAt } = collectReuseCandidates(root);
  const demandDeltas = new Map();
  const sourceConsumed = new Map();

  for (const [itemId, itemDemands] of demands) {
    const itemPools = pools.get(itemId);
    if (!itemPools || itemPools.length === 0) continue;

    // Running remaining amount per pool entry - a later demand only ever
    // sees what earlier ones (in tree order) left behind, so allocation is
    // deterministic regardless of how many times this reruns.
    const remaining = itemPools.map((p) => ({ ...p, left: p.qty }));

    for (const demand of itemDemands) {
      const eligible = remaining.filter((p) => !related(p.path, demand.path)
        && !isReciprocal(p.path, demand.path, demandItemAt, producedItemsAt));
      const availableTotal = eligible.reduce((sum, p) => sum + p.left, 0);
      if (availableTotal <= EPSILON) continue;

      const override = reuseOverrides.get(demand.path);
      const on = override ? override.on : true;
      const requested = override?.qty ?? Math.min(demand.qty, availableTotal);
      const applied = Math.max(0, Math.min(requested, availableTotal, demand.qty));
      const warning = override?.qty != null && override.qty - applied > EPSILON;

      if (applied <= EPSILON) {
        if (override) demandDeltas.set(demand.path, { qty: 0, available: availableTotal, on, warning });
        continue;
      }

      demandDeltas.set(demand.path, { qty: applied, available: availableTotal, on, warning });

      if (!on) continue; // recorded for the marker's UI, but doesn't draw from the pool

      let toSpend = applied;
      for (const p of eligible) {
        if (toSpend <= EPSILON) break;
        const take = Math.min(p.left, toSpend);
        if (take <= EPSILON) continue;
        p.left -= take;
        toSpend -= take;
        if (!sourceConsumed.has(p.path)) sourceConsumed.set(p.path, new Map());
        const bySource = sourceConsumed.get(p.path);
        bySource.set(itemId, (bySource.get(itemId) ?? 0) + take);
      }
    }
  }

  return { demandDeltas, sourceConsumed };
}
