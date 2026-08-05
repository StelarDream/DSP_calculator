import { formatLabel } from './format.js';
import { BACK_ICON, ZOOM_IN_ICON, ZOOM_OUT_ICON, FIT_VIEW_ICON, SHARE_ICON, CHECK_ICON } from './icons.js';
import { renderIconButton } from './metaBar.js';
import { buildTree } from '../tree/buildTree.js';
import { createTreeWorld, renderTreeInto } from '../tree/treeCanvas.js';
import { createPanZoom } from '../tree/panZoom.js';
import { serializeTreeState } from '../tree/serializeTree.js';
import { summarizeTree } from '../tree/summarizeTree.js';
import { summarizeProliferatorUsage } from '../tree/summarizeProliferators.js';
import { createResourceSidebar, renderResourcesInto } from '../tree/resourceSidebar.js';

// Ensures at most one "close the proliferation menu on an outside click"
// listener is ever attached to document - it doesn't get garbage-collected
// just because a later renderTreeView call replaced the tree view's own
// DOM, so each call must detach the previous one before adding its own.
let detachOutsideClick = null;

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
  detachOutsideClick?.();

  const body = document.createElement('div');
  body.className = 'tree-view-body';

  const canvas = document.createElement('div');
  canvas.className = 'tree-view-canvas blueprint-grid';

  const resources = createResourceSidebar();

  // Local to this tree view session - which recipe each node uses, which
  // nodes have been manually expanded/collapsed (overriding the
  // default-depth rule), and any proliferation applied per node. Seeded
  // from a shared link when there is one, otherwise starts fresh with just
  // the root's recipe (the one the tree button was clicked from).
  const choices = new Map(initialState?.choices);
  const overrides = new Map(initialState?.overrides);
  const proliferation = new Map(initialState?.proliferation);
  choices.set(subjectId, recipe.id);

  // Which node's proliferation picker is open, plus its in-progress
  // mode/level - null when none is. Only committed into `proliferation`
  // once both axes are set (see onSetProlifMode/onSetProlifLevel).
  let openProlifMenu = null;

  // The tree-wide default from the sidebar's "Default Proliferation" panel
  // - stamped onto newly-resolved nodes by applyDefaultProliferation below.
  // Session-local like everything else here; not seeded from a shared link.
  let defaultProlif = { mode: null, level: null };

  const world = createTreeWorld();
  canvas.appendChild(world);
  const panZoom = createPanZoom(canvas, world);

  // Rebuilds the tree from current choices/overrides and repopulates the
  // existing world element (and the resource totals) in place, so the
  // pan/zoom transform survives.
  let size;
  function rerender() {
    const tree = buildTree(subjectId, 1, registries, { choices, overrides });
    applyDefaultProliferation(tree);
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
      proliferation,
      openProlifMenu,
      onToggleProlifMenu(path) {
        if (openProlifMenu?.path === path) {
          openProlifMenu = null;
        } else {
          const existing = proliferation.get(path);
          openProlifMenu = { path, mode: existing?.mode ?? null, level: existing?.level ?? null };
        }
        rerender();
      },
      onSetProlifMode(path, mode) {
        if (openProlifMenu?.path !== path) return;
        openProlifMenu = { ...openProlifMenu, mode };
        commitProlif(path);
        rerender();
      },
      onSetProlifLevel(path, level) {
        if (openProlifMenu?.path !== path) return;
        openProlifMenu = { ...openProlifMenu, level };
        commitProlif(path);
        rerender();
      },
      onClearProliferation(path) {
        // An explicit { mode: null, level: null } rather than a delete -
        // marks the node as deliberately opted out, distinct from a node
        // that's simply never been touched, so applyDefaultProliferation
        // below doesn't turn right around and reapply the default to it.
        proliferation.set(path, { mode: null, level: null });
        openProlifMenu = null;
        rerender();
      },
    });
    renderResourcesInto(resources, summarizeTree(tree), summarizeProliferatorUsage(tree, proliferation), defaultProlif, {
      onSetMode(mode) {
        defaultProlif = { ...defaultProlif, mode };
        rerender();
      },
      onSetLevel(level) {
        defaultProlif = { ...defaultProlif, level };
        rerender();
      },
      onClear() {
        defaultProlif = { mode: null, level: null };
        rerender();
      },
    });
  }

  // Stamps the current default (if any) onto every node that resolves to a
  // recipe and doesn't already have its own proliferation entry - covers
  // both nodes that just appeared (freshly expanded, or a choice just
  // picked) and nodes left unset from before the default was configured.
  // Explicit per-node choices (including an explicit "None") always win,
  // since those already have an entry in `proliferation`. Silently does
  // nothing for a node whose recipe can't support the default's mode - it
  // stays unset rather than being forced onto an unsupported effect, and
  // stays eligible to pick up the default later if its recipe changes.
  function applyDefaultProliferation(node) {
    if (!node) return;
    if (node.recipe && !proliferation.has(node.path) && defaultProlif.mode && defaultProlif.level
      && node.recipe.proliferation[defaultProlif.mode]) {
      proliferation.set(node.path, { mode: defaultProlif.mode, level: defaultProlif.level });
    }
    for (const child of node.children) applyDefaultProliferation(child);
  }

  // Only actually applies once both a mode and a level are chosen (in
  // either order) - the menu stays open either way, so partial picks just
  // sit there highlighted until completed.
  function commitProlif(path) {
    if (openProlifMenu?.mode && openProlifMenu?.level) {
      proliferation.set(path, { mode: openProlifMenu.mode, level: openProlifMenu.level });
    }
  }

  // Closes the proliferation menu on a click anywhere outside it - the
  // badge and the menu's own contents already stop their clicks from
  // bubbling this far (see treeNode.js), so this only ever sees genuine
  // "elsewhere" clicks.
  function onDocumentClick(event) {
    if (!openProlifMenu) return;
    if (event.target.closest('.tree-node-prolif-menu, .tree-node-prolif')) return;
    openProlifMenu = null;
    rerender();
  }
  document.addEventListener('click', onDocumentClick);
  detachOutsideClick = () => document.removeEventListener('click', onDocumentClick);

  rerender();

  const fit = () => panZoom.fitToView(size.width, size.height);
  const shareUrl = () => buildShareUrl(subjectId, recipe.id, choices, overrides, proliferation);
  canvas.appendChild(renderToolbar(panZoom, fit, shareUrl));

  body.append(canvas, resources);
  return { body, fit };
}

function buildShareUrl(subjectId, recipeId, choices, overrides, proliferation) {
  const code = serializeTreeState({ subjectId, recipeId, choices, overrides, proliferation });
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
