// Per-tab filter chip definitions. `key` must match a tag name exactly
// (or 'all') since selectEntities() checks obj.tags.has(filter) directly.
// Buildings doesn't have real category data yet, so factory/collector are
// placeholders reserving the slot.
export const FILTER_DEFS = {
  item: [
    { key: 'all', label: 'All' },
    { key: 'collectable', label: 'Collectable' },
    { key: 'craftable', label: 'Craftable' },
  ],
  building: [
    { key: 'all', label: 'All' },
    { key: 'factory', label: 'Factories' },
    { key: 'collector', label: 'Collectors' },
  ],
  // No sub-categories for sources yet - just the "All" slot.
  source: [
    { key: 'all', label: 'All' },
  ],
};

export function renderFilters(container, tab, activeFilter, onSelect) {
  const defs = FILTER_DEFS[tab] ?? [];
  container.innerHTML = '';

  for (const { key, label } of defs) {
    const button = document.createElement('button');
    button.className = 'filter-chip' + (key === activeFilter ? ' active' : '');
    button.dataset.filter = key;
    button.textContent = label;
    button.addEventListener('click', () => onSelect(key));
    container.appendChild(button);
  }
}
