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
// moving target each pass grows a little more, geometric-series style
// (converges as long as the loop consumes less of itself per craft than
// it produces - the only case a real recipe would ever present). Capped
// rather than looped forever on the off chance a recipe doesn't have that
// property - better a very large finite number after 30 passes than a
// frozen tab.
const MAX_ITERATIONS = 30;

export function resolveCycleBoosts(buildWithBoosts, initialTree, initialBoosts) {
  let tree = initialTree;
  let boosts = initialBoosts;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const nextBoosts = computeCycleBoosts(tree);
    if (cycleBoostsClose(nextBoosts, boosts)) break;
    boosts = nextBoosts;
    tree = buildWithBoosts(boosts);
  }
  return { tree, boosts };
}
