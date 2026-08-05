import { formatLabel } from '../ui/format.js';
import { formatQty } from './formatQty.js';
import { PENDING_ICON } from '../ui/icons.js';

// The persistent sidebar element - created once per tree view and reused
// across rerenders (see renderResourcesInto), same convention as
// treeCanvas.js's world element.
export function createResourceSidebar() {
  const el = document.createElement('div');
  el.className = 'tree-resources';
  return el;
}

// (Re)populates the sidebar from a summarizeTree() result: what still has
// to come from outside the tree, and any byproduct surplus left over once
// that demand is netted out.
export function renderResourcesInto(sidebar, summary) {
  sidebar.innerHTML = '';
  sidebar.appendChild(renderSection('Raw Resources', summary.needed, 'needed'));
  if (summary.leftover.length > 0) {
    sidebar.appendChild(renderSection('Leftover', summary.leftover, 'leftover'));
  }
}

function renderSection(title, items, kind) {
  const section = document.createElement('div');
  section.className = 'tree-resources-section';

  const heading = document.createElement('h3');
  heading.className = 'tree-resources-title';
  heading.textContent = title;
  section.appendChild(heading);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'tree-resources-empty';
    empty.textContent = 'None yet.';
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement('div');
  list.className = 'tree-resources-list';
  for (const item of items) list.appendChild(renderRow(item, kind));
  section.appendChild(list);

  return section;
}

function renderRow(item, kind) {
  const row = document.createElement('div');
  row.className = `tree-resource-row tree-resource-row--${kind}`;

  const icon = document.createElement('img');
  icon.className = 'tree-resource-icon';
  icon.src = item.object?.icon ?? '';
  icon.alt = '';
  row.appendChild(icon);

  const name = document.createElement('span');
  name.className = 'tree-resource-name';
  name.textContent = formatLabel(item.itemId);
  row.appendChild(name);

  // At least one contributing node hasn't had its recipe picked yet - this
  // total will likely change once it is.
  if (item.pending) {
    const pending = document.createElement('span');
    pending.className = 'tree-resource-pending';
    pending.innerHTML = PENDING_ICON;
    pending.title = 'Includes an item with no recipe chosen yet - this total may change';
    row.appendChild(pending);
  }

  const qty = document.createElement('span');
  qty.className = 'tree-resource-qty';
  qty.textContent = (kind === 'leftover' ? '+' : '') + formatQty(item.qty);
  row.appendChild(qty);

  return row;
}
