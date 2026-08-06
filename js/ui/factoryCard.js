import { formatLabel } from './format.js';
import { formatQty } from '../tree/formatQty.js';
import { PROLIF_NONE_ICON, RESET_ICON } from './icons.js';
import { PROLIF_MODES, renderProlifModeRow, renderProlifLevelRow, levelLabel } from '../tree/proliferationPicker.js';
import { getBuildingOptions, getSelectedBuilding, isExplicitBuildingChoice } from '../factory/buildingOptions.js';
import { computeLineRates } from '../factory/lineRates.js';
import { linePrimaryItemId } from '../factory/buildFactoryPlan.js';
import { renderBuildingIconRow } from './buildingPicker.js';

// A single Factory View card - one per (recipe, proliferation) line from
// buildFactoryPlan.js. Vertical, sectioned by dividers: building (icon +
// picker when there's more than one option), proliferation (current
// setting, click to re-edit), machines needed, then demand/output rates.
//
// handlers: { onSelectBuilding(lineKey, buildingId), onResetBuilding
// (lineKey), onToggleProlifMenu(lineKey), onSetProlifMode(lineKey, mode),
// onSetProlifLevel(lineKey, level), onClearProliferation(lineKey) } - all
// keyed by line.key since a prolif edit changes which line a card even
// belongs to (see factoryView.js). defaultBuildingByType is the sidebar's
// per-recipe-type picker (see defaultBuildingPanel.js) - the fallback a
// line uses when it has no explicit per-card override of its own.
export function renderFactoryCard(line, registries, buildingChoice, defaultBuildingByType, openProlifCard, handlers) {
  const card = document.createElement('div');
  card.className = 'factory-card';

  card.appendChild(renderIconHeader(line, registries, buildingChoice, defaultBuildingByType));
  card.appendChild(renderDivider());
  card.appendChild(renderBuildingSection(line, registries, buildingChoice, defaultBuildingByType, handlers));
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
function renderIconHeader(line, registries, buildingChoice, defaultBuildingByType) {
  const header = document.createElement('div');
  header.className = 'factory-card-icon-header';

  const row = document.createElement('div');
  row.className = 'factory-card-icon-row';

  const options = getBuildingOptions(line.recipe, registries);
  const selected = getSelectedBuilding(options, buildingChoice, line.key, defaultBuildingByType.get(line.recipe.type));
  const buildingSrc = selected ? registries.objects.get(selected)?.icon ?? '' : '';
  row.appendChild(renderIconBox(buildingSrc, selected ? formatLabel(selected) : ''));

  const arrow = document.createElement('span');
  arrow.className = 'factory-card-icon-arrow';
  arrow.textContent = '→';
  row.appendChild(arrow);

  const primaryItemId = linePrimaryItemId(line);
  row.appendChild(renderIconBox(recipeIconSrc(line.recipe, primaryItemId, registries.objects), formatLabel(primaryItemId ?? '')));

  header.appendChild(row);

  const title = document.createElement('p');
  title.className = 'factory-card-title';
  title.textContent = formatLabel(primaryItemId ?? '');
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
// with the item this card is for, so that's the fallback; recipe.icon (an
// assets/recipe-icon/*.png name) only needs setting for the exceptions.
function recipeIconSrc(recipe, primaryItemId, objects) {
  return recipe.icon
    ? `assets/recipe-icon/${recipe.icon}.png`
    : objects.get(primaryItemId)?.icon ?? '';
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
function renderBuildingSection(line, registries, buildingChoice, defaultBuildingByType, { onSelectBuilding, onResetBuilding }) {
  const section = renderSection('Building');
  const options = getBuildingOptions(line.recipe, registries);
  const selected = getSelectedBuilding(options, buildingChoice, line.key, defaultBuildingByType.get(line.recipe.type));

  if (options.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'factory-card-empty';
    empty.textContent = 'No known building for this recipe.';
    section.appendChild(empty);
    return section;
  }

  const explicit = isExplicitBuildingChoice(options, buildingChoice, line.key);
  const label = section.querySelector('.factory-card-section-label');

  if (!explicit) {
    // Flags a line still running on its auto-selected building (whether
    // that's the sidebar's per-type default or the plain options[0]
    // fallback) rather than one the user actually picked on *this* card -
    // most useful on multi-option recipes (a real reminder "you haven't
    // chosen yet"), but shown for single-option ones too since there's
    // nothing to pick there either.
    const badge = document.createElement('span');
    badge.className = 'factory-card-default-badge';
    badge.textContent = 'Default';
    badge.title = 'Using the default building - not manually chosen';
    label?.appendChild(badge);
  } else {
    // The mirror image of the badge above - once a card has its own
    // explicit pick, offer a one-click way back to whatever the default
    // would otherwise be, rather than making the user re-click through the
    // icon row themselves.
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'factory-card-reset-building';
    reset.title = 'Back to default building';
    reset.setAttribute('aria-label', 'Back to default building');
    reset.innerHTML = RESET_ICON;
    reset.addEventListener('click', () => onResetBuilding(line.key));
    label?.appendChild(reset);
  }

  section.appendChild(renderBuildingIconRow(options, selected, registries, (buildingId) => onSelectBuilding(line.key, buildingId)));
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
