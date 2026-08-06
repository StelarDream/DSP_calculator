import { formatQty } from './formatQty.js';

// The recycle popover's body - opened by the recycle button on a cycle
// node (see treeNode.js's renderCycleNode). Same shape/committing
// convention as reusePicker.js's renderReuseMenu (number input + Max/Clear,
// commit on blur/Enter rather than every keystroke - see that file for why
// treeCanvas.js's full-replace rerender makes that matter) - kept as its
// own file rather than reusing that one despite the near-identical layout,
// since the two controls mean genuinely different things: reuse draws down
// a *shared* leftover pool capped by what other nodes have already
// claimed, recycling only ever competes with this cycle node's own demand
// (qty) - there's no pool to check against, no "claimed elsewhere" to
// exclude. Folding both into one component risked the wording (or a
// future edit to one) quietly drifting onto the other.
//
// state: { path, qty, current } - max is always just `qty` itself, capped
// at what this node even needs (see buildTree.js's recycledQty clamp).
export function renderRecycleMenu(state, { onApply, onClear }) {
  const { qty, current } = state;
  const max = qty;

  const menu = document.createElement('div');
  menu.className = 'tree-node-recycle-menu';
  // Nothing inside here should reach the canvas's pointerdown (pan) - same
  // reasoning as every other hub popover.
  menu.addEventListener('click', (event) => event.stopPropagation());

  const hint = document.createElement('div');
  hint.className = 'tree-node-recycle-hint';
  hint.textContent = `Up to ×${formatQty(max)} can be fed back from the output`;
  menu.appendChild(hint);

  const row = document.createElement('div');
  row.className = 'tree-node-recycle-row';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'tree-node-recycle-input';
  input.min = '0';
  input.max = String(max);
  input.step = 'any';
  input.value = current > 0 ? String(current) : '';
  input.placeholder = '0';

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
  maxBtn.className = 'tree-node-recycle-btn';
  maxBtn.textContent = 'Max';
  // Deliberately *not* onApply(max) - `max` is only this render's current
  // demand, and recycling more back in grows the ancestor's output, which
  // grows this exact demand again (a real feedback loop, see
  // cycleRecycle.js). A snapshot number freezes at whatever the demand
  // happened to be on the render Max was clicked, well short of "fully
  // closed loop" once the ancestor's own qty keeps growing across the
  // rebuild passes that discover that growth. Number.MAX_SAFE_INTEGER
  // instead of Infinity purely so it survives JSON.stringify (share
  // links, see serializeTree.js) - either way buildTree.js's own
  // Math.min(requested, childQty) clamp always resolves it back down to
  // "whatever this node currently needs," which is exactly "max," every
  // single rebuild - self-adjusting as the loop grows, rather than a
  // number that has to be re-maxed by hand each time it grows.
  maxBtn.addEventListener('click', () => onApply(Number.MAX_SAFE_INTEGER));
  row.appendChild(maxBtn);

  menu.appendChild(row);

  if (current > 0) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'tree-node-recycle-btn tree-node-recycle-btn--clear';
    clear.textContent = 'Clear';
    clear.addEventListener('click', onClear);
    menu.appendChild(clear);
  }

  return menu;
}
