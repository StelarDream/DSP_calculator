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
    renderList(listContainer, entities, state.selectedId, (id) => {
      state.selectedId = id;
      updateList();
      updateDetail();
    });
  }

  function updateDetail() {
    const object = state.selectedId ? state.registries?.objects.get(state.selectedId) : null;
    renderDetail(detailContainer, object ?? null, state.registries);
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
