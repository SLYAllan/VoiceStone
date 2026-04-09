/* ============================================================
 * api.js — HearthstoneJSON card data fetch, filter & cache.
 * Mirrors the HearthDoku filtering logic.
 * ============================================================ */

const API = (() => {
  const CARDS_URL = (locale) =>
    `https://api.hearthstonejson.com/v1/latest/${locale}/cards.json`;

  // HearthstoneJSON audio is served from a few CDN endpoints depending on year.
  // We'll probe several known base URLs; the first that responds 200 wins.
  // Order matters — most likely first.
  const AUDIO_BASES = [
    "https://art.hearthstonejson.com/v1/sounds/",
    "https://audio.hearthstonejson.com/v1/",
  ];

  // Same exclusions as HearthDoku: skip battlegrounds, mercenaries, tavern brawl, etc.
  // These prefixes show up at the start of the `set` field.
  const EXCLUDED_SET_PREFIXES = [
    "BATTLEGROUNDS",
    "MERCENARIES",
    "TB_",
    "TAVERNS_OF_TIME",
    "CREDITS",
    "HERO_SKINS",
    "GAME_",
    "MISSIONS",
    "CHEAT",
    "WILD_EVENT",
    "PROMO",
  ];

  // Keep only these card types in the pool.
  const ALLOWED_TYPES = new Set(["MINION", "SPELL", "WEAPON", "HERO", "LOCATION"]);

  // HearthstoneJSON doesn't directly expose voiceline filenames on the card
  // record, so we probe a small set of likely (prefix, suffix) combinations
  // for each card id. Order matters — most likely first.
  const VOICELINE_PATTERNS = [
    { prefix: "VO_", suffix: "_Play_01.ogg" },
    { prefix: "VO_", suffix: "_Play.ogg" },
    { prefix: "", suffix: "_Play_01.ogg" },
    { prefix: "VO_", suffix: "_Attack_01.ogg" },
    { prefix: "", suffix: "_Attack_01.ogg" },
    { prefix: "", suffix: ".ogg" },
  ];

  const LS_KEY = (locale) => `voicestone.cards.${locale}`;

  let cache = {
    locale: null,
    cards: [],
    byId: new Map(),
    byName: new Map(),
  };

  function isExcludedSet(set) {
    if (!set) return true;
    return EXCLUDED_SET_PREFIXES.some((p) => set.startsWith(p));
  }

  function processCards(raw) {
    // Keep only collectible, playable cards from allowed sets.
    return raw
      .filter((c) => c.collectible === true)
      .filter((c) => c.id && c.name)
      .filter((c) => c.type && ALLOWED_TYPES.has(c.type))
      .filter((c) => !isExcludedSet(c.set))
      .map((c) => ({
        id: c.id,
        name: c.name,
        cardClass: c.cardClass || "NEUTRAL",
        classes: c.classes || [c.cardClass || "NEUTRAL"],
        cost: c.cost ?? null,
        type: c.type,
        rarity: c.rarity || "FREE",
        set: c.set,
        text: c.text || "",
        attack: c.attack ?? null,
        health: c.health ?? null,
      }));
  }

  async function fetchCards() {
    const locale = I18n.getLang() === "fr" ? "frFR" : "enUS";

    // In-memory cache hit
    if (cache.locale === locale && cache.cards.length > 0) {
      return cache.cards;
    }

    // localStorage cache (small TTL so data stays fresh between patches)
    try {
      const stored = localStorage.getItem(LS_KEY(locale));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          parsed.ts &&
          Date.now() - parsed.ts < 24 * 60 * 60 * 1000 &&
          Array.isArray(parsed.cards)
        ) {
          setCache(locale, parsed.cards);
          return cache.cards;
        }
      }
    } catch (e) {
      // ignore corrupt cache
    }

    const res = await fetch(CARDS_URL(locale));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const processed = processCards(raw);

    try {
      localStorage.setItem(
        LS_KEY(locale),
        JSON.stringify({ ts: Date.now(), cards: processed })
      );
    } catch (e) {
      // Quota exceeded — that's fine, we still have in-memory cache.
    }

    setCache(locale, processed);
    return cache.cards;
  }

  function setCache(locale, cards) {
    cache.locale = locale;
    cache.cards = cards;
    cache.byId = new Map(cards.map((c) => [c.id, c]));
    cache.byName = new Map(cards.map((c) => [normalizeName(c.name), c]));
  }

  /**
   * Normalize a name for comparison: lowercase, strip accents, trim punctuation.
   */
  function normalizeName(name) {
    if (!name) return "";
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Build a list of candidate audio URLs for a card.
   * Each entry is { url, base, pattern } so the caller can remember which
   * combination worked and prioritize it on subsequent lookups.
   */
  function audioCandidatesFor(cardId) {
    const out = [];
    for (const base of AUDIO_BASES) {
      for (const pattern of VOICELINE_PATTERNS) {
        out.push({
          url: `${base}${pattern.prefix}${cardId}${pattern.suffix}`,
          base,
          pattern,
        });
      }
    }
    return out;
  }

  function audioUrlFor(cardId, base, pattern) {
    return `${base}${pattern.prefix}${cardId}${pattern.suffix}`;
  }

  function getCards() {
    return cache.cards;
  }

  function findByName(name) {
    return cache.byName.get(normalizeName(name)) || null;
  }

  return {
    fetchCards,
    getCards,
    findByName,
    normalizeName,
    audioCandidatesFor,
    audioUrlFor,
  };
})();
