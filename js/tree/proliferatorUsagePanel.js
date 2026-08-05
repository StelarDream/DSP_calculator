import { formatQty } from './formatQty.js';

// "Proliferators Needed" section of the resource sidebar - how many of each
// proliferator level the tree's active proliferation settings will actually
// consume. See summarizeProliferators.js for how usage is totaled; this just
// renders the (already non-empty) result list.
export function renderProliferatorUsageSection(usage) {
  const section = document.createElement('div');
  section.className = 'tree-resources-section';

  const heading = document.createElement('h3');
  heading.className = 'tree-resources-title';
  heading.textContent = 'Proliferators Needed';
  section.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'tree-resources-list';
  for (const entry of usage) list.appendChild(renderRow(entry));
  section.appendChild(list);

  return section;
}

// The exact count (fractional - a level's `amount` points rarely divide
// evenly into what's sprayed) shown alongside the rounded-up count that's
// what you'd actually go buy or produce - can't carry home 4.17 items.
function renderRow({ level, exact, rounded }) {
  const row = document.createElement('div');
  row.className = 'tree-resource-row';

  const icon = document.createElement('img');
  icon.className = 'tree-resource-icon';
  icon.src = `assets/items/${level.itemId}.png`;
  icon.alt = '';
  row.appendChild(icon);

  const name = document.createElement('span');
  name.className = 'tree-resource-name';
  name.textContent = level.label;
  row.appendChild(name);

  const qty = document.createElement('span');
  qty.className = 'tree-resource-qty tree-resource-qty--proliferator';
  qty.innerHTML = `<span class="tree-resource-qty-exact">×${formatQty(exact)}</span><span class="tree-resource-qty-rounded">×${rounded}</span>`;
  row.appendChild(qty);

  return row;
}
