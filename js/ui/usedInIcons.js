import { formatLabel } from './format.js';

// Condensed "Used In" view: icon + name for each distinct item these
// recipes craft (not full recipe cards). Clickable when onSelect is given,
// navigating to that item's own page.
export function renderUsedInIcons(recipes, objects, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'used-in-list';

  const seen = new Set();
  for (const recipe of recipes) {
    for (const resultId of Object.keys(recipe.result)) {
      if (seen.has(resultId)) continue;
      seen.add(resultId);
      wrap.appendChild(renderUsedInItem(resultId, objects.get(resultId), onSelect));
    }
  }

  return wrap;
}

function renderUsedInItem(id, entity, onSelect) {
  const clickable = typeof onSelect === 'function';
  const item = document.createElement(clickable ? 'button' : 'span');
  item.className = 'used-in-item';

  if (clickable) {
    item.type = 'button';
    item.addEventListener('click', () => onSelect(id));
  }

  const icon = document.createElement('img');
  icon.className = 'used-in-icon';
  icon.src = entity?.icon ?? '';
  icon.alt = '';

  const name = document.createElement('span');
  name.className = 'used-in-name';
  name.textContent = formatLabel(id);

  item.append(icon, name);
  return item;
}
