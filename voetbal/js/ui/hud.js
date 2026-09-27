// In-match HUD: scorebug, clock, banners, hints, goal flash and radar.

import { flagSVG } from '../data/nations.js';
import { L, W, BOX_D, BOX_HW, CY } from '../engine/constants.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = $('hud');
    this.s0 = $('sb-s0');
    this.s1 = $('sb-s1');
    this.clock = $('sb-clock');
    this.bannerEl = $('banner');
    this.hintEl = $('hint');
    this.goalEl = $('goal-flash');
    this.goalScorer = $('gf-scorer');
    this.radar = $('radar');
    this.rctx = this.radar.getContext('2d');
    this.attackPanel = $('attack-panel');
    this.last = { s0: -1, s1: -1, clock: '' };
    this.bannerT = 0;
    this.hintT = 0;
    this.radarT = 0;
    this.radarOn = true;
  }

  setTeams(m) {
    const [a, b] = m.teams;
    $('sb-flag0').innerHTML = flagSVG(a.def.flag);
    $('sb-flag1').innerHTML = flagSVG(b.def.flag);
    $('sb-name0').textContent = a.short;
    $('sb-name1').textContent = b.short;
    this.last = { s0: -1, s1: -1, clock: '' };
    this.colors = [a.kit.shirt, b.kit.shirt];
    // Radar dot colours must be distinguishable on green.
    this.colors = this.colors.map((c) => (c.toLowerCase() === '#ffffff' || c.toLowerCase() === '#f8f8f8' ? '#f8fafc' : c));
    this.sizeRadar();
  }

  sizeRadar() {
    const r = this.radar.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.radar.width = Math.max(1, Math.round(r.width * dpr));
    this.radar.height = Math.max(1, Math.round(r.height * dpr));
    this.rdpr = dpr;
  }

  update(m, dt, controlled) {
    const [a, b] = m.teams;
    if (a.score !== this.last.s0) {
      this.s0.textContent = a.score;
      this.last.s0 = a.score;
      this.bump();
    }
    if (b.score !== this.last.s1) {
      this.s1.textContent = b.score;
      this.last.s1 = b.score;
      this.bump();
    }
    const c = m.modeLabel();
    if (c !== this.last.clock) {
      this.clock.textContent = c;
      this.last.clock = c;
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.bannerEl.classList.remove('show');
    }
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.hintEl.classList.remove('show');
    }
    this.radarT -= dt;
    if (this.radarOn && this.radarT <= 0) {
      this.radarT = 1 / 30;
      this.drawRadar(m, controlled);
    }
  }

  bump() {
    const el = this.s0.parentElement;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  banner(text, secs = 1.6, warn = false) {
    if (!text) return;
    this.bannerEl.textContent = text;
    this.bannerEl.classList.toggle('warn', warn);
    this.bannerEl.classList.add('show');
    this.bannerT = secs;
  }

  hint(html, secs = 3) {
    this.hintEl.innerHTML = html;
    this.hintEl.classList.add('show');
    this.hintT = secs;
  }

  clearHint() {
    this.hintT = 0;
    this.hintEl.classList.remove('show');
  }

  goal(text, scorer) {
    this.goalEl.querySelector('.gf-word').textContent = text;
    this.goalScorer.textContent = scorer;
    this.goalEl.classList.remove('show');
    void this.goalEl.offsetWidth;
    this.goalEl.classList.add('show');
  }

  drawRadar(m, controlled) {
    const g = this.rctx, cw = this.radar.width, ch = this.radar.height;
    if (!cw) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = 'rgba(10, 30, 16, 0.72)';
    g.fillRect(0, 0, cw, ch);
    const sx = cw / L, sy = ch / W;
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = Math.max(1, this.rdpr);
    g.strokeRect(0.5, 0.5, cw - 1, ch - 1);
    g.beginPath();
    g.moveTo(cw / 2, 0);
    g.lineTo(cw / 2, ch);
    g.stroke();
    g.strokeRect(0.5, (CY - BOX_HW) * sy, BOX_D * sx, BOX_HW * 2 * sy);
    g.strokeRect(cw - BOX_D * sx - 0.5, (CY - BOX_HW) * sy, BOX_D * sx, BOX_HW * 2 * sy);
    const r = Math.max(2.2, cw / 70);
    for (const p of m.players) {
      const x = p.x * sx, y = p.y * sy;
      g.fillStyle = this.colors[p.team.index];
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.stroke();
      if (p === controlled) {
        g.strokeStyle = '#35f0ff';
        g.lineWidth = 2 * this.rdpr;
        g.beginPath();
        g.arc(x, y, r + 2.2 * this.rdpr, 0, Math.PI * 2);
        g.stroke();
      }
    }
    const b = m.ball;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(b.x * sx, b.y * sy, r * 0.8, 0, Math.PI * 2);
    g.fill();
  }
}
