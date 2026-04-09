/* ============================================================
 * audio.js — Voiceline fetch + Web Audio API effects.
 * ============================================================ */

const AudioFX = (() => {
  let ctx = null;
  let currentSource = null;
  let currentlyPlaying = false;
  const bufferCache = new Map(); // url -> AudioBuffer

  function getContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    // Some browsers start the context suspended until a user gesture.
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  async function probeUrl(url) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const audioCtx = getContext();
      // decodeAudioData mutates the buffer on older WebKit — copy defensively.
      const buf = await audioCtx.decodeAudioData(arr.slice(0));
      return buf;
    } catch (e) {
      return null;
    }
  }

  /**
   * Try each candidate URL for a card until one decodes successfully.
   * Returns { buffer, url } or null.
   */
  async function loadCardVoiceline(card) {
    const candidates = API.audioCandidatesFor(card.id);
    for (const url of candidates) {
      if (bufferCache.has(url)) {
        return { buffer: bufferCache.get(url), url };
      }
      const buf = await probeUrl(url);
      if (buf) {
        bufferCache.set(url, buf);
        return { buffer: buf, url };
      }
    }
    return null;
  }

  /**
   * The available modifier effects. Each effect returns a node graph:
   *   { source, output, start(when), stop() }
   * where `output` is the final node to connect to destination.
   */
  const EFFECTS = {
    pitch_up: { key: "effect_pitch_up", build: (buf) => pitchRateEffect(buf, 1.4) },
    pitch_down: { key: "effect_pitch_down", build: (buf) => pitchRateEffect(buf, 0.7) },
    slow: { key: "effect_slow", build: (buf) => pitchRateEffect(buf, 0.75) },
    fast: { key: "effect_fast", build: (buf) => pitchRateEffect(buf, 1.5) },
    reverse: { key: "effect_reverse", build: (buf) => reverseEffect(buf) },
    reverb: { key: "effect_reverb", build: (buf) => reverbEffect(buf) },
    lowpass: { key: "effect_lowpass", build: (buf) => filterEffect(buf, "lowpass", 600) },
    highpass: {
      key: "effect_highpass",
      build: (buf) => filterEffect(buf, "highpass", 1400),
    },
    tremolo: { key: "effect_tremolo", build: (buf) => tremoloEffect(buf) },
    robot: { key: "effect_robot", build: (buf) => robotEffect(buf) },
  };

  const EFFECT_KEYS = Object.keys(EFFECTS);

  function randomEffect() {
    const key = EFFECT_KEYS[Math.floor(Math.random() * EFFECT_KEYS.length)];
    return { id: key, ...EFFECTS[key] };
  }

  /* ---------- Effect builders ---------- */

  function pitchRateEffect(buffer, rate) {
    const c = getContext();
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = c.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    return { source: src, output: gain };
  }

  function reverseEffect(buffer) {
    const reversed = reverseBuffer(buffer);
    return pitchRateEffect(reversed, 1);
  }

  function reverseBuffer(buffer) {
    const c = getContext();
    const out = c.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - i - 1];
    }
    return out;
  }

  function reverbEffect(buffer) {
    const c = getContext();
    const src = c.createBufferSource();
    src.buffer = buffer;
    const convolver = c.createConvolver();
    convolver.buffer = makeImpulseResponse(2.4, 2.2);
    const dry = c.createGain();
    const wet = c.createGain();
    dry.gain.value = 0.5;
    wet.gain.value = 0.7;
    const merger = c.createGain();
    src.connect(dry);
    dry.connect(merger);
    src.connect(convolver);
    convolver.connect(wet);
    wet.connect(merger);
    return { source: src, output: merger };
  }

  function makeImpulseResponse(duration, decay) {
    const c = getContext();
    const rate = c.sampleRate;
    const length = Math.max(1, Math.floor(rate * duration));
    const impulse = c.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  function filterEffect(buffer, type, frequency) {
    const c = getContext();
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 1;
    const gain = c.createGain();
    gain.gain.value = type === "highpass" ? 2 : 1.4; // compensate lost energy
    src.connect(filter);
    filter.connect(gain);
    return { source: src, output: gain };
  }

  function tremoloEffect(buffer) {
    const c = getContext();
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    // LFO modulating the gain between ~0.2 and 1.
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 8;
    lfoGain.gain.value = 0.4;
    gain.gain.value = 0.6;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    src.connect(gain);
    lfo.start();
    return {
      source: src,
      output: gain,
      cleanup: () => {
        try {
          lfo.stop();
        } catch (e) {}
      },
    };
  }

  function robotEffect(buffer) {
    // Ring modulation (multiply signal by a sine wave) — classic robot voice.
    const c = getContext();
    const src = c.createBufferSource();
    src.buffer = buffer;
    const carrier = c.createOscillator();
    carrier.frequency.value = 50;
    const ringGain = c.createGain();
    ringGain.gain.value = 0;
    carrier.connect(ringGain.gain);
    src.connect(ringGain);
    carrier.start();
    return {
      source: src,
      output: ringGain,
      cleanup: () => {
        try {
          carrier.stop();
        } catch (e) {}
      },
    };
  }

  /* ---------- Playback ---------- */

  function stop() {
    if (currentSource) {
      try {
        currentSource.source.stop();
      } catch (e) {}
      if (currentSource.cleanup) currentSource.cleanup();
      currentSource = null;
    }
    currentlyPlaying = false;
  }

  function playWithEffect(buffer, effect) {
    stop();
    const c = getContext();
    const node = effect.build(buffer);
    node.output.connect(c.destination);
    currentSource = node;
    currentlyPlaying = true;
    node.source.onended = () => {
      if (node === currentSource) {
        if (node.cleanup) node.cleanup();
        currentSource = null;
        currentlyPlaying = false;
        document.dispatchEvent(new CustomEvent("audio:ended"));
      }
    };
    node.source.start();
  }

  function isPlaying() {
    return currentlyPlaying;
  }

  return {
    loadCardVoiceline,
    randomEffect,
    playWithEffect,
    stop,
    isPlaying,
    getContext,
    EFFECTS,
  };
})();
