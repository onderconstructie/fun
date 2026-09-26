// Frame renderer: builds a scene from the live match (interpolated) or a
// replay clip and draws it with the broadcast camera.

import { Camera, Director } from './camera.js';
import { Stadium } from './stadium.js';
import { basis, drawShadow, drawPlayer, drawBall } from './sprites.js';
import { ST } from '../engine/player.js';
import { CY } from '../engine/constants.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.cam = new Camera();
    this.director = new Director(this.cam);
    this.stadium = null;
    this.dpr = 1;
    this.maxDpr = 2;
    this.w = 0;
    this.h = 0;
    this.scene = null;
    this.items = [];
    this.bases = [];
    this.time = 0;
    this.labelFont = '700 12px "Barlow Condensed", system-ui, sans-serif';
    this.highlight = null; // {x, y} pass target preview
    this.aim = null; // {x, y, dx, dy, len}
  }

  resize(w, h, dpr) {
    this.dpr = Math.min(this.maxDpr, dpr || 1);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.cam.setViewport(w, h);
    this.ctx.__dpr = this.dpr;
  }

  setMatch(match) {
    const k0 = match.teams[0].kit, k1 = match.teams[1].kit;
    this.stadium = new Stadium([k0.shirt, k0.shirt, k0.shorts, k1.shirt, k1.shirt, k1.shorts]);
    this.scene = {
      players: match.players.map((p) => ({
        x: p.x, y: p.y, z: 0, fx: p.fx, fy: p.fy, state: 0, anim: 0, kickT: 0, speedNow: 0,
        team: p.team.index, isGK: p.isGK, name: p.name, number: p.number, diveWorld: undefined,
      })),
      ball: { x: match.ball.x, y: match.ball.y, z: 0, rot: 0 },
      kits: [
        match.teams[0].kit,
        match.teams[1].kit,
      ],
      gkKits: match.teams.map((t) => ({ ...t.kit, shirt: t.gkColor, shorts: '#1f2937', socks: t.gkColor, trim: '#111827', pattern: 'plain' })),
    };
    this.items = match.players.map(() => ({ kind: 'p', idx: 0, depth: 0 }));
    this.bases = match.players.map(() => ({}));
    this.director.snap(match.ball.x, match.ball.y);
  }

  // Live scene from match state with interpolation factor a (0..1).
  sceneFromMatch(m, a) {
    const sc = this.scene;
    const b = m.ball;
    sc.ball.x = b.px + (b.x - b.px) * a;
    sc.ball.y = b.py + (b.y - b.py) * a;
    sc.ball.z = b.pz + (b.z - b.pz) * a;
    sc.ball.rot = b.rot;
    for (let i = 0; i < m.players.length; i++) {
      const p = m.players[i], v = sc.players[i];
      v.x = p.px + (p.x - p.px) * a;
      v.y = p.py + (p.y - p.py) * a;
      v.z = p.pz + (p.z - p.pz) * a;
      v.fx = p.fx;
      v.fy = p.fy;
      v.state = p.state;
      v.anim = p.anim;
      v.kickT = p.kickT;
      v.speedNow = p.speed;
      v.diveWorld = p.dive ? Math.atan2(p.dive.ty - p.dive.sy, p.dive.tx - p.dive.sx) : undefined;
    }
    return sc;
  }

  // opts: {controlled, carrier, excitement, labels, replay}
  draw(sc, opts = {}) {
    const ctx = this.ctx, cam = this.cam, st = this.stadium;
    this.time += 1 / 60;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    st.drawBackground(ctx, cam, opts.excitement || 0);
    st.drawPitch(ctx, cam);
    st.drawBoards(ctx, cam);
    st.drawCornerFlags(ctx, cam, this.time);

    // Build drawables.
    const items = this.items;
    let n = 0;
    for (let i = 0; i < sc.players.length; i++) {
      const v = sc.players[i];
      const bs = this.bases[i];
      if (!basis(cam, v.x, v.y, v.fx, v.fy, bs)) {
        bs.hidden = true;
        continue;
      }
      bs.hidden = false;
      if (bs.x < -80 || bs.x > this.w + 80 || bs.y < -60 || bs.y > this.h + 140) {
        bs.off = true;
        continue;
      }
      bs.off = false;
      const it = items[n++] || (items[n - 1] = {});
      it.kind = 'p';
      it.idx = i;
      it.depth = bs.depth;
    }
    // Ball.
    const bp = this._bp || (this._bp = {});
    if (cam.project(sc.ball.x, sc.ball.y, 0, bp)) {
      const it = items[n++] || (items[n - 1] = {});
      it.kind = 'b';
      it.depth = bp.z - 0.05;
    }
    // Goals.
    const gp = this._gp || (this._gp = {});
    for (const g of st.goals) {
      const parts = [
        ['net', g.center[0], g.center[1], 1.0],
        ['post0', g.posts[0][0], g.posts[0][1], 1.2],
        ['post1', g.posts[1][0], g.posts[1][1], 1.2],
        ['bar', g.gx, CY, 2.44],
      ];
      for (const [part, x, y, z] of parts) {
        if (!cam.project(x, y, z, gp)) continue;
        const it = items[n++] || (items[n - 1] = {});
        it.kind = 'g';
        it.goal = g;
        it.part = part;
        it.depth = gp.z + (part === 'net' ? 0.02 : 0);
      }
    }
    items.length = Math.max(items.length, n);
    const list = items.slice(0, n).sort((a, b) => b.depth - a.depth);

    // Shadows and ground markers first.
    for (let i = 0; i < sc.players.length; i++) {
      const bs = this.bases[i];
      if (bs.hidden || bs.off) continue;
      drawShadow(ctx, bs, 0.3);
    }
    if (this.highlight && !opts.replay) this.ring(this.highlight.x, this.highlight.y, 'rgba(255,255,255,0.75)', 0.75, 1.5);
    if (opts.controlled != null && !opts.replay) {
      const v = sc.players[opts.controlled];
      this.ring(v.x, v.y, '#35f0ff', 0.72, 2.6, opts.ringPulse);
    }
    if (this.aim && !opts.replay) this.aimArrow(this.aim);
    const reticleLater = this.reticle && !opts.replay;

    for (const it of list) {
      if (it.kind === 'p') {
        const v = sc.players[it.idx];
        const kit = v.isGK ? sc.gkKits[v.team] : sc.kits[v.team];
        if (v.state === ST.DIVE && v.diveWorld !== undefined) {
          const bs = this.bases[it.idx];
          const c = Math.cos(v.diveWorld), s = Math.sin(v.diveWorld);
          const tmp = this._tmp || (this._tmp = {});
          cam.project(v.x + c, v.y + s, 0, tmp);
          const sx = tmp.x - bs.x, sy = tmp.y - bs.y;
          v.diveAng = Math.atan2(sx, -sy) * 0.85;
        } else v.diveAng = undefined;
        drawPlayer(ctx, this.bases[it.idx], v, kit);
      } else if (it.kind === 'b') {
        drawBall(ctx, cam, sc.ball.x, sc.ball.y, sc.ball.z, sc.ball.rot, opts.replay ? 1.25 : 1.45);
      } else {
        st.drawGoalPart(ctx, cam, it.goal, it.part);
      }
    }

    if (reticleLater) this.drawReticle(this.reticle);
    // Labels.
    if (!opts.replay) {
      if (opts.controlled != null) this.label(sc.players[opts.controlled], this.bases[opts.controlled], opts.controlledName, true);
      if (opts.carrier != null && opts.carrier !== opts.controlled) this.label(sc.players[opts.carrier], this.bases[opts.carrier], opts.carrierName, false);
    }
    if (opts.controlled != null && !opts.replay) this.offscreen(sc.players[opts.controlled], this.bases[opts.controlled]);
  }

  drawReticle(rt) {
    const ctx = this.ctx, cam = this.cam;
    const p = this._tp || (this._tp = {});
    if (!cam.project(rt.x, rt.y, rt.z, p)) return;
    const r = Math.max(9, 0.32 * p.s);
    ctx.strokeStyle = rt.hot ? '#ff4d6d' : '#c6ff3d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.moveTo(p.x - r * 1.5, p.y);
    ctx.lineTo(p.x - r * 0.5, p.y);
    ctx.moveTo(p.x + r * 0.5, p.y);
    ctx.lineTo(p.x + r * 1.5, p.y);
    ctx.moveTo(p.x, p.y - r * 1.5);
    ctx.lineTo(p.x, p.y - r * 0.5);
    ctx.moveTo(p.x, p.y + r * 0.5);
    ctx.lineTo(p.x, p.y + r * 1.5);
    ctx.stroke();
  }

  ring(x, y, color, r, width, pulse = 0) {
    const ctx = this.ctx, cam = this.cam;
    const p = this._rp || (this._rp = {});
    const q = this._rq || (this._rq = {});
    if (!cam.project(x, y, 0, p)) return;
    cam.project(x, y + 1, 0, q);
    const ry = Math.max(2, Math.abs(q.y - p.y)) * r;
    const rx = p.s * r;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * (1 + pulse * 0.25), ry * (1 + pulse * 0.25), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  aimArrow(a) {
    const ctx = this.ctx, cam = this.cam;
    const p = this._ap || (this._ap = {});
    const q = this._aq || (this._aq = {});
    if (!cam.project(a.x, a.y, 0.05, p) || !cam.project(a.x + a.dx * a.len, a.y + a.dy * a.len, 0.05, q)) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(q.y - p.y, q.x - p.x);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(q.x + Math.cos(ang) * 10, q.y + Math.sin(ang) * 10);
    ctx.lineTo(q.x + Math.cos(ang + 2.5) * 9, q.y + Math.sin(ang + 2.5) * 9);
    ctx.lineTo(q.x + Math.cos(ang - 2.5) * 9, q.y + Math.sin(ang - 2.5) * 9);
    ctx.closePath();
    ctx.fill();
  }

  label(v, bs, text, primary) {
    if (!bs || bs.hidden || bs.off || !text) return;
    const ctx = this.ctx;
    const y = bs.y - (v.z || 0) * bs.u - 2.05 * bs.u - 6;
    ctx.font = this.labelFont;
    const tw = ctx.measureText(text).width;
    const pad = 5, h = 16;
    const x = bs.x - tw / 2 - pad;
    ctx.fillStyle = primary ? 'rgba(6,12,24,0.78)' : 'rgba(6,12,24,0.55)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y - h, tw + pad * 2, h, 4);
    else ctx.rect(x, y - h, tw + pad * 2, h);
    ctx.fill();
    ctx.fillStyle = primary ? '#35f0ff' : '#e5e7eb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bs.x, y - h / 2 + 0.5);
    if (primary) {
      ctx.beginPath();
      ctx.moveTo(bs.x - 4, y + 1);
      ctx.lineTo(bs.x + 4, y + 1);
      ctx.lineTo(bs.x, y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  offscreen(v, bs) {
    if (!bs || bs.hidden) return;
    const m = 14;
    if (bs.x >= 0 && bs.x <= this.w && bs.y >= 0 && bs.y <= this.h) return;
    const ctx = this.ctx;
    const x = Math.max(m, Math.min(this.w - m, bs.x));
    const y = Math.max(m + 40, Math.min(this.h - m, bs.y));
    const ang = Math.atan2(bs.y - y, bs.x - x);
    ctx.fillStyle = '#35f0ff';
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * 10, y + Math.sin(ang) * 10);
    ctx.lineTo(x + Math.cos(ang + 2.4) * 9, y + Math.sin(ang + 2.4) * 9);
    ctx.lineTo(x + Math.cos(ang - 2.4) * 9, y + Math.sin(ang - 2.4) * 9);
    ctx.closePath();
    ctx.fill();
  }
}
