// Proliferator tiers and their per-mode multipliers - from the in-game
// stats, not derived from anything else in the data set. itemId points at
// the existing item sprite (assets/items/proliferator-mk-*.png) for the
// level picker's icons.
export const PROLIFERATOR_LEVELS = [
  { id: 'mk1', label: 'MK.I', itemId: 'proliferator-mk-i', yield: 1.125, speed: 1.25, chance: 1.25, amount: 12 },
  { id: 'mk2', label: 'MK.II', itemId: 'proliferator-mk-ii', yield: 1.2, speed: 1.5, chance: 1.5, amount: 24 },
  { id: 'mk3', label: 'MK.III', itemId: 'proliferator-mk-iii', yield: 1.25, speed: 2, chance: 2, amount: 60 },
];
