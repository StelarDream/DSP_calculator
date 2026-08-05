import { PROLIF_MODES, renderProlifModeRow, renderProlifLevelRow } from './proliferationPicker.js';

// "Default Proliferation" settings panel at the bottom of the tree view's
// resource sidebar. Picks a mode+level that treeView.js's
// applyDefaultProliferation then stamps onto any node that doesn't already
// have its own proliferation set, as soon as that node resolves to a
// recipe - "when possible" meaning only if that recipe actually supports
// the chosen mode, same rule the per-node picker uses. Always visible
// (a settings control, not a popover) so all modes are offered regardless
// of what any single node's recipe supports.
export function renderDefaultProliferationSection(defaultProlif, { onSetMode, onSetLevel, onClear }) {
  const section = document.createElement('div');
  section.className = 'tree-resources-section';

  const heading = document.createElement('h3');
  heading.className = 'tree-resources-title';
  heading.textContent = 'Default Proliferation';
  section.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'tree-resources-empty';
  hint.textContent = "Applied to newly expanded nodes whose recipe supports it.";
  section.appendChild(hint);

  section.appendChild(renderProlifModeRow(defaultProlif, PROLIF_MODES, {
    onSelectMode: onSetMode,
    onSelectNone: onClear,
  }));
  section.appendChild(renderProlifLevelRow(defaultProlif, { onSelectLevel: onSetLevel }));

  return section;
}
