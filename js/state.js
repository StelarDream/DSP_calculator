// Small shared UI state. Plain object, mutated directly by whoever handles
// the relevant event, then a render function is called to reflect it.
export const state = {
  tab: 'item',
  filter: 'all',
  search: '',
  selectedId: null,
  registries: null,
  // 'detail' shows the selected object's page; 'tree' shows the recipe-tree
  // view for treeRecipe (set via the tree button on a recipe card).
  view: 'detail',
  treeRecipe: null,
};
