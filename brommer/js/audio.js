// Synthesised sound (WebAudio): two-stroke engine, the rider next to you,
// slipstream wind, stealing speed, bumps, cones, coins, countdown and a
// finish fanfare. No audio files needed.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineOn = false;
    this.lastBump = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.buildEngine();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
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
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      lp.Q.value = 2;
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
    this.eng = voice('sawtooth', 0.075);
    this.eng2 = voice('square', 0.028);
    this.other = voice('sawtooth', 0.045);
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
    this.rumble = mkNoise('lowpass', 180, 1);
  }

  // Called every frame during a race.
  engine(on, kmh, throttle, near, wind, offroad) {
    if (!this.ctx || !this.eng) return;
    const t = this.ctx.currentTime;
    const k = on && this.enabled ? 1 : 0;
    const f0 = 48 + Math.min(260, kmh) * 1.45;
    this.eng.o.frequency.setTargetAtTime(f0, t, 0.06);
    this.eng.lfo.frequency.setTargetAtTime(f0 / 4, t, 0.06);
    this.eng.lp.frequency.setTargetAtTime(900 + kmh * 18, t, 0.08);
    this.eng.out.gain.setTargetAtTime(k * this.eng.gain * (0.55 + 0.45 * throttle), t, 0.08);
    this.eng2.o.frequency.setTargetAtTime(f0 * 2.01, t, 0.06);
    this.eng2.lfo.frequency.setTargetAtTime(f0 / 4, t, 0.06);
    this.eng2.out.gain.setTargetAtTime(k * this.eng2.gain, t, 0.08);
    // The nearest other rider: louder when close, pitch from their speed (a little Doppler).
    if (near) {
      const f1 = (48 + Math.min(260, near.kmh) * 1.45) * (1 + near.closing * 0.004);
      this.other.o.frequency.setTargetAtTime(f1 * 1.07, t, 0.08);
      this.other.lfo.frequency.setTargetAtTime(f1 / 4, t, 0.08);
      this.other.out.gain.setTargetAtTime(k * this.other.gain * near.level, t, 0.1);
    } else this.other.out.gain.setTargetAtTime(0, t, 0.15);
    this.wind.g.gain.setTargetAtTime(k * wind * 0.08, t, 0.15);
    this.wind.f.frequency.setTargetAtTime(600 + wind * 900, t, 0.2);
    this.rumble.g.gain.setTargetAtTime(k * offroad * 0.22, t, 0.08);
    this.engineOn = on;
  }

  stopEngine() {
    this.engine(false, 0, 0, null, 0, 0);
  }

  // ------------------------------------------------------------ one-shots
  tone(type, f0, f1, t, dur, peak, dest = this.master) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.006, peak, dur);
    o.connect(g);
    g.connect(dest);
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
    this.tone('sawtooth', 220 * up, 1300 * up, t, 0.28, 0.12);
    this.tone('square', 440 * up, 2000 * up, t + 0.03, 0.22, 0.05);
    [1320, 1760, 2349].forEach((f, i) => this.tone('sine', f * up, f * up, t + 0.12 + i * 0.05, 0.25, 0.07));
    this.burst(t, 0.3, 'highpass', 3000, 0.7, 0.12);
  }

  robbed() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('sawtooth', 700, 120, t, 0.45, 0.13);
    this.tone('sine', 110, 50, t, 0.2, 0.3);
    this.burst(t, 0.12, 'lowpass', 400, 1, 0.3);
  }

  bump() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    if (t - this.lastBump < 0.25) return;
    this.lastBump = t;
    this.tone('sine', 140, 60, t, 0.12, 0.25);
    this.burst(t, 0.06, 'bandpass', 900, 1.5, 0.12);
  }

  cone(vol = 1) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('triangle', 520, 300, t, 0.1, 0.15 * vol);
    this.burst(t, 0.1, 'bandpass', 1800, 2, 0.2 * vol);
  }

  splash() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.burst(t, 0.45, 'bandpass', 1400, 0.6, 0.3);
    this.burst(t + 0.05, 0.3, 'highpass', 4000, 0.5, 0.12);
  }

  crash() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('sine', 90, 35, t, 0.35, 0.5);
    this.burst(t, 0.35, 'lowpass', 900, 0.8, 0.45);
    this.burst(t + 0.04, 0.25, 'bandpass', 2500, 2, 0.15);
  }

  coin() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('square', 1318, 1318, t, 0.08, 0.05);
    this.tone('square', 1976, 1976, t + 0.07, 0.18, 0.05);
  }

  count(n) {
    if (!this.ok) return;
    this.tone('square', 660, 660, this.ctx.currentTime, 0.18, 0.08);
  }

  go() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('square', 1320, 1320, t, 0.5, 0.09);
    this.tone('sine', 660, 660, t, 0.5, 0.12);
  }

  horn() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    for (const [s, d] of [[0, 0.12], [0.16, 0.2]]) {
      this.tone('square', 415, 415, t + s, d, 0.07);
      this.tone('square', 523, 523, t + s, d, 0.05);
    }
  }

  finish(place) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const notes = place === 1 ? [523, 659, 784, 1047, 784, 1047] : place <= 3 ? [523, 659, 784, 1047] : [392, 349, 330];
    notes.forEach((f, i) => {
      this.tone('square', f, f, t + i * 0.13, i === notes.length - 1 ? 0.6 : 0.14, 0.06);
      this.tone('triangle', f / 2, f / 2, t + i * 0.13, 0.2, 0.08);
    });
  }

  click() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone('triangle', 900, 1400, t, 0.05, 0.07);
  }

  cash() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [1047, 1319, 1568, 2093].forEach((f, i) => this.tone('square', f, f, t + i * 0.06, 0.12, 0.045));
  }

  unlockJingle() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [784, 988, 1175, 1568].forEach((f, i) => this.tone('sine', f, f, t + i * 0.09, 0.3, 0.09));
  }
}
