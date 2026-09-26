// Perspective camera with yaw/pitch, near-plane clipping and a broadcast
// follow mode. Coordinates: see engine/constants.js.

import { L, W, CX, CY } from '../engine/constants.js';
import { clamp } from '../util.js';

const NEAR = 0.6;

export class Camera {
  constructor() {
    this.w = 800;
    this.h = 400;
    this.fov = (16 * Math.PI) / 180;
    this.pitch = (34 * Math.PI) / 180;
    this.pitchDeg = 34;
    this.hDiv = 22;
    this.wDiv = 46;
    this.yaw = -Math.PI / 2;
    this.tx = CX;
    this.ty = CY;
    this.tz = 0;
    this.dist = 60;
    this.zoom = 1;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.yShift = 0.06; // target sits slightly below screen centre
    this.update();
  }

  setViewport(w, h) {
    this.w = w;
    this.h = h;
    this.F = h / 2 / Math.tan(this.fov / 2);
  }

  // Base scale (CSS px per metre at the target) for this screen.
  baseScale() {
    return Math.min(this.h / this.hDiv, this.w / this.wDiv);
  }

  update() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const hx = Math.cos(this.yaw), hy = Math.sin(this.yaw);
    this.fx = hx * cp;
    this.fy = hy * cp;
    this.fz = -sp;
    this.rx = -hy;
    this.ry = hx;
    this.ux = -this.fz * this.ry;
    this.uy = this.fz * this.rx;
    this.uz = this.fx * this.ry - this.fy * this.rx;
    this.px = this.tx - this.fx * this.dist + this.shakeX;
    this.py = this.ty - this.fy * this.dist + this.shakeY;
    this.pz = this.tz - this.fz * this.dist;
    this.F = this.h / 2 / Math.tan(this.fov / 2);
    this.cx = this.w / 2;
    this.cy = this.h / 2 + this.h * this.yShift;
  }

  // World -> camera space. out = {x, y, z} (z = depth).
  toCam(x, y, z, out) {
    const dx = x - this.px, dy = y - this.py, dz = z - this.pz;
    out.x = dx * this.rx + dy * this.ry;
    out.y = dx * this.ux + dy * this.uy + dz * this.uz;
    out.z = dx * this.fx + dy * this.fy + dz * this.fz;
    return out;
  }

  // World -> screen. Returns false when behind the camera.
  project(x, y, z, out) {
    const dx = x - this.px, dy = y - this.py, dz = z - this.pz;
    const cz = dx * this.fx + dy * this.fy + dz * this.fz;
    if (cz < NEAR) {
      out.ok = false;
      return false;
    }
    const cx = dx * this.rx + dy * this.ry;
    const cy = dx * this.ux + dy * this.uy + dz * this.uz;
    const s = this.F / cz;
    out.x = this.cx + cx * s;
    out.y = this.cy - cy * s;
    out.s = s;
    out.z = cz;
    out.ok = true;
    return true;
  }

  // Project a world polygon (flat array x,y,z,...) with near clipping into
  // screen coords (flat array). Returns number of points written.
  projectPoly(pts, out) {
    const n = pts.length / 3;
    const cam = this._cam || (this._cam = new Float64Array(96 * 3));
    for (let i = 0; i < n; i++) {
      const dx = pts[i * 3] - this.px, dy = pts[i * 3 + 1] - this.py, dz = pts[i * 3 + 2] - this.pz;
      cam[i * 3] = dx * this.rx + dy * this.ry;
      cam[i * 3 + 1] = dx * this.ux + dy * this.uy + dz * this.uz;
      cam[i * 3 + 2] = dx * this.fx + dy * this.fy + dz * this.fz;
    }
    let m = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const az = cam[i * 3 + 2], bz = cam[j * 3 + 2];
      const ain = az >= NEAR, bin = bz >= NEAR;
      if (ain) {
        const s = this.F / az;
        out[m * 2] = this.cx + cam[i * 3] * s;
        out[m * 2 + 1] = this.cy - cam[i * 3 + 1] * s;
        m++;
      }
      if (ain !== bin) {
        const t = (NEAR - az) / (bz - az);
        const x = cam[i * 3] + (cam[j * 3] - cam[i * 3]) * t;
        const y = cam[i * 3 + 1] + (cam[j * 3 + 1] - cam[i * 3 + 1]) * t;
        const s = this.F / NEAR;
        out[m * 2] = this.cx + x * s;
        out[m * 2 + 1] = this.cy - y * s;
        m++;
      }
    }
    return m;
  }

  // Ground point under a screen pixel (for visible-area estimates).
  groundAt(sx, sy) {
    const x = (sx - this.cx) / this.F, y = -(sy - this.cy) / this.F;
    // ray dir = f + x*r + y*u
    const dx = this.fx + x * this.rx + y * this.ux;
    const dy = this.fy + x * this.ry + y * this.uy;
    const dz = this.fz + y * this.uz;
    if (dz >= -1e-6) return null;
    const t = -this.pz / dz;
    return { x: this.px + dx * t, y: this.py + dy * t };
  }
}

// Broadcast director: follows the ball with look-ahead and keeps the view on the pitch.
export class Director {
  constructor(cam) {
    this.cam = cam;
    this.mode = 'broadcast';
    this.zoomPref = 1;
    this.cx = CX;
    this.cy = CY;
    this.zoomNow = 1;
    this.leadX = 0;
  }

  snap(x, y) {
    this.cx = x;
    this.cy = y;
    this.leadX = 0;
  }

  // focus: {x, y, vx, vy, dir} where dir is the attacking direction of the team in possession (or 0)
  update(dt, focus, opts = {}) {
    const cam = this.cam;
    cam.yaw = -Math.PI / 2;
    cam.pitch = (cam.pitchDeg * Math.PI) / 180;
    cam.tz = 0;
    cam.fov = (16 * Math.PI) / 180;
    cam.yShift = 0.06;
    const zoomTarget = (opts.zoom || 1) * this.zoomPref;
    this.zoomNow += (zoomTarget - this.zoomNow) * Math.min(1, dt * 2.5);
    const scale = cam.baseScale() * this.zoomNow;
    cam.F = cam.h / 2 / Math.tan(cam.fov / 2);
    cam.dist = cam.F / scale;

    const lead = clamp(focus.vx * 0.35, -7, 7) + (focus.dir || 0) * 4;
    this.leadX += (lead - this.leadX) * Math.min(1, dt * 1.6);
    let tx = focus.x + this.leadX;
    let ty = focus.y * 0.85 + CY * 0.15;
    const k = opts.snappy ? 12 : 4.2;
    this.cx += (tx - this.cx) * Math.min(1, dt * k);
    this.cy += (ty - this.cy) * Math.min(1, dt * k * 0.75);

    // Keep inside sensible bounds.
    const halfW = cam.w / 2 / scale;
    const minX = -6 + halfW * 0.8, maxX = L + 6 - halfW * 0.8;
    const cxC = minX < maxX ? clamp(this.cx, minX, maxX) : CX;
    // Visible depth depends on pitch/fov: far part ~ 0.63*dist*? -> compute via ground rays.
    cam.tx = cxC;
    cam.ty = this.cy;
    cam.update();
    const top = cam.groundAt(cam.w / 2, 0);
    const bot = cam.groundAt(cam.w / 2, cam.h);
    if (top && bot) {
      const farExt = this.cy - top.y;
      const nearExt = bot.y - this.cy;
      const lo = -9 + farExt, hi = W + 5 - nearExt;
      cam.ty = lo < hi ? clamp(this.cy, lo, hi) : (lo + hi) / 2;
    }
    if (cam.shake > 0) {
      cam.shake = Math.max(0, cam.shake - dt * 2.5);
      cam.shakeX = (Math.random() - 0.5) * cam.shake * 0.8;
      cam.shakeY = (Math.random() - 0.5) * cam.shake * 0.8;
    } else {
      cam.shakeX = cam.shakeY = 0;
    }
    cam.update();
  }

  // Behind-the-taker view for penalties, looking at the goal (dir = +1 attacks x = L).
  behind(ballX, dir) {
    const cam = this.cam;
    const goalX = dir > 0 ? L : 0;
    const back = 14, h = 3.2, look = 1.0, side = 1.6;
    // Slightly off-centre so the taker does not hide the goal.
    const camX = ballX - dir * back, camY = CY + dir * side;
    const dx = goalX - camX, dy = CY - camY;
    const hd = Math.hypot(dx, dy);
    cam.yaw = Math.atan2(dy, dx);
    cam.pitch = Math.atan2(h - look, hd);
    cam.fov = (22 * Math.PI) / 180;
    cam.yShift = -0.08;
    cam.tx = goalX;
    cam.ty = CY;
    cam.tz = look;
    cam.dist = Math.hypot(hd, h - look);
    cam.shakeX = cam.shakeY = 0;
    cam.update();
    this.cx = ballX;
    this.cy = CY;
  }
}
