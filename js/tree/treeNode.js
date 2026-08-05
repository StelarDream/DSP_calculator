import { formatLabel } from '../ui/format.js';
import { CHEVRON_ICON, EDIT_ICON, PROLIF_YIELD_ICON, PROLIF_CHANCE_ICON, PROLIF_SPEED_ICON, PROLIF_NONE_ICON } from '../ui/icons.js';
import { NODE_WIDTH, NODE_HEIGHT } from './constants.js';
import { formatQty } from './formatQty.js';
import { PROLIFERATOR_LEVELS } from './proliferatorLevels.js';

// Which proliferator effects a recipe *can* support, in display order -
// matches js/ui/proliferation.js's convention for the flat recipe card.
// `tone` also matches that file: yield/chance boost output (primary),
// speed is a throughput boost (secondary) - same reasoning here.
const PROLIF_MODES = [
  { key: 'yield', icon: PROLIF_YIELD_ICON, label: 'Extra Yield', tone: 'primary' },
  { key: 'chance', icon: PROLIF_CHANCE_ICON, label: 'Extra Product Chance', tone: 'primary' },
  { key: 'speed', icon: PROLIF_SPEED_ICON, label: 'Speed Up', tone: 'secondary' },
];

// A single fixed-size card in the tree canvas. Three flavors:
//  - choice: "expand using this recipe" - see renderChoiceNode.
//  - leaf/cycle: plain, non-interactive card.
//  - craftable: div[role="button"] with a chevron, toggling expand/collapse
//    via handlers.onToggle(path, wasCollapsed) on click. (A real <button>
//    can't be used here since a resolved node can nest actual <button>s -
//    the "change recipe" and "proliferation" badges - inside it.)
export function renderTreeNode(node, handlers = {}) {
  if (node.isChoice) return renderChoiceNode(node, handlers.onChoose);

  const { onToggle, onEdit, proliferation, openProlifMenu, onToggleProlifMenu } = handlers;
  const expandable = !node.isLeaf && typeof onToggle === 'function';
  // Only makes sense once resolved to a specific recipe (not mid-choice)
  // and expanded (so there's actually a visible branch to relabel).
  const editable = expandable && !node.isCollapsed && !node.needsChoice
    && node.recipeOptions.length > 1 && typeof onEdit === 'function';

  // Same "resolved to a specific recipe" requirement as editable, plus the
  // recipe actually needs to support at least one proliferator effect -
  // "only display the available modes" starts with not showing the badge
  // at all when there are none.
  const availableModes = node.recipe ? PROLIF_MODES.filter((mode) => node.recipe.proliferation[mode.key]) : [];
  const proliferatable = !node.isCollapsed && !node.needsChoice && availableModes.length > 0
    && typeof onToggleProlifMenu === 'function';
  const currentProlif = proliferatable ? proliferation?.get(node.path) : null;
  // Guards against a stale setting whose mode the *current* recipe (after
  // an edit) no longer supports - shown as "off" rather than a mismatch.
  const activeProlif = currentProlif && availableModes.some((m) => m.key === currentProlif.mode) ? currentProlif : null;
  const menuOpen = proliferatable && openProlifMenu?.path === node.path;

  const el = document.createElement('div');
  el.className = 'tree-node';
  if (node.isLeaf) el.classList.add('tree-node--leaf');
  if (node.isCycle) el.classList.add('tree-node--cycle');
  // Each node card is its own stacking context (it has a transform - see
  // treeCanvas.js's positionNode), so a child's z-index only wins against
  // its own siblings, not other node cards painted later in the world.
  // Bump the whole card above the rest while its popover is open so the
  // popover doesn't end up visually tangled with a neighboring row.
  if (menuOpen) el.classList.add('tree-node--menu-open');
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

  // Both badges sit in the same spot (the card's right edge, where its
  // branch to the children begins) - stacked on top of each other when
  // both are present, otherwise centered alone.
  const stacked = editable && proliferatable;

  if (editable) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'tree-node-edit';
    if (stacked) edit.classList.add('tree-node-badge--stack-top');
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

  const activeMode = activeProlif && PROLIF_MODES.find((mode) => mode.key === activeProlif.mode);

  if (proliferatable) {
    const prolif = document.createElement('button');
    prolif.type = 'button';
    prolif.className = 'tree-node-prolif';
    if (stacked) prolif.classList.add('tree-node-badge--stack-bottom');
    if (activeProlif) prolif.classList.add('tree-node-prolif--active');
    // Tinted by the active mode's tone (speed = secondary, yield/chance =
    // primary) - same convention as js/ui/proliferation.js's flat card.
    if (activeMode) prolif.classList.add(`tree-node-prolif--${activeMode.tone}`);
    prolif.title = activeProlif
      ? `Proliferation: ${modeLabel(activeProlif.mode)} (${levelLabel(activeProlif.level)})`
      : 'Add proliferation';
    prolif.setAttribute('aria-label', prolif.title);
    // Once a mode+level is actually applied, swap the generic badge icon
    // for "<mode icon> | <proliferator icon>" so the badge itself shows
    // what's active, not just that something is - matching the tooltip.
    if (activeProlif) {
      const modeIcon = document.createElement('span');
      modeIcon.className = 'tree-node-prolif-icon';
      modeIcon.innerHTML = activeMode?.icon ?? '';
      const divider = document.createElement('span');
      divider.className = 'tree-node-prolif-divider';
      const levelIcon = document.createElement('img');
      levelIcon.className = 'tree-node-prolif-level-icon';
      const level = PROLIFERATOR_LEVELS.find((lvl) => lvl.id === activeProlif.level);
      levelIcon.src = level ? `assets/items/${level.itemId}.png` : '';
      levelIcon.alt = '';
      prolif.append(modeIcon, divider, levelIcon);
    } else {
      const prolifIcon = document.createElement('img');
      prolifIcon.src = 'assets/proliferation-icon.png';
      prolifIcon.alt = '';
      prolif.appendChild(prolifIcon);
    }
    prolif.addEventListener('click', (event) => {
      event.stopPropagation();
      onToggleProlifMenu(node.path);
    });
    el.appendChild(prolif);

    if (menuOpen) {
      el.appendChild(renderProlifMenu(node, availableModes, openProlifMenu, handlers));
    }
  }

  return el;
}

// The mode/level picker - opened by the proliferation badge. Nested inside
// the node (not a floating overlay) so it inherits the same pan/zoom
// transform as everything else in the world, same reasoning as the choice
// cards. Neither axis is "applied" until both a mode and a level are set;
// selecting either one, once the other's already chosen, commits and stays
// open for further tweaking.
function renderProlifMenu(node, availableModes, openState, { onSetProlifMode, onSetProlifLevel, onClearProliferation }) {
  const menu = document.createElement('div');
  menu.className = 'tree-node-prolif-menu';
  // Nothing inside here should reach the card's own click (collapse) or
  // the canvas's pointerdown (pan) - button/[role=button] already guards
  // pan, but the card's own click listener still needs stopping.
  menu.addEventListener('click', (event) => event.stopPropagation());

  const modeRow = document.createElement('div');
  modeRow.className = 'tree-node-prolif-row';

  // Explicit opt-out, sitting right alongside the yield/chance/speed
  // choices it's an alternative to - replaces the old standalone "Remove"
  // link below the picker. Clears the node's proliferation entirely and
  // closes the menu, same as the old Remove button did.
  const none = document.createElement('button');
  none.type = 'button';
  none.className = 'tree-node-prolif-option tree-node-prolif-option--none';
  if (!openState.mode && !openState.level) none.classList.add('tree-node-prolif-option--active');
  none.title = 'None';
  none.setAttribute('aria-label', 'None');
  none.innerHTML = PROLIF_NONE_ICON;
  none.addEventListener('click', () => onClearProliferation(node.path));
  modeRow.appendChild(none);

  for (const mode of availableModes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tree-node-prolif-option tree-node-prolif-option--${mode.tone}`;
    if (openState.mode === mode.key) btn.classList.add('tree-node-prolif-option--active');
    btn.title = mode.label;
    btn.setAttribute('aria-label', mode.label);
    btn.innerHTML = mode.icon;
    btn.addEventListener('click', () => onSetProlifMode(node.path, mode.key));
    modeRow.appendChild(btn);
  }
  menu.appendChild(modeRow);

  const levelRow = document.createElement('div');
  levelRow.className = 'tree-node-prolif-row';
  for (const level of PROLIFERATOR_LEVELS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tree-node-prolif-option';
    if (openState.level === level.id) btn.classList.add('tree-node-prolif-option--active');
    btn.title = level.label;
    btn.setAttribute('aria-label', level.label);
    const img = document.createElement('img');
    img.src = `assets/items/${level.itemId}.png`;
    img.alt = '';
    btn.appendChild(img);
    btn.addEventListener('click', () => onSetProlifLevel(node.path, level.id));
    levelRow.appendChild(btn);
  }
  menu.appendChild(levelRow);

  return menu;
}

function modeLabel(key) {
  return PROLIF_MODES.find((mode) => mode.key === key)?.label ?? key;
}

function levelLabel(id) {
  return PROLIFERATOR_LEVELS.find((level) => level.id === id)?.label ?? id;
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
