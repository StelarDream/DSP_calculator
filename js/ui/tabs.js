// Wires up the Items/Buildings/Sources tab buttons. Purely about tab
// switching - knows nothing about filters or lists.
export function initTabs(tabButtons, onChange) {
  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      if (button.classList.contains('active')) return;
      setActiveTab(tabButtons, button.dataset.tab);
      onChange(button.dataset.tab);
    });
  }
}

// Also used for programmatic navigation (e.g. clicking an ingredient),
// which needs to reflect the new tab without a real button click.
export function setActiveTab(tabButtons, tab) {
  for (const button of tabButtons) {
    button.classList.toggle('active', button.dataset.tab === tab);
  }
}
