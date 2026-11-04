// Rule engine test for Manillen:   node tools/regels-test.mjs
// Checks every legal-move rule with small hand-made situations, the scoring,
// the bidding flow, and plays many computer-only games where every move is checked.

import * as E from '../js/engine.js';
import { decide, decidePlayWhy } from '../js/ai.js';
import { makeRng } from '../js/util.js';
import * as B from '../js/scoreboard.js';
import * as T from '../js/tally.js';

let ok = 0;
let fail = 0;
function t(name, cond) {
  if (cond) ok++;
  else {
    fail++;
    console.log('FOUT:', name);
  }
}
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const R = E.DEFAULT_RULES;
const team4 = E.teamOfFor(4);
const team2 = E.teamOfFor(2);
const L = (avail, trick, p, trump, rules = R, team = team4) => E.analyze(avail, trick, p, trump, rules, team);

// ---- ranking and points ----
t('10 wint van aas', E.beats('h10', 'hA', 's'));
t('aas wint van heer', E.beats('hA', 'hH', null));
t('boer wint van 9', E.beats('hB', 'h9', null));
t('troef 7 wint van manille', E.beats('s7', 'h10', 's'));
t('andere kleur wint niet', !E.beats('k10', 'h7', 's'));
t('zonder troef: andere kleur wint niet', !E.beats('s10', 'h7', null));
t('60 punten in het spel', E.makeDeck().reduce((s, c) => s + E.points(c), 0) === 60);
t('32 kaarten', new Set(E.makeDeck()).size === 32);

// ---- uitkomen ----
t('uitkomen: alles mag', same(L(['h7', 's10', 'kA'], [], 0, 's').legal, ['h7', 's10', 'kA']));

// ---- kleur bekennen ----
t('bekennen', same(L(['h7', 'hA', 's10'], [{ p: 1, c: 'h8' }], 2, 's', { ...R, hogerPlicht: false }).legal, ['h7', 'hA']));

// ---- hoger gaan bij tegenpartij ----
let r = L(['h7', 'hA', 's10'], [{ p: 1, c: 'hH' }], 2, 's');
t('hoger gaan: alleen aas', same(r.legal, ['hA']) && r.rule === 'hoger');
r = L(['h7', 'h8', 's10'], [{ p: 1, c: 'hH' }], 2, 's');
t('kan niet hoger: elke harten', same(r.legal, ['h7', 'h8']) && r.rule === 'bekennen');
// tegenpartij heeft al gekocht: bekennen, hoger kan niet
r = L(['hA', 'h7', 's10'], [{ p: 3, c: 'h8' }, { p: 0, c: 'hH' }, { p: 1, c: 's7' }], 2, 's');
t('ingekocht: gewoon bekennen', same(r.legal, ['hA', 'h7']));

// ---- partner heeft de slag ----
r = L(['h7', 'hA', 's10'], [{ p: 1, c: 'h8' }, { p: 2, c: 'hH' }], 0, 's');
t('partner heeft slag: vrij bekennen', same(r.legal, ['h7', 'hA']));
r = L(['h7', 'hA', 's10'], [{ p: 1, c: 'h8' }, { p: 2, c: 'hH' }], 0, 's', { ...R, partnerVrij: false });
t('variant zonder partnervrijheid: hoger', same(r.legal, ['hA']));
r = L(['k7', 'sA', 's8'], [{ p: 1, c: 'h8' }, { p: 2, c: 'hH' }], 0, 's');
t('partner heeft slag, geen harten: alles mag', same(r.legal, ['k7', 'sA', 's8']));

// ---- kopen ----
r = L(['k7', 's8', 'sA'], [{ p: 1, c: 'hH' }], 2, 's');
t('kopen: alleen troef', same(r.legal, ['s8', 'sA']) && r.rule === 'kopen');
r = L(['k7', 's8', 'sA'], [{ p: 1, c: 'hH' }], 2, 's', { ...R, hogerPlicht: false });
t('variant zonder plicht: vrij', same(r.legal, ['k7', 's8', 'sA']));
r = L(['k7', 'r8'], [{ p: 1, c: 'hH' }], 2, 's');
t('geen kleur en geen troef: alles', same(r.legal, ['k7', 'r8']));
r = L(['k7', 'r8'], [{ p: 1, c: 'hH' }], 2, null);
t('zonder troef: niet kopen, alles', same(r.legal, ['k7', 'r8']));

// ---- overtroeven en ondertroeven ----
r = L(['k7', 's8', 'sA'], [{ p: 1, c: 'hH' }, { p: 2, c: 'h7' }, { p: 3, c: 's9' }], 0, 's');
t('overtroeven: alleen aas', same(r.legal, ['sA']) && r.rule === 'overtroeven');
r = L(['k7', 's7', 's8'], [{ p: 1, c: 'hH' }, { p: 2, c: 'h7' }, { p: 3, c: 's9' }], 0, 's');
t('niet ondertroeven: klaveren', same(r.legal, ['k7']) && r.rule === 'ondertroeven');
r = L(['s7', 's8'], [{ p: 1, c: 'hH' }, { p: 2, c: 'h7' }, { p: 3, c: 's9' }], 0, 's');
t('alleen lage troef: mag toch', same(r.legal, ['s7', 's8']));
r = L(['k7', 's7', 's8'], [{ p: 1, c: 'hH' }, { p: 2, c: 'h7' }, { p: 3, c: 's9' }], 0, 's', { ...R, nietOndertroeven: false });
t('variant ondertroeven mag', same(r.legal, ['k7', 's7', 's8']));
// partner heeft de slag met troef: hoger troeven mag, lager niet (als er iets anders is)
r = L(['k7', 's7', 'sA'], [{ p: 1, c: 'hH' }, { p: 2, c: 's9' }, { p: 3, c: 'h7' }], 0, 's');
t('partner troeft: geen lagere troef', same(r.legal, ['k7', 'sA']));
// troef gevraagd
r = L(['s7', 'sA', 'h10'], [{ p: 1, c: 'sH' }], 2, 's');
t('troef gevraagd: hoger troeven', same(r.legal, ['sA']));
r = L(['h10', 'kA'], [{ p: 1, c: 'sH' }], 2, 's');
t('troef gevraagd, geen troef: alles', same(r.legal, ['h10', 'kA']));

// ---- met twee: geen partner ----
r = L(['h7', 'hA'], [{ p: 1, c: 'hH' }], 0, 's', R, team2);
t('twee spelers: hoger gaan', same(r.legal, ['hA']));

// ---- slag winnen ----
t('winnaar hoogste kleur', E.winnerIndex(['h8', 'hA', 'k10', 'h10'], 's') === 3);
t('winnaar troef', E.winnerIndex(['h8', 'hA', 's7', 'h10'], 's') === 2);
t('winnaar hoogste troef', E.winnerIndex(['h8', 's9', 's7', 'h10'], 's') === 1);
t('zonder troef', E.winnerIndex(['h8', 's10', 'k10', 'h9'], null) === 3);

// ---- punten ----
let s = E.scoreDeal(R, [37, 23], [5, 3], { carry: 0, trump: 'h', mee: null, terug: null });
t('37-23 geeft 7', s.gained === 7 && s.winTeam === 0);
s = E.scoreDeal(R, [37, 23], [5, 3], { carry: 0, trump: null, mee: null, terug: null });
t('zonder troef 14', s.gained === 14);
s = E.scoreDeal(R, [37, 23], [5, 3], { carry: 0, trump: null, mee: 1, terug: null });
t('zonder + mee 28', s.gained === 28);
s = E.scoreDeal(R, [23, 37], [3, 5], { carry: 1, trump: null, mee: 1, terug: 0 });
t('gelijk + zonder + mee + terug = x16', s.gained === 7 * 16 && s.winTeam === 1);
s = E.scoreDeal({ ...R, maxVier: true }, [23, 37], [3, 5], { carry: 1, trump: null, mee: 1, terug: 0 });
t('hoogstens x4', s.gained === 28 && s.capped);
s = E.scoreDeal(R, [30, 30], [4, 4], { carry: 0, trump: 'h', mee: null, terug: null });
t('30-30 niemand', s.tie && s.gained === 0);
s = E.scoreDeal(R, [60, 0], [8, 0], { carry: 0, trump: 'h', mee: null, terug: null });
t('alle slagen dubbel: 60', s.gained === 60);
s = E.scoreDeal({ ...R, alleSlagenDubbel: false }, [60, 0], [8, 0], { carry: 0, trump: 'h', mee: null, terug: null });
t('variant alle slagen gewoon: 30', s.gained === 30);
s = E.scoreDeal(R, [40, 20], [8, 0], { carry: 0, trump: null, blind: true, mee: null, terug: null });
t('blind zonder troef x4 (en alle slagen x2)', s.gained === 10 * 8);
s = E.scoreDeal({ ...R, zonderDubbel: false }, [40, 20], [5, 3], { carry: 0, trump: null, mee: null, terug: null });
t('variant zonder troef niet dubbel', s.gained === 10);

// ---- verloop: troef, doorgeven, meegaan, terug ----
let g = E.createGame(4, { doorgeven: true }, makeRng(1));
g.dealer = 0;
E.startDeal(g, makeRng(2));
t('8 kaarten elk', g.deal.hands.every((h) => h.length === 8));
t('deler kiest', E.pending(g).type === 'trump' && E.pending(g).p === 0 && E.pending(g).canPass);
E.act(g, { type: 'trump', choice: 'pass' });
t('partner kiest na doorgeven', E.pending(g).p === 2 && !E.pending(g).canPass);
let threw = false;
try { E.act(g, { type: 'trump', choice: 'pass' }); } catch (e) { threw = true; }
t('partner kan niet terug doorgeven', threw);
E.act(g, { type: 'trump', choice: 'h' });
t('eerst links van deler meegaan', E.pending(g).type === 'mee' && E.pending(g).p === 1);
E.act(g, { type: 'mee', yes: false });
t('dan de andere tegenspeler', E.pending(g).p === 3);
E.act(g, { type: 'mee', yes: true });
t('terug: deler eerst', E.pending(g).type === 'terug' && E.pending(g).p === 0);
E.act(g, { type: 'terug', yes: false });
t('dan partner', E.pending(g).p === 2);
E.act(g, { type: 'terug', yes: true });
t('spel begint links van deler', E.pending(g).type === 'play' && E.pending(g).p === 1);
t('x4 na mee en terug', E.currentMultiplier(g) === 4);
threw = false;
try { E.act(g, { type: 'play', card: E.available(g, 2)[0] }); } catch (e) { threw = true; }
t('niet aan de beurt: geweigerd', threw);

g = E.createGame(4, { maxVier: true, blind: true }, makeRng(3));
g.dealer = 2;
E.startDeal(g, makeRng(4));
E.act(g, { type: 'blind', yes: true });
t('blind: meegaan niet meer (al x4)', E.pending(g).type === 'play' && g.deal.trump === null && E.currentMultiplier(g) === 4);

g = E.createGame(2, {}, makeRng(5));
g.dealer = 1;
E.startDeal(g, makeRng(6));
t('twee: 8 in de hand', g.deal.hands.every((h) => h.length === 8));
t('twee: 4 stapels van 2', g.deal.stacks.every((ss) => ss.length === 4 && ss.every((x) => x.length === 2)));
t('twee: 12 speelbaar', E.available(g, 0).length === 12);
E.act(g, { type: 'trump', choice: 'k' });
t('twee: niet-deler mag meegaan', E.pending(g).type === 'mee' && E.pending(g).p === 0);
E.act(g, { type: 'mee', yes: false });
t('twee: niet-deler komt uit', E.pending(g).type === 'play' && E.pending(g).p === 0);
const top = g.deal.stacks[0][0][1];
const under = g.deal.stacks[0][0][0];
if (E.legalFor(g, 0).legal.includes(top)) {
  E.act(g, { type: 'play', card: top });
  t('twee: kaart eronder komt open', E.available(g, 0).includes(under));
}

// ---- vele computerspellen: elke zet nagekeken, elke ronde 60 punten ----
let deals = 0;
let moves = 0;
for (let i = 0; i < 200; i++) {
  const rng = makeRng(100 + i);
  const mode = i % 2 ? 2 : 4;
  const rules = i % 4 === 0 ? { doorgeven: true, blind: true, maxVier: true, target: 61 } : i % 4 === 1 ? { hogerPlicht: false } : i % 4 === 2 ? { partnerVrij: false, nietOndertroeven: false } : {};
  g = E.createGame(mode, rules, rng);
  E.startDeal(g, rng);
  let guard = 0;
  while (!g.over && guard++ < 50000) {
    const pd = E.pending(g);
    if (pd.type === 'trick') E.act(g, { type: 'trick' });
    else if (pd.type === 'end') {
      deals++;
      if (g.deal.taken[0] + g.deal.taken[1] !== 60) t('60 per ronde', false);
      E.act(g, { type: 'end', rng });
    } else {
      const a = decide(g, pd);
      if (a.type === 'play') {
        moves++;
        if (!E.legalFor(g, pd.p).legal.includes(a.card)) t('computer speelt legaal', false);
        const tip = decidePlayWhy(g, pd.p);
        if (tip.card !== a.card || typeof tip.why !== 'string') t('tip = zelfde kaart als de computer, met reden', false);
      }
      E.act(g, a);
    }
  }
  if (!g.over || Math.max(...g.scores) < g.rules.target) t('spel eindigt', false);
}
t('veel rondes gespeeld', deals > 1000);

// ---- scorebord ----
{
  const rng = makeRng(4242);
  const b = B.emptyBoard();
  let wins = 0;
  let losses = 0;
  let streak = 0;
  let best = 0;
  for (let i = 0; i < 30; i++) {
    const g = E.createGame(4, R, rng);
    g.id = 'test' + i;
    E.startDeal(g, rng);
    let guard = 0;
    while (!g.over && guard++ < 50000) {
      const pd = E.pending(g);
      if (pd.type === 'trick') E.act(g, { type: 'trick' });
      else if (pd.type === 'end') E.act(g, { type: 'end', rng });
      else E.act(g, decide(g, pd));
    }
    const sum = [0, 0];
    let run = true;
    g.log.forEach((l, k) => {
      if (l.n !== k + 1) run = false;
      if (l.winTeam !== null) sum[l.winTeam] += l.gained;
      if (l.scores[0] !== sum[0] || l.scores[1] !== sum[1]) run = false;
      if (l.taken[0] + l.taken[1] !== 60) run = false;
    });
    t('elke ronde staat op het scorebord', g.log.length === g.dealNo && g.log.length === B.roundsDone(g));
    t('tussenstanden tellen op tot de eindstand', run && sum[0] === g.scores[0] && sum[1] === g.scores[1]);
    if (g.winner === 0) {
      wins++;
      streak++;
      best = Math.max(best, streak);
    } else {
      losses++;
      streak = 0;
    }
    t('spel telt één keer mee', B.recordGame(b, g) === true && B.recordGame(b, g) === false);
  }
  const m = b.modes[4];
  t('gewonnen en verloren kloppen', m.won === wins && m.lost === losses && wins + losses === 30);
  t('reeksen kloppen', m.best === best && m.streak === streak);
  t('andere modus blijft leeg', b.modes[2].won === 0 && b.modes[2].lost === 0);
  t('hoogstens 20 spellen met rondes', b.recent.length === B.RECENT_MAX && b.recent[0].id === 'test29');
  const again = B.normalize(JSON.parse(JSON.stringify(b)));
  t('scorebord overleeft bewaren', JSON.stringify(again) === JSON.stringify(b));
  for (const bad of [null, 5, 'x', {}, { v: 1 }, { v: 1, modes: 3, recent: 2 }, { v: 2, modes: {} }, { v: 1, modes: { 2: { won: -1, lost: 'a' } }, recent: [null, { mode: 9 }, { mode: 4, scores: [1], log: [] }] }]) {
    const n = B.normalize(bad);
    t('kapotte opslag wordt leeg', n.recent.length === 0 && n.modes[2].won === 0 && n.modes[2].lost === 0 && n.modes[4].won === 0);
  }
  const unfinished = E.createGame(2, R, rng);
  t('onafgewerkt spel telt niet', B.recordGame(b, unfinished) === false);
  t('oud bewaard spel zonder log krijgt er een', (() => {
    const g = E.createGame(4, R, rng);
    delete g.log;
    E.startDeal(g, rng);
    let guard = 0;
    while (E.pending(g).type !== 'end' && guard++ < 5000) {
      const pd = E.pending(g);
      if (pd.type === 'over') break;
      E.act(g, pd.type === 'trick' ? { type: 'trick' } : decide(g, pd));
    }
    return Array.isArray(g.log) && g.log.length === 1;
  })());
}

// ---- scorebord voor echte kaarten: rekent exact als het spel ----
{
  const rng = makeRng(777);
  const sets = [R, { ...R, blind: true }, { ...R, maxVier: true }, { ...R, zonderDubbel: false, gelijkDubbel: false }, { ...R, alleSlagenDubbel: false, meegaan: false }, { ...R, blind: true, maxVier: true, target: 61 }];
  let compared = 0;
  let same_ = true;
  for (let i = 0; i < 120; i++) {
    const rules = sets[i % sets.length];
    const mode = i % 3 === 0 ? 2 : 4;
    const g = E.createGame(mode, rules, rng);
    E.startDeal(g, rng);
    const store = T.emptyStore();
    const t = T.startGame(store, { mode, names: ['a', 'b', 'c', 'd'], target: rules.target, rules, firstDealer: g.dealer, id: 'x' });
    const dealers = [g.dealer];
    let guard = 0;
    const take = () => {
      const d = g.deal;
      const lost = d.won[0] === 0 ? 0 : d.won[1] === 0 ? 1 : null;
      t.rounds.push({ taken: d.taken.slice(), zonder: d.trump === null && !d.blind, blind: !!d.blind, mee: d.mee != null, terug: d.terug != null, alle: lost !== null });
      const r = T.replay(t);
      compared++;
      if (r.scores[0] !== g.scores[0] || r.scores[1] !== g.scores[1] || r.carry !== g.carry || r.over !== g.over || (g.over && r.winner !== g.winner)) same_ = false;
    };
    while (!g.over && guard++ < 50000) {
      const pd = E.pending(g);
      if (pd.type === 'trick') {
        E.act(g, { type: 'trick' });
        if (g.deal.phase === 'end') take();
      } else if (pd.type === 'end') {
        E.act(g, { type: 'end', rng });
        dealers.push(g.dealer);
      } else E.act(g, decide(g, pd));
    }
    dealers.forEach((dl, k) => {
      if (T.dealerOf(t, k) !== dl) same_ = false;
    });
  }
  t('scorebord rekent exact als het spel', same_ && compared > 500);

  const s = T.emptyStore();
  const b = T.startGame(s, { mode: 4, names: ['  Jan ', 'Lies', 'Piet', 'Een veel te lange naam hier'], target: 61, rules: R, firstDealer: 1, id: 'a' });
  t('namen worden opgeschoond', b.names[0] === 'Jan' && b.names[3].length === T.NAME_MAX);
  t('team is 0 en 2, 1 en 3', T.teamLabel(b, 0) === 'Jan & Piet' && T.teamLabel(b, 1).startsWith('Lies & '));
  t('zonder namen: wij en zij', T.teamLabel({ mode: 4, names: ['', '', '', ''] }, 1) === 'Zij' && T.teamLabel({ mode: 2, names: ['', 'Tom'] }, 0) === 'Speler 1');
  t('deler schuift op', T.dealerOf(b, 0) === 1 && T.dealerOf(b, 3) === 0);
  t('ongeldige ronde: samen geen 60', !T.validRound({ taken: [30, 31] }) && !T.validRound({ taken: [61, -1] }) && !T.validRound({ taken: [NaN, NaN] }) && T.validRound({ taken: [60, 0] }));
  t('finish kan niet tijdens het spel', T.finishGame(s) === false && s.current === b);
  b.rounds.push({ taken: [37, 23] });
  t('37-23 geeft 7', T.replay(b).scores[0] === 7);
  b.rounds.push({ taken: [37, 23], zonder: true, mee: true });
  t('zonder troef en meegaan: 28', T.replay(b).log[1].gained === 28 && T.replay(b).scores[0] === 35);
  b.rounds.push({ taken: [30, 30] });
  t('gelijk: geen punten, volgende dubbel', T.replay(b).scores[0] === 35 && T.replay(b).carry === 1);
  b.rounds.push({ taken: [20, 40] });
  t('na gelijk dubbel', T.replay(b).log[3].gained === 20 && T.replay(b).scores[1] === 20 && T.replay(b).carry === 0);
  b.rounds[0] = { taken: [23, 37] };
  t('aanpassen rekent alles opnieuw', T.replay(b).scores[0] === 28 && T.replay(b).scores[1] === 27);
  b.rounds.splice(2, 1);
  t('verwijderen rekent alles opnieuw', T.replay(b).log[2].gained === 10 && T.replay(b).log[2].n === 3);
  b.rounds.push({ taken: [60, 0], alle: true }, { taken: [60, 0], alle: false });
  const big = T.replay(b);
  t('alle slagen dubbel, 60 zonder alle slagen niet', big.log[3].gained === 60 && big.over && big.winner === 0);
  const firstOver = T.startGame(T.emptyStore(), { mode: 2, names: ['x', 'y'], target: 61, rules: R, firstDealer: 0, id: 'f' });
  firstOver.rounds.push({ taken: [60, 0], alle: true }, { taken: [60, 0], alle: true }, { taken: [0, 60], alle: true }, { taken: [0, 60], alle: true });
  t('wie eerst aan het doel is, wint', T.replay(firstOver).winner === 0);
  b.rounds.length = 0;
  b.rounds.push({ taken: [60, 0], alle: true }, { taken: [60, 0], alle: true }, { taken: [31, 29] });
  const n1 = T.nextGame(s, 'b');
  t('nog een spel: zelfde namen, deler schuift, reeks telt', n1 && n1.names[0] === 'Jan' && n1.firstDealer === 0 && s.last.series[0] === 1 && s.recent.length === 1 && s.recent[0].scores[0] === 121);
  const sh = T.emptyStore();
  const st = T.startGame(sh, { mode: 4, names: ['Jan', 'Lies', 'Piet', '<Tom>'], target: 61, rules: R, firstDealer: 0, id: 's' });
  st.rounds.push({ taken: [37, 23], zonder: true }, { taken: [30, 30] });
  let rp = T.replay(st);
  let txt = T.shareText({ players: st, log: rp.log, scores: rp.scores, target: 61, winner: rp.winner, url: 'https://x/' });
  t('delen: tussenstand met namen, rondes en link', txt.includes('tussenstand na 2 rondes') && txt.includes('Jan & Piet: 14') && txt.includes('Lies & <Tom>: 0') && txt.includes('Ronde 1: 37-23 x2, +14 voor Jan & Piet') && txt.includes('Ronde 2: gelijk') && txt.endsWith('https://x/') && !txt.includes('wint') && !txt.includes('winnen'));
  st.rounds.push({ taken: [60, 0], alle: true });
  rp = T.replay(st);
  txt = T.shareText({ players: st, log: rp.log, scores: rp.scores, target: 61, winner: rp.winner, series: [2, 1] });
  t('delen: eindstand met winnaar en spellen', rp.over && txt.startsWith('Manillen: eindstand na 3 rondes\nJan & Piet winnen!') && txt.includes('Gewonnen spellen: 2-1'));
  const duo = { mode: 2, names: ['Jan', ''] };
  t('delen: met twee', T.shareText({ players: duo, log: [], scores: [61, 0], target: 61, winner: 0 }).includes('Jan wint!') && T.shareText({ players: duo, log: [], scores: [0, 61], target: 61, winner: 1 }).includes('Speler 2 wint!'));
  const stored = T.normalizeStore(JSON.parse(JSON.stringify(s)));
  t('bewaren en terughalen', JSON.stringify(stored) === JSON.stringify(s));
  T.startGame(s, { mode: 4, names: ['Ann', 'Lies', 'Piet', 'Tom'], target: 61, rules: R, firstDealer: 0, id: 'c' });
  t('andere namen: reeks begint opnieuw', s.last.series[0] === 0 && s.recent.length === 1);
  for (const bad of [null, 7, {}, { v: 1, current: { mode: 3 } }, { v: 1, current: { mode: 4, names: ['a'], rules: {}, firstDealer: 0, rounds: [] }, last: { mode: 9 }, recent: [{}, null] }, { v: 1, current: { mode: 2, names: ['a', 'b'], rules: { target: 101 }, firstDealer: 0, rounds: [{ taken: [1, 2] }] } }]) {
    const n = T.normalizeStore(bad);
    t('kapotte opslag van scorebord wordt leeg', n.current === null && n.last === null && n.recent.length === 0);
  }
}

console.log(`${ok} goed, ${fail} fout · ${deals} rondes, ${moves} computerzetten nagekeken`);
process.exit(fail ? 1 : 0);
