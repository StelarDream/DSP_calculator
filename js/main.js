import { loadRegistries } from './data/index.js';
import { state } from './state.js';
import { initTabs } from './ui/tabs.js';
import { renderFilters } from './ui/filters.js';
import { renderList } from './ui/list.js';
import { renderDetail } from './ui/detail.js';
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
    const object = state.selectedId ? state.registries?.objects.get(state.selectedId) : null;
    renderDetail(detailContainer, object ?? null, state.registries, selectObject, generateTree);
  }

  // Placeholder for the recipe-tree generator - wired up to the tree button
  // on each recipe card. TODO: build the actual tree view.
  function generateTree(recipe) {
    console.log('Generate recipe tree for:', recipe);
  }

  // Shows another object's page - used for list clicks as well as clicking
  // an ingredient/result/"used in"/source reference. Deliberately doesn't
  // touch the active tab/filter/search, even if the target belongs to a
  // different tab - only the detail pane (and the list's active highlight)
  // follows the selection.
  function selectObject(id) {
    if (!state.registries?.objects.has(id)) return;
    state.selectedId = id;
    updateList();
    updateDetail();
  }

  initTabs(tabButtons, (tab) => {
    state.tab = tab;
    state.filter = 'all';
    state.selectedId = null;
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
