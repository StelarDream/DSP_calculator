import { CHEVRON_ICON } from './icons.js';

// Collapses the sidebar into an icon-only rail: the search box, tab labels,
// and filter chips hide (see the .sidebar-collapsed rules in styles.css),
// leaving just the entity icons and this toggle. State lives purely in the
// DOM (a class on .layout) since nothing outside this module needs to read
// it and it isn't worth persisting in state.js.
export function initSidebarCollapse(layout, toggleBtn) {
  toggleBtn.innerHTML = CHEVRON_ICON;
  toggleBtn.setAttribute('aria-expanded', 'true');
  toggleBtn.title = 'Collapse sidebar';

  toggleBtn.addEventListener('click', () => {
    const collapsed = layout.classList.toggle('sidebar-collapsed');
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
    toggleBtn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  });
}
