import { loadRegistries } from './data/index.js';
import { state } from './state.js';
import { initTabs, setActiveTab } from './ui/tabs.js';
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
    renderDetail(detailContainer, object ?? null, state.registries, selectObject);
  }

  // Jumps straight to another object's page - used for list clicks as well
  // as clicking an ingredient/result/"used in"/source reference, switching
  // tabs first if the target belongs to a different one.
  function selectObject(id) {
    const object = state.registries?.objects.get(id);
    if (!object) return;

    state.tab = object.tags.has('item') ? 'item' : object.tags.has('building') ? 'building' : 'source';
    state.filter = 'all';
    state.search = '';
    state.selectedId = id;
    searchInput.value = '';

    setActiveTab(tabButtons, state.tab);
    updateFilters();
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
