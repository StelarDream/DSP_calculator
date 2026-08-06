// Captures just what's needed to reconstruct the current tree view: which
// item/recipe it's rooted on, plus every manual decision made since (recipe
// choices, expand/collapse overrides, and proliferation - see buildTree.js
// and treeView.js). Nodes still at their defaults never need an entry, so
// a typical tree serializes to something reasonably short despite the full
// state being captured.
//
// Plain base64(JSON) rather than anything fancier - easy to implement and
// to debug, and "reasonably short" is enough for a v1 share link. Worth
// swapping for a tighter encoding later if links turn out to be unwieldy
// for deep trees.
export function serializeTreeState({ subjectId, recipeId, choices, overrides, proliferation, reuse }) {
  const payload = {
    root: subjectId,
    recipe: recipeId,
    choices: Array.from(choices.entries()),
    overrides: Array.from(overrides.entries()),
    proliferation: Array.from((proliferation ?? new Map()).entries()),
    reuse: Array.from((reuse ?? new Map()).entries()),
  };
  // encodeURIComponent first since btoa only handles Latin1 - item ids are
  // ASCII today, but this keeps it from breaking silently if that changes.
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

// Returns null on anything malformed (hand-edited URL, truncated paste,
// stale format) rather than throwing - callers just ignore an invalid code
// and fall back to a normal, unrestored view.
export function deserializeTreeState(code) {
  try {
    const payload = JSON.parse(decodeURIComponent(atob(code)));
    if (typeof payload.root !== 'string' || typeof payload.recipe !== 'number') return null;
    return {
      subjectId: payload.root,
      recipeId: payload.recipe,
      choices: new Map(payload.choices),
      overrides: new Map(payload.overrides),
      // Absent on links created before proliferation/reuse existed -
      // defaults to empty rather than failing to restore the rest of an
      // older link.
      proliferation: new Map(payload.proliferation ?? []),
      reuse: new Map(payload.reuse ?? []),
    };
  } catch {
    return null;
  }
}
