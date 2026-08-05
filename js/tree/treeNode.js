import { formatLabel } from '../ui/format.js';
import { CHEVRON_ICON, EDIT_ICON, PROLIF_NONE_ICON } from '../ui/icons.js';
import { NODE_WIDTH, NODE_HEIGHT } from './constants.js';
import { formatQty } from './formatQty.js';
import { PROLIFERATOR_LEVELS } from './proliferatorLevels.js';
import { PROLIF_MODES, renderProlifModeRow, renderProlifLevelRow, modeLabel, levelLabel } from './proliferationPicker.js';

// A single fixed-size card in the tree canvas. Three flavors:
//  - choice: "expand using this recipe" - see renderChoiceNode.
//  - leaf/cycle: plain, non-interactive card.
//  - craftable: div[role="button"] with a chevron, toggling expand/collapse
//    via handlers.onToggle(path, wasCollapsed) on click.
// Everything about *how* a resolved node is made - the recipe/machine icon,
// "change recipe", proliferation - lives on the separate recipe hub between
// this card and its children instead (see renderRecipeHub, layoutTree.js,
// treeCanvas.js), keeping this card down to just "what" and "how much."
export function renderTreeNode(node, handlers = {}) {
  if (node.isChoice) return renderChoiceNode(node, handlers.onChoose);

  const { onToggle } = handlers;
  const expandable = !node.isLeaf && typeof onToggle === 'function';

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

  const icon = document.createElement('img');
  icon.className = 'tree-node-icon';
  icon.src = node.object?.icon ?? '';
  icon.alt = '';

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = formatLabel(node.itemId);

  const qty = document.createElement('span');
  qty.className = 'tree-node-qty';
  qty.textContent = `×${formatQty(node.qty)}`;

  // Set only when a parent's Extra Yield actually shrank this node's own
  // qty below what it'd otherwise need - see buildTree.js. Appends the
  // pre-yield figure and the amount saved, e.g. "×3 | ×4 -1", so the
  // saving is visible right where it happened instead of only implied by
  // the smaller number.
  if (node.qtyBeforeYield > node.qty) {
    const saved = node.qtyBeforeYield - node.qty;
    const yieldNote = document.createElement('span');
    yieldNote.className = 'tree-node-qty-yield';
    yieldNote.textContent = ` | ×${formatQty(node.qtyBeforeYield)} -${formatQty(saved)}`;
    qty.title = `Extra Yield reduces this from ×${formatQty(node.qtyBeforeYield)} to ×${formatQty(node.qty)} (saves ×${formatQty(saved)})`;
    qty.appendChild(yieldNote);
  }

  info.append(name, qty);
  el.append(icon, info);

  if (expandable) {
    const chevron = document.createElement('span');
    chevron.className = 'tree-node-chevron';
    if (!node.isCollapsed) chevron.classList.add('tree-node-chevron--open');
    chevron.innerHTML = CHEVRON_ICON;
    el.appendChild(chevron);
  }

  return el;
}

// The recipe hub - only ever placed (by layoutTree.js) between a node and
// its children once the node's actually resolved to a recipe, so node.recipe
// is guaranteed here. Shows the recipe/machine type as a big icon (this is
// its whole reason to exist, unlike the small corner badge it replaces), plus
// the "change recipe" and proliferation controls that used to live on the
// item card itself.
export function renderRecipeHub(node, handlers = {}) {
  const { onEdit, proliferation, openProlifMenu, onToggleProlifMenu } = handlers;

  // Only worth offering when there's actually more than one recipe to
  // switch between - same rule the old item-card badge used.
  const editable = node.recipeOptions.length > 1 && typeof onEdit === 'function';

  // Which proliferator effects *this* recipe can support - "only display
  // the available modes" starts with not showing the button at all when
  // there are none.
  const availableModes = PROLIF_MODES.filter((mode) => node.recipe.proliferation[mode.key]);
  const proliferatable = availableModes.length > 0 && typeof onToggleProlifMenu === 'function';
  const currentProlif = proliferatable ? proliferation?.get(node.path) : null;
  // Guards against a stale setting whose mode the *current* recipe (after
  // an edit) no longer supports - shown as "off" rather than a mismatch.
  const activeProlif = currentProlif && availableModes.some((m) => m.key === currentProlif.mode) ? currentProlif : null;
  const activeMode = activeProlif && PROLIF_MODES.find((mode) => mode.key === activeProlif.mode);
  const menuOpen = proliferatable && openProlifMenu?.path === node.path;

  const hub = document.createElement('div');
  hub.className = 'recipe-hub';
  // Own stacking context (see the transform in treeCanvas.js's
  // positionNode) - bumped above neighboring hubs/cards while its popover
  // is open, same reasoning as the old .tree-node--menu-open.
  if (menuOpen) hub.classList.add('recipe-hub--menu-open');

  const icon = document.createElement('img');
  icon.className = 'recipe-hub-icon';
  icon.src = `assets/recipe-types/${node.recipe.type}.png`;
  icon.alt = '';
  icon.title = formatLabel(node.recipe.type);

  // Floating corner badge (unlike the proliferation button below) - stays
  // put regardless of whether the hub also has a proliferation row, so it
  // doesn't shift the hub's height when a recipe has no effects to offer.
  if (editable) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'tree-node-edit';
    edit.title = 'Change recipe';
    edit.setAttribute('aria-label', 'Change recipe');
    edit.innerHTML = EDIT_ICON;
    // Stop it reaching the canvas's pan handling.
    edit.addEventListener('click', (event) => {
      event.stopPropagation();
      onEdit(node.path);
    });
    hub.appendChild(edit);
  }

  // Sits in-flow to the *left* of the icon (a thin divider between them),
  // rather than floating as a corner badge like the edit button - room to
  // grow when active without overlapping the icon.
  if (proliferatable) {
    const prolif = document.createElement('button');
    prolif.type = 'button';
    prolif.className = 'tree-node-prolif';
    if (activeProlif) prolif.classList.add('tree-node-prolif--active');
    // Tinted by the active mode's tone (speed = secondary, yield = primary)
    // - same convention as js/ui/proliferation.js's flat card.
    if (activeMode) prolif.classList.add(`tree-node-prolif--${activeMode.tone}`);
    prolif.title = activeProlif
      ? `Proliferation: ${modeLabel(activeProlif.mode)} (${levelLabel(activeProlif.level)})`
      : 'Add proliferation';
    prolif.setAttribute('aria-label', prolif.title);
    // Always "<img icon> above <svg icon>" - active or not - so nothing
    // about the button's size changes when proliferation gets toggled,
    // only which icons it shows: the proliferator level + its mode once
    // applied, or a generic hint + the same "None" glyph the picker's own
    // None option uses (see proliferationPicker.js) while nothing's set.
    const topIcon = document.createElement('img');
    topIcon.className = 'tree-node-prolif-level-icon';
    const bottomIcon = document.createElement('span');
    bottomIcon.className = 'tree-node-prolif-icon';
    if (activeProlif) {
      const level = PROLIFERATOR_LEVELS.find((lvl) => lvl.id === activeProlif.level);
      topIcon.src = level ? `assets/items/${level.itemId}.png` : '';
      bottomIcon.innerHTML = activeMode?.icon ?? '';
    } else {
      topIcon.src = 'assets/proliferation-icon.png';
      bottomIcon.innerHTML = PROLIF_NONE_ICON;
    }
    topIcon.alt = '';
    const divider = document.createElement('span');
    divider.className = 'tree-node-prolif-divider';
    prolif.append(topIcon, divider, bottomIcon);
    prolif.addEventListener('click', (event) => {
      event.stopPropagation();
      onToggleProlifMenu(node.path);
    });
    hub.appendChild(prolif);

    const hubDivider = document.createElement('div');
    hubDivider.className = 'recipe-hub-divider';
    hub.appendChild(hubDivider);

    if (menuOpen) {
      hub.appendChild(renderProlifMenu(node, availableModes, openProlifMenu, handlers));
    }
  }

  // Appended last - after the proliferation button, if there is one - so
  // it renders on the right of it, matching .recipe-hub's plain row order.
  hub.appendChild(icon);

  return hub;
}

// The mode/level picker - opened by the proliferation button. Nested inside
// the hub (not a floating overlay) so it inherits the same pan/zoom
// transform as everything else in the world, same reasoning as the choice
// cards. Neither axis is "applied" until both a mode and a level are set;
// selecting either one, once the other's already chosen, commits and stays
// open for further tweaking.
function renderProlifMenu(node, availableModes, openState, { onSetProlifMode, onSetProlifLevel, onClearProliferation }) {
  const menu = document.createElement('div');
  menu.className = 'tree-node-prolif-menu';
  // Nothing inside here should reach the canvas's pointerdown (pan) -
  // button/[role=button] already guards pan, but stop it explicitly anyway
  // since this sits inside the hub rather than a plain card.
  menu.addEventListener('click', (event) => event.stopPropagation());

  menu.appendChild(renderProlifModeRow(openState, availableModes, {
    onSelectMode: (mode) => onSetProlifMode(node.path, mode),
    // Explicit opt-out, sitting right alongside the yield/speed
    // choices it's an alternative to - replaces the old standalone "Remove"
    // link below the picker. Clears the node's proliferation and closes
    // the menu, same as the old Remove button did.
    onSelectNone: () => onClearProliferation(node.path),
  }));
  menu.appendChild(renderProlifLevelRow(openState, {
    onSelectLevel: (level) => onSetProlifLevel(node.path, level),
  }));

  return menu;
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
