/* ============================================================
 * i18n.js — bilingual (FR / EN) translations for VoiceStone
 * Mirrors the HearthDoku I18n pattern.
 * ============================================================ */

const I18n = (() => {
  const STORAGE_KEY = "voicestone.lang";

  const DICT = {
    fr: {
      title: "VoiceStone",
      tagline: "Devine la carte Hearthstone à partir de sa réplique modifiée.",
      start: "Commencer",
      loading: "Chargement des cartes…",
      score: "Score",
      round: "Manche",
      streak: "Série",
      effect: "Effet",
      play_hint: "Clique pour écouter la réplique",
      plays_left: "Écoutes restantes",
      guess_placeholder: "Nom de la carte…",
      guess: "Deviner",
      skip: "Passer",
      next: "Carte suivante",
      footer: "Non affilié à Blizzard. Données fournies par HearthstoneJSON.",

      // Gameplay
      correct: "Bravo ! Tu as trouvé la carte.",
      wrong: "Ce n'est pas ça, essaie encore.",
      skipped: "Manche passée.",
      revealed: "La carte était :",
      no_audio: "Pas d'audio disponible pour cette carte, on en tire une autre…",
      api_error: "Impossible de charger les cartes. Réessaie plus tard.",
      empty_guess: "Saisis un nom de carte.",
      unknown_card: "Carte inconnue. Choisis dans les suggestions.",

      // Hint labels
      hint_class: "Classe",
      hint_cost: "Coût en mana",
      hint_type: "Type",
      hint_rarity: "Rareté",

      // Effects (HTMLAudioElement-compatible: playbackRate + preservesPitch)
      effect_pitch_up: "Voix aiguë",
      effect_pitch_down: "Voix grave",
      effect_slow: "Ralenti",
      effect_fast: "Accéléré",

      // Classes (card data sometimes uses English keys)
      class_DRUID: "Druide",
      class_HUNTER: "Chasseur",
      class_MAGE: "Mage",
      class_PALADIN: "Paladin",
      class_PRIEST: "Prêtre",
      class_ROGUE: "Voleur",
      class_SHAMAN: "Chaman",
      class_WARLOCK: "Démoniste",
      class_WARRIOR: "Guerrier",
      class_DEMONHUNTER: "Chasseur de démons",
      class_DEATHKNIGHT: "Chevalier de la mort",
      class_NEUTRAL: "Neutre",

      // Card types
      type_MINION: "Serviteur",
      type_SPELL: "Sort",
      type_WEAPON: "Arme",
      type_HERO: "Héros",
      type_LOCATION: "Lieu",

      // Rarity
      rarity_FREE: "De base",
      rarity_COMMON: "Commune",
      rarity_RARE: "Rare",
      rarity_EPIC: "Épique",
      rarity_LEGENDARY: "Légendaire",
    },

    en: {
      title: "VoiceStone",
      tagline: "Guess the Hearthstone card from its modified voiceline.",
      start: "Start",
      loading: "Loading cards…",
      score: "Score",
      round: "Round",
      streak: "Streak",
      effect: "Effect",
      play_hint: "Click to play the voiceline",
      plays_left: "Plays left",
      guess_placeholder: "Card name…",
      guess: "Guess",
      skip: "Skip",
      next: "Next card",
      footer: "Not affiliated with Blizzard. Data from HearthstoneJSON.",

      correct: "Correct! You found the card.",
      wrong: "Not quite, try again.",
      skipped: "Round skipped.",
      revealed: "The card was:",
      no_audio: "No audio available for this card, picking another one…",
      api_error: "Unable to load cards. Try again later.",
      empty_guess: "Type a card name.",
      unknown_card: "Unknown card. Pick one from the suggestions.",

      hint_class: "Class",
      hint_cost: "Mana cost",
      hint_type: "Type",
      hint_rarity: "Rarity",

      effect_pitch_up: "High-pitched",
      effect_pitch_down: "Low-pitched",
      effect_slow: "Slowed down",
      effect_fast: "Sped up",

      class_DRUID: "Druid",
      class_HUNTER: "Hunter",
      class_MAGE: "Mage",
      class_PALADIN: "Paladin",
      class_PRIEST: "Priest",
      class_ROGUE: "Rogue",
      class_SHAMAN: "Shaman",
      class_WARLOCK: "Warlock",
      class_WARRIOR: "Warrior",
      class_DEMONHUNTER: "Demon Hunter",
      class_DEATHKNIGHT: "Death Knight",
      class_NEUTRAL: "Neutral",

      type_MINION: "Minion",
      type_SPELL: "Spell",
      type_WEAPON: "Weapon",
      type_HERO: "Hero",
      type_LOCATION: "Location",

      rarity_FREE: "Basic",
      rarity_COMMON: "Common",
      rarity_RARE: "Rare",
      rarity_EPIC: "Epic",
      rarity_LEGENDARY: "Legendary",
    },
  };

  let currentLang = detectInitialLang();

  function detectInitialLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICT[stored]) return stored;
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return DICT[nav] ? nav : "en";
  }

  function t(key, fallback) {
    const dict = DICT[currentLang] || DICT.en;
    return dict[key] ?? fallback ?? key;
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (!DICT[lang]) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    apply();
    document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang } }));
  }

  function toggleLang() {
    setLang(currentLang === "fr" ? "en" : "fr");
  }

  /**
   * Apply translations to every element with a data-i18n attribute.
   * - data-i18n             → textContent
   * - data-i18n-placeholder → input placeholder
   * - data-i18n-title       → title attribute
   */
  function apply() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", t(key));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      el.setAttribute("title", t(key));
    });
    // Active pill in the language toggle
    document.querySelectorAll("[data-lang]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-lang") === currentLang);
    });
  }

  return { t, getLang, setLang, toggleLang, apply };
})();
