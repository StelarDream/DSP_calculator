// A single icon + name (+ optional quantity) row, used for recipe
// ingredients/results and for a collectable's source. Clickable when
// onSelect is given, navigating to that object's own page.
export function renderEntityRow({ id, entity, label, qty, onSelect }) {
  const clickable = typeof onSelect === 'function';
  const row = document.createElement(clickable ? 'button' : 'div');
  row.className = 'ingredient';

  if (clickable) {
    row.type = 'button';
    row.addEventListener('click', () => onSelect(id));
  }

  const icon = document.createElement('img');
  icon.className = 'ingredient-icon';
  icon.src = entity?.icon ?? '';
  icon.alt = '';

  const name = document.createElement('span');
  name.className = 'ingredient-name';
  name.textContent = label;

  row.append(icon, name);

  if (qty != null) {
    const qtyEl = document.createElement('span');
    qtyEl.className = 'ingredient-qty';
    qtyEl.textContent = `×${qty}`;
    row.appendChild(qtyEl);
  }

  return row;
}
