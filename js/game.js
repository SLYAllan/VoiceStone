/* ============================================================
 * game.js — round logic, hint progression, scoring.
 * ============================================================ */

const Game = (() => {
  const MAX_PLAYS = 3;
  // Hint progression order: each failed guess / extra listen reveals one.
  const HINT_ORDER = ["class", "cost", "type", "rarity"];

  const state = {
    pool: [],
    current: null, // { card, buffer, effect }
    attempts: 0,
    playsLeft: MAX_PLAYS,
    hintsShown: 0, // index into HINT_ORDER
    round: 1,
    score: 0,
    streak: 0,
    locked: false, // round over, waiting for "next"
  };

  function init() {
    state.pool = API.getCards().slice();
    shuffle(state.pool);
    CardSearch.build();
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  async function nextRound() {
    UI.clearFeedback();
    UI.hideReveal();
    UI.clearHints();
    UI.clearGuess();
    state.attempts = 0;
    state.playsLeft = MAX_PLAYS;
    state.hintsShown = 0;
    state.locked = false;
    UI.setPlaysLeft(state.playsLeft);
    UI.setRound(state.round);

    // Pick a card with a known voiceline — probe until we find one.
    let attempts = 0;
    while (attempts < 40) {
      if (state.pool.length === 0) {
        state.pool = API.getCards().slice();
        shuffle(state.pool);
      }
      const card = state.pool.pop();
      attempts++;
      UI.setEffect("…");
      const loaded = await AudioFX.loadCardVoiceline(card);
      if (loaded && loaded.buffer) {
        const effect = AudioFX.randomEffect();
        state.current = { card, buffer: loaded.buffer, effect };
        UI.setEffect(I18n.t(effect.key));
        UI.focusGuess();
        return;
      }
      // No audio for this card — try the next one.
    }
    // Give up after too many misses.
    UI.showFeedback("info", I18n.t("api_error"));
  }

  function play() {
    if (!state.current || state.locked) return;
    if (state.playsLeft <= 0) return;
    state.playsLeft--;
    UI.setPlaysLeft(state.playsLeft);
    UI.setPlaying(true);
    AudioFX.playWithEffect(state.current.buffer, state.current.effect);
  }

  function submitGuess(rawGuess) {
    if (!state.current || state.locked) return;
    const guess = (rawGuess || "").trim();
    if (!guess) {
      UI.showFeedback("info", I18n.t("empty_guess"));
      return;
    }
    const match = API.findByName(guess);
    if (!match) {
      UI.showFeedback("info", I18n.t("unknown_card"));
      return;
    }
    state.attempts++;

    if (match.id === state.current.card.id) {
      // Correct! Score is based on how few hints we needed and plays used.
      const hintsUsed = state.hintsShown;
      const playsUsed = MAX_PLAYS - state.playsLeft;
      const roundScore = Math.max(
        10,
        100 - hintsUsed * 20 - (playsUsed - 1) * 5 - (state.attempts - 1) * 10
      );
      state.score += roundScore;
      state.streak += 1;
      state.round += 1;
      UI.setScore(state.score);
      UI.setStreak(state.streak);
      UI.showFeedback("correct", `${I18n.t("correct")} +${roundScore}`);
      UI.showReveal(state.current.card);
      state.locked = true;
      AudioFX.stop();
      UI.setPlaying(false);
    } else {
      UI.showFeedback("wrong", I18n.t("wrong"));
      revealNextHint();
    }
  }

  function skip() {
    if (!state.current || state.locked) return;
    state.streak = 0;
    state.round += 1;
    UI.setStreak(state.streak);
    UI.showFeedback("info", I18n.t("skipped"));
    UI.showReveal(state.current.card);
    state.locked = true;
    AudioFX.stop();
    UI.setPlaying(false);
  }

  function revealNextHint() {
    if (state.hintsShown >= HINT_ORDER.length) return;
    const hints = [];
    for (let i = 0; i <= state.hintsShown; i++) {
      const kind = HINT_ORDER[i];
      hints.push(makeHint(kind, state.current.card));
    }
    state.hintsShown++;
    UI.renderHints(hints);
  }

  function makeHint(kind, card) {
    switch (kind) {
      case "class": {
        const cls = (card.cardClass || "NEUTRAL").toUpperCase();
        return {
          kind: "class",
          label: I18n.t("hint_class"),
          value: I18n.t("class_" + cls, card.cardClass),
        };
      }
      case "cost":
        return {
          kind: "cost",
          label: I18n.t("hint_cost"),
          value: card.cost == null ? "?" : String(card.cost),
        };
      case "type": {
        const type = (card.type || "MINION").toUpperCase();
        return {
          kind: "type",
          label: I18n.t("hint_type"),
          value: I18n.t("type_" + type, card.type),
        };
      }
      case "rarity": {
        const rar = (card.rarity || "FREE").toUpperCase();
        return {
          kind: "rarity",
          label: I18n.t("hint_rarity"),
          value: I18n.t("rarity_" + rar, card.rarity),
        };
      }
    }
  }

  function onAudioEnded() {
    UI.setPlaying(false);
  }

  return {
    state,
    init,
    nextRound,
    play,
    submitGuess,
    skip,
    onAudioEnded,
  };
})();
