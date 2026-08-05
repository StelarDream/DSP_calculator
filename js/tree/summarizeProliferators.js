import { PROLIFERATOR_LEVELS } from './proliferatorLevels.js';

// How many of each proliferator level the tree's active proliferation
// settings will actually consume. A proliferator point is spent per *item*
// that passes under the spray coater, not per craft cycle - so a node's
// cost is its own produced quantity (node.qty), not how many times its
// recipe crafts. `amount` (see proliferatorLevels.js) is how many points one
// item of that level carries.
//
// Same "leaf-like" walk as summarizeTree.js: a node only has something to
// spray once it's actually resolved to a recipe (not a leaf, not collapsed,
// not still mid-choice). Also mirrors treeNode.js's activeProlif guard - a
// setting whose mode the *current* recipe no longer supports (left behind
// by a recipe edit) doesn't silently count.
export function summarizeProliferatorUsage(root, proliferation) {
  const totals = new Map(); // level id -> total qty sprayed

  function walk(node) {
    const leafLike = node.isLeaf || node.isCollapsed || node.needsChoice;
    if (leafLike) return;

    const setting = proliferation.get(node.path);
    if (setting?.mode && setting?.level && node.recipe.proliferation[setting.mode]) {
      totals.set(setting.level, (totals.get(setting.level) ?? 0) + node.qty);
    }

    for (const child of node.children) walk(child);
  }

  walk(root);

  return PROLIFERATOR_LEVELS
    .map((level) => {
      const qty = totals.get(level.id) ?? 0;
      if (qty === 0) return null;
      const exact = qty / level.amount;
      return { level, sprayed: qty, exact, rounded: Math.ceil(exact) };
    })
    .filter(Boolean);
}
