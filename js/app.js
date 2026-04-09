/* ============================================================
 * app.js — initialization and event wiring.
 * ============================================================ */

(function () {
  const el = UI.el;
  let suggestionIdx = -1;
  let lastSuggestions = [];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    I18n.apply();

    el.langToggle.addEventListener("click", () => {
      I18n.toggleLang();
    });

    document.addEventListener("i18n:change", async () => {
      // Re-fetch in the new locale so card names & suggestions match.
      try {
        UI.showLoading(true);
        await API.fetchCards();
        CardSearch.build();
      } catch (e) {
        // ignore — user can retry from intro
      } finally {
        UI.showLoading(false);
      }
    });

    el.startBtn.addEventListener("click", onStart);
    el.playBtn.addEventListener("click", () => Game.play());
    el.skipBtn.addEventListener("click", () => Game.skip());
    el.nextBtn.addEventListener("click", async () => {
      await Game.nextRound();
    });

    el.guessForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (suggestionIdx >= 0 && lastSuggestions[suggestionIdx]) {
        Game.submitGuess(lastSuggestions[suggestionIdx].name);
      } else {
        Game.submitGuess(el.guessInput.value);
      }
    });

    el.guessInput.addEventListener("input", onGuessInput);
    el.guessInput.addEventListener("keydown", onGuessKeyDown);
    el.guessInput.addEventListener("blur", () => {
      // Delay so click on a suggestion can fire first.
      setTimeout(() => UI.hideSuggestions(), 120);
    });

    el.suggestions.addEventListener("mousedown", (e) => {
      const item = e.target.closest(".suggestion");
      if (!item) return;
      const name = item.dataset.name;
      el.guessInput.value = name;
      UI.hideSuggestions();
      Game.submitGuess(name);
    });

    document.addEventListener("audio:ended", () => Game.onAudioEnded());
  }

  async function onStart() {
    try {
      UI.showLoading(true);
      await API.fetchCards();
      Game.init();
      UI.showGame();
      UI.setScore(Game.state.score);
      UI.setRound(Game.state.round);
      UI.setStreak(Game.state.streak);
      UI.setPlaysLeft(3);
      await Game.nextRound();
    } catch (e) {
      console.error(e);
      alert(I18n.t("api_error"));
    } finally {
      UI.showLoading(false);
    }
  }

  function onGuessInput(e) {
    const q = e.target.value;
    lastSuggestions = CardSearch.search(q, 8);
    suggestionIdx = -1;
    UI.renderSuggestions(lastSuggestions, suggestionIdx);
  }

  function onGuessKeyDown(e) {
    if (el.suggestions.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      suggestionIdx = Math.min(suggestionIdx + 1, lastSuggestions.length - 1);
      UI.renderSuggestions(lastSuggestions, suggestionIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      suggestionIdx = Math.max(suggestionIdx - 1, -1);
      UI.renderSuggestions(lastSuggestions, suggestionIdx);
    } else if (e.key === "Escape") {
      UI.hideSuggestions();
      suggestionIdx = -1;
    }
  }
})();
