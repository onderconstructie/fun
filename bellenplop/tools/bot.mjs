// Plays every level headless to check difficulty and set the star thresholds.
//   node tools/bot.mjs            -> table per level
// Two players: "sterk" tries 160 angles and swaps when that is better,
// "gewoon" only looks at 12 random angles (a rough stand-in for a casual player).
// The thresholds in levels.js (STAR_RATIO) were read off this table.

import { Game, isColor, MAX_ROWS } from '../js/engine.js';
import { makeLevel, makeEndless, LEVEL_COUNT, starsFor } from '../js/levels.js';
import { makeRng } from '../js/util.js';

function evaluate(g, cell, v) {
  if (!cell) return -99;
  const [r, c] = cell;
  g.grid[r][c] = v;
  const group = g.flood(r, c);
  let score = 0;
  const removed = [];
  if (isColor(v) && group.length >= 3) {
    for (const [a, b] of group) removed.push([a, b, g.grid[a][b]]), (g.grid[a][b] = -1);
    score += group.length;
    // count what would fall, without changing the grid
    const seen = new Set();
    const st = [];
    for (let k = 0; k < g.cols(0); k++) if (g.grid[0][k] >= 0) seen.add(k), st.push([0, k]);
    while (st.length) {
      const [a, b] = st.pop();
      for (const [x, y] of g.neighbors(a, b)) {
        const key = x * 11 + y;
        if (!seen.has(key) && g.grid[x][y] >= 0) seen.add(key), st.push([x, y]);
      }
    }
    let fall = 0;
    for (let a = 0; a < MAX_ROWS; a++) for (let b = 0; b < g.cols(a); b++) if (g.grid[a][b] >= 0 && !seen.has(a * 11 + b)) fall++;
    score += fall * 1.6;
  } else {
    score = (group.length - 1) * 0.45 - r * 0.06;
  }
  for (const [a, b, val] of removed) g.grid[a][b] = val;
  g.grid[r][c] = -1;
  return score;
}

function choose(g, rng, kind) {
  const angles = [];
  if (kind === 'sterk') for (let i = 0; i <= 160; i++) angles.push(((10 + i) * Math.PI) / 180);
  else for (let i = 0; i < 12; i++) angles.push(((10 + rng() * 160) * Math.PI) / 180);
  let best = { s: -Infinity, a: Math.PI / 2, swap: false };
  for (const swap of kind === 'sterk' ? [false, true] : [false]) {
    const v = swap ? g.next : g.current;
    for (const a of angles) {
      const s = evaluate(g, g.trace(a).cell, v) - (swap ? 0.05 : 0);
      if (s > best.s) best = { s, a, swap };
    }
  }
  return best;
}

function play(level, seed, kind, mode = 'level') {
  const g = new Game({ mode, level, seed });
  const rng = makeRng(seed * 31 + 7);
  let guard = 0;
  while (g.state === 'aim' && guard++ < 400) {
    const m = choose(g, rng, kind);
    if (m.swap) g.swap();
    g.shootNow(m.a);
  }
  return { won: g.state === 'won', shots: g.shots, start: g.startCount, score: g.score, ceiling: g.ceiling };
}

const N = 24;
const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
console.log('lvl  bel  | sterk: win  ratio  sterren | gewoon: win  ratio  sterren');
const allRatios = { sterk: [], gewoon: [] };
const shotsWon = {};
const par = [];
for (let n = 1; n <= LEVEL_COUNT; n++) {
  const lv = makeLevel(n);
  const row = [`${String(n).padStart(3)}`, String(makeLevel(n).rows.flat().filter((v) => v >= 0).length).padStart(4)];
  for (const kind of ['sterk', 'gewoon']) {
    let wins = 0, ratio = 0, stars = [0, 0, 0, 0];
    shotsWon[kind] = [];
    for (let s = 1; s <= N; s++) {
      const res = play(makeLevel(n), s, kind);
      if (res.won) {
        wins++;
        ratio += res.shots / res.start;
        allRatios[kind].push(res.shots / res.start);
        shotsWon[kind].push(res.shots);
        stars[starsFor(n, res.shots)]++;
      }
    }
    row.push(`| ${pct(wins / N)}  ${(wins ? ratio / wins : 0).toFixed(2)}  ${stars.slice(1).join('/')}`);
  }
  const q = (arr, p) => arr.sort((a, b) => a - b)[Math.floor(p * (arr.length - 1))] ?? 99;
  par.push([q(shotsWon.sterk, 0.75), Math.max(q(shotsWon.sterk, 0.75) + 2, q(shotsWon.gewoon, 0.5))]);
  console.log(row.join('  '));
  void lv;
}
for (const k of ['sterk', 'gewoon']) {
  const a = allRatios[k].sort((x, y) => x - y);
  const q = (p) => a[Math.floor(p * (a.length - 1))]?.toFixed(2);
  console.log(`${k}: ratio p25 ${q(0.25)}  p50 ${q(0.5)}  p75 ${q(0.75)}`);
}
console.log('PAR = ' + JSON.stringify(par));
if (process.env.PAR) {
  const fs = await import('node:fs');
  const f = new URL('../js/levels.js', import.meta.url);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/export const PAR = .*;/, `export const PAR = ${JSON.stringify(par)};`));
  console.log('PAR geschreven naar js/levels.js');
}
// Endless: how long does a run last?
for (const kind of ['sterk', 'gewoon']) {
  const shots = [], scores = [];
  for (let s = 1; s <= 10; s++) {
    const r = play(makeEndless(s), s, kind, 'endless');
    shots.push(r.shots), scores.push(r.score);
  }
  console.log(`eindeloos ${kind}: schoten ${shots.join(',')}  score mediaan ${scores.sort((a, b) => a - b)[5]}`);
}
