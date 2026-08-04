import { formatLabel } from '../ui/format.js';
import { CHEVRON_ICON } from '../ui/icons.js';
import { NODE_WIDTH, NODE_HEIGHT } from './constants.js';

// A single fixed-size card in the tree canvas. Three flavors:
//  - choice: "expand using this recipe" - see renderChoiceNode.
//  - leaf/cycle: plain, non-interactive card.
//  - craftable: a button with a chevron, toggling expand/collapse via
//    handlers.onToggle(path, wasCollapsed) on click.
export function renderTreeNode(node, handlers = {}) {
  if (node.isChoice) return renderChoiceNode(node, handlers.onChoose);

  const { onToggle } = handlers;
  const expandable = !node.isLeaf && typeof onToggle === 'function';
  const el = document.createElement(expandable ? 'button' : 'div');
  el.className = 'tree-node';
  if (node.isLeaf) el.classList.add('tree-node--leaf');
  if (node.isCycle) el.classList.add('tree-node--cycle');
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;

  if (expandable) {
    el.type = 'button';
    el.classList.add('tree-node--expandable');
    el.addEventListener('click', () => onToggle(node.path, node.isCollapsed));
  }

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

  if (expandable) {
    const chevron = document.createElement('span');
    chevron.className = 'tree-node-chevron';
    if (!node.isCollapsed) chevron.classList.add('tree-node-chevron--open');
    chevron.innerHTML = CHEVRON_ICON;
    el.appendChild(chevron);
  }

  return el;
}

// One candidate recipe, shown in place of a craftable node's children when
// it has more than one option and none has been picked yet - see
// buildTree.js's needsChoice. Distinguished by recipe *type* + a summary of
// its ingredients, since the item icon/name would be identical across every
// option (they all produce the same thing).
function renderChoiceNode(node, onChoose) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tree-node tree-node--choice';
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;
  el.addEventListener('click', () => onChoose?.(node.parentPath, node.recipe.id));

  const icon = document.createElement('img');
  icon.className = 'tree-node-icon';
  icon.src = `assets/recipe-types/${node.recipe.type}.png`;
  icon.alt = '';

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = formatLabel(node.recipe.type);

  const via = document.createElement('span');
  via.className = 'tree-node-qty';
  via.textContent = Object.keys(node.recipe.ingredients).map(formatLabel).join(', ');

  info.append(name, via);
  el.append(icon, info);
  return el;
}

// Two decimals max, but drop the decimal entirely when it's a whole number
// (most quantities are; fractional ones only show up from ratio scaling).
function formatQty(qty) {
  const rounded = Math.round(qty * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
