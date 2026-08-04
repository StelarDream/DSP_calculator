import { ROW_HEIGHT, COLUMN_WIDTH } from './constants.js';

// Left-to-right node-link layout, in two passes:
//
//  1. measure() - bottom-up - how many row-units tall each node's whole
//     block is: its own row, plus any byproduct rows, plus whatever its
//     children need (whichever is taller).
//  2. assign() - top-down - turns those sizes into actual row positions.
//     A node's children are centered *within* its block - which is only
//     ever taller than what they strictly need when the node's own row(s)
//     don't otherwise fit alongside them, so most nodes see no offset at
//     all. A node with byproducts pins its own row to the top of its block
//     instead of centering on its children, with the byproduct row(s)
//     directly beneath it.
//
// Row units are scoped to each node's own children (via the returned block
// height), not a single counter shared across the whole tree - so one
// branch's depth/byproducts can never force a phantom gap into an unrelated
// sibling branch two columns over.
export function layoutTree(root) {
  const positions = new Map(); // path -> { x, y }
  const byproductSpots = new Map(); // path -> [{ x, y }, ...], same order as node.byproducts
  let maxDepth = 0;
  let maxRow = 0;

  function measure(node) {
    maxDepth = Math.max(maxDepth, node.depth);
    const ownRows = 1 + node.byproducts.length;
    const childrenRows = node.children.reduce((sum, child) => sum + measure(child), 0);
    node._blockHeight = Math.max(ownRows, childrenRows);
    return node._blockHeight;
  }

  // Returns the node's own row (not its block's top), since that's what a
  // non-byproduct parent needs to center itself on.
  function assign(node, rowStart) {
    const x = node.depth * COLUMN_WIDTH;

    const childrenRows = node.children.reduce((sum, child) => sum + child._blockHeight, 0);
    const offset = (node._blockHeight - childrenRows) / 2;
    let cursor = rowStart + offset;
    const childOwnRows = node.children.map((child) => {
      const row = assign(child, cursor);
      cursor += child._blockHeight;
      return row;
    });

    let ownRow;
    if (node.byproducts.length > 0) {
      ownRow = rowStart;
      byproductSpots.set(node.path, node.byproducts.map((_, i) => ({ x, y: (ownRow + 1 + i) * ROW_HEIGHT })));
      maxRow = Math.max(maxRow, ownRow + node.byproducts.length);
    } else if (childOwnRows.length > 0) {
      ownRow = (childOwnRows[0] + childOwnRows[childOwnRows.length - 1]) / 2;
    } else {
      ownRow = rowStart;
    }

    maxRow = Math.max(maxRow, ownRow);
    positions.set(node.path, { x, y: ownRow * ROW_HEIGHT });
    return ownRow;
  }

  measure(root);
  assign(root, 0);

  const nodes = [];
  const edges = [];
  const byproductEdges = [];

  (function collect(node) {
    nodes.push({ node, ...positions.get(node.path) });

    const spots = byproductSpots.get(node.path);
    if (spots) {
      const from = positions.get(node.path);
      node.byproducts.forEach((byproduct, i) => {
        nodes.push({ node: byproduct, ...spots[i], isByproduct: true });
        byproductEdges.push({ from, to: spots[i] });
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
    byproductEdges,
    width: (maxDepth + 1) * COLUMN_WIDTH,
    height: Math.max((maxRow + 1) * ROW_HEIGHT, ROW_HEIGHT),
  };
}
