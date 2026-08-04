import { layoutTree } from './layoutTree.js';
import { renderTreeNode, renderByproductNode } from './treeNode.js';
import { NODE_WIDTH } from './constants.js';

// Padding around the laid-out tree so cards/edges aren't flush against the
// world's own edges.
const PADDING = 40;

// The pannable/zoomable element that node cards and edges get rendered
// into. Created once per tree view and reused across rebuilds (see
// renderTreeInto) so the pan/zoom transform applied to it isn't disturbed
// by expand/collapse or recipe-choice changes.
export function createTreeWorld() {
  const world = document.createElement('div');
  world.className = 'tree-world';
  return world;
}

// (Re)populates `world` with the given tree's cards + edges, resizing it to
// fit. Called for the initial render and again after every expand/collapse
// or recipe-choice change - reusing the same element rather than replacing
// it is what keeps the current pan/zoom position stable across a rebuild.
// Returns the world's new pixel size, since callers (fit-to-view) need it.
export function renderTreeInto(world, root, handlers) {
  world.innerHTML = '';

  const { nodes, edges, width, height } = layoutTree(root);
  const worldWidth = width + PADDING * 2;
  const worldHeight = height + PADDING * 2;
  world.style.width = `${worldWidth}px`;
  world.style.height = `${worldHeight}px`;

  world.appendChild(renderEdges(edges, worldWidth, worldHeight));
  for (const { node, x, y, isByproduct } of nodes) {
    const card = isByproduct ? renderByproductNode(node) : renderTreeNode(node, handlers);
    world.appendChild(positionNode(card, x, y));
  }

  return { width: worldWidth, height: worldHeight };
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
