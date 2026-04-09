/* ============================================================
 * card-search.js — Autocomplete against the full card list.
 * Accent- and case-insensitive, fuzzy-ish (substring match).
 * ============================================================ */

const CardSearch = (() => {
  let index = [];

  function build() {
    index = API.getCards().map((c) => ({
      card: c,
      norm: API.normalizeName(c.name),
    }));
    // Stable ordering for deterministic suggestions
    index.sort((a, b) => a.card.name.localeCompare(b.card.name));
  }

  function search(query, limit = 8) {
    const q = API.normalizeName(query);
    if (!q) return [];
    const starts = [];
    const contains = [];
    for (const item of index) {
      if (item.norm === q) {
        starts.unshift(item.card);
      } else if (item.norm.startsWith(q)) {
        starts.push(item.card);
      } else if (item.norm.includes(q)) {
        contains.push(item.card);
      }
      if (starts.length + contains.length >= limit * 3) break;
    }
    return starts.concat(contains).slice(0, limit);
  }

  function exactMatch(query) {
    return API.findByName(query);
  }

  return { build, search, exactMatch };
})();
