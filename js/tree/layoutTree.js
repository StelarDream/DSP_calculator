import { ROW_HEIGHT, COLUMN_WIDTH } from './constants.js';

// Left-to-right node-link layout: depth picks the column, and each leaf
// (or collapsed/childless node) claims the next free row. A parent is
// centered on the vertical midpoint of its own children, which is what
// gives the tree its balanced, organic branching look.
//
// Returns flat lists rather than a positioned copy of the tree, since
// that's what the renderer and the SVG edge overlay actually need.
export function layoutTree(root) {
  const positions = new Map(); // path -> { x, y }
  let nextRow = 0;
  let maxDepth = 0;

  function place(node) {
    maxDepth = Math.max(maxDepth, node.depth);
    const x = node.depth * COLUMN_WIDTH;

    let y;
    if (node.children.length === 0) {
      y = nextRow * ROW_HEIGHT;
      nextRow += 1;
    } else {
      const childYs = node.children.map(place);
      y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    }

    positions.set(node.path, { x, y });
    return y;
  }

  place(root);

  const nodes = [];
  const edges = [];

  (function collect(node) {
    nodes.push({ node, ...positions.get(node.path) });
    for (const child of node.children) {
      edges.push({ from: positions.get(node.path), to: positions.get(child.path) });
      collect(child);
    }
  })(root);

  return {
    nodes,
    edges,
    width: (maxDepth + 1) * COLUMN_WIDTH,
    height: Math.max(nextRow * ROW_HEIGHT, ROW_HEIGHT),
  };
}
