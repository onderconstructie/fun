// Race simulation: riders, physics, slipstream, bumping to steal speed,
// obstacles, coins and the finish. Pure logic (runs headless too); the app
// reads `events` after every step for sound, HUD and effects.

import {
  SEG, KMH, BIKE_W, BIKE_LEN, EDGE, STEER, CF, OFFROAD_TOP, BOOST_HALF, MAX_BOOST, TOP_CAP,
  STEAL_FRAC, STEAL_MIN, STEAL_MAX, SURGE, WOBBLE_T, IMMUNE_T, PAIR_COOLDOWN, START_GRACE, PERM_SHARE, PERM_FLOOR, ROOM, REGEN,
  DRAFT_DIST, DRAFT_W, DRAFT_TOP, DRAFT_ACC,
} from '../config.js';
import { Track } from './track.js';
import { makeAI, aiSteer, speedRatio } from './ai.js';
import { makeRng, clamp, lerp, approach, shuffle } from '../util.js';
import { RIDERS, RIDER_COLORS, RIDER_HELMETS, STYLES } from '../data/riders.js';

const BOOST_DECAY = Math.LN2 / BOOST_HALF;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class Race {
  // cfg: levelConfig(n). player: { name, moped, color, helmet, bot? }.
  constructor(cfg, player, attempt = 0) {
    this.cfg = cfg;
    this.track = new Track(cfg);
    this.rng = makeRng(cfg.seed * 31 + attempt * 977 + 5);
    this.time = 0;
    this.phase = 'countdown'; // countdown | race | finish (player is through) | done
    this.countdown = 3.4;
    this.lastCount = 4;
    this.events = [];
    this.finishOrder = [];
    this.stats = { steals: 0, robbed: 0, coins: 0, combo: 0, bestCombo: 0, topKmh: 0, hits: 0 };
    this.comboT = 0;
    this.createRiders(player);
    this.cool = this.racers.map(() => this.racers.map(() => 0));
    this.sorted = this.racers.slice();
    this.doneT = 0;
  }

  // ------------------------------------------------------------ setup
  createRiders(pl) {
    const cfg = this.cfg, rng = this.rng;
    const names = shuffle(RIDERS.slice(), makeRng(cfg.seed));
    const colors = shuffle(RIDER_COLORS.filter((c) => c !== pl.color), makeRng(cfg.seed + 1));
    const opp = cfg.opponents.map((o, i) => ({
      ...o,
      name: names[i],
      color: colors[i % colors.length],
      helmet: RIDER_HELMETS[(i * 3 + cfg.n) % RIDER_HELMETS.length],
      style: STYLES[(i + cfg.n) % STYLES.length],
    }));
    if (cfg.boss) opp.push({ ...cfg.boss, style: 'sport', isBoss: true });
    // Mixed grid order; the player always starts at the back.
    shuffle(opp, rng);
    this.racers = [];
    const rows = [];
    for (let i = 0; i < opp.length; i += 2) rows.push(opp.slice(i, i + 2));
    const frontZ = this.track.startZ - 120;
    let id = 0;
    rows.forEach((row, ri) => {
      row.forEach((o, k) => this.racers.push(this.makeRider(id++, o, false, k ? 0.45 : -0.45, frontZ - ri * 700)));
    });
    // Next to the last opponent if that row has room, otherwise alone behind.
    const lastRow = rows[rows.length - 1];
    const besides = lastRow && lastRow.length === 1;
    const px = besides ? 0.45 : 0;
    const pz = frontZ - (besides ? rows.length - 1 : rows.length) * 700;
    const m = pl.moped;
    this.player = this.makeRider(id++, { name: pl.name || 'Jij', color: pl.color, helmet: pl.helmet, style: m.style, top: m.top, accel: m.accel, handling: m.handling, grab: m.grab, skill: 1 }, true, px, pz);
    if (pl.bot) this.player.ai = makeAI(pl.bot, rng);
    this.racers.push(this.player);
  }

  makeRider(id, o, isPlayer, x, z) {
    return {
      id,
      name: o.name,
      color: o.color,
      helmet: o.helmet,
      style: o.style,
      hat: o.hat || null,
      isPlayer,
      isBoss: !!o.isBoss,
      base: o.top * KMH,
      base0: o.top * KMH,
      accel: o.accel * KMH,
      handling: o.handling ?? lerp(0.9, 1.1, o.skill ?? 0.5),
      grab: o.grab ?? 1,
      z,
      x,
      startZ: z,
      speed: 0,
      top: 0,
      boost: 0,
      draft: 0,
      drafting: null,
      wobble: 0,
      immune: 0,
      skid: 0,
      knock: 0,
      vx: 0,
      steer: 0,
      lean: 0,
      offroad: false,
      finished: false,
      finishTime: 0,
      place: 0,
      lastObs: null,
      obsT: 0,
      steals: 0,
      hornT: 0,
      ai: isPlayer ? null : makeAI(o, this.rng),
    };
  }

  // ------------------------------------------------------------ main step
  step(dt, input) {
    const ev = this.events;
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.4);
      if (n > 0 && n < this.lastCount) {
        this.lastCount = n;
        ev.push({ type: 'count', n });
      }
      if (this.countdown <= 0.4) {
        this.phase = 'race';
        ev.push({ type: 'go' });
      } else return;
    }
    this.time += dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.stats.combo = 0;
    }
    for (const r of this.racers) {
      const steer = r.ai ? aiSteer(this, r, dt) : input ? input.steer : 0;
      this.move(r, dt, steer);
    }
    for (const t of this.track.traffic) {
      if (t.gone) continue;
      t.z += t.speed * dt;
      if (t.z > this.track.length - 6 * SEG) t.gone = true;
    }
    this.sorted.sort((a, b) => a.z - b.z);
    this.slipstream(dt);
    this.collide();
    this.obstacles();
    this.pickCoins();
    this.checkFinish(dt);
    this.updatePlaces();
    const k = this.player.speed / KMH;
    if (k > this.stats.topKmh) this.stats.topKmh = k;
  }

  move(r, dt, steerIn) {
    const seg = this.track.segAt(r.z);
    if (r.wobble > 0) r.wobble = Math.max(0, r.wobble - dt);
    if (r.immune > 0) r.immune = Math.max(0, r.immune - dt);
    if (r.skid > 0) r.skid = Math.max(0, r.skid - dt);
    if (r.hornT > 0) r.hornT -= dt;
    r.obsT -= dt;
    r.offroad = Math.abs(r.x) > 1.02;
    r.boost *= Math.exp(-BOOST_DECAY * dt);
    if (r.base < r.base0) r.base = Math.min(r.base0, r.base + REGEN * KMH * dt);
    let top = (r.base + r.boost) * (1 + DRAFT_TOP * r.draft) * this.catchup(r);
    if (r.offroad) top = Math.min(top, r.base * OFFROAD_TOP);
    if (r.finished) top = Math.min(top, r.base * 0.75);
    top = Math.min(top, TOP_CAP);
    r.top = top;
    let acc = r.accel * (1 + DRAFT_ACC * r.draft);
    if (r.wobble > 0) acc *= 0.25;
    if (r.speed < top) r.speed = Math.min(top, r.speed + acc * (1 - 0.55 * (r.speed / top)) * dt);
    else r.speed = top + (r.speed - top) * Math.exp(-(r.offroad ? 2.6 : 0.9) * dt);

    const sr = speedRatio(r);
    let s = steerIn;
    if (r.wobble > 0) s = s * 0.4 + Math.sin(this.time * 17 + r.id * 2) * 0.45;
    if (r.skid > 0) s *= 0.15;
    r.steer += (s - r.steer) * Math.min(1, dt * (r.ai ? 8 : 12));
    const drift = seg.curve * CF * sr;
    r.vx = r.steer * STEER * r.handling * sr - drift + r.knock;
    r.knock *= Math.exp(-6 * dt);
    r.x += r.vx * dt;
    if (Math.abs(r.x) > EDGE) {
      r.x = Math.sign(r.x) * EDGE;
      r.knock = 0;
      r.speed *= Math.pow(0.6, dt);
    }
    r.z += r.speed * dt;
    r.lean += (clamp(r.steer * 0.9 - drift * 0.25, -1, 1) - r.lean) * Math.min(1, dt * 7);
  }

  // Keeps the race alive: riders far ahead of the player ease off a little and
  // riders far behind push on, so there is always someone to catch (or to fear).
  // Early levels help more than later ones.
  catchup(r) {
    if (r.isPlayer || r.finished || this.player.finished || this.phase !== 'race') return 1;
    const cu = Math.max(0.1, 0.24 - 0.01 * this.cfg.n);
    const gap = r.z - this.player.z;
    if (gap > 1500) return 1 - cu * smooth((gap - 1500) / 8000);
    if (gap < -5000) return 1 + cu * 0.3 * smooth((-gap - 5000) / 9000);
    return 1;
  }

  slipstream(dt) {
    const rs = this.sorted;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      let by = null;
      if (!r.finished) {
        for (let j = i + 1; j < rs.length; j++) {
          const a = rs[j];
          const dz = a.z - r.z;
          if (dz > DRAFT_DIST) break;
          if (dz < BIKE_LEN * 0.8 || a.finished) continue;
          if (Math.abs(a.x - r.x) < DRAFT_W) {
            by = a;
            break;
          }
        }
      }
      const on = by && r.speed > 15 * KMH ? 1 : 0;
      r.draft = approach(r.draft, on, dt * (on ? 1.3 : 2.6));
      r.drafting = by;
    }
  }

  // ------------------------------------------------------------ bumping & stealing
  canSteal(att, vic) {
    return this.phase !== 'countdown' && this.time > START_GRACE && !att.finished && !vic.finished && vic.immune <= 0 && att.wobble <= 0 && this.cool[att.id][vic.id] <= this.time;
  }

  collide() {
    const rs = this.sorted;
    for (let i = 0; i < rs.length; i++) {
      const a = rs[i];
      if (a.finished) continue;
      for (let j = i + 1; j < rs.length; j++) {
        const b = rs[j];
        const dz = b.z - a.z;
        if (dz >= BIKE_LEN) break;
        if (b.finished) continue;
        const dx = b.x - a.x;
        if (Math.abs(dx) >= BIKE_W) continue;
        this.contact(a, b, dx, dz);
      }
    }
  }

  contact(a, b, dx, dz) {
    // a is behind (or level with) b.
    let att = null, vic = null;
    const closing = a.speed - b.speed;
    if (dz > BIKE_LEN * 0.4) {
      if (closing > 1.5 * KMH) {
        att = a;
        vic = b;
      }
    } else {
      const lat = (a.vx - b.vx) * (dx >= 0 ? 1 : -1); // > 0: a moves into b
      if (lat > 0.3) {
        att = a;
        vic = b;
      } else if (lat < -0.3) {
        att = b;
        vic = a;
      } else if (closing > 3 * KMH) {
        att = a;
        vic = b;
      }
    }
    // Computer riders only rob each other on purpose; brushing past is just a bump.
    if (att && !att.isPlayer && !vic.isPlayer && !(att.ai.mode === 'attack' && att.ai.victim === vic)) att = null;
    if (att && this.canSteal(att, vic)) this.steal(att, vic);
    else this.separate(a, b, dx, dz);
  }

  // Did one of these two just rob the other? Then they slide past each other.
  justStole(a, b) {
    return this.cool[a.id][b.id] > this.time || this.cool[b.id][a.id] > this.time;
  }

  steal(att, vic) {
    const vk = vic.speed / KMH;
    // Diminishing returns: a rider already full of stolen speed gains less (no runaway leaders).
    const room = clamp(1 - this.stolen(att) / (ROOM * KMH), 0.3, 1);
    const gain = clamp(STEAL_FRAC * vk, STEAL_MIN, STEAL_MAX) * att.grab * room;
    const g = gain * KMH;
    // Part of it is yours for the rest of the race, the rest is a turbo that fades.
    const perm = clamp(g * PERM_SHARE, 0, vic.base - vic.base0 * PERM_FLOOR);
    att.base += perm;
    att.boost = Math.min(MAX_BOOST, att.boost + g - perm);
    att.speed = Math.min(TOP_CAP, att.speed + g * SURGE);
    // A strong grip (grab) also means you lose less when someone bumps you.
    const hold = 1 / vic.grab;
    vic.base -= perm * hold;
    vic.speed = Math.max(vic.base * 0.45, vic.speed - g * hold);
    vic.boost = Math.max(0, vic.boost - (g - perm) * hold);
    vic.wobble = WOBBLE_T;
    vic.immune = IMMUNE_T;
    const dir = Math.sign(vic.x - att.x) || (vic.x >= 0 ? 1 : -1);
    vic.knock = dir * 1.1;
    att.knock = -dir * 0.25;
    att.steals++;
    this.cool[att.id][vic.id] = this.time + PAIR_COOLDOWN;
    if (att.isPlayer) {
      this.stats.steals++;
      this.stats.combo = this.comboT > 0 ? this.stats.combo + 1 : 1;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
      this.comboT = 6;
    }
    if (vic.isPlayer) this.stats.robbed++;
    this.events.push({ type: 'steal', att, vic, gain: Math.round(gain), combo: att.isPlayer ? this.stats.combo : 0 });
  }

  // Speed on top of the rider's own moped: kept part + fading turbo.
  stolen(r) {
    return Math.max(0, r.base - r.base0) + r.boost;
  }

  separate(a, b, dx, dz) {
    const overlap = BIKE_W - Math.abs(dx);
    const dir = dx > 0 ? 1 : dx < 0 ? -1 : a.id < b.id ? -1 : 1;
    // Right after a steal the thief shoots past: no blocking, just a gentle nudge apart.
    if (this.justStole(a, b)) {
      a.x -= dir * overlap * 0.1;
      b.x += dir * overlap * 0.1;
      return;
    }
    a.x -= dir * overlap * 0.5;
    b.x += dir * overlap * 0.5;
    a.knock -= dir * 0.35;
    b.knock += dir * 0.35;
    // Running into someone you cannot rob (yet) means you are stuck behind them.
    if (dz > BIKE_LEN * 0.4 && a.speed > b.speed) a.speed = lerp(a.speed, b.speed, 0.6);
    if ((a.isPlayer || b.isPlayer) && overlap > 0.02) this.events.push({ type: 'bump', a, b });
  }

  // Toot! The rider right in front gets a fright: a short wobble and a little speed lost.
  horn(r) {
    if (this.phase !== 'race' || r.finished || r.hornT > 0) return false;
    r.hornT = 3;
    let best = null;
    for (const o of this.racers) {
      if (o === r || o.finished) continue;
      const dz = o.z - r.z;
      if (dz < BIKE_LEN * 0.5 || dz > 1800 || Math.abs(o.x - r.x) > 0.35) continue;
      if (!best || dz < best.z - r.z) best = o;
    }
    if (best) {
      best.wobble = Math.max(best.wobble, 0.35);
      best.speed *= 0.94;
    }
    this.events.push({ type: 'horn', r, target: best });
    return true;
  }

  // ------------------------------------------------------------ obstacles & coins
  obstacles() {
    const tr = this.track;
    for (const r of this.racers) {
      if (r.finished) continue;
      const i = Math.floor(r.z / SEG);
      for (let k = i - 1; k <= i + 1; k++) {
        const seg = tr.segments[k];
        if (!seg) continue;
        for (const o of seg.obs) {
          if (o.gone || Math.abs(o.z - r.z) > BIKE_LEN * 0.6) continue;
          if (Math.abs(o.x - r.x) < o.w + BIKE_W * 0.42) this.hit(r, o);
        }
      }
      for (const t of tr.traffic) {
        if (t.gone || Math.abs(t.z - r.z) > 230 || Math.abs(t.x - r.x) > t.w + BIKE_W * 0.45) continue;
        this.crash(r, t);
      }
    }
  }

  hit(r, o) {
    if (r.obsT > 0 && r.lastObs === o) return;
    r.lastObs = o;
    r.obsT = 0.7;
    if (o.k === 'cone') {
      r.speed *= 0.72;
      r.boost *= 0.6;
      r.wobble = Math.max(r.wobble, 0.45);
      o.gone = true;
      o.hitT = this.time;
      o.dir = Math.sign(o.x - r.x) || 1;
    } else if (o.k === 'puddle') {
      r.skid = 0.6;
      r.speed *= 0.88;
    } else if (o.k === 'barrier') {
      r.speed = Math.min(r.speed, r.base * 0.45);
      r.boost *= 0.3;
      r.wobble = 0.6;
      const side = Math.sign(r.x - o.x) || -Math.sign(o.x) || 1;
      r.x = o.x + side * (o.w + BIKE_W * 0.45 + 0.02);
    }
    if (r.isPlayer) this.stats.hits++;
    this.events.push({ type: o.k, r, o });
  }

  crash(r, t) {
    if (r.obsT > 0 && r.lastObs === t) return;
    r.lastObs = t;
    r.obsT = 1;
    const behind = r.z < t.z - 80;
    // Rear-ending the tractor stops you behind it; clipping its side knocks you away.
    r.speed = behind ? Math.min(r.speed, t.speed * 0.8) : r.speed * 0.7;
    if (behind) r.z = t.z - 240;
    r.boost *= 0.4;
    r.wobble = 0.5;
    const side = Math.sign(r.x - t.x) || -Math.sign(t.x) || 1;
    r.x = t.x + side * (t.w + BIKE_W * 0.5 + 0.03);
    r.knock = side * 0.6;
    if (r.ai) r.ai.think = 0;
    if (r.isPlayer) this.stats.hits++;
    this.events.push({ type: 'crash', r, o: t });
  }

  pickCoins() {
    const p = this.player;
    if (p.finished) return;
    const i = Math.floor(p.z / SEG);
    for (let k = i - 1; k <= i + 1; k++) {
      const seg = this.track.segments[k];
      if (!seg) continue;
      for (const c of seg.coins) {
        if (c.taken || Math.abs(c.z - p.z) > 160 || Math.abs(c.x - p.x) > 0.17) continue;
        c.taken = true;
        c.t = this.time;
        this.stats.coins++;
        this.events.push({ type: 'coin', c });
      }
    }
  }

  // ------------------------------------------------------------ finish & standings
  checkFinish(dt) {
    const L = this.track.length;
    for (const r of this.racers) {
      if (r.finished || r.z < L) continue;
      r.finished = true;
      r.finishTime = this.time - (r.z - L) / Math.max(1, r.speed);
      this.finishOrder.push(r);
      r.place = this.finishOrder.length;
      r.wobble = 0;
      r.draft = 0;
      if (r.isPlayer) {
        this.phase = 'finish';
        this.playerPlace = r.place;
        r.ai = makeAI({ skill: 0.9, aggr: 0, dodge: 0, cruise: true }, this.rng);
        r.ai.lane = clamp(r.x, -0.6, 0.6);
      }
      this.events.push({ type: 'finish', r, place: r.place });
    }
    if (this.phase === 'finish') {
      this.doneT += dt;
      const all = this.finishOrder.length === this.racers.length;
      if (all || this.doneT > 8) {
        this.phase = 'done';
        this.events.push({ type: 'done' });
      }
    }
  }

  updatePlaces() {
    let n = this.finishOrder.length;
    for (let i = this.sorted.length - 1; i >= 0; i--) {
      const r = this.sorted[i];
      if (!r.finished) r.place = ++n;
    }
  }

  // Final standings; riders still on the road get an estimated time.
  results() {
    const L = this.track.length;
    const list = this.racers.map((r) => {
      const time = r.finished ? r.finishTime : this.time + (L - r.z) / Math.max(r.speed, r.base * 0.8);
      return { r, time, est: !r.finished };
    });
    list.sort((a, b) => {
      if (a.r.finished !== b.r.finished) return a.r.finished ? -1 : 1;
      return a.time - b.time;
    });
    list.forEach((e, i) => (e.place = i + 1));
    return list;
  }

  progress(r) {
    return clamp((r.z - r.startZ) / (this.track.length - r.startZ), 0, 1);
  }
}
