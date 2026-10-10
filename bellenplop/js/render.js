// Canvas drawing: the field, bubbles with eyes that follow your shot, the aim
// line, the shooter and all the little effects (pops, falling bubbles, scores).

import { R, D, W, H, ROW_H, COLS, MAX_ROWS, DEAD_Y, DEAD_ROW, SHOOT_X, SHOOT_Y, STONE, BOMB, RAINBOW, METER_MAX, isColor } from './engine.js';
import { TAU, clamp } from './util.js';

export const COLORS = ['#ff4d6d', '#ffd23f', '#3ee07f', '#3a8bff', '#b06cff', '#ff8f2e'];
export const COLOR_NAMES = ['rood', 'geel', 'groen', 'blauw', 'paars', 'oranje'];
const STONE_COL = '#7d8597';
const NEXT_X = SHOOT_X - 84;
const NEXT_Y = SHOOT_Y + 10;
const NEXT_S = 0.72;
const FONT = "'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif";

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tint(h, amt) {
  const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  const [r, g, b] = hexRgb(h);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
const hash = (a, b) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = new Map();
    this.fx = [];
    this.slide = 0;
    this.shake = 0;
    this.landed = null;
    this.lostT = -1;
    this.wonT = -1;
    this.shapes = false;
    this.deco = Array.from({ length: 16 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 10 + Math.random() * 40, s: 0.01 + Math.random() * 0.025, c: i % COLORS.length }));
    this.topUI = 64;
    this.padB = 12;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = this.cv.clientWidth, ch = this.cv.clientHeight;
    this.cv.width = Math.round(cw * dpr);
    this.cv.height = Math.round(ch * dpr);
    this.dpr = dpr;
    this.cw = cw;
    this.ch = ch;
    // The field sits at the bottom, near your thumb; any room left above is
    // filled with the ceiling block.
    const padB = this.padB;
    const s = Math.min((cw - 12) / W, (ch - this.topUI - padB) / H);
    this.s = Math.max(0.3, s);
    this.ox = (cw - W * this.s) / 2;
    this.oy = Math.max(this.topUI, ch - padB - H * this.s);
    this.panelTop = Math.min(0, (this.topUI + 6 - this.oy) / this.s);
    this.sprites.clear();
  }

  toField(cx, cy) {
    const rect = this.cv.getBoundingClientRect();
    return [(cx - rect.left - this.ox) / this.s, (cy - rect.top - this.oy) / this.s];
  }

  // Tapped on the current or next bubble? (that swaps them)
  hitsAmmo(x, y) {
    const near = (ax, ay, rr) => (x - ax) ** 2 + (y - ay) ** 2 < rr * rr;
    return near(SHOOT_X, SHOOT_Y, R * 1.5) || near(NEXT_X, NEXT_Y, R * 1.6);
  }

  // ---- sprites: one pre-drawn body per colour, at screen resolution ----
  sprite(v) {
    const key = v;
    let sp = this.sprites.get(key);
    if (sp) return sp;
    const px = Math.ceil(D * this.s * this.dpr) + 4;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    const k = (px - 4) / D;
    g.translate(px / 2, px / 2);
    g.scale(k, k);
    const r = R - 0.6;
    if (v === RAINBOW && g.createConicGradient) {
      const cg = g.createConicGradient(0, 0, 0);
      COLORS.forEach((col, i) => cg.addColorStop(i / COLORS.length, col));
      cg.addColorStop(1, COLORS[0]);
      g.fillStyle = cg;
    } else {
      const base = v === STONE ? STONE_COL : v === BOMB ? '#2b3150' : v === RAINBOW ? '#ffffff' : COLORS[v];
      const rg = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      rg.addColorStop(0, tint(base, 0.45));
      rg.addColorStop(0.55, base);
      rg.addColorStop(1, tint(base, -0.35));
      g.fillStyle = rg;
    }
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fill();
    if (v === RAINBOW) {
      const wg = g.createRadialGradient(0, 0, 0, 0, 0, r);
      wg.addColorStop(0, 'rgba(255,255,255,0.85)');
      wg.addColorStop(0.5, 'rgba(255,255,255,0.15)');
      wg.addColorStop(1, 'rgba(0,0,0,0.15)');
      g.fillStyle = wg;
      g.fill();
    }
    if (v === STONE) {
      g.strokeStyle = 'rgba(30,34,48,0.55)';
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-9, -6);
      g.lineTo(-2, -1);
      g.lineTo(-4, 7);
      g.moveTo(-2, -1);
      g.lineTo(8, -4);
      g.moveTo(5, 6);
      g.lineTo(10, 10);
      g.stroke();
    }
    // gloss
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(-r * 0.38, -r * 0.48, r * 0.26, r * 0.15, -0.6, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.22)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.stroke();
    sp = { c, px };
    this.sprites.set(key, sp);
    return sp;
  }

  // Bubble at field position (x, y), scale sc, looking at (lx, ly).
  bubble(v, x, y, sc = 1, look = null, opts = {}) {
    const g = this.ctx;
    const sp = this.sprite(opts.grey ? STONE : v);
    const size = (sp.px / this.dpr) * sc;
    g.drawImage(sp.c, x - size / 2, y - size / 2, size, size);
    const s = this.s * sc;
    if (v === BOMB) {
      // fuse and a flickering spark
      g.strokeStyle = '#c9b48a';
      g.lineWidth = 2.4 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + 6 * s, y - 16 * s);
      g.quadraticCurveTo(x + 12 * s, y - 26 * s, x + 18 * s, y - 22 * s);
      g.stroke();
      const f = 3 + Math.random() * 3;
      g.fillStyle = Math.random() < 0.5 ? '#ffd23f' : '#ff8f2e';
      g.beginPath();
      g.arc(x + 18 * s, y - 22 * s, f * s, 0, TAU);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `800 ${13 * s}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('BOEM', x, y + 3 * s);
      return;
    }
    if (v === STONE || opts.grey || opts.noFace) return;
    // eyes
    const ex = 6.4 * s, ey = -2.5 * s, er = 4.6 * s;
    let dx = 0, dy = 0;
    if (look) {
      const ax = look[0] - opts.fx, ay = look[1] - opts.fy;
      const d = Math.hypot(ax, ay) || 1;
      dx = (ax / d) * 1.9 * s;
      dy = (ay / d) * 1.9 * s;
    }
    const blink = opts.blink;
    for (const side of [-1, 1]) {
      const cx = x + side * ex, cy = y + ey;
      if (blink || opts.closed) {
        g.strokeStyle = 'rgba(20,20,40,0.8)';
        g.lineWidth = 1.6 * s;
        g.beginPath();
        g.moveTo(cx - er * 0.8, cy + (opts.closed ? -1 : 0) * s);
        g.lineTo(cx + er * 0.8, cy + (opts.closed ? 1 : 0) * s);
        g.stroke();
        continue;
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(cx, cy, er * 0.85, er, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#141428';
      g.beginPath();
      g.arc(cx + dx, cy + dy, er * 0.5, 0, TAU);
      g.fill();
    }
    if (this.shapes && isColor(v)) this.symbol(v, x, y + 9 * s, 4.6 * s);
  }

  // Shapes for players who find some colours hard to tell apart.
  symbol(v, x, y, r) {
    const g = this.ctx;
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.strokeStyle = 'rgba(20,20,40,0.55)';
    g.lineWidth = r * 0.25;
    g.beginPath();
    switch (v) {
      case 0: // heart
        g.moveTo(x, y + r * 0.9);
        g.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
        g.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
        break;
      case 1: // star
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r * 1.05;
          g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        break;
      case 2: // triangle
        g.moveTo(x, y - r);
        g.lineTo(x + r, y + r * 0.75);
        g.lineTo(x - r, y + r * 0.75);
        break;
      case 3: // square
        g.rect(x - r * 0.78, y - r * 0.78, r * 1.56, r * 1.56);
        break;
      case 4: // diamond
        g.moveTo(x, y - r);
        g.lineTo(x + r, y);
        g.lineTo(x, y + r);
        g.lineTo(x - r, y);
        break;
      default: // circle
        g.arc(x, y, r * 0.8, 0, TAU);
    }
    g.closePath();
    g.stroke();
    g.fill();
  }

  // ---- effects fed by engine events ----
  onEvent(e, game) {
    if (e.t === 'pop') {
      e.list.forEach((b, i) => {
        const d = Math.hypot(b.x - e.x, b.y - e.y);
        this.fx.push({ k: 'pop', x: b.x, y: b.y, v: b.v, t: 0, delay: d * 0.0012 + i * 0.004 });
      });
      this.fx.push({ k: 'text', x: e.x, y: e.y - 10, s: `+${e.gain}`, t: 0, big: e.list.length >= 6 });
      if (e.streak >= 3) this.fx.push({ k: 'text', x: e.x, y: e.y + 18, s: `${e.streak}× op rij!`, t: 0, small: true });
    } else if (e.t === 'drop') {
      let sx = 0, sy = 0;
      for (const b of e.list) {
        this.fx.push({ k: 'fall', x: b.x, y: b.y, v: b.v, vx: (Math.random() - 0.5) * 140, vy: -80 - Math.random() * 120, t: 0 });
        sx += b.x;
        sy += b.y;
      }
      const n = e.list.length;
      this.fx.push({ k: 'text', x: sx / n, y: sy / n, s: n >= 5 ? `${n} vallen!` : `+${n * 20 + n * n * 2}`, t: 0, big: n >= 5 });
    } else if (e.t === 'land') {
      this.landed = { r: e.r, c: e.c, t: 0 };
    } else if (e.t === 'bounce') {
      this.fx.push({ k: 'ring', x: e.x, y: e.y, v: -1, t: 0, small: true });
    } else if (e.t === 'ceiling' || e.t === 'push') {
      this.slide += ROW_H;
      this.shake = Math.max(this.shake, 6);
    } else if (e.t === 'boom') {
      this.shake = 12;
      this.fx.push({ k: 'boom', x: e.x, y: e.y, t: 0 });
    } else if (e.t === 'clear') {
      this.fx.push({ k: 'text', x: W / 2, y: 200, s: 'Alles weg! +1000', t: 0, big: true });
      this.confetti();
    } else if (e.t === 'won') {
      this.wonT = 0;
      this.confetti();
    } else if (e.t === 'lost') {
      this.lostT = 0;
    }
    void game;
  }

  confetti() {
    for (let i = 0; i < 90; i++)
      this.fx.push({ k: 'conf', x: W / 2 + (Math.random() - 0.5) * 80, y: 260, vx: (Math.random() - 0.5) * 700, vy: -300 - Math.random() * 600, c: COLORS[i % COLORS.length], rot: Math.random() * TAU, t: 0 });
  }

  reset() {
    this.fx = [];
    this.slide = 0;
    this.shake = 0;
    this.landed = null;
    this.lostT = -1;
    this.wonT = -1;
  }

  update(dt) {
    this.slide *= Math.pow(0.0008, dt);
    if (this.slide < 0.3) this.slide = 0;
    this.shake *= Math.pow(0.002, dt);
    if (this.landed) this.landed.t += dt;
    if (this.lostT >= 0) this.lostT += dt;
    if (this.wonT >= 0) this.wonT += dt;
    for (const f of this.fx) {
      f.t += dt;
      if (f.k === 'fall' || f.k === 'conf') {
        f.vy += (f.k === 'conf' ? 900 : 1700) * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.k === 'fall' && (f.x < R || f.x > W - R)) f.vx = -f.vx;
        if (f.k === 'conf') {
          f.vx *= Math.pow(0.4, dt);
          f.rot += dt * 8;
        }
      } else if (f.k === 'spark') {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 500 * dt;
      }
      if (f.k === 'pop' && !f.burst && f.t >= f.delay) {
        f.burst = true;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + Math.random();
          const sp = 120 + Math.random() * 160;
          this.fx.push({ k: 'spark', x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v: f.v, t: 0 });
        }
        this.fx.push({ k: 'ring', x: f.x, y: f.y, v: f.v, t: 0 });
      }
    }
    this.fx = this.fx.filter((f) => {
      switch (f.k) {
        case 'pop':
          return !f.burst;
        case 'fall':
          return f.y < H + 80;
        case 'spark':
          return f.t < 0.45;
        case 'ring':
          return f.t < (f.small ? 0.25 : 0.4);
        case 'text':
          return f.t < 1.1;
        case 'boom':
          return f.t < 0.6;
        case 'conf':
          return f.y < H + 40 && f.t < 4;
        default:
          return false;
      }
    });
  }

  busy() {
    return this.fx.some((f) => f.k === 'pop' || f.k === 'fall');
  }

  // ---- frame ----
  draw(game, aim, t) {
    const g = this.ctx;
    const s = this.s;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(t);
    if (!game) return;

    const sh = this.shake > 0.3 ? this.shake : 0;
    const shx = sh ? (Math.random() - 0.5) * sh * s : 0;
    const shy = sh ? (Math.random() - 0.5) * sh * s : 0;
    g.save();
    g.translate(this.ox + shx, this.oy + shy);

    // field panel
    const fw = W * s, fh = H * s;
    const pt = this.panelTop * s;
    g.fillStyle = 'rgba(9, 14, 32, 0.78)';
    roundRect(g, -6, pt - 6, fw + 12, fh - pt + 12, 14 * s + 6);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 1.5;
    g.stroke();
    g.save();
    g.beginPath();
    g.rect(0, pt, fw, fh - pt);
    g.clip();

    const slide = this.slide;
    const top = game.top() - slide;
    // ceiling block: everything above the top row
    if (top * s > pt + 1) {
      const y1 = top * s;
      const sg = g.createLinearGradient(0, pt, 0, y1);
      sg.addColorStop(0, 'rgba(20, 27, 56, 0.35)');
      sg.addColorStop(1, '#232c58');
      g.fillStyle = sg;
      g.fillRect(0, pt, fw, y1 - pt);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = 30; x < W; x += 76) for (let y = y1 / s - 22; y * s > pt; y -= 44) {
        g.beginPath();
        g.arc(x * s, y * s, 3.5 * s, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ffd23f';
      g.fillRect(0, y1 - 4 * s, fw, 4 * s);
      g.fillStyle = '#251b00';
      for (let x = -20; x < W + 20; x += 22) {
        g.beginPath();
        g.moveTo((x) * s, y1 - 4 * s);
        g.lineTo((x + 8) * s, y1 - 4 * s);
        g.lineTo((x + 4) * s, y1);
        g.lineTo((x - 4) * s, y1);
        g.fill();
      }
    } else {
      g.fillStyle = '#ffd23f';
      g.fillRect(0, 0, fw, 3 * s);
    }

    // dead line
    const danger = game.lowestRow() + game.ceiling >= DEAD_ROW - 2;
    g.save();
    g.setLineDash([6 * s, 6 * s]);
    g.lineWidth = 2 * s;
    g.strokeStyle = danger ? `rgba(255,59,107,${0.55 + 0.45 * Math.sin(t * 8)})` : 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.moveTo(0, DEAD_Y * s);
    g.lineTo(fw, DEAD_Y * s);
    g.stroke();
    g.restore();

    // where the eyes look: the flying shot, or the aim point
    let look = [SHOOT_X * s, SHOOT_Y * s];
    if (game.shot) look = [game.shot.x * s, game.shot.y * s];
    else if (aim && aim.active) look = [aim.x * s, aim.y * s];

    // grid
    const lostRows = this.lostT >= 0 ? this.lostT / 0.06 : -1;
    for (let r = 0; r < MAX_ROWS; r++) {
      const y = game.cellY(r) - slide;
      for (let c = 0; c < COLS; c++) {
        const v = game.grid[r][c];
        if (v < 0) continue;
        const x = game.cellX(r, c);
        let sc = 1;
        if (this.landed && this.landed.r === r && this.landed.c === c && this.landed.t < 0.3) sc = 1 + 0.18 * Math.sin((this.landed.t / 0.3) * Math.PI) * (1 - this.landed.t / 0.3);
        const blink = (t * 0.23 + hash(r, c) * 7) % 1 < 0.025;
        this.bubble(v, x * s, y * s, sc, look, { fx: x * s, fy: y * s, blink, grey: lostRows >= 0 && MAX_ROWS - r < lostRows + 2, closed: this.wonT >= 0 });
      }
    }

    // aim line with one ghost bubble where the shot will stick
    if (aim && aim.active && game.state === 'aim') this.aimLine(game, aim, t);

    // flying shot
    if (game.shot) this.bubble(game.shot.v, game.shot.x * s, game.shot.y * s, 1, null, { noFace: true });

    // effects
    for (const f of this.fx) this.effect(f);

    g.restore(); // unclip

    this.shooter(game, aim, t);
    for (const f of this.fx) if (f.k === 'text') this.text(f);
    g.restore();
  }

  aimLine(game, aim, t) {
    const g = this.ctx, s = this.s;
    const tr = game.trace(aim.angle);
    const pts = [[SHOOT_X, SHOOT_Y], ...tr.bounces, tr.end];
    const col = isColor(game.current) ? COLORS[game.current] : '#ffffff';
    g.fillStyle = col;
    let carry = (t * 60) % 18;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 18 - carry; d < len; d += 18) {
        const k = d / len;
        const px = x0 + (x1 - x0) * k, py = y0 + (y1 - y0) * k;
        if (i === 0 && d < R * 1.4) continue;
        g.globalAlpha = 0.85;
        g.beginPath();
        g.arc(px * s, py * s, 2.6 * s, 0, TAU);
        g.fill();
      }
      carry = (carry + len) % 18;
    }
    g.globalAlpha = 1;
    if (tr.cell) {
      const [r, c] = tr.cell;
      const x = game.cellX(r, c) * s, y = (game.cellY(r) - this.slide) * s;
      g.strokeStyle = col;
      g.lineWidth = 2.5 * s;
      g.setLineDash([5 * s, 4 * s]);
      g.beginPath();
      g.arc(x, y, (R - 2) * s, 0, TAU);
      g.stroke();
      g.setLineDash([]);
    }
  }

  shooter(game, aim, t) {
    const g = this.ctx, s = this.s;
    const x = SHOOT_X * s, y = SHOOT_Y * s;
    // base
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.beginPath();
    g.arc(x, y + 8 * s, 34 * s, Math.PI, 0);
    g.fill();
    // arrow
    const ang = aim && aim.active ? game.clampAngle(aim.angle) : Math.PI / 2;
    g.save();
    g.translate(x, y);
    g.rotate(-ang + Math.PI / 2);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.moveTo(0, -38 * s);
    g.lineTo(7 * s, -28 * s);
    g.lineTo(-7 * s, -28 * s);
    g.closePath();
    g.fill();
    g.restore();
    // power meter ring
    const m = clamp(game.meter / METER_MAX, 0, 1);
    g.lineCap = 'round';
    g.lineWidth = 4 * s;
    g.strokeStyle = 'rgba(255,255,255,0.1)';
    g.beginPath();
    g.arc(x, y, (R + 6) * s, 0, TAU);
    g.stroke();
    if (m > 0) {
      g.strokeStyle = m > 0.8 ? `hsl(${(t * 200) % 360},90%,65%)` : '#ffd23f';
      g.beginPath();
      g.arc(x, y, (R + 6) * s, -Math.PI / 2, -Math.PI / 2 + m * TAU);
      g.stroke();
    }
    g.lineCap = 'butt';
    if (game.state === 'aim' || game.state === 'flying') {
      this.bubble(game.current, x, y, 1, null, { noFace: true });
      this.bubble(game.next, NEXT_X * s, NEXT_Y * s, NEXT_S, null, { noFace: true });
      // swap hint: two small arrows between the next bubble and yours
      const mx = ((SHOOT_X + NEXT_X) / 2 + 4) * s, my = NEXT_Y * s;
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 2 * s;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(mx - 7 * s, my - 4 * s);
      g.lineTo(mx + 7 * s, my - 4 * s);
      g.lineTo(mx + 3.5 * s, my - 7.5 * s);
      g.moveTo(mx + 7 * s, my + 4 * s);
      g.lineTo(mx - 7 * s, my + 4 * s);
      g.lineTo(mx - 3.5 * s, my + 7.5 * s);
      g.stroke();
      g.lineCap = 'butt';
    }
    // pressure dots: shots left before the ceiling (or a new row) comes
    const n = game.missLimit, left = game.pressureLeft();
    const dx = 13 * s;
    const x0 = (SHOOT_X + 62) * s;
    for (let i = 0; i < n; i++) {
      const on = i < left;
      const warn = left <= 2 && on;
      g.fillStyle = on ? (warn ? `rgba(255,59,107,${0.7 + 0.3 * Math.sin(t * 10)})` : '#ffd23f') : 'rgba(255,255,255,0.14)';
      g.beginPath();
      g.arc(x0 + i * dx, y + 10 * s, 4.2 * s, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = `700 ${11 * s}px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(game.mode === 'endless' ? 'NIEUWE RIJ' : 'PLAFOND', x0 - 4 * s, y - 6 * s);
  }

  effect(f) {
    const g = this.ctx, s = this.s;
    if (f.k === 'pop') {
      const k = 1 + 0.15 * Math.sin(f.t * 40);
      this.bubble(f.v, f.x * s, f.y * s, k, null, { noFace: false, fx: 0, fy: 0, closed: true });
    } else if (f.k === 'fall') {
      g.globalAlpha = clamp(1 - (f.y - DEAD_Y) / 200, 0.25, 1);
      this.bubble(f.v, f.x * s, f.y * s, 1, null, { closed: true });
      g.globalAlpha = 1;
    } else if (f.k === 'spark') {
      const a = 1 - f.t / 0.45;
      g.globalAlpha = a;
      g.fillStyle = f.v >= 0 && f.v < COLORS.length ? COLORS[f.v] : '#cfd7e2';
      g.beginPath();
      g.arc(f.x * s, f.y * s, 3.4 * a * s, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    } else if (f.k === 'ring') {
      const dur = f.small ? 0.25 : 0.4;
      const k = f.t / dur;
      g.globalAlpha = 1 - k;
      g.strokeStyle = f.v >= 0 && f.v < COLORS.length ? COLORS[f.v] : '#ffffff';
      g.lineWidth = 3 * s * (1 - k);
      g.beginPath();
      g.arc(f.x * s, f.y * s, (f.small ? 6 + 14 * k : R * (0.8 + 0.9 * k)) * s, 0, TAU);
      g.stroke();
      g.globalAlpha = 1;
    } else if (f.k === 'boom') {
      const k = f.t / 0.6;
      const rg = g.createRadialGradient(f.x * s, f.y * s, 0, f.x * s, f.y * s, D * 2.6 * s * (0.4 + k));
      rg.addColorStop(0, `rgba(255,240,180,${0.9 * (1 - k)})`);
      rg.addColorStop(0.5, `rgba(255,143,46,${0.6 * (1 - k)})`);
      rg.addColorStop(1, 'rgba(255,59,107,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(f.x * s, f.y * s, D * 2.6 * s * (0.4 + k), 0, TAU);
      g.fill();
    } else if (f.k === 'conf') {
      g.save();
      g.translate(f.x * s, f.y * s);
      g.rotate(f.rot);
      g.fillStyle = f.c;
      g.fillRect(-4 * s, -2 * s, 8 * s, 4 * s);
      g.restore();
    }
  }

  text(f) {
    const g = this.ctx, s = this.s;
    const k = f.t / 1.1;
    const size = (f.big ? 26 : f.small ? 15 : 19) * s * (k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1);
    g.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    g.font = `800 italic ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const x = clamp(f.x, 50, W - 50) * s, y = (f.y - k * 40) * s;
    g.lineWidth = 4 * s;
    g.strokeStyle = 'rgba(8,10,24,0.85)';
    g.strokeText(f.s, x, y);
    g.fillStyle = f.big ? '#ffd23f' : '#ffffff';
    g.fillText(f.s, x, y);
    g.globalAlpha = 1;
  }

  background(t) {
    const g = this.ctx;
    const bg = g.createLinearGradient(0, 0, 0, this.ch);
    bg.addColorStop(0, '#16224a');
    bg.addColorStop(1, '#0b1020');
    g.fillStyle = bg;
    g.fillRect(0, 0, this.cw, this.ch);
    for (const d of this.deco) {
      const y = (((d.y - t * d.s) % 1) + 1) % 1;
      g.fillStyle = COLORS[d.c];
      g.globalAlpha = 0.06;
      g.beginPath();
      g.arc(d.x * this.cw, y * (this.ch + 100) - 50, d.r, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
