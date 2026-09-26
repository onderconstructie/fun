// Ring buffer of compact match snapshots for instant replays.

import { ST } from './player.js';

const PER_PLAYER = 10;

export class Recorder {
  constructor(nPlayers = 22, seconds = 9, hz = 60) {
    this.n = nPlayers;
    this.size = 4 + nPlayers * PER_PLAYER;
    this.cap = Math.ceil(seconds * hz);
    this.buf = new Float32Array(this.cap * this.size);
    this.head = 0;
    this.count = 0;
  }

  capture(m) {
    const o = this.head * this.size;
    const f = this.buf;
    const b = m.ball;
    f[o] = b.x;
    f[o + 1] = b.y;
    f[o + 2] = b.z;
    f[o + 3] = b.rot;
    let k = o + 4;
    for (const p of m.players) {
      f[k] = p.x;
      f[k + 1] = p.y;
      f[k + 2] = p.z;
      f[k + 3] = p.fx;
      f[k + 4] = p.fy;
      f[k + 5] = p.state;
      f[k + 6] = p.anim;
      f[k + 7] = p.kickT;
      f[k + 8] = p.speed;
      f[k + 9] = p.dive ? Math.atan2(p.dive.ty - p.dive.sy, p.dive.tx - p.dive.sx) : 0;
      k += PER_PLAYER;
    }
    this.head = (this.head + 1) % this.cap;
    this.count = Math.min(this.cap, this.count + 1);
  }

  // Copy of the last `frames` frames, oldest first.
  tail(frames) {
    const n = Math.min(frames, this.count);
    const out = new Float32Array(n * this.size);
    for (let i = 0; i < n; i++) {
      const idx = (this.head - n + i + this.cap * 2) % this.cap;
      out.set(this.buf.subarray(idx * this.size, (idx + 1) * this.size), i * this.size);
    }
    return { data: out, frames: n, size: this.size, n: this.n };
  }
}

// Fill scene players/ball from clip at fractional frame index.
export function clipScene(clip, t, scene) {
  const i0 = Math.max(0, Math.min(clip.frames - 1, Math.floor(t)));
  const i1 = Math.min(clip.frames - 1, i0 + 1);
  const a = t - i0;
  const d = clip.data, s = clip.size;
  const o0 = i0 * s, o1 = i1 * s;
  const lerp = (k) => d[o0 + k] + (d[o1 + k] - d[o0 + k]) * a;
  scene.ball.x = lerp(0);
  scene.ball.y = lerp(1);
  scene.ball.z = lerp(2);
  scene.ball.rot = d[o1 + 3];
  for (let p = 0; p < clip.n; p++) {
    const k = 4 + p * PER_PLAYER;
    const v = scene.players[p];
    v.x = lerp(k);
    v.y = lerp(k + 1);
    v.z = lerp(k + 2);
    v.fx = d[o1 + k + 3];
    v.fy = d[o1 + k + 4];
    v.state = d[o1 + k + 5] | 0;
    v.anim = d[o1 + k + 6];
    v.kickT = d[o1 + k + 7];
    v.speedNow = d[o1 + k + 8];
    v.diveWorld = v.state === ST.DIVE ? d[o1 + k + 9] : undefined;
  }
}
