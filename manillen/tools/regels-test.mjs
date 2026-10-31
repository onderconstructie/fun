// Rule engine test for Manillen:   node tools/regels-test.mjs
// Checks every legal-move rule with small hand-made situations, the scoring,
// the bidding flow, and plays many computer-only games where every move is checked.

import * as E from '../js/engine.js';
import { decide, decidePlayWhy } from '../js/ai.js';
import { makeRng } from '../js/util.js';

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

console.log(`${ok} goed, ${fail} fout · ${deals} rondes, ${moves} computerzetten nagekeken`);
process.exit(fail ? 1 : 0);
