// Shared sizing constants for the tree view - card dimensions plus the grid
// spacing layoutTree.js positions them on. Kept in one place so the layout
// math and the DOM/CSS that renders it can't drift apart.
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 56;

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
