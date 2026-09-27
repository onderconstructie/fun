// Packs: odds, opening and duplicate handling. Coins are earned by playing only.

import { PLAYERS, tierOf } from '../data/players.js';

export const PACKS = {
  welkom: { name: 'Welkom', price: 0, desc: '3 spelers · 1 wereldster gegarandeerd', cls: 'pk-free', free: true },
  dagelijks: { name: 'Dagelijks', price: 0, desc: 'Gratis · elke dag 1 speler', cls: 'pk-free', free: true },
  goud: { name: 'Goud', price: 1000, desc: '3 spelers · kans op sterren', cls: 'pk-goud' },
  elite: { name: 'Elite', price: 3000, desc: '3 spelers · 1× Elite of beter', cls: 'pk-elite' },
  ster: { name: 'Sterren', price: 7500, desc: '1 speler · Wereldster of Legende', cls: 'pk-ster' },
};

const BY_TIER = { goud: [], elite: [], ster: [], legende: [] };
for (const p of PLAYERS) BY_TIER[tierOf(p)].push(p);

function rollTier(rng, weights) {
  let r = rng() * weights.reduce((a, [, w]) => a + w, 0);
  for (const [t, w] of weights) {
    if ((r -= w) <= 0) return t;
  }
  return weights[0][0];
}

function pickFrom(rng, tier, exclude) {
  const list = BY_TIER[tier].filter((p) => !exclude.has(p.id));
  const src = list.length ? list : BY_TIER[tier];
  return src[Math.floor(rng() * src.length)];
}

const GOLD_ODDS = [['goud', 78], ['elite', 18], ['ster', 3.5], ['legende', 0.5]];

export function openPack(type, rng = Math.random) {
  const got = [];
  const ex = new Set();
  const add = (tier) => {
    const c = pickFrom(rng, tier, ex);
    ex.add(c.id);
    got.push(c);
  };
  if (type === 'welkom') {
    add('ster');
    add(rollTier(rng, [['goud', 70], ['elite', 30]]));
    add('goud');
  } else if (type === 'dagelijks') {
    add(rollTier(rng, GOLD_ODDS));
  } else if (type === 'goud') {
    for (let i = 0; i < 3; i++) add(rollTier(rng, GOLD_ODDS));
  } else if (type === 'elite') {
    add(rollTier(rng, [['elite', 80], ['ster', 17], ['legende', 3]]));
    add(rollTier(rng, GOLD_ODDS));
    add(rollTier(rng, GOLD_ODDS));
  } else if (type === 'ster') {
    add(rollTier(rng, [['ster', 80], ['legende', 20]]));
  }
  // Best card first (it gets the walkout).
  got.sort((a, b) => b.ovr + (b.legend ? 10 : 0) - (a.ovr + (a.legend ? 10 : 0)));
  return got;
}

export function sellValue(card) {
  if (card.legend) return 2500;
  return Math.max(100, Math.round((8 * Math.pow(Math.max(0, card.ovr - 70), 1.7)) / 10) * 10);
}

// Add cards to the profile; duplicates become coins. Returns [{card, dup, coins}].
export function addToCollection(profile, cards) {
  return cards.map((card) => {
    if (profile.owned[card.id]) {
      const coins = sellValue(card);
      profile.coins += coins;
      return { card, dup: true, coins };
    }
    profile.owned[card.id] = 1;
    return { card, dup: false, coins: 0 };
  });
}
