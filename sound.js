(function () {
  let ctx = null;
  let muted = false;
  let sourceUrl = null;
  let buffer = null;
  let loadPromise = null;
  let audioEl = null;

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  function ensureBuffer() {
    if (!sourceUrl) return Promise.resolve(null);
    if (buffer) return Promise.resolve(buffer);
    if (loadPromise) return loadPromise;
    const ac = getCtx();
    if (!ac) return Promise.resolve(null);
    loadPromise = fetch(sourceUrl, { mode: 'cors' })
      .then(r => r.arrayBuffer())
      .then(ab => ac.decodeAudioData(ab))
      .then(b => { buffer = b; return b; })
      .catch(() => { loadPromise = null; return null; });
    return loadPromise;
  }

  function ensureAudioEl() {
    if (!sourceUrl) return null;
    if (!audioEl) {
      audioEl = new Audio(sourceUrl);
      audioEl.preload = 'auto';
      audioEl.crossOrigin = 'anonymous';
    }
    return audioEl;
  }

  function unlock() {
    try {
      const ac = getCtx();
      if (ac && ac.state === 'suspended') ac.resume();
    } catch (e) { /* noop */ }
  }

  function preload() {
    ensureBuffer();
    ensureAudioEl();
  }

  function play(opts) {
    if (muted) return null;
    const targetDuration = (opts && opts.duration) || 0;
    const ac = getCtx();
    if (ac && ac.state === 'suspended') ac.resume();

    if (ac && buffer) {
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const when = ac.currentTime + 0.005;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(1, when + 0.02);
      let playDuration = buffer.duration;
      if (targetDuration > 0 && buffer.duration > targetDuration) {
        playDuration = targetDuration;
        gain.gain.setValueAtTime(1, when + playDuration - 0.12);
        gain.gain.linearRampToValueAtTime(0.0001, when + playDuration);
        src.start(when);
        src.stop(when + playDuration);
      } else {
        src.start(when);
      }
      src.connect(gain).connect(ac.destination);
      return { when, duration: playDuration };
    }

    const ext = ensureAudioEl();
    if (ext) {
      try {
        ext.currentTime = 0;
        const p = ext.play();
        if (p && p.catch) p.catch(() => {});
        return { when: performance.now(), duration: ext.duration || targetDuration };
      } catch (e) { /* noop */ }
    }
    return null;
  }

  function setMuted(v) {
    muted = !!v;
    if (audioEl) audioEl.muted = muted;
  }
  function isMuted() { return muted; }

  function setSource(url) {
    if (sourceUrl === url) return;
    sourceUrl = url || null;
    buffer = null;
    loadPromise = null;
    if (audioEl) {
      audioEl.pause();
      audioEl = null;
    }
    if (sourceUrl) preload();
  }

  window.printerSound = { play, setMuted, isMuted, unlock, setSource, preload };
})();