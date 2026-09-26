// A player on the pitch: attributes derived from the card, kinematic state and
// animation state. Behaviour lives in ai.js / match.js.

import { positionPenalty, roleOf } from '../data/formations.js';

export const ST = {
  RUN: 0,
  KICK: 1,
  TACKLE: 2,
  SLIDE: 3,
  DOWN: 4,
  DIVE: 5,
  CELEBRATE: 6,
  HEADER: 7,
  THROW: 8,
  HOLD: 9,
};

export class Player {
  constructor(team, idx, card, slot) {
    this.team = team;
    this.idx = idx;
    this.card = card;
    this.slot = slot;
    this.id = card.id;
    this.name = card.short;
    this.pos = slot.pos;
    this.role = roleOf(slot.pos);
    this.isGK = slot.pos === 'GK';
    this.number = 0;

    const penalty = positionPenalty(card.pos, card.alt, slot.pos);
    this.ovr = Math.max(1, card.ovr - penalty);
    const s = card.stats;
    const cardIsGK = card.pos === 'GK';
    const pen = (v) => Math.max(20, v - penalty * 0.6);
    if (cardIsGK) {
      this.gk = { div: s[0], han: s[1], kic: s[2], ref: s[3], spd: s[4], pos: s[5] };
      this.pac = pen(s[4]);
      this.sho = pen(30);
      this.pas = pen(s[2] * 0.82);
      this.dri = pen(40);
      this.def = pen(40);
      this.phy = pen(70);
    } else {
      this.pac = pen(s[0]);
      this.sho = pen(s[1]);
      this.pas = pen(s[2]);
      this.dri = pen(s[3]);
      this.def = pen(s[4]);
      this.phy = pen(s[5]);
      // An outfield player forced in goal is poor at it.
      this.gk = { div: 38, han: 35, kic: this.pas * 0.6, ref: 40, spd: this.pac * 0.7, pos: 35 };
    }

    this.vmax = 6.0 + ((this.pac - 40) * 3.2) / 59;
    if (this.isGK) this.vmax = 5.6 + ((this.gk.spd - 30) * 2.2) / 60;
    this.jog = this.vmax * 0.74;
    this.accel = 7.8 + (this.pac - 50) * 0.06 + (this.dri - 50) * 0.02;

    this.reset(0, 0);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vz = 0;
    this.vx = 0;
    this.vy = 0;
    this.px = x;
    this.py = y;
    this.pz = 0;
    this.fx = this.team ? this.team.dir : 1;
    this.fy = 0;
    this.tvx = 0; // desired velocity (set by AI / human each step)
    this.tvy = 0;
    this.sprinting = false;
    this.state = ST.RUN;
    this.stateT = 0;
    this.anim = Math.random() * 6;
    this.kickT = 0; // kick animation timer
    this.touchCD = 0; // cannot touch the ball while > 0
    this.tackleCD = 0;
    this.stunT = 0; // beaten / wrong-footed: slower reactions
    this.skillT = 0;
    this.skillCD = 0;
    this.holdT = 0;
    this.dribblePhase = 0;
    this.buffer = null; // human first-time action
    this.bufferT = 0;
    this.dive = null; // goalkeeper dive plan
    this.slideHit = false;
    this.yellow = 0;
    this.human = false;
    this.ai = {
      hx: x, hy: y, // formation home
      tx: x, ty: y, // current target
      mode: 'shape',
      decideT: 0,
      runT: 0,
      runCD: 0,
      rx: 0, ry: 0, // run target
      spaceT: 0,
      sx: 0, sy: 0, // support spot
      dribT: 0,
      dx: 0, dy: 0, // dribble target
      mark: null,
      tackleT: 0,
      plan: null,
      holdT: 0,
    };
    this.icT = 99; // time to intercept the ball
    this.icX = x;
    this.icY = y;
  }

  get speed() {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  // Seconds to get within `reach` of (x, y), accounting for current velocity
  // (sideways momentum has to be turned first), acceleration and top speed.
  timeTo(x, y, react = 0, reach = 0) {
    const dx = x - this.x, dy = y - this.y;
    const d0 = Math.sqrt(dx * dx + dy * dy);
    const d = d0 - reach;
    if (d <= 0) return react;
    const ux = dx / d0, uy = dy / d0;
    const va = this.vx * ux + this.vy * uy; // speed towards the point
    const vp = Math.abs(this.vx * uy - this.vy * ux); // sideways
    const v = this.vmax;
    // Braking (moving away) is quicker than accelerating.
    const a = this.accel * (va < 0 ? 1 - (0.7 * va) / (v - va) : 1);
    // movePlayers steers the velocity straight to v·u at rate a: the speed
    // along u ramps from va to v over T1 while the sideways drift dies out.
    const dv = Math.sqrt((v - va) * (v - va) + vp * vp);
    if (dv < 1e-3) return react + d / v;
    const T1 = dv / a;
    const s1 = ((va + v) / 2) * T1;
    if (d >= s1) {
      const drift = (vp * T1) / 2;
      return react + T1 + Math.sqrt((d - s1) * (d - s1) + drift * drift) / v;
    }
    const k = ((v - va) * a) / (2 * dv);
    const t = k < 1e-4 ? d / Math.max(0.1, va) : (Math.sqrt(va * va + 4 * k * d) - va) / (2 * k);
    return react + t + (vp * t - (vp * t * t) / (2 * T1)) / v;
  }

  canAct() {
    return this.state === ST.RUN || this.state === ST.KICK || this.state === ST.HOLD;
  }

  savePrev() {
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
  }
}
