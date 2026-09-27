// Track builder: a seeded point-to-point road made of segments with curves,
// hills, scenery, obstacles and coins. Pure data, no drawing.

import { SEG, RUMBLE } from '../config.js';
import { makeRng, weighted, easeIn, easeInOut, clamp } from '../util.js';
import { THEMES } from '../data/themes.js';

export const START_SEG = 40; // the grid sits here (camera needs road behind it)
const RUNOUT = 420; // road after the finish so the view never runs out

export class Track {
  constructor(cfg) {
    this.cfg = cfg;
    this.theme = THEMES[cfg.theme];
    this.rng = makeRng(cfg.seed);
    this.segments = [];
    this.obstacles = [];
    this.traffic = [];
    this.coins = [];
    this.build();
  }

  // ------------------------------------------------------------ geometry
  lastY() {
    const s = this.segments;
    return s.length ? s[s.length - 1].y2 : 0;
  }

  add(curve, y) {
    const i = this.segments.length;
    this.segments.push({
      i,
      z: i * SEG,
      curve,
      y1: this.lastY(),
      y2: y,
      band: Math.floor(i / RUMBLE) % 2,
      sprites: [],
      obs: [],
      coins: [],
      clip: 0,
      special: null,
      // Filled in by the renderer every frame.
      p1: { x: 0, y: 0, w: 0, s: 0 },
      p2: { x: 0, y: 0, w: 0, s: 0 },
      cx: 0,
      visible: false,
    });
  }

  // Road section: ease into the curve, hold it, ease out; height changes by dy over the whole section.
  section(enter, hold, leave, curve, dy) {
    const y0 = this.lastY(), y1 = y0 + dy;
    const total = enter + hold + leave;
    let n = 0;
    for (let i = 0; i < enter; i++) this.add(easeIn(0, curve, i / enter), easeInOut(y0, y1, ++n / total));
    for (let i = 0; i < hold; i++) this.add(curve, easeInOut(y0, y1, ++n / total));
    for (let i = 0; i < leave; i++) this.add(easeInOut(curve, 0, i / leave), easeInOut(y0, y1, ++n / total));
  }

  build() {
    const c = this.cfg, r = this.rng;
    const hillAmp = c.hills * 2600;
    // Start straight, then random sections until the length is reached.
    this.section(0, START_SEG + 50, 0, 0, 0);
    const target = START_SEG + c.length;
    let lastCurveSign = r.sign();
    while (this.segments.length < target - 90) {
      const left = target - 90 - this.segments.length;
      const len = Math.min(left, r.int(50, 110));
      const dy = hillAmp ? r.range(-1, 1) * hillAmp * (r.chance(0.6) ? 1 : 0) : 0;
      // Keep the road from drifting far up or down.
      const y = this.lastY();
      const safeDy = clamp(y + dy, -hillAmp * 1.6, hillAmp * 1.6) - y;
      if (r.chance(c.curveFreq) && len > 30) {
        // Alternate directions more often than not: S-bends read well.
        const sign = r.chance(0.65) ? -lastCurveSign : lastCurveSign;
        lastCurveSign = sign;
        const strength = r.range(0.45, 1) * c.curveMax;
        const enter = Math.round(len * 0.28), leave = Math.round(len * 0.28);
        const start = this.segments.length;
        this.section(enter, len - enter - leave, leave, sign * strength, safeDy);
        if (strength > 3.2) this.chevrons(start, enter + 10, sign);
      } else {
        this.section(Math.round(len * 0.3), Math.round(len * 0.4), len - Math.round(len * 0.3) - Math.round(len * 0.4), 0, safeDy);
      }
    }
    // Final straight to the finish, flatten out.
    this.section(20, target - this.segments.length - 20, 0, 0, -this.lastY() * 0.5);
    this.finishSeg = this.segments.length;
    this.section(10, RUNOUT, 0, 0, -this.lastY());
    this.length = this.finishSeg * SEG; // z of the finish line
    this.startZ = START_SEG * SEG;

    this.segments[START_SEG].special = 'start';
    this.segments[this.finishSeg].special = 'finish';

    this.decorate();
    this.placeObstacles();
    this.placeCoins();
  }

  segAt(z) {
    const s = this.segments;
    let i = Math.floor(z / SEG);
    if (i < 0) i = 0;
    else if (i >= s.length) i = s.length - 1;
    return s[i];
  }

  heightAt(z) {
    const seg = this.segAt(z);
    const t = clamp((z - seg.z) / SEG, 0, 1);
    return seg.y1 + (seg.y2 - seg.y1) * t;
  }

  // ------------------------------------------------------------ scenery
  sprite(i, k, x, extra) {
    const seg = this.segments[i];
    if (!seg) return;
    seg.sprites.push({ k, x, v: Math.floor(this.rng() * 1000), ...extra });
  }

  chevrons(start, count, sign) {
    // Warning signs on the outside of sharp bends.
    for (let i = start; i < start + count; i += 8) this.sprite(i, sign > 0 ? 'chevronR' : 'chevronL', -sign * 1.5);
  }

  decorate() {
    const th = this.theme, r = this.rng, n = this.segments.length;
    // Crowds and flags around start and finish.
    for (const at of [START_SEG, this.finishSeg]) {
      for (let i = at - 14; i < at + 16; i += 3) {
        this.sprite(i, 'crowd', -r.range(1.55, 1.75));
        this.sprite(i, 'crowd', r.range(1.55, 1.75));
      }
      for (let i = at - 30; i < at + 30; i += 6) {
        this.sprite(i, 'flag', -1.35);
        this.sprite(i, 'flag', 1.35);
      }
    }
    // A billboard or two for the game itself.
    this.sprite(START_SEG + 70, 'billboard', -2.1);
    this.sprite(Math.floor(this.finishSeg * 0.55), 'billboard', 2.1);

    const busy = (i) => i > START_SEG - 16 && i < START_SEG + 18;
    // Regular rows (poplar lanes, houses, lamp posts).
    for (const row of th.rows) {
      let on = true, flip = 0;
      for (let i = 0; i < n; i += row.every) {
        if (row.chance !== undefined) {
          // Rows come and go in stretches.
          if (i % 120 < row.every) on = r() < row.chance;
          if (!on) continue;
        }
        if (busy(i) && row.k !== 'lamp') continue;
        flip++;
        for (const side of [-1, 1]) this.sprite(i, row.k, side * (row.x + (row.jitter ? r.range(0, row.jitter) : 0)), { f: flip % 2 });
      }
    }
    // Landmarks.
    for (const lm of th.landmarks) {
      let i = r.int(lm.every[0] * 0.3, lm.every[1] * 0.6);
      while (i < n) {
        const side = lm.side || r.sign();
        this.sprite(i, lm.k, side * r.range(lm.x[0], lm.x[1]));
        i += r.int(lm.every[0], lm.every[1]);
      }
    }
    // Random props.
    for (let i = 0; i < n; i++) {
      if (busy(i)) continue;
      for (const side of [-1, 1]) {
        if (!r.chance(th.density)) continue;
        const choices = th.props.filter((p) => !p.side || p.side === side);
        if (!choices.length) continue;
        const p = weighted(r, choices);
        this.sprite(i, p.k, side * r.range(p.x[0], p.x[1]), { f: r() < 0.5 ? 1 : 0 });
      }
    }
    // Draw far sprites first within a segment.
    for (const seg of this.segments) seg.sprites.sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
  }

  // ------------------------------------------------------------ obstacles & coins
  free(i0, i1) {
    for (let i = i0; i <= i1; i++) {
      const s = this.segments[i];
      if (!s || s.obs.length || s.coins.length) return false;
    }
    return true;
  }

  pickSeg(margin = 6) {
    // Anywhere between the start area and the last straight.
    const a = START_SEG + 110, b = this.finishSeg - 40;
    for (let tries = 0; tries < 40; tries++) {
      const i = this.rng.int(a, b);
      if (this.free(i - margin, i + margin)) return i;
    }
    return -1;
  }

  obstacle(i, k, x, w) {
    const seg = this.segments[i];
    const o = { k, x, w, z: seg.z + SEG / 2, gone: false, hitT: 0, seg: i };
    seg.obs.push(o);
    this.obstacles.push(o);
    return o;
  }

  placeObstacles() {
    const c = this.cfg, r = this.rng;
    for (let n = 0; n < c.cones; n++) {
      const i = this.pickSeg(8);
      if (i < 0) break;
      // A little cluster: one to three cones, sometimes a line across a lane.
      const x0 = r.range(-0.75, 0.75);
      const count = r.int(1, 3);
      for (let j = 0; j < count; j++) this.obstacle(i + j * 2, 'cone', clamp(x0 + r.range(-0.18, 0.18), -0.9, 0.9), 0.06);
    }
    for (let n = 0; n < c.puddles; n++) {
      const i = this.pickSeg(8);
      if (i < 0) break;
      this.obstacle(i, 'puddle', r.range(-0.6, 0.6), 0.2);
    }
    for (let n = 0; n < c.barriers; n++) {
      const i = this.pickSeg(14);
      if (i < 0) break;
      // Roadworks close one side of the road; cones warn you first.
      const side = r.sign();
      for (let j = 0; j < 3; j++) this.obstacle(i - 8 + j * 3, 'cone', side * (0.78 - j * 0.12), 0.06);
      this.obstacle(i, 'barrier', side * 0.55, 0.4);
      this.obstacle(i + 2, 'barrier', side * 0.55, 0.4);
    }
    this.obstacles.sort((a, b) => a.z - b.z);
    // Slow tractors on the road (moving obstacles).
    for (let n = 0; n < c.tractors; n++) {
      const i = this.pickSeg(4);
      if (i < 0) break;
      this.traffic.push({ k: 'tractor', z: this.segments[i].z, x: r.sign() * r.range(0.45, 0.62), w: 0.28, speed: r.range(1500, 2100), gone: false });
    }
  }

  placeCoins() {
    const c = this.cfg, r = this.rng;
    for (let n = 0; n < c.coins; n++) {
      const i = this.pickSeg(10);
      if (i < 0) break;
      const x0 = r.range(-0.7, 0.7);
      const wave = r.chance(0.5) ? r.range(0.15, 0.35) * r.sign() : 0;
      for (let j = 0; j < 5; j++) {
        const seg = this.segments[i + j * 3];
        const coin = { x: clamp(x0 + wave * Math.sin((j / 4) * Math.PI), -0.85, 0.85), z: seg.z + SEG / 2, taken: false, t: 0 };
        seg.coins.push(coin);
        this.coins.push(coin);
      }
    }
    this.coins.sort((a, b) => a.z - b.z);
  }
}
