/* ============================================================
 * api.js — HearthstoneJSON card data fetch, filter & cache.
 *
 * Audio: files live in the public GCS bucket `hearthsounds`
 * (https://storage.googleapis.com/hearthsounds/). The bucket
 * doesn't send CORS headers, so Web Audio API can't decode from
 * fetch — we play with a plain <audio> element instead.
 * The mapping from card id → .wav filename is pre-baked in
 * js/audio-index.json (generated from a bucket listing).
 * ============================================================ */

const API = (() => {
  const CARDS_URL = (locale) =>
    `https://api.hearthstonejson.com/v1/latest/${locale}/cards.json`;

  const AUDIO_BASE = "https://storage.googleapis.com/hearthsounds/";
  const AUDIO_INDEX_URL = "js/audio-index.json";

  // Same exclusions as HearthDoku: skip battlegrounds, mercenaries, tavern brawl, etc.
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

  const ALLOWED_TYPES = new Set(["MINION", "SPELL", "WEAPON", "HERO", "LOCATION"]);

  const LS_KEY = (locale) => `voicestone.cards.${locale}`;

  let cache = {
    locale: null,
    cards: [],
    byId: new Map(),
    byName: new Map(),
  };

  let audioIndex = null; // { cardId: "filename.wav", ... }

  function isExcludedSet(set) {
    if (!set) return true;
    return EXCLUDED_SET_PREFIXES.some((p) => set.startsWith(p));
  }

  function processCards(raw) {
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
      }));
  }

  async function fetchAudioIndex() {
    if (audioIndex) return audioIndex;
    const res = await fetch(AUDIO_INDEX_URL, { cache: "force-cache" });
    if (!res.ok) throw new Error(`audio-index.json HTTP ${res.status}`);
    audioIndex = await res.json();
    return audioIndex;
  }

  async function fetchCards() {
    const locale = I18n.getLang() === "fr" ? "frFR" : "enUS";

    // Load the audio index in parallel with cards when possible.
    const audioPromise = fetchAudioIndex();

    if (cache.locale === locale && cache.cards.length > 0) {
      await audioPromise;
      return cache.cards;
    }

    // localStorage cache (24h TTL)
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
          await audioPromise;
          filterByAudio();
          return cache.cards;
        }
      }
    } catch (e) {
      // ignore corrupt cache
    }

    const res = await fetch(CARDS_URL(locale));
    if (!res.ok) throw new Error(`cards.json HTTP ${res.status}`);
    const raw = await res.json();
    const processed = processCards(raw);

    try {
      localStorage.setItem(
        LS_KEY(locale),
        JSON.stringify({ ts: Date.now(), cards: processed })
      );
    } catch (e) {
      /* quota exceeded */
    }

    setCache(locale, processed);
    await audioPromise;
    filterByAudio();
    return cache.cards;
  }

  /**
   * Drop cards that have no voiceline in the pre-baked index, so the
   * game never picks a card without audio.
   */
  function filterByAudio() {
    if (!audioIndex) return;
    const before = cache.cards.length;
    const withAudio = cache.cards.filter((c) => audioIndex[c.id]);
    setCache(cache.locale, withAudio);
    console.log(
      `[VoiceStone] ${withAudio.length}/${before} cards have a voiceline`
    );
  }

  function setCache(locale, cards) {
    cache.locale = locale;
    cache.cards = cards;
    cache.byId = new Map(cards.map((c) => [c.id, c]));
    cache.byName = new Map(cards.map((c) => [normalizeName(c.name), c]));
  }

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

  function audioUrlForCard(card) {
    if (!audioIndex) return null;
    const file = audioIndex[card.id];
    if (!file) return null;
    return AUDIO_BASE + file;
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
    audioUrlForCard,
  };
})();
