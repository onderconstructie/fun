// Manillen: computer players. They only use what a real player at the table could know:
// their own cards, the open table cards, the cards already played and who could not follow suit.

import { SUITS, suitOf, strength, points, beats, winnerIndex, available, legalFor, teamOfFor, makeDeck } from './engine.js';

const TRUMP_VAL = [2, 2.2, 2.5, 3, 3.5, 4, 5, 6]; // 7 .. 10

function bySuit(cards) {
  const m = { h: [], k: [], r: [], s: [] };
  for (const c of cards) m[suitOf(c)].push(c);
  for (const s of SUITS) m[s].sort((a, b) => strength(b) - strength(a));
  return m;
}
const has = (list, rank) => list.some((c) => c.slice(1) === rank);

// How good is this hand with suit t as trump?
export function suitScore(cards, t) {
  const m = bySuit(cards);
  let v = 0;
  for (const c of m[t]) v += TRUMP_VAL[strength(c)];
  for (const s of SUITS) {
    if (s === t) continue;
    const l = m[s];
    if (has(l, '10')) v += 3;
    if (has(l, '10') && has(l, 'A')) v += 2;
    else if (has(l, 'A') && l.length >= 3) v += 0.6;
    if (has(l, '10') && has(l, 'A') && has(l, 'H')) v += 1;
    if (m[t].length >= 3) {
      if (!l.length) v += 1.2;
      else if (l.length === 1 && !has(l, '10')) v += 0.5;
    }
  }
  return v;
}

// How good is this hand without trump? Counts the top cards you can cash in each suit.
export function zonderScore(cards) {
  const m = bySuit(cards);
  let v = 0;
  for (const s of SUITS) {
    const l = m[s];
    if (has(l, '10')) {
      v += 4;
      if (has(l, 'A')) {
        v += 3;
        if (has(l, 'H')) v += 2;
      }
      if (l.length >= 4) v += 1;
    } else if (l.length) v -= 1.5;
  }
  return v;
}

function scale(g) {
  return g.mode === 4 ? 1 : 1.3; // with two players you see 12 of your own cards at the start
}
const zk = (g) => (g.mode === 4 ? 1 : 1.6);
function ownKnown(g, p) {
  return available(g, p);
}

export function decideBlind(g, p) {
  // Only when far behind: a gamble that can turn the game around.
  const t = g.rules.target;
  const me = teamOfFor(g.mode)(p);
  return g.scores[1 - me] - g.scores[me] >= t * 0.45 && Math.random() < 0.5;
}

export function decideTrump(g, p, canPass) {
  const cards = ownKnown(g, p);
  let best = SUITS[0];
  let bv = -1;
  for (const s of SUITS) {
    const v = suitScore(cards, s);
    if (v > bv) (bv = v), (best = s);
  }
  const z = zonderScore(cards);
  const k = scale(g);
  if (z >= 10.5 * zk(g) && z > bv * 0.7) return 'zonder';
  if (canPass && bv < 11.5) return 'pass';
  return best;
}

export function decideMee(g, p) {
  const d = g.deal;
  const cards = ownKnown(g, p);
  const k = scale(g);
  if (d.trump === null) return zonderScore(cards) >= 11 * zk(g);
  const trumps = cards.filter((c) => suitOf(c) === d.trump);
  const top = has(trumps, '10') || has(trumps, 'A');
  return suitScore(cards, d.trump) >= 16 * k || (trumps.length >= (g.mode === 4 ? 4 : 5) && top && suitScore(cards, d.trump) >= 14 * k);
}

export function decideTerug(g, p) {
  const d = g.deal;
  const cards = ownKnown(g, p);
  const k = scale(g);
  if (d.trump === null) return zonderScore(cards) >= 13 * zk(g);
  return suitScore(cards, d.trump) >= (p === d.chooser ? 20 : 15) * k;
}

// ---------- card play ----------

function knowledge(g, p) {
  const d = g.deal;
  const n = g.mode;
  const seen = new Set(ownKnown(g, p));
  const visible = Array.from({ length: n }, () => []);
  if (d.stacks)
    for (let q = 0; q < n; q++) if (q !== p) for (const s of d.stacks[q]) if (s.length) visible[q].push(s[s.length - 1]), seen.add(s[s.length - 1]);
  const voids = Array.from({ length: n }, () => new Set());
  const scan = (cards) => {
    const led = suitOf(cards[0].c);
    for (const x of cards) {
      seen.add(x.c);
      if (suitOf(x.c) !== led) voids[x.p].add(led);
    }
  };
  for (const t of d.tricks) scan(t.cards);
  if (d.trick.length) scan(d.trick);
  const unseen = makeDeck().filter((c) => !seen.has(c));
  return { unseen, visible, voids };
}

// Could seat q still hold a card that beats `card` (the winner) when `led` was led?
function couldBeat(q, card, led, trump, kn) {
  const vis = kn.visible[q];
  const pool = kn.unseen.filter((c) => !kn.voids[q].has(suitOf(c))).concat(vis);
  const ledLeft = pool.filter((c) => suitOf(c) === led).length;
  // q can only trump in when q has no card of the led suit left; with few of them out, that is a real risk
  const mayTrump = kn.voids[q].has(led) || ledLeft <= 2;
  for (const c of pool) {
    if (!beats(c, card, trump)) continue;
    const s = suitOf(c);
    if (s === led) return true;
    if (trump != null && s === trump && mayTrump) return true;
  }
  return false;
}

function laterOpponents(g, p) {
  const d = g.deal;
  const n = g.mode;
  const team = teamOfFor(n);
  const out = [];
  for (let i = d.trick.length + 1; i < n; i++) {
    const q = (p + i - d.trick.length) % n;
    if (team(q) !== team(p)) out.push(q);
  }
  return out;
}

function discardCost(c, trump) {
  let v = points(c) * 2 + strength(c) * 0.15;
  if (trump != null && suitOf(c) === trump) v += 4 + strength(c);
  return v;
}
const cheapest = (cards, trump) => cards.slice().sort((a, b) => discardCost(a, trump) - discardCost(b, trump))[0];

// Picks a card and says in one short reason code why (the Tip button explains it to the player).
export function decidePlayWhy(g, p) {
  const d = g.deal;
  const { legal } = legalFor(g, p);
  if (legal.length === 1) return { card: legal[0], why: 'enige' };
  const trump = d.trump;
  const kn = knowledge(g, p);
  const team = teamOfFor(g.mode);
  const opps = Array.from({ length: g.mode }, (_, q) => q).filter((q) => team(q) !== team(p));

  // ---- leading ----
  if (!d.trick.length) {
    const sure = legal.filter((c) => !opps.some((q) => couldBeat(q, c, suitOf(c), trump, kn)));
    // a high card that should win: cash the one with most points
    if (sure.length) {
      const nonTrump = sure.filter((c) => suitOf(c) !== trump);
      const pool = nonTrump.length ? nonTrump : sure;
      return { card: pool.sort((a, b) => points(b) - points(a) || strength(b) - strength(a))[0], why: 'zeker' };
    }
    const mine = legal.filter((c) => trump != null && suitOf(c) === trump);
    const makers = team(d.chooser) === team(p);
    if (trump != null && makers && mine.length >= 3 && kn.unseen.some((c) => suitOf(c) === trump)) {
      return { card: mine.sort((a, b) => strength(a) - strength(b))[0], why: 'troefhalen' }; // pull trumps with a small one
    }
    // otherwise lead something cheap; do not lead an ace while that manille is still out
    const scored = legal.map((c) => {
      let v = discardCost(c, trump);
      if (c.slice(1) === 'A' && kn.unseen.includes(suitOf(c) + '10')) v += 6;
      if (c.slice(1) === 'H' && (kn.unseen.includes(suitOf(c) + '10') || kn.unseen.includes(suitOf(c) + 'A'))) v += 3;
      return { c, v };
    });
    scored.sort((a, b) => a.v - b.v);
    return { card: scored[0].c, why: 'laag-uit' };
  }

  // ---- following ----
  const led = suitOf(d.trick[0].c);
  const wi = winnerIndex(d.trick.map((t) => t.c), trump);
  const win = d.trick[wi];
  const later = laterOpponents(g, p);
  const trickPts = d.trick.reduce((s, t) => s + points(t.c), 0);
  const winners = legal.filter((c) => beats(c, win.c, trump));
  const safe = (c) => !later.some((q) => couldBeat(q, c, led, trump, kn));

  if (team(win.p) === team(p)) {
    if (safe(win.c)) {
      // partner wins: throw points on it, but keep trumps
      const card = legal.slice().sort((a, b) => {
        const va = points(a) - (suitOf(a) === trump ? 3 + strength(a) * 0.5 : 0);
        const vb = points(b) - (suitOf(b) === trump ? 3 + strength(b) * 0.5 : 0);
        return vb - va;
      })[0];
      return { card, why: points(card) ? 'partner-punten' : 'partner-laag' };
    }
    const safeW = winners.filter(safe);
    if (safeW.length && trickPts >= 3) return { card: safeW.sort((a, b) => points(b) - points(a))[0], why: 'pakken-zeker' };
    return { card: cheapest(legal, trump), why: 'goedkoop' };
  }

  const safeW = winners.filter(safe);
  if (safeW.length) {
    const sameSuit = safeW.filter((c) => suitOf(c) === led && suitOf(c) !== trump);
    if (sameSuit.length) return { card: sameSuit.sort((a, b) => points(b) - points(a) || strength(a) - strength(b))[0], why: 'pakken-zeker' };
    return { card: safeW.sort((a, b) => strength(a) - strength(b))[0], why: suitOf(safeW[0]) === trump && led !== trump ? 'kopen-laag' : 'pakken-zeker' };
  }
  if (winners.length && trickPts >= 4) return { card: winners.sort((a, b) => strength(b) - strength(a))[0], why: 'gokken' };
  return { card: cheapest(legal, trump), why: 'goedkoop' };
}

export function decidePlay(g, p) {
  return decidePlayWhy(g, p).card;
}

export function decide(g, pd) {
  switch (pd.type) {
    case 'blind': return { type: 'blind', yes: decideBlind(g, pd.p) };
    case 'trump': return { type: 'trump', choice: decideTrump(g, pd.p, pd.canPass) };
    case 'mee': return { type: 'mee', yes: decideMee(g, pd.p) };
    case 'terug': return { type: 'terug', yes: decideTerug(g, pd.p) };
    case 'play': return { type: 'play', card: decidePlay(g, pd.p) };
  }
  return null;
}

