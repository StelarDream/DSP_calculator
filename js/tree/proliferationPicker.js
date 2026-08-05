import { PROLIF_YIELD_ICON, PROLIF_CHANCE_ICON, PROLIF_SPEED_ICON, PROLIF_NONE_ICON } from '../ui/icons.js';
import { PROLIFERATOR_LEVELS } from './proliferatorLevels.js';

// Which proliferator effects exist, in display order - matches
// js/ui/proliferation.js's convention for the flat recipe card. `tone` also
// matches that file: yield/chance boost output (primary), speed is a
// throughput boost (secondary). Shared by the per-node picker (treeNode.js)
// and the tree-wide default picker (defaultProliferationPanel.js).
export const PROLIF_MODES = [
  { key: 'yield', icon: PROLIF_YIELD_ICON, label: 'Extra Yield', tone: 'primary' },
  { key: 'chance', icon: PROLIF_CHANCE_ICON, label: 'Extra Product Chance', tone: 'primary' },
  { key: 'speed', icon: PROLIF_SPEED_ICON, label: 'Speed Up', tone: 'secondary' },
];

// The "None | mode icons" row - shared by the per-node proliferation
// popover and the tree-wide default panel. `state` is the picker's current
// selection ({ mode, level }, either possibly null); `modes` is which mode
// buttons to offer (a node only offers what its recipe actually supports,
// the default panel offers all of them since it applies across recipes).
export function renderProlifModeRow(state, modes, { onSelectMode, onSelectNone }) {
  const row = document.createElement('div');
  row.className = 'tree-node-prolif-row';

  const none = document.createElement('button');
  none.type = 'button';
  none.className = 'tree-node-prolif-option tree-node-prolif-option--none';
  if (!state.mode && !state.level) none.classList.add('tree-node-prolif-option--active');
  none.title = 'None';
  none.setAttribute('aria-label', 'None');
  none.innerHTML = PROLIF_NONE_ICON;
  none.addEventListener('click', onSelectNone);
  row.appendChild(none);

  for (const mode of modes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tree-node-prolif-option tree-node-prolif-option--${mode.tone}`;
    if (state.mode === mode.key) btn.classList.add('tree-node-prolif-option--active');
    btn.title = mode.label;
    btn.setAttribute('aria-label', mode.label);
    btn.innerHTML = mode.icon;
    btn.addEventListener('click', () => onSelectMode(mode.key));
    row.appendChild(btn);
  }

  return row;
}

// The proliferator-level icon row - same sharing rationale as above.
export function renderProlifLevelRow(state, { onSelectLevel }) {
  const row = document.createElement('div');
  row.className = 'tree-node-prolif-row';

  for (const level of PROLIFERATOR_LEVELS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tree-node-prolif-option';
    if (state.level === level.id) btn.classList.add('tree-node-prolif-option--active');
    btn.title = level.label;
    btn.setAttribute('aria-label', level.label);
    const img = document.createElement('img');
    img.src = `assets/items/${level.itemId}.png`;
    img.alt = '';
    btn.appendChild(img);
    btn.addEventListener('click', () => onSelectLevel(level.id));
    row.appendChild(btn);
  }

  return row;
}

export function modeLabel(key) {
  return PROLIF_MODES.find((mode) => mode.key === key)?.label ?? key;
}

export function levelLabel(id) {
  return PROLIFERATOR_LEVELS.find((level) => level.id === id)?.label ?? id;
}
