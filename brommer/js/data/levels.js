// Levels. The first 15 are hand-tuned (3 per world, a boss at the end of each
// world). After that the game keeps going: every next level is a bit harder
// than the one before ("nog moeilijker dan dat").
//
// The core rule shapes the difficulty: the fastest opponents are a bit faster
// than the moped you can afford by then, and the boost from bumping someone
// lasts only a few seconds, so winning means bumping the others again and again.

import { THEMES, THEME_ORDER } from './themes.js';
import { BOSSES } from './riders.js';

export const MAIN_LEVELS = 15;

const TITLES = {
  1: 'Eerste ritje', 2: 'Langs de sloot', 3: 'Boer Bert',
  4: 'Tulpentocht', 5: 'Slingerweg', 6: 'Tulpen Tineke',
  7: 'Door de straatjes', 8: 'Werk in uitvoering', 9: 'De Burgemeester',
  10: 'Zon en zee', 11: 'Duinenrace', 12: 'Strandkoning Stan',
  13: 'Heuvel op, heuvel af', 14: 'Diep in het bos', 15: 'Koning Knetter',
};

// The field per main level, built around the moped you can afford by then if
// you win every level once (E, km/u): [E, fastest above E, slowest below E, opponents].
// A few riders are always slower than you: steal from them first to catch the rest.
const FIELD = {
  1: [40, -1, -10, 4], 2: [40, 1, -8, 5], 3: [44, 0, -9, 5],
  4: [44, 1, -8, 6], 5: [44, 2, -7, 6], 6: [48, 1, -8, 6],
  7: [48, 3, -8, 7], 8: [48, 3, -7, 7], 9: [52, 2, -8, 6],
  10: [52, 3, -8, 7], 11: [52, 4, -7, 7], 12: [52, 3, -7, 6],
  13: [56, 2, -8, 7], 14: [56, 3, -7, 7], 15: [56, 3, -6, 6],
};

const HILLS = { polder: 0.15, bollen: 0.25, stad: 0.45, strand: 0.6, bos: 1 };

export function isBossLevel(n) {
  return n % 3 === 0;
}

export function themeOf(n) {
  return THEME_ORDER[Math.floor((n - 1) / 3) % THEME_ORDER.length];
}

// After level 15 the worlds come round again, harder each time: "De Polder 2",
// "Mega Boer Bert", ... "De Polder 3".
function bossOf(n) {
  return BOSSES[((n - 1) % MAIN_LEVELS) + 1];
}

export function levelTitle(n) {
  if (TITLES[n]) return TITLES[n];
  if (isBossLevel(n)) return `Mega ${bossOf(n).name}`;
  return `${THEMES[themeOf(n)].name} ${1 + Math.floor((n - 1) / MAIN_LEVELS)}`;
}

export function levelConfig(n) {
  const extra = Math.max(0, n - MAIN_LEVELS);
  const k = Math.min(n, MAIN_LEVELS) - 1; // 0..14
  const theme = themeOf(n);
  const [E, up, down, n0] = FIELD[Math.min(n, MAIN_LEVELS)];
  let lo = E + down, hi = E + up, count = n0;
  if (extra) {
    lo += extra;
    hi += extra;
    count = isBossLevel(n) ? 6 : 7;
  }
  const skill = Math.min(0.96, 0.25 + 0.05 * k + 0.01 * extra);
  const aggr = Math.min(0.7, 0.04 + 0.035 * k + 0.01 * extra);
  const dodge = Math.min(0.6, Math.max(0, 0.045 * (k - 1)) + 0.01 * extra);
  const accel = Math.min(30, 15 + 0.6 * k + 0.2 * extra);
  const opponents = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 1;
    opponents.push({ top: lo + (hi - lo) * t, skill, aggr, dodge, accel, grab: 1 });
  }
  let boss = null;
  if (isBossLevel(n)) {
    const b = bossOf(n);
    boss = {
      name: extra ? `Mega ${b.name}` : b.name,
      color: b.color, helmet: b.helmet, hat: b.hat,
      top: hi + 2, skill: Math.min(0.98, skill + 0.15), aggr: Math.min(0.92, aggr + 0.2), dodge: Math.min(0.75, dodge + 0.15), accel: accel + 3, grab: 1.2,
    };
  }
  return {
    n,
    theme,
    title: levelTitle(n),
    boss,
    opponents,
    seed: 1009 + n * 7919,
    length: Math.min(2800, 1400 + 80 * k + 25 * extra),
    curveMax: Math.min(6, 2.2 + 0.3 * k),
    curveFreq: Math.min(0.75, 0.4 + 0.025 * k),
    hills: HILLS[theme] * Math.min(1, 0.45 + k / 14),
    cones: n >= 2 ? 2 + Math.min(n, 18) : 0,
    puddles: n >= 4 ? Math.min(8, n - 3) : 0,
    barriers: n >= 7 ? Math.min(10, Math.floor((n - 5) / 1.5)) : 0,
    tractors: n >= 5 ? Math.min(6, Math.floor((n - 2) / 3)) : 0,
    coins: 6 + Math.floor(Math.min(n, 20) / 2),
  };
}

// Coins for a podium finish; outside the top 3 you only keep the coins you picked up.
export function podiumReward(n, place) {
  const base = 300 + 140 * n;
  const share = [0, 1, 0.6, 0.35][place] || 0;
  return Math.round((base * share) / 10) * 10;
}

export const COIN_VALUE = 5;
