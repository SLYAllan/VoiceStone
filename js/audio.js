/* ============================================================
 * audio.js — Voiceline playback via HTMLAudioElement.
 *
 * The GCS `hearthsounds` bucket doesn't send CORS headers, so
 * Web Audio API (decodeAudioData + effect graph) can't run. A
 * plain <audio> element, however, can play cross-origin media
 * without CORS — we just lose access to the raw samples. That
 * restricts us to effects expressible via playbackRate and
 * preservesPitch, which is still enough for the core gimmick:
 * high-pitched, low-pitched, slowed and sped-up voicelines.
 * ============================================================ */

const AudioFX = (() => {
  const audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("ended", () => {
    document.dispatchEvent(new CustomEvent("audio:ended"));
  });
  audio.addEventListener("error", () => {
    console.warn("[VoiceStone] audio error:", audio.error, audio.src);
    document.dispatchEvent(new CustomEvent("audio:ended"));
  });

  /**
   * Available effects. Each effect is expressed as a pair of
   * (playbackRate, preservesPitch) applied to the <audio> element.
   *   preservesPitch = false → pitch changes with rate (aigu/grave)
   *   preservesPitch = true  → only tempo changes (rapide/lent)
   */
  const EFFECTS = {
    pitch_up: { key: "effect_pitch_up", rate: 1.5, preservesPitch: false },
    pitch_down: { key: "effect_pitch_down", rate: 0.7, preservesPitch: false },
    slow: { key: "effect_slow", rate: 0.65, preservesPitch: true },
    fast: { key: "effect_fast", rate: 1.6, preservesPitch: true },
    chipmunk: { key: "effect_pitch_up", rate: 1.75, preservesPitch: false },
    giant: { key: "effect_pitch_down", rate: 0.55, preservesPitch: false },
  };

  const EFFECT_KEYS = Object.keys(EFFECTS);

  function randomEffect() {
    const key = EFFECT_KEYS[Math.floor(Math.random() * EFFECT_KEYS.length)];
    return { id: key, ...EFFECTS[key] };
  }

  /**
   * Pre-load the audio for a card. Resolves with `{ url }` when the
   * file is ready to play, or `null` if it errors out.
   */
  function loadCardVoiceline(card) {
    const url = API.audioUrlForCard(card);
    if (!url) return Promise.resolve(null);
    return new Promise((resolve) => {
      const probe = new Audio();
      probe.preload = "auto";
      let done = false;
      const ok = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ url });
      };
      const fail = () => {
        if (done) return;
        done = true;
        cleanup();
        console.warn("[VoiceStone] preload failed", url);
        resolve(null);
      };
      const cleanup = () => {
        probe.removeEventListener("canplaythrough", ok);
        probe.removeEventListener("loadeddata", ok);
        probe.removeEventListener("error", fail);
      };
      probe.addEventListener("canplaythrough", ok);
      probe.addEventListener("loadeddata", ok);
      probe.addEventListener("error", fail);
      probe.src = url;
      // Safety timeout — if the network stalls, give up.
      setTimeout(fail, 6000);
    });
  }

  function stop() {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  }

  function playWithEffect(loaded, effect) {
    if (!loaded || !loaded.url) return;
    stop();
    audio.src = loaded.url;
    // mozPreservesPitch / webkitPreservesPitch for older engines
    audio.preservesPitch = effect.preservesPitch;
    if ("mozPreservesPitch" in audio) audio.mozPreservesPitch = effect.preservesPitch;
    if ("webkitPreservesPitch" in audio)
      audio.webkitPreservesPitch = effect.preservesPitch;
    audio.playbackRate = effect.rate;
    const p = audio.play();
    if (p && p.catch) {
      p.catch((err) => {
        console.warn("[VoiceStone] playback rejected:", err && err.message);
      });
    }
  }

  function isPlaying() {
    return !audio.paused && !audio.ended;
  }

  return {
    loadCardVoiceline,
    randomEffect,
    playWithEffect,
    stop,
    isPlaying,
    EFFECTS,
  };
})();
