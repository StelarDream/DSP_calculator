import { loadRegistries } from './data/index.js';
import { state } from './state.js';
import { initTabs } from './ui/tabs.js';
import { renderFilters } from './ui/filters.js';
import { renderList } from './ui/list.js';
import { renderDetail } from './ui/detail.js';
import { renderTreeView } from './ui/treeView.js';
import { deserializeTreeState } from './tree/serializeTree.js';
import { selectEntities } from './selectEntities.js';

export async function init() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const filtersContainer = document.getElementById('filters');
  const listContainer = document.getElementById('entity-list');
  const detailContainer = document.getElementById('detail');
  const searchInput = document.getElementById('search');

  function updateFilters() {
    renderFilters(filtersContainer, state.tab, state.filter, (key) => {
      state.filter = key;
      updateFilters();
      updateList();
    });
  }

  function updateList() {
    const entities = selectEntities(state, state.registries);
    renderList(listContainer, entities, state.selectedId, selectObject);
  }

  function updateDetail() {
    if (state.view === 'tree' && state.treeRecipe) {
      renderTreeView(detailContainer, state.selectedId, state.treeRecipe, state.registries, exitTreeView, state.treeInitialState);
      return;
    }

    const object = state.selectedId ? state.registries?.objects.get(state.selectedId) : null;
    renderDetail(detailContainer, object ?? null, state.registries, selectObject, generateTree);
  }

  // Wired up to the tree button on each recipe card.
  function generateTree(recipe) {
    state.view = 'tree';
    state.treeRecipe = recipe;
    state.treeInitialState = null;
    updateDetail();
  }

  function exitTreeView() {
    state.view = 'detail';
    state.treeRecipe = null;
    state.treeInitialState = null;
    updateDetail();
  }

  // Shows another object's page - used for list clicks as well as clicking
  // an ingredient/result/"used in"/source reference. Deliberately doesn't
  // touch the active tab/filter/search, even if the target belongs to a
  // different tab - only the detail pane (and the list's active highlight)
  // follows the selection.
  function selectObject(id) {
    if (!state.registries?.objects.has(id)) return;
    state.selectedId = id;
    state.view = 'detail';
    state.treeRecipe = null;
    state.treeInitialState = null;
    updateList();
    updateDetail();
  }

  initTabs(tabButtons, (tab) => {
    state.tab = tab;
    state.filter = 'all';
    state.selectedId = null;
    state.view = 'detail';
    state.treeRecipe = null;
    state.treeInitialState = null;
    updateFilters();
    updateList();
    updateDetail();
  });

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    updateList();
  });

  updateFilters();

  state.registries = await loadRegistries();

  restoreSharedTree();
  updateList();
  updateDetail();

  // If the URL carries a ?tree= share code, opens straight into that tree
  // instead of the normal empty state. Silently does nothing on anything
  // invalid/stale (unknown item, removed recipe) - falls back to the
  // regular empty state rather than erroring out.
  function restoreSharedTree() {
    const url = new URL(location.href);
    const code = url.searchParams.get('tree');
    if (!code) return;

    // Consumed either way, successful or not - strip just `tree` (leaving
    // any other params, present now or added later, untouched) so a share
    // link doesn't linger as a giant URL after it's been read.
    url.searchParams.delete('tree');
    history.replaceState(null, '', url);

    const restored = deserializeTreeState(code);
    if (!restored || !state.registries.objects.has(restored.subjectId)) return;

    const recipe = state.registries.recipes.recipes.find((r) => r.id === restored.recipeId);
    if (!recipe) return;

    state.selectedId = restored.subjectId;
    state.view = 'tree';
    state.treeRecipe = recipe;
    state.treeInitialState = { choices: restored.choices, overrides: restored.overrides };
  }
}
