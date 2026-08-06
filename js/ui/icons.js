// Small inline SVG icons for stats that don't have a game asset (time).
// Colored via currentColor so they inherit --primary from CSS.
export const CLOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;

// Dependency-tree glyph (root node branching into two) - used on the button
// that will kick off full recipe-tree generation.
export const TREE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5 5 16.5M12 11.5l7 5"/></svg>`;

// Left-pointing arrow - used on the tree view's back button.
export const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;

// Tree canvas toolbar - zoom in/out (magnifying glass) and fit-to-view
// (corner brackets).
export const ZOOM_IN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M10.5 8v5M8 10.5h5"/><path d="M20 20l-4.35-4.35"/></svg>`;
export const ZOOM_OUT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M8 10.5h5"/><path d="M20 20l-4.35-4.35"/></svg>`;
export const FIT_VIEW_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;

// Expand/collapse toggle on craftable tree nodes - a right-pointing chevron,
// rotated 90deg via CSS when the node is expanded.
export const CHEVRON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;

// Small pencil - "change recipe" badge on a resolved multi-recipe tree node,
// reopening the choice step (see buildTree.js's needsChoice).
export const EDIT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

// Tree canvas toolbar - copy a shareable link to the current tree state.
export const SHARE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4"/></svg>`;

// Small checkmark - flashed on the share button after a successful copy.
export const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

// Factory building silhouette - the tree view's button into Factory View
// (compiles the tree into machine/factory counts).
export const FACTORY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V10l5 3v-3l5 3V6l6 4v11z"/><path d="M3 21h18"/><path d="M8 21v-4M13 21v-4M18 21v-4"/></svg>`;

// Question mark - flags a resource-sidebar row whose total still includes
// at least one node with no recipe chosen yet (see summarizeTree.js).
export const PENDING_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.5c0 1.5-2 1.5-2.4 3"/><circle cx="12" cy="17" r="0.3" fill="currentColor"/></svg>`;

// Proliferator effect flags - which boost(s) a recipe supports.
export const PROLIF_SPEED_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>`;
export const PROLIF_YIELD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></svg>`;

// "No effect" - the proliferation picker's explicit opt-out, sitting
// alongside the yield/speed mode options (see treeNode.js).
export const PROLIF_NONE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></svg>`;

// Counter-clockwise reset arrow - "back to default", e.g. clearing a
// Factory View card's explicit building pick (see factoryCard.js).
export const RESET_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`;

// Recycle arrows - the tree view's byproduct-reuse marker (see
// reuseMarker.js), badging a demand node that's drawing from a byproduct
// elsewhere in the same tree.
export const REUSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h8l-2-2M15 7l-2 2"/><path d="M17 17H9l2 2M9 17l2-2"/><path d="M4.5 15a8 8 0 0 1 0-6M19.5 9a8 8 0 0 1 0 6"/></svg>`;

// Triangle exclamation - flags a reuse marker whose stored amount exceeds
// what's currently available (see reuseAllocation.js's "clamp + warn").
export const WARNING_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 22 20H2z"/><path d="M12 9.5v5"/><circle cx="12" cy="17.3" r="0.3" fill="currentColor"/></svg>`;
