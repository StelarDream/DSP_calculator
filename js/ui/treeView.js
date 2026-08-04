import { formatLabel } from './format.js';
import { BACK_ICON, ZOOM_IN_ICON, ZOOM_OUT_ICON, FIT_VIEW_ICON } from './icons.js';
import { renderIconButton } from './metaBar.js';
import { buildTree } from '../tree/buildTree.js';
import { createTreeWorld, renderTreeInto } from '../tree/treeCanvas.js';
import { createPanZoom } from '../tree/panZoom.js';

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

  const { canvas, fit } = renderCanvas(subjectId, recipe, registries);
  container.appendChild(renderHeader(subjectId, onBack));
  container.appendChild(canvas);

  // Only has real dimensions to fit against once attached to the document -
  // querying clientWidth/Height here forces the synchronous layout that
  // gives it those, no need to wait a frame.
  fit();
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

  // Local to this tree view session - which recipe each node uses (seeded
  // with the recipe the tree button was clicked from) and which nodes have
  // been manually expanded/collapsed, overriding the default-depth rule.
  const choices = new Map([[subjectId, recipe.id]]);
  const overrides = new Map();

  const world = createTreeWorld();
  canvas.appendChild(world);
  const panZoom = createPanZoom(canvas, world);

  // Rebuilds the tree from current choices/overrides and repopulates the
  // existing world element in place, so the pan/zoom transform survives.
  let size;
  function rerender() {
    const tree = buildTree(subjectId, 1, registries, { choices, overrides });
    size = renderTreeInto(world, tree, {
      onToggle(path, wasCollapsed) {
        overrides.set(path, wasCollapsed);
        rerender();
      },
      onChoose(path, recipeId) {
        choices.set(path, recipeId);
        rerender();
      },
    });
  }
  rerender();

  const fit = () => panZoom.fitToView(size.width, size.height);
  canvas.appendChild(renderToolbar(panZoom, fit));

  return { canvas, fit };
}

function renderToolbar(panZoom, fit) {
  const toolbar = document.createElement('div');
  toolbar.className = 'tree-toolbar';
  toolbar.append(
    renderIconButton(ZOOM_IN_ICON, 'Zoom in', () => panZoom.zoomIn()),
    renderIconButton(ZOOM_OUT_ICON, 'Zoom out', () => panZoom.zoomOut()),
    renderIconButton(FIT_VIEW_ICON, 'Fit to view', fit),
  );
  return toolbar;
}
