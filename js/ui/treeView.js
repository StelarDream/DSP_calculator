import { formatLabel } from './format.js';
import { BACK_ICON, ZOOM_IN_ICON, ZOOM_OUT_ICON, FIT_VIEW_ICON, SHARE_ICON, CHECK_ICON } from './icons.js';
import { renderIconButton } from './metaBar.js';
import { buildTree } from '../tree/buildTree.js';
import { createTreeWorld, renderTreeInto } from '../tree/treeCanvas.js';
import { createPanZoom } from '../tree/panZoom.js';
import { serializeTreeState } from '../tree/serializeTree.js';
import { summarizeTree } from '../tree/summarizeTree.js';
import { createResourceSidebar, renderResourcesInto } from '../tree/resourceSidebar.js';

// Full-pane recipe-tree view, swapped in over the normal detail pane when a
// recipe card's tree button is clicked (or a shared link is opened).
// subjectId: the object whose page the recipe card was on (still highlighted
// in the sidebar) - used for the title instead of guessing from the recipe's
// result, which can list multiple/unrelated items (e.g. byproducts). Also
// seeds the root's recipe choice, so the tree honors *which* recipe card
// was clicked rather than always defaulting to the first one found.
// initialState: { choices, overrides } to seed the tree with instead of
// starting fresh - how a shared link restores its exact state.
export function renderTreeView(container, subjectId, recipe, registries, onBack, initialState) {
  container.innerHTML = '';
  container.scrollTop = 0;

  const { body, fit } = renderBody(subjectId, recipe, registries, initialState);
  container.appendChild(renderHeader(subjectId, onBack));
  container.appendChild(body);

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

function renderBody(subjectId, recipe, registries, initialState) {
  const body = document.createElement('div');
  body.className = 'tree-view-body';

  const canvas = document.createElement('div');
  canvas.className = 'tree-view-canvas blueprint-grid';

  const resources = createResourceSidebar();

  // Local to this tree view session - which recipe each node uses and
  // which nodes have been manually expanded/collapsed, overriding the
  // default-depth rule. Seeded from a shared link when there is one,
  // otherwise starts fresh with just the root's recipe (the one the tree
  // button was clicked from).
  const choices = new Map(initialState?.choices);
  const overrides = new Map(initialState?.overrides);
  choices.set(subjectId, recipe.id);

  const world = createTreeWorld();
  canvas.appendChild(world);
  const panZoom = createPanZoom(canvas, world);

  // Rebuilds the tree from current choices/overrides and repopulates the
  // existing world element (and the resource totals) in place, so the
  // pan/zoom transform survives.
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
      onEdit(path) {
        choices.delete(path);
        rerender();
      },
    });
    renderResourcesInto(resources, summarizeTree(tree));
  }
  rerender();

  const fit = () => panZoom.fitToView(size.width, size.height);
  const shareUrl = () => buildShareUrl(subjectId, recipe.id, choices, overrides);
  canvas.appendChild(renderToolbar(panZoom, fit, shareUrl));

  body.append(canvas, resources);
  return { body, fit };
}

function buildShareUrl(subjectId, recipeId, choices, overrides) {
  const code = serializeTreeState({ subjectId, recipeId, choices, overrides });
  const url = new URL(window.location.href);
  // Only ever touches `tree` - any other params (present now or added by
  // future features) are left exactly as they are.
  url.searchParams.set('tree', code);
  return url.toString();
}

function renderToolbar(panZoom, fit, shareUrl) {
  const toolbar = document.createElement('div');
  toolbar.className = 'tree-toolbar';
  toolbar.append(
    renderIconButton(ZOOM_IN_ICON, 'Zoom in', () => panZoom.zoomIn()),
    renderIconButton(ZOOM_OUT_ICON, 'Zoom out', () => panZoom.zoomOut()),
    renderIconButton(FIT_VIEW_ICON, 'Fit to view', fit),
    renderShareButton(shareUrl),
  );
  return toolbar;
}

function renderShareButton(shareUrl) {
  const label = 'Copy shareable link';
  const button = renderIconButton(SHARE_ICON, label, async () => {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be blocked (permissions, insecure context) - fall
      // back to a prompt so the link is still obtainable by hand.
      window.prompt('Copy this link:', url);
    }
    flashCopied(button, label);
  });
  return button;
}

// Briefly swaps the button to a checkmark so a click has visible feedback,
// then reverts - the only signal a clipboard write otherwise gives.
function flashCopied(button, label) {
  button.innerHTML = CHECK_ICON;
  button.classList.add('icon-btn--confirm');
  button.title = 'Copied!';
  button.setAttribute('aria-label', 'Copied!');

  setTimeout(() => {
    button.innerHTML = SHARE_ICON;
    button.classList.remove('icon-btn--confirm');
    button.title = label;
    button.setAttribute('aria-label', label);
  }, 1500);
}
