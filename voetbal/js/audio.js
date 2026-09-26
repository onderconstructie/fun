// Synthesised sound (WebAudio): crowd ambience, kicks, whistle, post, net,
// goal roar, "ooh", UI clicks and pack reveals. No audio files needed.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.crowdGain = null;
    this.level = 0;
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
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(c.destination);
    // Shared noise buffer.
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // Pinkish noise.
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    this.startCrowd();
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

  startCrowd() {
    const c = this.ctx;
    const src = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 650;
    bp.Q.value = 0.45;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    this.crowdGain = c.createGain();
    this.crowdGain.gain.value = 0;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.17;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.012;
    lfo.connect(lfoG);
    lfoG.connect(this.crowdGain.gain);
    src.connect(bp);
    bp.connect(lp);
    lp.connect(this.crowdGain);
    this.crowdGain.connect(this.master);
    src.start();
    lfo.start();
    this.crowdOn = false;
  }

  // Ambience level: on = in a match; excitement 0..1.
  crowd(on, excitement = 0) {
    if (!this.ctx || !this.crowdGain) return;
    const target = on ? 0.05 + 0.13 * Math.min(1, excitement) : 0;
    if (Math.abs(target - this.level) > 0.004) {
      this.level = target;
      this.crowdGain.gain.setTargetAtTime(target, this.ctx.currentTime, on ? 0.35 : 0.2);
    }
  }

  env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }

  kick(power = 0.5) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    const g = c.createGain();
    this.env(g, t, 0.004, 0.1 + power * 0.45, 0.12);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
    const n = this.noiseSrc();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const ng = c.createGain();
    this.env(ng, t, 0.002, 0.08 + power * 0.18, 0.03);
    n.connect(hp);
    hp.connect(ng);
    ng.connect(this.master);
    n.start(t);
    n.stop(t + 0.06);
  }

  whistle(kind = 'short') {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const seq = kind === 'long' ? [[0, 0.8]] : kind === 'double' ? [[0, 0.22], [0.32, 0.5]] : kind === 'end' ? [[0, 0.22], [0.3, 0.22], [0.62, 0.9]] : [[0, 0.3]];
    for (const [s, dur] of seq) this.tone(t0 + s, dur);
  }

  tone(t, dur) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.setValueAtTime(0.16, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2900;
    bp.Q.value = 3;
    for (const f of [2860, 2915]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const fm = c.createOscillator();
      fm.type = 'square';
      fm.frequency.value = 38;
      const fmg = c.createGain();
      fmg.gain.value = 70;
      fm.connect(fmg);
      fmg.connect(o.frequency);
      o.connect(bp);
      o.start(t);
      o.stop(t + dur + 0.02);
      fm.start(t);
      fm.stop(t + dur + 0.02);
    }
    bp.connect(g);
    g.connect(this.master);
  }

  post() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    for (const [f, a] of [[520, 0.16], [1310, 0.09], [2170, 0.05]]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const g = c.createGain();
      this.env(g, t, 0.003, a, 0.6);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.7);
    }
    this.ooh(0.8);
  }

  net() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.8;
    const g = c.createGain();
    this.env(g, t, 0.01, 0.3, 0.3);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    n.start(t);
    n.stop(t + 0.4);
  }

  roar(amount = 1) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.35;
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.linearRampToValueAtTime(900, t + 0.6);
    bp.frequency.linearRampToValueAtTime(650, t + 3.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * amount, t + 0.35);
    g.gain.setValueAtTime(0.55 * amount, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    n.start(t);
    n.stop(t + 4.3);
  }

  ooh(amount = 1) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(760, t);
    bp.frequency.exponentialRampToValueAtTime(330, t + 1.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * amount, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    n.start(t);
    n.stop(t + 1.4);
  }

  thud(v = 0.4) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const g = c.createGain();
    this.env(g, t, 0.004, v * 0.4, 0.12);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  click() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.03);
    const g = c.createGain();
    this.env(g, t, 0.003, 0.07, 0.05);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.08);
  }

  coin() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    [1318, 1976].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = c.createGain();
      this.env(g, t + i * 0.07, 0.003, 0.05, 0.18);
      const lp = c.createBiquadFilter();
      lp.frequency.value = 3000;
      o.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.25);
    });
  }

  whoosh(dur = 1.2) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3500, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.2);
  }

  reveal(big = false) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(big ? 70 : 110, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.6);
    const g = c.createGain();
    this.env(g, t, 0.005, big ? 0.7 : 0.4, 0.7);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.8);
    const notes = big ? [784, 988, 1175, 1568] : [880, 1320];
    notes.forEach((f, i) => {
      const s = c.createOscillator();
      s.type = 'sine';
      s.frequency.value = f;
      const sg = c.createGain();
      this.env(sg, t + 0.05 + i * 0.08, 0.005, 0.07, 0.5);
      s.connect(sg);
      sg.connect(this.master);
      s.start(t + 0.05 + i * 0.08);
      s.stop(t + 0.7 + i * 0.08);
    });
    if (big) this.roar(0.6);
  }
}
