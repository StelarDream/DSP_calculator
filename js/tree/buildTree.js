import { DEFAULT_EXPAND_DEPTH } from './constants.js';
import { PROLIFERATOR_LEVELS } from './proliferatorLevels.js';

// Recursively expands an item into a tree of what it takes to craft it.
// Pure function of (registries + the two override maps, plus proliferation)
// - no DOM, easy to reason about and re-run on every interaction.
//
// A node is a leaf purely because the item isn't craftable (no recipe
// produces it) - collectable/raw items included. Craftable items always
// recurse into their chosen recipe's ingredients.
//
// A *collapsed* craftable node never resolves a recipe at all - collapsed
// is "I'll produce this myself" (bought, stockpiled, whatever), so which
// recipe it *would* use is moot until you actually expand it.
//
// choices:       Map<path, recipeId>  - which recipe an expanded node uses,
//                once decided. Nodes with >1 option and no entry yet render
//                as a choice step instead of guessing - see buildChoiceNode.
// overrides:     Map<path, boolean>   - manual expand/collapse toggles.
//                Absent entries fall back to the DEFAULT_EXPAND_DEPTH rule.
// proliferation: Map<path, {mode, level}> - per-node proliferation settings
//                (see treeView.js). Only `mode: 'yield'` feeds into the
//                quantity math here - see applyYield below for why.
// reuseOverrides: Map<path, number>   - how much of an expanded node's
//                demand is being manually supplied from leftover elsewhere
//                in the tree instead of actually produced (see treeView.js's
//                reuse hub/"Just reuse" choice card and js/tree/reusePool.js).
//                Deliberately opt-in and per-node, not automatic - see
//                memory: factory-view-plan for why automatic byproduct
//                netting got ruled out. Consulted *before* a recipe is even
//                resolved (see buildNode below) - full coverage means no
//                recipe is needed at all, not just "not crafted." A stale
//                entry for a leaf/collapsed path is harmless, same as a
//                stale `choices`/`overrides` entry.
// recycleOverrides: Map<cyclePath, number> - how much of a cycle-guard
//                node's demand (see the ancestors.has() branch below) is
//                being manually recycled from its own ancestor's output
//                instead of counted as raw external demand - the "feed a
//                cut of the output straight back into the machine" cycle
//                controls (see treeNode.js's renderCycleNode). Unlike
//                reuseOverrides, this doesn't reduce anything - it *adds*:
//                the recycled amount has to come from *more* of the
//                ancestor's own output, so buildTree.js can't apply this
//                inline while building (the ancestor's qty is already
//                fixed by the time its descendant's cycle node is reached).
//                See qtyBoosts below and js/tree/cycleRecycle.js for how
//                it actually gets applied, two builds later.
// qtyBoosts:     Map<path, number> - extra qty added on top of whatever a
//                node's own parent already asked for, from recycleOverrides
//                above (see cycleRecycle.js's computeCycleBoosts, called
//                between builds in treeView.js - this only *applies* a
//                boost already computed from a previous build, it doesn't
//                compute one itself).
// declinedRecipes: Set<path> - nodes where the user explicitly opted out of
//                crafting whatever's left after reuse, choosing to supply
//                it externally instead (see treeNode.js's "Reuse leftover"/
//                "Supply myself" choice cards, renderDeclinedHub). Checked
//                *after* reuseOverrides above but *before* any recipe would
//                be resolved - same "don't even ask" treatment full reuse
//                coverage gets, just for the remainder instead of the whole
//                demand. Unlike reuseOverrides, this doesn't reduce the
//                node's own qty at all: buildNode still leaves it as
//                external demand for summarizeTree.js/computeRawInputs.js to
//                pick up, same as any other leaf.
export function buildTree(rootItemId, qty, registries, { choices = new Map(), overrides = new Map(), proliferation = new Map(), reuseOverrides = new Map(), recycleOverrides = new Map(), qtyBoosts = new Map(), declinedRecipes = new Set() } = {}) {
  return buildNode({
    itemId: rootItemId,
    qty,
    path: rootItemId,
    depth: 0,
    ancestors: new Set([rootItemId]),
    ancestorPaths: new Map([[rootItemId, rootItemId]]),
    registries,
    choices,
    overrides,
    proliferation,
    reuseOverrides,
    recycleOverrides,
    qtyBoosts,
    declinedRecipes,
  });
}

function buildNode({ itemId, qty: rawQty, path, depth, ancestors, ancestorPaths, registries, choices, overrides, proliferation, reuseOverrides, recycleOverrides, qtyBoosts, declinedRecipes, qtyBeforeYield }) {
  // A cycle recycling back into this node (see below) adds to what it has
  // to produce - same reasoning as suppliedFromLeftover subtracting, just
  // the opposite direction. Folded in before anything else touches `qty`
  // so every downstream computation (recipe scale, children, byproducts,
  // the card's own displayed qty) already reflects the larger total.
  const boost = qtyBoosts.get(path) ?? 0;
  const qty = rawQty + boost;
  const object = registries.objects.get(itemId);
  const recipeOptions = registries.recipes.byResultItem.get(itemId) ?? [];
  const isLeaf = recipeOptions.length === 0;

  const node = {
    path,
    itemId,
    object,
    qty,
    // Only set when a parent's Extra Yield made this node's own qty smaller
    // than it'd otherwise be - see the ingredient loop below and
    // treeNode.js's display of it. Undefined (not just equal to qty) is
    // the "nothing to show" case, not zero savings.
    qtyBeforeYield,
    // Set (to a positive number) only once a descendant cycle node is
    // recycling some of this node's own output back into itself - see
    // qtyBoosts above and cycleRecycle.js. `qty` already includes it (this
    // is purely for treeNode.js to annotate where the extra came from).
    qtyBoost: boost > 0 ? boost : undefined,
    depth,
    isLeaf,
    isCycle: false,
    isChoice: false,
    needsChoice: false,
    recipeOptions,
    recipe: null,
    isCollapsed: false,
    // Set (to a positive number) only once this node's recipe is resolved
    // and a reuse override actually applies - see suppliedFromLeftover below.
    suppliedFromLeftover: undefined,
    // True when reuse covers the node's *entire* demand, computed before a
    // recipe would even be resolved (see below) - no recipe, no children,
    // no byproducts, zero crafts. layoutTree.js still gives it a reuse hub
    // to adjust/clear the amount later, just no recipe hub (nothing's
    // being produced to show one for).
    isFullySupplied: false,
    // True once the user's explicitly opted out of crafting whatever's
    // left after reuse (see declinedRecipes above, renderDeclinedHub) -
    // no recipe, no children, no byproducts, same shape as isFullySupplied
    // except the leftover amount (if any) only covers *part* of qty, not
    // all of it. summarizeTree.js/computeRawInputs.js pick up the
    // remainder as ordinary external demand, same as any leaf.
    recipeDeclined: false,
    children: [],
    byproducts: [],
  };

  if (isLeaf) return node;

  const expanded = overrides.has(path) ? overrides.get(path) : depth < DEFAULT_EXPAND_DEPTH;
  if (!expanded) {
    node.isCollapsed = true;
    return node;
  }

  // How much of this node's demand is being manually supplied from leftover
  // elsewhere in the tree instead of actually produced - clamped to `qty`
  // (can't reuse more than this node even needs). Computed *before* even
  // looking at recipeOptions/choices: if reuse alone covers everything,
  // no recipe is needed at all - not just "not crafted," genuinely never
  // resolved, so a still-ambiguous multi-recipe item doesn't force a
  // choice nobody needs to make (see the needsChoice branch below, and
  // treeView.js's "Just reuse" choice card, which is what actually sets
  // this before a recipe would otherwise have been picked).
  const requestedReuse = reuseOverrides.get(path) ?? 0;
  const suppliedFromLeftover = Math.min(Math.max(requestedReuse, 0), qty);
  if (suppliedFromLeftover > 0) node.suppliedFromLeftover = suppliedFromLeftover;
  const producedQty = qty - suppliedFromLeftover;

  if (producedQty <= 0) {
    node.isFullySupplied = true;
    return node;
  }

  // The user's already said they'll cover whatever's left themselves (see
  // declinedRecipes above) - stop here same as isFullySupplied above,
  // just leaving `producedQty` as genuine external demand instead of zero.
  // Checked before the recipe lookup below so a decline sticks regardless
  // of how many recipe options this item has.
  if (declinedRecipes.has(path)) {
    node.recipeDeclined = true;
    return node;
  }

  // Still need to actually produce `producedQty` - resolve a recipe as
  // usual, scoped to just that remainder (reuse above already covered the
  // rest, so it's not part of what needs crafting).
  const chosen = recipeOptions.find((r) => r.id === choices.get(path));
  if (!chosen && recipeOptions.length > 1) {
    // More than one way to make this and nothing picked yet - surface the
    // options as the node's "children" instead of guessing one. Resolves
    // into real ingredient children once onChoose records a pick, plus a
    // "Supply myself" card (see buildDeclineChoiceNode) so leaving the
    // remainder as raw demand doesn't require picking a recipe you don't
    // actually want just to get out of the choice.
    node.needsChoice = true;
    node.children = recipeOptions.map((recipe) => buildChoiceNode(recipe, itemId, path, depth, registries));
    node.children.push(buildDeclineChoiceNode(node));
    return node;
  }

  node.recipe = chosen ?? recipeOptions[0];
  // True when nothing was actually *picked* here - a single-option node
  // defaulting to its only recipe, not a real decision. Lets
  // reusePool.js's injectReuseChoices tell "genuinely nothing to choose"
  // apart from "technically one recipe, but reuse turned out to be an
  // option too" - see its own comment for why that distinction needs the
  // finished tree and can't be made here.
  node.autoResolved = !chosen;

  // Ratio of each ingredient to *one* craft, scaled by how much of this
  // item's own output actually still needs producing - a recipe that
  // yields 2 per craft only needs half as many ingredient crafts per unit,
  // and any qty already covered by reuse above doesn't need crafting at
  // all.
  const outputQty = node.recipe.result[itemId] ?? 1;
  const scale = producedQty / outputQty;

  // Extra Yield boosts every result of a craft (main product *and* any
  // byproduct) by the same multiplier, so it doesn't change how much
  // byproduct comes out for a given target qty - fewer crafts happen, but
  // each makes proportionally more, and the two cancel out. It only
  // reduces how many crafts are needed, which is what shrinks the
  // *ingredient* side: same inputs per craft, fewer crafts. So byproducts
  // keep using the plain `scale` above, and only ingredients use
  // `yieldScale` below.
  const yieldMultiplier = applyYield(node.recipe, path, proliferation);
  const yieldScale = producedQty / (outputQty * yieldMultiplier);

  // Anything else this recipe outputs besides the item we asked for - e.g.
  // Energetic Graphite's Refining recipe also spits out surplus Hydrogen.
  // Purely informational (see treeNode.js) - not part of the tree proper.
  node.byproducts = Object.entries(node.recipe.result)
    .filter(([resultId]) => resultId !== itemId)
    .map(([resultId, resultQty]) => ({
      itemId: resultId,
      object: registries.objects.get(resultId),
      qty: resultQty * scale,
    }));

  for (const [ingredientId, ingredientQty] of Object.entries(node.recipe.ingredients)) {
    const childPath = `${path}>${ingredientId}`;
    const childQty = ingredientQty * yieldScale;
    // Only worth showing "reduced from X" when yield actually shrank it -
    // an untouched node (yieldMultiplier === 1) has nothing to annotate.
    const childQtyBeforeYield = yieldMultiplier > 1 ? ingredientQty * scale : undefined;

    if (ancestors.has(ingredientId)) {
      // Recipe loops back onto one of its own ancestors (e.g. a byproduct
      // feeding back in) - stop here rather than recursing forever. Left
      // as plain external demand by default (recycledQty undefined), same
      // as any other leaf - see recycleOverrides above for the opt-in that
      // changes that.
      const requestedRecycle = recycleOverrides.get(childPath) ?? 0;
      const recycledQty = Math.min(Math.max(requestedRecycle, 0), childQty);
      node.children.push({
        path: childPath,
        itemId: ingredientId,
        object: registries.objects.get(ingredientId),
        qty: childQty,
        qtyBeforeYield: childQtyBeforeYield,
        depth: depth + 1,
        isLeaf: true,
        isCycle: true,
        isChoice: false,
        needsChoice: false,
        recipeOptions: [],
        recipe: null,
        isCollapsed: false,
        // Which ancestor this loops back onto - the one whose output a
        // recycle override actually feeds back into (see cycleRecycle.js's
        // computeCycleBoosts, which reads this to know whose qty to grow).
        ancestorPath: ancestorPaths.get(ingredientId),
        recycledQty: recycledQty > 0 ? recycledQty : undefined,
        children: [],
        byproducts: [],
      });
      continue;
    }

    node.children.push(buildNode({
      itemId: ingredientId,
      qty: childQty,
      qtyBeforeYield: childQtyBeforeYield,
      path: childPath,
      depth: depth + 1,
      ancestors: new Set([...ancestors, ingredientId]),
      ancestorPaths: new Map([...ancestorPaths, [ingredientId, childPath]]),
      registries,
      choices,
      overrides,
      proliferation,
      reuseOverrides,
      recycleOverrides,
      qtyBoosts,
      declinedRecipes,
    }));
  }

  return node;
}

// How much more a single craft yields at this node, if it's got Extra
// Yield active - 1 (no change) otherwise. Guards against a stale setting
// left behind by a recipe edit the same way treeNode.js's activeProlif
// does: only counts if the *current* recipe actually supports yield.
function applyYield(recipe, path, proliferation) {
  const setting = proliferation.get(path);
  if (setting?.mode !== 'yield' || !setting.level || !recipe.proliferation.yield) return 1;
  const level = PROLIFERATOR_LEVELS.find((l) => l.id === setting.level);
  return level?.yield ?? 1;
}

// A pseudo-node standing in for "expand using this recipe" - not a real
// ingredient, so it doesn't recurse and isn't tracked in `ancestors`.
// parentPath is what onChoose(parentPath, recipe.id) records the pick under.
// ingredientIcons is precomputed here (rather than left to the renderer)
// since resolving item icons is what buildTree already has registries for.
// Exported for reusePool.js's injectReuseChoices, which needs to build one
// of these standalone - retroactively turning a single-option node's
// silent auto-resolve into a real choice once reuse turns out to be an
// alternative (see buildTree.js's own autoResolved flag).
export function buildChoiceNode(recipe, itemId, parentPath, depth, registries) {
  return {
    path: `${parentPath}»${recipe.id}`,
    parentPath,
    itemId,
    object: undefined,
    qty: undefined,
    depth: depth + 1,
    isLeaf: true,
    isCycle: false,
    isChoice: true,
    needsChoice: false,
    recipeOptions: [],
    recipe,
    ingredientIcons: Object.keys(recipe.ingredients).map((id) => ({
      id,
      icon: registries.objects.get(id)?.icon,
    })),
    isCollapsed: false,
    children: [],
    byproducts: [],
  };
}

// A pseudo-node standing in for "supply this myself instead" - the
// needsChoice sibling of buildChoiceNode's recipe cards, letting the
// remainder after reuse be left as raw external demand without forcing a
// recipe pick nobody wants (see the needsChoice branch above, and
// reusePool.js's injectReuseChoices, which appends one of these to its own
// retrofitted single-recipe-vs-reuse pair too). Distinct from
// buildReuseChoiceNode (reusePool.js) - that one claims leftover from
// elsewhere in the tree, this one claims nothing at all, just settles the
// choice as "don't craft this."
export function buildDeclineChoiceNode(node) {
  return {
    path: `${node.path}»decline`,
    parentPath: node.path,
    itemId: node.itemId,
    object: node.object,
    qty: undefined,
    depth: node.depth + 1,
    isLeaf: true,
    isCycle: false,
    isChoice: false,
    isReuseChoice: false,
    isDeclineChoice: true,
    needsChoice: false,
    recipeOptions: [],
    recipe: null,
    isCollapsed: false,
    children: [],
    byproducts: [],
  };
}
