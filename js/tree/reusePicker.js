import { formatQty } from './formatQty.js';

// The reuse popover's body - opened by the reuse button on a resolved
// node's recipe hub (see treeNode.js). Unlike the proliferation picker's
// mode/level buttons, "how much" is a continuous amount, not a fixed set
// of options - so this is a number input plus a couple of presets, not a
// button row. Committing on blur/Enter (not on every keystroke) matters
// here specifically: treeCanvas.js does a full innerHTML replace on every
// rerender (see renderTreeInto), which would yank focus out of a
// live-bound input on each keystroke otherwise.
//
// state: { path, itemId, qty, available, current } - `available` already
// excludes `current` (see reusePool.js's excludePath) so the input's own
// max is available + current, not just available.
export function renderReuseMenu(state, { onApply, onClear }) {
  const { qty, available, current } = state;
  const max = Math.min(qty, available + current);

  const menu = document.createElement('div');
  menu.className = 'tree-node-reuse-menu';
  // Nothing inside here should reach the canvas's pointerdown (pan) - same
  // reasoning as the proliferation menu.
  menu.addEventListener('click', (event) => event.stopPropagation());

  const availability = document.createElement('div');
  availability.className = 'tree-node-reuse-availability';
  availability.textContent = max > 0
    ? `${formatQty(max)} available from leftover`
    : 'Nothing available to reuse here';
  menu.appendChild(availability);

  const row = document.createElement('div');
  row.className = 'tree-node-reuse-row';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'tree-node-reuse-input';
  input.min = '0';
  input.max = String(max);
  input.step = 'any';
  input.value = current > 0 ? String(current) : '';
  input.placeholder = '0';
  input.disabled = max <= 0;

  const commit = () => {
    const parsed = Number(input.value);
    const amount = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : 0;
    onApply(amount);
  };
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commit();
  });
  input.addEventListener('blur', commit);
  row.appendChild(input);

  const maxBtn = document.createElement('button');
  maxBtn.type = 'button';
  maxBtn.className = 'tree-node-reuse-btn';
  maxBtn.textContent = 'Max';
  maxBtn.disabled = max <= 0;
  maxBtn.addEventListener('click', () => onApply(max));
  row.appendChild(maxBtn);

  menu.appendChild(row);

  if (current > 0) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'tree-node-reuse-btn tree-node-reuse-btn--clear';
    clear.textContent = 'Clear';
    clear.addEventListener('click', onClear);
    menu.appendChild(clear);
  }

  return menu;
}
