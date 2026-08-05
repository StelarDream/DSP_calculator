import { formatLabel } from './format.js';
import { BACK_ICON } from './icons.js';
import { buildTree } from '../tree/buildTree.js';
import { formatQty } from '../tree/formatQty.js';
import { buildFactoryPlan } from '../factory/buildFactoryPlan.js';
import { computeMachineCounts } from '../factory/computeMachineCounts.js';

// Target rate to compile against until the user types something else - an
// arbitrary but reasonable starting point (see memory: factory-view-plan,
// the full rate-slider design was scoped out of v1 in favor of this plain
// number input).
const DEFAULT_TARGET_RATE = 1;

// Full-pane Factory View - reached from the tree view's Factory View button.
// Compiles the current tree's per-node recipe/proliferation choices into
// aggregated machine/factory-count lines (see memory: factory-view-plan).
// treeState: { subjectId, recipe, choices, overrides, proliferation } - a
// snapshot of the tree the user was looking at, so "Back" can restore it
// exactly via onBack(treeState).
export function renderFactoryView(container, treeState, registries, onBack) {
  container.innerHTML = '';
  container.scrollTop = 0;

  container.appendChild(renderHeader(treeState, onBack));

  const body = document.createElement('div');
  body.className = 'factory-view-body';

  const planContainer = document.createElement('div');

  // Session-local to this render, same as treeView.js's own local state -
  // Factory View doesn't persist across a Back/Factory View round-trip.
  let targetRate = DEFAULT_TARGET_RATE;

  function rerenderPlan() {
    planContainer.innerHTML = '';
    planContainer.appendChild(renderPlanTable(treeState, registries, targetRate));
  }

  // The rate input is created once and left alone on every keystroke -
  // only the plan table below it re-renders, so typing doesn't fight the
  // input for cursor position/focus.
  body.appendChild(renderRateInput(treeState.subjectId, targetRate, (value) => {
    targetRate = value;
    rerenderPlan();
  }));
  body.appendChild(planContainer);
  container.appendChild(body);

  rerenderPlan();
}

function renderHeader(treeState, onBack) {
  const header = document.createElement('div');
  header.className = 'tree-view-header';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'back-btn';
  backBtn.innerHTML = `${BACK_ICON}<span>Back</span>`;
  backBtn.addEventListener('click', () => onBack(treeState));

  const title = document.createElement('h2');
  title.className = 'tree-view-title';
  title.textContent = `Factory View — ${formatLabel(treeState.subjectId ?? '')}`;

  header.append(backBtn, title);
  return header;
}

// A single "desired output rate" number input for the tree's root item -
// the one place a real items/sec target enters Factory View. Invalid or
// non-positive input is ignored rather than committed, so machine counts
// never see 0/negative/NaN rates.
function renderRateInput(subjectId, targetRate, onChange) {
  const row = document.createElement('label');
  row.className = 'factory-rate-input';

  const text = document.createElement('span');
  text.textContent = `Desired ${formatLabel(subjectId ?? '')} output (items/sec)`;

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = 'any';
  input.value = String(targetRate);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    if (Number.isFinite(value) && value > 0) onChange(value);
  });

  row.append(text, input);
  return row;
}

// TEMPORARY: a bare table of the compiled factory lines and their machine
// counts, just to validate buildFactoryPlan/computeMachineCounts against a
// real tree. No machine picker or byproduct handling yet - see memory:
// factory-view-plan for the real UI this gets replaced with.
function renderPlanTable(treeState, registries, targetRate) {
  const { subjectId, choices, overrides, proliferation } = treeState;
  const tree = buildTree(subjectId, 1, registries, { choices, overrides, proliferation });
  const lines = computeMachineCounts(buildFactoryPlan(tree, proliferation), targetRate);

  if (lines.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'factory-view-placeholder';
    placeholder.textContent = 'Nothing to compile yet - expand the tree first.';
    return placeholder;
  }

  const table = document.createElement('table');
  table.className = 'factory-plan-table';
  table.innerHTML = `
    <thead>
      <tr><th>Recipe</th><th>Proliferation</th><th>Crafts/sec</th><th>Machines</th></tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  for (const line of lines) {
    const row = document.createElement('tr');
    const prolif = line.mode ? `${formatLabel(line.mode)} (${line.level})` : '—';
    row.innerHTML = `
      <td>${formatLabel(Object.keys(line.recipe.result)[0] ?? '')}</td>
      <td>${prolif}</td>
      <td>${formatQty(line.craftsPerSec)}</td>
      <td>${Number.isFinite(line.machines) ? Math.ceil(line.machines) : '—'}</td>
    `;
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  const wrapper = document.createElement('div');
  wrapper.appendChild(table);
  return wrapper;
}
