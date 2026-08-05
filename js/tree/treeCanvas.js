import { layoutTree } from './layoutTree.js';
import { renderTreeNode, renderRecipeHub, renderByproductNode } from './treeNode.js';
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

  const { nodes, edges, byproductEdges, width, height } = layoutTree(root);
  const worldWidth = width + PADDING * 2;
  const worldHeight = height + PADDING * 2;
  world.style.width = `${worldWidth}px`;
  world.style.height = `${worldHeight}px`;

  world.appendChild(renderEdges(edges, byproductEdges, worldWidth, worldHeight));
  for (const { node, x, y, isByproduct, isHub } of nodes) {
    const card = isByproduct ? renderByproductNode(node)
      : isHub ? renderRecipeHub(node, handlers)
      : renderTreeNode(node, handlers);
    world.appendChild(positionNode(card, x, y, isHub));
  }

  return { width: worldWidth, height: worldHeight };
}

function renderEdges(edges, byproductEdges, width, height) {
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

  for (const edge of byproductEdges) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'tree-edge tree-edge--byproduct');
    path.setAttribute('d', byproductEdgePath(edge));
    svg.appendChild(path);
  }

  return svg;
}

// Right edge of the `from` side to the left edge of the `to` side, as a
// horizontal bezier - the classic smooth org-chart connector. `to` is
// always a plain left-edge point, whether that's a child card or a hub
// (see layoutTree.js - a hub's stored position is already its center, same
// convention as a card's left edge, so it needs no extra offset either
// way). `from` only needs the +NODE_WIDTH offset to reach a card's right
// edge when it's an actual card - fromIsHub means it's already a point.
function edgePath({ from, to, fromIsHub }) {
  const x1 = from.x + (fromIsHub ? 0 : NODE_WIDTH) + PADDING;
  const y1 = from.y + PADDING;
  const x2 = to.x + PADDING;
  const y2 = to.y + PADDING;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

// From the recipe hub (from) to its byproduct (to) - the hub is the single
// shared point for everything that craft makes, byproduct included. Since
// the hub sits one column *deeper* than the byproduct (which shares its
// column with the product node), this flows right-to-left: the hub's point
// to the right edge of the byproduct card - the normal left-to-right
// bezier, mirrored.
function byproductEdgePath({ from, to }) {
  const x1 = from.x + PADDING;
  const y1 = from.y + PADDING;
  const x2 = to.x + NODE_WIDTH + PADDING;
  const y2 = to.y + PADDING;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

// Item/byproduct cards are left-edge-anchored (their stored x *is* the left
// edge) and only centered vertically. A hub's stored position is already
// its center on both axes - and since .recipe-hub is a *row* (icon beside
// its proliferation button, not stacked above it), the icon is the tallest
// thing in it, so the box's own center lands exactly on the icon's center
// too. That means simple whole-box centering already puts the icon on the
// target point, no separate per-axis handling needed.
function positionNode(card, x, y, isHub) {
  card.style.left = `${x + PADDING}px`;
  card.style.top = `${y + PADDING}px`;
  card.style.transform = isHub ? 'translate(-50%, -50%)' : 'translateY(-50%)';
  return card;
}
