import { formatLabel } from '../ui/format.js';
import { NODE_WIDTH, NODE_HEIGHT } from './constants.js';

// A single fixed-size card in the tree canvas - icon, name, required qty.
// Leaf/cycle nodes get a modifier class for their distinct styling; no
// click handlers yet, this is purely the visual for step 2.
export function renderTreeNode(node) {
  const el = document.createElement('div');
  el.className = 'tree-node';
  if (node.isLeaf) el.classList.add('tree-node--leaf');
  if (node.isCycle) el.classList.add('tree-node--cycle');
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;

  const icon = document.createElement('img');
  icon.className = 'tree-node-icon';
  icon.src = node.object?.icon ?? '';
  icon.alt = '';

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = formatLabel(node.itemId);

  const qty = document.createElement('span');
  qty.className = 'tree-node-qty';
  qty.textContent = `×${formatQty(node.qty)}`;

  info.append(name, qty);
  el.append(icon, info);
  return el;
}

// Two decimals max, but drop the decimal entirely when it's a whole number
// (most quantities are; fractional ones only show up from ratio scaling).
function formatQty(qty) {
  const rounded = Math.round(qty * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
