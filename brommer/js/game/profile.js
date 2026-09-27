// Player profile persisted in localStorage: coins, mopeds, paint, level
// progress, settings and stats.

import { MOPED_BY_ID } from '../data/mopeds.js';

const KEY = 'brommer-finish-v1';

export const DEFAULT_SETTINGS = {
  sound: true,
  vibration: true,
  steer: 'touch', // touch | tilt
};

function defaults() {
  return {
    v: 1,
    coins: 0,
    owned: ['snorretje'],
    moped: 'snorretje',
    paint: {},
    helmet: '#f8fafc',
    name: '',
    unlocked: 1,
    best: {},
    settings: { ...DEFAULT_SETTINGS },
    stats: { races: 0, wins: 0, podiums: 0, steals: 0, coins: 0 },
    tutorialSeen: false,
  };
}

let memoryOnly = false;

export function loadProfile() {
  let p = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) p = JSON.parse(raw);
  } catch (e) {
    memoryOnly = true;
  }
  const d = defaults();
  if (!p || typeof p !== 'object') p = d;
  p = { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) }, stats: { ...d.stats, ...(p.stats || {}) } };
  // Mopeds can change between versions.
  p.owned = (Array.isArray(p.owned) ? p.owned : []).filter((id) => MOPED_BY_ID[id]);
  if (!p.owned.includes('snorretje')) p.owned.unshift('snorretje');
  if (!p.owned.includes(p.moped)) p.moped = 'snorretje';
  if (!p.paint || typeof p.paint !== 'object') p.paint = {};
  if (!(p.unlocked >= 1)) p.unlocked = 1;
  if (!Number.isFinite(p.coins) || p.coins < 0) p.coins = 0;
  return p;
}

export function saveProfile(p) {
  if (memoryOnly) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch (e) {
    memoryOnly = true;
    return false;
  }
}

export function storageAvailable() {
  return !memoryOnly;
}

export function resetProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* ignore */
  }
}

export function paintOf(p, id = p.moped) {
  return p.paint[id] || MOPED_BY_ID[id].color;
}

// What the race needs to know about the player's ride.
export function rideOf(p) {
  const moped = MOPED_BY_ID[p.moped];
  return { name: p.name || 'Jij', moped, color: paintOf(p), helmet: p.helmet };
}

// Book a finished race: podium coins, coins from the road, best place,
// unlocking the next level and stats. Returns what the results screen shows.
export function applyResult(p, race, podium, road) {
  const n = race.cfg.n;
  const place = race.playerPlace;
  const time = race.player.finishTime;
  const prev = p.best[n];
  if (!prev || place < prev.place || (place === prev.place && time < prev.time)) p.best[n] = { place, time: Math.round(time * 10) / 10 };
  let unlockedNew = false;
  if (place <= 3 && p.unlocked <= n) {
    p.unlocked = n + 1;
    unlockedNew = true;
  }
  p.coins += podium + road;
  const st = p.stats;
  st.races++;
  if (place === 1) st.wins++;
  if (place <= 3) st.podiums++;
  st.steals += race.stats.steals;
  st.coins += podium + road;
  return { place, podium, road, unlockedNew };
}
