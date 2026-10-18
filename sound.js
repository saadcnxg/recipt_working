(function () {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  function unlock() {
    try {
      const ac = getCtx();
      if (ac && ac.state === 'suspended') ac.resume();
    } catch (e) { /* noop */ }
  }

  function play() {
    if (muted) return;
    try {
      const ac = getCtx();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume();
      const now = ac.currentTime;
      const DURATION = 2.2;

      const master = ac.createGain();
      master.gain.value = 0.07;
      master.connect(ac.destination);

      // Motor hum
      const motor = ac.createOscillator();
      const motorGain = ac.createGain();
      motor.type = 'sawtooth';
      motor.frequency.setValueAtTime(58, now);
      motor.frequency.linearRampToValueAtTime(66, now + DURATION);
      motorGain.gain.setValueAtTime(0.28, now);
      motorGain.gain.linearRampToValueAtTime(0.12, now + DURATION);
      motor.connect(motorGain).connect(master);
      motor.start(now);
      motor.stop(now + DURATION);

      // Paper whirr filter
      const filt = ac.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(1200, now);
      filt.frequency.linearRampToValueAtTime(700, now + DURATION);
      filt.connect(master);

      // Pre-build noise buffer
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.03), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      const TICK_COUNT = 44;
      const STEP = DURATION / TICK_COUNT;
      for (let i = 0; i < TICK_COUNT; i++) {
        const t = now + 0.05 + i * STEP + Math.random() * 0.008;
        const src = ac.createBufferSource();
        src.buffer = buf;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.45, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        src.connect(g).connect(filt);
        src.start(t);
        src.stop(t + 0.03);
      }
    } catch (e) { /* noop */ }
  }

  function setMuted(v) { muted = !!v; }
  function isMuted() { return muted; }

  window.printerSound = { play, setMuted, isMuted, unlock };
})();