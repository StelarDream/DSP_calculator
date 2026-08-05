import { formatLabel } from './format.js';
import { renderEntityRow } from './entityRow.js';
import { renderMetaBar, renderStat, renderIconRow, renderIconButton, svgIcon, imgIcon } from './metaBar.js';
import { renderProliferationGroup } from './proliferation.js';
import { CLOCK_ICON, TREE_ICON } from './icons.js';

// onGenerateTree: called with the recipe when the tree button is clicked -
// placeholder hook for the recipe-tree generator, wired up by the caller.
export function renderRecipeCard(recipe, registries, onSelect, onGenerateTree) {
  const card = document.createElement('div');
  card.className = 'recipe-card';
  card.appendChild(renderHeader(recipe, registries, onSelect, onGenerateTree));
  card.appendChild(renderGrid(recipe, registries.objects, onSelect));
  return card;
}

function renderHeader(recipe, registries, onSelect, onGenerateTree) {
  const header = document.createElement('div');
  header.className = 'recipe-card-header';
  header.appendChild(renderMeta(recipe, registries, onSelect));

  if (typeof onGenerateTree === 'function') {
    header.appendChild(renderIconButton(TREE_ICON, 'Generate recipe tree', () => onGenerateTree(recipe)));
  }

  return header;
}

function renderMeta(recipe, registries, onSelect) {
  const left = [renderRecipeIcon(recipe, registries.objects)];
  // Time is only shown when it differs from the default (0s) - see
  // js/data/recipes.js for where that default comes from.
  if (recipe.time !== 0) left.push(renderStat(svgIcon(CLOCK_ICON), `${recipe.time}s`));

  const proliferation = renderProliferationGroup(recipe.proliferation);
  if (proliferation) left.push(proliferation);

  const right = [];
  // Flagged rather than the (now more common) positive case, since most
  // recipes can be hand-crafted - only the exceptions need calling out.
  if (!recipe.replicator) {
    const warning = renderStat(null, "Can't make with Replicator");
    warning.classList.add('meta-stat--danger');
    right.push(warning);
  }
  right.push(renderStat(imgIcon(`assets/recipe-types/${recipe.type}.png`, recipe.type), formatLabel(recipe.type)));

  const builtIn = registries.factories.byRecipeType.get(recipe.type) ?? [];
  if (builtIn.length) {
    right.push(renderIconRow(builtIn.map((entry) => ({
      icon: registries.objects.get(entry.building)?.icon,
      label: formatLabel(entry.building),
      onClick: onSelect ? () => onSelect(entry.building) : undefined,
    }))));
  }

  return renderMetaBar(left, right);
}

// The recipe's own icon, boxed to read as a small thumbnail distinct from
// the plain svg/img stats next to it. Most recipes share their in-game icon
// with their first result item, so that's the fallback; `recipe.icon` (an
// assets/recipe-icon/*.png name) only needs setting for the exceptions.
function renderRecipeIcon(recipe, objects) {
  const firstResultId = Object.keys(recipe.result)[0];
  const src = recipe.icon
    ? `assets/recipe-icon/${recipe.icon}.png`
    : objects.get(firstResultId)?.icon ?? '';

  const box = document.createElement('span');
  box.className = 'recipe-icon-box';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  box.appendChild(img);
  return box;
}

function renderGrid(recipe, objects, onSelect) {
  const grid = document.createElement('div');
  grid.className = 'recipe-grid';

  grid.appendChild(renderSide('Ingredients', recipe.ingredients, objects, onSelect));

  const arrow = document.createElement('div');
  arrow.className = 'recipe-arrow';
  arrow.textContent = '→';
  grid.appendChild(arrow);

  grid.appendChild(renderSide('Result', recipe.result, objects, onSelect));

  return grid;
}

function renderSide(label, entries, objects, onSelect) {
  const side = document.createElement('div');
  side.className = 'recipe-side';

  const heading = document.createElement('p');
  heading.className = 'recipe-side-label';
  heading.textContent = label;
  side.appendChild(heading);

  for (const [id, qty] of Object.entries(entries)) {
    side.appendChild(renderEntityRow({ id, entity: objects.get(id), label: formatLabel(id), qty, onSelect }));
  }

  return side;
}

