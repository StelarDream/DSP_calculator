import { formatLabel } from './format.js';
import { BACK_ICON } from './icons.js';
import { buildTree } from '../tree/buildTree.js';
import { renderTreeCanvas } from '../tree/treeCanvas.js';

// Full-pane recipe-tree view, swapped in over the normal detail pane when a
// recipe card's tree button is clicked.
// subjectId: the object whose page the recipe card was on (still highlighted
// in the sidebar) - used for the title instead of guessing from the recipe's
// result, which can list multiple/unrelated items (e.g. byproducts). Also
// seeds the root's recipe choice, so the tree honors *which* recipe card
// was clicked rather than always defaulting to the first one found.
export function renderTreeView(container, subjectId, recipe, registries, onBack) {
  container.innerHTML = '';
  container.scrollTop = 0;

  container.appendChild(renderHeader(subjectId, onBack));
  container.appendChild(renderCanvas(subjectId, recipe, registries));
}

function renderHeader(subjectId, onBack) {
  const header = document.createElement('div');
  header.className = 'tree-view-header';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'back-btn';
  backBtn.innerHTML = `${BACK_ICON}<span>Back</span>`;
  backBtn.addEventListener('click', onBack);

  const title = document.createElement('h2');
  title.className = 'tree-view-title';
  title.textContent = `Recipe Tree — ${formatLabel(subjectId ?? '')}`;

  header.append(backBtn, title);
  return header;
}

function renderCanvas(subjectId, recipe, registries) {
  const canvas = document.createElement('div');
  canvas.className = 'tree-view-canvas blueprint-grid';

  const choices = new Map([[subjectId, recipe.id]]);
  const tree = buildTree(subjectId, 1, registries, { choices });
  canvas.appendChild(renderTreeCanvas(tree));

  return canvas;
}
