import { formatLabel } from '../ui/format.js';
import { CHEVRON_ICON, EDIT_ICON, PROLIF_NONE_ICON, REUSE_ICON, PENDING_ICON, SUPPLY_ICON } from '../ui/icons.js';
import { NODE_WIDTH, NODE_HEIGHT } from './constants.js';
import { formatQty } from './formatQty.js';
import { PROLIFERATOR_LEVELS } from './proliferatorLevels.js';
import { PROLIF_MODES, renderProlifModeRow, renderProlifLevelRow, modeLabel, levelLabel } from './proliferationPicker.js';
import { renderReuseMenu, renderManualMenu } from './reusePicker.js';
import { renderRecycleMenu } from './cyclePicker.js';

// A single fixed-size card in the tree canvas. Six flavors:
//  - choice: "expand using this recipe" - see renderChoiceNode.
//  - reuse choice: "reuse leftover" - see renderReuseChoiceNode.
//  - manual choice: "supply myself" - see renderManualChoiceNode.
//  - cycle: a loop back onto one of its own ancestors, with its own
//    recycle control - see renderCycleNode.
//  - leaf: plain, non-interactive card.
//  - craftable: div[role="button"] with a chevron, toggling expand/collapse
//    via handlers.onToggle(path, wasCollapsed) on click.
// Everything about *how* a resolved node is made - the recipe/machine icon,
// "change recipe", proliferation - lives on the separate recipe hub between
// this card and its children instead (see renderRecipeHub, layoutTree.js,
// treeCanvas.js), keeping this card down to just "what" and "how much."
export function renderTreeNode(node, handlers = {}) {
  if (node.isChoice) return renderChoiceNode(node, handlers.onChoose);
  if (node.isReuseChoice) return renderReuseChoiceNode(node, handlers);
  if (node.isManualChoice) return renderManualChoiceNode(node, handlers);
  if (node.isCycle) return renderCycleNode(node, handlers);

  const { onToggle } = handlers;
  const expandable = !node.isLeaf && typeof onToggle === 'function';

  const el = document.createElement('div');
  el.className = 'tree-node';
  if (node.isLeaf) el.classList.add('tree-node--leaf');
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

  // Deliberately *not* shown here (used to be) - see renderReuseHub's own
  // badge instead. Keeping it there instead of duplicating it on the card
  // means there's exactly one place a reused amount is displayed, right on
  // the control that lets you change it.

  // Set only once a descendant cycle node is recycling some of *this*
  // node's own output back into itself - see buildTree.js's qtyBoost. This
  // one stays on the card (unlike the reuse note above) since there's no
  // single hub it belongs to instead: the control that caused it lives on
  // a cycle node somewhere down this subtree, not anywhere on this card's
  // own hub.
  if (node.qtyBoost > 0) {
    const recycleNote = document.createElement('span');
    recycleNote.className = 'tree-node-qty-recycle';
    recycleNote.textContent = ` (+${formatQty(node.qtyBoost)} recycled back in)`;
    qty.title = `×${formatQty(node.qtyBoost)} of this is being fed back in from a cycle further down this subtree`;
    qty.appendChild(recycleNote);
  }

  // Set when a cycle further down this subtree wanted to recycle into this
  // node but never could (see cycleRecycle.js's divergingPaths) - the
  // combined loop consumes 100%+ of what this node produces, so no finite
  // amount of production ever nets positive. Reverted to raw un-recycled
  // demand rather than showing a made-up "closed" number.
  if (node.boostDiverged) {
    const divergedNote = document.createElement('span');
    divergedNote.className = 'tree-node-qty-diverged';
    divergedNote.textContent = ' (loop can’t close)';
    qty.title = 'A cycle further down this subtree recycles at least this whole node’s output back into itself - no amount of production ever nets positive, so recycling here was left off.';
    qty.appendChild(divergedNote);
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

// The reuse hub - a separate box stacked alongside the recipe hub (see
// layoutTree.js's _hasReuseHub/collect(), which reserves the shared split
// row and pushes the recipe hub over to make room), not folded into it.
// Kept as its own hub rather than a button inside the recipe hub because
// it's a genuinely different kind of input ("how much comes from
// leftover" vs. "which recipe/proliferation") - only ever placed by
// layoutTree.js once node._hasReuseHub is true, so it doesn't need to
// re-derive that decision itself. Pool-only (see renderManualHub below
// for the independent manual-supply hub sharing the same split) - only
// offered when the leftover pool actually has something in it (or this
// node's already drawing from it), since unlike manual supply there's a
// real ceiling to respect.
export function renderReuseHub(node, handlers = {}) {
  const { getReuseAvailability, openReuseMenu, onToggleReuseMenu, onApplyReuse, onClearReuse } = handlers;

  const current = node.suppliedFromLeftover ?? 0;
  const available = typeof getReuseAvailability === 'function' ? getReuseAvailability(node.itemId, node.path) : 0;
  const menuOpen = openReuseMenu?.path === node.path && openReuseMenu?.kind === 'reuse';

  const hub = document.createElement('div');
  hub.className = 'reuse-hub';
  if (menuOpen) hub.classList.add('reuse-hub--menu-open');

  const reuse = document.createElement('button');
  reuse.type = 'button';
  reuse.className = 'tree-node-reuse';
  if (current > 0) reuse.classList.add('tree-node-reuse--active');
  reuse.title = current > 0
    ? `Reusing ×${formatQty(current)} from leftover`
    : 'Supply from leftover';
  reuse.setAttribute('aria-label', reuse.title);
  reuse.innerHTML = REUSE_ICON;
  reuse.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggleReuseMenu(node.path, 'reuse');
  });

  // The reused amount itself - moved here from the item card (a card used
  // to append "(5 from leftover)" to its own qty) so there's exactly one
  // place displaying it, right on the control that changes it. Only shown
  // once there's actually a nonzero amount - an inactive reuse hub (offered
  // because leftover's available, not yet used) shows just the icon.
  if (current > 0) {
    const badge = document.createElement('span');
    badge.className = 'tree-node-reuse-badge';
    badge.textContent = `×${formatQty(current)}`;
    reuse.appendChild(badge);
  }

  hub.appendChild(reuse);

  if (menuOpen) {
    hub.appendChild(renderReuseMenu(
      { qty: node.qty, available, current },
      {
        onApply: (amount) => onApplyReuse(node.path, amount),
        onClear: () => onClearReuse(node.path),
      },
    ));
  }

  return hub;
}

// The manual-supply hub - the reuse hub's independent sibling, sharing the
// same split row (see layoutTree.js's _hasManualHub) but its own separate
// box/button/popover, so reuse and manual supply can each be toggled and
// adjusted without touching the other. No pool to gate on (see
// buildTree.js's manualSupplyOverrides) - offered any time the reuse hub's
// *category* of node would be, regardless of whether the leftover pool
// itself has anything in it right now.
export function renderManualHub(node, handlers = {}) {
  const { openReuseMenu, onToggleReuseMenu, onApplyManual, onClearManual } = handlers;

  const current = node.manualSupply ?? 0;
  const menuOpen = openReuseMenu?.path === node.path && openReuseMenu?.kind === 'manual';

  const hub = document.createElement('div');
  hub.className = 'manual-hub';
  if (menuOpen) hub.classList.add('manual-hub--menu-open');

  const supply = document.createElement('button');
  supply.type = 'button';
  supply.className = 'tree-node-manual';
  if (current > 0) supply.classList.add('tree-node-manual--active');
  supply.title = current > 0
    ? `Supplying ×${formatQty(current)} manually`
    : 'Supply manually';
  supply.setAttribute('aria-label', supply.title);
  supply.innerHTML = SUPPLY_ICON;
  supply.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggleReuseMenu(node.path, 'manual');
  });

  if (current > 0) {
    const badge = document.createElement('span');
    badge.className = 'tree-node-reuse-badge';
    badge.textContent = `×${formatQty(current)}`;
    supply.appendChild(badge);
  }

  hub.appendChild(supply);

  if (menuOpen) {
    // No pool ceiling to respect - just whatever reuse hasn't already
    // claimed out of this node's own demand.
    const remaining = node.qty - (node.suppliedFromLeftover ?? 0);
    hub.appendChild(renderManualMenu(
      { qty: remaining, current },
      {
        onApply: (amount) => onApplyManual(node.path, amount),
        onClear: () => onClearManual(node.path),
      },
    ));
  }

  return hub;
}

// The choice hub - stands in for a resolved recipe's icon whenever a
// needsChoice node has already had reuse engaged (see layoutTree.js's
// _hasChoiceHub): its real recipe options branch out from this hub as
// actual tree children (see layoutTree.js's primaryHubPos routing),
// exactly like a resolved node's ingredients would, just with a "still
// undecided" pending-icon look instead of the recipe's own icon. Purely a
// visual marker, not a toggle - the options are always right there as
// siblings, nothing to expand/collapse. A first-ever view of a choice (no
// reuse touched yet) never gets one at all; layoutTree.js routes those
// options directly off the node itself instead, same as always - see
// reusePool.js's injectReuseChoices for why "Just reuse" only shows up
// then too, not here (this hub's sibling reuse hub already covers that
// once reuse is engaged).
export function renderChoiceHub() {
  const hub = document.createElement('div');
  hub.className = 'choice-hub';

  const icon = document.createElement('span');
  icon.className = 'tree-node-choice-icon';
  icon.title = 'Recipe not chosen yet';
  icon.innerHTML = PENDING_ICON;
  hub.appendChild(icon);

  return hub;
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

// "Reuse leftover" - an extra option alongside the real recipe choices,
// only present at all when reusePool.js's injectReuseChoices found
// leftover to offer (see its module comment for why that's a separate
// pass over the finished tree rather than something buildTree.js decides
// inline).
//
// Opens the same amount picker the reuse hub uses (see renderReuseMenu)
// rather than instantly maxing out on click - a user who wants *some* of
// this covered by leftover and the rest actually crafted needs to say so
// up front, before any recipe's picked, not just take-it-all-or-leave-it.
// Applying anything less than the full available amount still resolves
// this particular card away, but doesn't resolve the node: buildTree.js's
// next build finds a genuine remainder still to produce and re-enters
// needsChoice for it, this time with suppliedFromLeftover>0 - which is
// exactly what already happened automatically whenever available < qty
// (see buildTree.js/layoutTree.js's _hasChoiceHub), just now reachable by
// choice instead of only by the pool happening to run short. That
// re-entered needsChoice shows a choice hub with its own combined reuse
// hub attached (layoutTree.js), so a further tweak to either amount goes
// through there from then on, not this card again - this card (and its
// "Supply myself" sibling below) only ever handle the *first* commit, on
// a node that hasn't touched reuse or manual supply yet (see
// buildTree.js's needsChoice branch/reusePool.js's own guard).
//
// Menu keyed on `{ path: node.parentPath, kind: 'reuse' }` via the shared
// openReuseMenu/onToggleReuseMenu plumbing the hub itself uses (just a
// different `kind`, since this card's "Supply myself" sibling shares the
// same parentPath and needs its own independent open/close state - see
// renderManualChoiceNode).
function renderReuseChoiceNode(node, handlers = {}) {
  const { openReuseMenu, onToggleReuseMenu, onApplyReuse } = handlers;
  const menuOpen = openReuseMenu?.path === node.parentPath && openReuseMenu?.kind === 'reuse';

  const el = document.createElement('div');
  el.className = 'tree-node tree-node--choice tree-node--reuse-choice';
  if (menuOpen) el.classList.add('tree-node--reuse-choice-menu-open');
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tree-node-reuse-choice-btn';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggleReuseMenu?.(node.parentPath, 'reuse');
  });

  const icon = document.createElement('span');
  icon.className = 'tree-node-icon tree-node-reuse-choice-icon';
  icon.innerHTML = REUSE_ICON;

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = 'Reuse leftover';

  const qty = document.createElement('span');
  qty.className = 'tree-node-qty';
  qty.textContent = `×${formatQty(node.available)} available`;

  info.append(name, qty);
  button.append(icon, info);
  el.append(button);

  if (menuOpen) {
    el.appendChild(renderReuseMenu(
      { qty: node.parentQty, available: node.available, current: 0 },
      { onApply: (amount) => onApplyReuse?.(node.parentPath, amount), onClear: () => {} },
    ));
  }

  return el;
}

// "Supply myself" - the needsChoice sibling of "Reuse leftover" above (see
// buildTree.js's buildManualChoiceNode), for bringing some (or all) of
// whatever reuse doesn't cover in from outside the tree entirely instead
// of being forced to pick a recipe just to get past the choice.
// Amount-based like the reuse card, not a single all-or-nothing click - see
// buildManualChoiceNode's own comment for why `current` is always 0 here.
// Menu keyed on `{ path: node.parentPath, kind: 'manual' }`, same shared
// plumbing as the reuse card, just a different `kind` so the two don't
// fight over which one's popover is open.
function renderManualChoiceNode(node, handlers = {}) {
  const { openReuseMenu, onToggleReuseMenu, onApplyManual } = handlers;
  const menuOpen = openReuseMenu?.path === node.parentPath && openReuseMenu?.kind === 'manual';

  const el = document.createElement('div');
  el.className = 'tree-node tree-node--choice tree-node--manual-choice';
  if (menuOpen) el.classList.add('tree-node--manual-choice-menu-open');
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tree-node-reuse-choice-btn';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggleReuseMenu?.(node.parentPath, 'manual');
  });

  const icon = document.createElement('span');
  icon.className = 'tree-node-icon tree-node-manual-choice-icon';
  icon.innerHTML = SUPPLY_ICON;

  const info = document.createElement('div');
  info.className = 'tree-node-info';

  const name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = 'Supply myself';

  const qty = document.createElement('span');
  qty.className = 'tree-node-qty';
  qty.textContent = `up to ×${formatQty(node.parentQty)}`;

  info.append(name, qty);
  button.append(icon, info);
  el.append(button);

  if (menuOpen) {
    el.appendChild(renderManualMenu(
      { qty: node.parentQty, current: 0 },
      { onApply: (amount) => onApplyManual?.(node.parentPath, amount), onClear: () => {} },
    ));
  }

  return el;
}

// A cycle guard - this ingredient loops back onto one of its own ancestors
// (see buildTree.js's ancestors.has() branch), so instead of recursing
// forever the tree stops here. First-class and interactive now, not just
// a dead end: the small recycle button lets some of this demand be fed
// back from the ancestor's own output instead of counted as raw external
// need (see buildTree.js's recycledQty/qtyBoost, cycleRecycle.js) - "take
// a cut of the output and feed it straight back into the machine," same
// as it'd work in-game. Yellow border/dashed while nothing's recycled
// (still just a stopped loop, same as before this existed), green once
// recycledQty is set (see .tree-node--cycle-active in styles.css) - a
// glance at the border tells you which cycles in a tree are actually
// closed vs. just left open as raw demand. Red (recycleDiverged - see
// cycleRecycle.js) if this specific recycle request never actually
// settled: not "still open," a request that turned out unsatisfiable
// (this loop, combined with whatever else recycles into the same
// ancestor, would consume 100%+ of the ancestor's own output - no finite
// production ever nets positive) and got reverted to raw demand instead.
function renderCycleNode(node, handlers = {}) {
  const { openRecycleMenu, onToggleRecycleMenu, onApplyRecycle, onClearRecycle } = handlers;

  const current = node.recycledQty ?? 0;
  const menuOpen = openRecycleMenu?.path === node.path;
  const canRecycle = typeof onToggleRecycleMenu === 'function' && Boolean(node.ancestorPath);

  const el = document.createElement('div');
  el.className = 'tree-node tree-node--leaf tree-node--cycle';
  if (current > 0) el.classList.add('tree-node--cycle-active');
  if (node.recycleDiverged) el.classList.add('tree-node--cycle-diverged');
  if (menuOpen) el.classList.add('tree-node--cycle-menu-open');
  el.style.width = `${NODE_WIDTH}px`;
  el.style.height = `${NODE_HEIGHT}px`;

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

  info.append(name, qty);
  el.append(icon, info);

  if (canRecycle) {
    const recycle = document.createElement('button');
    recycle.type = 'button';
    recycle.className = 'tree-node-recycle';
    if (current > 0) recycle.classList.add('tree-node-recycle--active');
    if (node.recycleDiverged) recycle.classList.add('tree-node-recycle--diverged');
    recycle.title = node.recycleDiverged
      ? 'This loop never settles - combined with whatever else recycles into the same output, it would consume all of it, forever. Reverted to raw demand.'
      : current > 0
        ? `Recycling ×${formatQty(current)} back from the output`
        : 'Recycle from output';
    recycle.setAttribute('aria-label', recycle.title);
    recycle.innerHTML = REUSE_ICON;
    if (current > 0) {
      const badge = document.createElement('span');
      badge.className = 'tree-node-recycle-badge';
      badge.textContent = `×${formatQty(current)}`;
      recycle.appendChild(badge);
    }
    recycle.addEventListener('click', (event) => {
      event.stopPropagation();
      onToggleRecycleMenu(node.path);
    });
    el.appendChild(recycle);

    if (menuOpen) {
      el.appendChild(renderRecycleMenu(
        { path: node.path, qty: node.qty, current },
        {
          onApply: (amount) => onApplyRecycle(node.path, amount),
          onClear: () => onClearRecycle(node.path),
        },
      ));
    }
  }

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
