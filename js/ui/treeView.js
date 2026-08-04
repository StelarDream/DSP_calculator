import { formatLabel } from './format.js';
import { BACK_ICON } from './icons.js';

// Full-pane recipe-tree view, swapped in over the normal detail pane when a
// recipe card's tree button is clicked. Tree generation itself isn't built
// yet - this just establishes the view and its way back out.
export function renderTreeView(container, recipe, registries, onBack) {
  container.innerHTML = '';
  container.scrollTop = 0;

  container.appendChild(renderHeader(recipe, registries, onBack));
  container.appendChild(renderCanvas());
}

function renderHeader(recipe, registries, onBack) {
  const header = document.createElement('div');
  header.className = 'tree-view-header';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'back-btn';
  backBtn.innerHTML = `${BACK_ICON}<span>Back</span>`;
  backBtn.addEventListener('click', onBack);

  const resultId = Object.keys(recipe.result)[0];
  const title = document.createElement('h2');
  title.className = 'tree-view-title';
  title.textContent = `Recipe Tree — ${formatLabel(resultId ?? '')}`;

  header.append(backBtn, title);
  return header;
}

function renderCanvas() {
  const canvas = document.createElement('div');
  canvas.className = 'tree-view-canvas blueprint-grid';

  const placeholder = document.createElement('p');
  placeholder.textContent = 'Tree generation coming soon.';
  canvas.appendChild(placeholder);

  return canvas;
}
