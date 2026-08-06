import { formatLabel } from './format.js';
import { BACK_ICON, ZOOM_IN_ICON, ZOOM_OUT_ICON, FIT_VIEW_ICON, SHARE_ICON, CHECK_ICON, FACTORY_ICON } from './icons.js';
import { renderIconButton } from './metaBar.js';
import { buildTree } from '../tree/buildTree.js';
import { createTreeWorld, renderTreeInto } from '../tree/treeCanvas.js';
import { createPanZoom } from '../tree/panZoom.js';
import { serializeTreeState } from '../tree/serializeTree.js';
import { summarizeTree } from '../tree/summarizeTree.js';
import { summarizeProliferatorUsage } from '../tree/summarizeProliferators.js';
import { createResourceSidebar, renderResourcesInto } from '../tree/resourceSidebar.js';
import { reuseAvailability, injectReuseChoices, clampOverallocatedReuse } from '../tree/reusePool.js';
import { resolveCycleBoosts } from '../tree/cycleRecycle.js';

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
// onFactory: called with a { subjectId, recipe, choices, overrides,
// proliferation } snapshot of the current tree when the header's Factory
// View button is clicked - lets the caller switch views without this
// module knowing anything about view-switching itself.
export function renderTreeView(container, subjectId, recipe, registries, onBack, initialState, onFactory) {
  container.innerHTML = '';
  container.scrollTop = 0;

  const { body, fit, snapshot } = renderBody(subjectId, recipe, registries, initialState);
  container.appendChild(renderHeader(subjectId, onBack, () => onFactory(snapshot())));
  container.appendChild(body);

  // Only has real dimensions to fit against once attached to the document -
  // querying clientWidth/Height here forces the synchronous layout that
  // gives it those, no need to wait a frame.
  fit();
}

function renderHeader(subjectId, onBack, onFactory) {
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

  const factoryBtn = document.createElement('button');
  factoryBtn.type = 'button';
  factoryBtn.className = 'factory-view-btn';
  factoryBtn.innerHTML = `${FACTORY_ICON}<span>Factory View</span>`;
  factoryBtn.addEventListener('click', onFactory);

  header.append(backBtn, title, factoryBtn);
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
  // path -> amount manually reused from leftover instead of produced - see
  // buildTree.js's suppliedFromLeftover and the reuse hub below.
  const reuseOverrides = new Map(initialState?.reuseOverrides);
  // cyclePath -> amount manually recycled back from a cycle's own ancestor
  // output - see buildTree.js's recycledQty and the cycle node below.
  const recycleOverrides = new Map(initialState?.recycleOverrides);
  // Paths where the user explicitly declined to craft whatever reuse
  // doesn't cover, leaving it as raw external demand instead - see
  // buildTree.js's declinedRecipes/node.recipeDeclined and the declined
  // hub below.
  const declinedRecipes = new Set(initialState?.declinedRecipes);
  choices.set(subjectId, recipe.id);

  // Paths whose node has resolved to a recipe at least once - lets
  // applyDefaultProliferation tell "this node just came into existence"
  // apart from "this node has existed for a while and simply has no
  // proliferation set" (e.g. it was expanded before any default was
  // configured, or under an earlier default that didn't apply to it). Only
  // the former should ever get the default auto-applied - see below.
  const settledPaths = new Set();

  // Which node's proliferation picker is open, plus its in-progress
  // mode/level - null when none is. Only committed into `proliferation`
  // once both axes are set (see onSetProlifMode/onSetProlifLevel).
  let openProlifMenu = null;

  // Which node's reuse picker is open - null when none is. Independent of
  // openProlifMenu (either, both, or neither can be open at once) since
  // they're separate controls on the same hub.
  let openReuseMenu = null;

  // Which cycle node's recycle picker is open - null when none is.
  let openRecycleMenu = null;

  // Extra qty each ancestor path needs to produce, from every cycle node
  // currently recycling into it (see cycleRecycle.js) - recomputed each
  // rerender from whatever tree came out of *this* pass, then compared
  // against the previous pass below; only triggers another build when it
  // actually changed, same two-build shape as applyDefaultProliferation.
  let cycleBoosts = new Map();

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
    let tree = buildTree(subjectId, 1, registries, { choices, overrides, proliferation, reuseOverrides, recycleOverrides, qtyBoosts: cycleBoosts, declinedRecipes });
    if (applyDefaultProliferation(tree)) {
      // Defaults just got stamped onto newly-resolved nodes - rebuild so
      // any Extra Yield among them is reflected in *this* render's
      // quantities too, not just their badges (buildTree.js reads
      // `proliferation` while computing qty - see its yield handling).
      tree = buildTree(subjectId, 1, registries, { choices, overrides, proliferation, reuseOverrides, recycleOverrides, qtyBoosts: cycleBoosts, declinedRecipes });
    }
    // A cycle node's recycledQty (see buildTree.js) only tells its own
    // ancestor how much *more* to produce - it can't apply that growth to
    // itself mid-build, since the ancestor's qty is already fixed by the
    // time its descendant cycle node is reached, and growing it can grow
    // the very demand recycledQty was clamped against too (see
    // cycleRecycle.js) - iterates until that stops moving.
    ({ tree, boosts: cycleBoosts } = resolveCycleBoosts(
      (boosts) => buildTree(subjectId, 1, registries, { choices, overrides, proliferation, reuseOverrides, recycleOverrides, qtyBoosts: boosts, declinedRecipes }),
      tree,
      cycleBoosts,
    ));
    // A stale reuseOverrides entry (e.g. a share link written back when a
    // different choice elsewhere produced more of this item - see
    // reusePool.js's clampOverallocatedReuse) can claim more than the tree
    // actually backs; buildTree.js's own clamp only ever checks a claim
    // against its own node's qty, never the shared pool. Corrects the
    // stored amount itself (not just this render's number) so the picker
    // reopens showing the true, now-consistent value instead of a stale
    // one exceeding its own displayed "available."
    const reuseCorrections = clampOverallocatedReuse(tree);
    if (reuseCorrections.size > 0) {
      for (const [path, amount] of reuseCorrections) reuseOverrides.set(path, amount);
      tree = buildTree(subjectId, 1, registries, { choices, overrides, proliferation, reuseOverrides, recycleOverrides, qtyBoosts: cycleBoosts, declinedRecipes });
    }
    // Adds "Just reuse" as an option wherever a still-undecided recipe
    // choice has leftover to draw on - needs the *finished* tree (see
    // reusePool.js's injectReuseChoices for why), so this runs after both
    // possible builds above, right before rendering.
    injectReuseChoices(tree, registries);
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
      openReuseMenu,
      // Read against `tree` (this render's freshly built tree, closed over
      // here) rather than recomputed independently - see reusePool.js for
      // why excluding `path` itself matters.
      getReuseAvailability(itemId, path) {
        return reuseAvailability(tree, itemId, path);
      },
      onToggleReuseMenu(path) {
        openReuseMenu = openReuseMenu?.path === path ? null : { path };
        rerender();
      },
      onApplyReuse(path, amount) {
        if (amount > 0) {
          reuseOverrides.set(path, amount);
        } else {
          reuseOverrides.delete(path);
        }
        openReuseMenu = null;
        rerender();
      },
      onClearReuse(path) {
        reuseOverrides.delete(path);
        openReuseMenu = null;
        rerender();
      },
      onDeclineRecipe(path) {
        declinedRecipes.add(path);
        rerender();
      },
      onUndeclineRecipe(path) {
        declinedRecipes.delete(path);
        rerender();
      },
      openRecycleMenu,
      onToggleRecycleMenu(path) {
        openRecycleMenu = openRecycleMenu?.path === path ? null : { path };
        rerender();
      },
      onApplyRecycle(path, amount) {
        if (amount > 0) {
          recycleOverrides.set(path, amount);
        } else {
          recycleOverrides.delete(path);
        }
        openRecycleMenu = null;
        rerender();
      },
      onClearRecycle(path) {
        recycleOverrides.delete(path);
        openRecycleMenu = null;
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

  // Stamps the current default (if any) onto a node the *first* time it
  // ever resolves to a recipe - i.e. a genuinely new node, whether that's
  // this tree's initial expand, a node just expanded past its collapsed
  // state, or a choice just picked. Uses settledPaths rather than just
  // "no proliferation entry yet" so a node someone deliberately left
  // unset doesn't get the default retroactively stamped onto it the next
  // time the default changes or the tree simply rerenders. Silently does
  // nothing (settled either way) when the recipe can't support the
  // default's mode, rather than forcing an unsupported effect onto it.
  // Returns whether it actually stamped anything, so rerender() knows to
  // rebuild the tree - buildTree.js reads `proliferation` while computing
  // quantities (Extra Yield), so a freshly-applied default needs a second
  // pass to show up there too, not just on the node's badge.
  function applyDefaultProliferation(node) {
    if (!node) return false;
    let changed = false;
    if (node.recipe && !settledPaths.has(node.path)) {
      settledPaths.add(node.path);
      if (!proliferation.has(node.path) && defaultProlif.mode && defaultProlif.level
        && node.recipe.proliferation[defaultProlif.mode]) {
        proliferation.set(node.path, { mode: defaultProlif.mode, level: defaultProlif.level });
        changed = true;
      }
    }
    for (const child of node.children) {
      if (applyDefaultProliferation(child)) changed = true;
    }
    return changed;
  }

  // Only actually applies once both a mode and a level are chosen (in
  // either order) - the menu stays open either way, so partial picks just
  // sit there highlighted until completed.
  function commitProlif(path) {
    if (openProlifMenu?.mode && openProlifMenu?.level) {
      proliferation.set(path, { mode: openProlifMenu.mode, level: openProlifMenu.level });
    }
  }

  // Closes the proliferation/reuse popovers on a click anywhere outside
  // them - the badges and the menus' own contents already stop their
  // clicks from bubbling this far (see treeNode.js), so this only ever
  // sees genuine "elsewhere" clicks.
  function onDocumentClick(event) {
    let changed = false;
    if (openProlifMenu && !event.target.closest('.tree-node-prolif-menu, .tree-node-prolif')) {
      openProlifMenu = null;
      changed = true;
    }
    if (openReuseMenu && !event.target.closest('.tree-node-reuse-menu, .tree-node-reuse, .tree-node--reuse-choice')) {
      openReuseMenu = null;
      changed = true;
    }
    if (openRecycleMenu && !event.target.closest('.tree-node-recycle-menu, .tree-node-recycle')) {
      openRecycleMenu = null;
      changed = true;
    }
    if (changed) rerender();
  }
  document.addEventListener('click', onDocumentClick);
  detachOutsideClick = () => document.removeEventListener('click', onDocumentClick);

  rerender();

  const fit = () => panZoom.fitToView(size.width, size.height);
  const shareUrl = () => buildShareUrl(subjectId, recipe.id, choices, overrides, proliferation, reuseOverrides, recycleOverrides, declinedRecipes);
  canvas.appendChild(renderToolbar(panZoom, fit, shareUrl));

  // Snapshot of the live choice/override/proliferation/reuse/recycle/
  // declined maps, for handing off to Factory View (or restoring back into
  // a fresh tree view) without sharing mutable references into this
  // closure.
  const snapshot = () => ({
    subjectId,
    recipe,
    choices: new Map(choices),
    overrides: new Map(overrides),
    proliferation: new Map(proliferation),
    reuseOverrides: new Map(reuseOverrides),
    recycleOverrides: new Map(recycleOverrides),
    declinedRecipes: new Set(declinedRecipes),
  });

  body.append(canvas, resources);
  return { body, fit, snapshot };
}

function buildShareUrl(subjectId, recipeId, choices, overrides, proliferation, reuseOverrides, recycleOverrides, declinedRecipes) {
  const code = serializeTreeState({ subjectId, recipeId, choices, overrides, proliferation, reuseOverrides, recycleOverrides, declinedRecipes });
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
