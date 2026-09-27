// Procedural players. A small 3D skeleton in body space (f = forward,
// r = the player's right, h = up; metres) is posed for the current state,
// projected with the camera basis at the foot point and drawn as shaded,
// outlined capsules: legs with socks and boots, sleeves, a lit torso with
// the kit pattern and a shirt number, and a head with hair and beard.

import { ST } from '../engine/player.js';

const A = { x: 0, y: 0, s: 0, z: 0, ok: false };
const B = { x: 0, y: 0, s: 0, z: 0, ok: false };
const TAU = Math.PI * 2;
const OUTLINE = 'rgba(6,10,20,0.62)';

let now = 0;
let lite = false;
// Renderer clock, for idle motion.
export function setSpriteTime(t) {
  now = t;
}

// Low-end devices: flat colours, no outlines or shirt numbers.
export function setSpriteLite(on) {
  lite = !!on;
}

// Screen-space basis at a world point: the foot position, screen vectors of
// one metre up (ux, uy), forward (fx, fy) and to the player's right (rx, ry),
// and how far forward/right point away from the camera (df, dr in -1..1).
export function basis(cam, x, y, fx, fy, out) {
  if (!cam.project(x, y, 0, A)) return false;
  out.x = A.x;
  out.y = A.y;
  out.s = A.s;
  out.depth = A.z;
  if (cam.project(x, y, 1, B)) {
    out.ux = B.x - A.x;
    out.uy = B.y - A.y;
  } else {
    out.ux = 0;
    out.uy = -A.s;
  }
  out.u = Math.max(1, -out.uy);
  if (cam.project(x + fx, y + fy, 0, B)) {
    out.fx = B.x - A.x;
    out.fy = B.y - A.y;
  } else {
    out.fx = fx * A.s;
    out.fy = 0;
  }
  // The player's right is (-fy, fx) in this world (x to screen-right, y
  // towards the near touchline, z up).
  if (cam.project(x - fy, y + fx, 0, B)) {
    out.rx = B.x - A.x;
    out.ry = B.y - A.y;
  } else {
    out.rx = 0;
    out.ry = 0;
  }
  const hl = Math.hypot(cam.fx, cam.fy) || 1;
  out.df = (fx * cam.fx + fy * cam.fy) / hl;
  out.dr = (fx * cam.fy - fy * cam.fx) / hl;
  return true;
}

export function drawShadow(ctx, v, alpha = 0.32) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(v.x, v.y, 0.42 * v.s, 0.42 * v.s * (v.u / v.s) * 0.45 + 0.8, 0, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------- colours
const shadeMaps = new Map();
// k < 1 darkens, k > 1 lightens towards white.
function shade(hex, k) {
  let m = shadeMaps.get(k);
  if (!m) shadeMaps.set(k, (m = new Map()));
  let c = m.get(hex);
  if (c) return c;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 1) {
    r *= k;
    g *= k;
    b *= k;
  } else {
    const t = k - 1;
    r += (255 - r) * t;
    g += (255 - g) * t;
    b += (255 - b) * t;
  }
  c = `rgb(${r | 0},${g | 0},${b | 0})`;
  m.set(hex, c);
  return c;
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// Number colour: the kit trim when it stands out, else black or white.
const numColors = new WeakMap();
function numberColor(kit) {
  let c = numColors.get(kit);
  if (c) return c;
  const ls = lum(kit.shirt);
  c = Math.abs(lum(kit.trim) - ls) > 0.3 ? kit.trim : ls > 0.55 ? '#111827' : '#f8fafc';
  numColors.set(kit, c);
  return c;
}

// Pre-rendered shirt numbers (drawn with a transform onto the shirt).
const numCache = new Map();
function numberSprite(n, color) {
  const key = n + color;
  let c = numCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '800 60px "Barlow Condensed", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 5;
  g.strokeStyle = lum(color) > 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)';
  g.strokeText(String(n), 48, 34);
  g.fillStyle = color;
  g.fillText(String(n), 48, 34);
  const ready = !document.fonts || document.fonts.check('800 60px "Barlow Condensed"');
  if (ready) numCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- skeleton
const PEL = 0, HIPL = 1, HIPR = 2, KNL = 3, KNR = 4, ANL = 5, ANR = 6, TOL = 7, TOR = 8;
const NECK = 9, HEAD = 10, SHL = 11, SHR = 12, ELL = 13, ELR = 14, HAL = 15, HAR = 16;
// Shape points: torso hull, shorts hull, chest band hull.
const T0 = 17, NT = 10, S0 = 27, NS = 8, B0 = 35, NB = 8, NP = 43;
const JF = new Float64Array(NP), JR = new Float64Array(NP), JH = new Float64Array(NP);
const X = new Float64Array(NP), Y = new Float64Array(NP), D = new Float64Array(NP);

// Torso-frame shapes (relative to the pelvis, upright): f, r, h triples.
const TORSO = [
  0.1, -0.19, 0.47, 0.1, 0.19, 0.47, -0.1, -0.19, 0.47, -0.1, 0.19, 0.47,
  0.02, -0.232, 0.4, 0.02, 0.232, 0.4,
  0.09, -0.142, 0.03, 0.09, 0.142, 0.03, -0.09, -0.142, 0.03, -0.09, 0.142, 0.03,
];
const SHORTS = [
  0.1, -0.165, 0.08, 0.1, 0.165, 0.08, -0.1, -0.165, 0.08, -0.1, 0.165, 0.08,
  0.11, -0.19, -0.17, 0.11, 0.19, -0.17, -0.11, -0.19, -0.17, -0.11, 0.19, -0.17,
];
const BAND = [
  0.104, -0.19, 0.34, 0.104, 0.19, 0.34, -0.104, -0.19, 0.34, -0.104, 0.19, 0.34,
  0.1, -0.18, 0.25, 0.1, 0.18, 0.25, -0.1, -0.18, 0.25, -0.1, 0.18, 0.25,
];

const THIGH = 0.45, SHIN = 0.44;
let pf = 0, ph = 0.95, tc = 1, ts = 0; // pelvis position and torso lean (cos, sin)

function setJ(j, f, r, h) {
  JF[j] = f;
  JR[j] = r;
  JH[j] = h;
}

// A point given in the torso frame, leaned and placed at the pelvis.
function setT(j, f, r, h) {
  JF[j] = pf + f * tc + h * ts;
  JR[j] = r;
  JH[j] = ph + h * tc - f * ts;
}

// Two-bone leg: knee from the ankle target (bending forward), then the toe.
function leg(hip, knee, ankle, toe, af, ar, ah, pitch) {
  const hf = JF[hip], hh = JH[hip];
  let df = af - hf, dh = ah - hh;
  let d = Math.sqrt(df * df + dh * dh);
  const maxD = THIGH + SHIN - 0.004;
  if (d > maxD) {
    const k = maxD / d;
    df *= k;
    dh *= k;
    d = maxD;
  }
  if (d < 0.05) d = 0.05;
  JF[ankle] = hf + df;
  JH[ankle] = hh + dh;
  JR[ankle] = ar;
  const ca = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d);
  const a = Math.acos(ca < -1 ? -1 : ca > 1 ? 1 : ca);
  const ux = df / d, uh = dh / d, c = Math.cos(a), s = Math.sin(a);
  JF[knee] = hf + THIGH * (ux * c - uh * s);
  JH[knee] = hh + THIGH * (ux * s + uh * c);
  JR[knee] = (JR[hip] + ar) / 2;
  JF[toe] = JF[ankle] + Math.cos(pitch) * 0.19;
  JH[toe] = JH[ankle] + Math.sin(pitch) * 0.19 - 0.025;
  JR[toe] = ar;
}

// Arm from angles in the torso frame: upper arm swung forward by `up`
// (0 = hanging), forearm flexed further by `bend`.
function armAngles(sh, el, ha, side, up, bend, out) {
  const f0 = 0, r0 = side * 0.195, h0 = 0.47;
  const ef = f0 + 0.29 * Math.sin(up), eh = h0 - 0.29 * Math.cos(up), er = r0 + side * out;
  const a2 = up + bend;
  setT(el, ef, er, eh);
  setT(ha, ef + 0.27 * Math.sin(a2), er + side * out * 0.5, eh - 0.27 * Math.cos(a2));
  setT(sh, f0, r0, h0);
}

// Arm with explicit elbow and hand positions in the torso frame.
function armAt(sh, el, ha, side, ef, er, eh, hf, hr, hh) {
  setT(sh, 0, side * 0.195, 0.47);
  setT(el, ef, side * er, eh);
  setT(ha, hf, side * hr, hh);
}

const ease = (t) => t * t * (3 - 2 * t);

// Running legs: each foot sweeps back on the ground, then lifts and swings
// forward (heel kick grows with speed).
function gaitLegs(phs, k) {
  const amp = 0.1 + 0.4 * k, lift = 0.06 + 0.3 * k;
  for (let i = 0; i < 2; i++) {
    const psi = phs + i * Math.PI;
    const c = Math.cos(psi);
    const l = lift * Math.max(0, -Math.sin(psi + 0.45));
    const pitch = l > 0.005 ? -0.9 * (l / lift) * (c < 0 ? 1 : 0.35) : 0;
    if (i === 0) leg(HIPL, KNL, ANL, TOL, amp * c + 0.04, -0.08, 0.085 + l, pitch);
    else leg(HIPR, KNR, ANR, TOR, amp * c + 0.04, 0.08, 0.085 + l, pitch);
  }
}

function standLegs(wide = 0.12, fwd = 0.03) {
  leg(HIPL, KNL, ANL, TOL, fwd, -wide, 0.085, 0);
  leg(HIPR, KNR, ANR, TOR, fwd - 0.02, wide, 0.085, 0);
}

// Pose the skeleton for player state p. Returns the torso lean.
function pose(p, look) {
  const st = p.state;
  const sp = p.speedNow || 0;
  const k = Math.min(1, sp / 8.5);
  const phs = p.anim || 0;
  const seed = (p.number || 0) * 1.7;
  let lean = 0.03;
  pf = 0;
  ph = 0.97;
  let legsDone = false, armsDone = false;

  const moving = sp > 0.35;

  // Pelvis height and lean first (the legs hang from the hips).
  if (st === ST.DOWN) {
    ph = 0.13;
    lean = -1.5;
  } else if (st === ST.SLIDE) {
    ph = 0.24;
    lean = -1.15;
  } else if (st === ST.TACKLE) {
    ph = 0.8;
    lean = 0.38;
  } else if (st === ST.DIVE) {
    lean = 0;
  } else if (st === ST.HEADER) {
    lean = 0.14;
  } else if ((st === ST.KICK || p.kickT > 0) && st !== ST.HOLD) {
    const t = Math.min(1, Math.max(0, 1 - p.kickT / 0.3));
    ph = 0.93;
    lean = -0.04 - 0.14 * t;
  } else if (moving) {
    ph = 0.97 - 0.05 * k + 0.028 * k * Math.cos(2 * phs);
    lean = 0.08 + 0.24 * k;
  } else {
    ph = 0.97 + 0.006 * Math.sin(now * 2.2 + seed);
  }
  const gkReady = p.isGK && st === ST.RUN && sp < 3.2 && !(p.kickT > 0);
  if (gkReady) {
    ph -= 0.12;
    lean = 0.24;
  }
  tc = Math.cos(lean);
  ts = Math.sin(lean);
  setJ(PEL, pf, 0, ph);
  setJ(HIPL, pf, -0.09, ph - 0.04);
  setJ(HIPR, pf, 0.09, ph - 0.04);

  // Legs.
  if (st === ST.DOWN) {
    leg(HIPL, KNL, ANL, TOL, 0.78, -0.15, 0.09, 0.2);
    leg(HIPR, KNR, ANR, TOR, 0.7, 0.13, 0.09, 0.2);
    legsDone = true;
  } else if (st === ST.SLIDE) {
    leg(HIPR, KNR, ANR, TOR, 0.95, 0.1, 0.13, 0.3);
    leg(HIPL, KNL, ANL, TOL, 0.34, -0.12, 0.09, 0);
    legsDone = true;
  } else if (st === ST.TACKLE) {
    leg(HIPR, KNR, ANR, TOR, 0.68, 0.1, 0.1, 0);
    leg(HIPL, KNL, ANL, TOL, -0.34, -0.12, 0.085, -0.3);
    legsDone = true;
  } else if (st === ST.DIVE) {
    leg(HIPL, KNL, ANL, TOL, -0.05, -0.07, 0.05, -0.5);
    leg(HIPR, KNR, ANR, TOR, -0.02, 0.07, 0.08, -0.5);
    legsDone = true;
  } else if (st === ST.HEADER) {
    leg(HIPL, KNL, ANL, TOL, -0.2, -0.1, 0.34, -0.6);
    leg(HIPR, KNR, ANR, TOR, -0.1, 0.1, 0.24, -0.5);
    legsDone = true;
  } else if ((st === ST.KICK || p.kickT > 0) && st !== ST.HOLD) {
    const t = Math.min(1, Math.max(0, 1 - p.kickT / 0.3));
    const kr = look.left ? -1 : 1;
    let kf, kh;
    if (t < 0.4) {
      const u = ease(t / 0.4);
      kf = -0.45 + 0.65 * u;
      kh = 0.32 - 0.22 * u;
    } else {
      const u = ease((t - 0.4) / 0.6);
      kf = 0.2 + 0.45 * u;
      kh = 0.1 + 0.42 * u;
    }
    if (kr > 0) {
      leg(HIPR, KNR, ANR, TOR, kf, 0.07, kh, -0.35 + 0.5 * t);
      leg(HIPL, KNL, ANL, TOL, 0.1, -0.12, 0.085, 0);
    } else {
      leg(HIPL, KNL, ANL, TOL, kf, -0.07, kh, -0.35 + 0.5 * t);
      leg(HIPR, KNR, ANR, TOR, 0.1, 0.12, 0.085, 0);
    }
    // Balance: the arm opposite the kicking leg swings out and forward.
    armAt(kr > 0 ? SHL : SHR, kr > 0 ? ELL : ELR, kr > 0 ? HAL : HAR, -kr, 0.06, 0.42, 0.42, 0.2, 0.56, 0.36);
    armAt(kr > 0 ? SHR : SHL, kr > 0 ? ELR : ELL, kr > 0 ? HAR : HAL, kr, -0.1, 0.3, 0.29, -0.22, 0.34, 0.12);
    legsDone = armsDone = true;
  } else if (gkReady) {
    if (moving) gaitLegs(phs, k);
    else standLegs(0.19, 0.05);
    legsDone = true;
  }
  if (!legsDone) {
    if (moving) gaitLegs(phs, k);
    else if (st === ST.THROW) {
      leg(HIPL, KNL, ANL, TOL, 0.18, -0.12, 0.085, 0);
      leg(HIPR, KNR, ANR, TOR, -0.2, 0.12, 0.085, -0.2);
    } else standLegs();
  }

  // Head and neck.
  setT(NECK, 0.01, 0, 0.55);
  setT(HEAD, 0.015, 0, 0.7);

  // Arms.
  if (armsDone) return lean;
  if (st === ST.DOWN) {
    setT(SHL, 0, -0.195, 0.47);
    setT(SHR, 0, 0.195, 0.47);
    setJ(ELL, -0.2, -0.42, 0.1);
    setJ(ELR, -0.2, 0.42, 0.1);
    setJ(HAL, -0.36, -0.62, 0.07);
    setJ(HAR, -0.36, 0.62, 0.07);
  } else if (st === ST.SLIDE) {
    setT(SHL, 0, -0.195, 0.47);
    setT(SHR, 0, 0.195, 0.47);
    setJ(ELL, -0.28, -0.32, 0.2);
    setJ(HAL, -0.4, -0.36, 0.06);
    setJ(ELR, 0.02, 0.36, 0.55);
    setJ(HAR, 0.18, 0.4, 0.72);
  } else if (st === ST.DIVE) {
    armAt(SHL, ELL, HAL, -1, 0.03, 0.19, 0.98, 0.06, 0.13, 1.28);
    armAt(SHR, ELR, HAR, 1, 0.03, 0.19, 0.98, 0.06, 0.13, 1.28);
  } else if (st === ST.HEADER) {
    armAt(SHL, ELL, HAL, -1, -0.02, 0.34, 0.36, -0.1, 0.46, 0.22);
    armAt(SHR, ELR, HAR, 1, -0.02, 0.34, 0.36, -0.1, 0.46, 0.22);
  } else if (st === ST.THROW) {
    armAt(SHL, ELL, HAL, -1, -0.05, 0.25, 0.85, -0.12, 0.12, 1.12);
    armAt(SHR, ELR, HAR, 1, -0.05, 0.25, 0.85, -0.12, 0.12, 1.12);
  } else if (st === ST.HOLD) {
    armAt(SHL, ELL, HAL, -1, 0.08, 0.24, 0.3, 0.27, 0.09, 0.27);
    armAt(SHR, ELR, HAR, 1, 0.08, 0.24, 0.3, 0.27, 0.09, 0.27);
  } else if (st === ST.CELEBRATE) {
    const style = (p.number || 0) % 3;
    if (style === 0) {
      armAt(SHL, ELL, HAL, -1, 0.02, 0.33, 0.8, 0.04, 0.45, 1.13);
      armAt(SHR, ELR, HAR, 1, 0.02, 0.33, 0.8, 0.04, 0.45, 1.13);
    } else if (style === 1) {
      armAt(SHL, ELL, HAL, -1, -0.02, 0.52, 0.46, -0.04, 0.8, 0.44);
      armAt(SHR, ELR, HAR, 1, -0.02, 0.52, 0.46, -0.04, 0.8, 0.44);
    } else {
      armAt(SHR, ELR, HAR, 1, 0.05, 0.3, 0.8, 0.1, 0.24, 1.1);
      armAt(SHL, ELL, HAL, -1, 0.02, 0.3, 0.28, 0.15, 0.28, 0.25);
    }
  } else if (st === ST.TACKLE) {
    armAt(SHL, ELL, HAL, -1, -0.12, 0.3, 0.28, -0.24, 0.36, 0.14);
    armAt(SHR, ELR, HAR, 1, -0.12, 0.3, 0.28, -0.24, 0.36, 0.14);
  } else if (gkReady) {
    armAt(SHL, ELL, HAL, -1, 0.1, 0.3, 0.33, 0.26, 0.34, 0.2);
    armAt(SHR, ELR, HAR, 1, 0.1, 0.3, 0.33, 0.26, 0.34, 0.2);
  } else if (moving) {
    const amp = 0.2 + 0.65 * k, bend = 0.3 + 1.1 * k, c = Math.cos(phs);
    armAngles(SHL, ELL, HAL, -1, -amp * c, bend, 0.03);
    armAngles(SHR, ELR, HAR, 1, amp * c, bend, 0.03);
  } else {
    const sw = 0.04 * Math.sin(now * 1.6 + seed);
    armAngles(SHL, ELL, HAL, -1, 0.08 + sw, 0.25, 0.05);
    armAngles(SHR, ELR, HAR, 1, 0.08 - sw, 0.25, 0.05);
  }
  return lean;
}

function placeShapes(band, lean) {
  for (let i = 0; i < NT; i++) setT(T0 + i, TORSO[i * 3], TORSO[i * 3 + 1], TORSO[i * 3 + 2]);
  // Shorts hang from the pelvis: half the lean when upright, all of it when
  // lying or sliding.
  const c = tc, s = ts;
  const sl = Math.abs(lean) > 0.8 ? lean : lean * 0.5;
  tc = Math.cos(sl);
  ts = Math.sin(sl);
  for (let i = 0; i < NS; i++) setT(S0 + i, SHORTS[i * 3], SHORTS[i * 3 + 1], SHORTS[i * 3 + 2]);
  tc = c;
  ts = s;
  if (band) for (let i = 0; i < NB; i++) setT(B0 + i, BAND[i * 3], BAND[i * 3 + 1], BAND[i * 3 + 2]);
}

function project(v, n) {
  const fx = v.fx, fy = v.fy, rx = v.rx, ry = v.ry, ux = v.ux, uy = v.uy, df = v.df, dr = v.dr;
  for (let i = 0; i < n; i++) {
    const f = JF[i], r = JR[i], h = JH[i];
    X[i] = f * fx + r * rx + h * ux;
    Y[i] = f * fy + r * ry + h * uy;
    D[i] = f * df + r * dr;
  }
}

// ---------------------------------------------------------------- drawing
function seg(ctx, a, b, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(X[a], Y[a]);
  ctx.lineTo(X[b], Y[b]);
  ctx.stroke();
}

// Filled tapered capsule from (ax, ay, radius ra) to (bx, by, radius rb).
function capsule(ctx, ax, ay, ra, bx, by, rb, color) {
  const ang = Math.atan2(by - ay, bx - ax);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax + nx * ra, ay + ny * ra);
  ctx.lineTo(bx + nx * rb, by + ny * rb);
  ctx.arc(bx, by, rb, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(ax - nx * ra, ay - ny * ra);
  ctx.arc(ax, ay, ra, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.fill();
}

// Straight-edged band across a limb between fractions t0..t1 (hems, cuffs).
function band(ctx, a, b, t0, t1, ra, rb, color) {
  const dx = X[b] - X[a], dy = Y[b] - Y[a];
  const l = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  const nx = -dy / l, ny = dx / l;
  const x0 = X[a] + dx * t0, y0 = Y[a] + dy * t0, x1 = X[a] + dx * t1, y1 = Y[a] + dy * t1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * ra, y0 + ny * ra);
  ctx.lineTo(x1 + nx * rb, y1 + ny * rb);
  ctx.lineTo(x1 - nx * rb, y1 - ny * rb);
  ctx.lineTo(x0 - nx * ra, y0 - ny * ra);
  ctx.fill();
}

const dimmed = (hex, dim) => (dim < 1 ? shade(hex, dim) : hex);

function drawLeg(ctx, hip, knee, ankle, toe, s, kit, look, dim, ol, lod) {
  const skin = dimmed(look.skin, dim), sock = dimmed(kit.socks, dim), shorts = dimmed(kit.shorts, dim), boot = dimmed(look.boots, dim);
  if (lod < 2) {
    // Game-size figure: strokes (outlines are drawn per group beforehand).
    const wT = 0.16 * s, wS = 0.125 * s, wB = 0.1 * s;
    seg(ctx, hip, knee, wT, skin);
    seg(ctx, knee, ankle, wS, sock);
    seg(ctx, ankle, toe, wB, boot);
    band(ctx, hip, knee, -0.1, 0.46, 0.115 * s, 0.1 * s, shorts);
    return;
  }
  // Close-up: tapered thigh, calf and boot with an outline.
  const rH = 0.1 * s, rK = 0.066 * s, rC = 0.07 * s, rA = 0.043 * s;
  const cx = X[knee] + (X[ankle] - X[knee]) * 0.33, cy = Y[knee] + (Y[ankle] - Y[knee]) * 0.33;
  const hx = X[ankle] - (X[toe] - X[ankle]) * 0.28, hy = Y[ankle] - (Y[toe] - Y[ankle]) * 0.28;
  // The thigh starts under the shorts and the sock under its turnover, so no
  // rounded ends show at the hems.
  const tx = X[hip] + (X[knee] - X[hip]) * 0.25, ty = Y[hip] + (Y[knee] - Y[hip]) * 0.25;
  const sx = X[knee] + (X[ankle] - X[knee]) * 0.16, sy = Y[knee] + (Y[ankle] - Y[knee]) * 0.16;
  capsule(ctx, tx, ty, rH + ol, X[knee], Y[knee], rK + ol, OUTLINE);
  capsule(ctx, X[knee], Y[knee], rK + ol, cx, cy, rC + ol, OUTLINE);
  capsule(ctx, cx, cy, rC + ol, X[ankle], Y[ankle], rA + ol, OUTLINE);
  capsule(ctx, hx, hy, 0.05 * s + ol, X[toe], Y[toe], 0.04 * s + ol, OUTLINE);
  capsule(ctx, tx, ty, rH, X[knee], Y[knee], rK, skin);
  capsule(ctx, sx, sy, rK * 1.02, cx, cy, rC, sock);
  capsule(ctx, cx, cy, rC, X[ankle], Y[ankle], rA, sock);
  band(ctx, knee, ankle, 0.1, 0.19, rK * 1.02, rK * 1.05, dimmed(kit.trim, dim));
  band(ctx, hip, knee, -0.12, 0.46, rH * 1.18, (rH + (rK - rH) * 0.46) * 1.18, shorts);
  capsule(ctx, hx, hy, 0.05 * s, X[toe], Y[toe], 0.04 * s, boot);
  // Sole towards the ground.
  const gx = -0.012 * s * (Math.abs(Y[toe] - hy) < Math.abs(X[toe] - hx) ? 0 : 1), gy = 0.022 * s;
  ctx.strokeStyle = 'rgba(248,250,252,0.7)';
  ctx.lineWidth = 0.018 * s;
  ctx.beginPath();
  ctx.moveTo(hx + gx, hy + gy);
  ctx.lineTo(X[toe] + gx, Y[toe] + gy);
  ctx.stroke();
}

function drawArm(ctx, sh, el, ha, s, kit, look, dim, ol, gk, lod) {
  const skin = dimmed(look.skin, dim), sleeve = dimmed(kit.shirt, dim), trim = dimmed(kit.trim, dim);
  const glove = dimmed('#f1f5f9', dim);
  if (lod < 2) {
    const wU = 0.11 * s;
    if (gk) {
      ctx.strokeStyle = sleeve;
      ctx.lineWidth = wU;
      ctx.beginPath();
      ctx.moveTo(X[sh], Y[sh]);
      ctx.lineTo(X[el], Y[el]);
      ctx.lineTo(X[ha], Y[ha]);
      ctx.stroke();
      ctx.fillStyle = glove;
      ctx.beginPath();
      ctx.arc(X[ha], Y[ha], 0.07 * s, 0, TAU);
      ctx.fill();
      return;
    }
    ctx.strokeStyle = skin;
    ctx.lineWidth = wU * 0.88;
    ctx.beginPath();
    ctx.moveTo(X[sh], Y[sh]);
    ctx.lineTo(X[el], Y[el]);
    ctx.lineTo(X[ha], Y[ha]);
    ctx.stroke();
    band(ctx, sh, el, -0.15, 0.62, wU * 0.68, wU * 0.62, sleeve);
    return;
  }
  const rS = 0.062 * s, rE = 0.046 * s, rW = 0.036 * s;
  capsule(ctx, X[sh], Y[sh], rS + ol, X[el], Y[el], rE + ol, OUTLINE);
  capsule(ctx, X[el], Y[el], rE + ol, X[ha], Y[ha], rW + ol, OUTLINE);
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(X[ha], Y[ha], (gk ? 0.074 : 0.05) * s + ol, 0, TAU);
  ctx.fill();
  if (gk) {
    capsule(ctx, X[sh], Y[sh], rS * 1.12, X[el], Y[el], rE * 1.12, sleeve);
    capsule(ctx, X[el], Y[el], rE * 1.12, X[ha], Y[ha], rW * 1.15, sleeve);
    band(ctx, el, ha, 0.72, 0.86, rW * 1.5, rW * 1.5, trim);
    ctx.fillStyle = glove;
    ctx.beginPath();
    ctx.arc(X[ha], Y[ha], 0.074 * s, 0, TAU);
    ctx.fill();
    return;
  }
  capsule(ctx, X[sh], Y[sh], rS, X[el], Y[el], rE, skin);
  capsule(ctx, X[el], Y[el], rE, X[ha], Y[ha], rW, skin);
  band(ctx, sh, el, -0.2, 0.6, rS * 1.3, (rS + (rE - rS) * 0.6) * 1.3, sleeve);
  band(ctx, sh, el, 0.52, 0.62, (rS + (rE - rS) * 0.52) * 1.32, (rS + (rE - rS) * 0.62) * 1.32, trim);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(X[ha], Y[ha], 0.05 * s, 0, TAU);
  ctx.fill();
}

// Convex hull of points i0..i0+n-1 as the current path (gift wrapping).
function hullPath(ctx, i0, n) {
  let l = i0;
  for (let i = i0 + 1; i < i0 + n; i++) if (X[i] < X[l] || (X[i] === X[l] && Y[i] < Y[l])) l = i;
  let p = l, count = 0;
  ctx.beginPath();
  do {
    if (count === 0) ctx.moveTo(X[p], Y[p]);
    else ctx.lineTo(X[p], Y[p]);
    let q = p === i0 ? i0 + 1 : i0;
    for (let i = i0; i < i0 + n; i++) {
      if (i === p) continue;
      const cr = (X[q] - X[p]) * (Y[i] - Y[p]) - (Y[q] - Y[p]) * (X[i] - X[p]);
      if (cr < 0 || (cr === 0 && (X[i] - X[p]) ** 2 + (Y[i] - Y[p]) ** 2 > (X[q] - X[p]) ** 2 + (Y[q] - Y[p]) ** 2)) q = i;
    }
    p = q;
    count++;
  } while (p !== l && count <= n);
  ctx.closePath();
}

function minMaxX(i0, n) {
  let lo = X[i0], hi = X[i0];
  for (let i = i0 + 1; i < i0 + n; i++) {
    if (X[i] < lo) lo = X[i];
    if (X[i] > hi) hi = X[i];
  }
  MM[0] = lo;
  MM[1] = hi;
}
const MM = [0, 0];

const STRIPES = [-0.13, 0, 0.13];

// Quad on the front (face = 1) or back (face = -1) plane of the torso.
const Q = new Float64Array(8);
function facePoint(v, face, r, h, k) {
  const f = face * 0.101;
  const bf = pf + f * tc + h * ts, bh = ph + h * tc - f * ts;
  Q[k] = bf * v.fx + r * v.rx + bh * v.ux;
  Q[k + 1] = bf * v.fy + r * v.ry + bh * v.uy;
}

function drawTorso(ctx, v, p, kit, s, ol, lod) {
  const face = v.df > 0 ? -1 : 1; // plane that faces the camera
  // Shorts.
  hullPath(ctx, S0, NS);
  if (ol > 0) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.05 * s + ol * 2;
    ctx.stroke();
  }
  let sf = kit.shorts;
  if (lod > 1) {
    minMaxX(S0, NS);
    const g = ctx.createLinearGradient(MM[0], 0, MM[1], 0);
    g.addColorStop(0, shade(kit.shorts, 1.12));
    g.addColorStop(0.55, kit.shorts);
    g.addColorStop(1, shade(kit.shorts, 0.7));
    sf = g;
  }
  ctx.fillStyle = sf;
  ctx.fill();
  if (lod > 1) {
    ctx.strokeStyle = sf;
    ctx.lineWidth = 0.05 * s;
    ctx.stroke();
  }

  // Shirt, lit from the upper left.
  hullPath(ctx, T0, NT);
  if (ol > 0) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.07 * s + ol * 2;
    ctx.stroke();
  }
  let fill = kit.shirt;
  if (lod > 0) {
    minMaxX(T0, NT);
    const g = ctx.createLinearGradient(MM[0], 0, MM[1], 0);
    g.addColorStop(0, shade(kit.shirt, 1.16));
    g.addColorStop(0.5, kit.shirt);
    g.addColorStop(1, shade(kit.shirt, 0.68));
    fill = g;
  }
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.lineWidth = 0.07 * s;
  ctx.fill();
  ctx.stroke();

  // Pattern.
  if (kit.pat && kit.pattern !== 'plain') {
    ctx.fillStyle = kit.pat;
    if (kit.pattern === 'band') {
      hullPath(ctx, B0, NB);
      ctx.fill();
    } else if (kit.pattern === 'sash') {
      const w = 0.045;
      facePoint(v, face, -0.2 * face, 0.47 - w, 0);
      facePoint(v, face, -0.2 * face, 0.47 + w * 0.2, 2);
      facePoint(v, face, 0.16 * face, 0.1, 4);
      facePoint(v, face, 0.16 * face, 0.1 - w * 2.4, 6);
      ctx.beginPath();
      ctx.moveTo(Q[0], Q[1]);
      ctx.lineTo(Q[2], Q[3]);
      ctx.lineTo(Q[4], Q[5]);
      ctx.lineTo(Q[6], Q[7]);
      ctx.closePath();
      ctx.fill();
    } else if (kit.pattern === 'stripes') {
      for (const r0 of STRIPES) {
        facePoint(v, face, r0 - 0.03, 0.46, 0);
        facePoint(v, face, r0 + 0.03, 0.46, 2);
        facePoint(v, face, r0 + 0.03, 0.05, 4);
        facePoint(v, face, r0 - 0.03, 0.05, 6);
        ctx.beginPath();
        ctx.moveTo(Q[0], Q[1]);
        ctx.lineTo(Q[2], Q[3]);
        ctx.lineTo(Q[4], Q[5]);
        ctx.lineTo(Q[6], Q[7]);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Collar.
  facePoint(v, face, -0.07, 0.47, 0);
  facePoint(v, face, 0.07, 0.47, 2);
  ctx.strokeStyle = kit.trim;
  ctx.lineWidth = Math.max(1, 0.035 * s);
  ctx.beginPath();
  ctx.moveTo(Q[0], Q[1]);
  ctx.lineTo(Q[2], Q[3]);
  ctx.stroke();

  // Shirt number (and name in close-ups) on the back.
  if (lod > 0 && v.df > 0.12 && s >= 13 && p.number) {
    const col = numberColor(kit);
    facePoint(v, -1, 0, 0.22, 0);
    const upx = v.ux * tc + v.fx * ts, upy = v.uy * tc + v.fy * ts;
    ctx.save();
    ctx.transform(v.rx * 0.01, v.ry * 0.01, -upx * 0.01, -upy * 0.01, Q[0], Q[1]);
    const img = numberSprite(p.number, col);
    ctx.drawImage(img, -24, -16, 48, 32);
    if (lod > 1 && p.name) {
      ctx.font = '800 7px "Barlow Condensed", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = col;
      ctx.fillText(p.name.toUpperCase(), 0, -17, 30);
    }
    ctx.restore();
  }
}

function longHair(ctx, v, hx, hy, hr, hc) {
  ctx.fillStyle = hc;
  ctx.beginPath();
  ctx.ellipse(hx - v.fx * 0.05, hy + hr * 0.75, hr * 1.02, hr * 1.25, 0, 0, TAU);
  ctx.fill();
}

// Bun or tied-up hair at the back of the head, with its own outline.
function bun(ctx, v, hx, hy, hr, hc, ol) {
  const bx = hx - v.fx * 0.1 + v.ux * 0.1, by = hy - v.fy * 0.1 + v.uy * 0.1 - hr * 0.35;
  if (ol > 0) {
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(bx, by, hr * 0.42 + ol, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = shade(hc, 0.9);
  ctx.beginPath();
  ctx.arc(bx, by, hr * 0.42, 0, TAU);
  ctx.fill();
}

function drawHead(ctx, v, s, look, lod, ol) {
  const hx = X[HEAD], hy = Y[HEAD];
  const hr = Math.max(1.4, 0.13 * s);
  const hair = look.hair, hc = look.hairColor;
  const vis = -v.df; // 1: face towards the camera, -1: back of the head
  const face = Math.min(1, Math.max(0, (vis + 0.3) / 0.6));
  const fcx = hx + v.fx * 0.085, fcy = hy + v.fy * 0.085 + hr * 0.18;
  const frx = hr * (0.42 + 0.38 * Math.max(0, vis)) * (0.4 + 0.6 * face), fry = hr * 0.86 * (0.5 + 0.5 * face);

  // Neck.
  ctx.lineWidth = 0.1 * s;
  ctx.strokeStyle = shade(look.skin, 0.82);
  ctx.beginPath();
  ctx.moveTo(X[NECK], Y[NECK]);
  ctx.lineTo(hx * 0.4 + X[NECK] * 0.6, hy * 0.4 + Y[NECK] * 0.6);
  ctx.stroke();

  // Hair that falls behind the head: drawn first when the face shows.
  const long = hair === 'long' || hair === 'dreads';
  if (long && vis > -0.15) longHair(ctx, v, hx, hy, hr, hc);
  if (hair === 'bun' && vis > 0) bun(ctx, v, hx, hy, hr, hc, ol);

  if (ol > 0) {
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(hx, hy, hr + ol, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, TAU);
  ctx.fill();

  if (hair !== 'bald') {
    const big = hair === 'afro' ? 1.42 : hair === 'curly' ? 1.2 : hair === 'crop' || hair === 'twists' || hair === 'dreads' ? 1.1 : hair === 'swept' ? 1.07 : hair === 'buzz' ? 1.0 : 1.04;
    const up = hair === 'afro' ? 0.3 : hair === 'curly' ? 0.14 : hair === 'swept' ? 0.08 : 0.04;
    ctx.fillStyle = hc;
    if (hair === 'buzz') ctx.globalAlpha = 0.72;
    // Hair mass cut off at the hairline: ear level at the sides, the nape
    // at the back; volume styles hang lower.
    const cxh = hx - v.fx * 0.015, cyh = hy - hr * up, R = hr * big;
    const drop = hair === 'afro' || hair === 'curly' || hair === 'dreads' || hair === 'long' ? 0.3 : 0;
    const yb = hy + hr * (0.2 + drop + 0.5 * Math.max(0, -vis));
    const sb = (yb - cyh) / R;
    ctx.beginPath();
    if (sb >= 1) ctx.arc(cxh, cyh, R, 0, TAU);
    else {
      const tb = Math.asin(Math.max(-1, sb));
      ctx.arc(cxh, cyh, R, Math.PI - tb, TAU + tb);
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    if (lod > 1 && (hair === 'curly' || hair === 'afro' || hair === 'twists' || hair === 'crop')) {
      // Texture: a few curls on top.
      ctx.fillStyle = shade(hc, hc === '#15100d' ? 1.25 : 0.75);
      for (let i = 0; i < 5; i++) {
        const a = -2.4 + i * 0.45;
        ctx.beginPath();
        ctx.arc(cxh + Math.cos(a) * R * 0.72, cyh + Math.sin(a) * R * 0.72, hr * 0.12, 0, TAU);
        ctx.fill();
      }
    }
  }
  // The face (and beard, eyes), kept inside the head outline.
  if (face > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, TAU);
    ctx.clip();
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.ellipse(fcx, fcy, frx, fry, 0, 0, TAU);
    ctx.fill();
    if (lod > 1 && face > 0.3) {
      if (look.beard) {
        ctx.globalAlpha = look.beard > 1 ? 0.88 : 0.4;
        ctx.fillStyle = hc;
        ctx.beginPath();
        ctx.ellipse(fcx, fcy + fry * 0.62, frx * 0.95, fry * 0.52, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (vis > 0.35) {
        const rl = Math.hypot(v.rx, v.ry) || 1;
        const ex = (-v.rx / rl) * hr * 0.3, ey = (-v.ry / rl) * hr * 0.3;
        ctx.fillStyle = '#1b1411';
        ctx.beginPath();
        ctx.arc(fcx + ex, fcy - hr * 0.3 + ey, hr * 0.075, 0, TAU);
        ctx.arc(fcx - ex, fcy - hr * 0.3 - ey, hr * 0.075, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  if (long && vis <= -0.15) longHair(ctx, v, hx, hy, hr, hc);
  if (hair === 'bun' && vis <= 0) bun(ctx, v, hx, hy, hr, hc, ol);
  if (lod > 1 && hair !== 'bald' && hair !== 'buzz') {
    // Sheen on the hair from the floodlights.
    ctx.strokeStyle = shade(hc, hc === '#15100d' ? 1.35 : 1.25);
    ctx.lineWidth = hr * 0.14;
    ctx.beginPath();
    ctx.arc(hx, hy - hr * 0.05, hr * 0.78, -2.5, -1.7);
    ctx.stroke();
  }
}

// Order of the limbs by depth (far first).
const LIMBS = [0, 1, 2, 3];
const LD = new Float64Array(4);

function drawLimb(ctx, i, s, kit, look, dim, ol, gk, lod) {
  if (i === 0) drawLeg(ctx, HIPL, KNL, ANL, TOL, s, kit, look, dim, ol, lod);
  else if (i === 1) drawLeg(ctx, HIPR, KNR, ANR, TOR, s, kit, look, dim, ol, lod);
  else if (i === 2) drawArm(ctx, SHL, ELL, HAL, s, kit, look, dim, ol, gk, lod);
  else drawArm(ctx, SHR, ELR, HAR, s, kit, look, dim, ol, gk, lod);
}

// kit: {shirt, shorts, socks, trim, pattern, pat}; p: scene player with look.
// Figures are drawn slightly larger than life so they read on phones.
const FIG = 1.06;
const VB = { x: 0, y: 0, s: 0, u: 0, ux: 0, uy: 0, fx: 0, fy: 0, rx: 0, ry: 0, df: 0, dr: 0 };

export function drawPlayer(ctx, v0, p, kit) {
  const v = VB;
  v.x = v0.x;
  v.y = v0.y;
  v.s = v0.s * FIG;
  v.u = v0.u * FIG;
  v.ux = v0.ux * FIG;
  v.uy = v0.uy * FIG;
  v.fx = v0.fx * FIG;
  v.fy = v0.fy * FIG;
  v.rx = v0.rx * FIG;
  v.ry = v0.ry * FIG;
  v.df = v0.df;
  v.dr = v0.dr;
  const s = v.s;
  const look = p.look;
  const lod = s < 9 || (lite && s < 42) ? 0 : s < 42 ? 1 : 2;
  const ol = lod === 0 ? 0 : lod === 1 ? 0.75 : Math.max(1, 0.016 * s);
  const lean = pose(p, look);
  placeShapes(kit.pattern === 'band', lean);
  project(v, NP);

  ctx.save();
  // Jumps and dives lift the whole figure.
  const z = p.z || 0;
  ctx.translate(v.x + v.ux * z, v.y + v.uy * z);
  if (p.state === ST.DIVE && p.diveAng !== undefined) {
    const px = X[PEL], py = Y[PEL];
    ctx.translate(px, py);
    ctx.rotate(p.diveAng);
    ctx.translate(-px, -py);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  LD[0] = (D[KNL] + D[ANL]) * 0.5;
  LD[1] = (D[KNR] + D[ANR]) * 0.5;
  LD[2] = (D[ELL] + D[HAL]) * 0.5 + 0.02;
  LD[3] = (D[ELR] + D[HAR]) * 0.5 + 0.02;
  LIMBS[0] = 0;
  LIMBS[1] = 1;
  LIMBS[2] = 2;
  LIMBS[3] = 3;
  for (let i = 1; i < 4; i++) {
    const x = LIMBS[i];
    let j = i - 1;
    while (j >= 0 && LD[LIMBS[j]] < LD[x]) {
      LIMBS[j + 1] = LIMBS[j];
      j--;
    }
    LIMBS[j + 1] = x;
  }
  const gk = p.isGK;
  let nFar = 0;
  while (nFar < 4 && LD[LIMBS[nFar]] > 0.005) nFar++;
  if (lod === 1) outlineGroup(ctx, 0, nFar, s, ol);
  for (let k = 0; k < nFar; k++) drawLimb(ctx, LIMBS[k], s, kit, look, 0.8, ol, gk, lod);
  drawTorso(ctx, v, p, kit, s, ol, lod);
  if (lod === 1) outlineGroup(ctx, nFar, 4, s, ol);
  for (let k = nFar; k < 4; k++) drawLimb(ctx, LIMBS[k], s, kit, look, 1, ol, gk, lod);
  drawHead(ctx, v, s, look, lod, ol);
  ctx.restore();
}

// One outline stroke for the legs and one for the arms of a depth group.
function outlineGroup(ctx, k0, k1, s, ol) {
  let legs = false, arms = false;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  for (let k = k0; k < k1; k++) {
    const i = LIMBS[k];
    if (i > 1) continue;
    const h = i === 0 ? HIPL : HIPR, n = i === 0 ? KNL : KNR, a = i === 0 ? ANL : ANR, t = i === 0 ? TOL : TOR;
    ctx.moveTo(X[h], Y[h]);
    ctx.lineTo(X[n], Y[n]);
    ctx.lineTo(X[a], Y[a]);
    ctx.lineTo(X[t], Y[t]);
    legs = true;
  }
  if (legs) {
    ctx.lineWidth = 0.15 * s + ol * 2;
    ctx.stroke();
  }
  ctx.beginPath();
  for (let k = k0; k < k1; k++) {
    const i = LIMBS[k];
    if (i < 2) continue;
    const sh = i === 2 ? SHL : SHR, el = i === 2 ? ELL : ELR, ha = i === 2 ? HAL : HAR;
    ctx.moveTo(X[sh], Y[sh]);
    ctx.lineTo(X[el], Y[el]);
    ctx.lineTo(X[ha], Y[ha]);
    arms = true;
  }
  if (arms) {
    ctx.lineWidth = 0.1 * s + ol * 2;
    ctx.stroke();
  }
}

export function drawBall(ctx, cam, x, y, z, rot, big = 1) {
  if (!cam.project(x, y, 0, A)) return;
  const s = A.s;
  // Shadow shrinks and fades with height.
  const hf = Math.max(0.35, 1 - z / 8);
  ctx.fillStyle = `rgba(0,0,0,${0.35 * hf})`;
  ctx.beginPath();
  ctx.ellipse(A.x, A.y, 0.2 * s * hf * big, 0.08 * s * hf * big + 0.5, 0, 0, TAU);
  ctx.fill();
  if (!cam.project(x, y, z + 0.11, B)) return;
  const r = Math.max(2.4, 0.2 * B.s * big);
  const g = ctx.createRadialGradient(B.x - r * 0.35, B.y - r * 0.35, r * 0.1, B.x, B.y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#c9ced6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(B.x, B.y, r, 0, TAU);
  ctx.fill();
  // Rotating panels.
  ctx.fillStyle = '#1f2937';
  const a = rot % TAU;
  for (let i = 0; i < 3; i++) {
    const ang = a + (i * TAU) / 3;
    const px = B.x + Math.cos(ang) * r * 0.5, py = B.y + Math.sin(ang) * r * 0.35;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.24, 0, TAU);
    ctx.fill();
  }
}
