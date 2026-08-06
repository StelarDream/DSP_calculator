// How much extra qty each ancestor needs to produce, given every cycle
// node's current recycledQty (see buildTree.js's recycleOverrides/
// ancestorPath) - one entry per ancestor path that's actually being fed
// back into, summed across every cycle descendant recycling from it (a
// single ancestor can have more than one cycle loop back onto it).
export function computeCycleBoosts(root) {
  const boosts = new Map(); // ancestorPath -> extra qty

  (function walk(node) {
    if (node.isCycle && node.recycledQty && node.ancestorPath) {
      boosts.set(node.ancestorPath, (boosts.get(node.ancestorPath) ?? 0) + node.recycledQty);
    }
    for (const child of node.children) walk(child);
  })(root);

  return boosts;
}

// Close enough to call converged - scale-chain floats rarely land on an
// exact match, same reasoning as summarizeTree.js's own EPSILON. Absolute,
// not relative: these are already small per-craft-ratio numbers (the same
// scale as everything else in the tree), not something that grows into a
// range where a fixed epsilon stops being meaningful.
const EPSILON = 1e-6;

function cycleBoostsClose(a, b) {
  if (a.size !== b.size) return false;
  for (const [path, qty] of a) {
    const other = b.get(path);
    if (other === undefined || Math.abs(other - qty) > EPSILON) return false;
  }
  return true;
}

// Rebuilds `tree` with growing qtyBoosts until they stop changing - a
// cycle node's recycledQty only tells its ancestor how much *more* to
// produce (see buildTree.js), which that ancestor's own qty doesn't
// reflect yet by the time the cycle node computing it is reached
// mid-recursion. So: read off how much growth is needed from the tree
// just built, and if that's different from what it was actually built
// with, build again with the corrected amount.
//
// Genuinely iterative, not just a one-time correction: recycling into a
// node grows that node's own output, which grows *this exact ingredient
// slot's* demand again (feeding the same loop), most visibly with "Max"
// (see cyclePicker.js) - a fixed amount the user typed converges in one
// extra pass same as before, but "recycle everything possible" is a
// moving target: each pass grows a little more, geometric-series style.
// That only converges if the *combined* loop consumes less of an item per
// craft than it produces - real, confirmed in-game (and algebraically:
// two loops each recycling part of the same item can each look sane in
// isolation - 2/3 and 1/3 - while summing to exactly 100% self-consumption
// together, which is a genuine impossibility, not just "expensive": no
// finite production rate ever nets positive, since every unit made is
// immediately eaten by the loop itself. That case never converges no
// matter how many passes it gets - see the diverging-path handling below.
//
// 30 was too tight a cap, confirmed by a real false positive: a plain 2/3
// self-consumption ratio (Refined Oil's own Reforming Refine recipe -
// probably the single most common loop shape in the game) needs 35 passes
// to get its delta under EPSILON, not 30. Bumped to 300 - cheap (each pass
// is one tree rebuild, no DOM), and clears EPSILON for any ratio up to
// ~0.95, generous headroom over any two-or-three-hop chain of ordinary
// recipe ratios ever likely to occur. A genuinely unsustainable loop
// (ratio >= 1, see above) still never converges no matter the cap - this
// only changes how long a *real* one gets before being (wrongly) given up
// on.
const MAX_ITERATIONS = 300;

// Which of the *finished* tree's cycle/ancestor nodes were responsible for
// a path that never settled (see resolveCycleBoosts) - stamps
// recycleDiverged on the cycle node(s) actually recycling into it and
// boostDiverged on the ancestor itself, so treeNode.js can flag both ends
// of the unsustainable loop rather than just silently zeroing a number
// with no explanation.
//
// Also clears the cycle node's own recycledQty, not just the ancestor's
// boost - the tree was already rebuilt with that boost dropped (see
// resolveCycleBoosts), but a cycle node's recycledQty comes from its own
// stored override (still "recycle everything," see cyclePicker.js's Max),
// which buildTree.js happily re-clamps to whatever this node's now-
// *smaller*, un-boosted demand is - still a positive number, still
// "recycling," just quietly inconsistent with the ancestor no longer
// having produced the extra to cover it. Left uncleared, summarizeTree.js
// would keep subtracting it from raw demand for supply that was never
// actually made - not just a visual overlap (a cycle node showing both
// the green "recycling" badge and the red "diverged" one), a real
// under-count.
function markDivergingCycles(root, divergingPaths) {
  if (divergingPaths.size === 0) return;
  (function walk(node) {
    if (node.isCycle && node.ancestorPath && divergingPaths.has(node.ancestorPath)) {
      node.recycleDiverged = true;
      node.recycledQty = undefined;
    }
    if (divergingPaths.has(node.path)) {
      node.boostDiverged = true;
    }
    for (const child of node.children) walk(child);
  })(root);
}

export function resolveCycleBoosts(buildWithBoosts, initialTree, initialBoosts) {
  let tree = initialTree;
  let boosts = initialBoosts;
  let prevBoosts = initialBoosts;
  let converged = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const nextBoosts = computeCycleBoosts(tree);
    if (cycleBoostsClose(nextBoosts, boosts)) {
      boosts = nextBoosts;
      converged = true;
      break;
    }
    prevBoosts = boosts;
    boosts = nextBoosts;
    tree = buildWithBoosts(boosts);
  }

  if (converged) return { tree, boosts, divergingPaths: new Set() };

  // Hit the iteration cap without settling. Per path, not the whole map -
  // an unrelated cycle elsewhere in the same tree that happened to
  // converge slowly but genuinely shouldn't get dragged down just because
  // *something* in this tree is unsustainable. Only a path still moving by
  // more than EPSILON between the last two passes counts as diverging;
  // anything that had already settled keeps its real value.
  const divergingPaths = new Set();
  const stableBoosts = new Map();
  for (const [path, qty] of boosts) {
    const prevQty = prevBoosts.get(path) ?? 0;
    if (Math.abs(qty - prevQty) > EPSILON) {
      divergingPaths.add(path);
    } else {
      stableBoosts.set(path, qty);
    }
  }

  // An unsustainable loop reverts to its raw, un-recycled demand rather
  // than displaying an arbitrary partial number that never actually
  // settled - "capped at whatever the 30th pass happened to reach" isn't
  // an answer, it's noise.
  tree = buildWithBoosts(stableBoosts);
  markDivergingCycles(tree, divergingPaths);
  return { tree, boosts: stableBoosts, divergingPaths };
}
