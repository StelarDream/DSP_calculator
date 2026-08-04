// Wires up the Items/Buildings tab buttons. Purely about tab switching -
// knows nothing about filters or lists.
export function initTabs(tabButtons, onChange) {
  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      if (button.classList.contains('active')) return;

      for (const other of tabButtons) other.classList.remove('active');
      button.classList.add('active');

      onChange(button.dataset.tab);
    });
  }
}
