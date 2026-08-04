import { loadRegistries } from './data/index.js';
import { buildCategorySets } from './data/categories.js';
import { state } from './state.js';
import { initTabs } from './ui/tabs.js';
import { renderFilters } from './ui/filters.js';
import { renderList } from './ui/list.js';
import { selectEntities } from './selectEntities.js';

export async function init() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const filtersContainer = document.getElementById('filters');
  const listContainer = document.getElementById('entity-list');
  const searchInput = document.getElementById('search');

  function updateFilters() {
    renderFilters(filtersContainer, state.tab, state.filter, (key) => {
      state.filter = key;
      updateFilters();
      updateList();
    });
  }

  function updateList() {
    const entities = selectEntities(state, state.registries, state.categories);
    renderList(listContainer, entities, state.selectedId, (id) => {
      state.selectedId = id;
      updateList();
    });
  }

  initTabs(tabButtons, (tab) => {
    state.tab = tab;
    state.filter = 'all';
    state.selectedId = null;
    updateFilters();
    updateList();
  });

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    updateList();
  });

  updateFilters();

  state.registries = await loadRegistries();
  state.categories = buildCategorySets(state.registries);

  updateList();
}
