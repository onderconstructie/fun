// Special modes on top of the match engine:
//  - AttackDuel: you only play your attacks; the opponent's attacks are simulated.
//  - Shootout: a penalty shootout (5 each, then sudden death).

import { L, W, CX, CY, CIRCLE_R, BOX_D } from './constants.js';
import { ST } from './player.js';
import { clamp } from '../util.js';

const DIFF_MOD = { amateur: -0.1, pro: 0, wereldklasse: 0.06, legende: 0.12 };

function avg(list) {
  return list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
}

export class AttackDuel {
  constructor(m, rounds, difficulty) {
    this.m = m;
    this.rounds = rounds;
    this.round = 0; // completed user attacks
    this.difficulty = difficulty;
    this.active = false;
    this.t = 0;
    this.lostT = 0;
    this.log = [];
    this.label = '';
    m.attack = this;
    m.attackTick = (dt) => this.tick(dt);
    m.endAttackRound = (reason) => this.end(reason);
  }

  minute(k) {
    return Math.max(1, Math.round(((k + 0.5) * 90) / this.rounds));
  }

  setupRound() {
    const m = this.m, rng = m.rng;
    const us = m.teams[0], them = m.teams[1];
    const lx0 = rng.range(44, 60);
    const ly0 = rng.pick([16, 34, 52]) + rng.range(-5, 5);
    for (const p of m.players) {
      p.reset(p.x, p.y);
      p.human = false;
    }
    m.controlled = null;
    for (const p of us.players) {
      let lx, ly;
      if (p.isGK) {
        lx = 6;
        ly = CY;
      } else {
        const s = p.slot;
        lx = clamp(lx0 - 16 + s.d * 36, 20, 86);
        ly = clamp(s.l * W * 0.8 + ly0 * 0.2 + (s.l - 0.5) * 6, 4, W - 4);
      }
      p.x = us.wx(lx);
      p.y = us.wy(ly);
      p.fx = us.dir;
      p.fy = 0;
    }
    for (const p of them.players) {
      let lx, ly;
      if (p.isGK) {
        lx = 2.5;
        ly = CY;
      } else {
        const s = p.slot;
        // Their local frame: back line ~24 m from their goal, compact block.
        lx = clamp(22 + s.d * 26 + rng.range(-2, 2), 16, 55);
        ly = clamp(CY + (s.l * W - CY) * 0.72 + (them.ly(us.wy(ly0)) - CY) * 0.35, 4, W - 4);
      }
      p.x = them.wx(lx);
      p.y = them.wy(ly);
      p.fx = them.dir;
      p.fy = 0;
    }
    // Ball to the midfielder closest to the start spot.
    let carrier = null, bd = 1e9;
    for (const p of us.players) {
      if (p.isGK || p.role === 'def') continue;
      const d = Math.hypot(us.lx(p.x) - lx0, us.ly(p.y) - ly0);
      if (d < bd) {
        bd = d;
        carrier = p;
      }
    }
    carrier.x = us.wx(lx0);
    carrier.y = us.wy(ly0);
    for (const p of m.players) {
      p.px = p.x;
      p.py = p.y;
    }
    const b = m.ball;
    b.reset(carrier.x + us.dir * 0.6, carrier.y);
    m.phase = 'play';
    m.phaseT = 0;
    m.restart = null;
    m.plan = null;
    m.offside = null;
    m.pendingPass = null;
    m.gainBall(carrier, 'control');
    m.setControlled(carrier);
    m.time = this.minute(this.round) * 60;
    this.t = 24;
    this.lostT = 0;
    this.active = true;
    this.label = `AANVAL ${this.round + 1}/${this.rounds}`;
    m.emit('cut');
    m.emit('banner', { text: `Aanval ${this.round + 1} van ${this.rounds}` });
  }

  tick(dt) {
    if (!this.active) return;
    const m = this.m;
    this.t -= dt;
    this.label = `AANVAL ${this.round + 1}/${this.rounds} · ${Math.max(0, Math.ceil(this.t))}s`;
    if (m.phase === 'goal') return;
    if (m.phase === 'dead') {
      const r = m.restart;
      if (r && r.team === 0 && (r.type === 'corner' || r.type === 'freekick' || r.type === 'penalty')) {
        this.t = Math.max(this.t, 12);
        return;
      }
      this.end('out');
      return;
    }
    if (m.possTeam === 1 || (m.ball.owner && m.ball.owner.team.index === 1)) {
      this.lostT += dt;
      if (this.lostT > 1.1 || (m.ball.owner && m.ball.owner.isGK)) {
        this.end('lost');
        return;
      }
    } else this.lostT = 0;
    const shotInFlight = !m.ball.owner && m.ball.kick && m.ball.kick.shot;
    if (this.t <= 0 && m.phase === 'play' && !shotInFlight) this.end('time');
  }

  end(reason) {
    if (!this.active) return;
    this.active = false;
    this.round++;
    const m = this.m;
    m.phase = 'roundover';
    m.phaseT = 0;
    m.emit('roundEnd', { reason });
  }

  // Simulate the opponent's attack. Returns a result object for the UI.
  opponentAttack() {
    const m = this.m, rng = m.rng;
    const us = m.teams[0], them = m.teams[1];
    const att = them.players.filter((p) => p.role === 'att' || p.pos === 'CAM').map((p) => p.ovr);
    const def = us.players.filter((p) => p.role === 'def' || p.isGK).map((p) => p.ovr);
    const p = clamp(0.3 + (avg(att) - avg(def)) / 60 + (DIFF_MOD[this.difficulty] || 0), 0.12, 0.62);
    const shooters = them.players.filter((q) => !q.isGK);
    const weights = shooters.map((q) => Math.pow(q.sho, 3) * (q.role === 'att' ? 2 : q.role === 'mid' ? 1 : 0.3));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    let scorer = shooters[0];
    for (let i = 0; i < shooters.length; i++) {
      if ((r -= weights[i]) <= 0) {
        scorer = shooters[i];
        break;
      }
    }
    const goal = rng() < p;
    const minute = this.minute(this.round - 0.5);
    const kinds = ['schiet van afstand', 'krult hem richting de hoek', 'kopt op doel', 'gaat alleen op de keeper af', 'schiet in de rebound'];
    const how = kinds[Math.floor(rng() * kinds.length)];
    if (goal) {
      them.score++;
      m.goals.push({ team: 1, scorer, own: false, assist: null, minute: `${minute}'`, time: minute * 60, score: [us.score, them.score] });
    }
    return { goal, scorer, keeper: us.gk, minute, how, p };
  }

  get finished() {
    return this.round >= this.rounds;
  }
}

export class Shootout {
  constructor(m, onEnd) {
    this.m = m;
    this.onEnd = onEnd;
    this.kicks = [[], []];
    this.turn = 0;
    this.state = 'idle';
    this.t = 0;
    this.order = m.teams.map((t) =>
      t.players
        .filter((p) => !p.isGK)
        .sort((a, b) => b.sho + b.ovr * 0.3 - (a.sho + a.ovr * 0.3)),
    );
    this.idx = [0, 0];
    this.finished = false;
    m.pens = this;
    m.teams[0].score = 0;
    m.teams[1].score = 0;
    m.attack = null;
  }

  get label() {
    return `STRAFSCHOPPEN`;
  }

  score(i) {
    return this.kicks[i].filter(Boolean).length;
  }

  setupKick() {
    const m = this.m;
    const team = m.teams[this.turn];
    const taker = this.order[this.turn][this.idx[this.turn] % this.order[this.turn].length];
    this.idx[this.turn]++;
    // Everyone else waits in the centre circle.
    let k = 0;
    for (const p of m.players) {
      p.state = ST.RUN;
      p.stateT = 0;
      p.dive = null;
      p.z = 0;
      p.vx = p.vy = 0;
      p.touchCD = 0;
      p.human = false;
      p.aiDriven = null;
      const a = (k++ / 20) * Math.PI * 2;
      p.x = CX + Math.cos(a) * (CIRCLE_R - 2);
      p.y = CY + Math.sin(a) * (CIRCLE_R - 2);
      p.px = p.x;
      p.py = p.y;
      p.ai.hold = true;
      p.ai.spx = p.x;
      p.ai.spy = p.y;
    }
    m.controlled = null;
    m.phase = 'dead';
    m.restart = { type: 'penalty', team: this.turn, x: team.wx(L - 11), y: CY };
    this.spotX = m.restart.x;
    m.setupRestart();
    // setupRestart picked the best shooter; use the rota instead.
    const r = m.restart;
    if (r.taker !== taker) {
      const old = r.taker;
      [old.x, old.y, taker.x, taker.y] = [taker.x, taker.y, old.x, old.y];
      taker.fx = team.dir;
      taker.fy = 0;
      old.px = old.x;
      old.py = old.y;
      taker.px = taker.x;
      taker.py = taker.y;
      r.taker = taker;
      if (m.human === this.turn) m.setControlled(taker);
    }
    r.wait = m.human === this.turn ? 30 : 2.2;
    this.state = 'waiting';
    this.t = 0;
    this.taker = taker;
    m.emit('pen', { team: this.turn, taker });
  }

  tick(dt) {
    const m = this.m;
    if (this.finished) return;
    this.t += dt;
    if (this.state === 'waiting') {
      if (m.phase === 'play') {
        this.state = 'flight';
        this.t = 0;
      }
      return;
    }
    if (this.state === 'flight') {
      const b = m.ball;
      let result = null;
      if (m.phase === 'goal') result = true;
      else if (m.phase === 'dead') result = false;
      else if (b.owner && b.owner.isGK) result = false;
      else if (this.t > 2.6) result = false;
      else if (this.t > 1.2 && b.hspeed < 2 && Math.abs(b.x - m.teams[this.turn].oppGoalX) > 1) result = false;
      if (result !== null) {
        this.kicks[this.turn].push(result);
        this.state = 'result';
        this.t = 0;
        m.emit('penResult', { team: this.turn, scored: result });
      }
      return;
    }
    if (this.state === 'result' && this.t > 1.9) this.next();
  }

  // Is the shootout decided?
  decided() {
    const [a, b] = this.kicks;
    const sa = this.score(0), sb = this.score(1);
    const na = a.length, nb = b.length;
    if (na <= 5 && nb <= 5) {
      const remA = 5 - na, remB = 5 - nb;
      if (sa > sb + remB) return true;
      if (sb > sa + remA) return true;
      if (na === 5 && nb === 5) return sa !== sb;
      return false;
    }
    return na === nb && sa !== sb;
  }

  next() {
    if (this.decided()) {
      this.finished = true;
      this.state = 'done';
      const m = this.m;
      m.teams[0].score = this.score(0);
      m.teams[1].score = this.score(1);
      m.phase = 'fulltime';
      m.emit('whistle', { kind: 'end' });
      m.emit('fulltime', { pens: true });
      if (this.onEnd) this.onEnd(this);
      return;
    }
    this.turn = 1 - this.turn;
    this.setupKick();
  }
}

export { BOX_D };
