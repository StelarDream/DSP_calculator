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
  const byproductSpots = new Map(); // path -> [{ x, y }, ...], same order as node.byproducts
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

    // Byproducts claim their own row(s) right after this node's whole
    // block, same column - reusing nextRow guarantees they can't overlap
    // anything else, at the cost of landing below the node's subtree
    // rather than flush against the node's own row.
    if (node.byproducts.length > 0) {
      byproductSpots.set(node.path, node.byproducts.map(() => {
        const spot = { x, y: nextRow * ROW_HEIGHT };
        nextRow += 1;
        return spot;
      }));
    }

    return y;
  }

  place(root);

  const nodes = [];
  const edges = [];

  (function collect(node) {
    nodes.push({ node, ...positions.get(node.path) });

    const spots = byproductSpots.get(node.path);
    if (spots) {
      node.byproducts.forEach((byproduct, i) => {
        nodes.push({ node: byproduct, ...spots[i], isByproduct: true });
      });
    }

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
