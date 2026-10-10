// Synthesised sound (WebAudio): shooting, bouncing, popping, falling,
// the ceiling coming down, a bomb and two small jingles. No audio files.
//
// Phones: audio may only start inside a tap, so unlock() runs on every tap.
// An iPhone mutes Web Audio on silent; a looping silent media element and the
// "playback" audio session lift that (same trick as Brommer & the Finish).

const IOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function silentWav() {
  const rate = 48000, ch = 2, n = rate / 20;
  const size = n * ch * 2;
  const bytes = new Uint8Array(44 + size);
  const v = new DataView(bytes.buffer);
  const text = (at, str) => [...str].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + size, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, size, true);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 4096) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
  return 'data:audio/wav;base64,' + btoa(bin);
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.tag = null;
  }

  unlock() {
    if (!this.enabled) return;
    this.unmute();
    if (!this.ctx) this.create();
    const c = this.ctx;
    if (!c || c.state === 'running') return;
    const p = c.resume();
    if (p && p.catch) p.catch(() => {});
    const s = c.createBufferSource();
    s.buffer = this.blank;
    s.connect(c.destination);
    s.start(0);
  }

  create() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let c;
    try {
      c = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      try {
        c = new AC();
      } catch (e2) {
        return;
      }
    }
    this.ctx = c;
    this.blank = c.createBuffer(1, 1, c.sampleRate);
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(c.destination);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  unmute() {
    this.session('playback');
    if (!IOS) return;
    if (!this.tag) {
      const a = document.createElement('audio');
      a.src = silentWav();
      a.loop = true;
      a.setAttribute('playsinline', '');
      a.setAttribute('x-webkit-airplay', 'deny');
      this.tag = a;
    }
    if (this.tag.paused) {
      const p = this.tag.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  session(type) {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type;
    } catch (e) {
      /* ignore */
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.unlock();
    else {
      if (this.tag) this.tag.pause();
      this.session('auto');
    }
  }

  suspend() {
    if (this.tag) this.tag.pause();
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  // ---- building blocks ----
  tone(type, f0, f1, dur, vol, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hiss(f, q, dur, vol, when = 0, sweepTo = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f, t);
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ---- game sounds ----
  fire() {
    if (!this.ready()) return;
    this.hiss(1800, 1.2, 0.16, 0.25, 0, 600);
    this.tone('triangle', 520, 300, 0.09, 0.12);
  }
  bounce() {
    if (!this.ready()) return;
    this.tone('square', 900, 700, 0.04, 0.05);
  }
  land() {
    if (!this.ready()) return;
    this.tone('sine', 260, 140, 0.1, 0.22);
  }
  // A run of pops that climbs in pitch; i: number of bubbles, streak: shots in a row that scored
  pop(i, streak) {
    if (!this.ready()) return;
    const base = 520 * Math.pow(1.06, Math.min(streak, 8));
    for (let k = 0; k < Math.min(i, 10); k++) {
      const f = base * Math.pow(1.12, k);
      this.tone('sine', f, f * 1.9, 0.07, 0.2, k * 0.035);
      this.hiss(3000, 3, 0.04, 0.08, k * 0.035);
    }
  }
  drop(n) {
    if (!this.ready()) return;
    for (let k = 0; k < Math.min(n, 6); k++) this.tone('triangle', 700 - k * 60, 180, 0.35, 0.08, 0.05 + k * 0.05);
  }
  swap() {
    if (!this.ready()) return;
    this.tone('triangle', 660, 880, 0.06, 0.1);
  }
  ceiling() {
    if (!this.ready()) return;
    this.tone('sawtooth', 90, 45, 0.45, 0.2);
    this.hiss(200, 0.8, 0.4, 0.35);
  }
  warn() {
    if (!this.ready()) return;
    this.tone('square', 440, 440, 0.06, 0.05);
  }
  special() {
    if (!this.ready()) return;
    [0, 4, 7, 12].forEach((s, k) => this.tone('triangle', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), 0.12, 0.12, k * 0.06));
  }
  boom() {
    if (!this.ready()) return;
    this.hiss(400, 0.5, 0.7, 0.6, 0, 80);
    this.tone('sine', 120, 35, 0.6, 0.5);
  }
  win() {
    if (!this.ready()) return;
    [0, 4, 7, 12, 16].forEach((s, k) => this.tone('triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.22, 0.16, k * 0.1));
  }
  star(k) {
    if (!this.ready()) return;
    const f = 880 * Math.pow(2, (k * 4) / 12);
    this.tone('sine', f, f, 0.25, 0.18);
  }
  lose() {
    if (!this.ready()) return;
    [7, 4, 0, -5].forEach((s, k) => this.tone('triangle', 392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12) * 0.97, 0.28, 0.14, k * 0.16));
  }
}
