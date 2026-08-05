// Shared sizing constants for the tree view - card dimensions plus the grid
// spacing layoutTree.js positions them on. Kept in one place so the layout
// math and the DOM/CSS that renders it can't drift apart.
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 56;

// The recipe hub (treeNode.js's renderRecipeHub) is anchored to its own
// *icon*, not the whole box - the box also grows downward to fit a
// proliferation row once the recipe has one (see .recipe-hub-divider in
// styles.css), and centering the whole box on that would drag the icon
// (and every edge connecting to it) down below where it visually belongs
// every time that row appears. This is the icon's vertical center, in px
// from the hub's own outer top edge: .recipe-hub's border (1px) + its
// padding-top (6px) + half of .recipe-hub-icon's height (26px / 2 = 13px)
// - keep in sync with styles.css if any of those change.
export const HUB_ICON_OFFSET = 20;

// Spacing between sibling rows and between depth columns - larger than the
// node itself so cards have breathing room and connectors are easy to read.
// COLUMN_WIDTH also has to leave room for the recipe hub (see treeNode.js's
// renderRecipeHub) that sits centered in the gap between two columns'
// cards - it's fully CSS/content-sized rather than a fixed constant, so it
// just needs the gap to be comfortably wider than it'll ever get.
export const ROW_HEIGHT = 72;
export const COLUMN_WIDTH = 320;

// How many levels deep from the root are expanded by default; deeper nodes
// start collapsed so a request with a long supply chain doesn't dump an
// enormous tree on first paint. User toggles override this per node.
export const DEFAULT_EXPAND_DEPTH = 1;
