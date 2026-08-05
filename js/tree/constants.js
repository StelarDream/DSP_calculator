// Shared sizing constants for the tree view - card dimensions plus the grid
// spacing layoutTree.js positions them on. Kept in one place so the layout
// math and the DOM/CSS that renders it can't drift apart.
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 56;

// The recipe hub - the small junction node layoutTree.js places between a
// resolved node and its ingredients/byproducts (see layoutTree.js's collect
// pass). Square, and centered on its position rather than left-edge-anchored
// like NODE_WIDTH/HEIGHT - see treeCanvas.js's positionNode.
export const HUB_SIZE = 44;

// Spacing between sibling rows and between depth columns - larger than the
// node itself so cards have breathing room and connectors are easy to read.
// COLUMN_WIDTH also has to leave room for a centered HUB_SIZE hub in the gap
// between two columns' cards, with margin on both sides - see layoutTree.js.
export const ROW_HEIGHT = 72;
export const COLUMN_WIDTH = 320;

// How many levels deep from the root are expanded by default; deeper nodes
// start collapsed so a request with a long supply chain doesn't dump an
// enormous tree on first paint. User toggles override this per node.
export const DEFAULT_EXPAND_DEPTH = 1;
