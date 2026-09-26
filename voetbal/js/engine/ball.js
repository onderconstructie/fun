// Ball physics: quadratic air drag, rolling resistance, bounces, Magnus curl,
// posts/crossbar, goal nets and the advertising boards.

import { L, W, CY, GOAL_HW, GOAL_H, GOAL_D, POST_R, BALL_R, G, PHYS } from './constants.js';

export class Ball {
  constructor() {
    this.reset(L / 2, W / 2);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.spin = 0;
    this.rot = 0;
    this.owner = null;
    this.lastTouch = null;
    this.prevTouch = null;
    this.kick = null; // info about the last kick: {by, type, target, t, x, y}
    this.version = 0; // bumped whenever the trajectory changes
    this.px = x;
    this.py = y;
    this.pz = 0;
  }

  get hspeed() {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  get speed() {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
  }

  place(x, y, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.spin = 0;
    this.version++;
  }
}

// One explicit-Euler substep of free flight / rolling on any {x,y,z,vx,vy,vz,spin}.
// Returns true when the ball bounced.
export function integrate(s, h) {
  let bounced = false;
  if (s.z > 1e-4 || s.vz > 1e-4) {
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
    const k = PHYS.airDrag * sp * h;
    s.vx -= s.vx * k;
    s.vy -= s.vy * k;
    s.vz -= s.vz * k + G * h;
    if (s.spin !== 0) {
      const ax = -s.vy * s.spin, ay = s.vx * s.spin;
      s.vx += ax * h;
      s.vy += ay * h;
      s.spin *= 1 - PHYS.spinDecay * h;
    }
  } else {
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > 0) {
      const dec = (PHYS.rollDecel + PHYS.airDrag * sp * sp) * h;
      const f = sp > dec ? (sp - dec) / sp : 0;
      s.vx *= f;
      s.vy *= f;
    }
    s.spin *= 1 - 4 * h;
  }
  s.x += s.vx * h;
  s.y += s.vy * h;
  s.z += s.vz * h;
  if (s.z < 0) {
    s.z = 0;
    if (s.vz < -PHYS.bounceMin) {
      s.vz = -s.vz * PHYS.restitution;
      s.vx *= PHYS.bounceFriction;
      s.vy *= PHYS.bounceFriction;
      s.spin *= 0.5;
      bounced = true;
    } else {
      s.vz = 0;
    }
  }
  return bounced;
}

const SUB = 1 / 240;
const R_POST = POST_R + BALL_R;
const Y0 = CY - GOAL_HW;
const Y1 = CY + GOAL_HW;

// Full physics step for the live ball. onHit(type, strength) reports contacts.
export function stepBall(b, dt, onHit) {
  const n = Math.max(1, Math.ceil(dt / SUB - 1e-6));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const ox = b.x, oy = b.y, oz = b.z;
    const vz0 = b.vz;
    if (integrate(b, h) && onHit && vz0 < -3) onHit('bounce', -vz0);
    goalFrame(b, 0, -1, ox, oy, oz, onHit);
    goalFrame(b, L, 1, ox, oy, oz, onHit);
    boards(b);
  }
  b.rot += Math.sqrt(b.vx * b.vx + b.vy * b.vy) * dt / BALL_R;
}

function reflect2(b, nx, ny, e) {
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx;
    b.vy -= (1 + e) * vn * ny;
  }
  return -vn;
}

function goalFrame(b, gx, out, ox, oy, oz, onHit) {
  const depth = (b.x - gx) * out;
  if (depth < -1.5 || depth > GOAL_D + 1) return;

  // Posts (vertical cylinders).
  if (b.z < GOAL_H + BALL_R) {
    for (let k = 0; k < 2; k++) {
      const py = k ? Y1 : Y0;
      const dx = b.x - gx, dy = b.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < R_POST * R_POST && d2 > 1e-10) {
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        b.x = gx + nx * R_POST;
        b.y = py + ny * R_POST;
        const s = reflect2(b, nx, ny, 0.7);
        b.spin *= 0.3;
        b.version++;
        if (onHit && s > 1) onHit('post', s);
      }
    }
  }
  // Crossbar (horizontal cylinder along y).
  if (b.y > Y0 && b.y < Y1) {
    const dx = b.x - gx, dz = b.z - GOAL_H;
    const d2 = dx * dx + dz * dz;
    if (d2 < R_POST * R_POST && d2 > 1e-10) {
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;
      b.x = gx + nx * R_POST;
      b.z = GOAL_H + nz * R_POST;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) {
        b.vx -= 1.7 * vn * nx;
        b.vz -= 1.7 * vn * nz;
      }
      b.spin *= 0.3;
      b.version++;
      if (onHit && -vn > 1) onHit('bar', -vn);
    }
  }

  // Nets.
  const wasIn = (ox - gx) * out > 0 && oy > Y0 && oy < Y1 && oz < GOAL_H;
  if (wasIn) {
    // The net swallows the ball: strong damping while inside.
    const damp = 1 - 3.5 / 240;
    b.vx *= damp;
    b.vy *= damp;
    if (depth > GOAL_D - BALL_R) {
      b.x = gx + out * (GOAL_D - BALL_R);
      const s = Math.abs(b.vx);
      b.vx = -b.vx * 0.04;
      b.vy *= 0.4;
      b.vz *= 0.4;
      if (onHit && s > 4) onHit('net', s);
    }
    if (depth < BALL_R && (b.x - ox) * out < 0) {
      b.x = gx + out * BALL_R;
      b.vx = 0;
    }
    if (b.y < Y0 + BALL_R) {
      b.y = Y0 + BALL_R;
      b.vy = Math.abs(b.vy) * 0.2;
      b.vx *= 0.6;
    } else if (b.y > Y1 - BALL_R) {
      b.y = Y1 - BALL_R;
      b.vy = -Math.abs(b.vy) * 0.2;
      b.vx *= 0.6;
    }
    if (b.z > GOAL_H - BALL_R) {
      b.z = GOAL_H - BALL_R;
      b.vz = -Math.abs(b.vz) * 0.2;
      b.vx *= 0.6;
    }
  } else if (depth > 0 && depth < GOAL_D) {
    // Outside of the side netting / roof.
    if (b.z < GOAL_H) {
      if (oy <= Y0 && b.y > Y0 - BALL_R) {
        b.y = Y0 - BALL_R;
        b.vy = -Math.abs(b.vy) * 0.2;
        b.vx *= 0.5;
        if (onHit) onHit('sidenet', 1);
      } else if (oy >= Y1 && b.y < Y1 + BALL_R) {
        b.y = Y1 + BALL_R;
        b.vy = Math.abs(b.vy) * 0.2;
        b.vx *= 0.5;
        if (onHit) onHit('sidenet', 1);
      }
    }
    if (oz >= GOAL_H && b.z < GOAL_H + BALL_R && b.y > Y0 && b.y < Y1) {
      b.z = GOAL_H + BALL_R;
      b.vz = Math.abs(b.vz) * 0.25;
      b.vx *= 0.6;
      b.vy *= 0.6;
    }
    // Back of the net from behind.
    if ((ox - gx) * out >= GOAL_D && depth < GOAL_D + BALL_R && b.y > Y0 && b.y < Y1 && b.z < GOAL_H) {
      b.x = gx + out * (GOAL_D + BALL_R);
      b.vx = -b.vx * 0.2;
    }
  }
}

function boards(b) {
  if (b.z > 1.0) return;
  const x0 = -PHYS.boardX, x1 = L + PHYS.boardX, y0 = -PHYS.boardY, y1 = W + PHYS.boardY;
  if (b.x < x0) {
    b.x = x0;
    b.vx = Math.abs(b.vx) * 0.3;
  } else if (b.x > x1) {
    b.x = x1;
    b.vx = -Math.abs(b.vx) * 0.3;
  }
  if (b.y < y0) {
    b.y = y0;
    b.vy = Math.abs(b.vy) * 0.3;
  } else if (b.y > y1) {
    b.y = y1;
    b.vy = -Math.abs(b.vy) * 0.3;
  }
}

// Predict the free ball path (no players, no frame) into out[i*3..] at dt spacing.
const tmp = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 };
export function predictBall(b, out, n, dt) {
  tmp.x = b.x;
  tmp.y = b.y;
  tmp.z = b.z;
  tmp.vx = b.vx;
  tmp.vy = b.vy;
  tmp.vz = b.vz;
  tmp.spin = b.spin;
  const subs = 3;
  const h = dt / subs;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < subs; k++) integrate(tmp, h);
    out[i * 3] = tmp.x;
    out[i * 3 + 1] = tmp.y;
    out[i * 3 + 2] = tmp.z;
  }
}
