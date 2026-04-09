/* ============================================================
 * ui.js — DOM rendering helpers.
 * ============================================================ */

const UI = (() => {
  const $ = (sel) => document.querySelector(sel);

  const el = {
    introPanel: $("#intro-panel"),
    gamePanel: $("#game-panel"),
    loading: $("#loading"),
    startBtn: $("#start-btn"),
    langToggle: $("#lang-toggle"),

    scoreValue: $("#score-value"),
    roundValue: $("#round-value"),
    streakValue: $("#streak-value"),
    effectValue: $("#effect-value"),

    playBtn: $("#play-btn"),
    playsLeftValue: $("#plays-left-value"),

    hints: $("#hints"),

    guessForm: $("#guess-form"),
    guessInput: $("#guess-input"),
    suggestions: $("#suggestions"),
    skipBtn: $("#skip-btn"),

    feedback: $("#feedback"),
    reveal: $("#reveal"),
    revealCard: $("#reveal-card"),
    nextBtn: $("#next-btn"),
  };

  function showIntro() {
    el.introPanel.hidden = false;
    el.gamePanel.hidden = true;
  }

  function showGame() {
    el.introPanel.hidden = true;
    el.gamePanel.hidden = false;
  }

  function showLoading(show) {
    el.loading.hidden = !show;
    el.startBtn.disabled = show;
  }

  function setScore(score) {
    el.scoreValue.textContent = score;
  }
  function setRound(round) {
    el.roundValue.textContent = round;
  }
  function setStreak(streak) {
    el.streakValue.textContent = streak;
  }
  function setPlaysLeft(n) {
    el.playsLeftValue.textContent = n;
    el.playBtn.disabled = n <= 0;
  }

  function setEffect(label) {
    el.effectValue.textContent = label;
  }

  function setPlaying(isPlaying) {
    el.playBtn.classList.toggle("playing", isPlaying);
  }

  function clearHints() {
    el.hints.innerHTML = "";
  }

  /**
   * Hints are progressively revealed. Each hint has:
   *   { kind: "class"|"cost"|"type"|"rarity", label, value }
   */
  function renderHints(hints) {
    clearHints();
    for (const h of hints) {
      const div = document.createElement("div");
      div.className = `hint ${h.kind}`;
      div.innerHTML = `
        <span class="hint-label">${escapeHtml(h.label)}</span>
        <span class="hint-value">${escapeHtml(h.value)}</span>
      `;
      el.hints.appendChild(div);
    }
  }

  function showFeedback(kind, message) {
    el.feedback.hidden = false;
    el.feedback.className = `feedback ${kind}`;
    el.feedback.textContent = message;
  }

  function clearFeedback() {
    el.feedback.hidden = true;
    el.feedback.textContent = "";
    el.feedback.className = "feedback";
  }

  function showReveal(card) {
    el.reveal.hidden = false;
    const classLabel = I18n.t(
      "class_" + (card.cardClass || "NEUTRAL").toUpperCase(),
      card.cardClass
    );
    const typeLabel = I18n.t(
      "type_" + (card.type || "MINION").toUpperCase(),
      card.type
    );
    const rarityLabel = I18n.t(
      "rarity_" + (card.rarity || "FREE").toUpperCase(),
      card.rarity
    );
    el.revealCard.innerHTML = `
      <div class="reveal-name">${escapeHtml(card.name)}</div>
      <div class="reveal-meta">
        <span>${escapeHtml(classLabel)}</span>
        <span>${card.cost ?? "?"} ${escapeHtml(I18n.t("hint_cost"))}</span>
        <span>${escapeHtml(typeLabel)}</span>
        <span>${escapeHtml(rarityLabel)}</span>
      </div>
    `;
  }

  function hideReveal() {
    el.reveal.hidden = true;
    el.revealCard.innerHTML = "";
  }

  function clearGuess() {
    el.guessInput.value = "";
    hideSuggestions();
  }

  function focusGuess() {
    el.guessInput.focus();
  }

  function renderSuggestions(cards, activeIdx = -1) {
    if (!cards.length) {
      hideSuggestions();
      return;
    }
    el.suggestions.hidden = false;
    el.suggestions.innerHTML = "";
    cards.forEach((c, i) => {
      const div = document.createElement("div");
      div.className = "suggestion" + (i === activeIdx ? " active" : "");
      div.dataset.name = c.name;
      const classLabel = I18n.t(
        "class_" + (c.cardClass || "NEUTRAL").toUpperCase(),
        c.cardClass
      );
      div.innerHTML = `
        <span class="suggestion-name">${escapeHtml(c.name)}</span>
        <span class="suggestion-meta">${c.cost ?? "?"} · ${escapeHtml(classLabel)}</span>
      `;
      el.suggestions.appendChild(div);
    });
  }

  function hideSuggestions() {
    el.suggestions.hidden = true;
    el.suggestions.innerHTML = "";
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    el,
    showIntro,
    showGame,
    showLoading,
    setScore,
    setRound,
    setStreak,
    setPlaysLeft,
    setEffect,
    setPlaying,
    clearHints,
    renderHints,
    showFeedback,
    clearFeedback,
    showReveal,
    hideReveal,
    clearGuess,
    focusGuess,
    renderSuggestions,
    hideSuggestions,
  };
})();
