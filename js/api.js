/* ============================================================
 * api.js — HearthstoneJSON card data fetch, filter & cache.
 * Mirrors the HearthDoku filtering logic.
 * ============================================================ */

const API = (() => {
  const CARDS_URL = (locale) =>
    `https://api.hearthstonejson.com/v1/latest/${locale}/cards.json`;

  const AUDIO_BASE = "https://audio.hearthstonejson.com/v1/";

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

  // Voiceline sound-kit categories we'll consider (card's soundFamily/pixiv vary by set).
  // HearthstoneJSON exposes per-card `name`, `id`, `cardClass`, `cost`, `type`, etc.
  // It does NOT always give direct URLs. We derive audio URLs from the card `id`.
  // Common playable voicelines are under `{id}_PLAY_01.ogg` or similar.
  //
  // Because we can't always predict the exact filename, we try a small set of
  // candidates per card and cache the first one that resolves to HTTP 200.
  const VOICELINE_CANDIDATES = [
    "_PLAY_01.ogg",
    "_PLAY_02.ogg",
    "_ATTACK_01.ogg",
    "_ATTACK_02.ogg",
    "_DEATH_01.ogg",
    ".ogg",
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
   * We'll probe them in order; the first that loads wins.
   */
  function audioCandidatesFor(cardId) {
    return VOICELINE_CANDIDATES.map((suffix) => AUDIO_BASE + cardId + suffix);
  }

  function getCards() {
    return cache.cards;
  }

  function findByName(name) {
    return cache.byName.get(normalizeName(name)) || null;
  }

  function getAudioBase() {
    return AUDIO_BASE;
  }

  return {
    fetchCards,
    getCards,
    findByName,
    normalizeName,
    audioCandidatesFor,
    getAudioBase,
  };
})();
