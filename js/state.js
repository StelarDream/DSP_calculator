// Small shared UI state. Plain object, mutated directly by whoever handles
// the relevant event, then a render function is called to reflect it.
export const state = {
  tab: 'item',
  filter: 'all',
  search: '',
  selectedId: null,
  registries: null,
  // 'detail' shows the selected object's page; 'tree' shows the recipe-tree
  // view for treeRecipe (set via the tree button on a recipe card); 'factory'
  // shows Factory View, reached from the tree view's Factory View button.
  view: 'detail',
  treeRecipe: null,
  // { choices, overrides } to seed the tree view with instead of starting
  // fresh - only set when restoring a shared link (see main.js), and
  // consumed once by the next renderTreeView call.
  treeInitialState: null,
  // Snapshot of the tree ({ subjectId, recipe, choices, overrides,
  // proliferation }) Factory View was opened from - lets "Back" restore
  // the tree exactly as it was. Only meaningful while view === 'factory'.
  factoryTreeState: null,
};
