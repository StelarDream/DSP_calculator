import { formatLabel } from './format.js';
import { renderRecipeCard } from './recipeCard.js';
import { renderCollectableCard } from './collectableCard.js';

export function renderDetail(container, object, registries) {
  container.innerHTML = '';

  if (!object) {
    container.appendChild(renderEmptyState());
    return;
  }

  container.appendChild(renderHeader(object));

  const description = document.createElement('p');
  description.className = 'detail-description';
  description.textContent = object.description ?? 'No description available.';
  container.appendChild(description);

  if (object.tags.has('craftable')) {
    const recipes = registries.recipes.byResultItem.get(object.id) ?? [];
    const cards = recipes.map((recipe) => renderRecipeCard(recipe, registries));
    container.appendChild(renderSection('Crafting Recipes', cards));
  }

  if (object.tags.has('collectable')) {
    const collectables = registries.collectables.collectables.filter((c) => c.result === object.id);
    const cards = collectables.map((collectable) => renderCollectableCard(collectable, registries));
    container.appendChild(renderSection('Collection Methods', cards));
  }
}

function renderHeader(object) {
  const header = document.createElement('div');
  header.className = 'detail-header';

  const icon = document.createElement('img');
  icon.className = 'detail-icon';
  icon.src = object.icon;
  icon.alt = '';

  const heading = document.createElement('div');
  heading.className = 'detail-heading';

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = formatLabel(object.id);
  heading.appendChild(title);

  const badges = document.createElement('div');
  badges.className = 'detail-badges';
  if (object.tags.has('collectable')) badges.appendChild(renderBadge('Collectable', 'collectable'));
  if (object.tags.has('craftable')) badges.appendChild(renderBadge('Craftable', 'craftable'));
  if (badges.childElementCount > 0) heading.appendChild(badges);

  header.append(icon, heading);
  return header;
}

function renderBadge(label, kind) {
  const badge = document.createElement('span');
  badge.className = 'detail-badge';
  badge.dataset.kind = kind;
  badge.textContent = label;
  return badge;
}

function renderSection(title, cards) {
  const section = document.createElement('section');
  section.className = 'detail-section';

  const heading = document.createElement('h3');
  heading.className = 'detail-section-title';
  heading.textContent = title;
  section.appendChild(heading);

  if (cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'list-empty';
    empty.textContent = 'None found.';
    section.appendChild(empty);
  } else {
    for (const card of cards) section.appendChild(card);
  }

  return section;
}

function renderEmptyState() {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';

  const p = document.createElement('p');
  p.textContent = 'Select an item or building on the left to see its recipe.';
  wrap.appendChild(p);

  return wrap;
}
