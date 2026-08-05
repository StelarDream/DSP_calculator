import { formatLabel } from '../ui/format.js';
import { CHEVRON_ICON, EDIT_ICON } from '../ui/icons.js';
import { NODE_WIDTH, NODE_HEIGHT } from './constants.js';
import { formatQty } from './formatQty.js';

// A single fixed-size card in the tree canvas. Three flavors:
//  - choice: "expand using this recipe" - see renderChoiceNode.
//  - leaf/cycle: plain, non-interactive card.
//  - craftable: div[role="button"] with a chevron, toggling expand/collapse
//    via handlers.onToggle(path, wasCollapsed) on click. (A real <button>
//    can't be used here since a resolved multi-recipe node nests an actual
//    <button> - the "change recipe" badge - inside it.)
export function renderTreeNode(node, handlers = {}) {
  if (node.isChoice) return renderChoiceNode(node, handlers.onChoose);

  const { onToggle, onEdit } = handlers;
  const expandable = !node.isLeaf && typeof onToggle === 'function';
  // Only makes sense once resolved to a specific recipe (not mid-choice)
  // and expanded (so there's actually a visible branch to relabel).
  const editable = expandable && !node.isCollapsed && !node.needsChoice
    && node.recipeOptions.length > 1 && typeof onEdit === 'function';

  const el = document.createElement('div');
  el.className = 'tree-node';
  if (node.isLeaf) el.classList.add('tree-node--leaf');
  if (node.isCycle) el.classList.add('tree-node--cycle');
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;

  if (expandable) {
    el.classList.add('tree-node--expandable');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    const toggle = () => onToggle(node.path, node.isCollapsed);
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggle();
    });
  }

  const iconWrap = document.createElement('div');
  iconWrap.className = 'tree-node-icon-wrap';

  const icon = document.createElement('img');
  icon.className = 'tree-node-icon';
  icon.src = node.object?.icon ?? '';
  icon.alt = '';
  iconWrap.appendChild(icon);

  // Only known once a node is expanded *and* resolved to a specific recipe
  // (not mid-choice, not collapsed) - see buildTree.js. Shows which
  // building/crafting-table type is responsible for this node.
  if (node.recipe) {
    const badge = document.createElement('img');
    badge.className = 'tree-node-type-badge';
    badge.src = `assets/recipe-types/${node.recipe.type}.png`;
    badge.alt = '';
    badge.title = formatLabel(node.recipe.type);
    iconWrap.appendChild(badge);
  }

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = formatLabel(node.itemId);

  const qty = document.createElement('span');
  qty.className = 'tree-node-qty';
  qty.textContent = `×${formatQty(node.qty)}`;

  info.append(name, qty);
  el.append(iconWrap, info);

  if (expandable) {
    const chevron = document.createElement('span');
    chevron.className = 'tree-node-chevron';
    if (!node.isCollapsed) chevron.classList.add('tree-node-chevron--open');
    chevron.innerHTML = CHEVRON_ICON;
    el.appendChild(chevron);
  }

  if (editable) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'tree-node-edit';
    edit.title = 'Change recipe';
    edit.setAttribute('aria-label', 'Change recipe');
    edit.innerHTML = EDIT_ICON;
    // Stop it reaching the card's own click (which would toggle collapse)
    // and reopen the choice step for this node instead.
    edit.addEventListener('click', (event) => {
      event.stopPropagation();
      onEdit(node.path);
    });
    el.appendChild(edit);
  }

  return el;
}

// One candidate recipe, shown in place of a craftable node's children when
// it has more than one option and none has been picked yet - see
// buildTree.js's needsChoice. Distinguished by recipe *type* + an icon
// preview of its ingredients, since the item icon/name would be identical
// across every option (they all produce the same thing).
function renderChoiceNode(node, onChoose) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tree-node tree-node--choice';
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;
  el.addEventListener('click', () => onChoose?.(node.parentPath, node.recipe.id));

  const icon = document.createElement('img');
  icon.className = 'tree-node-icon';
  icon.src = `assets/recipe-types/${node.recipe.type}.png`;
  icon.alt = '';

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = formatLabel(node.recipe.type);

  const ingredients = document.createElement('span');
  ingredients.className = 'tree-node-ingredients';
  for (const { id, icon } of node.ingredientIcons) {
    const ingredientIcon = document.createElement('img');
    ingredientIcon.className = 'tree-node-ingredient-icon';
    ingredientIcon.src = icon ?? '';
    ingredientIcon.alt = formatLabel(id);
    ingredientIcon.title = formatLabel(id);
    ingredients.appendChild(ingredientIcon);
  }

  info.append(name, ingredients);
  el.append(icon, info);
  return el;
}

// Extra output from a resolved node's recipe besides the item that was
// actually asked for - see buildTree.js's node.byproducts. Purely
// informational (no click handler at all): a dashed, red-tinted card
// flagging "you also get this," not part of the tree's own hierarchy.
export function renderByproductNode(byproduct) {
  const el = document.createElement('div');
  el.className = 'tree-node tree-node--byproduct';
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;

  const icon = document.createElement('img');
  icon.className = 'tree-node-icon';
  icon.src = byproduct.object?.icon ?? '';
  icon.alt = '';

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = formatLabel(byproduct.itemId);

  const qty = document.createElement('span');
  qty.className = 'tree-node-qty';
  qty.textContent = `+${formatQty(byproduct.qty)} byproduct`;

  info.append(name, qty);
  el.append(icon, info);
  return el;
}
