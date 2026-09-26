// Team AI: formation shape, role assignment, ball-carrier decisions
// (utility over shoot / pass / through ball / cross / dribble), pressing,
// marking, off-ball runs and goalkeeping.

import { L, W, CX, CY, GOAL_HW, BOX_D, BOX_HW, PEN_D } from './constants.js';
import { ST } from './player.js';
import { groundSpeedFor, groundTime } from './kick.js';
import { clamp, dist, sigmoid, segPoint } from '../util.js';

export const PROFILES = {
  // caution: how much riskier the AI believes dribbling is (lower levels
  // hesitate and recycle the ball instead of taking players on).
  amateur: { tempo: 0.7, react: 0.55, noise: 0.5, passErr: 1.7, shotErr: 1.7, press: 0.35, tackle: 0.42, gkReact: 1.5, speed: 0.88, run: 0.25, shootBias: 0.85, risk: 1.4, mark: 0.4, lag: 0.7, caution: 1.9 },
  pro: { tempo: 0.85, react: 0.36, noise: 0.3, passErr: 1.3, shotErr: 1.35, press: 0.6, tackle: 0.65, gkReact: 1.22, speed: 0.95, run: 0.45, shootBias: 1.0, risk: 1.15, mark: 0.72, lag: 0.48, caution: 1.65 },
  wereldklasse: { tempo: 1, react: 0.25, noise: 0.17, passErr: 1.0, shotErr: 1.08, press: 0.86, tackle: 0.88, gkReact: 1.0, speed: 1.0, run: 0.65, shootBias: 1.0, risk: 1.0, mark: 0.9, lag: 0.3, caution: 1.25 },
  legende: { tempo: 1.1, react: 0.18, noise: 0.08, passErr: 0.88, shotErr: 0.9, press: 1.0, tackle: 1.0, gkReact: 0.92, speed: 1.02, run: 0.8, shootBias: 1.05, risk: 0.95, mark: 1.0, lag: 0.22, caution: 1.0 },
  mate: { tempo: 1, react: 0.25, noise: 0.15, passErr: 1.0, shotErr: 1.0, press: 0.82, tackle: 0.85, gkReact: 1.0, speed: 1.0, run: 0.7, shootBias: 1.0, risk: 1.0, mark: 0.9, lag: 0.3, caution: 1.2 },
};

// Chance of scoring from an unpressured shot at local (lx, ly); goal at lx = L.
// Fitted to the engine (good finisher vs good keeper, no pressure): ~80%
// from 11 m, ~52% from 16 m, ~31% from 20 m, ~14% from 25 m.
export function xgAt(lx, ly) {
  const dx = L - lx;
  if (dx < 0.3) return 0.02;
  const dy = Math.abs(ly - CY);
  const d = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.abs(Math.atan2(dy + GOAL_HW, dx) - Math.atan2(dy - GOAL_HW, dx));
  return sigmoid(2.08 - 0.18 * d + 2.0 * angle);
}

// Threat of owning the ball at local (lx, ly).
export function threat(lx, ly) {
  const dGoal = Math.sqrt((L - lx) * (L - lx) + (ly - CY) * (ly - CY));
  const f = clamp(1 - dGoal / 110, 0, 1);
  return 0.008 + 0.06 * Math.pow(f, 2.2) + (dGoal < 40 ? 0.25 * xgAt(lx, ly) : 0);
}

// Time for a player standing still to cover distance d (reaction + acceleration).
export function reachTime(o, d, react) {
  const a = 7.5, v = o.vmax;
  const dAcc = (v * v) / (2 * a);
  return react + (d < dAcc ? Math.sqrt((2 * d) / a) : v / a + (d - dAcc) / v);
}

const DIRS = [0, 0.45, -0.45, 0.95, -0.95, 1.5, -1.5, 2.3, -2.3];
// Box runs (local frame): near post, penalty spot, far post; y offsets are
// towards the ball side.
const BOX_X = [L - 6, L - 11, L - 7.5];
const BOX_Y = [2.5, 0.5, -3.5];

export class TeamAI {
  constructor(match, team, prof) {
    this.m = match;
    this.t = team;
    this.prof = prof;
    this.stratT = match.rng() * 0.1;
    this.phase = 'loose';
    this.sp = {};
    this.offLine = CX;
  }

  reactTime() {
    return this.prof.react * (0.75 + this.m.rng() * 0.5);
  }

  tick(dt) {
    this.stratT -= dt;
    if (this.stratT <= 0) {
      this.stratT = 0.1;
      this.strategic();
    }
    const m = this.m;
    const setpiece = m.phase === 'setpiece' || m.phase === 'kickoff';
    const dead = m.phase === 'dead';
    for (const p of this.t.players) {
      if (p.human && !p.aiDriven) continue;
      if (setpiece) this.setpieceMove(p, dt);
      else if (dead) this.deadMove(p, dt);
      else this.control(p, dt);
    }
  }

  // ------------------------------------------------------------ strategy
  strategic() {
    const m = this.m, t = this.t;
    const poss = m.possTeam;
    this.phase = poss === t.index ? 'att' : poss === t.opp.index ? 'def' : 'loose';
    let a = -1e9, s2 = -1e9;
    for (const o of t.opp.players) {
      const lx = t.lx(o.x);
      if (lx > a) {
        s2 = a;
        a = lx;
      } else if (lx > s2) s2 = lx;
    }
    this.offLine = Math.max(s2, CX);
    // The defensive block follows the ball with a human delay.
    const b = m.ball;
    if (m.phase !== 'play' || this.bx === undefined) {
      this.bx = b.x;
      this.by = b.y;
    } else {
      const k = 1 - Math.exp(-0.1 / this.prof.lag);
      this.bx += (b.x - this.bx) * k;
      this.by += (b.y - this.by) * k;
    }
    this.computeShape();
    if (m.phase === 'play') this.assignRoles();
  }

  computeShape() {
    const t = this.t, b = this.m.ball;
    const def = this.phase === 'def';
    const blx = t.lx(def ? this.bx : b.x), bly = t.ly(def ? this.by : b.y);
    let back, front, widthF, shiftF;
    if (this.phase === 'att') {
      back = clamp(0.6 * blx + 5, 10, 55);
      front = clamp(0.5 * blx + 50, 56, 94);
      widthF = 1.02;
      shiftF = 0.2;
    } else if (this.phase === 'def') {
      back = clamp(0.62 * blx - 1, 8, 40);
      front = clamp(back + 30 + (blx > 66 ? (blx - 66) * 0.6 * this.prof.press : 0), 34, 82);
      widthF = 0.74;
      shiftF = 0.42;
    } else {
      back = clamp(0.61 * blx + 2, 9, 47);
      front = clamp(0.55 * blx + 35, 42, 82);
      widthF = 0.88;
      shiftF = 0.32;
    }
    const onside = Math.max(this.offLine, blx) - 0.9;
    // Final third: the most advanced players attack the box (near post,
    // penalty spot, far post) so there is someone to cross or cut back to.
    const boxRun = this.phase === 'att' && blx > 66 ? clamp((blx - 66) / 12, 0, 1) : 0;
    const runners = this.runners || (this.runners = []);
    runners.length = 0;
    const side = bly < CY ? -1 : 1;
    if (boxRun) {
      // Ball side first: near post, then the spot, then the far post.
      for (const p of t.players) if (!p.isGK && p.slot.d > 0.78 && p !== this.m.ball.owner) runners.push(p);
      runners.sort((a, b) => (b.slot.l - a.slot.l) * side);
      runners.length = Math.min(3, runners.length);
    }
    for (const p of t.players) {
      if (p.isGK) continue;
      const s = p.slot;
      let lx = back + s.d * (front - back);
      let ly = CY + (s.l * W - CY) * widthF + (bly - CY) * shiftF;
      const r = boxRun ? runners.indexOf(p) : -1;
      if (r >= 0) {
        lx += (BOX_X[r] - lx) * boxRun;
        ly += (CY + side * BOX_Y[r] - ly) * boxRun;
      }
      if (this.phase === 'att') lx = Math.min(lx, onside - (s.d > 0.6 ? 0 : 1.5));
      lx = clamp(lx, 4, L - 6);
      ly = clamp(ly, 2.5, W - 2.5);
      p.ai.hx = t.wx(lx);
      p.ai.hy = t.wy(ly);
    }
  }

  bestIc(exclude, noGK = true) {
    let best = null, bt = 1e9;
    for (const p of this.t.players) {
      if (p === exclude || (noGK && p.isGK) || p.state === ST.DOWN) continue;
      if (p.icT < bt) {
        bt = p.icT;
        best = p;
      }
    }
    return best;
  }

  assignRoles() {
    const m = this.m, t = this.t, b = m.ball;
    for (const p of t.players) {
      p.ai.mode = p.isGK ? 'gk' : 'shape';
      if (!p.isGK) p.ai.mark = null;
    }
    const owner = b.owner;
    const hp = m.controlled && m.controlled.team === t ? m.controlled : null;
    const humanActive = hp && !hp.aiDriven ? hp : null;

    if (this.phase === 'att') {
      if (owner && owner.team === t) owner.ai.mode = 'carry';
      else if (b.kick && b.kick.target && b.kick.target.team === t) b.kick.target.ai.mode = 'receive';
      else {
        const c = this.bestIc(humanActive);
        if (c && (!humanActive || c.icT < humanActive.icT - 0.2)) c.ai.mode = 'chase';
      }
      // Two supports near the ball.
      const ox = owner ? owner.x : b.x, oy = owner ? owner.y : b.y;
      let s1 = null, s2 = null, d1 = 1e9, d2 = 1e9;
      for (const p of t.players) {
        if (p.isGK || p.ai.mode !== 'shape' || p.ai.runT > 0) continue;
        const d = dist(p.x, p.y, ox, oy);
        if (d < d1) {
          s2 = s1;
          d2 = d1;
          s1 = p;
          d1 = d;
        } else if (d < d2) {
          s2 = p;
          d2 = d;
        }
      }
      if (s1) s1.ai.mode = 'support';
      if (s2) s2.ai.mode = 'support';
      return;
    }

    if (this.phase === 'def') {
      const presser = this.bestIc(humanActive);
      let cover = null;
      if (presser) {
        if (humanActive && humanActive.icT < presser.icT + 0.35 && !m.userPressing) {
          presser.ai.mode = 'cover';
        } else {
          presser.ai.mode = owner ? 'press' : 'chase';
          let bc = 1e9;
          for (const p of t.players) {
            if (p.isGK || p === presser || p === humanActive || p.state === ST.DOWN) continue;
            if (p.icT < bc) {
              bc = p.icT;
              cover = p;
            }
          }
          if (cover) cover.ai.mode = 'cover';
        }
      }
      // Pass in transit: whoever can intercept first goes for it.
      if (!owner && b.kick && b.kick.team !== t.index) {
        const ic = this.bestIc(humanActive);
        const recv = b.kick.target;
        if (ic && recv && ic.icT < recv.icT + 0.05) ic.ai.mode = 'chase';
      }
      this.assignMarkers(owner);
      return;
    }

    // Loose ball.
    const c = this.bestIc(humanActive, false);
    if (c) {
      if (c.isGK) {
        if (!this.inOwnBoxArea(c.icX, c.icY)) {
          const c2 = this.bestIc(humanActive, true);
          if (c2) c2.ai.mode = 'chase';
        }
      } else if (!humanActive || c.icT < humanActive.icT - 0.25) c.ai.mode = 'chase';
    }
    this.assignMarkers(null);
  }

  inOwnBoxArea(x, y) {
    return this.t.lx(x) < BOX_D + 1 && Math.abs(y - CY) < BOX_HW + 1;
  }

  assignMarkers(owner) {
    const t = this.t;
    const threats = [];
    for (const o of t.opp.players) {
      if (o.isGK || o === owner) continue;
      const lx = t.lx(o.x);
      if (lx < 26) threats.push(o);
    }
    threats.sort((a, b) => t.lx(a.x) - t.lx(b.x));
    for (const o of threats) {
      let best = null, bd = 16;
      for (const p of t.players) {
        if (p.isGK || p.ai.mode !== 'shape' || (p.human && !p.aiDriven)) continue;
        if (p.role === 'att') continue;
        const d = dist(p.ai.hx, p.ai.hy, o.x, o.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) {
        best.ai.mode = 'mark';
        best.ai.mark = o;
      }
    }
  }

  // ------------------------------------------------------------ per-player control
  control(p, dt) {
    const b = this.m.ball;
    if (p.state === ST.DIVE || p.state === ST.DOWN || p.state === ST.SLIDE) return;
    if (p.aiDriven === 'press') return this.press(p, dt);
    if (b.owner === p) return p.isGK ? this.gkWithBall(p, dt) : this.carrier(p, dt);
    switch (p.ai.mode) {
      case 'gk':
        return this.goalkeeper(p, dt);
      case 'receive':
        return this.receive(p, dt);
      case 'chase':
        return this.chase(p, dt);
      case 'press':
        return this.press(p, dt);
      case 'cover':
        return this.cover(p, dt);
      case 'mark':
        return this.mark(p, dt);
      case 'support':
        return this.support(p, dt);
      default:
        return this.shape(p, dt);
    }
  }

  moveTo(p, x, y, urgent = false) {
    const dx = x - p.x, dy = y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.3) {
      p.tvx = 0;
      p.tvy = 0;
      p.sprinting = false;
      return d;
    }
    let s = urgent || d > 14 ? p.vmax : Math.min(p.jog, 0.6 + d * 0.9);
    s *= this.prof.speed;
    p.sprinting = s > p.jog + 0.05;
    p.tvx = (dx / d) * s;
    p.tvy = (dy / d) * s;
    return d;
  }

  shape(p, dt) {
    const ai = p.ai;
    ai.runCD -= dt;
    if (this.phase === 'att') this.maybeRun(p, dt);
    if (ai.runT > 0) {
      ai.runT -= dt;
      if (this.moveTo(p, ai.rx, ai.ry, true) < 1.2) ai.runT = 0;
      return;
    }
    const b = this.m.ball;
    if (this.phase === 'att' && p.role !== 'def') {
      ai.spaceT -= dt;
      if (ai.spaceT <= 0) {
        ai.spaceT = 0.9 + this.m.rng() * 0.6;
        this.findPocket(p);
      }
      this.moveTo(p, ai.sx, ai.sy, dist(p.x, p.y, ai.sx, ai.sy) > 8);
      return;
    }
    const urgent = this.phase === 'def' && this.t.lx(p.x) > this.t.lx(b.x) + 4;
    this.moveTo(p, ai.hx, ai.hy, urgent);
  }

  // Free space near the formation position, onside, with an open lane to the ball.
  findPocket(p) {
    const t = this.t, m = this.m, b = m.ball;
    const c = b.owner;
    const ox = c ? c.x : b.x, oy = c ? c.y : b.y;
    const onside = Math.max(this.offLine, t.lx(ox)) - 0.7;
    let bs = -1e9, sx = p.ai.hx, sy = p.ai.hy;
    for (let i = 0; i < 9; i++) {
      const ang = (i - 1) * (Math.PI / 4);
      const r = i === 0 ? 0 : 6;
      const cx = clamp(p.ai.hx + Math.cos(ang) * r, 2, L - 2), cy = clamp(p.ai.hy + Math.sin(ang) * r, 2, W - 2);
      let near = 10;
      for (const o of t.opp.players) near = Math.min(near, dist(o.x, o.y, cx, cy));
      const lane = m.laneBlock(ox, oy, cx, cy, t.opp);
      const clx = t.lx(cx);
      const off = clx > onside ? -4 : 0;
      const s = near * 0.55 - lane * 1.6 + clx * 0.02 + off - (i === 0 ? 0 : 0.4);
      if (s > bs) {
        bs = s;
        sx = cx;
        sy = cy;
      }
    }
    p.ai.sx = sx;
    p.ai.sy = sy;
  }

  maybeRun(p, dt) {
    const ai = p.ai;
    if (ai.runT > 0 || ai.runCD > 0) return;
    if (p.slot.d < 0.4) return;
    const m = this.m, t = this.t, c = m.ball.owner;
    if (!c || c.team !== t || c === p) return;
    const clx = t.lx(c.x);
    if (clx < 30 || clx > 92) return;
    const plx = t.lx(p.x);
    if (plx < this.offLine - (p.slot.d < 0.65 ? 12 : 8)) return;
    const rate = this.prof.run * (p.slot.d < 0.65 ? 0.35 : 1.3) * (m.pressureOn(c) < 0.6 ? 1 : 0.5);
    if (m.rng() < rate * dt) {
      ai.runT = 2.3;
      ai.runCD = 3.5 + m.rng() * 2.5;
      const tlx = clamp(Math.max(this.offLine, plx) + 13, 0, L - 7);
      const ply = t.ly(p.y);
      const tly = clamp(ply + (CY - ply) * 0.35 + m.rng.range(-4, 4), 6, W - 6);
      ai.rx = t.wx(tlx);
      ai.ry = t.wy(tly);
    }
  }

  receive(p) {
    // Get onto the ball's path at the earliest reachable point, then wait for it.
    const d = dist(p.x, p.y, p.icX, p.icY);
    const spare = p.icT - d / p.vmax;
    this.moveTo(p, p.icX, p.icY, spare < 0.35);
  }

  chase(p) {
    this.moveTo(p, p.icX, p.icY, true);
  }

  press(p, dt) {
    const m = this.m, t = this.t, b = m.ball;
    const c = b.owner;
    if (!c || c.team === t) return this.chase(p, dt);
    let ux = t.ownGoalX - c.x, uy = CY - c.y;
    const ul = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= ul;
    uy /= ul;
    const toBall = dist(p.x, p.y, b.x, b.y);
    const goalSide = (p.x - c.x) * ux + (p.y - c.y) * uy > 0.3;
    let tx, ty;
    if (goalSide && toBall > 2.6) {
      // Close the angle towards our goal first.
      const stand = clamp(1.0 + c.speed * 0.1, 1.0, 1.8);
      tx = c.x + c.vx * 0.25 + ux * stand;
      ty = c.y + c.vy * 0.25 + uy * stand;
    } else {
      // Near the ball or chasing from behind: go for the ball.
      tx = b.x + c.vx * 0.2;
      ty = b.y + c.vy * 0.2;
    }
    const dd = dist(p.x, p.y, tx, ty);
    const intensity = p.human ? 1 : this.prof.press;
    this.moveTo(p, tx, ty, dd > 1.5 && (intensity > 0.6 || dd < 12));
    // Jockey: when goal-side and close, give ground slowly instead of sprinting away.
    const dc = dist(p.x, p.y, c.x, c.y);
    if (goalSide && dc < 6) {
      const back = p.tvx * ux + p.tvy * uy; // speed towards own goal
      const cap = p.jog * 0.62;
      if (back > cap) {
        p.tvx -= ux * (back - cap);
        p.tvy -= uy * (back - cap);
      }
    }
    if (!p.human && intensity < 0.8 && dd > 6) {
      p.tvx *= 0.6 + intensity * 0.4;
      p.tvy *= 0.6 + intensity * 0.4;
    }
    if (p.human) return;
    const ai = p.ai;
    ai.tackleT -= dt;
    if (ai.tackleT <= 0) {
      ai.tackleT = 0.12 + m.rng() * 0.1;
      if (toBall < 1.45 && p.tackleCD <= 0 && p.canAct() && c.state !== ST.HOLD && p.stunT <= 0) {
        // Good defenders wait for a loose touch: tight control is hard to win.
        const exposure = clamp((dist(c.x, c.y, b.x, b.y) - 0.45) / 0.55, 0.2, 1);
        let chance = this.prof.tackle * (0.18 + p.def / 500) * exposure;
        if (c.skillT > 0) chance *= 0.3;
        if (m.rng() < chance) m.tackle(p, false);
      }
    }
  }

  cover(p, dt) {
    const t = this.t, b = this.m.ball;
    const bx = b.owner ? b.owner.x : b.x, by = b.owner ? b.owner.y : b.y;
    if (b.owner && b.owner.team !== t && t.lx(bx) < 30 && !p.human && dist(p.x, p.y, bx, by) < 9) return this.press(p, dt);
    let ux = t.ownGoalX - bx, uy = CY - by;
    const ul = Math.sqrt(ux * ux + uy * uy) || 1;
    const k = Math.min(7, ul * 0.45);
    const tx = bx + (ux / ul) * k, ty = by + (uy / ul) * k;
    this.moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 4);
  }

  mark(p, dt) {
    const o = p.ai.mark;
    if (!o) return this.shape(p, dt);
    const t = this.t, b = this.m.ball;
    let ux = t.ownGoalX - o.x, uy = CY - o.y;
    const ul = Math.sqrt(ux * ux + uy * uy) || 1;
    let bx = b.x - o.x, by = b.y - o.y;
    const bl = Math.sqrt(bx * bx + by * by) || 1;
    const tight = 1.4 + (1 - this.prof.mark) * 3 + Math.max(0, t.lx(o.x) - 16) * 0.15;
    const tx = o.x + o.vx * 0.3 + (ux / ul) * tight + (bx / bl) * 0.7;
    const ty = o.y + o.vy * 0.3 + (uy / ul) * tight + (by / bl) * 0.7;
    this.moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 3 || o.speed > p.jog);
  }

  support(p, dt) {
    const ai = p.ai;
    ai.spaceT -= dt;
    if (ai.spaceT <= 0) {
      ai.spaceT = 0.7 + this.m.rng() * 0.5;
      this.findSpace(p);
    }
    this.moveTo(p, ai.sx, ai.sy, dist(p.x, p.y, ai.sx, ai.sy) > 7);
  }

  findSpace(p) {
    const t = this.t, m = this.m, b = m.ball;
    const c = b.owner;
    const ox = c ? c.x : b.x, oy = c ? c.y : b.y;
    const bx = p.ai.hx * 0.55 + ox * 0.45, by = p.ai.hy * 0.55 + oy * 0.45;
    const onside = Math.max(this.offLine, t.lx(ox)) - 0.6;
    let bs = -1e9, sx = p.ai.hx, sy = p.ai.hy;
    for (let i = 0; i < 9; i++) {
      const ang = (i - 1) * (Math.PI / 4);
      const r = i === 0 ? 0 : 5.5;
      const cx = clamp(bx + Math.cos(ang) * r, 2, L - 2), cy = clamp(by + Math.sin(ang) * r, 2, W - 2);
      const dBall = dist(cx, cy, ox, oy);
      if (dBall < 6) continue;
      let near = 10;
      for (const o of t.opp.players) near = Math.min(near, dist(o.x, o.y, cx, cy));
      const lane = m.laneBlock(ox, oy, cx, cy, t.opp);
      const prog = (t.lx(cx) - t.lx(ox)) * 0.04;
      const off = t.lx(cx) > onside ? -3 : 0;
      const s = near * 0.5 - lane * 2.2 + prog - Math.abs(dBall - 13) * 0.08 + off;
      if (s > bs) {
        bs = s;
        sx = cx;
        sy = cy;
      }
    }
    p.ai.sx = sx;
    p.ai.sy = sy;
  }

  // ------------------------------------------------------------ ball carrier
  carrier(p, dt) {
    const m = this.m, ai = p.ai;
    ai.decideT -= dt;
    const pr = m.pressureOn(p);
    if (ai.settle === undefined || ai.settle === null) ai.settle = pr < 0.3 ? 0.25 * this.prof.tempo : 0;
    if (ai.settle > 0) {
      ai.settle -= dt;
      ai.decideT = Math.max(ai.decideT, ai.settle);
    }
    if (ai.decideT <= 0 || (pr > 0.8 && ai.plan === 'dribble' && ai.decideT > 0.12 && !ai.panic)) {
      ai.panic = pr > 0.8;
      this.decide(p, pr);
      if (m.ball.owner !== p) return;
    }
    if (ai.plan === 'dribble') {
      // Take on a defender squaring up in front: a skill move away from him.
      if (p.skillCD <= 0 && p.canAct() && p.dri > 65) {
        const n = m.nearestOpp(p, 3.2);
        if (n && !n.p.isGK) {
          const dx = n.p.x - p.x, dy = n.p.y - p.y;
          if ((dx * p.fx + dy * p.fy) / n.d > 0.55 && m.rng() < dt * (0.6 + (p.dri - 70) * 0.06) * this.prof.tempo) {
            const ang = (p.fx * dy - p.fy * dx > 0 ? -1 : 1) * (0.85 + m.rng() * 0.45);
            const c = Math.cos(ang), s = Math.sin(ang);
            const ux = p.fx * c - p.fy * s, uy = p.fx * s + p.fy * c;
            m.skillMove(p, ux, uy);
            ai.dx = clamp(p.x + ux * 5, 1.5, L - 1.5);
            ai.dy = clamp(p.y + uy * 5, 1.5, W - 1.5);
            ai.sprint = true;
            ai.decideT = Math.max(ai.decideT, 0.4);
          }
        }
      }
      const d = this.moveTo(p, ai.dx, ai.dy, ai.sprint);
      if (d < 1.0) ai.decideT = Math.min(ai.decideT, 0.03);
    } else if (ai.plan === 'shield') {
      const n = m.nearestOpp(p, 6);
      if (n) {
        const ax = p.x - n.p.x, ay = p.y - n.p.y;
        const d = Math.sqrt(ax * ax + ay * ay) || 1;
        p.tvx = (ax / d) * p.jog * 0.55;
        p.tvy = (ay / d) * p.jog * 0.55;
      } else {
        p.tvx = p.tvy = 0;
      }
    } else {
      // First touch: keep moving the way we face while settling the ball.
      const sp = Math.min(p.jog * 0.8, Math.max(p.speed, 2));
      p.tvx = p.fx * sp;
      p.tvy = p.fy * sp;
    }
  }

  lossCost(lx, ly) {
    return threat(L - lx, W - ly);
  }

  // Threat at a world point, scaled by how much space there is around it.
  valueAt(x, y) {
    const t = this.t;
    let near = 99;
    for (const o of t.opp.players) {
      const d = dist(o.x, o.y, x, y);
      if (d < near) near = d;
    }
    const space = clamp((near - 1.5) / 7, 0, 1);
    return threat(t.lx(x), t.ly(y)) * (0.7 + 0.6 * space);
  }

  contactRisk(p, pr) {
    return clamp(pr * pr * (0.5 - (p.dri - 75) * 0.01), 0.02, 0.65);
  }

  // Share of the goal mouth hidden behind opponents' bodies, seen from the
  // ball (local frame: goal at lx = L). With `half` = -1 / 1 only that half
  // of the goal is considered (for picking the open corner).
  blockFactor(p, half = 0) {
    const t = this.t;
    const bx = t.lx(p.x), by = t.ly(p.y);
    if (bx > L - 0.5) return 1;
    let lo = Math.atan2(CY - GOAL_HW - by, L - bx), hi = Math.atan2(CY + GOAL_HW - by, L - bx);
    const mid = Math.atan2(CY - by, L - bx);
    if (half < 0) hi = mid;
    else if (half > 0) lo = mid;
    const iv = this.iv || (this.iv = []);
    iv.length = 0;
    for (const o of t.opp.players) {
      if (o.isGK || o.state === ST.DOWN) continue;
      const dx = t.lx(o.x) - bx, dy = t.ly(o.y) - by;
      if (dx < 0.3) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      const a = Math.atan2(dy, dx), w = Math.atan2(0.62, d);
      const s = Math.max(lo, a - w), e = Math.min(hi, a + w);
      if (e > s) iv.push([s, e]);
    }
    if (!iv.length) return 0;
    iv.sort((u, v) => u[0] - v[0]);
    let covered = 0, cs = iv[0][0], ce = iv[0][1];
    for (let i = 1; i < iv.length; i++) {
      if (iv[i][0] > ce) {
        covered += ce - cs;
        cs = iv[i][0];
        ce = iv[i][1];
      } else ce = Math.max(ce, iv[i][1]);
    }
    covered += ce - cs;
    return clamp(covered / (hi - lo), 0, 1);
  }

  decide(p, pr) {
    const m = this.m, t = this.t, prof = this.prof;
    const lx = t.lx(p.x), ly = t.ly(p.y);
    let best = null;
    const consider = (o) => {
      if (!o) return;
      o.u *= 1 + m.rng.gauss() * prof.noise * 0.35;
      if (!best || o.u > best.u) best = o;
    };
    const here = threat(lx, ly);

    const dGoal = dist(lx, ly, L, CY);
    if (dGoal < 36 && lx > 60) {
      // xgAt matches the engine's finishing, so this is an honest chance of a
      // goal; the small premium stands for rebounds and corners.
      // Pressure and a full sprint cost accuracy (see Match.shoot).
      const run = Math.min(1, p.speed / p.vmax);
      const open = (1 - this.blockFactor(p)) * (1 - pr * 0.55) * (1 - run * run * 0.25);
      consider({ kind: 'shoot', u: xgAt(lx, ly) * (0.2 + p.sho / 115) * prof.shootBias * open * 1.05 + 0.004 });
    }
    const wide = lx > 70 && Math.abs(ly - CY) > 11;
    for (const q of t.players) {
      if (q === p || q.state === ST.DOWN) continue;
      if (q.isGK && (lx > 40 || pr < 0.5)) continue;
      consider(this.evalPass(p, q, false));
      if (!q.isGK && (q.ai.runT > 0 || (q.role !== 'def' && t.lx(q.x) > lx + 4 && q.vx * t.dir > 2.5))) consider(this.evalThrough(p, q));
      if (wide && !q.isGK) consider(this.evalCross(p, q));
    }
    const contact = this.contactRisk(p, pr);
    for (let k = 0; k < DIRS.length; k++) consider(this.evalDribble(p, k, contact));
    if (lx < 30 && pr > 0.5) consider({ kind: 'clear', u: 0.012 });
    consider({ kind: 'shield', u: here * (1 - contact * 1.3) * 0.5 - contact * this.lossCost(lx, ly) * 0.5 });
    this.execute(p, best);
  }

  evalThrough(p, q) {
    const t = this.t;
    const runDir = q.speed > 1.5 ? [q.vx / q.speed, q.vy / q.speed] : [t.dir, 0];
    let best = null;
    for (const lead of [3, 6, 9, 12]) {
      let tx = q.x + runDir[0] * lead + t.dir * 1.5, ty = q.y + runDir[1] * lead;
      if (t.lx(tx) > L - 7 && Math.abs(ty - CY) < 12) tx = t.wx(L - 7);
      const o = this.evalPass(p, q, true, clamp(tx, 1.5, L - 1.5), clamp(ty, 1.5, W - 1.5));
      if (o && (!best || o.u > best.u)) best = o;
    }
    return best;
  }

  evalPass(p, q, through, ptx, pty) {
    const m = this.m, t = this.t, b = m.ball;
    let tx, ty;
    if (through) {
      tx = ptx;
      ty = pty;
    } else {
      tx = q.x + q.vx * 0.35;
      ty = q.y + q.vy * 0.35;
    }
    const d = dist(b.x, b.y, tx, ty);
    if (d < 4 || d > (through ? 44 : 38)) return null;
    const qlx = t.lx(q.x);
    if (m.settings.offside && qlx > Math.max(this.offLine, t.lx(b.x)) + 0.3 && qlx > CX) {
      if (m.rng() > this.prof.noise * 0.12) return null;
    }
    const tlx = t.lx(tx), tly = t.ly(ty);
    if (tx < 1 || tx > L - 1 || ty < 1 || ty > W - 1) return null;
    const va = through ? clamp(4 + d * 0.12, 5, 9) : clamp(8 + d * 0.2, 9, 15.5);
    const v0 = Math.min(31, groundSpeedFor(d, va));
    let risk = this.passRisk(b.x, b.y, tx, ty, v0, q, d);
    // Slow balls into space give the whole defence time to react (measured).
    if (through) risk = 1 - Math.pow(1 - risk, 1.8);
    const val = this.valueAt(tx, ty) * (q.isGK ? 0.5 : 1);
    const blx = t.lx(b.x);
    const loss = this.lossCost((blx + tlx) * 0.5, (t.ly(b.y) + tly) * 0.5) * (blx > 60 ? 0.6 : 1);
    const fwd = Math.max(0, tlx - blx) * 0.0005 * this.prof.tempo;
    const u = val * (1 - risk) + fwd * (1 - risk) - risk * loss * this.prof.risk - 0.001;
    return { kind: through ? 'through' : 'pass', q, tx, ty, u, risk };
  }

  passRisk(ax, ay, tx, ty, v0, q, d) {
    const sp = this.sp;
    // Where does the receiver meet the ball? Opponents behind that point have
    // to beat him there instead of cutting the lane.
    let sMeet = d;
    for (let k = 1; k <= 8; k++) {
      const s = (d * k) / 8;
      const tb = groundTime(v0, s);
      if (!isFinite(tb)) break;
      if (q.timeTo(ax + ((tx - ax) * s) / d, ay + ((ty - ay) * s) / d, 0.05, 0.9) <= tb) {
        sMeet = s;
        break;
      }
    }
    let risk = 0;
    for (const o of this.t.opp.players) {
      if (o.state === ST.DOWN) continue;
      segPoint(ax, ay, tx, ty, o.x, o.y, sp);
      let s = sp.t * d, px = sp.x, py = sp.y;
      if (s > sMeet) {
        s = sMeet;
        px = ax + ((tx - ax) * s) / d;
        py = ay + ((ty - ay) * s) / d;
      }
      const tb = groundTime(v0, s);
      if (!isFinite(tb)) continue;
      const to = o.timeTo(px, py, 0.22 + (o.stunT > 0 ? o.stunT : 0), o.isGK ? 1.3 : 0.9);
      const r = sigmoid((tb - to) * 6);
      if (r > risk) risk = r;
    }
    const tq = q.timeTo(tx, ty, 0.1, 0.9);
    const tball = groundTime(v0, d);
    if (isFinite(tball) && tq > tball + 0.5) risk = Math.max(risk, sigmoid((tq - tball - 0.5) * 3));
    return risk;
  }

  evalCross(p, q) {
    const t = this.t;
    const qlx = t.lx(q.x), qly = t.ly(q.y);
    if (qlx < L - 20 || Math.abs(qly - CY) > 14) return null;
    const tx = q.x + q.vx * 0.8, ty = q.y + q.vy * 0.8;
    let risk = 0;
    for (const o of t.opp.players) {
      const d = dist(o.x, o.y, tx, ty);
      const r = o.isGK ? sigmoid((4.5 - d) * 1.2) : sigmoid((2.2 - d) * 1.6) * (0.4 + o.def / 200);
      risk = Math.max(risk, r);
    }
    const u = threat(t.lx(tx), t.ly(ty)) * 0.5 * (1 - risk) * (0.6 + q.phy / 250) - risk * 0.01;
    return { kind: 'cross', q, tx, ty, u, risk };
  }

  evalDribble(p, k, contact) {
    const t = this.t, sp = this.sp;
    const gx = t.oppGoalX;
    const base = Math.atan2(CY - p.y, gx - p.x);
    const a = base + DIRS[k];
    const len = 4;
    const tx = p.x + Math.cos(a) * len, ty = p.y + Math.sin(a) * len;
    if (tx < 1.5 || tx > L - 1.5 || ty < 1.5 || ty > W - 1.5) return null;
    // A defender who gets to the path first only forces a duel, and the
    // carrier can still change course (calibrated against actual losses).
    const oppTackle = this.m.ai[t.opp.index].prof.tackle;
    let path = 0;
    for (const o of t.opp.players) {
      if (o.state === ST.DOWN) continue;
      segPoint(p.x, p.y, tx, ty, o.x, o.y, sp);
      const tp = 0.1 + (sp.t * len) / (p.vmax * 0.85);
      const to = o.timeTo(sp.x, sp.y, 0.1 + (o.stunT > 0 ? o.stunT : 0), 1.1);
      const r = sigmoid((tp - to) * 5) * clamp(0.3 + (o.def - p.dri) * 0.012, 0.08, 0.6) * oppTackle;
      if (r > path) path = r;
    }
    const risk = 1 - (1 - Math.min(0.95, path * this.prof.caution)) * (1 - contact * 0.5);
    const tlx = t.lx(tx);
    if (tlx > L - 2) return null;
    const val = this.valueAt(tx, ty);
    const plx = t.lx(p.x);
    const fwd = Math.max(0, tlx - plx) * 0.0004 * this.prof.tempo;
    const u = val * (1 - risk) + fwd * (1 - risk) - risk * this.lossCost(plx, t.ly(p.y)) * this.prof.risk * (plx > 60 ? 0.6 : 1);
    return { kind: 'dribble', tx: p.x + Math.cos(a) * 6, ty: p.y + Math.sin(a) * 6, u, risk, sprint: risk < 0.3 };
  }

  execute(p, o) {
    const m = this.m, t = this.t, ai = p.ai;
    ai.decideT = this.reactTime() * (o.kind === 'dribble' ? 1.3 : 1) * (t.lx(p.x) > 70 ? 0.75 : 1);
    ai.plan = null;
    switch (o.kind) {
      case 'shoot':
        this.aiShoot(p);
        break;
      case 'pass':
        m.passTo(p, o.q, 'pass', o.tx, o.ty);
        break;
      case 'through':
        m.passTo(p, o.q, 'through', o.tx, o.ty);
        break;
      case 'cross':
        m.passTo(p, o.q, 'cross', o.tx, o.ty);
        break;
      case 'clear': {
        let tgt = null, bl = -1;
        for (const q of t.players) {
          const ql = t.lx(q.x);
          if (!q.isGK && ql > bl) {
            bl = ql;
            tgt = q;
          }
        }
        const tx = tgt ? tgt.x + t.dir * 6 : t.wx(70);
        const ty = tgt ? tgt.y : p.y < CY ? 12 : W - 12;
        m.passTo(p, tgt, 'clear', clamp(tx, 3, L - 3), clamp(ty, 3, W - 3));
        break;
      }
      case 'dribble':
        ai.plan = 'dribble';
        ai.dx = o.tx;
        ai.dy = o.ty;
        ai.sprint = o.sprint;
        break;
      default:
        ai.plan = 'shield';
        ai.decideT = 0.22;
    }
  }

  aiShoot(p, kind) {
    const m = this.m, t = this.t;
    const gk = t.opp.gk;
    // Local-frame halves map to world sides through ly (mirrored for dir < 0).
    const ws = (h) => (t.wy(CY + h) > CY ? 1 : -1);
    let side = gk.y > CY ? -1 : 1; // far side from the keeper
    let near = m.rng() > 0.72;
    if (kind !== 'penalty') {
      // Prefer the corner that is not hidden behind a defender.
      const bl = this.blockFactor(p, -1), br = this.blockFactor(p, 1);
      if (Math.abs(bl - br) > 0.25) {
        side = ws(bl < br ? -1 : 1);
        near = false;
      }
    }
    const ty = CY + (near ? -side : side) * (GOAL_HW - 0.55 - m.rng() * 0.9);
    const lowish = m.rng() < 0.6;
    const tz = lowish ? 0.2 + m.rng() * 0.6 : 0.9 + m.rng() * 1.1;
    const gkOut = Math.abs(gk.x - t.oppGoalX) > 6;
    const dGoal = dist(p.x, p.y, t.oppGoalX, CY);
    const chip = gkOut && dGoal < 22 && dGoal > 9 && m.rng() < 0.35;
    const power = kind === 'penalty' ? 0.72 + m.rng() * 0.2 : 0.62 + m.rng() * 0.33;
    m.shoot(p, ty, tz, power, { chip, kind });
  }

  // ------------------------------------------------------------ goalkeeper
  goalkeeper(p, dt) {
    const m = this.m, t = this.t, b = m.ball;
    if (b.owner === p) return this.gkWithBall(p, dt);
    const gx = t.ownGoalX;
    if (!b.owner && m.phase === 'play' && m.possTeam !== t.index) {
      let oppBest = 99;
      for (const o of t.opp.players) if (o.icT < oppBest) oppBest = o.icT;
      let mateBest = 99;
      for (const q of t.players) if (q !== p && q.icT < mateBest) mateBest = q.icT;
      const area = t.lx(p.icX) < BOX_D + (p.gk.pos > 85 ? 6 : 2) && Math.abs(p.icY - CY) < BOX_HW + 2;
      if (area && p.icT < oppBest - 0.05 && p.icT < mateBest + 0.25) {
        this.moveTo(p, p.icX, p.icY, true);
        return;
      }
    }
    const c = b.owner;
    if (c && c.team !== t) {
      const cd = dist(c.x, c.y, gx, CY);
      if (cd < 21 && t.lx(c.x) < BOX_D + 5 && this.noDefenderBetween(c)) {
        const depth = clamp(cd * 0.42, 1.5, 9);
        const ux = (c.x - gx) / cd, uy = (c.y - CY) / cd;
        this.moveTo(p, gx + ux * depth, CY + uy * depth, true);
        const db = dist(p.x, p.y, b.x, b.y);
        const ai = p.ai;
        ai.tackleT -= dt;
        if (db < 1.8 && ai.tackleT <= 0 && p.canAct()) {
          ai.tackleT = 0.25;
          const ps = clamp(0.3 + (p.gk.div - c.dri) * 0.01 + (db < 1.2 ? 0.15 : 0), 0.08, 0.7) * this.prof.tackle;
          if (m.rng() < ps) {
            p.state = ST.DIVE;
            p.dive = { start: 0, t: 0, dur: 0.2, sx: p.x, sy: p.y, tx: b.x, ty: b.y, tz: 0, big: true, cancel: false };
            m.gainBall(p, 'catch');
          }
        }
        return;
      }
    }
    // Positioning on the ball-goal line.
    const bx = b.x, by = b.y;
    const bd = Math.max(1, dist(bx, by, gx, CY));
    const depth = clamp(0.5 + bd * 0.05, 0.5, 4.2);
    const ux = (bx - gx) / bd, uy = (by - CY) / bd;
    const tx = gx + ux * depth;
    const ty = clamp(CY + uy * depth * 1.6, CY - GOAL_HW + 0.3, CY + GOAL_HW - 0.3);
    this.moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 2.5);
  }

  noDefenderBetween(c) {
    const t = this.t;
    const clx = t.lx(c.x);
    for (const q of t.players) {
      if (q.isGK) continue;
      const qlx = t.lx(q.x);
      if (qlx < clx - 0.5 && Math.abs(q.y - c.y) < 5 + (clx - qlx) * 0.3) return false;
    }
    return true;
  }

  gkWithBall(p, dt) {
    p.tvx = 0;
    p.tvy = 0;
    if (p.state !== ST.HOLD) {
      // Ball at feet (back pass): release quickly and safely.
      p.ai.decideT -= dt;
      if (p.ai.decideT > 0) return;
      this.distribute(p, true);
      return;
    }
    const wait = p.human ? 2.6 : 1.1 + (p.idx % 3) * 0.2;
    if (p.holdT < wait) return;
    this.distribute(p, false);
  }

  distribute(p, feet) {
    const m = this.m, t = this.t;
    let best = null;
    for (const q of t.players) {
      if (q === p) continue;
      const o = this.evalPass(p, q, false);
      if (o && o.risk < (feet ? 0.35 : 0.22) && (!best || o.u > best.u)) best = o;
    }
    if (best && (feet || m.rng() < 0.7)) {
      m.passTo(p, best.q, 'pass', best.tx, best.ty);
      return;
    }
    let fwd = null, bl = -1;
    for (const q of t.players) {
      if (q.isGK) continue;
      const ql = t.lx(q.x);
      if (ql > bl && ql < 75) {
        bl = ql;
        fwd = q;
      }
    }
    const tx = fwd ? fwd.x + t.dir * 3 : t.wx(60);
    const ty = fwd ? fwd.y : CY;
    m.passTo(p, fwd, 'lob', clamp(tx, 3, L - 3), clamp(ty, 3, W - 3));
  }

  // ------------------------------------------------------------ set pieces
  setpieceMove(p, dt) {
    const m = this.m, r = m.restart;
    if (r && r.taker === p) {
      p.tvx = p.tvy = 0;
      return;
    }
    if (p.ai.hold) {
      const d = this.moveTo(p, p.ai.spx, p.ai.spy, false);
      if (d < 0.6) {
        p.tvx = 0;
        p.tvy = 0;
      }
      return;
    }
    if (p.isGK) return this.goalkeeper(p, dt);
    this.moveTo(p, p.ai.hx, p.ai.hy, false);
  }

  deadMove(p) {
    const tx = p.ai.hx, ty = p.ai.hy;
    this.moveTo(p, tx, ty, false);
    p.tvx *= 0.6;
    p.tvy *= 0.6;
  }

  takeSetpiece(p, r) {
    const m = this.m, t = this.t;
    switch (r.type) {
      case 'kickoff': {
        const q = r.partner || m.nearestMate(p);
        m.passTo(p, q, 'pass', q.x, q.y, { kind: 'kickoff' });
        return;
      }
      case 'throw': {
        let best = null;
        for (const q of t.players) {
          if (q === p || q.isGK) continue;
          if (dist(p.x, p.y, q.x, q.y) > 24) continue;
          const o = this.evalPass(p, q, false);
          if (o && (!best || o.u - o.risk * 0.02 > best.u - best.risk * 0.02)) best = o;
        }
        const q = best ? best.q : m.nearestMate(p);
        m.passTo(p, q, 'throw', q.x + q.vx * 0.3, q.y + q.vy * 0.3, { kind: 'throw' });
        return;
      }
      case 'goalkick':
        this.distribute(p, true);
        return;
      case 'corner': {
        const q = m.boxTarget(t) || m.nearestMate(p);
        const tx = q.x + m.rng.range(-1.5, 1.5), ty = q.y + m.rng.range(-1.5, 1.5);
        if (m.rng() < 0.12) {
          const n = m.nearestMate(p);
          m.passTo(p, n, 'pass', n.x, n.y, { kind: 'corner' });
        } else m.passTo(p, q, 'cross', tx, ty, { kind: 'corner' });
        return;
      }
      case 'freekick': {
        const d = dist(p.x, p.y, t.oppGoalX, CY);
        const angleOk = Math.abs(p.y - CY) < 18;
        if (d < 31 && angleOk && m.rng() < 0.7) {
          this.aiShoot(p, 'freekick');
          return;
        }
        if (d < 40 && t.lx(p.x) > CX) {
          const q = m.boxTarget(t);
          if (q) {
            m.passTo(p, q, 'cross', q.x, q.y, { kind: 'freekick' });
            return;
          }
        }
        let best = null;
        for (const q of t.players) {
          if (q === p) continue;
          const o = this.evalPass(p, q, false);
          if (o && (!best || o.u > best.u)) best = o;
        }
        if (best) m.passTo(p, best.q, 'pass', best.tx, best.ty, { kind: 'freekick' });
        else {
          const q = m.nearestMate(p);
          m.passTo(p, q, 'pass', q.x, q.y, { kind: 'freekick' });
        }
        return;
      }
      case 'penalty':
        this.aiShoot(p, 'penalty');
        return;
      default:
        break;
    }
  }
}

export { PEN_D };
