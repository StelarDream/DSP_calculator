import { loadRegistries } from './data/index.js';
import { state } from './state.js';
import { initTabs } from './ui/tabs.js';
import { renderFilters } from './ui/filters.js';
import { renderList } from './ui/list.js';
import { renderDetail } from './ui/detail.js';
import { renderTreeView } from './ui/treeView.js';
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
      renderTreeView(detailContainer, state.selectedId, state.treeRecipe, state.registries, exitTreeView);
      return;
    }

    const object = state.selectedId ? state.registries?.objects.get(state.selectedId) : null;
    renderDetail(detailContainer, object ?? null, state.registries, selectObject, generateTree);
  }

  // Wired up to the tree button on each recipe card.
  function generateTree(recipe) {
    state.view = 'tree';
    state.treeRecipe = recipe;
    updateDetail();
  }

  function exitTreeView() {
    state.view = 'detail';
    state.treeRecipe = null;
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
    updateList();
    updateDetail();
  }

  initTabs(tabButtons, (tab) => {
    state.tab = tab;
    state.filter = 'all';
    state.selectedId = null;
    state.view = 'detail';
    state.treeRecipe = null;
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

  updateList();
}
