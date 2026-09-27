// Synthesised sound (WebAudio): two-stroke engine, the rider next to you,
// slipstream wind, stealing speed, bumps, cones, coins, countdown and a
// finish fanfare. No audio files needed.
//
// Phones need two extra steps. Audio may only start inside a tap, and most
// phones count the moment the finger lifts, so unlock() runs on every tap.
// An iPhone also mutes Web Audio while its ring/silent switch is on silent;
// asking for "playback" audio (as a video player does) lifts that.

const IOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// A short silent WAV file, built in code. It is high quality on purpose:
// iOS can mix Web Audio down to the quality of a playing media element.
function silentWav() {
  const rate = 48000, ch = 2, n = rate / 20; // 50 ms, 16-bit stereo
  const size = n * ch * 2;
  const bytes = new Uint8Array(44 + size);
  const v = new DataView(bytes.buffer);
  const text = (at, str) => [...str].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + size, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
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
    this.engineOn = false;
    this.lastBump = -1;
    this.tag = null;
  }

  // Call from every tap, click and key press: starts or wakes the audio.
  unlock() {
    if (!this.enabled) return;
    this.unmute();
    if (!this.ctx) this.create();
    const c = this.ctx;
    if (!c || c.state === 'running') return;
    const p = c.resume();
    if (p && p.catch) p.catch(() => {});
    // Older iPhones only wake up when a sound starts inside the tap itself.
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
    this.master.gain.value = 1;
    // Keeps loud moments (a steal during the engine) from clipping.
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 6;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    this.master.connect(comp);
    comp.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.buildEngine();
  }

  // Play through the iPhone silent switch. Newer iOS has an Audio Session
  // setting for it; any iOS switches over while a media element plays, so an
  // iPhone gets both.
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
    if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  // The page is hidden: stop everything (and the silent iPhone track, so no player shows on the lock screen).
  suspend() {
    if (this.tag) this.tag.pause();
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  // The page is back. An iPhone may refuse the silent track until the next
  // tap, which unlock() then handles.
  resume() {
    if (!this.ctx || !this.enabled) return;
    this.unmute();
    if (this.ctx.state === 'running') return;
    const p = this.ctx.resume();
    if (p && p.catch) p.catch(() => {});
  }

  get ok() {
    return this.ctx && this.enabled && this.ctx.state === 'running';
  }

  noiseSrc() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = Math.random();
    return s;
  }

  // Percussive envelope: fast attack, then die away.
  env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }

  // ------------------------------------------------------------ continuous voices
  buildEngine() {
    const c = this.ctx;
    const voice = (type, gain) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = 60;
      // A resonant low-pass gives the nasal buzz a phone speaker can play.
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      lp.Q.value = 4;
      // Amplitude wobble = the putt-putt of a single cylinder.
      const am = c.createGain();
      am.gain.value = 0.6;
      const lfo = c.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 20;
      const lfoG = c.createGain();
      lfoG.gain.value = 0.35;
      lfo.connect(lfoG);
      lfoG.connect(am.gain);
      const out = c.createGain();
      out.gain.value = 0;
      o.connect(lp);
      lp.connect(am);
      am.connect(out);
      out.connect(this.master);
      o.start();
      lfo.start();
      return { o, lp, lfo, out, gain };
    };
    this.eng = voice('sawtooth', 0.12);
    this.eng2 = voice('square', 0.045);
    this.other = voice('sawtooth', 0.08);
    // Wind for slipstream and speed, rumble for the grass.
    const mkNoise = (type, freq, q) => {
      const n = this.noiseSrc();
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0;
      n.connect(f);
      f.connect(g);
      g.connect(this.master);
      n.start();
      return { f, g };
    };
    this.wind = mkNoise('bandpass', 900, 0.6);
    this.rumble = mkNoise('bandpass', 420, 0.9);
  }

  // Called every frame during a race.
  engine(on, kmh, throttle, near, wind, offroad) {
    if (!this.ctx || !this.eng) return;
    const t = this.ctx.currentTime;
    const k = on && this.enabled ? 1 : 0;
    const f0 = 48 + Math.min(260, kmh) * 1.45;
    this.eng.o.frequency.setTargetAtTime(f0, t, 0.06);
    this.eng.lfo.frequency.setTargetAtTime(f0 / 4, t, 0.06);
    this.eng.lp.frequency.setTargetAtTime(1500 + kmh * 28, t, 0.08);
    this.eng.out.gain.setTargetAtTime(k * this.eng.gain * (0.55 + 0.45 * throttle), t, 0.08);
    this.eng2.o.frequency.setTargetAtTime(f0 * 2.01, t, 0.06);
    this.eng2.lfo.frequency.setTargetAtTime(f0 / 4, t, 0.06);
    this.eng2.lp.frequency.setTargetAtTime(1800 + kmh * 30, t, 0.08);
    this.eng2.out.gain.setTargetAtTime(k * this.eng2.gain, t, 0.08);
    // The nearest other rider: louder when close, pitch from their speed (a little Doppler).
    if (near) {
      const f1 = (48 + Math.min(260, near.kmh) * 1.45) * (1 + near.closing * 0.004);
      this.other.o.frequency.setTargetAtTime(f1 * 1.07, t, 0.08);
      this.other.lfo.frequency.setTargetAtTime(f1 / 4, t, 0.08);
      this.other.lp.frequency.setTargetAtTime(1500 + near.kmh * 28, t, 0.08);
      this.other.out.gain.setTargetAtTime(k * this.other.gain * near.level, t, 0.1);
    } else this.other.out.gain.setTargetAtTime(0, t, 0.15);
    this.wind.g.gain.setTargetAtTime(k * wind * 0.12, t, 0.15);
    this.wind.f.frequency.setTargetAtTime(600 + wind * 900, t, 0.2);
    this.rumble.g.gain.setTargetAtTime(k * offroad * 0.3, t, 0.08);
    this.engineOn = on;
  }

  stopEngine() {
    this.engine(false, 0, 0, null, 0, 0);
  }

  // ------------------------------------------------------------ one-shots
  // A tone that holds its level for most of its length, then fades.
  tone(type, f0, f1, t, dur, peak) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.setValueAtTime(peak, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // A short knock that dies away (bumps and crashes).
  knock(f0, f1, t, dur, peak) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.004, peak, dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  burst(t, dur, type, freq, q, peak) {
    const c = this.ctx;
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, 0.004, peak, dur);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.05);
  }

  steal(combo = 1) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const up = 1 + Math.min(4, combo - 1) * 0.12;
    this.tone('sawtooth', 220 * up, 1300 * up, t, 0.28, 0.2);
    this.tone('square', 440 * up, 2000 * up, t + 0.03, 0.22, 0.08);
    [1320, 1760, 2349].forEach((f, i) => this.tone('sine', f * up, f * up, t + 0.12 + i * 0.05, 0.22, 0.14));
    this.burst(t, 0.3, 'highpass', 3000, 0.7, 0.25);
  }

  robbed() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('sawtooth', 700, 150, t, 0.45, 0.22);
    this.knock(160, 60, t, 0.2, 0.6);
    this.burst(t, 0.15, 'bandpass', 700, 1, 0.5);
  }

  bump() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    if (t - this.lastBump < 0.25) return;
    this.lastBump = t;
    this.knock(180, 70, t, 0.12, 0.5);
    this.tone('triangle', 420, 260, t, 0.1, 0.25);
    this.burst(t, 0.1, 'bandpass', 1100, 1.2, 0.7);
  }

  cone(vol = 1) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('triangle', 620, 330, t, 0.12, 0.3 * vol);
    this.burst(t, 0.12, 'bandpass', 1800, 2, 0.5 * vol);
  }

  splash() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.burst(t, 0.45, 'bandpass', 1400, 0.6, 0.6);
    this.burst(t + 0.05, 0.3, 'highpass', 4000, 0.5, 0.25);
  }

  crash() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.knock(140, 45, t, 0.35, 0.7);
    this.tone('triangle', 560, 190, t, 0.22, 0.3);
    this.burst(t, 0.4, 'bandpass', 1100, 0.9, 0.9);
    this.burst(t + 0.03, 0.3, 'bandpass', 2600, 1.5, 0.7);
  }

  coin() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('square', 1318, 1318, t, 0.08, 0.13);
    this.tone('square', 1976, 1976, t + 0.07, 0.16, 0.13);
  }

  count() {
    if (!this.ok) return;
    this.tone('square', 660, 660, this.ctx.currentTime, 0.16, 0.2);
  }

  go() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('square', 1320, 1320, t, 0.45, 0.2);
    this.tone('square', 660, 660, t, 0.45, 0.12);
  }

  horn() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    for (const [s, d] of [[0, 0.12], [0.16, 0.2]]) {
      this.tone('square', 415, 415, t + s, d, 0.2);
      this.tone('square', 523, 523, t + s, d, 0.15);
    }
  }

  finish(place) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const notes = place === 1 ? [523, 659, 784, 1047, 784, 1047] : place <= 3 ? [523, 659, 784, 1047] : [392, 349, 330];
    notes.forEach((f, i) => {
      this.tone('square', f, f, t + i * 0.13, i === notes.length - 1 ? 0.6 : 0.14, 0.15);
      this.tone('triangle', f / 2, f / 2, t + i * 0.13, 0.2, 0.2);
    });
  }

  click() {
    if (!this.ok) return;
    this.tone('triangle', 900, 1400, this.ctx.currentTime, 0.05, 0.2);
  }

  cash() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [1047, 1319, 1568, 2093].forEach((f, i) => this.tone('square', f, f, t + i * 0.06, 0.12, 0.12));
  }

  unlockJingle() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [784, 988, 1175, 1568].forEach((f, i) => this.tone('sine', f, f, t + i * 0.09, 0.3, 0.25));
  }
}
