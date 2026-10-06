// Shared between AdminDashboard's Anmälningar filter and ActivityReport's
// activity picker - both need the same "which year/term combinations
// actually exist in this data" + "newest first" logic. Terms sort by year
// descending, then Höst after Vår within the same year - the troop's real
// chronological order (spring term runs before that year's fall term).
const TERM_ORDER = { Vår: 0, Höst: 1 };

export function termKey(year, term) {
  return `${year}|${term}`;
}

export function termLabel(year, term) {
  return `${term} ${year}`;
}

// items: anything with {year, term} fields (applications or activities).
// Entries with no year/term (e.g. standing-role activities, which aren't
// tied to a single term) are excluded - there's nothing to group them into.
export function collectTermOptions(items) {
  const unique = new Map();
  items.forEach(({ year, term }) => {
    if (!year || !term) return;
    const key = termKey(year, term);
    if (!unique.has(key)) unique.set(key, { year, term });
  });
  return [...unique.values()].sort((a, b) => {
    if (a.year !== b.year) return Number(b.year) - Number(a.year);
    return (TERM_ORDER[b.term] ?? 0) - (TERM_ORDER[a.term] ?? 0);
  });
}
