import { layoutTree } from './layoutTree.js';
import { renderTreeNode } from './treeNode.js';
import { NODE_WIDTH } from './constants.js';

// Padding around the laid-out tree so cards/edges aren't flush against the
// world's own edges.
const PADDING = 40;

// Renders a built tree (see buildTree.js) as absolutely-positioned cards
// over an SVG edge overlay, inside a "world" div sized to fit the whole
// tree. Purely visual for now - no interactivity (pan/zoom, expand/collapse
// come in later steps); the canvas just scrolls if the tree is bigger than
// the viewport.
export function renderTreeCanvas(root) {
  const { nodes, edges, width, height } = layoutTree(root);
  const worldWidth = width + PADDING * 2;
  const worldHeight = height + PADDING * 2;

  const world = document.createElement('div');
  world.className = 'tree-world';
  world.style.width = `${worldWidth}px`;
  world.style.height = `${worldHeight}px`;

  world.appendChild(renderEdges(edges, worldWidth, worldHeight));
  for (const { node, x, y } of nodes) {
    world.appendChild(positionNode(renderTreeNode(node), x, y));
  }

  return world;
}

function renderEdges(edges, width, height) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tree-edges');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  for (const edge of edges) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'tree-edge');
    path.setAttribute('d', edgePath(edge));
    svg.appendChild(path);
  }

  return svg;
}

// Right edge of the parent to left edge of the child, as a horizontal
// bezier - the classic smooth org-chart connector.
function edgePath({ from, to }) {
  const x1 = from.x + NODE_WIDTH + PADDING;
  const y1 = from.y + PADDING;
  const x2 = to.x + PADDING;
  const y2 = to.y + PADDING;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

function positionNode(card, x, y) {
  card.style.left = `${x + PADDING}px`;
  card.style.top = `${y + PADDING}px`;
  card.style.transform = 'translateY(-50%)';
  return card;
}
