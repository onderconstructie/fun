// Manillen: the rules engine. Pure game logic, no DOM, so it can be tested on its own.
//
// Seats with four players (clockwise): 0 = jij (onder), 1 = links, 2 = partner (boven), 3 = rechts.
// Team = seat % 2, so team 0 is jij + partner. With two players: 0 = jij, 1 = tegenspeler.
// Card ids: suit letter + rank, for example 'h10' (harten manille), 'sA' (schoppen aas).

import { shuffle } from './util.js';

export const SUITS = ['h', 'k', 'r', 's']; // harten, klaveren, ruiten, schoppen
export const SUIT_NAME = { h: 'harten', k: 'klaveren', r: 'ruiten', s: 'schoppen' };
export const RED = { h: true, r: true, k: false, s: false };
export const RANKS = ['7', '8', '9', 'B', 'V', 'H', 'A', '10']; // low to high
export const RANK_NAME = { 7: 'zeven', 8: 'acht', 9: 'negen', B: 'boer', V: 'vrouw', H: 'heer', A: 'aas', 10: 'manille' };
const PTS = { 10: 5, A: 4, H: 3, V: 2, B: 1 };

export const suitOf = (c) => c[0];
export const rankOf = (c) => c.slice(1);
export const strength = (c) => RANKS.indexOf(rankOf(c));
export const points = (c) => PTS[rankOf(c)] || 0;
export const cardName = (c) => `${SUIT_NAME[suitOf(c)]} ${RANK_NAME[rankOf(c)]}`;

// The classic rules. Every switch on the rules screen maps to one of these.
export const DEFAULT_RULES = {
  zonderDubbel: true, // zonder troef telt dubbel
  meegaan: true, // tegenpartij mag meegaan, deler en partner mogen terug
  hogerPlicht: true, // heeft de tegenpartij de slag: hoger gaan of kopen als het kan
  partnerVrij: true, // heeft je partner de slag: geen plicht om hoger te gaan
  nietOndertroeven: true, // geen lagere troef bijleggen als je iets anders kunt
  gelijkDubbel: true, // 30-30: niemand scoort, volgende ronde telt dubbel
  alleSlagenDubbel: true, // alle slagen gehaald: dubbel
  doorgeven: false, // deler mag de troefkeuze aan zijn partner laten
  blind: false, // deler mag blind zonder troef spelen (telt vier keer)
  maxVier: false, // hoogstens vier keer de punten per ronde
  target: 101,
};
export const TARGETS = [61, 101, 121, 151];

export function makeDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(s + r);
  return d;
}

// Does card a beat card b (b is the card that has the trick right now)?
export function beats(a, b, trump) {
  if (suitOf(a) === suitOf(b)) return strength(a) > strength(b);
  return trump != null && suitOf(a) === trump;
}

export function winnerIndex(cards, trump) {
  let w = 0;
  for (let i = 1; i < cards.length; i++) if (beats(cards[i], cards[w], trump)) w = i;
  return w;
}

// Which of the available cards may be played? Returns { legal, rule }.
// rule says which obligation narrowed the choice (used to explain a dimmed card).
// trick: [{ p, c }] in play order. teamOf: seat -> team.
export function analyze(avail, trick, p, trump, rules, teamOf) {
  if (!trick.length) return { legal: avail.slice(), rule: null };
  const led = suitOf(trick[0].c);
  const win = trick[winnerIndex(trick.map((t) => t.c), trump)];
  const oppWinning = teamOf(win.p) !== teamOf(p);
  const mustBeat = rules.hogerPlicht && (oppWinning || !rules.partnerVrij);
  const follow = avail.filter((c) => suitOf(c) === led);
  if (follow.length) {
    if (mustBeat) {
      const hi = follow.filter((c) => beats(c, win.c, trump));
      if (hi.length) return { legal: hi, rule: 'hoger', led, win };
    }
    return { legal: follow, rule: follow.length < avail.length ? 'bekennen' : null, led, win };
  }
  const trumps = trump ? avail.filter((c) => suitOf(c) === trump) : [];
  const winIsTrump = trump != null && suitOf(win.c) === trump;
  if (mustBeat && trumps.length) {
    const hi = trumps.filter((c) => beats(c, win.c, trump));
    if (hi.length) return { legal: hi, rule: winIsTrump ? 'overtroeven' : 'kopen', led, win };
  }
  if (rules.nietOndertroeven && winIsTrump) {
    const ok = avail.filter((c) => !(suitOf(c) === trump && !beats(c, win.c, trump)));
    if (ok.length && ok.length < avail.length) return { legal: ok, rule: 'ondertroeven', led, win };
  }
  return { legal: avail.slice(), rule: null, led, win };
}

// ---------- game state ----------

export const teamOfFor = (mode) => (mode === 4 ? (p) => p % 2 : (p) => p);
export const partnerOf = (g, p) => (g.mode === 4 ? (p + 2) % 4 : null);
export const tricksPerDeal = (g) => (g.mode === 4 ? 8 : 16);

export function createGame(mode, rules, rng = Math.random) {
  return {
    v: 1,
    mode,
    rules: { ...DEFAULT_RULES, ...(rules || {}) },
    scores: [0, 0],
    dealer: Math.floor(rng() * mode),
    dealNo: 0,
    carry: 0, // number of 30-30 deals waiting to double the next one
    deal: null,
    over: false,
    winner: null,
    last: null, // summary of the previous deal
    log: [], // one line per finished deal, for the scoreboard
  };
}

export function startDeal(g, rng = Math.random) {
  const n = g.mode;
  const deck = shuffle(makeDeck(), rng);
  const hands = Array.from({ length: n }, () => []);
  let stacks = null;
  let k = 0;
  const order = Array.from({ length: n }, (_, i) => (g.dealer + 1 + i) % n); // left of the dealer first
  if (n === 4) {
    for (const size of [3, 2, 3]) for (const p of order) for (let i = 0; i < size; i++) hands[p].push(deck[k++]);
  } else {
    // 3 in de hand, 4 gesloten op tafel, 2 in de hand, 4 open erbovenop, 3 in de hand
    stacks = [[[], [], [], []], [[], [], [], []]];
    const toHand = (m) => { for (const p of order) for (let i = 0; i < m; i++) hands[p].push(deck[k++]); };
    const toTable = () => { for (const p of order) for (let i = 0; i < 4; i++) stacks[p][i].push(deck[k++]); };
    toHand(3); toTable(); toHand(2); toTable(); toHand(3);
  }
  g.dealNo++;
  g.deal = {
    hands,
    stacks, // two players only: per seat 4 stacks, the last card of a stack lies open
    start: { hands: hands.map((h) => h.slice()), stacks: stacks && stacks.map((s) => s.map((x) => x.slice())) },
    phase: g.rules.blind ? 'blind' : 'trump',
    chooser: g.dealer,
    passed: false,
    blind: false,
    trump: undefined, // suit letter, or null for zonder troef
    mee: null,
    terug: null,
    queue: [],
    said: [], // [{p, what}] announcements in order, for the table
    leader: null,
    turn: null,
    trick: [],
    tricks: [],
    taken: [0, 0],
    won: [0, 0],
    result: null,
  };
  return g;
}

// Cards a seat can play right now (hand plus open table cards with two players).
export function available(g, p) {
  const d = g.deal;
  const a = d.hands[p].slice();
  if (d.stacks) for (const s of d.stacks[p]) if (s.length) a.push(s[s.length - 1]);
  return a;
}

export function legalFor(g, p) {
  const d = g.deal;
  return analyze(available(g, p), d.trick, p, d.trump, g.rules, teamOfFor(g.mode));
}

// Multiplier before the play starts (used to limit meegaan/terug with the max x4 rule).
function baseMultiplier(g) {
  const d = g.deal;
  let m = 2 ** (g.rules.gelijkDubbel ? g.carry : 0);
  if (d.trump === null) m *= d.blind ? 4 : g.rules.zonderDubbel ? 2 : 1;
  if (d.mee != null) m *= 2;
  if (d.terug != null) m *= 2;
  return m;
}
export const currentMultiplier = (g) => (g.deal ? Math.min(baseMultiplier(g), g.rules.maxVier ? 4 : Infinity) : 1);

// What decision is the game waiting for?
export function pending(g) {
  if (g.over) return { type: 'over' };
  const d = g.deal;
  if (!d) return { type: 'new' };
  switch (d.phase) {
    case 'blind': return { type: 'blind', p: g.dealer };
    case 'trump': return { type: 'trump', p: d.chooser, canPass: g.mode === 4 && g.rules.doorgeven && !d.passed };
    case 'mee': return { type: 'mee', p: d.queue[0] };
    case 'terug': return { type: 'terug', p: d.queue[0] };
    case 'play': return { type: 'play', p: d.turn };
    case 'trick': return { type: 'trick' };
    case 'end': return { type: 'end' };
  }
  return { type: '?' };
}

function afterTrump(g) {
  const d = g.deal;
  const n = g.mode;
  if (g.rules.meegaan && !(g.rules.maxVier && baseMultiplier(g) >= 4)) {
    d.phase = 'mee';
    d.queue = n === 4 ? [(g.dealer + 1) % 4, (g.dealer + 3) % 4] : [1 - g.dealer];
  } else startPlay(g);
}

function startPlay(g) {
  const d = g.deal;
  d.phase = 'play';
  d.queue = [];
  d.leader = d.turn = (g.dealer + 1) % g.mode;
  d.trick = [];
}

// Apply one action. Throws on anything that is not allowed right now.
export function act(g, a) {
  const d = g.deal;
  const pd = pending(g);
  if (a.type !== pd.type) throw new Error(`verwacht ${pd.type}, kreeg ${a.type}`);
  switch (a.type) {
    case 'blind':
      if (a.yes) {
        d.blind = true;
        d.trump = null;
        d.said.push({ p: g.dealer, what: 'blind' });
        afterTrump(g);
      } else d.phase = 'trump';
      break;
    case 'trump':
      if (a.choice === 'pass') {
        if (!pd.canPass) throw new Error('doorgeven mag niet');
        d.passed = true;
        d.said.push({ p: d.chooser, what: 'pass' });
        d.chooser = partnerOf(g, d.chooser);
        break;
      }
      if (a.choice !== 'zonder' && !SUITS.includes(a.choice)) throw new Error('onbekende troef');
      d.trump = a.choice === 'zonder' ? null : a.choice;
      d.said.push({ p: d.chooser, what: a.choice });
      afterTrump(g);
      break;
    case 'mee':
      if (a.yes) {
        d.mee = pd.p;
        d.said.push({ p: pd.p, what: 'mee' });
        if (g.rules.maxVier && baseMultiplier(g) >= 4) startPlay(g);
        else {
          d.phase = 'terug';
          d.queue = g.mode === 4 ? [g.dealer, (g.dealer + 2) % 4] : [g.dealer];
        }
      } else {
        d.said.push({ p: pd.p, what: 'niet-mee' });
        d.queue.shift();
        if (!d.queue.length) startPlay(g);
      }
      break;
    case 'terug':
      if (a.yes) {
        d.terug = pd.p;
        d.said.push({ p: pd.p, what: 'terug' });
        startPlay(g);
      } else {
        d.said.push({ p: pd.p, what: 'niet-terug' });
        d.queue.shift();
        if (!d.queue.length) startPlay(g);
      }
      break;
    case 'play': {
      const p = pd.p;
      const { legal } = legalFor(g, p);
      if (!legal.includes(a.card)) throw new Error(`kaart ${a.card} mag niet`);
      const hi = d.hands[p].indexOf(a.card);
      if (hi >= 0) d.hands[p].splice(hi, 1);
      else {
        const st = d.stacks[p].find((s) => s.length && s[s.length - 1] === a.card);
        st.pop();
      }
      d.trick.push({ p, c: a.card });
      if (d.trick.length === g.mode) d.phase = 'trick';
      else d.turn = (d.turn + 1) % g.mode;
      break;
    }
    case 'trick': {
      const team = teamOfFor(g.mode);
      const wi = winnerIndex(d.trick.map((t) => t.c), d.trump);
      const w = d.trick[wi].p;
      const pts = d.trick.reduce((s, t) => s + points(t.c), 0);
      d.taken[team(w)] += pts;
      d.won[team(w)]++;
      d.tricks.push({ cards: d.trick, winner: w, pts });
      d.trick = [];
      if (d.tricks.length === tricksPerDeal(g)) finishDeal(g);
      else {
        d.leader = d.turn = w;
        d.phase = 'play';
      }
      break;
    }
    case 'end':
      g.dealer = (g.dealer + 1) % g.mode;
      startDeal(g, a.rng || Math.random);
      break;
    default:
      throw new Error('onbekende actie');
  }
  return g;
}

export const trickWinner = (g) => {
  const d = g.deal;
  if (!d.trick.length) return null;
  return d.trick[winnerIndex(d.trick.map((t) => t.c), d.trump)].p;
};

// Scoring at the end of a deal.
export function scoreDeal(rules, taken, won, info) {
  const factors = [];
  const tie = taken[0] === taken[1];
  const winTeam = tie ? null : taken[0] > taken[1] ? 0 : 1;
  const base = tie ? 0 : taken[winTeam] - 30;
  if (rules.gelijkDubbel && info.carry) for (let i = 0; i < info.carry; i++) factors.push({ key: 'gelijk', x: 2 });
  if (info.trump === null) {
    if (info.blind) factors.push({ key: 'blind', x: 4 });
    else if (rules.zonderDubbel) factors.push({ key: 'zonder', x: 2 });
  }
  if (info.mee != null) factors.push({ key: 'mee', x: 2 });
  if (info.terug != null) factors.push({ key: 'terug', x: 2 });
  if (!tie && rules.alleSlagenDubbel && won[1 - winTeam] === 0) factors.push({ key: 'alle', x: 2 });
  let mult = factors.reduce((m, f) => m * f.x, 1);
  let capped = false;
  if (rules.maxVier && mult > 4) {
    mult = 4;
    capped = true;
  }
  return { tie, winTeam, base, mult, capped, factors, gained: base * mult };
}

function finishDeal(g) {
  const d = g.deal;
  const r = scoreDeal(g.rules, d.taken, d.won, { carry: g.carry, trump: d.trump, blind: d.blind, mee: d.mee, terug: d.terug });
  if (r.tie) g.carry = g.rules.gelijkDubbel ? g.carry + 1 : 0;
  else {
    g.scores[r.winTeam] += r.gained;
    g.carry = 0;
  }
  d.result = r;
  d.phase = 'end';
  g.last = { dealNo: g.dealNo, taken: d.taken.slice(), result: r };
  if (!Array.isArray(g.log)) g.log = []; // games saved before the scoreboard existed
  g.log.push({ n: g.dealNo, trump: d.trump, blind: !!d.blind, taken: d.taken.slice(), mult: r.mult, gained: r.gained, winTeam: r.winTeam, scores: g.scores.slice() });
  const t = g.rules.target;
  if (g.scores[0] >= t || g.scores[1] >= t) {
    g.over = true;
    g.winner = g.scores[0] >= t ? 0 : 1;
  }
}

// All cards that have left a hand in this deal, in order.
export function playedCards(d) {
  const out = [];
  for (const t of d.tricks) for (const x of t.cards) out.push(x);
  for (const x of d.trick) out.push(x);
  return out;
}
