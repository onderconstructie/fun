// Pseudo-3D road renderer (canvas 2D). Segments are projected near to far
// and clipped against hills; road surfaces are batched per colour. Sprites
// and riders are then drawn far to near. Effects (sparks, floating numbers,
// speed lines, flashes) sit on top.

import { SEG, ROAD, KMH } from '../config.js';
import { SpriteBank } from './sprites.js';
import { Background } from './background.js';
import { clamp, lerp } from '../util.js';

const NEAR = 30;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false });
    this.bank = new SpriteBank();
    this.W = 1;
    this.H = 1;
    this.dpr = 1;
    this.race = null;
    this.bg = null;
    this.drawDist = 260;
    this.camX = 0;
    this.camY = 0;
    this.skyOffset = 0;
    this.shake = 0;
    this.flashColor = '#fff';
    this.flashA = 0;
    this.kick = 0;
    this.fx = [];
    this.lines = [];
    this.time = 0;
    this.lite = false;
    this.projected = [];
    this.buckets = new Map();
    this.layers = null;
  }

  setLite(on) {
    this.lite = on;
    this.bank.lite = on;
    this.drawDist = on ? 170 : 260;
  }

  resize(w, h, dpr) {
    this.dpr = dpr;
    this.W = Math.max(1, Math.round(w * dpr));
    this.H = Math.max(1, Math.round(h * dpr));
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const W = this.W, H = this.H, land = w >= h;
    // Horizon, where the player's wheel sits, and how wide the road is there.
    this.cx = W / 2;
    this.cy = H * (land ? 0.42 : 0.37);
    const yb = H * (land ? 0.94 : 0.87);
    const rw = land ? 0.64 : 1.22;
    this.f = land ? W * 0.9 : H * 0.62;
    const k = (rw * W) / (2 * ROAD); // f / D
    this.D = this.f / k;
    this.camH = (yb - this.cy) / k;
  }

  setRace(race, demo = false) {
    this.race = race;
    this.demo = demo;
    this.bg = new Background(race.track.theme);
    this.theme = race.track.theme;
    this.farLand = null;
    this.fx.length = 0;
    this.shake = 0;
    this.flashA = 0;
    this.kick = 0;
    const P = race.player;
    this.camX = P.x * ROAD;
    this.camY = race.track.heightAt(P.z) + this.camH;
    this.skyOffset = 0;
    this.lastZ = P.z;
  }

  // ------------------------------------------------------------ effects API
  flash(color, a) {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  }

  float(text, color, big = false, y = 0.62) {
    this.fx.push({ type: 'text', text, color, big, t: 0, dur: 1.4, x: 0.5, y });
  }

  sparks(from, to, color) {
    for (let i = 0; i < 18; i++) this.fx.push({ type: 'spark', from, to, color, t: -i * 0.018, dur: 0.45, off: (Math.random() - 0.5) * 2 });
  }

  confetti() {
    const cols = ['#ff3b6b', '#35b6ff', '#ffd23f', '#b8f000', '#ff8a1f', '#ffffff'];
    for (let i = 0; i < 90; i++) this.fx.push({ type: 'confetti', x: Math.random(), y: -0.1 - Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.2, vy: 0.25 + Math.random() * 0.3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, color: cols[i % cols.length], t: 0, dur: 4 });
  }

  // ------------------------------------------------------------ frame
  draw(dt) {
    const race = this.race;
    if (!race) return;
    this.time += dt;
    const g = this.g, W = this.W, H = this.H;
    const tr = race.track, segs = tr.segments, P = race.player, th = this.theme;
    const f = this.f * (1 - 0.07 * this.kick);
    this.kick = Math.max(0, this.kick - dt * 1.6);

    // Camera: follows the player's line (with a little lag) and the road height.
    const camZ = P.z - this.D;
    const base = tr.segAt(camZ);
    const basePct = clamp((camZ - base.z) / SEG, 0, 1);
    const pIdx = Math.floor(P.z / SEG);
    let xp = 0, ddx = -base.curve * basePct;
    for (let i = base.i; i < pIdx && i < segs.length; i++) {
      xp += ddx;
      ddx += segs[i].curve;
    }
    xp += ddx * clamp((P.z - pIdx * SEG) / SEG, 0, 1);
    const targetX = xp + P.x * ROAD;
    this.camX += (targetX - this.camX) * Math.min(1, dt * 9);
    const targetY = tr.heightAt(P.z) + this.camH;
    this.camY += (targetY - this.camY) * Math.min(1, dt * 7);
    const camX = this.camX, camY = this.camY;
    // Sky scrolls with the bends.
    this.skyOffset += (tr.segAt(P.z).curve * (P.z - this.lastZ)) / SEG / 900;
    this.lastZ = P.z;

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 14 * this.dpr : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 10 * this.dpr : 0;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    g.setTransform(1, 0, 0, 1, shakeX, shakeY);

    const horizon = this.cy - (camY - this.camH) * 0.02;
    this.bg.draw(g, W + 20, H, horizon, this.skyOffset, this.dpr * clamp(Math.min(W, H) / this.dpr / 390, 0.8, 1.5));

    // ---------------------------------------------------------- project + road
    const L = this.layerSet();
    const cx = this.cx, cy = this.cy;
    let x = 0, dx = -base.curve * basePct;
    let maxy = H;
    let farY = H;
    const list = this.projected;
    list.length = 0;
    for (let n = 0; n < this.drawDist; n++) {
      const seg = segs[base.i + n];
      if (!seg) break;
      const z1 = seg.z - camZ, z2 = seg.z + SEG - camZ;
      seg.clip = maxy;
      seg.n = n;
      const p1 = seg.p1, p2 = seg.p2;
      const s1 = f / Math.max(NEAR, z1), s2 = f / Math.max(NEAR, z2);
      p1.s = s1;
      p1.x = cx + (x - camX) * s1;
      p1.y = cy - (seg.y1 - camY) * s1;
      p1.w = ROAD * s1;
      p2.s = s2;
      p2.x = cx + (x + dx - camX) * s2;
      p2.y = cy - (seg.y2 - camY) * s2;
      p2.w = ROAD * s2;
      x += dx;
      dx += seg.curve;
      if (z1 <= NEAR) continue;
      list.push(seg);
      if (p2.y >= p1.y || p2.y >= maxy) continue;
      let y1 = p1.y, x1 = p1.x, w1 = p1.w;
      if (y1 > maxy) {
        const t = (maxy - p2.y) / (p1.y - p2.y);
        x1 = p2.x + (p1.x - p2.x) * t;
        w1 = p2.w + (p1.w - p2.w) * t;
        y1 = maxy;
      }
      this.segmentShapes(L, seg, x1, y1, w1, p2.x, p2.y, p2.w, W, th);
      maxy = p2.y;
      farY = p2.y;
    }
    // Distant land between the horizon and the last road segment.
    if (farY > horizon) {
      g.fillStyle = this.farLand || (this.farLand = mixHex(th.grass[0], th.fog, 0.55));
      g.fillRect(0, horizon - 1, W, farY - horizon + 2);
    }
    for (const layer of L) {
      for (const [color, path] of layer) {
        g.fillStyle = color;
        g.fill(path);
      }
    }
    // Fog where the road meets the sky.
    const fogH = Math.max(8, (H - farY) * 0.22);
    const fog = g.createLinearGradient(0, farY - 4, 0, farY + fogH);
    fog.addColorStop(0, th.fog);
    fog.addColorStop(1, hexA(th.fog, 0));
    g.fillStyle = fog;
    g.fillRect(0, farY - 4, W, fogH + 4);

    // ---------------------------------------------------------- sprites far to near
    this.bucket(race);
    this.tags = [];
    const fogStart = this.drawDist * 0.55;
    for (let k = list.length - 1; k >= 0; k--) {
      const seg = list[k];
      const alpha = seg.n > fogStart ? 1 - 0.85 * Math.pow((seg.n - fogStart) / (this.drawDist - fogStart), 1.4) : 1;
      g.globalAlpha = alpha;
      const clipY = seg.clip;
      const needClip = seg.p1.y > clipY + 1;
      if (needClip) {
        g.save();
        g.beginPath();
        g.rect(-50, -50, W + 100, clipY + 50);
        g.clip();
      }
      if (seg.special) this.gantry(g, seg);
      for (const s of seg.sprites) this.scenery(g, seg, s, W);
      for (const o of seg.obs) this.obstacle(g, seg, o, race.time);
      for (const c of seg.coins) this.coin(g, seg, c);
      const b = this.buckets.get(seg.i);
      if (b) {
        b.sort((a, b2) => b2.z - a.z);
        for (const it of b) {
          if (it.k === 'tractor') this.tractor(g, seg, it);
          else this.rider(g, seg, it, P);
        }
      }
      if (needClip) g.restore();
    }
    g.globalAlpha = 1;
    this.nameTags(g);

    this.effects(g, dt, P, W, H);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Per-colour Path2D batches in drawing order: ground, bands, rumble, road, lines.
  layerSet() {
    const L = [new Map(), new Map(), new Map(), new Map(), new Map()];
    this.layers = L;
    return L;
  }

  quad(layer, color, xa, ya, xb, yb, xc, yc, xd, yd) {
    let p = layer.get(color);
    if (!p) {
      p = new Path2D();
      layer.set(color, p);
    }
    p.moveTo(xa, ya);
    p.lineTo(xb, yb);
    p.lineTo(xc, yc);
    p.lineTo(xd, yd);
    p.closePath();
  }

  segmentShapes(L, seg, x1, y1, w1, x2, y2, w2, W, th) {
    const band = seg.band;
    const yTop = Math.floor(y2), yBot = Math.ceil(y1) + 1;
    // Ground strip across the whole screen.
    let p = L[0].get(th.grass[band]);
    if (!p) {
      p = new Path2D();
      L[0].set(th.grass[band], p);
    }
    p.rect(-50, yTop, W + 100, yBot - yTop);
    // Side bands: ditches, pavements, flower fields, the sea.
    for (const b of th.bands) {
      let color;
      if (b.field) {
        const grp = Math.floor(seg.i / b.every);
        color = grp % 2 ? b.gap : b.field[Math.floor(grp / 2) % b.field.length];
      } else color = b.colors[band];
      for (const side of b.side ? [b.side] : [-1, 1]) {
        const a1 = x1 + side * b.from * w1, a2 = x1 + side * b.to * w1;
        const c1 = x2 + side * b.from * w2, c2 = x2 + side * b.to * w2;
        this.quad(L[1], color, a1, y1, a2, y1, c2, y2, c1, y2);
      }
    }
    // Rumble strips, road, lines.
    const rum = th.rumble[band];
    this.quad(L[2], rum, x1 - w1 * 1.12, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 * 1.12, y2);
    this.quad(L[2], rum, x1 + w1, y1, x1 + w1 * 1.12, y1, x2 + w2 * 1.12, y2, x2 + w2, y2);
    this.quad(L[3], th.road[band], x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
    const lane = th.lane;
    for (const e of [-1, 1]) this.quad(L[4], lane, x1 + e * w1 * 0.93, y1, x1 + e * w1 * 0.96, y1, x2 + e * w2 * 0.96, y2, x2 + e * w2 * 0.93, y2);
    if (band === 0) this.quad(L[4], lane, x1 - w1 * 0.022, y1, x1 + w1 * 0.022, y1, x2 + w2 * 0.022, y2, x2 - w2 * 0.022, y2);
    if (seg.special) {
      // Chequered line across the road.
      const cols = 10;
      for (let c = 0; c < cols; c++) {
        const u0 = -1 + (2 * c) / cols, u1 = -1 + (2 * (c + 1)) / cols;
        const color = c % 2 ? '#111111' : '#fafafa';
        const color2 = c % 2 ? '#fafafa' : '#111111';
        const ym = (y1 + y2) / 2, xm = (x1 + x2) / 2, wm = (w1 + w2) / 2;
        this.quad(L[4], color, x1 + u0 * w1, y1, x1 + u1 * w1, y1, xm + u1 * wm, ym, xm + u0 * wm, ym);
        this.quad(L[4], color2, xm + u0 * wm, ym, xm + u1 * wm, ym, x2 + u1 * w2, y2, x2 + u0 * w2, y2);
      }
    }
  }

  bucket(race) {
    const B = this.buckets;
    for (const arr of B.values()) arr.length = 0;
    const put = (it) => {
      const i = Math.floor(it.z / SEG);
      let arr = B.get(i);
      if (!arr) {
        arr = [];
        B.set(i, arr);
      }
      arr.push(it);
    };
    for (const r of race.racers) put(r);
    for (const t of race.track.traffic) if (!t.gone) put(t);
  }

  // Screen position of a point on the road at world z (inside seg) and lateral x.
  at(seg, z, xr, out) {
    const t = clamp((z - seg.z) / SEG, 0, 1);
    const p1 = seg.p1, p2 = seg.p2;
    const w = lerp(p1.w, p2.w, t);
    out.x = lerp(p1.x, p2.x, t) + xr * w;
    out.y = lerp(p1.y, p2.y, t);
    out.s = lerp(p1.s, p2.s, t);
    return out;
  }

  // ------------------------------------------------------------ sprite drawing
  scenery(g, seg, s, W) {
    const sp = this.bank.get(s.k, s.v);
    if (!sp) return;
    const p = seg.p1;
    const sw = sp.w * p.s, sh = sp.h * p.s;
    if (sh < 1.2) return;
    const x = p.x + s.x * p.w;
    if (x + sw / 2 < 0 || x - sw / 2 > W) return;
    const y = p.y;
    if (s.f) {
      g.save();
      g.translate(x, 0);
      g.scale(-1, 1);
      g.drawImage(sp.img, -sw / 2, y - sh, sw, sh);
      g.restore();
    } else g.drawImage(sp.img, x - sw / 2, y - sh, sw, sh);
    if (s.k === 'windmill') {
      const sails = this.bank.get('sails');
      const ss = sails.w * p.s * 0.95;
      g.save();
      g.translate(x, y - sh * 0.76);
      g.rotate(this.time * 0.7 + s.v);
      g.drawImage(sails.img, -ss / 2, -ss / 2, ss, ss);
      g.restore();
    }
  }

  gantry(g, seg) {
    const p = seg.p1;
    const post = 2700 * p.s, pw = Math.max(1, 130 * p.s);
    const xl = p.x - p.w * 1.2, xr = p.x + p.w * 1.2;
    g.fillStyle = '#d7dce2';
    g.fillRect(xl - pw / 2, p.y - post, pw, post);
    g.fillRect(xr - pw / 2, p.y - post, pw, post);
    const bh = 620 * p.s;
    const top = p.y - post;
    g.fillStyle = '#0d1426';
    g.fillRect(xl, top, xr - xl, bh);
    const cell = bh / 2;
    const n = Math.max(2, Math.floor((xr - xl) / cell / 6));
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < 2; r++) {
        g.fillStyle = (i + r) % 2 ? '#fff' : '#111';
        g.fillRect(xl + i * cell, top + r * cell, cell, cell);
        g.fillStyle = (i + r) % 2 ? '#111' : '#fff';
        g.fillRect(xr - (i + 1) * cell, top + r * cell, cell, cell);
      }
    }
    if (bh > 6) {
      g.fillStyle = seg.special === 'finish' ? '#ffd23f' : '#ffffff';
      g.font = `italic 800 ${Math.round(bh * 0.8)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(seg.special === 'finish' ? 'FINISH' : 'START', (xl + xr) / 2, top + bh * 0.54);
    }
  }

  obstacle(g, seg, o, now) {
    const q = this.at(seg, o.z, o.x, TMP);
    if (o.k === 'puddle') {
      const sp = this.bank.get('puddle');
      const w = o.w * 2 * ROAD * q.s;
      const h = Math.max(1, w * clamp((this.camH / Math.max(1, (seg.z + SEG / 2 - (this.race.player.z - this.D)))) * 0.9, 0.05, 0.5));
      g.drawImage(sp.img, q.x - w / 2, q.y - h / 2, w, h);
      return;
    }
    let dx = 0, dy = 0, rot = 0;
    if (o.gone) {
      const t = now - o.hitT;
      if (o.k !== 'cone' || t > 0.9) return;
      dx = o.dir * t * 900 * q.s * 2;
      dy = -(t * 2600 - t * t * 2900) * q.s;
      rot = o.dir * t * 9;
    }
    const sp = this.bank.get(o.k);
    const sw = sp.w * q.s, sh = sp.h * q.s;
    if (sh < 1) return;
    if (rot) {
      g.save();
      g.translate(q.x + dx, q.y + dy - sh / 2);
      g.rotate(rot);
      g.drawImage(sp.img, -sw / 2, -sh / 2, sw, sh);
      g.restore();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath();
      g.ellipse(q.x, q.y, sw * 0.55, sw * 0.12, 0, 0, Math.PI * 2);
      g.fill();
      g.drawImage(sp.img, q.x - sw / 2, q.y - sh, sw, sh);
    }
  }

  coin(g, seg, c) {
    if (c.taken) return;
    const q = this.at(seg, c.z, c.x, TMP);
    const sp = this.bank.get('coin');
    const s = sp.h * q.s;
    if (s < 1) return;
    const spin = Math.abs(Math.cos(this.time * 4 + c.z * 0.01));
    const y = q.y - 260 * q.s - s + Math.sin(this.time * 5 + c.z) * 20 * q.s;
    g.drawImage(sp.img, q.x - (s * Math.max(0.12, spin)) / 2, y, s * Math.max(0.12, spin), s);
    c._sx = q.x;
    c._sy = y + s / 2;
    c._s = s;
  }

  // A picked-up coin flies to the coin counter (tx, ty in canvas pixels).
  coinFly(c, tx, ty) {
    if (c._sx === undefined) return;
    this.fx.push({ type: 'coinfly', x0: c._sx, y0: c._sy, s0: Math.min(c._s, 60 * this.dpr), tx, ty, t: 0, dur: 0.55 });
  }

  tractor(g, seg, t) {
    const q = this.at(seg, t.z, t.x, TMP);
    const sp = this.bank.get('tractor', Math.floor(t.z) % 4);
    const sw = sp.w * q.s, sh = sp.h * q.s;
    if (sh < 1) return;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.ellipse(q.x, q.y, sw * 0.55, sw * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    const bob = Math.sin(this.time * 9 + t.z) * 8 * q.s;
    g.drawImage(sp.img, q.x - sw / 2, q.y - sh + bob, sw, sh);
  }

  rider(g, seg, r, P) {
    const q = this.at(seg, r.z, r.x, TMP);
    const sp = this.bank.moped(r);
    const sw = sp.w * q.s, sh = sp.h * q.s;
    if (sh < 1.5 || q.x + sw < 0 || q.x - sw > this.W) return;
    const sp01 = clamp(r.speed / (60 * KMH), 0, 1.5);
    const bob = r.speed > 50 ? Math.sin(this.time * 26 + r.id) * 5 * q.s * sp01 : 0;
    // Shadow.
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath();
    g.ellipse(q.x, q.y, sw * 0.34, sw * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    // Exhaust flame when carrying stolen speed.
    const extra = this.race.stolen(r);
    if (extra > 6 * KMH && r.speed > 20 * KMH) {
      const k = clamp(extra / (40 * KMH), 0.3, 1);
      const fl = (0.6 + Math.random() * 0.4) * k;
      const gx = q.x, gy = q.y - sh * 0.08;
      const grd = g.createRadialGradient(gx, gy, 0, gx, gy, sw * 0.35 * fl + 1);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.3, 'rgba(90,220,255,0.85)');
      grd.addColorStop(1, 'rgba(60,120,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(gx, gy + sw * 0.05, sw * 0.18 * fl + 1, sw * 0.35 * fl + 1, 0, 0, Math.PI * 2);
      g.fill();
    }
    const blink = r.immune > 0 && Math.floor(this.time * 14) % 2 === 0;
    const prevA = g.globalAlpha;
    if (blink) g.globalAlpha = prevA * 0.45;
    const wob = r.wobble > 0 ? Math.sin(this.time * 30) * 0.25 : 0;
    g.save();
    g.translate(q.x, q.y + bob);
    g.rotate(r.lean * 0.32 + wob);
    g.drawImage(sp.img, -sw / 2, -sh, sw, sh);
    g.restore();
    g.globalAlpha = prevA;
    // Dizzy stars after being robbed.
    if (r.wobble > 0) {
      g.fillStyle = '#ffe14d';
      for (let i = 0; i < 3; i++) {
        const a = this.time * 8 + (i * Math.PI * 2) / 3;
        star(g, q.x + Math.cos(a) * sw * 0.35, q.y - sh * 1.02 + Math.sin(a) * sw * 0.1, Math.max(2, sw * 0.07));
      }
    }
    // Slipstream: wind streaks sliding past the player.
    if (r === P && r.draft > 0.3 && r.speed > 20 * KMH) {
      g.strokeStyle = `rgba(255,255,255,${0.55 * r.draft})`;
      g.lineWidth = Math.max(1.5, sw * 0.025);
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        const k = (i * 0.29 + this.time * 2.4) % 1;
        const yy = q.y - sh * (1.05 - k * 0.9);
        const xx = q.x + side * sw * (0.5 + k * 0.25);
        g.moveTo(xx, yy);
        g.lineTo(xx + side * sw * 0.06, yy + sh * 0.16);
      }
      g.stroke();
    }
    // Name tag for riders close ahead (drawn after all sprites).
    if (!this.demo && r !== P && r.z > P.z && r.z - P.z < 7000 && !r.finished && this.race.phase !== 'countdown') this.tags.push({ r, x: q.x, y: q.y - sh * 1.08, sw, d: r.z - P.z });
    r._sx = q.x;
    r._sy = q.y - sh * 0.5;
  }

  nameTags(g) {
    const placed = [];
    this.tags.sort((a, b) => a.d - b.d);
    for (const t of this.tags.slice(0, 4)) {
      const r = t.r;
      const fs = Math.round(clamp(t.sw * 0.2, 11 * this.dpr, 17 * this.dpr));
      g.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      const label = r.isBoss ? `★ ${r.name}` : r.name;
      const tw = g.measureText(label).width + fs * 0.8;
      const box = { x: t.x - tw / 2, y: t.y - fs * 1.15, w: tw, h: fs * 1.2 };
      if (placed.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) continue;
      placed.push(box);
      g.globalAlpha = clamp(1.4 - t.d / 7000, 0, 1);
      g.fillStyle = 'rgba(10,16,32,0.72)';
      g.beginPath();
      g.roundRect(box.x, box.y, box.w, box.h, fs * 0.4);
      g.fill();
      g.fillStyle = r.color;
      g.fillRect(box.x + fs * 0.3, t.y - fs * 0.78, fs * 0.22, fs * 0.5);
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText(label, t.x + fs * 0.12, t.y - fs * 0.05);
    }
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------ overlays
  effects(g, dt, P, W, H) {
    // Speed lines when going faster than your own moped.
    const over = clamp((P.speed - P.base0) / (35 * KMH), 0, 1);
    if (over > 0.05 && !P.finished) {
      const n = this.lite ? 14 : 26;
      if (this.lines.length !== n) {
        this.lines = [];
        for (let i = 0; i < n; i++) this.lines.push({ a: Math.random() * Math.PI * 2, r: 0.5 + Math.random() * 0.5, l: Math.random() });
      }
      g.strokeStyle = `rgba(255,255,255,${0.35 * over})`;
      g.lineWidth = Math.max(1, 2 * this.dpr);
      const R = Math.hypot(W, H) * 0.5;
      g.beginPath();
      for (const ln of this.lines) {
        ln.r += dt * (1.5 + over * 2.5);
        if (ln.r > 1) {
          ln.r = 0.5 + Math.random() * 0.2;
          ln.a = Math.random() * Math.PI * 2;
          ln.l = Math.random();
        }
        const r0 = R * ln.r, r1 = r0 + R * (0.08 + ln.l * 0.18) * (0.5 + over);
        const ca = Math.cos(ln.a), sa = Math.sin(ln.a) * 0.75;
        g.moveTo(this.cx + ca * r0, this.cy + sa * r0);
        g.lineTo(this.cx + ca * r1, this.cy + sa * r1);
      }
      g.stroke();
    }
    // Particles and floating numbers.
    const fx = this.fx;
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i];
      e.t += dt;
      if (e.t > e.dur) {
        fx.splice(i, 1);
        continue;
      }
      if (e.t < 0) continue;
      const k = e.t / e.dur;
      if (e.type === 'text') {
        const s = (e.big ? 44 : 34) * this.dpr * (k < 0.15 ? 0.6 + k * 2.7 : 1);
        g.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        g.font = `italic 800 ${Math.round(s)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const y = H * (e.y - k * 0.12);
        g.lineWidth = s * 0.14;
        g.strokeStyle = 'rgba(8,12,24,0.8)';
        g.strokeText(e.text, W * e.x, y);
        g.fillStyle = e.color;
        g.fillText(e.text, W * e.x, y);
        g.globalAlpha = 1;
      } else if (e.type === 'spark') {
        const a = e.from, b = e.to;
        if (a._sx === undefined || b._sx === undefined) continue;
        const ax = a._sx, ay = a._sy, bx = b._sx, by = b._sy;
        const mx = (ax + bx) / 2 + e.off * 60 * this.dpr, my = Math.min(ay, by) - 80 * this.dpr;
        const u = k, iu = 1 - u;
        const px = iu * iu * ax + 2 * iu * u * mx + u * u * bx;
        const py = iu * iu * ay + 2 * iu * u * my + u * u * by;
        g.fillStyle = e.color;
        g.beginPath();
        g.arc(px, py, (4 + 3 * (1 - k)) * this.dpr, 0, Math.PI * 2);
        g.fill();
      } else if (e.type === 'coinfly') {
        const u = k * k * (3 - 2 * k);
        const x = e.x0 + (e.tx - e.x0) * u, y = e.y0 + (e.ty - e.y0) * u - Math.sin(k * Math.PI) * 60 * this.dpr;
        const s = e.s0 * (1 - 0.6 * k);
        g.drawImage(this.bank.get('coin').img, x - s / 2, y - s / 2, s, s);
      } else if (e.type === 'confetti') {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.vr * dt;
        g.save();
        g.translate(e.x * W, e.y * H);
        g.rotate(e.rot);
        g.fillStyle = e.color;
        g.fillRect(-5 * this.dpr, -3 * this.dpr, 10 * this.dpr, 6 * this.dpr);
        g.restore();
      }
    }
    if (this.flashA > 0) {
      g.globalAlpha = this.flashA;
      const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      grd.addColorStop(0, hexA(this.flashColor, 0));
      grd.addColorStop(1, this.flashColor);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      this.flashA = Math.max(0, this.flashA - dt * 1.8);
    }
  }
}

const TMP = { x: 0, y: 0, s: 0 };

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function mixHex(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const m = (s) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

