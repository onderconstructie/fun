// Manillen: small synthesised sounds (WebAudio), no audio files. Off by default and always soft.
// Audio may only start inside a tap, so unlock() runs on taps.

let ctx = null;
let master = null;
let on = false;

function create() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch (e) {
    ctx = null;
    return;
  }
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
}

export function setSound(v) {
  on = !!v;
  if (on) unlock();
}

export function unlock() {
  if (!on) return;
  if (!ctx) create();
  if (ctx && ctx.state !== 'running') {
    const p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
  }
}

// A short burst of filtered noise: the "tick" of a card on cloth.
function thock(t, { freq = 1800, q = 0.9, len = 0.05, vol = 0.6 } = {}) {
  const n = Math.floor(ctx.sampleRate * len);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

// A soft sine bell.
function bell(t, freq, { len = 0.32, vol = 0.32 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + len + 0.02);
}

export function play(name) {
  if (!on || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.005;
  switch (name) {
    case 'card': thock(t); break;
    case 'deal': for (let i = 0; i < 6; i++) thock(t + i * 0.055, { freq: 2200, len: 0.035, vol: 0.4 }); break;
    case 'nope': bell(t, 196, { len: 0.16, vol: 0.18 }); break;
    case 'trick-us': bell(t, 659.3); bell(t + 0.09, 880, { vol: 0.24 }); break;
    case 'trick-them': bell(t, 523.3, { vol: 0.22 }); bell(t + 0.09, 392, { vol: 0.18 }); break;
    case 'round': [523.3, 659.3, 784].forEach((f, i) => bell(t + i * 0.1, f, { len: 0.45, vol: 0.22 })); break;
    case 'win': [523.3, 659.3, 784, 1046.5].forEach((f, i) => bell(t + i * 0.12, f, { len: 0.7, vol: 0.24 })); break;
    case 'lose': [440, 392, 329.6].forEach((f, i) => bell(t + i * 0.14, f, { len: 0.5, vol: 0.2 })); break;
  }
}
