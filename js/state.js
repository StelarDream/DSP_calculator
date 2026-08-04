// Small shared UI state. Plain object, mutated directly by whoever handles
// the relevant event, then a render function is called to reflect it.
export const state = {
  tab: 'item',
  filter: 'all',
  search: '',
  selectedId: null,
  registries: null,
};
