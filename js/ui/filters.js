// Per-tab filter chip definitions. Buildings doesn't have real category data
// yet, so "factories"/"collectors" are placeholders reserving the slot.
export const FILTER_DEFS = {
  items: [
    { key: 'all', label: 'All' },
    { key: 'collectable', label: 'Collectable' },
    { key: 'craftable', label: 'Craftable' },
  ],
  buildings: [
    { key: 'all', label: 'All' },
    { key: 'factories', label: 'Factories' },
    { key: 'collectors', label: 'Collectors' },
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
