// Player profile persisted in localStorage (coins, collection, squad, settings, stats).

import { PLAYERS, PLAYER_BY_ID } from '../data/players.js';
import { FORMATIONS, positionPenalty } from '../data/formations.js';
import { customTeam } from '../data/teams.js';
import { KITS } from '../data/nations.js';
import { shuffle } from '../util.js';

const KEY = 'gouden-elf-v1';

export const DEFAULT_SETTINGS = {
  sound: true,
  vibration: true,
  difficulty: 'amateur',
  duration: 5,
  zoom: 1,
  autoSwitch: true,
  assist: true,
  radar: true,
  lefty: false,
  buttonSize: 1,
  replays: true,
  fullscreen: true,
  offside: true,
};

function defaults() {
  return {
    v: 1,
    coins: 1500,
    owned: {},
    squad: { formation: '4-3-3', slots: [] },
    clubName: 'Mijn Elf',
    settings: { ...DEFAULT_SETTINGS },
    stats: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, cups: 0 },
    lastDaily: '',
    freePacks: ['welkom'],
    tutorialSeen: false,
    lastPick: ['ELF', 'ESP'],
    cup: null,
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
  // Drop unknown player ids (database changes between versions).
  for (const id of Object.keys(p.owned)) if (!PLAYER_BY_ID[id]) delete p.owned[id];
  if (!p.squad || !FORMATIONS[p.squad.formation]) p.squad = { formation: '4-3-3', slots: [] };
  p.squad.slots = (p.squad.slots || []).filter((id) => PLAYER_BY_ID[id]);
  if (Object.keys(p.owned).length < 11 || p.squad.slots.length !== 11) starterSquad(p);
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

// A solid but improvable starting XI (OVR 77-82) in 4-3-3.
function starterSquad(p) {
  const slots = FORMATIONS['4-3-3'];
  const used = new Set();
  const lineup = [];
  const pool = shuffle(PLAYERS.filter((c) => !c.legend && c.ovr >= 77 && c.ovr <= 82));
  for (const s of slots) {
    let pick = pool.find((c) => !used.has(c.id) && (c.pos === s.pos || c.alt.includes(s.pos)));
    if (!pick) pick = pool.find((c) => !used.has(c.id) && positionPenalty(c.pos, c.alt, s.pos) <= 3);
    if (!pick) pick = pool.find((c) => !used.has(c.id));
    used.add(pick.id);
    lineup.push(pick.id);
  }
  // A few reserves so squad building has options from the start.
  const reserves = pool.filter((c) => !used.has(c.id)).slice(0, 6);
  p.owned = {};
  for (const id of [...lineup, ...reserves.map((c) => c.id)]) p.owned[id] = 1;
  p.squad = { formation: '4-3-3', slots: lineup };
}

export function ownedCards(p) {
  return Object.keys(p.owned)
    .map((id) => PLAYER_BY_ID[id])
    .filter(Boolean);
}

export function myTeam(p) {
  const lineup = p.squad.slots.map((id) => PLAYER_BY_ID[id]);
  return customTeam(p.clubName || 'Mijn Elf', p.squad.formation, lineup, KITS.ELF);
}

// Best available XI for a formation from the collection.
export function bestXI(p, formation) {
  const slots = FORMATIONS[formation];
  const cards = ownedCards(p);
  const used = new Set();
  const out = new Array(slots.length);
  // Fill scarce roles first.
  const order = slots.map((s, i) => i).sort((a, b) => (slots[a].pos === 'GK' ? -1 : 0) - (slots[b].pos === 'GK' ? -1 : 0));
  for (const i of order) {
    let best = null, bv = -1;
    for (const c of cards) {
      if (used.has(c.id)) continue;
      const v = c.ovr - positionPenalty(c.pos, c.alt, slots[i].pos);
      if (v > bv) {
        bv = v;
        best = c;
      }
    }
    used.add(best.id);
    out[i] = best.id;
  }
  return out;
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
