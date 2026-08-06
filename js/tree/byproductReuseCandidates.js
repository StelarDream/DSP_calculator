import { groupNodesByRecipe } from '../factory/groupNodesByRecipe.js';

// Which tree nodes get the "reuse this byproduct" toggle (see treeNode.js)
// - any resolved node whose own targeted item is also produced as a
// byproduct by some *other* node running the exact same recipe under the
// exact same proliferation elsewhere in the tree (or vice versa - if node
// A's item can be covered by node B's byproduct, B's own item is equally
// coverable by A's byproduct, so both get the toggle).
//
// Concretely: every node contributing to a groupNodesByRecipe bucket that
// has more than one distinct targeted item is a candidate - that's
// precisely when buildFactoryPlan.js would otherwise have to choose
// between sharing one batch of crafts or running two independent ones,
// which is the whole reason this toggle exists.
export function detectByproductReuseCandidates(root, proliferation) {
  const buckets = groupNodesByRecipe(root, proliferation);
  const candidates = new Set();

  for (const bucket of buckets.values()) {
    if (bucket.nodesByItem.size <= 1) continue;
    for (const nodes of bucket.nodesByItem.values()) {
      for (const node of nodes) candidates.add(node.path);
    }
  }

  return candidates;
}
