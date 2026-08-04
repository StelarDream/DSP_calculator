import { formatLabel } from './format.js';

export function renderList(container, entities, activeId, onSelect) {
  container.innerHTML = '';

  if (entities.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'list-empty';
    empty.textContent = 'No results.';
    container.appendChild(empty);
    return;
  }

  for (const entity of entities) {
    const button = document.createElement('button');
    button.className = 'entity-item' + (entity.id === activeId ? ' active' : '');
    button.dataset.id = entity.id;

    const icon = document.createElement('img');
    icon.className = 'entity-item__icon';
    icon.src = entity.icon;
    icon.alt = '';
    icon.loading = 'lazy';

    const name = document.createElement('span');
    name.className = 'entity-item__name';
    name.textContent = formatLabel(entity.id);

    button.append(icon, name);
    button.addEventListener('click', () => onSelect(entity.id));
    container.appendChild(button);
  }
}
