import { formatQty } from './formatQty.js';

// The one "how much" control shared by every amount picker in the tree - a
// number input plus Max/Clear presets, wrapped in the popover shell every
// one of them uses (see renderReuseMenu/renderManualMenu below, and their
// callers: the reuse/manual hubs and their needsChoice-stage choice-card
// counterparts in treeNode.js). Committing on blur/Enter (not on every
// keystroke) matters here specifically: treeCanvas.js does a full
// innerHTML replace on every rerender (see renderTreeInto), which would
// yank focus out of a live-bound input on each keystroke otherwise.
//
// `max` is whatever ceiling this particular kind of coverage can't exceed -
// pool reuse callers pass min(qty, available) (see reuseAvailability's own
// comment for why `available` alone, not `available + current`, is already
// the right number); manual supply has no pool to respect, so its callers
// just pass the remaining room directly.
function renderMenu({ max, current, emptyText, availableText, onApply, onClear }) {
  const menu = document.createElement('div');
  menu.className = 'tree-node-reuse-menu';
  // Nothing inside here should reach the canvas's pointerdown (pan) - same
  // reasoning as the proliferation menu.
  menu.addEventListener('click', (event) => event.stopPropagation());

  const section = document.createElement('div');
  section.className = 'tree-node-supply-section';

  const availability = document.createElement('div');
  availability.className = 'tree-node-reuse-availability';
  availability.textContent = max > 0 ? availableText(max) : emptyText;
  section.appendChild(availability);

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

  section.appendChild(row);

  if (current > 0) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'tree-node-reuse-btn tree-node-reuse-btn--clear';
    clear.textContent = 'Clear';
    clear.addEventListener('click', onClear);
    section.appendChild(clear);
  }

  menu.appendChild(section);
  return menu;
}

// The reuse popover - opened by the reuse hub (see treeNode.js's
// renderReuseHub) and its needsChoice-stage "Reuse leftover" choice card
// (renderReuseChoiceNode).
//
// state: { qty, available, current } - `available` (see reusePool.js's
// reuseAvailability) already excludes only *other* nodes' claims, not this
// node's own current one, which is exactly what makes it the right ceiling
// on its own - no need to add `current` back on top. An earlier version of
// this menu did `available + current` here, on the assumption `available`
// had excluded everyone including this node - it hadn't, so that doubled
// this node's own claim into its displayed ceiling. Caught by a user
// testing two nodes reusing from each other's byproduct: each grew its own
// max by its own current amount, both showing more room than the pool
// actually had (confirmed: two nodes each claiming half a 10-unit pool
// still both showed "10 available" instead of the true 5 remaining).
export function renderReuseMenu(state, { onApply, onClear }) {
  const { qty, available, current } = state;
  const max = Math.min(qty, available);
  return renderMenu({
    max,
    current,
    emptyText: 'Nothing left unclaimed in the pool',
    availableText: (m) => `${formatQty(m)} available from leftover`,
    onApply,
    onClear,
  });
}

// The manual-supply popover - opened by the manual hub (see treeNode.js's
// renderManualHub) and its needsChoice-stage "Supply myself" choice card
// (renderManualChoiceNode). No pool to cap against (unlike renderReuseMenu)
// - `qty` here is simply the remaining room (whatever reuse hasn't already
// covered), so it doubles as `max` directly.
export function renderManualMenu(state, { onApply, onClear }) {
  const { qty, current } = state;
  return renderMenu({
    max: qty,
    current,
    emptyText: 'Nothing left to supply',
    availableText: (m) => `${formatQty(m)} can be supplied manually`,
    onApply,
    onClear,
  });
}
