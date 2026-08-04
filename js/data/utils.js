export async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// Some factory/collector multipliers are a single number, others a [min, max]
// range. Normalize both shapes to {min, max} so consumers don't have to care.
export function normalizeRange(value, fallback = 1) {
  if (value == null) return { min: fallback, max: fallback };
  if (Array.isArray(value)) return { min: value[0], max: value[1] };
  return { min: value, max: value };
}
