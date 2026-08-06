// Walks a built tree, bucketing every resolved node by (recipe,
// proliferation) - exact same grouping buildFactoryPlan.js's cards are
// built from, and what Tree View's byproduct-reuse toggle candidacy (see
// byproductReuseCandidates.js) is detected from. Both live off this one
// walk so they can never disagree about which nodes are "in the same
// bucket."
//
// A node is bucketed whenever it's actually running a recipe (resolved,
// expanded, not a cycle guard) - collapsed/leaf/needsChoice nodes
// contribute nothing here, mirroring summarizeTree.js's notion of
// "leaf-like".
//
// Buckets are keyed by exact (recipe, mode, level) - two nodes sharing a
// recipe only fold into the same bucket if their proliferation matches
// exactly. Different level (or one proliferated, one not) keeps them
// separate, since Speed Up/Extra Yield change the effective machine
// throughput and so can't share one machine-count calculation. "No
// proliferation" and an explicit opt-out ({ mode: null, level: null },
// see treeView.js's onClearProliferation) are treated as the same "no
// effect" bucket - there's no throughput difference between them.
export function groupNodesByRecipe(root, proliferation) {
  const buckets = new Map(); // key -> { recipe, mode, level, nodesByItem: Map<itemId, node[]> }

  function walk(node) {
    const runsRecipe = node.recipe && !node.isCollapsed && !node.needsChoice && !node.isCycle && !node.isLeaf;

    if (runsRecipe) {
      const { mode, level } = proliferation.get(node.path) ?? {};
      const key = bucketKey(node.recipe.id, mode, level);

      if (!buckets.has(key)) {
        buckets.set(key, { key, recipe: node.recipe, mode: mode ?? null, level: level ?? null, nodesByItem: new Map() });
      }

      const bucket = buckets.get(key);
      if (!bucket.nodesByItem.has(node.itemId)) bucket.nodesByItem.set(node.itemId, []);
      bucket.nodesByItem.get(node.itemId).push(node);
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
  return buckets;
}

// mode/level default to null so "never set" and "explicitly cleared" land
// on the same key - see the module comment above.
export function bucketKey(recipeId, mode, level) {
  return `${recipeId}::${mode ?? 'none'}::${level ?? 'none'}`;
}
