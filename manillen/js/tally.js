// Manillen: the scoreboard for games with real cards. No screen code here, so it can be tested.
// The rounds are the only source of truth: scores are always recalculated from them with the
// game's own scoring, so a corrected or deleted round can never leave a wrong total behind.

import { scoreDeal, TARGETS, DEFAULT_RULES } from './engine.js';

export const NAME_MAX = 14;
export const RECENT_MAX = 20;

export const cleanName = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
const teamOf = (mode, p) => (mode === 4 ? p % 2 : p);
const seatsOf = (mode, team) => (mode === 4 ? [team, team + 2] : [team]);

export const seatName = (t, p) => t.names[p] || `Speler ${p + 1}`;
export const teamNames = (t, team) => seatsOf(t.mode, team).map((p) => t.names[p]).filter(Boolean);
export function teamLabel(t, team) {
  const n = teamNames(t, team);
  if (n.length) return n.join(' & ');
  return t.mode === 4 ? ['Wij', 'Zij'][team] : `Speler ${team + 1}`;
}
export const isPlural = (t, team) => {
  const n = teamNames(t, team).length;
  return n > 1 || (n === 0 && t.mode === 4);
};
export const dealerOf = (t, roundIndex) => (t.firstDealer + roundIndex) % t.mode;

export function validRound(r) {
  return !!r && Array.isArray(r.taken) && r.taken.length === 2 && r.taken.every((n) => Number.isInteger(n) && n >= 0 && n <= 60) && r.taken[0] + r.taken[1] === 60;
}

// The score of one round, given how many 30-30 rounds came right before it.
export function scoreRound(rules, r, carry) {
  const won = [1, 1];
  if (r.alle && r.taken[0] !== r.taken[1]) won[r.taken[0] > r.taken[1] ? 1 : 0] = 0;
  return scoreDeal(rules, r.taken, won, {
    carry,
    trump: r.zonder || r.blind ? null : 'x',
    blind: !!r.blind,
    mee: r.mee ? 1 : null,
    terug: r.mee && r.terug ? 1 : null,
  });
}

export function replay(t, upTo = t.rounds.length) {
  const scores = [0, 0];
  const log = [];
  let carry = 0;
  let winner = null;
  t.rounds.slice(0, upTo).forEach((r, i) => {
    const s = scoreRound(t.rules, r, carry);
    if (s.tie) carry = t.rules.gelijkDubbel ? carry + 1 : 0;
    else {
      scores[s.winTeam] += s.gained;
      carry = 0;
    }
    log.push({ n: i + 1, taken: r.taken.slice(), mult: s.mult, base: s.base, gained: s.gained, winTeam: s.winTeam, scores: scores.slice() });
    if (winner === null && (scores[0] >= t.rules.target || scores[1] >= t.rules.target)) winner = scores[0] >= t.rules.target ? 0 : 1;
  });
  return { log, scores, carry, over: winner !== null, winner };
}

// Plain text to send to others: the stand, every round, and where the game is.
export function shareText({ players, log, scores, target, winner = null, series = null, url = '' }) {
  const a = teamLabel(players, 0);
  const b = teamLabel(players, 1);
  const n = log.length;
  const lines = [winner === null ? `Manillen: tussenstand na ${n} ${n === 1 ? 'ronde' : 'rondes'}` : `Manillen: eindstand na ${n} ${n === 1 ? 'ronde' : 'rondes'}`];
  if (winner !== null) lines.push(`${teamLabel(players, winner)} ${isPlural(players, winner) ? 'winnen' : 'wint'}!`);
  lines.push('', `${a}: ${scores[0]}`, `${b}: ${scores[1]}`, `Spelen tot ${target}`);
  if (series) lines.push(`Gewonnen spellen: ${series[0]}-${series[1]}`);
  if (n) lines.push('');
  for (const l of log) {
    if (l.winTeam === null) lines.push(`Ronde ${l.n}: gelijk (30-30)`);
    else lines.push(`Ronde ${l.n}: ${l.taken[0]}-${l.taken[1]}${l.mult > 1 ? ` x${l.mult}` : ''}, +${l.gained} voor ${teamLabel(players, l.winTeam)}`);
  }
  if (url) lines.push('', url);
  return lines.join('\n');
}

export const emptyStore = () => ({ v: 1, current: null, last: null, recent: [] });

const sameTeams = (a, mode, names) => !!a && a.mode === mode && JSON.stringify(a.names) === JSON.stringify(names);

export function startGame(store, { mode, names, target, rules, firstDealer, id }) {
  const clean = Array.from({ length: mode }, (_, p) => cleanName(names[p]));
  const series = sameTeams(store.last, mode, clean) ? store.last.series : [0, 0];
  store.last = { mode, names: clean, target, series };
  store.current = {
    v: 1,
    id,
    mode,
    names: clean,
    rules: { ...DEFAULT_RULES, ...rules, target },
    firstDealer: ((firstDealer % mode) + mode) % mode,
    rounds: [],
  };
  return store.current;
}

// Puts a finished game in the results. Only leaves the game when it really is over.
export function finishGame(store, at = Date.now()) {
  const t = store.current;
  if (!t) return false;
  const r = replay(t);
  if (!r.over) return false;
  store.recent.unshift({ id: t.id, at, mode: t.mode, names: t.names, target: t.rules.target, scores: r.scores, winner: r.winner, log: r.log });
  store.recent.length = Math.min(store.recent.length, RECENT_MAX);
  if (store.last) store.last.series[r.winner]++;
  store.current = null;
  return true;
}

// Same players again; the deal simply moves on.
export function nextGame(store, id) {
  const t = store.current;
  if (!t || !replay(t).over) return null;
  const firstDealer = dealerOf(t, t.rounds.length);
  const { mode, names, rules } = t;
  finishGame(store);
  return startGame(store, { mode, names, rules, target: rules.target, firstDealer, id });
}

// Whatever is in storage: keep what is usable, never crash on it.
const okNames = (n, mode) => Array.isArray(n) && n.length === mode && n.every((s) => typeof s === 'string');
const okMode = (m) => m === 2 || m === 4;
const okCount = (n) => Number.isInteger(n) && n >= 0;
function okTally(t) {
  return !!t && okMode(t.mode) && okNames(t.names, t.mode) && typeof t.rules === 'object' && !!t.rules && TARGETS.includes(t.rules.target)
    && Number.isInteger(t.firstDealer) && t.firstDealer >= 0 && t.firstDealer < t.mode && Array.isArray(t.rounds) && t.rounds.every(validRound);
}
function okResult(r) {
  return !!r && okMode(r.mode) && okNames(r.names, r.mode) && Array.isArray(r.scores) && r.scores.length === 2 && (r.winner === 0 || r.winner === 1) && Array.isArray(r.log);
}
export function normalizeStore(x) {
  const s = emptyStore();
  if (!x || x.v !== 1) return s;
  if (okTally(x.current)) s.current = { ...x.current, rules: { ...DEFAULT_RULES, ...x.current.rules }, names: x.current.names.map(cleanName) };
  const l = x.last;
  if (l && okMode(l.mode) && okNames(l.names, l.mode)) {
    s.last = {
      mode: l.mode,
      names: l.names.map(cleanName),
      target: TARGETS.includes(l.target) ? l.target : DEFAULT_RULES.target,
      series: Array.isArray(l.series) && l.series.length === 2 && l.series.every(okCount) ? l.series.slice() : [0, 0],
    };
  }
  if (Array.isArray(x.recent)) s.recent = x.recent.filter(okResult).slice(0, RECENT_MAX);
  return s;
}

export { teamOf };
