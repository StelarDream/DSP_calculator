// Picks which objects belong in the sidebar list for the current
// tab/filter/search combination. Both `tab` and `filter` are tag names
// (or 'all'), so this stays generic as more tags get added later.
export function selectEntities(state, registries) {
  if (!registries) return [];

  const { tab, filter, search } = state;
  const query = search.trim().toLowerCase();

  return Array.from(registries.objects.values())
    .filter((obj) => obj.tags.has(tab))
    .filter((obj) => filter === 'all' || obj.tags.has(filter))
    .filter((obj) => !query || obj.id.toLowerCase().includes(query))
    .sort((a, b) => a.id.localeCompare(b.id));
}
