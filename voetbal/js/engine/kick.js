// Kick solvers. Rolling balls use the closed-form solution of
// dv/dt = -(R + K v^2); aerial balls are solved iteratively with drag + curl.

import { G, PHYS } from './constants.js';
import { integrate } from './ball.js';
import { clamp } from '../util.js';

const R = PHYS.rollDecel;
const K = PHYS.airDrag;
const A = Math.sqrt(R / K);
const WC = Math.sqrt(R * K);

// Launch speed so a rolling ball covers distance d and arrives with speed va.
export function groundSpeedFor(d, va) {
  return Math.sqrt(Math.max(0, ((R + K * va * va) * Math.exp(2 * K * d) - R) / K));
}

// Maximum rolling distance for launch speed v0.
export function groundRange(v0) {
  return -Math.log(Math.cos(Math.atan(v0 / A))) / K;
}

// Time for a rolling ball (launch speed v0) to cover distance s; Infinity if it stops first.
export function groundTime(v0, s) {
  const phi = Math.atan(v0 / A);
  const c = Math.cos(phi) * Math.exp(K * s);
  if (c >= 1) return Infinity;
  return (phi - Math.acos(c)) / WC;
}

// Distance covered after time t.
export function groundDistAt(v0, t) {
  const phi = Math.atan(v0 / A);
  const tt = Math.min(t, phi / WC);
  return Math.log(Math.cos(phi - WC * tt) / Math.cos(phi)) / K;
}

export function groundSpeedAt(v0, s) {
  const v2 = ((R + K * v0 * v0) * Math.exp(-2 * K * s) - R) / K;
  return v2 > 0 ? Math.sqrt(v2) : 0;
}

// Aerial solver: velocity so a ball from (x0,y0,z0) passes (tx,ty,tz) after time T,
// including drag and curl (spin). Returns {vx, vy, vz}.
const sim = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 };
export function solveAerial(x0, y0, z0, tx, ty, tz, T, spin = 0, out = {}) {
  const dx = tx - x0, dy = ty - y0;
  const d = Math.max(0.05, Math.sqrt(dx * dx + dy * dy));
  const ux = dx / d, uy = dy / d;
  T = Math.max(0.12, T);
  let vh = d / T;
  let vz = (tz - z0 + 0.5 * G * T * T) / T;
  let ang = 0;
  const n = Math.max(6, Math.ceil(T * 120));
  const h = T / n;
  for (let it = 0; it < 5; it++) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const dirx = ux * ca - uy * sa, diry = ux * sa + uy * ca;
    sim.x = x0;
    sim.y = y0;
    sim.z = z0;
    sim.vx = dirx * vh;
    sim.vy = diry * vh;
    sim.vz = vz;
    sim.spin = spin;
    for (let i = 0; i < n; i++) integrate(sim, h);
    const ex = sim.x - x0, ey = sim.y - y0;
    const along = ex * ux + ey * uy;
    const lat = -ex * uy + ey * ux;
    vh = clamp(vh * (d / Math.max(0.05, along)), 1, 48);
    vz = clamp(vz + (tz - sim.z) / T, -8, 28);
    if (spin !== 0) ang -= Math.atan2(lat, d);
  }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  out.vx = (ux * ca - uy * sa) * vh;
  out.vy = (ux * sa + uy * ca) * vh;
  out.vz = vz;
  return out;
}

// Flight time for a lofted pass of horizontal distance d.
export function loftTime(d, high = false) {
  return high ? 0.9 + d * 0.045 : 0.55 + d * 0.036;
}
