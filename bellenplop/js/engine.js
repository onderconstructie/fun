// Bellenplop game rules, without any drawing or DOM. The renderer reads the
// state and the event list; tools/bot.mjs runs the same code in Node.
//
// The field is a hex grid of bubbles hanging from the ceiling. Every other
// row is shifted half a bubble to the right and holds one bubble less.
// Shoot a bubble, and three or more of one colour that touch pop. Bubbles that
// no longer hang from the ceiling fall down. A shot that pops nothing is a
// miss; too many misses and the ceiling comes down a row (levels) or a new
// row is pushed in from the top (endless).

import { makeRng } from './util.js';

export const R = 20; // bubble radius in field units
export const D = R * 2;
export const ROW_H = R * Math.sqrt(3);
export const COLS = 11;
export const W = COLS * D; // field width: 440
export const DEAD_ROW = 11; // a bubble on this row (counted from the field top) means game over
export const DEAD_Y = R + DEAD_ROW * ROW_H - R; // the line drawn on screen
export const H = 520; // field height
export const SHOOT_X = W / 2;
export const SHOOT_Y = 482;
export const MAX_ROWS = 18;

export const STONE = 9; // grey stone: never pops, only falls
export const BOMB = 20; // special shot: blows up everything close by
export const RAINBOW = 21; // special shot: becomes the colour that pops most
export const NCOLORS = 6;

const STEP = 5; // flight is simulated in fixed steps, so the aim line and the real shot agree
const HIT = D * 0.8; // a little forgiving: brushing past a bubble still sticks
const MIN_ANGLE = (8 * Math.PI) / 180;
export const SPEED = 1150; // field units per second
export const METER_MAX = 14;

export const isColor = (v) => v >= 0 && v < NCOLORS;

export class Game {
  // opts: { mode: 'level' | 'endless', level: {rows, parity, colors, missLimit}, seed }
  constructor(opts) {
    this.mode = opts.mode;
    this.rng = makeRng(opts.seed ?? (Date.now() >>> 0));
    this.grid = [];
    for (let r = 0; r < MAX_ROWS; r++) this.grid.push(new Array(COLS).fill(-1));
    const lv = opts.level;
    lv.rows.forEach((row, r) => row.forEach((v, c) => (this.grid[r][c] = v)));
    this.parity = lv.parity || 0;
    this.palette = lv.colors; // colours in play, e.g. [0,1,2,3]
    this.missLimit = lv.missLimit;
    this.ceiling = 0; // rows the ceiling has come down
    this.score = 0;
    this.shots = 0;
    this.misses = 0;
    this.meter = 0;
    this.nextSpecial = BOMB;
    this.streak = 0;
    this.rowsAdded = 0;
    this.state = 'aim';
    this.shot = null;
    this.events = [];
    this.startCount = this.count();
    this.current = this.pickColor();
    this.next = this.pickColor();
  }

  // ---- grid geometry ----
  shifted(r) {
    return ((r + this.parity) & 1) === 1;
  }
  cols(r) {
    return this.shifted(r) ? COLS - 1 : COLS;
  }
  top() {
    return this.ceiling * ROW_H;
  }
  cellX(r, c) {
    return R + c * D + (this.shifted(r) ? R : 0);
  }
  cellY(r) {
    return this.top() + R + r * ROW_H;
  }
  valid(r, c) {
    return r >= 0 && r < MAX_ROWS && c >= 0 && c < this.cols(r);
  }
  get(r, c) {
    return this.valid(r, c) ? this.grid[r][c] : -1;
  }
  neighbors(r, c) {
    const s = this.shifted(r);
    const a = s ? c : c - 1;
    const out = [];
    const add = (rr, cc) => {
      if (this.valid(rr, cc)) out.push([rr, cc]);
    };
    add(r, c - 1);
    add(r, c + 1);
    add(r - 1, a);
    add(r - 1, a + 1);
    add(r + 1, a);
    add(r + 1, a + 1);
    return out;
  }
  count() {
    let n = 0;
    for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c] >= 0) n++;
    return n;
  }
  colorsLeft() {
    const set = new Set();
    for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < COLS; c++) if (isColor(this.grid[r][c])) set.add(this.grid[r][c]);
    return [...set];
  }
  lowestRow() {
    for (let r = MAX_ROWS - 1; r >= 0; r--) if (this.grid[r].some((v) => v >= 0)) return r;
    return -1;
  }

  // Only colours still on the field come out of the shooter.
  pickColor() {
    const left = this.colorsLeft();
    const pool = left.length ? left : this.palette;
    return pool[Math.floor(this.rng() * pool.length)];
  }
  refreshAmmo() {
    const left = this.colorsLeft();
    if (!left.length) return;
    if (isColor(this.current) && !left.includes(this.current)) this.current = this.pickColor();
    if (isColor(this.next) && !left.includes(this.next)) this.next = this.pickColor();
  }

  swap() {
    if (this.state !== 'aim') return false;
    [this.current, this.next] = [this.next, this.current];
    this.events.push({ t: 'swap' });
    return true;
  }

  // ---- shooting ----
  clampAngle(a) {
    // a: radians, measured from the positive x axis; up is negative y, so a in (0, PI)
    return Math.min(Math.PI - MIN_ANGLE, Math.max(MIN_ANGLE, a));
  }

  fire(angle) {
    if (this.state !== 'aim') return false;
    angle = this.clampAngle(angle);
    this.shot = { x: SHOOT_X, y: SHOOT_Y, ux: Math.cos(angle), uy: -Math.sin(angle), v: this.current, carry: 0 };
    this.current = this.next;
    this.next = this.pickColor();
    this.shots++;
    this.state = 'flying';
    this.events.push({ t: 'fire' });
    return true;
  }

  // One fixed step of flight. Returns null while flying, or the cell it sticks to.
  stepShot(s, bounces) {
    s.x += s.ux * STEP;
    s.y += s.uy * STEP;
    if (s.x < R) {
      s.x = 2 * R - s.x;
      s.ux = -s.ux;
      if (bounces) bounces.push([R, s.y]);
    } else if (s.x > W - R) {
      s.x = 2 * (W - R) - s.x;
      s.ux = -s.ux;
      if (bounces) bounces.push([W - R, s.y]);
    }
    if (s.y <= this.top() + R) return this.snap(s.x, s.y);
    const rr = Math.round((s.y - this.top() - R) / ROW_H);
    for (let r = Math.max(0, rr - 1); r <= Math.min(MAX_ROWS - 1, rr + 1); r++) {
      const y = this.cellY(r);
      if (Math.abs(y - s.y) > HIT) continue;
      for (let c = 0; c < this.cols(r); c++) {
        if (this.grid[r][c] < 0) continue;
        const dx = this.cellX(r, c) - s.x, dy = y - s.y;
        if (dx * dx + dy * dy < HIT * HIT) return this.snap(s.x, s.y);
      }
    }
    if (s.y > H + D) return this.snap(s.x, s.y); // cannot happen with clamped angles, but never fly forever
    return null;
  }

  // Nearest free cell that hangs on something (the ceiling or another bubble).
  snap(x, y) {
    const rr = Math.round((y - this.top() - R) / ROW_H);
    let best = null, bd = Infinity;
    for (let pass = 0; pass < 2 && !best; pass++) {
      for (let r = Math.max(0, rr - 1); r <= Math.min(MAX_ROWS - 1, rr + 1); r++) {
        for (let c = 0; c < this.cols(r); c++) {
          if (this.grid[r][c] >= 0) continue;
          if (pass === 0 && r !== 0 && !this.neighbors(r, c).some(([a, b]) => this.grid[a][b] >= 0)) continue;
          const dx = this.cellX(r, c) - x, dy = this.cellY(r) - y;
          const d = dx * dx + dy * dy;
          if (d < bd) (bd = d), (best = [r, c]);
        }
      }
    }
    return best;
  }

  // Where would a shot at this angle end up? Used for the aim line and the bot.
  trace(angle) {
    angle = this.clampAngle(angle);
    const s = { x: SHOOT_X, y: SHOOT_Y, ux: Math.cos(angle), uy: -Math.sin(angle) };
    const bounces = [];
    let cell = null;
    for (let i = 0; i < 2000 && !cell; i++) cell = this.stepShot(s, bounces);
    return { cell, bounces, end: [s.x, s.y] };
  }

  update(dt) {
    if (this.state !== 'flying') return;
    const s = this.shot;
    s.carry += SPEED * Math.min(dt, 0.05);
    const bounces = [];
    while (s.carry >= STEP) {
      s.carry -= STEP;
      const cell = this.stepShot(s, bounces);
      if (cell) {
        this.shot = null;
        this.land(cell, s.v);
        break;
      }
    }
    for (const b of bounces) this.events.push({ t: 'bounce', x: b[0], y: b[1] });
  }

  // Instant shot for the bot and tests.
  shootNow(angle) {
    if (!this.fire(angle)) return false;
    const s = this.shot;
    let cell = null;
    for (let i = 0; i < 2000 && !cell; i++) cell = this.stepShot(s, null);
    this.shot = null;
    this.land(cell, s.v);
    return true;
  }

  // ---- after a shot lands ----
  land([r, c], v) {
    const x = this.cellX(r, c), y = this.cellY(r);
    this.events.push({ t: 'land', r, c, x, y, v });
    let popped = [];
    if (v === BOMB) {
      this.grid[r][c] = -1;
      for (let a = 0; a < MAX_ROWS; a++)
        for (let b = 0; b < this.cols(a); b++) {
          if (this.grid[a][b] < 0) continue;
          const dx = this.cellX(a, b) - x, dy = this.cellY(a) - y;
          if (dx * dx + dy * dy <= (D * 2.1) ** 2) popped.push([a, b, this.grid[a][b]]);
        }
      this.events.push({ t: 'boom', x, y });
    } else {
      if (v === RAINBOW) v = this.bestRainbow(r, c);
      this.grid[r][c] = v;
      const group = this.flood(r, c);
      if (group.length >= 3) popped = group.map(([a, b]) => [a, b, v]);
    }
    for (const [a, b] of popped) this.grid[a][b] = -1;
    const dropped = this.dropFloating();

    let gain = popped.length * 10;
    if (dropped.length) gain += dropped.length * 20 + dropped.length * dropped.length * 2;
    if (popped.length || dropped.length) {
      this.streak++;
      if (this.streak >= 3) gain = Math.round(gain * (1 + Math.min(this.streak - 2, 5) * 0.1));
    } else this.streak = 0;
    this.score += gain;

    if (popped.length)
      this.events.push({ t: 'pop', list: popped.map(([a, b, col]) => ({ x: this.cellX(a, b), y: this.cellY(a), v: col })), gain, x, y, streak: this.streak });
    if (dropped.length) this.events.push({ t: 'drop', list: dropped });

    // Power meter: bubbles that fall charge it; a full meter gives a special shot.
    if (v !== BOMB && v !== RAINBOW) {
      this.meter += dropped.length + Math.max(0, popped.length - 3) * 0.5;
      if (this.meter >= METER_MAX) {
        this.meter = 0;
        this.next = this.nextSpecial;
        this.nextSpecial = this.nextSpecial === BOMB ? RAINBOW : BOMB;
        this.events.push({ t: 'special', v: this.next });
      }
    }

    const hit = popped.length > 0;
    if (this.count() === 0 && this.mode === 'endless') {
      // Cleared the field in endless: a big bonus and fresh rows.
      this.score += 1000;
      this.events.push({ t: 'clear', gain: 1000 });
      this.misses = 0;
      for (let i = 0; i < 4; i++) this.pushRow();
    } else if (this.count() === 0) {
      this.state = 'won';
      this.events.push({ t: 'won' });
      return;
    }
    if (this.mode === 'endless') {
      this.misses++;
      if (this.misses >= this.missLimit) {
        this.misses = 0;
        this.pushRow();
      }
    } else if (!hit) {
      this.misses++;
      if (this.misses >= this.missLimit) {
        this.misses = 0;
        this.ceiling++;
        this.events.push({ t: 'ceiling' });
      }
    }
    this.refreshAmmo();
    if (this.lowestRow() + this.ceiling >= DEAD_ROW) {
      this.state = 'lost';
      this.events.push({ t: 'lost' });
      return;
    }
    this.state = 'aim';
  }

  // How many shots until the pressure kicks in.
  pressureLeft() {
    return this.missLimit - this.misses;
  }

  flood(r, c) {
    const v = this.grid[r][c];
    const seen = new Set([r * COLS + c]);
    const stack = [[r, c]], out = [];
    while (stack.length) {
      const [a, b] = stack.pop();
      out.push([a, b]);
      for (const [x, y] of this.neighbors(a, b)) {
        const k = x * COLS + y;
        if (!seen.has(k) && this.grid[x][y] === v) seen.add(k), stack.push([x, y]);
      }
    }
    return out;
  }

  bestRainbow(r, c) {
    let best = -1, bn = 0;
    for (const [a, b] of this.neighbors(r, c)) {
      const v = this.grid[a][b];
      if (!isColor(v)) continue;
      this.grid[r][c] = v;
      const n = this.flood(r, c).length;
      if (n > bn) (bn = n), (best = v);
    }
    this.grid[r][c] = -1;
    return best >= 0 ? best : this.pickColor();
  }

  dropFloating() {
    const seen = new Set();
    const stack = [];
    for (let c = 0; c < this.cols(0); c++) if (this.grid[0][c] >= 0) seen.add(c), stack.push([0, c]);
    while (stack.length) {
      const [a, b] = stack.pop();
      for (const [x, y] of this.neighbors(a, b)) {
        const k = x * COLS + y;
        if (!seen.has(k) && this.grid[x][y] >= 0) seen.add(k), stack.push([x, y]);
      }
    }
    const out = [];
    for (let r = 0; r < MAX_ROWS; r++)
      for (let c = 0; c < this.cols(r); c++)
        if (this.grid[r][c] >= 0 && !seen.has(r * COLS + c)) {
          out.push({ x: this.cellX(r, c), y: this.cellY(r), v: this.grid[r][c] });
          this.grid[r][c] = -1;
        }
    return out;
  }

  // Endless: a fresh row slides in from the top and everything moves down.
  pushRow() {
    this.rowsAdded++;
    // More colours and quicker rows the longer you last.
    const nc = Math.min(NCOLORS, 4 + Math.floor(this.rowsAdded / 8));
    this.palette = [...Array(nc).keys()];
    this.missLimit = Math.max(4, 7 - Math.floor(this.rowsAdded / 10));
    this.grid.pop();
    this.parity ^= 1;
    const row = new Array(COLS).fill(-1);
    const n = this.cols(0);
    for (let c = 0; c < n; c++) {
      // Pairs of one colour now and then, never three in a row on the ceiling.
      const prev = c > 0 ? row[c - 1] : -1;
      const twice = c > 1 && row[c - 2] === prev;
      let v = prev >= 0 && !twice && this.rng() < 0.3 ? prev : this.palette[Math.floor(this.rng() * nc)];
      if (twice) while (v === prev) v = this.palette[Math.floor(this.rng() * nc)];
      row[c] = v;
    }
    this.grid.unshift(row);
    this.events.push({ t: 'push' });
  }
}
