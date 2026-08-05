// Two decimals max, but drop the decimal entirely when it's a whole number
// (most quantities are; fractional ones only show up from ratio scaling).
export function formatQty(qty) {
  const rounded = Math.round(qty * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
