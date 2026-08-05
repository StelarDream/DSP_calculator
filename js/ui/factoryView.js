import { formatLabel } from './format.js';
import { BACK_ICON } from './icons.js';
import { buildTree } from '../tree/buildTree.js';
import { buildFactoryPlan, lineKey } from '../factory/buildFactoryPlan.js';
import { computeMachineCounts } from '../factory/computeMachineCounts.js';
import { getBuildingOptions, getSelectedBuilding, getBuildingSpeed } from '../factory/buildingOptions.js';
import { computeRawInputs } from '../factory/computeRawInputs.js';
import { formatQty } from '../tree/formatQty.js';
import { renderFactoryCard } from './factoryCard.js';
import { renderDefaultBuildingSection } from './defaultBuildingPanel.js';

// Target rate to compile against until the user types something else - an
// arbitrary but reasonable starting point (see memory: factory-view-plan,
// the full rate-slider design was scoped out of v1 in favor of this plain
// number input).
const DEFAULT_TARGET_RATE = 1;

// Full-pane Factory View - reached from the tree view's Factory View button.
// Compiles the current tree's per-node recipe/proliferation choices into
// aggregated machine/factory-count cards (see memory: factory-view-plan).
// treeState: { subjectId, recipe, choices, overrides, proliferation } - a
// snapshot of the tree the user was looking at, so "Back" can restore it
// exactly via onBack(treeState). Its `proliferation` map is a fresh copy
// (see treeView.js's snapshot()) - Factory View mutates it directly when a
// card's proliferation is re-edited, so those edits ride back into the
// tree view too if the user hits Back afterward.
export function renderFactoryView(container, treeState, registries, onBack) {
  container.innerHTML = '';
  container.scrollTop = 0;

  container.appendChild(renderHeader(treeState, onBack));

  const body = document.createElement('div');
  body.className = 'factory-view-body';

  const row = document.createElement('div');
  row.className = 'factory-view-row';

  const main = document.createElement('div');
  main.className = 'factory-view-main';

  const sidebar = document.createElement('div');
  sidebar.className = 'factory-sidebar';

  const bottomBar = document.createElement('div');
  bottomBar.className = 'factory-bottom-bar';

  const planContainer = document.createElement('div');

  // Session-local to this render, same as treeView.js's own local state -
  // Factory View doesn't persist across a Back/Factory View round-trip
  // except through treeState.proliferation (see above).
  let targetRate = DEFAULT_TARGET_RATE;
  // Which building a line uses, keyed by line.key - purely a Factory View
  // choice (the tree has no notion of buildings), so unlike proliferation
  // it never rides back into the tree.
  const buildingChoice = new Map();
  // Sidebar-level default building per recipe TYPE - "like proliferation,"
  // a session-wide fallback (see defaultBuildingPanel.js) that applies to
  // any line of that type without its own explicit per-card override.
  const defaultBuildingByType = new Map();
  // Which of a line's byproducts count as internal supply for the bottom
  // bar's raw-input totals (computeRawInputs.js) vs. are treated as waste -
  // keyed by "<lineKey>::<itemId>" since one line can have more than one
  // byproduct and each toggles independently. Absent = reused (the
  // default) - see isByproductReused below.
  const byproductReuse = new Map();
  // Which card's proliferation popover is open, plus its in-progress
  // mode/level - same shape/rationale as treeView.js's openProlifMenu, just
  // keyed by line.key instead of a tree path.
  let openProlifCard = null;

  function isByproductReused(key, itemId) {
    return byproductReuse.get(`${key}::${itemId}`) ?? true;
  }

  function buildCurrentTree() {
    return buildTree(treeState.subjectId, 1, registries, {
      choices: treeState.choices,
      overrides: treeState.overrides,
      proliferation: treeState.proliferation,
    });
  }

  function computeLines(tree) {
    const rawLines = buildFactoryPlan(tree, treeState.proliferation);
    const withBuildingSpeed = rawLines.map((line) => {
      const options = getBuildingOptions(line.recipe, registries);
      const buildingId = getSelectedBuilding(options, buildingChoice, line.key, defaultBuildingByType.get(line.recipe.type));
      return { ...line, building: buildingId, buildingSpeed: getBuildingSpeed(options, buildingId) };
    });
    return computeMachineCounts(withBuildingSpeed, targetRate);
  }

  // Every (nodePath, itemId) pair whose byproduct is currently toggled to
  // waste - computeRawInputs.js excludes exactly these from its supply
  // side. Built from the *line's* toggle (one choice per line+item) but
  // expanded out to every contributing node path, since that's the level
  // computeRawInputs actually walks at.
  function wastedPathItems(lines) {
    const wasted = new Set();
    for (const line of lines) {
      const itemIds = Object.keys(line.recipe.result).slice(1); // all but the primary result
      for (const itemId of itemIds) {
        if (isByproductReused(line.key, itemId)) continue;
        for (const path of line.nodePaths) wasted.add(`${path}::${itemId}`);
      }
    }
    return wasted;
  }

  function rerenderPlan() {
    const tree = buildCurrentTree();
    const lines = computeLines(tree);
    planContainer.innerHTML = '';

    if (lines.length === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'factory-view-placeholder';
      placeholder.textContent = 'Nothing to compile yet - expand the tree first.';
      planContainer.appendChild(placeholder);
      renderSidebar(sidebar, [], registries, defaultBuildingByType, onSetDefaultBuilding);
      renderBottomBar(bottomBar, [], registries);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'factory-cards-grid';

    for (const line of lines) {
      grid.appendChild(renderFactoryCard(line, registries, buildingChoice, defaultBuildingByType, openProlifCard, {
        onSelectBuilding(key, buildingId) {
          buildingChoice.set(key, buildingId);
          rerenderPlan();
        },
        onResetBuilding(key) {
          buildingChoice.delete(key);
          rerenderPlan();
        },
        onToggleProlifMenu(key) {
          if (openProlifCard?.key === key) {
            openProlifCard = null;
          } else {
            const target = lines.find((l) => l.key === key);
            openProlifCard = { key, mode: target?.mode ?? null, level: target?.level ?? null };
          }
          rerenderPlan();
        },
        onSetProlifMode(key, mode) {
          if (openProlifCard?.key !== key) return;
          openProlifCard = { ...openProlifCard, mode };
          commitProlif(key, lines);
          rerenderPlan();
        },
        onSetProlifLevel(key, level) {
          if (openProlifCard?.key !== key) return;
          openProlifCard = { ...openProlifCard, level };
          commitProlif(key, lines);
          rerenderPlan();
        },
        onClearProliferation(key) {
          const target = lines.find((l) => l.key === key);
          if (target) {
            for (const path of target.nodePaths) treeState.proliferation.set(path, { mode: null, level: null });
            carryBuildingChoice(target, lineKey(target.recipe.id, null, null));
          }
          openProlifCard = null;
          rerenderPlan();
        },
        isByproductReused,
        onToggleByproductReuse(key, itemId) {
          byproductReuse.set(`${key}::${itemId}`, !isByproductReused(key, itemId));
          rerenderPlan();
        },
      }));
    }

    planContainer.appendChild(grid);
    renderSidebar(sidebar, lines, registries, defaultBuildingByType, onSetDefaultBuilding);

    const rawInputs = computeRawInputs(tree, wastedPathItems(lines), targetRate);
    renderBottomBar(bottomBar, rawInputs, registries);
  }

  function onSetDefaultBuilding(type, buildingId) {
    defaultBuildingByType.set(type, buildingId);
    rerenderPlan();
  }

  // Only actually applies once both a mode and a level are chosen (in
  // either order), same convention as treeView.js's own commitProlif -
  // writes the new setting onto every node this line was aggregated from.
  function commitProlif(key, lines) {
    if (!openProlifCard?.mode || !openProlifCard?.level) return;
    const target = lines.find((l) => l.key === key);
    if (!target) return;
    for (const path of target.nodePaths) {
      treeState.proliferation.set(path, { mode: openProlifCard.mode, level: openProlifCard.level });
    }
    carryBuildingChoice(target, lineKey(target.recipe.id, openProlifCard.mode, openProlifCard.level));
    openProlifCard = null;
  }

  // A proliferation edit changes which line (key) a card belongs to - by
  // default that'd silently reset its building back to the new line's
  // default (options[0]), which reads as "changing proliferation resets
  // the building I picked." Carries the old line's choice over to the new
  // key instead, unless the destination already has its own explicit pick
  // (e.g. it already existed as a separate line before this edit).
  function carryBuildingChoice(oldLine, newKey) {
    if (newKey === oldLine.key) return;
    if (buildingChoice.has(oldLine.key) && !buildingChoice.has(newKey)) {
      buildingChoice.set(newKey, buildingChoice.get(oldLine.key));
    }
    buildingChoice.delete(oldLine.key);
  }

  // The rate input is created once and left alone on every keystroke -
  // only the plan below it re-renders, so typing doesn't fight the input
  // for cursor position/focus.
  main.appendChild(renderRateInput(treeState.subjectId, targetRate, (value) => {
    targetRate = value;
    rerenderPlan();
  }));
  main.appendChild(planContainer);

  row.append(main, sidebar);
  body.append(row, bottomBar);
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

// Total building count across every line, both as a grand total and
// broken down per building type - e.g. "3x Assembling Machine Mk.II". Each
// line contributes its *currently selected* building (see buildingChoice),
// ceil'd the same way an individual card's machine count is - you can't
// build a fraction of a machine.
function renderSidebar(sidebar, lines, registries, defaultBuildingByType, onSetDefaultBuilding) {
  sidebar.innerHTML = '';
  sidebar.appendChild(renderTotalsSection(lines, registries));

  // Pinned after the totals, same "settings panel last" convention as the
  // tree view's own sidebar (see defaultProliferationPanel.js) - null when
  // no recipe type among the current lines actually has a choice to make.
  const defaultsSection = renderDefaultBuildingSection(lines, registries, defaultBuildingByType, onSetDefaultBuilding);
  if (defaultsSection) sidebar.appendChild(defaultsSection);
}

function renderTotalsSection(lines, registries) {
  const section = document.createElement('div');
  section.className = 'tree-resources-section';

  const heading = document.createElement('h3');
  heading.className = 'tree-resources-title';
  heading.textContent = 'Total Buildings';
  section.appendChild(heading);

  const perBuilding = new Map(); // buildingId -> count
  let total = 0;
  for (const line of lines) {
    if (!Number.isFinite(line.machines)) continue;
    const count = Math.ceil(line.machines);
    total += count;
    const buildingId = line.building ?? null;
    if (buildingId) perBuilding.set(buildingId, (perBuilding.get(buildingId) ?? 0) + count);
  }

  if (total === 0) {
    const empty = document.createElement('p');
    empty.className = 'tree-resources-empty';
    empty.textContent = 'None yet.';
    section.appendChild(empty);
    return section;
  }

  const grandTotal = document.createElement('p');
  grandTotal.className = 'factory-sidebar-total';
  grandTotal.textContent = `${total} total`;
  section.appendChild(grandTotal);

  const list = document.createElement('div');
  list.className = 'factory-sidebar-building-list';
  for (const [buildingId, count] of perBuilding) {
    const row = document.createElement('div');
    row.className = 'factory-sidebar-building-row';

    const icon = document.createElement('img');
    icon.className = 'factory-sidebar-building-icon';
    icon.src = registries.objects.get(buildingId)?.icon ?? '';
    icon.alt = '';
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'factory-sidebar-building-name';
    name.textContent = formatLabel(buildingId);
    row.appendChild(name);

    const qty = document.createElement('span');
    qty.className = 'factory-sidebar-building-qty';
    qty.textContent = `×${count}`;
    row.appendChild(qty);

    list.appendChild(row);
  }
  section.appendChild(list);
  return section;
}

// Footer strip across the bottom of Factory View - every raw item the
// compiled plan still needs from outside it (see computeRawInputs.js),
// and how much of it per second at the current target rate. A horizontal
// scroller rather than a grid - meant to be skimmed at a glance, not
// browsed like the cards above it.
function renderBottomBar(bottomBar, rawInputs, registries) {
  bottomBar.innerHTML = '';

  const heading = document.createElement('h3');
  heading.className = 'factory-bottom-bar-title';
  heading.textContent = 'Raw Inputs';
  bottomBar.appendChild(heading);

  if (rawInputs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'tree-resources-empty';
    empty.textContent = 'None yet.';
    bottomBar.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'factory-bottom-bar-list';
  for (const { itemId, object, ratePerSec } of rawInputs) {
    const chip = document.createElement('div');
    chip.className = 'factory-bottom-bar-chip';

    const icon = document.createElement('img');
    icon.className = 'factory-bottom-bar-icon';
    icon.src = object?.icon ?? '';
    icon.alt = '';
    chip.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'factory-bottom-bar-name';
    name.textContent = formatLabel(itemId);
    chip.appendChild(name);

    const rate = document.createElement('span');
    rate.className = 'factory-bottom-bar-rate';
    rate.textContent = `${formatQty(ratePerSec)}/s`;
    chip.appendChild(rate);

    list.appendChild(chip);
  }
  bottomBar.appendChild(list);
}
