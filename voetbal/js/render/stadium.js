// Static stadium geometry (pitch, markings, boards, stands, goals) and its drawing.

import { L, W, CX, CY, GOAL_HW, GOAL_H, BOX_D, BOX_HW, SIX_D, SIX_HW, PEN_D, CIRCLE_R, PHYS } from '../engine/constants.js';

const LINE_W = 0.12;
const BX = PHYS.boardX, BY = PHYS.boardY;

// ---------------------------------------------------------------- geometry builders
function quad(x0, y0, x1, y1, z = 0) {
  return [x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z];
}

function segQuad(ax, ay, bx, by, w = LINE_W) {
  const dx = bx - ax, dy = by - ay;
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = (-dy / l) * (w / 2), ny = (dx / l) * (w / 2);
  return [ax + nx, ay + ny, 0, bx + nx, by + ny, 0, bx - nx, by - ny, 0, ax - nx, ay - ny, 0];
}

function arcPoly(cx, cy, r, a0, a1, n, w = LINE_W) {
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const c = Math.cos(a), s = Math.sin(a);
    outer.push(cx + c * (r + w / 2), cy + s * (r + w / 2), 0);
    inner.push(cx + c * (r - w / 2), cy + s * (r - w / 2), 0);
  }
  const pts = [...outer];
  for (let i = n; i >= 0; i--) pts.push(inner[i * 3], inner[i * 3 + 1], 0);
  return pts;
}

function disc(cx, cy, r, n = 10) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
  }
  return pts;
}

function buildLines() {
  const polys = [];
  const seg = (a, b, c, d) => polys.push(segQuad(a, b, c, d));
  // Outer lines (extend by half width at corners).
  const e = LINE_W / 2;
  seg(-e, 0, L + e, 0);
  seg(-e, W, L + e, W);
  seg(0, -e, 0, W + e);
  seg(L, -e, L, W + e);
  seg(CX, 0, CX, W);
  // Center circle and spot.
  for (let k = 0; k < 4; k++) polys.push(arcPoly(CX, CY, CIRCLE_R, (k * Math.PI) / 2, ((k + 1) * Math.PI) / 2, 12));
  polys.push(disc(CX, CY, 0.22));
  for (const side of [0, 1]) {
    const gx = side ? L : 0, s = side ? -1 : 1;
    // Penalty box.
    seg(gx, CY - BOX_HW, gx + s * BOX_D, CY - BOX_HW);
    seg(gx + s * BOX_D, CY - BOX_HW, gx + s * BOX_D, CY + BOX_HW);
    seg(gx + s * BOX_D, CY + BOX_HW, gx, CY + BOX_HW);
    // Six-yard box.
    seg(gx, CY - SIX_HW, gx + s * SIX_D, CY - SIX_HW);
    seg(gx + s * SIX_D, CY - SIX_HW, gx + s * SIX_D, CY + SIX_HW);
    seg(gx + s * SIX_D, CY + SIX_HW, gx, CY + SIX_HW);
    // Penalty spot and arc.
    const px = gx + s * PEN_D;
    polys.push(disc(px, CY, 0.18));
    const a = Math.acos((BOX_D - PEN_D) / CIRCLE_R);
    if (side === 0) polys.push(arcPoly(px, CY, CIRCLE_R, -a, a, 14));
    else polys.push(arcPoly(px, CY, CIRCLE_R, Math.PI - a, Math.PI + a, 14));
  }
  // Corner arcs.
  polys.push(arcPoly(0, 0, 1, 0, Math.PI / 2, 5));
  polys.push(arcPoly(L, 0, 1, Math.PI / 2, Math.PI, 5));
  polys.push(arcPoly(L, W, 1, Math.PI, Math.PI * 1.5, 5));
  polys.push(arcPoly(0, W, 1, Math.PI * 1.5, Math.PI * 2, 5));
  return polys.map((p) => new Float64Array(p));
}

function buildStripes() {
  const a = [], b = [];
  const w = L / 20;
  for (let i = -2; i < 22; i++) {
    const x0 = Math.max(-BX, i * w), x1 = Math.min(L + BX, (i + 1) * w);
    if (x1 <= x0) continue;
    (i % 2 === 0 ? a : b).push(new Float64Array(quad(x0, -BY, x1, W + BY)));
  }
  return [a, b];
}

// Stands: sloped planes rising away from the pitch.
function buildStands() {
  const z0 = 1.2, z1 = 24, run = 34;
  const far = new Float64Array([-40, -BY - 2, z0, L + 40, -BY - 2, z0, L + 40, -BY - 2 - run, z1, -40, -BY - 2 - run, z1]);
  const near = new Float64Array([L + 40, W + BY + 2, z0, -40, W + BY + 2, z0, -40, W + BY + 2 + run, z1, L + 40, W + BY + 2 + run, z1]);
  const left = new Float64Array([-BX - 2, W + 40, z0, -BX - 2, -40, z0, -BX - 2 - run, -40, z1, -BX - 2 - run, W + 40, z1]);
  const right = new Float64Array([L + BX + 2, -40, z0, L + BX + 2, W + 40, z0, L + BX + 2 + run, W + 40, z1, L + BX + 2 + run, -40, z1]);
  return [
    { pts: far, u: [1, 0, 0], v: [0, -run, z1 - z0], len: L + 80, name: 'far' },
    { pts: near, u: [-1, 0, 0], v: [0, run, z1 - z0], len: L + 80, name: 'near' },
    { pts: left, u: [0, -1, 0], v: [-run, 0, z1 - z0], len: W + 80, name: 'left' },
    { pts: right, u: [0, 1, 0], v: [run, 0, z1 - z0], len: W + 80, name: 'right' },
  ];
}

// Advertising boards: panels along each side.
const BOARD_H = 0.9;
function buildBoards() {
  const panels = [];
  const addRun = (x0, y0, x1, y1, n) => {
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0;
      const bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
      panels.push({ pts: new Float64Array([ax, ay, 0, bx, by, 0, bx, by, BOARD_H, ax, ay, BOARD_H]), idx: panels.length });
    }
  };
  addRun(-BX, -BY, L + BX, -BY, 10); // far (reads left->right from the broadcast camera)
  addRun(L + BX, W + BY, -BX, W + BY, 10); // near
  addRun(-BX, W + BY, -BX, -BY, 6); // left, facing +x
  addRun(L + BX, -BY, L + BX, W + BY, 6); // right, facing -x
  return panels;
}

// Goal frame + net as 3D line segments.
function buildGoal(side) {
  const gx = side ? L : 0, out = side ? 1 : -1;
  const y0 = CY - GOAL_HW, y1 = CY + GOAL_HW;
  const d1 = 1.0 * out, d2 = 2.0 * out;
  const back = [];
  // Net top: from crossbar back to (d1, 2.3); back slope to ground at d2.
  const net = [];
  const ny = 12;
  for (let i = 0; i <= ny; i++) {
    const y = y0 + ((y1 - y0) * i) / ny;
    net.push([gx, y, GOAL_H, gx + d1, y, 2.3]);
    net.push([gx + d1, y, 2.3, gx + d2, y, 0]);
  }
  for (let k = 0; k <= 4; k++) {
    const t = k / 4;
    // across the top
    net.push([gx + d1 * t, y0, GOAL_H - 0.14 * t, gx + d1 * t, y1, GOAL_H - 0.14 * t]);
  }
  for (let k = 1; k <= 5; k++) {
    const t = k / 5;
    const x = gx + d1 + (d2 - d1) * t, z = 2.3 * (1 - t);
    net.push([x, y0, z, x, y1, z]);
  }
  // Side nets (vertical lines + horizontals).
  for (const y of [y0, y1]) {
    for (let k = 1; k <= 5; k++) {
      const t = k / 5;
      const x = gx + d2 * t;
      const ztop = t < 0.5 ? GOAL_H - 0.28 * t : 2.3 * (1 - (t - 0.5) / 0.5);
      net.push([x, y, 0, x, y, Math.max(0, ztop)]);
    }
    for (let k = 1; k <= 4; k++) {
      const z = (GOAL_H * k) / 5;
      const xe = z <= 2.3 ? gx + d1 + (d2 - d1) * (1 - z / 2.3) : gx + d1;
      net.push([gx, y, z, xe, y, z]);
    }
    back.push([gx + d2, y, 0, gx + d1, y, 2.3], [gx + d1, y, 2.3, gx, y, GOAL_H]);
  }
  return {
    side,
    gx,
    net,
    back,
    posts: [
      [gx, y0, 0, gx, y0, GOAL_H],
      [gx, y1, 0, gx, y1, GOAL_H],
    ],
    bar: [gx, y0 - 0.06, GOAL_H, gx, y1 + 0.06, GOAL_H],
    center: [gx + out * 1.0, CY, 1.0],
  };
}

// ---------------------------------------------------------------- crowd texture
function makeCrowd(colors) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 128) : document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0f1c';
  g.fillRect(0, 0, 256, 128);
  // Seat rows.
  for (let y = 0; y < 128; y += 8) {
    g.fillStyle = y % 16 ? '#121829' : '#151c30';
    g.fillRect(0, y, 256, 4);
  }
  const palette = [...colors, '#e8e2d6', '#c9b79c', '#3b4252', '#e2e8f0', '#a3a3a3', '#f5d0a9', '#7c5a3a'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 2; y < 128; y += 8) {
    for (let x = 1; x < 256; x += 4.2) {
      if (rnd() < 0.12) continue;
      const col = palette[Math.floor(rnd() * palette.length)];
      g.fillStyle = col;
      const jx = x + rnd() * 1.6, jy = y + rnd() * 1.5;
      g.fillRect(jx, jy + 2, 3, 3); // body
      g.fillStyle = rnd() < 0.5 ? '#d9b08c' : '#8d5a3b';
      g.fillRect(jx + 0.6, jy, 2, 2); // head
    }
  }
  return c;
}

function makeBoardTex(i) {
  const texts = ['GOUDEN ELF', 'ONDER CONSTRUCTIE', 'FUN', 'SPEEL EERLIJK', 'VOETBAL', 'GOUDEN ELF', '⚽ DOELPUNT', 'RESPECT', 'FAN ZONE', 'FUN'];
  const bg = ['#0b1b33', '#f5c542', '#10b981', '#111827', '#dc2626', '#0b1b33', '#1d4ed8', '#111827', '#7c3aed', '#10b981'];
  const fg = ['#f5c542', '#0b1b33', '#ffffff', '#f8fafc', '#ffffff', '#ffffff', '#ffffff', '#f5c542', '#ffffff', '#0b1b33'];
  const k = i % texts.length;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 20) : document.createElement('canvas');
  c.width = 256;
  c.height = 20;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 20);
  grad.addColorStop(0, bg[k]);
  grad.addColorStop(1, shadeHex(bg[k], -0.25));
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 20);
  g.fillStyle = fg[k];
  g.font = '800 15px "Barlow Condensed", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texts[k], 128, 11);
  return c;
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ---------------------------------------------------------------- stadium
export class Stadium {
  constructor(teamColors = []) {
    this.lines = buildLines();
    this.stripes = buildStripes();
    this.surround = new Float64Array(quad(-BX - 1, -BY - 1, L + BX + 1, W + BY + 1));
    this.stands = buildStands();
    this.boards = buildBoards();
    this.goals = [buildGoal(0), buildGoal(1)];
    this.crowd = makeCrowd(teamColors);
    this.boardTex = [];
    this.buf = new Float64Array(256);
    this.p = { x: 0, y: 0, s: 0, z: 0, ok: false };
    this.q = { x: 0, y: 0, s: 0, z: 0, ok: false };
    this.crowdPattern = null;
    this.bounce = 0;
  }

  refreshTextures() {
    this.boardTex = [];
    for (let i = 0; i < 10; i++) this.boardTex.push(makeBoardTex(i));
  }

  poly(ctx, cam, pts) {
    const n = cam.projectPoly(pts, this.buf);
    if (n < 3) return false;
    const b = this.buf;
    ctx.moveTo(b[0], b[1]);
    for (let i = 1; i < n; i++) ctx.lineTo(b[i * 2], b[i * 2 + 1]);
    ctx.closePath();
    return true;
  }

  drawBackground(ctx, cam, excitement = 0) {
    const w = cam.w, h = cam.h;
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, '#05070d');
    sky.addColorStop(1, '#10172a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stands, farthest first.
    if (!this.crowdPattern) this.crowdPattern = ctx.createPattern(this.crowd, 'repeat');
    const order = this.stands
      .map((s) => {
        cam.toCam(s.pts[0] * 0.5 + s.pts[6] * 0.5, s.pts[1] * 0.5 + s.pts[7] * 0.5, s.pts[2] * 0.5 + s.pts[8] * 0.5, this.p);
        return { s, d: this.p.z };
      })
      .sort((a, b) => b.d - a.d);
    this.bounce = excitement > 0.5 ? Math.sin(performance.now() / 90) * excitement : 0;
    for (const { s } of order) {
      ctx.beginPath();
      if (!this.poly(ctx, cam, s.pts)) continue;
      // Pattern mapped roughly onto the stand: scale by mid-depth.
      cam.project(s.pts[0] * 0.5 + s.pts[6] * 0.5, s.pts[1] * 0.5 + s.pts[7] * 0.5, s.pts[2] * 0.5 + s.pts[8] * 0.5, this.p);
      const sc = this.p.ok ? Math.max(0.15, this.p.s / 18) : 1;
      if (this.crowdPattern.setTransform && typeof DOMMatrix !== 'undefined') {
        const m = new DOMMatrix();
        m.translateSelf(this.p.x || 0, (this.p.y || 0) + this.bounce * 2);
        m.scaleSelf(sc, sc);
        this.crowdPattern.setTransform(m);
      }
      ctx.fillStyle = this.crowdPattern;
      ctx.fill();
      // Darken the upper tiers for depth.
      ctx.fillStyle = 'rgba(3,6,14,0.28)';
      ctx.fill();
    }
    // Floodlight haze.
    const haze = ctx.createRadialGradient(w * 0.5, -h * 0.2, 10, w * 0.5, -h * 0.2, h * 1.1);
    haze.addColorStop(0, 'rgba(255,255,235,0.10)');
    haze.addColorStop(1, 'rgba(255,255,235,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
  }

  drawPitch(ctx, cam) {
    ctx.beginPath();
    this.poly(ctx, cam, this.surround);
    ctx.fillStyle = '#2f7a35';
    ctx.fill();
    ctx.beginPath();
    for (const q of this.stripes[0]) this.poly(ctx, cam, q);
    ctx.fillStyle = '#3a8f3f';
    ctx.fill();
    ctx.beginPath();
    for (const q of this.stripes[1]) this.poly(ctx, cam, q);
    ctx.fillStyle = '#347f39';
    ctx.fill();
    // Markings.
    ctx.beginPath();
    for (const p of this.lines) this.poly(ctx, cam, p);
    ctx.fillStyle = 'rgba(245,248,240,0.9)';
    ctx.fill();
  }

  drawBoards(ctx, cam) {
    if (!this.boardTex.length) this.refreshTextures();
    const p = this.p, q = this.q;
    for (const b of this.boards) {
      const pts = b.pts;
      // Back-face cull: board faces the pitch centre.
      ctx.beginPath();
      if (!this.poly(ctx, cam, pts)) continue;
      const tex = this.boardTex[b.idx % this.boardTex.length];
      // Affine map texture (256x20) onto the quad using 3 projected corners.
      const ok0 = cam.project(pts[9], pts[10], pts[11], p); // top-left
      const x0 = p.x, y0 = p.y;
      const ok1 = cam.project(pts[6], pts[7], pts[8], q); // top-right
      const x1 = q.x, y1 = q.y;
      const ok2 = cam.project(pts[0], pts[1], pts[2], p); // bottom-left
      if (!ok0 || !ok1 || !ok2) {
        ctx.fillStyle = '#0b1b33';
        ctx.fill();
        continue;
      }
      const x2 = p.x, y2 = p.y;
      // Skip boards seen from behind (mirrored).
      const cross = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
      if (cross < 0) {
        ctx.fillStyle = '#1b2233';
        ctx.fill();
        continue;
      }
      ctx.save();
      ctx.clip();
      ctx.setTransform(
        ctx.__dpr * ((x1 - x0) / 256), ctx.__dpr * ((y1 - y0) / 256),
        ctx.__dpr * ((x2 - x0) / 20), ctx.__dpr * ((y2 - y0) / 20),
        ctx.__dpr * x0, ctx.__dpr * y0,
      );
      ctx.drawImage(tex, 0, 0);
      ctx.restore();
    }
  }

  // Goal nets: drawn as depth-sorted items. part: 'net' | 'post0' | 'post1' | 'bar'
  drawGoalPart(ctx, cam, goal, part) {
    const p = this.p, q = this.q;
    const seg = (s, width, style) => {
      if (!cam.project(s[0], s[1], s[2], p) || !cam.project(s[3], s[4], s[5], q)) return;
      ctx.lineWidth = Math.max(1, width * (p.s + q.s) * 0.5);
      ctx.strokeStyle = style;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    };
    if (part === 'net') {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(235,240,245,0.38)';
      ctx.beginPath();
      for (const s of goal.net) {
        if (!cam.project(s[0], s[1], s[2], p) || !cam.project(s[3], s[4], s[5], q)) continue;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      for (const s of goal.back) seg(s, 0.05, 'rgba(210,215,225,0.9)');
      return;
    }
    if (part === 'bar') {
      seg(goal.bar, 0.13, '#f4f6f8');
      return;
    }
    const s = goal.posts[part === 'post0' ? 0 : 1];
    seg(s, 0.13, '#f4f6f8');
  }

  drawCornerFlags(ctx, cam, t) {
    const p = this.p, q = this.q;
    for (const [x, y] of [[0, 0], [L, 0], [0, W], [L, W]]) {
      if (!cam.project(x, y, 0, p) || !cam.project(x, y, 1.5, q)) continue;
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = Math.max(1, 0.05 * p.s);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      const fw = 0.45 * q.s, fh = 0.3 * q.s;
      const wave = Math.sin(t * 5 + x) * 0.15 * q.s;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x + fw, q.y + fh * 0.5 + wave);
      ctx.lineTo(q.x, q.y + fh);
      ctx.closePath();
      ctx.fill();
    }
  }
}
