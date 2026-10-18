/**
 * Sound cues for the Repo Genesis showcase.
 * Uses the Web Audio API — zero asset files required.
 * Replace tone() with `new Audio('./cue.mp3').play()` if you'd rather ship real audio files.
 */

let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function initAudio() {
  // Must be called from a user gesture at least once to unlock audio on Chrome/Safari.
  getCtx();
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function sweep(startFreq, endFreq, dur, vol = 0.09) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, t0);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.02);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playCue(name) {
  switch (name) {
    case 'open':
      tone(660, 0.08, 'sine', 0.08);
      tone(880, 0.10, 'sine', 0.06, 0.04);
      break;
    case 'close':
      tone(520, 0.08, 'sine', 0.07);
      tone(380, 0.10, 'sine', 0.06, 0.05);
      break;
    case 'success':
      tone(523.25, 0.12, 'triangle', 0.12);
      tone(659.25, 0.14, 'triangle', 0.12, 0.08);
      tone(783.99, 0.20, 'triangle', 0.14, 0.16);
      tone(1046.5, 0.28, 'sine', 0.10, 0.26);
      break;
    case 'error':
      tone(220, 0.16, 'sawtooth', 0.10);
      tone(164.81, 0.22, 'sawtooth', 0.10, 0.08);
      break;
    case 'tick':
      tone(1200, 0.03, 'square', 0.04);
      break;
    case 'whoosh':
      sweep(1400, 200, 0.35, 0.09);
      break;
    default:
      break;
  }
}