import { formatLabel } from './format.js';
import { renderBuildingIconRow } from './buildingPicker.js';
import { getBuildingOptions } from '../factory/buildingOptions.js';

// "Default Buildings" settings panel, pinned in Factory View's sidebar -
// same convention as the tree view's own "Default Proliferation" panel
// (see defaultProliferationPanel.js): always visible rather than a
// popover, one row per *recipe type* currently present among the compiled
// lines. Whichever building is picked here becomes the fallback any line
// of that type uses when its own card hasn't been explicitly overridden
// (see buildingOptions.js's getSelectedBuilding).
//
// Only offered for types with an actual choice to make - a type whose
// recipes only ever have one known building has nothing to pick, so it's
// left out entirely rather than shown as a disabled/pointless row.
export function renderDefaultBuildingSection(lines, registries, defaultBuildingByType, onSetDefault) {
  const types = collectTypesWithChoices(lines, registries);
  if (types.size === 0) return null;

  const section = document.createElement('div');
  section.className = 'tree-resources-section';

  const heading = document.createElement('h3');
  heading.className = 'tree-resources-title';
  heading.textContent = 'Default Buildings';
  section.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'tree-resources-empty';
  hint.textContent = "Used by any line of that type without its own building choice.";
  section.appendChild(hint);

  for (const [type, options] of types) {
    section.appendChild(renderTypeRow(type, options, registries, defaultBuildingByType, onSetDefault));
  }

  return section;
}

// One entry per distinct recipe type among the current lines that has
// more than one building option - first-seen order, same as the lines
// themselves (buildFactoryPlan.js sorts by crafts descending).
function collectTypesWithChoices(lines, registries) {
  const types = new Map(); // recipeType -> options
  for (const line of lines) {
    if (types.has(line.recipe.type)) continue;
    const options = getBuildingOptions(line.recipe, registries);
    if (options.length > 1) types.set(line.recipe.type, options);
  }
  return types;
}

function renderTypeRow(type, options, registries, defaultBuildingByType, onSetDefault) {
  const wrap = document.createElement('div');
  wrap.className = 'factory-default-building-row';

  const label = document.createElement('p');
  label.className = 'factory-card-section-label';
  label.textContent = formatLabel(type);
  wrap.appendChild(label);

  const selected = defaultBuildingByType.get(type) ?? options[0]?.building ?? null;
  wrap.appendChild(renderBuildingIconRow(options, selected, registries, (buildingId) => onSetDefault(type, buildingId)));

  return wrap;
}
