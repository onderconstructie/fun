// Match simulation: flow, rules, restarts, possession, kicks, tackles,
// goalkeeper saves, human control and statistics. DOM-free.

import {
  L, W, CX, CY, GOAL_HW, GOAL_H, BALL_R, BOX_D, BOX_HW, PEN_D, CIRCLE_R, STEP, HALF_GAME_SECONDS,
} from './constants.js';
import { Ball, stepBall, predictBall } from './ball.js';
import { Player, ST } from './player.js';
import { groundSpeedFor, solveAerial, loftTime } from './kick.js';
import { TeamAI, PROFILES } from './ai.js';
import { FORMATIONS } from '../data/formations.js';
import { GK_COLORS } from '../data/nations.js';
import { clamp, dist, len, makeRng, sigmoid, rotateToward, colorDistance, segPoint } from '../util.js';

const PRED_N = 40; // prediction samples
const PRED_DT = 0.1;
const PASS_KINDS = new Set(['pass', 'through', 'lob', 'cross', 'throw', 'goalkick', 'corner', 'kickoff', 'freekick']);

class Team {
  constructor(match, index, def, dir, kit) {
    this.match = match;
    this.index = index;
    this.def = def;
    this.dir = dir; // +1: attacks towards x = L
    this.kit = kit;
    this.name = def.name;
    this.short = def.short;
    this.score = 0;
    this.stats = {
      shots: 0, onTarget: 0, passes: 0, passesDone: 0, tackles: 0, fouls: 0,
      corners: 0, offsides: 0, saves: 0, possession: 0, yellow: 0,
    };
    const slots = FORMATIONS[def.formation];
    this.players = def.lineup.map((card, i) => new Player(this, i, card, slots[i]));
    const numbers = { GK: 1, RB: 2, LB: 3, CB: 4, CDM: 6, CM: 8, CAM: 10, LM: 11, RM: 7, LW: 11, RW: 7, ST: 9 };
    const used = new Set();
    for (const p of this.players) {
      let n = numbers[p.pos] || 12;
      while (used.has(n)) n = n === 4 ? 5 : n + 12 > 99 ? n + 1 : n + 10;
      used.add(n);
      p.number = n;
    }
    this.opp = null;
  }

  get gk() {
    return this.players[0];
  }
  get ownGoalX() {
    return this.dir > 0 ? 0 : L;
  }
  get oppGoalX() {
    return this.dir > 0 ? L : 0;
  }
  lx(x) {
    return this.dir > 0 ? x : L - x;
  }
  ly(y) {
    return this.dir > 0 ? y : W - y;
  }
  wx(lx) {
    return this.dir > 0 ? lx : L - lx;
  }
  wy(ly) {
    return this.dir > 0 ? ly : W - ly;
  }
}

export class Match {
  constructor(opts) {
    this.opts = opts;
    this.mode = opts.mode || 'match';
    this.rng = makeRng(opts.seed ?? (Math.random() * 2 ** 31) | 0);
    this.settings = Object.assign({ autoSwitch: true, assist: true, offside: true, halfSeconds: 150 }, opts.settings || {});
    this.human = opts.humanSide ?? null; // team index controlled by the user, or null
    this.ball = new Ball();

    const homeKit = opts.home.kits.home;
    let awayKit = opts.away.kits.home;
    if (colorDistance(homeKit.shirt, awayKit.shirt) < 170) awayKit = opts.away.kits.away;
    if (colorDistance(homeKit.shirt, awayKit.shirt) < 170) awayKit = { ...awayKit, shirt: '#f2f2f2', shorts: '#222222', socks: '#f2f2f2' };
    this.teams = [new Team(this, 0, opts.home, 1, homeKit), new Team(this, 1, opts.away, -1, awayKit)];
    this.teams[0].opp = this.teams[1];
    this.teams[1].opp = this.teams[0];
    // Goalkeeper colours distinct from both outfield kits.
    const used = [];
    for (const t of this.teams) {
      let best = GK_COLORS[0], bestD = -1;
      for (const c of GK_COLORS) {
        if (used.includes(c)) continue;
        const d = Math.min(colorDistance(c, homeKit.shirt), colorDistance(c, awayKit.shirt));
        if (d > bestD) {
          bestD = d;
          best = c;
        }
      }
      used.push(best);
      t.gkColor = best;
    }
    this.players = [...this.teams[0].players, ...this.teams[1].players];

    const diff = PROFILES[opts.difficulty || 'pro'] || PROFILES.pro;
    this.ai = this.teams.map((t) => new TeamAI(this, t, this.human === t.index ? PROFILES.mate : this.human === null ? PROFILES[opts.aiLevel || 'wereldklasse'] : diff));

    this.pred = new Float32Array(PRED_N * 3);
    this.predVersion = -1;
    this.icTimer = 0;
    this.events = [];
    this.time = 0; // game clock, seconds
    this.half = 1;
    this.realScale = HALF_GAME_SECONDS / this.settings.halfSeconds;
    this.stoppage = [60 + ((this.rng() * 3) | 0) * 60, 60 + ((this.rng() * 4) | 0) * 60];
    this.halfEnd = HALF_GAME_SECONDS + this.stoppage[0];
    this.overtimeReal = 0;
    this.phase = 'kickoff';
    this.phaseT = 0;
    this.restart = null;
    this.possTeam = -1;
    this.possT = 0;
    this.offside = null;
    this.pendingPass = null;
    this.plan = null;
    this.planVersion = -1;
    this.goals = [];
    this.cards = [];
    this.controlled = null;
    this.frame = 0;
    this.goalInfo = null;
    this.holdGoal = false; // UI sets while showing replay
    this.kickoffTeam = 0;
    this.firstKickoff = opts.firstKickoff ?? (this.rng() < 0.5 ? 0 : 1);
    this.switchT = 0;
    this.lastSwitchIdx = 0;
    this.humanIdle = 0;
    this.recorder = null;
    this.userPressing = false;
    this.attack = null; // VS-attack mode state

    if (this.mode === 'match') this.setupKickoff(this.firstKickoff);
  }

  // ---------------------------------------------------------------- events
  emit(type, data = {}) {
    data.type = type;
    this.events.push(data);
    if (this.events.length > 200) this.events.shift();
  }

  modeLabel() {
    if (this.pens) return this.pens.label;
    if (this.attack) return this.attack.label;
    return this.clockText();
  }

  get minute() {
    return Math.floor(this.time / 60) + 1;
  }

  clockText() {
    const base = this.half === 1 ? HALF_GAME_SECONDS : 2 * HALF_GAME_SECONDS;
    if (this.time >= base) {
      const extra = Math.floor((this.time - base) / 60) + 1;
      return `${base / 60}+${extra}`;
    }
    const s = Math.floor(this.time);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------- queries
  teamOf(p) {
    return p.team;
  }

  inBox(team, x, y) {
    // Is (x, y) inside the penalty area that `team` defends?
    const lx = team.lx(x);
    return lx < BOX_D && Math.abs(y - CY) < BOX_HW;
  }

  nearestOpp(p, maxD = 99) {
    let best = null, bd = maxD;
    for (const o of p.team.opp.players) {
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best ? { p: best, d: bd } : null;
  }

  pressureOn(p) {
    let pr = 0;
    for (const o of p.team.opp.players) {
      if (o.state === ST.DOWN) continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < 5) pr = Math.max(pr, 1 - (d - 0.8) / 4.2);
    }
    return clamp(pr, 0, 1);
  }

  get userAttacking() {
    if (this.human === null) return false;
    const b = this.ball;
    if (this.phase === 'setpiece' || this.phase === 'kickoff') return this.restart && this.restart.team === this.human;
    if (b.owner) return b.owner.team.index === this.human;
    return this.possTeam === this.human;
  }

  // ---------------------------------------------------------------- main loop
  step(dt, input) {
    this.frame++;
    const b = this.ball;
    b.px = b.x;
    b.py = b.y;
    b.pz = b.z;
    for (const p of this.players) p.savePrev();

    this.phaseT += dt;
    switch (this.phase) {
      case 'halftime':
      case 'fulltime':
      case 'roundover':
        this.idle(dt);
        return;
      case 'goal':
        this.goalStep(dt);
        this.movePlayers(dt);
        if (!b.owner) stepBall(b, dt, null);
        if (this.pens) this.pens.tick(dt);
        this.record();
        return;
      default:
        break;
    }

    if (this.phase === 'play') {
      this.time += dt * this.realScale;
      this.possT += dt;
      if (this.possTeam >= 0) this.teams[this.possTeam].stats.possession += dt;
    }
    if (this.attack) this.attackTick(dt);

    this.updateIntercepts(dt);
    this.updateHuman(input, dt);
    if (!this.pens) {
      this.ai[0].tick(dt);
      this.ai[1].tick(dt);
    } else {
      for (const p of this.players) {
        if (!p.human) {
          p.tvx = 0;
          p.tvy = 0;
        }
      }
    }
    this.movePlayers(dt);
    this.updateBall(dt);
    if (this.pens) this.pens.tick(dt);

    if (this.phase === 'dead' && this.phaseT > 0.9 && !this.pens) this.setupRestart();
    if (this.phase === 'setpiece' || this.phase === 'kickoff') this.setpieceTick(dt);
    if (this.mode === 'match') this.checkClock(dt);
    this.record();
  }

  idle(dt) {
    for (const p of this.players) {
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.speed > 0.3) p.anim += dt * (4.6 + p.speed * 1.05);
    }
  }

  record() {
    if (this.recorder) this.recorder.capture(this);
  }

  checkClock(dt) {
    if (this.phase !== 'play' && this.phase !== 'dead' && this.phase !== 'setpiece') return;
    if (this.time < this.halfEnd) return;
    // Let a dangerous attack finish (max 6 real seconds).
    const b = this.ball;
    let danger = false;
    if (this.phase === 'play') {
      for (const t of this.teams) {
        if (t.lx(b.x) > L - 30 && (this.possTeam === t.index || this.possTeam === -1)) danger = true;
      }
    }
    this.overtimeReal += dt;
    if (danger && this.overtimeReal < 6) return;
    this.overtimeReal = 0;
    if (this.half === 1) {
      this.phase = 'halftime';
      this.phaseT = 0;
      this.emit('whistle', { kind: 'double' });
      this.emit('halftime');
    } else {
      this.phase = 'fulltime';
      this.phaseT = 0;
      this.emit('whistle', { kind: 'end' });
      this.emit('fulltime');
    }
  }

  resume() {
    if (this.phase === 'halftime') {
      this.half = 2;
      this.time = HALF_GAME_SECONDS;
      this.halfEnd = 2 * HALF_GAME_SECONDS + this.stoppage[1];
      this.setupKickoff(1 - this.firstKickoff);
    }
  }

  // ---------------------------------------------------------------- intercepts
  updateIntercepts(dt) {
    this.icTimer -= dt;
    const b = this.ball;
    if (this.icTimer > 0 && b.version === this.predVersion) return;
    this.icTimer = 0.1;
    this.predVersion = b.version;
    const pred = this.pred;
    if (b.owner) {
      // Earliest time each player can get in front of the carrier on his
      // current run (goal side, for opponents): a defender chasing from
      // behind never does, one ahead of the run steps in.
      const c = b.owner;
      const og = c.team.opp.ownGoalX;
      const gl = Math.max(1, dist(c.x, c.y, og, CY));
      const gx = (og - c.x) / gl, gy = (CY - c.y) / gl;
      for (const p of this.players) {
        if (p === c) {
          p.icT = 0;
          p.icX = c.x;
          p.icY = c.y;
          continue;
        }
        const ahead = p.team === c.team ? 0 : 1.1;
        let t = 0, x = c.x, y = c.y;
        for (; t < 3; t += 0.15) {
          x = clamp(c.x + c.vx * t, 0.5, L - 0.5);
          y = clamp(c.y + c.vy * t, 0.5, W - 0.5);
          if (p.timeTo(x + gx * ahead, y + gy * ahead, 0.1, 0.6) <= t) break;
        }
        p.icT = t < 3 ? t : 3 + dist(p.x, p.y, x, y) / p.vmax;
        p.icX = x;
        p.icY = y;
      }
      return;
    }
    predictBall(b, pred, PRED_N, PRED_DT);
    const target = b.kick ? b.kick.target : null;
    for (const p of this.players) {
      // Players already committed to the ball do not pay the reaction delay again.
      const committed = p === target || p.ai.mode === 'chase' || p.ai.mode === 'receive';
      const react = (committed ? 0.03 : 0.18) + (p.stunT > 0 ? p.stunT : 0) + (p.state === ST.DOWN || p.state === ST.SLIDE ? 0.6 : 0);
      const hands = p.isGK && this.inBox(p.team, p.x, p.y);
      const zmax = hands ? 2.6 : 2.4;
      let found = false;
      // current position counts as t = 0
      const d0 = dist(p.x, p.y, b.x, b.y);
      if (d0 < 0.9 && b.z < zmax) {
        p.icT = 0;
        p.icX = b.x;
        p.icY = b.y;
        continue;
      }
      for (let i = 0; i < PRED_N; i++) {
        const t = (i + 1) * PRED_DT;
        const bx = pred[i * 3], by = pred[i * 3 + 1], bz = pred[i * 3 + 2];
        if (bz > zmax) continue;
        if (bx < -1 || bx > L + 1 || by < -1 || by > W + 1) break;
        const need = p.timeTo(bx, by, react, bz > 1.5 ? 0.5 : 0.7);
        if (need <= t) {
          p.icT = t;
          p.icX = bx;
          p.icY = by;
          found = true;
          break;
        }
      }
      if (!found) {
        const i = PRED_N - 1;
        let bx = clamp(pred[i * 3], 0.5, L - 0.5), by = clamp(pred[i * 3 + 1], 0.5, W - 0.5);
        p.icX = bx;
        p.icY = by;
        p.icT = Math.max(PRED_N * PRED_DT, p.timeTo(bx, by, react));
      }
    }
  }

  // ---------------------------------------------------------------- human control
  setControlled(p) {
    if (this.controlled === p) return p;
    if (this.controlled) {
      this.controlled.human = false;
      this.controlled.aiDriven = null;
    }
    this.controlled = p;
    if (p) {
      p.human = true;
      p.aiDriven = null;
      p.ai.decideT = 0;
      this.emit('switch', { player: p });
    }
    return p;
  }

  bestDefender(team, exclude = null) {
    const b = this.ball;
    const tx = b.owner ? b.owner.x + b.owner.vx * 0.4 : b.x + b.vx * 0.4;
    const ty = b.owner ? b.owner.y + b.owner.vy * 0.4 : b.y + b.vy * 0.4;
    let best = null, bs = 1e9;
    for (const p of team.players) {
      if (p === exclude || (p.isGK && !this.inBox(team, tx, ty))) continue;
      if (p.state === ST.DOWN) continue;
      let s = b.owner ? dist(p.x, p.y, tx, ty) / p.vmax : p.icT;
      if (team.lx(p.x) < team.lx(tx)) s -= 0.35; // goal-side
      if (s < bs) {
        bs = s;
        best = p;
      }
    }
    return best;
  }

  updateHuman(input, dt) {
    if (this.human === null) return;
    const team = this.teams[this.human];
    const b = this.ball;
    if (!this.controlled) this.setControlled(this.bestDefender(team));

    // Auto-switch in defence when the controlled player is far out of the play.
    this.switchT -= dt;
    if (this.settings.autoSwitch && !b.owner && this.possTeam !== this.human && this.switchT <= 0 && this.phase === 'play') {
      const cur = this.controlled;
      const best = this.bestDefender(team);
      if (best && best !== cur && cur.icT > best.icT + 0.9 && this.humanIdle > 0.25) {
        this.setControlled(best);
        this.switchT = 0.8;
      }
    }

    if (input) {
      this.lastInput = input;
      for (const a of input.actions) this.humanAction(this.controlled, a, input);
      input.actions.length = 0;
    }
    const p = this.controlled;
    if (!p) return;
    // A keeper left holding the ball releases it automatically.
    if (b.owner === p && p.state === ST.HOLD && p.holdT > 3.2 && this.phase === 'play') {
      this.ai[p.team.index].distribute(p, false);
      return;
    }

    const mx = input ? input.mx : 0, my = input ? input.my : 0;
    const mag = Math.min(1, Math.sqrt(mx * mx + my * my));
    const setpieceTaker = (this.phase === 'setpiece' || this.phase === 'kickoff') && this.restart && this.restart.taker === p;
    if (setpieceTaker) {
      if (mag > 0.25) {
        const r = this.restart;
        r.aimed = true;
        r.aimX = mx / mag;
        r.aimY = my / mag;
        // Penalty takers keep facing the goal; others turn to the aim.
        if (r.type !== 'penalty') {
          p.fx = mx / mag;
          p.fy = my / mag;
        }
      }
      p.tvx = p.tvy = 0;
      this.humanIdle = 0;
      return;
    }
    if (this.phase === 'setpiece' || this.phase === 'kickoff' || this.pens) {
      p.tvx = p.tvy = 0;
      return;
    }
    if (p.state === ST.HOLD) {
      // Goalkeeper holding: joystick aims the throw.
      if (mag > 0.25) {
        p.fx = mx / mag;
        p.fy = my / mag;
      }
      p.tvx = p.tvy = 0;
      return;
    }
    if (this.passAssist) {
      const inFlight = !b.owner && b.kick && b.kick.target === p;
      const sj = this.switchJoy;
      const moved = (mx - sj.mx) ** 2 + (my - sj.my) ** 2 > 0.35;
      if (!inFlight || moved) this.passAssist = false;
      else {
        p.aiDriven = 'assist';
        this.humanIdle = 0;
        return;
      }
    }
    const pressHeld = input && input.press && b.owner !== p;
    if (mag > 0.12) {
      this.humanIdle = 0;
      const sprint = (input && input.sprint) || mag > 0.93;
      const speed = sprint ? p.vmax : p.jog * Math.min(1, 0.25 + (mag / 0.93) * 0.75);
      p.tvx = (mx / mag) * speed;
      p.tvy = (my / mag) * speed;
      p.sprinting = sprint;
      p.aiDriven = pressHeld ? 'press' : null;
      if (pressHeld) this.userPressing = true;
    } else {
      this.humanIdle += dt;
      p.tvx = 0;
      p.tvy = 0;
      p.sprinting = false;
      const defending = b.owner ? b.owner.team !== p.team : this.possTeam !== this.human;
      if (pressHeld) p.aiDriven = 'press';
      else if (this.settings.assist && defending && this.humanIdle > 0.45) p.aiDriven = 'assist';
      else if (b.owner !== p && !defending && this.humanIdle > 0.6 && b.kick && b.kick.target === p) p.aiDriven = 'assist';
      else p.aiDriven = null;
    }
    this.userPressing = !!pressHeld;
  }

  humanAction(p, a, input) {
    if (!p) return;
    const b = this.ball;
    if (this.phase === 'setpiece' || this.phase === 'kickoff') {
      if (this.restart && this.restart.taker === p) this.humanSetpiece(p, a, input);
      return;
    }
    if (this.phase !== 'play') return;
    switch (a.type) {
      case 'pass':
      case 'through':
      case 'shoot':
        if (b.owner === p) this.humanKick(p, a, input);
        else {
          p.buffer = a;
          p.bufferT = 0.85;
          p.bufferMx = input ? input.mx : 0;
          p.bufferMy = input ? input.my : 0;
        }
        break;
      case 'switch':
        this.manualSwitch();
        break;
      case 'tackle':
        this.tackle(p, !!a.slide);
        break;
      case 'skill':
        if (b.owner === p) this.skillMove(p, a.dx, a.dy);
        break;
      default:
        break;
    }
  }

  manualSwitch() {
    const team = this.teams[this.human];
    const cur = this.controlled;
    const ranked = team.players
      .filter((p) => p !== cur && !p.isGK && p.state !== ST.DOWN)
      .map((p) => {
        const b = this.ball;
        const tx = b.owner ? b.owner.x : p.icX, ty = b.owner ? b.owner.y : p.icY;
        let s = b.owner ? dist(p.x, p.y, tx, ty) / p.vmax : p.icT;
        if (team.lx(p.x) < team.lx(b.x)) s -= 0.3;
        return { p, s };
      })
      .sort((a, b) => a.s - b.s);
    if (!ranked.length) return;
    const quick = this.frame - (this.lastSwitchFrame || -999) < 50;
    this.lastSwitchIdx = quick ? (this.lastSwitchIdx + 1) % Math.min(3, ranked.length) : 0;
    this.lastSwitchFrame = this.frame;
    this.setControlled(ranked[this.lastSwitchIdx].p);
    this.switchT = 1.2;
  }

  // Direction for a human kick: joystick if pushed, else facing.
  aimDir(p, input, mx, my) {
    const jx = mx ?? (input ? input.mx : 0), jy = my ?? (input ? input.my : 0);
    const m = Math.sqrt(jx * jx + jy * jy);
    if (m > 0.25) return [jx / m, jy / m, true];
    return [p.fx, p.fy, false];
  }

  humanKick(p, a, input, fromBuffer = false) {
    const [dx, dy, pushed] = fromBuffer ? this.aimDir(p, null, p.bufferMx, p.bufferMy) : this.aimDir(p, input);
    if (a.type === 'shoot') {
      const my = fromBuffer ? p.bufferMy : input ? input.my : 0;
      const mx = fromBuffer ? p.bufferMx : input ? input.mx : 0;
      this.humanShot(p, a.power ?? 0.6, !!a.chip, mx, my);
      return;
    }
    const through = a.type === 'through';
    // Smart pass: aimed cone first; without an explicit aim, fall back to the
    // best option anywhere instead of kicking into empty space.
    const q = this.pickReceiver(p, dx, dy, through) || this.pickReceiver(p, dx, dy, through, 0) || (!pushed ? this.pickReceiver(p, dx, dy, through, -1) : null);
    const lob = !!a.lob;
    if (!q) {
      // Pass into space.
      const d = through ? 22 : 14;
      const tx = clamp(p.x + dx * d, 1, L - 1), ty = clamp(p.y + dy * d, 1, W - 1);
      this.passTo(p, null, lob ? 'lob' : through ? 'through' : 'pass', tx, ty);
      return;
    }
    const t = p.team;
    if (through) {
      const pt = this.leadPoint(p, q);
      this.passTo(p, q, lob ? 'lobThrough' : 'through', pt.x, pt.y);
    } else {
      const wide = t.lx(p.x) > L - 32 && Math.abs(p.y - CY) > 13;
      const inBox = t.lx(q.x) > L - BOX_D - 1 && Math.abs(q.y - CY) < BOX_HW;
      if ((wide && inBox && dist(p.x, p.y, q.x, q.y) > 12) || lob) {
        const lead = this.leadPoint(p, q, lob ? 0.4 : 0.6);
        this.passTo(p, q, wide && inBox ? 'cross' : 'lob', lead.x, lead.y);
      } else {
        const lead = this.leadPoint(p, q, 0.35);
        this.passTo(p, q, 'pass', lead.x, lead.y);
      }
    }
  }

  // Human pass target: among the teammates roughly in the aim direction, the
  // one best matching it, weighed against how likely the ball gets there
  // (same interception model the AI uses), so a casual press finds the open man.
  pickReceiver(p, dx, dy, through, minCos = 0.45) {
    const t = p.team, b = this.ball, ai = this.ai[t.index];
    let best = null, bs = -1e9;
    for (const q of t.players) {
      if (q === p) continue;
      const vx = q.x - p.x, vy = q.y - p.y;
      const d = Math.sqrt(vx * vx + vy * vy);
      if (d < 2.5 || d > 60) continue;
      const cos = (vx * dx + vy * dy) / d;
      if (cos < minCos) continue;
      let s = cos * 3.2 - d * 0.035;
      if (q.isGK) s -= 2.5;
      const pt = through ? this.leadPoint(p, q) : q;
      const dd = Math.max(1, dist(b.x, b.y, pt.x, pt.y));
      const va = through ? clamp(4 + dd * 0.12, 5, 9) : clamp(8 + dd * 0.2, 9, 15.5);
      s -= ai.passRisk(b.x, b.y, pt.x, pt.y, Math.min(31, groundSpeedFor(dd, va)), q, dd) * 3.5;
      if (through) {
        const fwd = (q.vx * t.dir) / Math.max(1, q.vmax);
        s += fwd * 1.2 + (t.lx(q.x) - t.lx(p.x)) * 0.03;
      }
      if (s > bs) {
        bs = s;
        best = q;
      }
    }
    return best;
  }

  laneBlock(ax, ay, bx, by, oppTeam) {
    let n = 0;
    const sp = this._sp || (this._sp = {});
    for (const o of oppTeam.players) {
      segPoint(ax, ay, bx, by, o.x, o.y, sp);
      if (sp.t > 0.05 && sp.t < 0.97 && sp.d < 1.6) n += 1 - sp.d / 1.6;
    }
    return n;
  }

  // Where to play a ball so receiver q runs onto it.
  leadPoint(p, q, factor = 1) {
    const t = p.team;
    const d0 = dist(p.x, p.y, q.x, q.y);
    let tb = 0.4 + d0 / 17;
    let x = q.x, y = q.y;
    for (let i = 0; i < 3; i++) {
      const runDir = q.speed > 1.5 ? [q.vx / q.speed, q.vy / q.speed] : [t.dir, 0];
      const lead = factor >= 1 ? Math.max(4, q.vmax * tb * 0.8) : q.speed * tb * factor;
      x = q.x + runDir[0] * lead;
      y = q.y + runDir[1] * lead;
      if (factor >= 1) x += t.dir * 2;
      tb = 0.4 + dist(p.x, p.y, x, y) / 17;
    }
    // Keep through balls out of the goalkeeper's hands.
    const lx = t.lx(x);
    if (lx > L - 7 && Math.abs(y - CY) < 12) x = t.wx(L - 7);
    return { x: clamp(x, 1.5, L - 1.5), y: clamp(y, 1.5, W - 1.5) };
  }

  humanShot(p, power, chip, mx, my, kind) {
    const t = p.team;
    const gk = t.opp.gk;
    let ty;
    if (Math.abs(my) > 0.2) ty = CY + clamp(my, -1, 1) * (GOAL_HW - 0.55);
    else ty = gk.y > CY ? CY - GOAL_HW + 0.7 : CY + GOAL_HW - 0.7; // far side from keeper
    const tz = chip ? 2.0 : 0.25 + Math.pow(clamp(power, 0, 1), 1.5) * 1.75;
    this.shoot(p, ty, tz, power, { chip, human: true, kind });
  }

  humanSetpiece(p, a, input) {
    const r = this.restart;
    const [dx, dy] = this.aimDir(p, input);
    if (a.type === 'shoot' && (r.type === 'freekick' || r.type === 'penalty')) {
      // Sticky aim: the last joystick direction counts even if already released.
      const my = input && Math.abs(input.my) > 0.2 ? input.my : r.aimY || 0;
      this.humanShot(p, a.power ?? 0.6, !!a.chip, 0, my, r.type);
      return;
    }
    if (r.type === 'penalty') return;
    const through = a.type === 'through';
    if (r.type === 'corner') {
      if (through) {
        const q = this.pickReceiver(p, dx, dy, false) || this.nearestMate(p);
        if (q) this.passTo(p, q, 'pass', q.x, q.y, { kind: 'corner' });
      } else {
        const q = this.pickReceiver(p, dx, dy, false) || this.boxTarget(p.team);
        const pt = q ? { x: q.x, y: q.y } : { x: p.team.wx(L - 8), y: CY };
        this.passTo(p, q, 'cross', pt.x, pt.y, { kind: 'corner' });
      }
      return;
    }
    let q = this.pickReceiver(p, dx, dy, through);
    if (r.type === 'kickoff' && !r.aimed) q = r.partner;
    if (!q && !r.aimed) q = this.pickReceiver(p, dx, dy, through, -1);
    const kind = r.type === 'throw' ? 'throw' : r.type === 'goalkick' ? 'goalkick' : r.type === 'kickoff' ? 'kickoff' : 'freekick';
    if (q) {
      const long = dist(p.x, p.y, q.x, q.y) > 28 || through;
      if (kind === 'throw') this.passTo(p, q, 'throw', q.x, q.y, { kind });
      else if (long) {
        const pt = through ? this.leadPoint(p, q) : { x: q.x, y: q.y };
        this.passTo(p, q, 'lob', pt.x, pt.y, { kind });
      } else this.passTo(p, q, 'pass', q.x, q.y, { kind });
    } else {
      const d = kind === 'throw' ? 12 : 25;
      this.passTo(p, null, kind === 'throw' ? 'throw' : 'lob', clamp(p.x + dx * d, 1, L - 1), clamp(p.y + dy * d, 1, W - 1), { kind });
    }
  }

  nearestMate(p) {
    let best = null, bd = 1e9;
    for (const q of p.team.players) {
      if (q === p || q.isGK) continue;
      const d = dist(p.x, p.y, q.x, q.y);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  boxTarget(team) {
    let best = null, bs = -1e9;
    for (const q of team.players) {
      if (q.isGK) continue;
      const lx = team.lx(q.x);
      if (lx < L - BOX_D) continue;
      const s = q.phy + q.sho * 0.5 - Math.abs(q.y - CY) * 2;
      if (s > bs) {
        bs = s;
        best = q;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- kicks
  touch(p) {
    const b = this.ball;
    if (b.lastTouch !== p) {
      b.prevTouch = b.lastTouch;
      b.lastTouch = p;
    }
    if (this.offside && this.offside.team !== p.team.index) this.offside = null;
  }

  kickBall(p, vx, vy, vz, spin, type, target, kind) {
    const b = this.ball;
    if (b.owner && b.owner.state === ST.HOLD) b.owner.state = ST.RUN;
    b.owner = null;
    if (b.z < 0.05 && vz < 0.01) {
      b.z = 0;
      vz = 0;
    }
    if (type === 'throw') b.z = 1.9;
    b.vx = vx;
    b.vy = vy;
    b.vz = vz;
    b.spin = spin;
    b.version++;
    this.touch(p);
    b.kick = { by: p, team: p.team.index, type, kind: kind || type, target, t: this.time, x: b.x, y: b.y, frame: this.frame, shot: type === 'shot' };
    p.touchCD = 0.32;
    p.kickT = 0.3;
    if (p.state === ST.RUN) {
      p.state = type === 'throw' ? ST.THROW : ST.KICK;
      p.stateT = type === 'throw' ? 0.35 : 0.2;
    }
    const setpiece = this.phase === 'setpiece' || this.phase === 'kickoff';
    this.snapshotOffside(p, setpiece && kind && kind !== 'freekick' && kind !== 'kickoff' ? kind : type);
    if (type !== 'shot' && (PASS_KINDS.has(type) || PASS_KINDS.has(kind))) {
      p.team.stats.passes++;
      this.pendingPass = { team: p.team.index, target };
      this.setPoss(p.team.index);
    } else {
      this.pendingPass = null;
      this.setPoss(-1);
    }
    const power = Math.sqrt(vx * vx + vy * vy + vz * vz);
    this.emit('kick', { power, kind: type, player: p });
    if (setpiece) {
      this.phase = 'play';
      this.phaseT = 0;
      this.restart = null;
      for (const q of this.players) q.ai.hold = false;
    }
    // Human: control follows the pass; the receiver runs to the ball by
    // himself until the user moves the stick in a new direction.
    if (this.human === p.team.index && target && target !== p && type !== 'shot') {
      this.setControlled(target);
      const li = this.lastInput;
      this.switchJoy = { mx: li ? li.mx : 0, my: li ? li.my : 0 };
      this.passAssist = true;
    }
    this.maybePlanSave();
  }

  setPoss(i) {
    if (this.possTeam !== i) {
      this.possTeam = i;
      this.possT = 0;
    }
  }

  passError(p, dirx, diry) {
    const prof = this.ai[p.team.index].prof;
    const pressure = this.pressureOn(p);
    const turn = 1 - (p.fx * dirx + p.fy * diry); // 0 facing .. 2 behind
    return (0.008 + (100 - p.pas) * 0.0012) * (1 + pressure * 0.6) * (1 + turn * 0.3) * prof.passErr;
  }

  // Unified pass: kind = pass | through | lob | lobThrough | cross | throw | clear
  passTo(p, q, kind, tx, ty, opts = {}) {
    const b = this.ball;
    let dx = tx - b.x, dy = ty - b.y;
    let d = Math.max(0.5, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / d, uy = dy / d;
    const sig = this.passError(p, ux, uy) * (kind === 'throw' ? 0.7 : 1);
    const ang = this.rng.gauss() * sig;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const ex = ux * ca - uy * sa, ey = ux * sa + uy * ca;
    const type = kind === 'lobThrough' ? 'through' : kind === 'clear' ? 'clear' : kind;
    if (kind === 'pass' || kind === 'through') {
      let va = kind === 'through' ? clamp(4 + d * 0.12, 5, 9) : clamp(8 + d * 0.2, 9, 15.5);
      if (opts.firm) va += 3;
      let v0 = Math.min(31, groundSpeedFor(d, va));
      v0 *= 1 + this.rng.gauss() * sig * 0.9;
      this.kickBall(p, ex * v0, ey * v0, 0, 0, type, q, opts.kind);
      return;
    }
    // Aerial kinds.
    const derr = d * sig * 0.8;
    const ax = tx + this.rng.gauss() * derr, ay = ty + this.rng.gauss() * derr;
    let T, tz = 0, z0 = b.z;
    if (kind === 'cross') {
      T = 0.6 + d * 0.028;
      tz = 1.5;
    } else if (kind === 'throw') {
      T = 0.45 + d * 0.045;
      tz = 0.6;
      z0 = 1.9;
    } else if (kind === 'clear') {
      T = 1.6 + d * 0.012;
    } else if (kind === 'lobThrough') {
      T = loftTime(d, true);
    } else {
      T = loftTime(d);
      tz = 0.3;
    }
    const v = solveAerial(b.x, b.y, z0, ax, ay, tz, T, 0);
    this.kickBall(p, v.vx, v.vy, v.vz, 0, type, q, opts.kind);
  }

  shoot(p, ty, tz, power, opts = {}) {
    const b = this.ball;
    const t = p.team;
    const gx = t.oppGoalX;
    const prof = this.ai[t.index].prof;
    power = clamp(power, 0.15, 1);
    const d = Math.max(1, dist(b.x, b.y, gx, ty));
    const pressure = this.pressureOn(p);
    const toGoalX = (gx - p.x) / d, toGoalY = (ty - p.y) / d;
    const turn = Math.max(0, 1 - (p.fx * toGoalX + p.fy * toGoalY));
    const over = Math.max(0, power - 0.85) / 0.15;
    const run = Math.min(1, p.speed / p.vmax);
    let sig = (0.22 + (100 - p.sho) * 0.013) * (0.3 + Math.pow(d / 15, 2.4)) * (1 + pressure * 0.9) * (1 + turn * 0.45) * (0.85 + over * 0.5) * (1 + run * run * 0.55) * prof.shotErr;
    if (opts.header) sig *= 1.5;
    let speed = 12 + power * (12 + p.sho * 0.08);
    if (opts.header) speed = 11 + p.phy * 0.04 + b.speed * 0.15;
    let T, spin = 0;
    let aimY = ty + this.rng.gauss() * sig;
    let aimZ = tz + this.rng.gauss() * sig * 0.6 + over * this.rng() * 1.4;
    if (opts.chip) {
      T = 0.75 + d * 0.042;
      aimZ = 2.0 + this.rng.gauss() * sig * 0.5;
    } else {
      T = d / (speed * 0.93);
      aimZ = clamp(aimZ, 0.12, 4);
      // Finesse: controlled shots from range bend back in towards the goal centre.
      // Magnus accel is spin * (-vy, vx); its y-part has the sign of spin * ux.
      if (!opts.header && power < 0.82 && d > 13 && Math.abs(aimY - CY) > 1) {
        const ux = (gx - b.x) / d;
        spin = Math.sign(ux * (CY - aimY)) * (0.1 + p.sho * 0.0014);
      }
    }
    const v = solveAerial(b.x, b.y, b.z, gx, aimY, aimZ, T, spin);
    t.stats.shots++;
    this.kickBall(p, v.vx, v.vy, v.vz, spin, 'shot', null, opts.kind);
    this.emit('shot', { player: p, team: t.index, human: !!opts.human });
  }

  // Header: towards goal (attack), clearance (defence) or flick to a mate.
  header(p, kind) {
    const b = this.ball;
    const t = p.team;
    p.state = ST.HEADER;
    p.stateT = 0.45;
    p.vz = 3.2;
    if (kind === 'shot') {
      const gk = t.opp.gk;
      const ty = gk.y > CY ? CY - GOAL_HW + 0.9 : CY + GOAL_HW - 0.9;
      this.shoot(p, ty, 0.5 + this.rng() * 0.9, 0.7, { header: true });
      return;
    }
    if (kind === 'clear') {
      const tx = t.wx(clamp(t.lx(p.x) + 22, 20, 70));
      const ty = clamp(p.y + (p.y < CY ? -12 : 12), 3, W - 3);
      const v = solveAerial(b.x, b.y, b.z, tx, ty, 0, 1.5, 0);
      this.kickBall(p, v.vx, v.vy, v.vz, 0, 'clear', null);
      return;
    }
    const q = this.nearestMate(p);
    if (q) {
      const v = solveAerial(b.x, b.y, b.z, q.x, q.y, 0.2, 0.5 + dist(b.x, b.y, q.x, q.y) * 0.04, 0);
      this.kickBall(p, v.vx, v.vy, v.vz, 0, 'pass', q);
    }
  }

  // ---------------------------------------------------------------- offside
  snapshotOffside(kicker, type) {
    this.offside = null;
    if (!this.settings.offside) return;
    if (type === 'throw' || type === 'goalkick' || type === 'corner') return;
    const t = kicker.team;
    let a = -1e9, bb = -1e9;
    for (const o of t.opp.players) {
      const lx = t.lx(o.x);
      if (lx > a) {
        bb = a;
        a = lx;
      } else if (lx > bb) bb = lx;
    }
    const line = Math.max(bb, t.lx(this.ball.x));
    let set = null;
    for (const q of t.players) {
      if (q === kicker) continue;
      const lx = t.lx(q.x);
      if (lx > line + 0.3 && lx > CX) (set || (set = [])).push(q);
    }
    if (set) this.offside = { team: t.index, players: set };
  }

  callOffside(p) {
    const t = p.team;
    t.stats.offsides++;
    this.emit('whistle', { kind: 'short' });
    this.emit('offside', { player: p, team: t.index });
    this.offside = null;
    this.deadBall({ type: 'freekick', team: t.opp.index, x: p.x, y: p.y, reason: 'offside' });
  }

  // ---------------------------------------------------------------- ball
  onBallHit = (type, s) => {
    if (type === 'post' || type === 'bar') this.emit('post', { strength: s });
    else if (type === 'net') this.emit('net', { strength: s });
  };

  updateBall(dt) {
    const b = this.ball;
    if (b.owner) {
      const p = b.owner;
      if (p.state === ST.HOLD) {
        b.x = p.x + p.fx * 0.3;
        b.y = p.y + p.fy * 0.3;
        b.z = 1.05;
        b.vx = p.vx;
        b.vy = p.vy;
        b.vz = 0;
        p.holdT += dt;
      } else this.dribble(p, dt);
    } else {
      stepBall(b, dt, this.onBallHit);
      if (this.phase === 'play') {
        this.maybePlanSave();
        this.planTick();
        this.looseBall(dt);
        this.slideContacts();
      }
    }
    if (this.phase === 'play') this.checkLines();
    else if (this.phase === 'setpiece' || this.phase === 'kickoff') {
      // Ball stays on its spot.
    }
  }

  dribble(p, dt) {
    const b = this.ball;
    const sp = p.speed;
    const f = clamp(sp / p.vmax, 0, 1);
    let d = 0.48 + 0.52 * f;
    p.dribblePhase += sp * dt * 1.25;
    d += Math.sin(p.dribblePhase) * 0.22 * f * (1.15 - p.dri / 100);
    if (p.skillT > 0) d = 0.42;
    const tx = p.x + p.fx * d, ty = p.y + p.fy * d;
    const k = 1 - Math.exp(-24 * dt);
    const nx = b.x + (tx - b.x) * k, ny = b.y + (ty - b.y) * k;
    b.vx = (nx - b.x) / dt;
    b.vy = (ny - b.y) / dt;
    b.x = nx;
    b.y = ny;
    b.z = 0;
    b.vz = 0;
    b.rot += len(b.vx, b.vy) * dt / BALL_R;

    if (this.phase !== 'play') return;
    // Body contest: defenders near the ball can nick it, more easily when
    // the carrier's touch is heavy (ball far from his feet).
    const exposure = clamp((d - 0.45) / 0.55, 0.25, 1);
    const mvx = sp > 0.5 ? p.vx / sp : p.fx, mvy = sp > 0.5 ? p.vy / sp : p.fy;
    for (const o of p.team.opp.players) {
      if (o.touchCD > 0 || !o.canAct() || o.state === ST.HOLD) continue;
      const db = dist(o.x, o.y, b.x, b.y);
      if (db > 0.9) continue;
      const aiProf = this.ai[o.team.index].prof;
      const skill = 0.6 + (o.def - p.dri) * 0.02;
      // Dribbling straight into a defender who stands in the ball's path.
      const inFront = (o.x - b.x) * mvx + (o.y - b.y) * mvy > 0 && db < 0.7;
      let rate = inFront ? 5 * skill * (0.5 + 0.5 * (o.human ? 1 : aiProf.tackle)) * (0.4 + 0.6 * Math.min(1, sp / 4)) : 1.2 * skill * aiProf.tackle * exposure;
      if (o.human && !inFront) rate *= 1.1;
      if (p.skillT > 0) rate *= 0.15;
      if (this.rng() < clamp(rate, 0.1, 6) * dt) {
        this.steal(o, p, inFront && this.rng() < 0.4);
        return;
      }
    }
  }

  steal(o, p, clean) {
    const b = this.ball;
    o.team.stats.tackles++;
    this.emit('tackle', { player: o, won: true });
    p.touchCD = 0.45;
    p.stunT = 0.35;
    if (clean || this.rng() < 0.55) {
      this.gainBall(o, 'tackle');
    } else {
      b.owner = null;
      const ang = Math.atan2(o.fy, o.fx) + this.rng.range(-0.9, 0.9);
      const s = this.rng.range(3, 6.5);
      b.vx = Math.cos(ang) * s + p.vx * 0.3;
      b.vy = Math.sin(ang) * s + p.vy * 0.3;
      b.vz = this.rng() < 0.3 ? 1.5 : 0;
      b.version++;
      this.touch(o);
      o.touchCD = 0.2;
      this.setPoss(-1);
      this.pendingPass = null;
    }
  }

  looseBall(dt) {
    const b = this.ball;
    if (b.owner || b.z > 2.9) return;
    const sp = b.speed;
    const kick = b.kick;
    let best = null, bestS = 1e9, bestHands = false;
    let header = null, headerS = 1e9;
    for (const p of this.players) {
      if (p.touchCD > 0) continue;
      if (p.state === ST.DOWN || p.state === ST.SLIDE || p.state === ST.CELEBRATE) continue;
      if (p.state === ST.DIVE && !(this.plan && this.plan.gk === p && this.plan.save)) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1.6) continue;
      const backpass = kick && kick.team === p.team.index && kick.type !== 'shot' && kick.by !== p && kick.type !== 'clear';
      const hands = p.isGK && this.inBox(p.team, b.x, b.y) && this.inBox(p.team, p.x, p.y) && !backpass;
      let reach = hands ? (p.state === ST.DIVE ? 1.05 : 1.25) : kick && kick.target === p ? 1.05 : 0.9;
      // A freshly struck ball can only be blocked, not controlled, before a player reacts.
      if (kick && kick.target !== p && (this.frame - kick.frame) * STEP < 0.2) reach = Math.min(reach, 0.45);
      if (kick && kick.shot && !hands && sp > 12) {
        // A shot flies past the shooter's teammates; opponents block it with the body.
        if (kick.team === p.team.index) continue;
        reach = Math.min(reach, 0.65);
      }
      const zmax = hands ? 2.75 : 1.45;
      if (d < reach && b.z <= zmax) {
        let s = d;
        if (kick && kick.target === p) s -= 0.35;
        if (s < bestS) {
          bestS = s;
          best = p;
          bestHands = hands;
        }
      } else if (!hands && b.z > 1.0 && b.z < 2.75 && d < 0.8) {
        let s = d - p.phy * 0.004 + this.rng() * 0.3;
        if (s < headerS) {
          headerS = s;
          header = p;
        }
      }
    }
    if (best) {
      if (bestHands) {
        const plan = this.plan;
        if (plan && plan.gk === best && plan.parry) {
          this.parry(best);
          return;
        }
        this.gainBall(best, 'catch');
        return;
      }
      // Hard balls deflect off opponents instead of being controlled.
      const opponentOfKicker = kick && kick.team !== best.team.index;
      if (sp > 17 && opponentOfKicker) {
        const pc = clamp(1.25 - sp / 26, 0.05, 0.6) * (0.6 + best.def / 250);
        if (this.rng() > pc) {
          this.deflect(best);
          return;
        }
      }
      this.gainBall(best, 'control');
      return;
    }
    if (header) this.resolveHeader(header);
  }

  deflect(p) {
    const b = this.ball;
    const s = b.speed;
    b.vx = -b.vx * 0.25 + this.rng.gauss() * s * 0.3;
    b.vy = -b.vy * 0.25 + this.rng.gauss() * s * 0.3;
    b.vz = Math.abs(b.vz) * 0.4 + this.rng() * 3;
    b.version++;
    this.touch(p);
    p.touchCD = 0.25;
    this.setPoss(-1);
    this.pendingPass = null;
    this.emit('block', { player: p });
  }

  resolveHeader(p) {
    const b = this.ball;
    const t = p.team;
    const lx = t.lx(p.x);
    // Human first-time header.
    if (p.human && p.buffer && p.bufferT > 0) {
      const a = p.buffer;
      p.buffer = null;
      this.header(p, a.type === 'shoot' ? 'shot' : 'pass');
      return;
    }
    const inBox = lx > L - BOX_D - 1 && Math.abs(p.y - CY) < BOX_HW + 1;
    if (inBox && (!p.human || this.settings.assist)) this.header(p, 'shot');
    else if (lx < 35) this.header(p, 'clear');
    else if (b.z < 1.7) this.gainBall(p, 'control');
    else this.header(p, 'pass');
  }

  gainBall(p, how) {
    const b = this.ball;
    if (this.offside && this.offside.team === p.team.index && this.offside.players.includes(p)) {
      this.callOffside(p);
      return;
    }
    this.offside = null;
    const prevOwnerTeam = this.possTeam;
    b.owner = p;
    b.spin = 0;
    b.version++;
    this.touch(p);
    if (this.pendingPass) {
      if (this.pendingPass.team === p.team.index) p.team.stats.passesDone++;
      this.pendingPass = null;
    }
    this.plan = null;
    this.setPoss(p.team.index);
    p.ai.decideT = this.ai[p.team.index].reactTime(p) * (how === 'tackle' ? 0.6 : 1);
    p.ai.plan = null;
    p.ai.settle = null;
    if (how === 'catch') {
      p.state = ST.HOLD;
      p.stateT = 0;
      p.holdT = 0;
      b.z = 1.05;
      b.vx = b.vy = b.vz = 0;
      if (b.kick && b.kick.shot && b.kick.team !== p.team.index) {
        p.team.stats.saves++;
        this.emit('save', { player: p, caught: true });
      }
    } else {
      b.z = 0;
      b.vz = 0;
      // First touch: dampen but keep a little momentum.
      b.vx = p.vx + (b.vx - p.vx) * 0.12;
      b.vy = p.vy + (b.vy - p.vy) * 0.12;
    }
    if (prevOwnerTeam !== p.team.index) this.emit('possession', { team: p.team.index, player: p });
    if (this.human === p.team.index) {
      this.setControlled(p);
      if (p.buffer && p.bufferT > 0) {
        const a = p.buffer;
        p.buffer = null;
        this.humanKick(p, a, null, true);
      }
    } else if (this.human !== null && this.settings.autoSwitch && prevOwnerTeam === this.human) {
      const d = this.bestDefender(this.teams[this.human]);
      if (d) this.setControlled(d);
    }
  }

  checkLines() {
    const b = this.ball;
    if (b.x < -BALL_R || b.x > L + BALL_R) {
      const left = b.x < 0;
      if (Math.abs(b.y - CY) < GOAL_HW - BALL_R * 0.5 && b.z < GOAL_H - BALL_R * 0.5) {
        this.scoreGoal(left ? 0 : L);
        return;
      }
      if (b.owner) b.owner = null;
      const defTeam = this.teams.find((t) => t.ownGoalX === (left ? 0 : L));
      const last = b.lastTouch;
      const nearMiss = b.kick && b.kick.shot && Math.abs(b.y - CY) < GOAL_HW + 3 && b.z < GOAL_H + 2.5;
      if (nearMiss) this.emit('nearmiss', {});
      if (last && last.team === defTeam) {
        defTeam.opp.stats.corners++;
        this.deadBall({ type: 'corner', team: defTeam.opp.index, x: left ? 0 : L, y: b.y < CY ? 0 : W });
      } else {
        this.deadBall({ type: 'goalkick', team: defTeam.index, x: left ? 0 : L, y: b.y });
      }
      return;
    }
    if (b.y < -BALL_R || b.y > W + BALL_R) {
      if (b.owner) b.owner = null;
      const last = b.lastTouch;
      const team = last ? last.team.opp.index : 0;
      this.deadBall({ type: 'throw', team, x: clamp(b.x, 1, L - 1), y: b.y < CY ? 0 : W });
    }
  }

  deadBall(r) {
    this.phase = 'dead';
    this.phaseT = 0;
    this.restart = r;
    this.plan = null;
    this.offside = null;
    this.setPoss(-1);
    if (this.pens) return;
    const names = { throw: 'Inworp', corner: 'Hoekschop', goalkick: 'Doeltrap', freekick: 'Vrije trap', penalty: 'Strafschop' };
    if (r.type === 'corner' || r.type === 'goalkick' || r.type === 'throw') this.emit('out', { restart: r.type });
    this.emit('banner', { text: r.reason === 'offside' ? 'Buitenspel' : names[r.type], restart: r.type, team: r.team });
  }

  scoreGoal(gx) {
    const b = this.ball;
    const scoring = this.teams.find((t) => t.oppGoalX === gx);
    scoring.score++;
    const last = b.lastTouch;
    const own = last && last.team !== scoring;
    let assist = null;
    if (!own && b.prevTouch && b.prevTouch.team === scoring && b.prevTouch !== last) assist = b.prevTouch;
    const info = {
      team: scoring.index,
      scorer: last,
      own,
      assist,
      minute: this.clockText(),
      time: this.time,
      score: [this.teams[0].score, this.teams[1].score],
      frame: this.frame,
    };
    this.goals.push(info);
    this.goalInfo = info;
    this.phase = 'goal';
    this.phaseT = 0;
    this.plan = null;
    this.offside = null;
    this.setPoss(-1);
    if (b.owner) b.owner = null;
    // Celebration targets.
    const scorer = own ? null : last;
    const cx = gx === L ? L - 6 : 6;
    const cy = this.rng() < 0.5 ? 4 : W - 4;
    for (const p of scoring.players) {
      p.state = ST.RUN;
      p.stateT = 0;
      p.ai.cx = scorer && p !== scorer ? cx + this.rng.range(-5, 5) : cx;
      p.ai.cy = cy + this.rng.range(-3, 3);
    }
    if (scorer) {
      scorer.state = ST.CELEBRATE;
      scorer.stateT = 6;
    }
    this.emit('goal', info);
  }

  goalStep(dt) {
    const g = this.goalInfo;
    for (const t of this.teams) {
      for (const p of t.players) {
        if (t.index === g.team && !p.isGK) {
          const d = dist(p.x, p.y, p.ai.cx, p.ai.cy);
          const s = d > 1.5 ? (p.state === ST.CELEBRATE ? p.vmax : p.jog * 1.1) : 0;
          p.tvx = d > 0.1 ? ((p.ai.cx - p.x) / d) * s : 0;
          p.tvy = d > 0.1 ? ((p.ai.cy - p.y) / d) * s : 0;
        } else {
          p.tvx *= 0.9;
          p.tvy *= 0.9;
          const s = len(p.tvx, p.tvy);
          if (s < 0.5) {
            p.tvx = 0;
            p.tvy = 0;
          }
        }
      }
    }
    if (this.phaseT > 3.2 && !this.holdGoal) {
      if (this.pens) return;
      if (this.attack) {
        this.endAttackRound('goal');
        return;
      }
      const conceding = 1 - g.team;
      this.setupKickoff(conceding);
    }
  }

  // ---------------------------------------------------------------- saves
  maybePlanSave() {
    const b = this.ball;
    if (b.owner || this.phase !== 'play') return;
    if (this.planVersion === b.version) return;
    this.planVersion = b.version;
    if (this.plan && this.plan.version !== b.version) {
      const gk = this.plan.gk;
      if (gk.state === ST.DIVE) gk.dive.cancel = true;
      this.plan = null;
    }
    if (b.hspeed < 6) return;
    const gx = b.vx > 0 ? L : 0;
    const defTeam = this.teams.find((t) => t.ownGoalX === gx);
    const gk = defTeam.gk;
    predictBall(b, this.pred, PRED_N, 0.05);
    this.predVersion = -1;
    const pred = this.pred;
    let tLine = -1, yLine = 0, zLine = 0;
    let tG = -1, yG = 0, zG = 0;
    const gkDepth = Math.abs(gk.x - gx);
    const planeX = gkDepth > 0.4 && defTeam.lx(gk.x) < BOX_D ? gk.x : gx;
    let px = b.x, py = b.y, pz = b.z;
    for (let i = 0; i < PRED_N; i++) {
      const x = pred[i * 3], y = pred[i * 3 + 1], z = pred[i * 3 + 2];
      const crossesPlane = (px - planeX) * (x - planeX) <= 0 && tG < 0;
      if (crossesPlane) {
        const f = (planeX - px) / (x - px || 1e-6);
        tG = (i + f) * 0.05;
        yG = py + (y - py) * f;
        zG = pz + (z - pz) * f;
      }
      if ((px - gx) * (x - gx) <= 0) {
        const f = (gx - px) / (x - px || 1e-6);
        tLine = (i + f) * 0.05;
        yLine = py + (y - py) * f;
        zLine = pz + (z - pz) * f;
        break;
      }
      px = x;
      py = y;
      pz = z;
    }
    if (tLine < 0) return;
    if (tG < 0) {
      tG = tLine;
      yG = yLine;
      zG = zLine;
    }
    const onTarget = Math.abs(yLine - CY) < GOAL_HW - 0.05 && zLine < GOAL_H - 0.05;
    const close = Math.abs(yLine - CY) < GOAL_HW + 1.2 && zLine < GOAL_H + 1.0;
    if (!close) return;
    if (onTarget && b.kick && b.kick.shot && !b.kick.counted && b.kick.team !== defTeam.index) {
      b.kick.counted = true;
      this.teams[b.kick.team].stats.onTarget++;
    }
    if (gk.state === ST.DOWN || gk.state === ST.HOLD || gk === b.lastTouch) return;
    // Own team's back-pass rolling towards goal: keeper just collects.
    if (!onTarget && !(b.kick && b.kick.shot)) return;

    const prof = this.ai[defTeam.index].prof;
    const g = gk.gk;
    const penalty = b.kick && b.kick.kind === 'penalty';
    let react = (0.12 + (100 - g.ref) * 0.0055) * prof.gkReact;
    // Lateral speed of the dive and the furthest the keeper can stretch.
    const diveSpeed = 4.6 + g.div * 0.02;
    const maxReach = 3.3 + g.div * 0.006;
    let guess = 0;
    if (penalty) {
      // Keeper commits to a side at the kick: the user picks with the joystick, the AI guesses.
      if (this.human === defTeam.index) {
        const my = this.lastInput ? this.lastInput.my : 0;
        guess = Math.abs(my) > 0.3 ? Math.sign(my) : 0;
      } else {
        const r = this.rng();
        guess = r < 0.45 ? -1 : r < 0.9 ? 1 : 0;
      }
      react = 0.04;
    }
    const dy = yG - gk.y;
    const hz = zG > 1.9 ? (zG - 1.9) * 1.3 : zG < 0.35 && Math.abs(dy) > 1.3 ? 0.4 : 0;
    const need = Math.sqrt(dy * dy + hz * hz);
    // Time the keeper needs to get a hand there (the first 0.6 m is just
    // reach) versus the time the ball takes: slack decides the save.
    const slack = tG - react - Math.max(0, need - 0.6) / diveSpeed;
    const sp = b.speed;
    const quality = 0.9 + (gk.ovr - 80) * 0.007;
    let pSave = need > maxReach ? 0.02 : sigmoid(slack * 5.5 - 0.9) * quality;
    // Chips over an advanced keeper.
    if (zG > 2.6) pSave *= 0.15;
    const ballSide = Math.abs(yLine - CY) > 1.0 ? Math.sign(yLine - CY) : 0;
    if (penalty) pSave = guess === ballSide ? sigmoid(slack * 4.5 - 0.2) * quality : 0.03;
    pSave = clamp(pSave, 0.02, 0.97);
    const save = onTarget ? this.rng() < pSave : false;
    const catchIt = save && sp < 16 + g.han * 0.07 && slack > 0.25 && this.rng() < 0.4 + g.han * 0.006;
    // Dive target: exact when saving, short when beaten.
    let ty = yG;
    if (!save) {
      const reachAtT = 0.6 + Math.max(0, tG - react) * diveSpeed;
      const shortBy = Math.max(0.45, need - reachAtT + 0.35);
      ty = yG - Math.sign(dy || 1) * Math.min(Math.abs(dy), shortBy);
      if (!onTarget) ty = gk.y + (yG - gk.y) * 0.6;
      if (penalty && guess !== ballSide) ty = CY + guess * 2.4;
    }
    const plan = {
      gk,
      version: b.version,
      tHit: this.time + tG * this.realScale,
      save,
      parry: save && !catchIt,
      tG,
    };
    this.plan = plan;
    gk.dive = {
      start: react,
      t: 0,
      dur: Math.max(0.05, tG - react),
      sx: gk.x,
      sy: gk.y,
      tx: planeX === gx ? gx + (gx > CX ? -0.35 : 0.35) : gk.x,
      ty,
      tz: clamp(zG, 0, 2.4),
      big: need > 1.0,
      cancel: false,
    };
    gk.state = ST.DIVE;
    gk.stateT = 0;
    if (!save) gk.touchCD = tG + 0.35;
    gk.ai.mode = 'gk';
  }

  planTick() {
    const p = this.plan;
    if (!p) return;
    if (p.version !== this.ball.version) {
      this.plan = null;
      return;
    }
  }

  parry(gk) {
    const b = this.ball;
    const t = gk.team; // t.dir points from the keeper's goal into the pitch
    const s = b.speed;
    const lateral = Math.sign(b.y - gk.y || this.rng() - 0.5);
    const toLine = Math.abs(t.ownGoalX - b.x);
    b.spin = 0;
    if (toLine < 3 && this.rng() < 0.4) {
      // Tipped over the bar or round the post: aimed to clear the frame.
      const tl = clamp(toLine / (1.5 + this.rng() * 1.5), 0.12, 0.6);
      b.vx = -t.dir * Math.max(1.5, toLine / tl);
      if (b.z > 1.5) {
        b.vy = lateral * this.rng() * 2;
        b.vz = (GOAL_H + 0.7 - b.z + 4.9 * tl * tl) / tl;
      } else {
        const side = Math.sign(b.y - CY || lateral);
        b.vy = (CY + side * (GOAL_HW + 0.9) - b.y) / tl;
        b.vz = 0.5 + this.rng() * 1.5;
      }
    } else {
      // Pushed away from goal.
      b.vx = t.dir * Math.max(2, 3 + this.rng() * 5 + this.rng.gauss() * 1.5);
      b.vy = lateral * (4 + this.rng() * 6);
      b.vz = 1.5 + this.rng() * 3.5;
    }
    b.version++;
    this.touch(gk);
    gk.touchCD = 0.6;
    this.plan = null;
    this.setPoss(-1);
    this.pendingPass = null;
    t.stats.saves++;
    this.emit('save', { player: gk, caught: false, speed: s });
  }

  // ---------------------------------------------------------------- tackles & fouls
  tackle(p, slide) {
    if (!p.canAct() || p.tackleCD > 0 || p.state === ST.HOLD) return;
    const b = this.ball;
    p.tackleCD = slide ? 1.3 : 0.6;
    this.emit('tackleTry', { player: p });
    if (slide) {
      p.state = ST.SLIDE;
      p.stateT = 0.62;
      const s = Math.max(p.speed, 6.2);
      p.vx = p.fx * s;
      p.vy = p.fy * s;
      p.slideHit = false;
      return;
    }
    p.state = ST.TACKLE;
    p.stateT = 0.3;
    const dx = b.x - p.x, dy = b.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0.01) {
      p.fx = dx / d;
      p.fy = dy / d;
      p.vx += p.fx * 2.2;
      p.vy += p.fy * 2.2;
    }
    const c = b.owner;
    if (c && c.team !== p.team && d < 1.55) {
      if (c.state === ST.HOLD) return;
      this.resolveTackle(p, c, d);
    } else if (!c && d < 1.4 && b.z < 0.8 && p.touchCD <= 0) {
      this.gainBall(p, 'control');
    } else {
      p.stunT = Math.max(p.stunT, 0.25);
    }
  }

  resolveTackle(p, c, d) {
    const prof = this.ai[p.team.index].prof;
    let ps = 0.55 + (p.def - c.dri) * 0.012 - (d - 0.9) * 0.4;
    if (c.skillT > 0) ps -= 0.35;
    if (c.sprinting) ps += 0.08;
    const bx = p.x - c.x, by = p.y - c.y;
    const bl = Math.sqrt(bx * bx + by * by) || 1;
    const behind = (c.fx * bx + c.fy * by) / bl < -0.5;
    if (behind) ps -= 0.12;
    ps = clamp(ps, 0.08, 0.9) * (p.human ? 1 : prof.tackle);
    if (this.rng() < ps) {
      this.steal(p, c, this.rng() < 0.5);
      return;
    }
    // Missed.
    p.stunT = 0.5;
    this.emit('tackle', { player: p, won: false });
    const foulP = (behind ? 0.35 : 0.1) * (d < 1.2 ? 1 : 0.4);
    if (this.rng() < foulP) this.foul(p, c, behind && this.rng() < 0.25);
  }

  slideContacts() {
    const b = this.ball;
    for (const p of this.players) {
      if (p.state !== ST.SLIDE || p.slideHit) continue;
      const fx = p.x + p.fx * 0.75, fy = p.y + p.fy * 0.75;
      const db = dist(fx, fy, b.x, b.y);
      if (db < 0.95 && b.z < 0.6) {
        p.slideHit = true;
        const c = b.owner;
        b.owner = null;
        const s = 5 + this.rng() * 3;
        b.vx = p.fx * s + this.rng.gauss() * 1.5;
        b.vy = p.fy * s + this.rng.gauss() * 1.5;
        b.vz = this.rng() * 1.2;
        b.version++;
        this.touch(p);
        p.touchCD = 0.3;
        this.setPoss(-1);
        this.pendingPass = null;
        if (c) {
          c.touchCD = 0.4;
          c.stunT = 0.3;
          p.team.stats.tackles++;
          this.emit('tackle', { player: p, won: true, slide: true });
        }
        continue;
      }
      for (const o of p.team.opp.players) {
        if (o.state === ST.DOWN) continue;
        const d = dist(fx, fy, o.x, o.y);
        if (d < 0.7 && b.owner === o && db > 1.0) {
          p.slideHit = true;
          const bx = p.x - o.x, by = p.y - o.y;
          const behind = (o.fx * bx + o.fy * by) / (Math.sqrt(bx * bx + by * by) || 1) < -0.3;
          if (this.rng() < (behind ? 0.85 : 0.55)) this.foul(p, o, behind && this.rng() < 0.45);
          break;
        }
      }
    }
  }

  foul(p, victim, yellow) {
    const t = p.team;
    t.stats.fouls++;
    victim.state = ST.DOWN;
    victim.stateT = 0.9;
    victim.vx *= 0.3;
    victim.vy *= 0.3;
    this.emit('whistle', { kind: 'short' });
    this.emit('foul', { player: p, victim });
    if (yellow) {
      p.yellow++;
      t.stats.yellow++;
      this.cards.push({ player: p, minute: this.clockText() });
      this.emit('card', { player: p, color: 'yellow' });
    }
    const b = this.ball;
    const inBox = this.inBox(t, victim.x, victim.y);
    const x = victim.x, y = victim.y;
    if (b.owner) b.owner = null;
    if (inBox) this.deadBall({ type: 'penalty', team: t.opp.index, x, y });
    else this.deadBall({ type: 'freekick', team: t.opp.index, x, y });
  }

  skillMove(p, dx, dy) {
    if (p.skillCD > 0 || !p.canAct()) return;
    const m = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= m;
    dy /= m;
    p.skillT = 0.42;
    p.skillCD = 0.9;
    const sp = Math.max(p.speed, p.jog * 0.95);
    p.vx = dx * sp * 1.05;
    p.vy = dy * sp * 1.05;
    p.fx = dx;
    p.fy = dy;
    for (const o of p.team.opp.players) {
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < 3.6 && this.rng() < 0.35 + (p.dri - o.def) * 0.015) o.stunT = Math.max(o.stunT, 0.45);
    }
    this.emit('skill', { player: p });
  }

  // ---------------------------------------------------------------- movement
  movePlayers(dt) {
    const tmp = this._rot || (this._rot = [0, 0]);
    for (const p of this.players) {
      p.touchCD -= dt;
      p.tackleCD -= dt;
      p.stunT -= dt;
      p.skillT -= dt;
      p.skillCD -= dt;
      p.kickT -= dt;
      p.bufferT -= dt;
      if (p.bufferT <= 0) p.buffer = null;
      if (p.stateT > 0) {
        p.stateT -= dt;
        if (p.stateT <= 0) this.endState(p);
      }
      // Vertical (jumps).
      if (p.z > 0 || p.vz > 0) {
        p.vz -= 9.81 * dt;
        p.z += p.vz * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
        }
      }

      if (p.state === ST.DIVE && p.dive) {
        this.diveStep(p, dt);
      } else if (p.state === ST.SLIDE) {
        const s = p.speed;
        const ns = Math.max(0, s - 7.5 * dt);
        if (s > 0) {
          p.vx *= ns / s;
          p.vy *= ns / s;
        }
      } else if (p.state === ST.DOWN) {
        p.vx *= 0.85;
        p.vy *= 0.85;
      } else {
        let ax = p.tvx - p.vx, ay = p.tvy - p.vy;
        const need = Math.sqrt(ax * ax + ay * ay);
        let amax = p.accel * dt;
        const cur = p.speed;
        const want = Math.sqrt(p.tvx * p.tvx + p.tvy * p.tvy);
        if (want < cur - 0.4 || p.tvx * p.vx + p.tvy * p.vy < 0) amax *= 1.7;
        if (p.stunT > 0) amax *= 0.35;
        if (p.state === ST.TACKLE) amax *= 0.4;
        if (this.ball.owner === p) amax *= 0.92;
        if (p.state === ST.CELEBRATE) amax *= 1.2;
        if (need > amax) {
          ax *= amax / need;
          ay *= amax / need;
        }
        p.vx += ax;
        p.vy += ay;
        // Speed cap (ball carriers are slightly slower).
        const cap = (this.ball.owner === p ? p.vmax * (0.82 + p.dri * 0.001) : p.vmax) * (p.state === ST.KICK ? 0.8 : 1);
        const s = p.speed;
        if (s > cap && p.state !== ST.TACKLE) {
          p.vx *= cap / s;
          p.vy *= cap / s;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = clamp(p.x, -4, L + 4);
      p.y = clamp(p.y, -3, W + 3);

      // Facing.
      const s = p.speed;
      if (p.state === ST.SLIDE || p.state === ST.DIVE || p.state === ST.DOWN) {
        // keep
      } else if (s > 0.35) {
        const own = this.ball.owner === p;
        const rate = (own ? 6.5 + p.dri * 0.035 : 11) * (s < 2.5 ? 1.8 : 1) * (p.skillT > 0 ? 3 : 1);
        rotateToward(p.fx, p.fy, p.vx / s, p.vy / s, rate * dt, tmp);
        p.fx = tmp[0];
        p.fy = tmp[1];
      } else if (this.ball.owner !== p && p.state !== ST.HOLD) {
        const b = this.ball;
        const dx = b.x - p.x, dy = b.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.5) {
          rotateToward(p.fx, p.fy, dx / d, dy / d, 5 * dt, tmp);
          p.fx = tmp[0];
          p.fy = tmp[1];
        }
      }
      // Gait phase: cadence rises with speed (about 2 steps/s walking, 4.5 sprinting).
      if (s > 0.3) p.anim += dt * (4.6 + s * 1.05);
    }
    this.separate();
  }

  diveStep(p, dt) {
    const dv = p.dive;
    dv.t += dt;
    if (dv.cancel && dv.t < dv.start + dv.dur * 0.5) {
      p.state = ST.RUN;
      p.dive = null;
      return;
    }
    if (dv.t < dv.start) {
      p.vx *= 0.8;
      p.vy *= 0.8;
      return;
    }
    const u = clamp((dv.t - dv.start) / dv.dur, 0, 1);
    const e = 1 - (1 - u) * (1 - u);
    const nx = dv.sx + (dv.tx - dv.sx) * e;
    const ny = dv.sy + (dv.ty - dv.sy) * e;
    p.vx = (nx - p.x) / dt;
    p.vy = (ny - p.y) / dt;
    p.x = nx - p.vx * dt; // movePlayers adds v*dt
    p.y = ny - p.vy * dt;
    p.z = dv.big ? Math.sin(u * Math.PI) * Math.min(0.9, dv.tz * 0.5) + (dv.tz > 1.4 ? u * (dv.tz - 1.4) * 0.5 : 0) : 0;
    if (dv.t > dv.start + dv.dur + 0.45) {
      p.state = ST.DOWN;
      p.stateT = 0.5;
      p.dive = null;
      p.z = 0;
    }
  }

  endState(p) {
    if (p.state === ST.SLIDE) {
      p.state = ST.DOWN;
      p.stateT = 0.45;
      return;
    }
    if (p.state === ST.DIVE) return;
    if (p.state === ST.HOLD) return;
    p.state = ST.RUN;
  }

  separate() {
    const ps = this.players;
    const n = ps.length;
    for (let i = 0; i < n; i++) {
      const a = ps[i];
      if (a.state === ST.DIVE || a.state === ST.SLIDE || a.state === ST.DOWN) continue;
      for (let j = i + 1; j < n; j++) {
        const b = ps[j];
        if (b.state === ST.DIVE || b.state === ST.SLIDE || b.state === ST.DOWN) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 0.56 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (0.75 - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        const wa = b.phy / (a.phy + b.phy), wb = 1 - wa;
        a.x -= nx * push * wa * 2;
        a.y -= ny * push * wa * 2;
        b.x += nx * push * wb * 2;
        b.y += ny * push * wb * 2;
      }
    }
  }

  // ---------------------------------------------------------------- restarts
  placeTeamsForKickoff(kicking) {
    for (const t of this.teams) {
      const att = t.index === kicking;
      for (const p of t.players) {
        p.state = ST.RUN;
        p.stateT = 0;
        p.dive = null;
        p.z = 0;
        p.vz = 0;
        p.stunT = 0;
        p.buffer = null;
        p.touchCD = 0;
        let lx, ly;
        if (p.isGK) {
          lx = 3;
          ly = CY;
        } else {
          const s = p.slot;
          lx = 12 + s.d * (att ? 34 : 28);
          ly = 34 + (s.l * 68 - 34) * 0.85;
          if (!att) lx = Math.min(lx, CX - CIRCLE_R - 1.2);
          else lx = Math.min(lx, CX - 1.5);
        }
        const x = t.wx(lx), y = t.wy(ly);
        p.reset(x, y);
        p.fx = t.dir;
        p.ai.hx = x;
        p.ai.hy = y;
        p.ai.hold = true;
        p.ai.spx = x;
        p.ai.spy = y;
      }
    }
  }

  setupKickoff(teamIdx) {
    this.phase = 'kickoff';
    this.phaseT = 0;
    this.placeTeamsForKickoff(teamIdx);
    const t = this.teams[teamIdx];
    // Taker: most advanced central player; partner: next one.
    const fw = t.players.filter((p) => !p.isGK).sort((a, b) => b.slot.d - a.slot.d || Math.abs(a.slot.l - 0.5) - Math.abs(b.slot.l - 0.5));
    const taker = fw[0], partner = fw[1];
    taker.x = t.wx(CX - 0.35);
    taker.y = CY;
    taker.fx = t.dir;
    taker.ai.spx = taker.x;
    taker.ai.spy = taker.y;
    partner.x = t.wx(CX - 2.5);
    partner.y = CY + 9;
    partner.ai.spx = partner.x;
    partner.ai.spy = partner.y;
    for (const p of this.players) {
      p.px = p.x;
      p.py = p.y;
    }
    const b = this.ball;
    b.reset(CX, CY);
    this.restart = { type: 'kickoff', team: teamIdx, taker, partner, x: CX, y: CY, wait: this.human === teamIdx ? 4.5 : 1.1, aimed: false };
    this.plan = null;
    this.offside = null;
    this.pendingPass = null;
    this.setPoss(teamIdx);
    this.kickoffTeam = teamIdx;
    if (this.human !== null) {
      const ht = this.teams[this.human];
      this.setControlled(teamIdx === this.human ? taker : this.bestDefender(ht));
    }
    this.emit('kickoff', { team: teamIdx });
    this.emit('cut');
  }

  setupRestart() {
    const r = this.restart;
    if (!r) {
      this.phase = 'play';
      return;
    }
    const t = this.teams[r.team];
    const b = this.ball;
    b.owner = null;
    for (const p of this.players) {
      p.ai.hold = false;
      p.buffer = null;
      p.dive = null;
      if (p.state === ST.DIVE || p.state === ST.HOLD || p.state === ST.SLIDE) p.state = ST.RUN;
      p.z = 0;
      p.vz = 0;
    }
    let taker = null;
    if (r.type === 'throw') {
      taker = this.closestOutfield(t, r.x, r.y);
      b.place(r.x, r.y === 0 ? -0.3 : W + 0.3, 0);
      this.movePlayer(taker, r.x, r.y === 0 ? -0.6 : W + 0.6, 0, r.y === 0 ? 1 : -1);
      this.clearZone(t.opp, r.x, r.y, 2.5);
    } else if (r.type === 'goalkick') {
      taker = t.gk;
      const lx = 5.5, ly = r.y < CY ? CY - 8 : CY + 8;
      b.place(t.wx(lx), t.wy(t.ly(ly)), 0);
      this.movePlayer(taker, b.x - t.dir * 0.8, b.y, t.dir, 0);
      // Opponents leave the box.
      for (const o of t.opp.players) {
        if (o.isGK) continue;
        const olx = t.lx(o.x);
        if (olx < BOX_D + 1.5) this.movePlayer(o, t.wx(BOX_D + 2 + this.rng() * 6), o.y, -t.dir, 0);
      }
    } else if (r.type === 'corner') {
      taker = this.bestCrosser(t);
      const cx = r.x === 0 ? 0.6 : L - 0.6, cy = r.y === 0 ? 0.6 : W - 0.6;
      b.place(cx, cy, 0);
      const ox = r.x === 0 ? -0.8 : L + 0.8, oy = r.y === 0 ? -0.8 : W + 0.8;
      this.movePlayer(taker, ox, oy, r.x === 0 ? 1 : -1, r.y === 0 ? 1 : -1);
      this.setpiecePositions(t, taker, cy < CY ? -1 : 1);
    } else if (r.type === 'freekick') {
      taker = this.bestShooter(t, r.x, r.y);
      const x = clamp(r.x, 1, L - 1), y = clamp(r.y, 1, W - 1);
      b.place(x, y, 0);
      const gx = t.oppGoalX;
      const dx = gx - x, dy = CY - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      this.movePlayer(taker, x - (dx / d) * 1.2, y - (dy / d) * 1.2, dx / d, dy / d);
      if (d < 36 && t.lx(x) > CX) {
        this.setpiecePositions(t, taker, y < CY ? -1 : 1);
        this.buildWall(t.opp, x, y, d < 25 ? 4 : 3);
      } else {
        this.clearZone(t.opp, x, y, CIRCLE_R);
      }
    } else if (r.type === 'penalty') {
      taker = this.bestShooter(t, 0, 0, true);
      const px = t.wx(L - PEN_D);
      b.place(px, CY, 0);
      this.movePlayer(taker, px - t.dir * 1.6, CY, t.dir, 0);
      const gk = t.opp.gk;
      this.movePlayer(gk, t.oppGoalX - t.dir * 0.3, CY, -t.dir, 0);
      for (const p of this.players) {
        if (p === taker || p === gk) continue;
        const lx = t.lx(p.x);
        const ly = t.ly(p.y);
        if (lx > L - BOX_D - 3 || dist(p.x, p.y, px, CY) < CIRCLE_R + 0.5) {
          this.movePlayer(p, t.wx(L - BOX_D - 3 - this.rng() * 5), t.wy(clamp(ly, 16, 52)), 0, 0);
        }
      }
    }
    if (!taker) taker = t.players[1];
    for (const p of this.players) {
      p.px = p.x;
      p.py = p.y;
    }
    r.taker = taker;
    const human = this.human === t.index;
    r.wait = human ? 6 : r.type === 'penalty' ? 1.8 : r.type === 'throw' ? 0.9 : 1.2;
    r.aimed = false;
    this.phase = 'setpiece';
    this.phaseT = 0;
    this.setPoss(t.index);
    if (this.human !== null) {
      const ht = this.teams[this.human];
      if (human) this.setControlled(taker);
      else this.setControlled(r.type === 'penalty' ? this.bestDefender(ht, ht.gk) : this.bestDefender(ht));
    }
    this.emit('cut');
    this.emit('setpiece', { restart: r.type, team: t.index, taker });
  }

  movePlayer(p, x, y, fx, fy) {
    p.x = x;
    p.y = y;
    p.vx = p.vy = 0;
    p.state = ST.RUN;
    p.stateT = 0;
    if (fx || fy) {
      const m = Math.sqrt(fx * fx + fy * fy);
      p.fx = fx / m;
      p.fy = fy / m;
    }
    p.ai.hold = true;
    p.ai.spx = x;
    p.ai.spy = y;
  }

  clearZone(team, x, y, r) {
    for (const o of team.players) {
      const d = dist(o.x, o.y, x, y);
      if (d < r) {
        const nx = (o.x - x) / (d || 1), ny = (o.y - y) / (d || 1);
        o.x = clamp(x + nx * r, 0.5, L - 0.5);
        o.y = clamp(y + ny * r, 0.5, W - 0.5);
      }
    }
  }

  closestOutfield(team, x, y) {
    let best = null, bd = 1e9;
    for (const p of team.players) {
      if (p.isGK) continue;
      const d = dist(p.x, p.y, x, y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  bestCrosser(team) {
    let best = null, bs = -1;
    for (const p of team.players) {
      if (p.isGK || p.role === 'def') continue;
      const s = p.pas + (p.role === 'mid' ? 4 : 0);
      if (s > bs) {
        bs = s;
        best = p;
      }
    }
    return best;
  }

  bestShooter(team, x, y, penalty = false) {
    let best = null, bs = -1;
    for (const p of team.players) {
      if (p.isGK) continue;
      const s = penalty ? p.sho * 1.2 + p.ovr * 0.3 : p.sho + p.pas * 0.6 - (x ? dist(p.x, p.y, x, y) * 0.05 : 0);
      if (s > bs) {
        bs = s;
        best = p;
      }
    }
    return best;
  }

  // Corner / free-kick box positions. side = -1 (ball near y=0) or +1.
  setpiecePositions(att, taker, side) {
    const def = att.opp;
    const spots = [
      [L - 5.5, CY - 3 * side],
      [L - 7, CY + 2.5 * side],
      [L - 11, CY - 0.5 * side],
      [L - 9, CY + 6.5 * side],
      [L - 14.5, CY - 5 * side],
      [L - 19, CY + 1 * side],
    ];
    const attackers = att.players
      .filter((p) => !p.isGK && p !== taker)
      .sort((a, b) => b.phy + b.sho - (a.phy + a.sho));
    const inBox = [];
    let k = 0;
    for (const p of attackers) {
      if (k < spots.length && (p.role !== 'def' || k < 2 || p.phy > 80)) {
        const [lx, ly] = spots[k++];
        this.movePlayer(p, att.wx(lx + this.rng.range(-0.8, 0.8)), att.wy(att.ly(ly)), att.dir, 0);
        inBox.push(p);
      } else {
        const lx = p.role === 'def' ? CX - 2 : L - 28;
        this.movePlayer(p, att.wx(lx), att.wy(clamp(att.ly(p.slot.l * W), 10, 58)), att.dir, 0);
      }
    }
    // Defenders mark goal-side; spare ones zonal near the posts / edge.
    const defenders = def.players.filter((p) => !p.isGK).sort((a, b) => b.def + b.phy - (a.def + a.phy));
    let i = 0;
    for (const a of inBox) {
      const d = defenders[i++];
      if (!d) break;
      const gx = att.oppGoalX;
      const nx = gx - a.x, ny = CY - a.y;
      const nl = Math.sqrt(nx * nx + ny * ny) || 1;
      this.movePlayer(d, a.x + (nx / nl) * 0.9, a.y + (ny / nl) * 0.9, -att.dir, 0);
      d.ai.mark = a;
    }
    const zonal = [
      [L - 1.5, CY - 3.2 * side],
      [L - 6, CY],
      [L - 17, CY],
      [CX + 8, CY - 10],
    ];
    let z = 0;
    for (; i < defenders.length; i++) {
      const d = defenders[i];
      const [lx, ly] = zonal[Math.min(z++, zonal.length - 1)];
      this.movePlayer(d, att.wx(lx), att.wy(att.ly(ly)), -att.dir, 0);
    }
    const gk = def.gk;
    this.movePlayer(gk, att.wx(L - 0.8), att.wy(att.ly(CY + 0.8 * side)), -att.dir, 0);
  }

  buildWall(def, x, y, n) {
    const gx = def.ownGoalX;
    const dx = gx - x, dy = CY - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / d, uy = dy / d;
    const cx = x + ux * CIRCLE_R, cy = y + uy * CIRCLE_R;
    const px = -uy, py = ux;
    const wall = def.players.filter((p) => !p.isGK).sort((a, b) => dist(a.x, a.y, cx, cy) - dist(b.x, b.y, cx, cy)).slice(0, n);
    // Shift wall towards the near post side.
    const shift = (y < CY ? -1 : 1) * 0.6;
    wall.forEach((p, i) => {
      const o = (i - (n - 1) / 2) * 0.62 + shift;
      this.movePlayer(p, cx + px * o, cy + py * o, -ux, -uy);
      p.ai.wall = true;
    });
    this.clearZone(def, x, y, CIRCLE_R - 0.3);
  }

  setpieceTick(dt) {
    const r = this.restart;
    if (!r || !r.taker) return;
    const taker = r.taker;
    const b = this.ball;
    // Keep the taker at the ball.
    taker.vx = taker.vy = 0;
    if (r.type === 'kickoff' || r.type === 'freekick' || r.type === 'penalty' || r.type === 'goalkick' || r.type === 'corner' || r.type === 'throw') {
      b.vx = b.vy = b.vz = 0;
    }
    r.wait -= dt;
    const human = this.human === r.team && taker.human;
    if (human && r.wait > 0) return;
    if (!human && r.wait > 0) return;
    this.ai[r.team].takeSetpiece(taker, r);
  }

  // ---------------------------------------------------------------- VS attack mode hooks
  attackTick() {}
  endAttackRound() {}
}

export { ST, STEP };
