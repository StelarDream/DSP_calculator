// Small shared UI state. Plain object, mutated directly by whoever handles
// the relevant event, then a render function is called to reflect it.
export const state = {
  tab: 'items',
  filter: 'all',
  registries: null,
};
