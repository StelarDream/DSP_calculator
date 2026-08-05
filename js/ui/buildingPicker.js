import { formatLabel } from './format.js';

// Icon row of building options, highlighting whichever's currently
// selected - shared by the per-card building picker (factoryCard.js) and
// the sidebar's per-recipe-type default picker (defaultBuildingPanel.js),
// same sharing rationale as proliferationPicker.js's mode/level rows.
export function renderBuildingIconRow(options, selectedId, registries, onSelect) {
  const row = document.createElement('div');
  row.className = 'factory-building-row';

  for (const option of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'factory-building-option';
    if (option.building === selectedId) btn.classList.add('factory-building-option--active');
    btn.title = formatLabel(option.building);
    btn.setAttribute('aria-label', formatLabel(option.building));

    const img = document.createElement('img');
    img.src = registries.objects.get(option.building)?.icon ?? '';
    img.alt = '';
    btn.appendChild(img);

    btn.addEventListener('click', () => onSelect(option.building));
    row.appendChild(btn);
  }

  return row;
}
