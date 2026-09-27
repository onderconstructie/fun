// Small math + random helpers shared by engine, renderer and UI.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeIn = (a, b, t) => a + (b - a) * t * t;
export const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
export const approach = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

// Deterministic PRNG (mulberry32) so tracks and races can be reproduced.
export function makeRng(seed) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => a + Math.floor(rng() * (b - a + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  return rng;
}

// Pick from [{w, ...}] by weight.
export function weighted(rng, list) {
  let sum = 0;
  for (const it of list) sum += it.w;
  let r = rng() * sum;
  for (const it of list) {
    r -= it.w;
    if (r <= 0) return it;
  }
  return list[list.length - 1];
}

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const f = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${f(0)},${f(1)},${f(2)})`;
}

// Race clock with a Dutch decimal comma: 73.456 -> "1:13,4".
export function fmtTime(t) {
  if (!isFinite(t)) return '–';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1).replace('.', ',')}`;
}

export function fmtSecs(t) {
  return t.toFixed(1).replace('.', ',');
}
