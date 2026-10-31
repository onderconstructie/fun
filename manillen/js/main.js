// Manillen: screens, the table, input, computer turns and saving.

import * as E from './engine.js';
import { decide } from './ai.js';
import { cardHTML, backHTML, suitIcon } from './cards.js';
import { rulesHTML, VARIANTS } from './rules-text.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const SPEED = new URLSearchParams(location.search).has('snel') ? 0.04 : 1;
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => ms * SPEED;

// ---------- storage (own prefix, never clear everything) ----------
const KEY = { rules: 'manillen.regels', game: 'manillen.spel', view: 'manillen.weergave' };
function read(k, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function write(k, v) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    /* private mode: play without saving */
  }
}
let rules = { ...E.DEFAULT_RULES, ...read(KEY.rules, {}) };
if (!E.TARGETS.includes(rules.target)) rules.target = E.DEFAULT_RULES.target;
let view = { punten: true, ...read(KEY.view, {}) };

function validGame(x) {
  return x && x.v === 1 && (x.mode === 2 || x.mode === 4) && x.deal && Array.isArray(x.deal.hands) && Array.isArray(x.scores);
}
let g = read(KEY.game, null);
if (!validGame(g)) g = null;
const saveGame = () => write(KEY.game, g);

// ---------- names ----------
const NAMES4 = ['Jij', 'Rik', 'Lotte', 'Jef'];
const NAMES2 = ['Jij', 'Jef'];
const nameOf = (p) => (g.mode === 4 ? NAMES4 : NAMES2)[p];
const teamLabel = (t) => (g.mode === 4 ? ['Wij', 'Zij'][t] : ['Jij', NAMES2[1]][t]);
const teamOf = (p) => E.teamOfFor(g.mode)(p);
const posOf = (p) => (g.mode === 4 ? ['me', 'left', 'top', 'right'][p] : ['me', 'top'][p]);
const suitWord = (s) => E.SUIT_NAME[s][0].toUpperCase() + E.SUIT_NAME[s].slice(1);
const colorCls = (s) => (E.RED[s] ? 'red' : 'black');

// ---------- screens ----------
let rulesFrom = 's-home';
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.id !== id));
  if (id === 's-home') refreshHome();
  if (id === 's-rules') buildRules();
  const scr = $(id);
  if (scr) scr.scrollTop = 0;
}
function toMenu() {
  stopTimers();
  closeOverlay();
  $('table').hidden = true;
  $('screens').hidden = false;
  app.classList.add('is-menu');
  show('s-home');
}
function toTable() {
  $('screens').hidden = true;
  $('table').hidden = false;
  app.classList.remove('is-menu');
  $('table').classList.toggle('two', g.mode === 2);
  lastSaid = g.deal ? g.deal.said.length : 0;
  trickKey = '';
  shownEnd = null;
  step();
}

function refreshHome() {
  const has = !!g && !g.over;
  $('btn-resume').hidden = !has;
  if (has) $('resume-sub').textContent = `Met ${g.mode === 4 ? 'vier' : 'twee'} · ${teamLabel(0)} ${g.scores[0]}, ${teamLabel(1)} ${g.scores[1]} · ronde ${g.dealNo}`;
}

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  rulesFrom = 's-home';
  show(b.dataset.go);
}));
$('rules-back').addEventListener('click', () => {
  if (rulesFrom === 'table' && g) toTable();
  else show('s-home');
});
$('btn-resume').addEventListener('click', () => g && toTable());
$('btn-four').addEventListener('click', () => askNew(4));
$('btn-two').addEventListener('click', () => askNew(2));

function askNew(mode) {
  if (g && !g.over) {
    overlay(`<div class="sheet"><h3>Nieuw spel?</h3><p>Je lopende spel stopt dan. De stand is ${teamLabel(0)} ${g.scores[0]}, ${teamLabel(1)} ${g.scores[1]}.</p>
      <div class="row"><button class="btn btn-ghost" data-x="no">Nee</button><button class="btn btn-main" data-x="yes">Ja, start</button></div></div>`, (x) => {
      closeOverlay();
      if (x === 'yes') newGame(mode);
    });
  } else newGame(mode);
}
function newGame(mode) {
  g = E.createGame(mode, rules);
  g.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  E.startDeal(g);
  saveGame();
  toTable();
}

// ---------- rules screen ----------
function buildRules() {
  const body = $('rules-body');
  body.innerHTML = rulesHTML();
  const box = $('var-box');
  const items = VARIANTS.map((v) => {
    const on = !!rules[v.key];
    const classic = on === !!E.DEFAULT_RULES[v.key];
    return `<label class="toggle ${classic ? '' : 'off-classic'}"><span>${v.title}<small>${v.text}${v.four ? ' <em>Alleen met vier.</em>' : ''}${classic ? '' : ' <em>Niet klassiek.</em>'}</small></span><input type="checkbox" data-k="${v.key}" ${on ? 'checked' : ''}><i></i></label>`;
  }).join('');
  const seg = E.TARGETS.map((t) => `<button data-t="${t}" aria-pressed="${rules.target === t}">${t}</button>`).join('');
  const running = g && !g.over;
  box.innerHTML = `<div class="var-list">
      <div class="seg-wrap">Spelen tot<small class="var-note" style="display:block">Klassiek is 101. Een kort spel kan tot 61.</small><div class="seg" role="group" aria-label="Spelen tot">${seg}</div></div>
      ${items}
      <div class="var-actions"><button class="btn btn-ghost" id="btn-classic">Klassieke regels</button><span class="var-note" id="var-note">${running ? 'Je lopende spel houdt de regels van bij de start.' : ''}</span></div>
      <p class="sub-h">Weergave</p>
      <label class="toggle"><span>Punten op de kaarten<small>Een geel bolletje toont hoeveel een kaart waard is.</small></span><input type="checkbox" id="view-pts" ${view.punten ? 'checked' : ''}><i></i></label>
    </div>`;
  box.querySelectorAll('input[data-k]').forEach((inp) => inp.addEventListener('change', () => {
    rules[inp.dataset.k] = inp.checked;
    write(KEY.rules, rules);
    const lab = inp.closest('.toggle');
    const classic = inp.checked === !!E.DEFAULT_RULES[inp.dataset.k];
    lab.classList.toggle('off-classic', !classic);
    const sm = lab.querySelector('small');
    const em = [...sm.querySelectorAll('em')].find((e) => e.textContent === 'Niet klassiek.');
    if (!classic && !em) sm.insertAdjacentHTML('beforeend', ' <em>Niet klassiek.</em>');
    if (classic && em) em.remove();
  }));
  box.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    rules.target = +b.dataset.t;
    write(KEY.rules, rules);
    box.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('btn-classic').addEventListener('click', () => {
    rules = { ...E.DEFAULT_RULES };
    write(KEY.rules, rules);
    const top = $('s-rules').scrollTop;
    buildRules();
    $('s-rules').scrollTop = top;
    $('var-note').textContent = 'De klassieke regels staan weer aan.';
  });
  $('view-pts').addEventListener('change', (e) => {
    view.punten = e.target.checked;
    write(KEY.view, view);
    applyView();
  });
}
document.querySelector('.rules-nav').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  const t = document.querySelector(a.getAttribute('href'));
  if (t) t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
});
function applyView() {
  document.body.classList.toggle('no-pts', !view.punten);
}

// ---------- overlays ----------
let overlayCb = null;
function overlay(html, cb) {
  const o = $('overlays');
  o.innerHTML = `<div class="overlay">${html}</div>`;
  overlayCb = cb;
  const first = o.querySelector('.btn-main') || o.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}
function closeOverlay() {
  $('overlays').innerHTML = '';
  overlayCb = null;
}
$('overlays').addEventListener('click', (e) => {
  const b = e.target.closest('[data-x]');
  if (b && overlayCb) overlayCb(b.dataset.x);
});

$('btn-menu').addEventListener('click', () => {
  overlay(`<div class="sheet"><h3>Pauze</h3><p>${teamLabel(0)} ${g.scores[0]} · ${teamLabel(1)} ${g.scores[1]} · tot ${g.rules.target}</p>
    <button class="btn btn-main" data-x="go">Verder spelen</button>
    <button class="btn btn-ghost" data-x="rules">Spelregels</button>
    <button class="btn btn-ghost" data-x="home">Naar het menu</button>
    <p style="font-size:15px">Je spel blijft bewaard.</p></div>`, (x) => {
    closeOverlay();
    if (x === 'rules') {
      stopTimers();
      rulesFrom = 'table';
      $('table').hidden = true;
      $('screens').hidden = false;
      show('s-rules');
    } else if (x === 'home') toMenu();
    else step();
  });
  stopTimers();
});

$('btn-last').addEventListener('click', () => {
  const d = g.deal;
  const t = d.tricks[d.tricks.length - 1];
  if (!t) return;
  const figs = t.cards.map((x) => `<figure class="${x.p === t.winner ? 'win' : ''}">${cardHTML(x.c)}<figcaption>${nameOf(x.p)}</figcaption></figure>`).join('');
  overlay(`<div class="sheet"><h3>Vorige slag</h3><div class="last-trick">${figs}</div><p>${nameOf(t.winner)} won deze slag: ${t.pts} ${t.pts === 1 ? 'punt' : 'punten'}.</p><button class="btn btn-main" data-x="ok">Oké</button></div>`, () => {
    closeOverlay();
    step();
  });
  stopTimers();
});

// ---------- rendering ----------
function suitOrder(trump) {
  const base = ['h', 's', 'r', 'k'];
  if (trump == null) return base;
  const others = base.filter((s) => s !== trump);
  const opp = others.filter((s) => E.RED[s] !== E.RED[trump]);
  const same = others.filter((s) => E.RED[s] === E.RED[trump]);
  return [trump, opp[0], same[0], opp[1]].filter(Boolean);
}
function sortHand(cards, trump) {
  const ord = suitOrder(trump);
  return cards.slice().sort((a, b) => ord.indexOf(E.suitOf(a)) - ord.indexOf(E.suitOf(b)) || E.strength(b) - E.strength(a));
}

function renderHud() {
  const d = g.deal;
  const m = E.currentMultiplier(g);
  let t;
  if (d.trump === undefined) t = g.carry && g.rules.gelijkDubbel ? `Troef? <span class="x">×${2 ** g.carry}</span>` : 'Troef?';
  else if (d.trump === null) t = `${d.blind ? 'Blind zonder' : 'Zonder troef'}`;
  else t = `${suitIcon(d.trump, colorCls(d.trump))}${suitWord(d.trump)}`;
  if (d.trump !== undefined && m > 1) t += ` <span class="x">×${m}</span>`;
  $('h-trump').innerHTML = t;
  $('h-round').textContent = d.phase === 'play' || d.phase === 'trick' || d.phase === 'end'
    ? `Ronde ${g.dealNo} · ${teamLabel(0).toLowerCase()} ${d.taken[0]} · ${g.mode === 4 ? 'zij' : teamLabel(1)} ${d.taken[1]}`
    : `Ronde ${g.dealNo} · ${nameOf(g.dealer)} deelt`;
  $('h-score').innerHTML = `<div class="sc us">${teamLabel(0)} <b>${g.scores[0]}</b></div><div class="sc">${teamLabel(1)} <b>${g.scores[1]}</b></div><div class="goal">tot ${g.rules.target}</div>`;
}

function seatHTML(p) {
  const d = g.deal;
  const tags = [];
  if (g.dealer === p) tags.push('<span class="tag-s deal">deler</span>');
  if (d.mee === p) tags.push('<span class="tag-s mee">mee</span>');
  if (d.terug === p) tags.push('<span class="tag-s terug">terug</span>');
  if (p !== 0) {
    const n = d.hands[p].length;
    tags.push(`<span class="tag-s">${n} ${g.mode === 2 ? 'in hand' : n === 1 ? 'kaart' : 'kaarten'}</span>`);
  }
  const backs = p !== 0 && g.mode === 4 && posOf(p) === 'top' ? `<div class="backs">${d.hands[p].map(() => backHTML()).join('')}</div>` : '';
  if (p === 0) return `<div class="avatar">J</div><div class="info">${tags.join('')}</div>`;
  return `<div class="avatar">${nameOf(p)[0]}</div><div><div class="nm">${nameOf(p)}</div><div class="info">${tags.join('')}</div>${backs}</div>`;
}

function renderSeats(pd) {
  const seats = g.mode === 4 ? [0, 1, 2, 3] : [0, 1];
  for (const pos of ['me', 'left', 'top', 'right']) $('pos-' + pos).innerHTML = '';
  for (const p of seats) {
    const el = $('pos-' + posOf(p));
    el.innerHTML = seatHTML(p);
    el.className = `seat ${p === 0 ? 'seat-me' : ''} ${teamOf(p) === 0 ? 'us' : 'them'} ${pd.p === p ? 'turn' : ''}`;
    el.setAttribute('aria-label', p === 0 ? 'Jij' : nameOf(p));
  }
}

function renderStacks(pd) {
  const d = g.deal;
  if (!d.stacks) return;
  const mine = pd.type === 'play' && pd.p === 0 ? E.legalFor(g, 0).legal : null;
  for (const [p, id] of [[0, 'stacks-me'], [1, 'stacks-opp']]) {
    $(id).innerHTML = d.stacks[p].map((s, i) => {
      if (!s.length) return '<div class="stack empty"></div>';
      const top = s[s.length - 1];
      const under = s.length > 1 ? backHTML('under') : '';
      let card;
      if (p === 0) {
        const cls = mine ? (mine.includes(top) ? 'legal' : 'dim') : '';
        card = cardHTML(top, { tag: 'button', extra: `top ${cls}`, attrs: `data-src="stack" data-i="${i}"` });
      } else card = cardHTML(top, { extra: 'top' });
      return `<div class="stack ${s.length === 1 ? 'single' : ''}">${under}${card}</div>`;
    }).join('');
  }
}

let trickKey = '';
function renderTrick(pd) {
  const d = g.deal;
  const el = $('trick');
  let cards = d.trick;
  const key = cards.map((x) => x.c).join(',');
  const prev = trickKey.split(',');
  trickKey = key;
  el.className = '';
  if (!cards.length) {
    const msg = pd.type === 'play' && pd.p === 0 && d.tricks.length === 0 ? 'Jij komt uit.<br>Leg een kaart.' : '';
    el.innerHTML = msg ? `<div class="lead-hint">${msg}</div>` : '';
    return;
  }
  const win = E.trickWinner(g);
  el.innerHTML = cards.map((x) => `<div class="tc p${x.p} ${!prev.includes(x.c) ? 'in' : ''} ${pd.type === 'trick' && x.p === win ? 'win' : ''}">${cardHTML(x.c)}</div>`).join('')
    + (pd.type === 'trick' ? `<div class="trick-note">Slag voor ${nameOf(win)} · ${cards.reduce((s, x) => s + E.points(x.c), 0)} ptn</div>` : '');
}

function handHidden() {
  const d = g.deal;
  if (d.phase === 'blind' && g.dealer === 0) return true;
  if (g.mode === 4 && (d.phase === 'blind' || d.phase === 'trump') && g.dealer === 2 && d.chooser === 2) return true;
  return false;
}

function renderHand(pd) {
  const d = g.deal;
  const el = $('hand');
  const hidden = handHidden();
  el.classList.toggle('hidden-hand', hidden);
  const legal = pd.type === 'play' && pd.p === 0 ? E.legalFor(g, 0).legal : null;
  const cards = sortHand(d.hands[0], d.trump);
  el.innerHTML = hidden
    ? cards.map(() => backHTML()).join('')
    : cards.map((c) => cardHTML(c, { tag: 'button', extra: legal ? (legal.includes(c) ? 'legal' : 'dim') : '', attrs: `data-src="hand"` })).join('');
  layoutHand();
}
function layoutHand() {
  const el = $('hand');
  const cards = [...el.children];
  const n = cards.length;
  if (!n) return;
  const W = el.clientWidth;
  const cw = cards[0].offsetWidth;
  const step = n > 1 ? Math.min(cw + 8, (W - cw) / (n - 1)) : 0;
  const x0 = (W - (cw + step * (n - 1))) / 2;
  cards.forEach((c, i) => {
    c.style.left = `${Math.round(x0 + i * step)}px`;
    c.style.zIndex = String(i + 1);
  });
}

function setStatus(html) {
  $('status').innerHTML = html;
}

function statusFor(pd) {
  const d = g.deal;
  switch (pd.type) {
    case 'blind': return pd.p === 0 ? 'Jij deelt.' : `${nameOf(pd.p)} deelt <span class="mut">en denkt na…</span>`;
    case 'trump': return pd.p === 0 ? 'Kies de troef.' : `${nameOf(pd.p)} kiest troef<span class="mut">…</span>`;
    case 'mee': return pd.p === 0 ? 'Ga je mee?' : `${nameOf(pd.p)} denkt na<span class="mut">…</span>`;
    case 'terug': return pd.p === 0 ? 'Ga je terug?' : `${nameOf(pd.p)} denkt na<span class="mut">…</span>`;
    case 'play':
      if (pd.p === 0) return d.trick.length ? 'Jij bent aan zet. <span class="mut">Speel een kaart die oplicht.</span>' : 'Jij komt uit.';
      return `${nameOf(pd.p)} is aan zet<span class="mut">…</span>`;
    case 'trick': return `${nameOf(E.trickWinner(g))} wint de slag.`;
    case 'end': case 'over': return 'De ronde is gedaan.';
  }
  return '';
}

// decision panel for the human
let decideMin = false;
function renderDecide(pd) {
  const el = $('decide');
  const d = g.deal;
  const mine = pd.p === 0 && ['blind', 'trump', 'mee', 'terug'].includes(pd.type);
  if (!mine) {
    el.hidden = true;
    el.classList.remove('min');
    decideMin = false;
    return;
  }
  el.hidden = false;
  const minBtn = g.mode === 2 ? `<button class="chip-btn" data-d="min" style="justify-self:center">${decideMin ? 'Toon keuze' : 'Bekijk de tafel'}</button>` : '';
  el.classList.toggle('min', decideMin);
  if (decideMin) {
    el.innerHTML = minBtn;
    return;
  }
  const trumpTxt = d.trump === null ? (d.blind ? 'blind zonder troef' : 'zonder troef') : d.trump ? E.SUIT_NAME[d.trump] + ' als troef' : '';
  if (pd.type === 'blind') {
    el.innerHTML = `<h3>Blind zonder troef?</h3><p>Je hebt je kaarten nog niet gezien. Kies je nu zonder troef, dan telt deze ronde <b>vier keer</b>.</p>
      <div class="row"><button class="btn btn-ghost" data-d="blind-no">Kaarten bekijken</button><button class="btn btn-main" data-d="blind-yes">Blind spelen</button></div>`;
  } else if (pd.type === 'trump') {
    const avail = E.available(g, 0);
    const btns = E.SUITS.map((s) => {
      const n = avail.filter((c) => E.suitOf(c) === s).length;
      return `<button class="suit-btn ${colorCls(s)}" data-d="t-${s}" aria-label="${E.SUIT_NAME[s]} troef">${suitIcon(s)}<span>${suitWord(s)}</span><small>${n} ${n === 1 ? 'kaart' : 'kaarten'}</small></button>`;
    }).join('');
    const who = d.passed ? `${nameOf(g.dealer)} laat jou kiezen.` : g.mode === 2 ? 'Jij deelt. Kijk naar je hand en de open kaarten.' : 'Jij deelt. Welke kleur wordt troef?';
    el.innerHTML = `<h3>Kies troef</h3><p>${who}</p><div class="suit-grid">${btns}</div>
      <button class="btn btn-ghost" data-d="t-zonder">Zonder troef${g.rules.zonderDubbel ? ' <small style="font-size:15px;opacity:.75">(telt dubbel)</small>' : ''}</button>
      ${pd.canPass ? '<button class="btn btn-ghost" data-d="t-pass">Partner laten kiezen</button>' : ''}${minBtn}`;
  } else if (pd.type === 'mee') {
    el.innerHTML = `<h3>Meegaan?</h3><p>${nameOf(d.chooser)} koos <b>${trumpTxt}</b>. Ga je mee, dan telt deze ronde <b>dubbel</b>. Doe dat als je denkt dat ${g.mode === 4 ? 'jullie' : 'jij'} toch meer dan 30 haalt.</p>
      <div class="row"><button class="btn btn-ghost" data-d="mee-no">Niet mee</button><button class="btn btn-main" data-d="mee-yes">Meegaan</button></div>${minBtn}`;
  } else if (pd.type === 'terug') {
    el.innerHTML = `<h3>Terug?</h3><p>${nameOf(d.mee)} gaat mee met ${trumpTxt}. Zeg je terug, dan telt de ronde <b>nog eens dubbel</b>.</p>
      <div class="row"><button class="btn btn-ghost" data-d="terug-no">Niet terug</button><button class="btn btn-main" data-d="terug-yes">Terug</button></div>${minBtn}`;
  }
}
$('decide').addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  const v = b.dataset.d;
  if (v === 'min') {
    decideMin = !decideMin;
    renderDecide(E.pending(g));
    return;
  }
  const pd = E.pending(g);
  if (pd.p !== 0) return;
  let a = null;
  if (v === 'blind-yes' || v === 'blind-no') a = { type: 'blind', yes: v === 'blind-yes' };
  else if (v.startsWith('t-')) a = { type: 'trump', choice: v.slice(2) };
  else if (v === 'mee-yes' || v === 'mee-no') a = { type: 'mee', yes: v === 'mee-yes' };
  else if (v === 'terug-yes' || v === 'terug-no') a = { type: 'terug', yes: v === 'terug-yes' };
  if (!a || a.type !== pd.type) return;
  decideMin = false;
  E.act(g, a);
  saveGame();
  step();
});

// speech bubbles for what the others say
let lastSaid = 0;
function sayText(x) {
  if (E.SUITS.includes(x.what)) return `${suitIcon(x.what, colorCls(x.what))} ${suitWord(x.what)} is troef`;
  return { zonder: 'Zonder troef!', blind: 'Blind zonder troef!', pass: 'Kies jij maar', mee: 'Ik ga mee!', 'niet-mee': 'Pas', terug: 'Terug!', 'niet-terug': 'Pas' }[x.what] || '';
}
function bubbles() {
  const d = g.deal;
  const fresh = d.said.slice(lastSaid);
  lastSaid = d.said.length;
  for (const x of fresh) {
    if (x.p === 0) continue;
    const el = $('pos-' + posOf(x.p));
    const b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = sayText(x);
    el.appendChild(b);
    setTimeout(() => b.remove(), Math.max(400, wait(1700)));
  }
}

let toastTimer = 0;
function toast(html) {
  const t = $('toast');
  t.innerHTML = html;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2800);
}

function reasonText(c) {
  const d = g.deal;
  const info = E.analyze(E.available(g, 0), d.trick, 0, d.trump, g.rules, teamOf);
  const led = info.led;
  const opp = info.win && teamOf(info.win.p) !== 0;
  const who = g.mode === 2 ? `${nameOf(1)} heeft de slag.` : opp ? 'De tegenpartij heeft de slag.' : 'Met deze variant moet je ook over je partner.';
  const ledName = led ? E.SUIT_NAME[led] : '';
  switch (info.rule) {
    case 'bekennen': return `Je moet <b>kleur bekennen</b>: speel ${ledName}.`;
    case 'hoger': return E.suitOf(c) !== led ? `Je moet <b>kleur bekennen</b>: speel ${ledName}.` : `${who} Je moet <b>hoger gaan</b> als je kunt.`;
    case 'kopen': return `Je hebt geen ${ledName}. ${who} Je moet <b>kopen</b>: speel troef.`;
    case 'overtroeven': return `Je hebt geen ${ledName}. ${who} Je moet <b>hoger troeven</b> als je kunt.`;
    case 'ondertroeven': return '<b>Ondertroeven mag niet.</b> Speel een andere kleur.';
  }
  return 'Deze kaart mag nu niet.';
}

$('table').addEventListener('click', (e) => {
  const b = e.target.closest('button.card[data-c]');
  if (!b) return;
  const pd = E.pending(g);
  const c = b.dataset.c;
  if (pd.type !== 'play') {
    if (['blind', 'trump', 'mee', 'terug'].includes(pd.type) && pd.p === 0) toast('Maak eerst je keuze hierboven.');
    else if (pd.type === 'trick') toast('Even wachten, de slag wordt opgeraapt.');
    else toast('Even wachten, de anderen kiezen nog.');
    return;
  }
  if (pd.p !== 0) {
    toast(`Wacht even, <b>${nameOf(pd.p)}</b> is aan zet.`);
    return;
  }
  const { legal } = E.legalFor(g, 0);
  if (!legal.includes(c)) {
    toast(reasonText(c));
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
    return;
  }
  $('toast').hidden = true;
  E.act(g, { type: 'play', card: c });
  saveGame();
  step();
});

// ---------- the driver ----------
let timer = 0;
let busy = false;
function stopTimers() {
  clearTimeout(timer);
  timer = 0;
  busy = false;
}
let shownEnd = null;

// Test/archive: a record of each finished deal (in memory only).
const archive = [];
function track() {
  const key = (g.id || 'x') + ':' + g.dealNo;
  let a = archive.find((x) => x.key === key && !x.done);
  if (!a && g.deal && g.deal.phase !== 'end') {
    a = { key, dealNo: g.dealNo, dealer: g.dealer, scoresBefore: g.scores.slice(), carryBefore: g.carry, rules: { ...g.rules }, mode: g.mode, done: false };
    archive.push(a);
    if (archive.length > 300) archive.shift();
  }
  if (a && g.deal.phase === 'end') {
    a.deal = JSON.parse(JSON.stringify(g.deal));
    a.scoresAfter = g.scores.slice();
    a.carryAfter = g.carry;
    a.done = true;
  }
}

function render(pd) {
  renderHud();
  renderSeats(pd);
  renderStacks(pd);
  renderTrick(pd);
  renderHand(pd);
  renderDecide(pd);
  setStatus(statusFor(pd));
  $('btn-last').hidden = !g.deal.tricks.length || pd.type === 'end' || pd.type === 'over';
  bubbles();
}

function step() {
  if ($('table').hidden || !g) return;
  clearTimeout(timer);
  track();
  const pd = E.pending(g);
  render(pd);
  if (pd.type === 'trick') {
    const w = E.trickWinner(g);
    timer = setTimeout(() => {
      const el = $('trick');
      el.classList.add('out', 'to' + (g.mode === 2 && w === 1 ? 1 : w));
      timer = setTimeout(() => {
        E.act(g, { type: 'trick' });
        saveGame();
        step();
      }, reduced() ? 0 : wait(340));
    }, wait(1050));
    return;
  }
  if (pd.type === 'end' || pd.type === 'over') {
    if (shownEnd !== g.dealNo) {
      shownEnd = g.dealNo;
      timer = setTimeout(showDealEnd, wait(250));
    }
    return;
  }
  if (pd.p !== 0) {
    const delay = pd.type === 'play' ? 650 : 950;
    timer = setTimeout(() => {
      const a = decide(g, pd);
      E.act(g, a);
      saveGame();
      step();
    }, wait(delay));
  }
}

function factorLabel(f, d) {
  switch (f.key) {
    case 'gelijk': return 'Vorige ronde was gelijk';
    case 'zonder': return 'Zonder troef';
    case 'blind': return 'Blind zonder troef';
    case 'mee': return `${nameOf(d.mee)} ging mee`;
    case 'terug': return `${nameOf(d.terug)} ging terug`;
    case 'alle': return 'Alle slagen';
  }
  return '';
}

function showDealEnd() {
  const d = g.deal;
  const r = d.result;
  const win = r.winTeam;
  let head;
  if (r.tie) head = 'Gelijk: 30 tegen 30';
  else head = g.mode === 4 ? `${teamLabel(win)} winnen de ronde` : win === 0 ? 'Jij wint de ronde' : `${nameOf(1)} wint de ronde`;
  const rows = [];
  if (!r.tie) {
    rows.push(`<div><span>${d.taken[win]} min 30</span><b>${r.base}</b></div>`);
    for (const f of r.factors) rows.push(`<div><span>${factorLabel(f, d)}</span><b>×${f.x}</b></div>`);
    if (r.capped) rows.push('<div><span>Hoogstens vier keer</span><b>×4</b></div>');
    rows.push(`<div class="tot"><span>Erbij voor ${teamLabel(win).toLowerCase()}</span><b>+${r.gained}</b></div>`);
  } else {
    rows.push(`<div><span>${g.rules.gelijkDubbel ? 'Niemand krijgt punten. De volgende ronde telt dubbel.' : 'Niemand krijgt punten.'}</span></div>`);
  }
  const res = [0, 1].map((t) => `<div class="${!r.tie && t === win ? 'best' : ''}"><b>${d.taken[t]}</b><small>${teamLabel(t)} · ${d.won[t]} ${d.won[t] === 1 ? 'slag' : 'slagen'}</small></div>`).join('');
  const score = `${teamLabel(0)} <b style="color:var(--accent)">${g.scores[0]}</b> · ${teamLabel(1)} <b style="color:var(--text)">${g.scores[1]}</b> <span style="font-size:15px">(tot ${g.rules.target})</span>`;
  if (g.over) {
    const won = g.winner === 0;
    overlay(`<div class="sheet"><h3 class="${won ? 'win' : 'lose'}">${won ? 'Gewonnen!' : 'Verloren'}</h3>
      <p>${head}. ${won ? (g.mode === 4 ? 'Jij en Lotte halen' : 'Jij haalt') : g.mode === 4 ? 'Rik en Jef halen' : `${nameOf(1)} haalt`} als eerste ${g.rules.target}.</p>
      <div class="res">${res}</div><div class="calc">${rows.join('')}</div>
      <p>Eindstand: ${score}</p>
      <div class="row"><button class="btn btn-ghost" data-x="home">Menu</button><button class="btn btn-main" data-x="again">Nog een spel</button></div></div>`, (x) => {
      closeOverlay();
      const mode = g.mode;
      g = null;
      write(KEY.game, null);
      if (x === 'again') newGame(mode);
      else toMenu();
    });
    return;
  }
  overlay(`<div class="sheet"><h3>Ronde ${g.dealNo}</h3><p>${head}</p>
    <div class="res">${res}</div><div class="calc">${rows.join('')}</div>
    <p>Stand: ${score}</p>
    <button class="btn btn-main" data-x="next">Volgende ronde</button></div>`, () => {
    closeOverlay();
    E.act(g, { type: 'end' });
    lastSaid = 0;
    trickKey = '';
    saveGame();
    step();
  });
}

// ---------- lifecycle ----------
window.addEventListener('resize', () => !$('table').hidden && layoutHand());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && g) saveGame();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('overlays').firstChild && overlayCb) {
    const b = $('overlays').querySelector('[data-x="go"], [data-x="ok"], [data-x="no"]');
    if (b) overlayCb(b.dataset.x);
  }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

$('logo').innerHTML = ['kH', 'h10', 'sA'].map((c) => cardHTML(c)).join('');
applyView();

// Test hook for automated checks (harmless in normal play).
window.__mn = { get g() { return g; }, E, archive, step, newGame };

toMenu();
