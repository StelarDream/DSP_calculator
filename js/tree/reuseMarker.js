import { formatLabel } from '../ui/format.js';
import { REUSE_ICON, WARNING_ICON } from '../ui/icons.js';
import { NODE_WIDTH, NODE_HEIGHT } from './constants.js';
import { formatQty } from './formatQty.js';

// The reuse marker - a candidate (or active) link between the node it's
// attached to and a byproduct elsewhere in the tree producing the same item
// (see buildTree.js's node.reuse / reuseAllocation.js). Auto-detected and on
// by default rather than something the user has to go find and wire up -
// this card is the opt-*out*, not the opt-in. Laid out relative to the node
// it annotates rather than that node's hub/children (see layoutTree.js), so
// it's visible whether or not that node happens to be expanded.
export function renderReuseMarker(node, handlers = {}) {
  const { onToggleReuse, openReuseMenu, onToggleReuseMenu } = handlers;
  const reuse = node.reuse;

  const el = document.createElement('div');
  el.className = 'tree-node tree-node--reuse';
  if (!reuse.on) el.classList.add('tree-node--reuse-off');
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;
  el.setAttribute('role', 'button');
  el.tabIndex = 0;

  const menuOpen = openReuseMenu?.path === node.path;
  if (menuOpen) el.classList.add('tree-node--reuse-menu-open');

  const toggleMenu = () => onToggleReuseMenu?.(node.path);
  el.addEventListener('click', toggleMenu);
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleMenu();
  });

  const icon = document.createElement('img');
  icon.className = 'tree-node-icon';
  icon.src = node.object?.icon ?? '';
  icon.alt = '';

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = reuse.on ? 'Reused' : 'Reuse (off)';

  const qty = document.createElement('span');
  qty.className = 'tree-node-qty';
  qty.textContent = `${reuse.on ? '-' : ''}${formatQty(reuse.qty)} ${formatLabel(node.itemId)}`;

  info.append(name, qty);

  const badge = document.createElement('span');
  badge.className = 'tree-node-reuse-badge';
  badge.innerHTML = REUSE_ICON;

  el.append(icon, info, badge);

  if (reuse.warning) {
    const warn = document.createElement('span');
    warn.className = 'tree-node-reuse-warning';
    warn.innerHTML = WARNING_ICON;
    warn.title = "This link asks for more than is currently available - clamped to what's on offer.";
    el.appendChild(warn);
  }

  if (menuOpen) {
    el.appendChild(renderReuseMenu(node, handlers));
  }

  return el;
}

// Toggle + quantity stepper, opened by clicking the marker. Nested inside
// the card (not a floating overlay) so it inherits the tree's pan/zoom
// transform, same reasoning as the recipe hub's proliferation popover (see
// treeNode.js's renderProlifMenu).
function renderReuseMenu(node, { onToggleReuse, onSetReuseQty }) {
  const reuse = node.reuse;
  const menu = document.createElement('div');
  menu.className = 'tree-reuse-menu';
  // Nothing inside here should reach the canvas's pan handling or the
  // marker's own click (which would just reopen/close the menu).
  menu.addEventListener('click', (event) => event.stopPropagation());

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tree-reuse-menu-toggle';
  if (reuse.on) toggle.classList.add('tree-reuse-menu-toggle--active');
  toggle.textContent = reuse.on ? 'Reusing - click to turn off' : 'Not reusing - click to turn on';
  toggle.addEventListener('click', () => onToggleReuse(node.path));
  menu.appendChild(toggle);

  const stepper = document.createElement('label');
  stepper.className = 'tree-reuse-menu-qty';

  const label = document.createElement('span');
  label.textContent = `Amount to reuse (max ${formatQty(reuse.available)})`;

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = String(reuse.available);
  input.step = 'any';
  input.value = String(Math.round(reuse.qty * 100) / 100);
  // Invalid/negative input is ignored rather than committed - same
  // convention as Factory View's rate input (factoryView.js).
  input.addEventListener('input', () => {
    const value = Number(input.value);
    if (Number.isFinite(value) && value >= 0) onSetReuseQty(node.path, value);
  });

  stepper.append(label, input);
  menu.appendChild(stepper);

  return menu;
}
