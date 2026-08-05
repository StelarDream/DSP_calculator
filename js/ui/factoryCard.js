import { formatLabel } from './format.js';
import { formatQty } from '../tree/formatQty.js';
import { PROLIF_NONE_ICON } from './icons.js';
import { PROLIF_MODES, renderProlifModeRow, renderProlifLevelRow, levelLabel } from '../tree/proliferationPicker.js';
import { getBuildingOptions, getSelectedBuilding } from '../factory/buildingOptions.js';
import { computeLineRates } from '../factory/lineRates.js';

// A single Factory View card - one per (recipe, proliferation) line from
// buildFactoryPlan.js. Vertical, sectioned by dividers: building (icon +
// picker when there's more than one option), proliferation (current
// setting, click to re-edit), machines needed, then demand/output rates.
//
// handlers: { onSelectBuilding(lineKey, buildingId), onToggleProlifMenu
// (lineKey), onSetProlifMode(lineKey, mode), onSetProlifLevel(lineKey,
// level), onClearProliferation(lineKey) } - all keyed by line.key since a
// prolif edit changes which line a card even belongs to (see
// factoryView.js).
export function renderFactoryCard(line, registries, buildingChoice, openProlifCard, handlers) {
  const card = document.createElement('div');
  card.className = 'factory-card';

  card.appendChild(renderIconHeader(line, registries, buildingChoice));
  card.appendChild(renderDivider());
  card.appendChild(renderBuildingSection(line, registries, buildingChoice, handlers));
  card.appendChild(renderDivider());
  card.appendChild(renderProlifSection(line, openProlifCard, handlers));
  card.appendChild(renderDivider());
  card.appendChild(renderMachinesSection(line));
  card.appendChild(renderDivider());
  card.appendChild(renderRatesSection(line, registries));

  return card;
}

// Building icon and recipe/product icon side by side, same size and box
// style, with an arrow between them reading "this building makes this" -
// clearer at a glance than the old overlapping-badge layout, and treats
// both icons as equally important instead of one being a corner afterthought.
function renderIconHeader(line, registries, buildingChoice) {
  const header = document.createElement('div');
  header.className = 'factory-card-icon-header';

  const row = document.createElement('div');
  row.className = 'factory-card-icon-row';

  const options = getBuildingOptions(line.recipe, registries);
  const selected = getSelectedBuilding(options, buildingChoice, line.key);
  const buildingSrc = selected ? registries.objects.get(selected)?.icon ?? '' : '';
  row.appendChild(renderIconBox(buildingSrc, selected ? formatLabel(selected) : ''));

  const arrow = document.createElement('span');
  arrow.className = 'factory-card-icon-arrow';
  arrow.textContent = '→';
  row.appendChild(arrow);

  const firstResultId = Object.keys(line.recipe.result)[0];
  row.appendChild(renderIconBox(recipeIconSrc(line.recipe, firstResultId, registries.objects), formatLabel(firstResultId ?? '')));

  header.appendChild(row);

  const title = document.createElement('p');
  title.className = 'factory-card-title';
  title.textContent = formatLabel(firstResultId ?? '');
  header.appendChild(title);

  return header;
}

function renderIconBox(src, label) {
  const box = document.createElement('span');
  box.className = 'factory-card-icon-box';
  const img = document.createElement('img');
  img.src = src ?? '';
  img.alt = label ?? '';
  if (label) img.title = label;
  box.appendChild(img);
  return box;
}

// The recipe's own icon (the top-right badge) - same convention as
// recipeCard.js's renderRecipeIcon: most recipes share their in-game icon
// with their first result item, so that's the fallback; recipe.icon (an
// assets/recipe-icon/*.png name) only needs setting for the exceptions.
function recipeIconSrc(recipe, firstResultId, objects) {
  return recipe.icon
    ? `assets/recipe-icon/${recipe.icon}.png`
    : objects.get(firstResultId)?.icon ?? '';
}

function renderDivider() {
  const hr = document.createElement('div');
  hr.className = 'factory-card-divider';
  return hr;
}

function renderSection(label) {
  const section = document.createElement('div');
  section.className = 'factory-card-section';
  if (label) {
    const heading = document.createElement('p');
    heading.className = 'factory-card-section-label';
    heading.textContent = label;
    section.appendChild(heading);
  }
  return section;
}

// Icon row of every building that can run this recipe, highlighting the
// selected one. Rendered the same way regardless of how many options there
// are - even a single-option recipe (e.g. Oil Refinery) shows its one icon
// as a (no-op) button, so the section reads consistently across cards
// rather than switching layouts depending on whether there's a real
// choice. Only an actual absence of any known building falls back to a
// plain message.
function renderBuildingSection(line, registries, buildingChoice, { onSelectBuilding }) {
  const section = renderSection('Building');
  const options = getBuildingOptions(line.recipe, registries);
  const selected = getSelectedBuilding(options, buildingChoice, line.key);

  if (options.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'factory-card-empty';
    empty.textContent = 'No known building for this recipe.';
    section.appendChild(empty);
    return section;
  }

  const row = document.createElement('div');
  row.className = 'factory-building-row';
  for (const option of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'factory-building-option';
    if (option.building === selected) btn.classList.add('factory-building-option--active');
    btn.title = formatLabel(option.building);
    btn.setAttribute('aria-label', formatLabel(option.building));
    const img = document.createElement('img');
    img.src = registries.objects.get(option.building)?.icon ?? '';
    img.alt = '';
    btn.appendChild(img);
    btn.addEventListener('click', () => onSelectBuilding(line.key, option.building));
    row.appendChild(btn);
  }
  section.appendChild(row);
  return section;
}

// Current proliferation setting, click to re-edit. Editing a card's
// proliferation moves *every* contributing tree node onto the new
// mode/level (see factoryView.js) - it's a line-level control, not a
// single node's.
function renderProlifSection(line, openProlifCard, handlers) {
  const section = renderSection('Proliferation');
  const availableModes = PROLIF_MODES.filter((mode) => line.recipe.proliferation[mode.key]);

  if (availableModes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'factory-card-empty';
    empty.textContent = 'This recipe supports no proliferator effects.';
    section.appendChild(empty);
    return section;
  }

  const activeMode = line.mode && PROLIF_MODES.find((mode) => mode.key === line.mode);
  const isOpen = openProlifCard?.key === line.key;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'factory-card-prolif-toggle';
  if (activeMode) toggle.classList.add(`factory-card-prolif-toggle--${activeMode.tone}`);
  toggle.innerHTML = activeMode
    ? `${activeMode.icon}<span>${activeMode.label} (${levelLabel(line.level)})</span>`
    : `${PROLIF_NONE_ICON}<span>None - click to set</span>`;
  toggle.addEventListener('click', () => handlers.onToggleProlifMenu(line.key));
  section.appendChild(toggle);

  if (isOpen) {
    const menu = document.createElement('div');
    menu.className = 'factory-card-prolif-menu';
    menu.appendChild(renderProlifModeRow(openProlifCard, availableModes, {
      onSelectMode: (mode) => handlers.onSetProlifMode(line.key, mode),
      onSelectNone: () => handlers.onClearProliferation(line.key),
    }));
    menu.appendChild(renderProlifLevelRow(openProlifCard, {
      onSelectLevel: (level) => handlers.onSetProlifLevel(line.key, level),
    }));
    section.appendChild(menu);
  }

  return section;
}

// "×5 | ×4.23" - the rounded-up count you'd actually build (you can't
// build a fraction of a machine) alongside the exact figure it came from,
// same "rounded | exact" pairing convention as the resource sidebar's
// proliferator-usage rows (see proliteratorUsagePanel.js).
function renderMachinesSection(line) {
  const section = renderSection('Machines Needed');
  const value = document.createElement('p');
  value.className = 'factory-card-machines';

  if (Number.isFinite(line.machines)) {
    value.innerHTML = `×${Math.ceil(line.machines)}<span class="factory-card-machines-exact">| ×${formatQty(line.machines)}</span>`;
  } else {
    value.textContent = '—';
  }

  section.appendChild(value);
  return section;
}

function renderRatesSection(line, registries) {
  const wrap = document.createDocumentFragment();
  const { demand, output } = computeLineRates(line);

  wrap.appendChild(renderRateList('Demand', demand, registries, 'demand'));
  wrap.appendChild(renderRateList('Output', output, registries, 'output'));

  const section = document.createElement('div');
  section.appendChild(wrap);
  return section;
}

function renderRateList(label, entries, registries, kind) {
  const section = renderSection(label);
  const list = document.createElement('div');
  list.className = 'factory-rate-list';

  for (const { itemId, ratePerSec } of entries) {
    const row = document.createElement('div');
    row.className = `factory-rate-row factory-rate-row--${kind}`;

    const icon = document.createElement('img');
    icon.className = 'factory-rate-icon';
    icon.src = registries.objects.get(itemId)?.icon ?? '';
    icon.alt = '';
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'factory-rate-name';
    name.textContent = formatLabel(itemId);
    row.appendChild(name);

    const rate = document.createElement('span');
    rate.className = 'factory-rate-value';
    rate.textContent = `${formatQty(ratePerSec)}/s`;
    row.appendChild(rate);

    list.appendChild(row);
  }

  section.appendChild(list);
  return section;
}
