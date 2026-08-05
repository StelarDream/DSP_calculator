import { formatLabel } from './format.js';
import { BACK_ICON } from './icons.js';

// Full-pane Factory View - reached from the tree view's Factory View button.
// Compiles the current tree's per-node recipe/proliferation choices into
// aggregated machine/factory-count lines (see memory: factory-view-plan).
// Content not built yet - this just establishes the view/navigation shell.
// treeState: { subjectId, recipe, choices, overrides, proliferation } - a
// snapshot of the tree the user was looking at, so "Back" can restore it
// exactly via onBack(treeState).
export function renderFactoryView(container, treeState, onBack) {
  container.innerHTML = '';
  container.scrollTop = 0;

  container.appendChild(renderHeader(treeState, onBack));
  container.appendChild(renderBody());
}

function renderHeader(treeState, onBack) {
  const header = document.createElement('div');
  header.className = 'tree-view-header';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'back-btn';
  backBtn.innerHTML = `${BACK_ICON}<span>Back</span>`;
  backBtn.addEventListener('click', () => onBack(treeState));

  const title = document.createElement('h2');
  title.className = 'tree-view-title';
  title.textContent = `Factory View — ${formatLabel(treeState.subjectId ?? '')}`;

  header.append(backBtn, title);
  return header;
}

function renderBody() {
  const body = document.createElement('div');
  body.className = 'factory-view-body';

  const placeholder = document.createElement('p');
  placeholder.className = 'factory-view-placeholder';
  placeholder.textContent = 'Factory View is coming soon.';
  body.appendChild(placeholder);

  return body;
}
