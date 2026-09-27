// Computer riders. Every decision tick they pick a target line on the road:
// hunt a rider ahead to steal their speed, dodge a faster rider behind, and
// steer around cones, puddles, roadworks and tractors. Skill sets how far
// ahead they look and how cleanly they take bends.

import { SEG, STEER, CF, REF_SPEED, BIKE_W, BIKE_LEN, KMH, DRAFT_DIST } from '../config.js';
import { clamp, lerp } from '../util.js';

export function makeAI(p, rng) {
  return {
    skill: p.skill ?? 0.5,
    aggr: p.aggr ?? 0.3,
    dodge: p.dodge ?? 0,
    avoidRacers: !!p.avoidRacers,
    cruise: !!p.cruise,
    lane: rng.range(-0.6, 0.6),
    target: 0,
    think: rng.range(0, 0.3),
    wander: rng.range(0, 10),
    mode: 'cruise',
    victim: null,
  };
}

export function speedRatio(r) {
  return Math.pow(clamp(r.speed / REF_SPEED, 0.15, 2.6), 0.75);
}

export function aiSteer(race, r, dt) {
  const ai = r.ai;
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = lerp(0.42, 0.12, ai.skill) * race.rng.range(0.7, 1.3);
    plan(race, r, ai);
  }
  const seg = race.track.segAt(r.z + r.speed * 0.15);
  const sr = speedRatio(r);
  const lat = STEER * r.handling * sr;
  const drift = seg.curve * CF * sr;
  // Counter-steer the bend (weaker riders under-do it and drift wide).
  let steer = lat > 0 ? (drift / lat) * lerp(0.8, 1.0, ai.skill) : 0;
  let tx = ai.target;
  const v = ai.victim;
  if (v && !v.finished && v.immune <= 0 && ai.mode === 'attack') tx = clamp(v.x + v.vx * 0.25, -0.95, 0.95);
  else if (ai.mode === 'tow' && ai.tow && !ai.tow.finished) {
    // Stay in the slipstream, but pull out to pass once close and faster.
    const t = ai.tow;
    const close = t.z - r.z < BIKE_LEN * 3.5 && r.speed > t.speed + KMH;
    tx = close ? clamp(t.x + (r.x >= t.x ? 0.34 : -0.34), -0.88, 0.88) : t.x;
  }
  steer += clamp((tx - r.x) * lerp(2.4, 4.2, ai.skill), -1, 1);
  if (!ai.cruise) steer += Math.sin(race.time * 0.9 + ai.wander) * (1 - ai.skill) * 0.22;
  return clamp(steer, -1, 1);
}

function plan(race, r, ai) {
  const rng = race.rng;
  let target = ai.lane;
  ai.victim = null;
  ai.mode = 'cruise';
  if (rng() < 0.05) ai.lane = clamp(ai.lane + rng.range(-0.45, 0.45), -0.7, 0.7);

  if (!ai.cruise) {
    // 1. Hunt: a rider ahead we can catch.
    if (ai.aggr > 0 && r.wobble <= 0 && race.phase !== 'countdown') {
      let best = null, bestScore = 0;
      for (const o of race.racers) {
        if (o === r || o.finished || o.immune > 0) continue;
        const dz = o.z - r.z;
        if (dz < BIKE_LEN * 0.3 || dz > 2600) continue;
        const dx = Math.abs(o.x - r.x);
        if (dx > 1.1) continue;
        const closing = r.speed * (1 + 0.12 * r.draft) - o.speed;
        if (closing < -1.5 * KMH) continue;
        if (!race.canSteal(r, o)) continue;
        const score = (1 - dz / 2600) * (1.2 - dx) * (o.isPlayer ? 1.2 : 0.55) * (1 + Math.max(0, o.boost) / (25 * KMH));
        if (score > bestScore) {
          bestScore = score;
          best = o;
        }
      }
      if (best && rng() < ai.aggr * 1.25) {
        ai.victim = best;
        ai.mode = 'attack';
        target = best.x;
      }
    }
    // 2. Nobody to catch: tuck in behind a rider ahead for the slipstream.
    if (!ai.victim && rng() < 0.3 + 0.6 * ai.skill) {
      let tow = null;
      for (const o of race.racers) {
        if (o === r || o.finished) continue;
        const dz = o.z - r.z;
        if (dz < BIKE_LEN * 1.5 || dz > DRAFT_DIST * 1.4 || Math.abs(o.x - r.x) > 0.8) continue;
        if (!tow || dz < tow.z - r.z) tow = o;
      }
      if (tow) {
        target = tow.x;
        ai.tow = tow;
        ai.mode = 'tow';
      }
    }
    // 3. Dodge a faster rider closing in from behind.
    if (!ai.victim && ai.dodge > 0) {
      for (const o of race.racers) {
        if (o === r || o.finished) continue;
        const dz = r.z - o.z;
        if (dz < 0 || dz > 1200) continue;
        if (o.speed < r.speed + 3 * KMH || Math.abs(o.x - r.x) > 0.45) continue;
        if (rng() < ai.dodge) {
          const side = r.x >= o.x ? 1 : -1;
          target = r.x + side * 0.6;
          if (Math.abs(target) > 0.88) target = r.x - side * 0.6;
          ai.mode = 'dodge';
        }
        break;
      }
    }
  }
  // 4. Obstacles (and, for a careful rider, the other riders).
  const t2 = avoid(race, r, ai, target);
  if (t2 !== target) {
    ai.victim = null;
    ai.mode = 'avoid';
  }
  ai.target = clamp(t2, -0.88, 0.88);
}

function avoid(race, r, ai, target) {
  const look = 900 + r.speed * lerp(0.45, 1.0, ai.skill);
  const blockers = [];
  const tr = race.track;
  const i0 = Math.floor(r.z / SEG), i1 = Math.floor((r.z + look) / SEG);
  for (let i = i0; i <= i1 && i < tr.segments.length; i++) {
    for (const o of tr.segments[i].obs) {
      if (o.gone || o.z < r.z) continue;
      // Weaker riders miss some cones.
      if (o.k === 'cone' && ((o.seg * 7 + r.id * 13) % 100) / 100 > 0.45 + ai.skill * 0.6) continue;
      blockers.push(o);
    }
  }
  for (const t of tr.traffic) {
    if (!t.gone && t.z > r.z && t.z - r.z < look + 600) blockers.push(t);
  }
  if (ai.avoidRacers) {
    for (const o of race.racers) {
      if (o !== r && !o.finished && o.z > r.z && o.z - r.z < look * 0.6) blockers.push({ x: o.x, w: BIKE_W * 0.7, z: o.z });
    }
  }
  if (!blockers.length) return target;
  blockers.sort((a, b) => a.z - b.z);
  let t = target;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of blockers) {
      const need = o.w + BIKE_W * 0.6 + 0.05;
      if (Math.abs(t - o.x) >= need) continue;
      const left = o.x - need, right = o.x + need;
      const okL = left > -0.92, okR = right < 0.92;
      if (okL && okR) t = Math.abs(left - r.x) < Math.abs(right - r.x) ? left : right;
      else if (okL) t = left;
      else if (okR) t = right;
      moved = true;
    }
    if (!moved) break;
  }
  return t;
}
