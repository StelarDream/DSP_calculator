// Whether a specific line+item's production counts as reusable internal
// supply rather than waste. A recipe's primary result is always reusable -
// there's no toggle for it (see factoryCard.js, only non-primary Output
// rows get one) - every other result defers to the byproductReuse map
// (see factoryView.js), defaulting to reused when the user hasn't touched
// it. Shared by buildFactoryPlan.js (machine-count math, deciding which
// items can share one batch of crafts) and computeRawInputs.js (the
// bottom bar's raw-input netting) so the two can never disagree about
// which lines are actually sharing.
export function isItemReused(byproductReuse, lineKey, itemId, primaryItemId) {
  return itemId === primaryItemId || (byproductReuse?.get(`${lineKey}::${itemId}`) ?? true);
}
