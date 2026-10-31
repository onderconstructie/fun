// Manillen: screens, the table, input, computer turns, animation and saving.

import * as E from './engine.js';
import { decide, decidePlayWhy, decideTrump, decideMee, decideTerug, decideBlind } from './ai.js';
import { cardHTML, backHTML, suitIcon, cardLabel } from './cards.js';
import { rulesHTML, VARIANTS } from './rules-text.js';
import * as S from './sound.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const SPEED = new URLSearchParams(location.search).has('snel') ? 0.04 : 1;
const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const TEMPO = { rustig: 1.5, normaal: 1, vlot: 0.6 };
const tempo = () => (TEMPO[view.tempo] || 1) * SPEED;
const wait = (ms) => ms * tempo();
const dur = (ms) => (reduced() ? 0 : Math.max(1, ms * tempo()));

// ---------- storage (own prefix, never clear everything) ----------
const KEY = { rules: 'manillen.regels', game: 'manillen.spel', view: 'manillen.weergave', tour: 'manillen.rondleiding' };
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
const VIEW_DEFAULT = { punten: true, vier: false, tempo: 'normaal', tik: 'een', geluid: false, trillen: true, tips: true };
let view = { ...VIEW_DEFAULT, ...read(KEY.view, {}) };
if (!TEMPO[view.tempo]) view.tempo = 'normaal';
const saveView = () => write(KEY.view, view);

function validGame(x) {
  try {
    if (!x || x.v !== 1 || !(x.mode === 2 || x.mode === 4) || !x.deal || !Array.isArray(x.deal.hands) || !Array.isArray(x.scores)) return false;
    x.rules = { ...E.DEFAULT_RULES, ...(x.rules || {}) };
    const d = x.deal;
    if (!Array.isArray(d.trick) || !Array.isArray(d.tricks) || !Array.isArray(d.said) || !Array.isArray(d.taken) || !Array.isArray(d.won)) return false;
    if (x.mode === 2 && !Array.isArray(d.stacks)) return false;
    const pd = E.pending(x);
    return pd.type !== '?';
  } catch (e) {
    return false;
  }
}
let g = read(KEY.game, null);
if (!validGame(g)) {
  if (g) write(KEY.game, null);
  g = null;
}
const saveGame = () => write(KEY.game, g);

// ---------- roles and icons ----------
// Geen namen: elke plaats heeft een rol en een eigen persoonsicoon.
const NAMES4 = ['Jij', 'Links', 'Je partner', 'Rechts'];
const NAMES2 = ['Jij', 'Tegenspeler'];
const SHORT4 = ['Jij', 'Links', 'Partner', 'Rechts'];
const nameOf = (p) => (g.mode === 4 ? NAMES4 : NAMES2)[p];
const shortOf = (p) => (g.mode === 4 ? SHORT4 : NAMES2)[p];
const teamLabel = (t) => (g.mode === 4 ? ['Wij', 'Zij'][t] : NAMES2[t]);
const teamOf = (p) => E.teamOfFor(g.mode)(p);
const posOf = (p) => (g.mode === 4 ? ['me', 'left', 'top', 'right'][p] : ['me', 'top'][p]);
const seatEl = (p) => $('pos-' + posOf(p));
// Vlakke typetjes, zelf bedacht en op niemand gebaseerd: jij, een wijze partner, en twee machthebbers (een generaal en een heerseres).
const PERSON = {
  me: '<path d="M8 33c0-6.6 5.4-11 12-11s12 4.4 12 11z"/><circle cx="20" cy="14" r="6.5"/><path class="hl" d="M13.4 13.2c0-4.6 3-7.4 6.6-7.4s6.6 2.8 6.6 7.4c-1.6-2.2-4-3.2-6.6-3.2s-5 1-6.6 3.2z"/>',
  general: '<path d="M8 34c0-6.8 5.4-11.4 12-11.4s12 4.6 12 11.4z" fill="#4a5a3a"/><circle cx="20" cy="15.2" r="6.4" fill="#f1d3b3"/><path d="M16.6 22.8 20 27l3.4-4.2z" fill="#3a4a2c"/><circle cx="14.4" cy="28.6" r="1.3" fill="#e9b949"/><circle cx="17.4" cy="28.9" r="1.3" fill="#c2413b"/><circle cx="23" cy="28.9" r="1.3" fill="#e9b949"/><circle cx="25.8" cy="28.6" r="1.3" fill="#c2413b"/><rect x="13.2" y="30.6" width="5.2" height="1.2" rx=".4" fill="#e9b949"/><rect x="22" y="30.6" width="5.2" height="1.2" rx=".4" fill="#e9b949"/><path d="M10.6 11.6c0-3.6 4.2-6.4 9.4-6.4s9.4 2.8 9.4 6.4z" fill="#4a5a3a"/><rect x="12.6" y="10.6" width="14.8" height="2.2" fill="#c2413b"/><path d="M12.8 12.8h14.4l-1.6 2.2h-11.2z" fill="#26301c"/><circle cx="20" cy="8.6" r="1.4" fill="#e9b949"/><path d="M17.2 18.2c1-.8 1.9-.8 2.8 0 .9-.8 1.8-.8 2.8 0-.9.9-1.9 1-2.8.4-.9.6-1.9.5-2.8-.4z" fill="#5b4632"/>',
  heerseres: '<path d="M12.6 16c-.8 4 .4 7.4 2.2 8.6h10.4c1.8-1.2 3-4.6 2.2-8.6z" fill="#4b3427"/><path d="M8 34c0-6.8 5.4-11.4 12-11.4s12 4.6 12 11.4z" fill="#6b2f4f"/><circle cx="20" cy="15.2" r="6.4" fill="#f1d3b3"/><path d="M13.4 24.4 15.6 21h8.8l2.2 3.4-6.6 3.2z" fill="#f5efe6"/><path d="M12.4 25.4 26.8 33.8h-3.4L10.6 27z" fill="#e9b949"/><path d="M13.4 14.6c0-4.2 3-6.6 6.6-6.6s6.6 2.4 6.6 6.6c-1.6-2.4-3.8-3.2-6.6-3.2s-5 .8-6.6 3.2z" fill="#4b3427"/><path d="M14.6 9.2 15.4 4.6l2.4 2.6L20 3.8l2.2 3.4 2.4-2.6.8 4.6z" fill="#e9b949"/><circle cx="20" cy="7.4" r=".9" fill="#c2413b"/><circle cx="17.6" cy="23.6" r=".7" fill="#fff"/><circle cx="20" cy="24.4" r=".7" fill="#fff"/><circle cx="22.4" cy="23.6" r=".7" fill="#fff"/>',
  baron: '<path d="M8 34c0-6.8 5.4-11.4 12-11.4s12 4.6 12 11.4z" fill="#2b2b3a"/><circle cx="20" cy="15.2" r="6.4" fill="#f3d9c0"/><path d="M16.4 22.8 20 26.6l3.6-3.8z" fill="#f5efe6"/><path d="M19.2 24.2h1.6l.6 5-1.4 1.4-1.4-1.4z" fill="#a3262a"/><path d="M12.6 25.6c2.4 3 4.8 4.2 7.4 4.2s5-1.2 7.4-4.2" stroke="#e9b949" stroke-width="1.1" fill="none"/><rect x="14.2" y="2.6" width="11.6" height="9" rx=".6" fill="#1d1d28"/><rect x="11.4" y="10.8" width="17.2" height="2" rx="1" fill="#1d1d28"/><rect x="14.2" y="8.8" width="11.6" height="1.6" fill="#c2413b"/><circle cx="22.6" cy="15.4" r="1.9" fill="none" stroke="#e9b949" stroke-width=".8"/><path d="M24.2 16.6l1.6 4" stroke="#e9b949" stroke-width=".5"/><path d="M16.4 18.4c1.2-1.2 2.4-1.2 3.6 0 1.2-1.2 2.4-1.2 3.6 0-1 .3-2.4.3-3.6-.2-1.2.5-2.6.5-3.6.2z" fill="#6b5a4a"/>',
  wijze: '<path d="M8 34c0-6.8 5.4-11.4 12-11.4s12 4.6 12 11.4z" fill="#e0803a"/><circle cx="20" cy="15.2" r="6.4" fill="#c98e63"/><path d="M11 30.6h18" stroke="#2e7d6b" stroke-width="1.6"/><path d="M10 33h20" stroke="#f2c14e" stroke-width="1.4"/><circle cx="15" cy="27.4" r=".9" fill="#2e7d6b"/><circle cx="20" cy="26.6" r=".9" fill="#f2c14e"/><circle cx="25" cy="27.4" r=".9" fill="#2e7d6b"/><circle cx="14.6" cy="11.6" r="2.1" fill="#d6d3cf"/><circle cx="16.4" cy="9.2" r="2.1" fill="#d6d3cf"/><circle cx="19" cy="8.2" r="2.1" fill="#d6d3cf"/><circle cx="21.8" cy="8.4" r="2.1" fill="#d6d3cf"/><circle cx="24.2" cy="9.6" r="2.1" fill="#d6d3cf"/><circle cx="25.6" cy="12" r="2.1" fill="#d6d3cf"/><path d="M17.4 17.6c1.5 1.6 3.7 1.6 5.2 0" stroke="#7a4a2e" stroke-width="1" fill="none" stroke-linecap="round"/>',
  wijsvrouw: '<circle cx="20" cy="8.4" r="3.6" fill="#d6d3cf"/><path d="M8 34c0-6.8 5.4-11.4 12-11.4s12 4.6 12 11.4z" fill="#2e7d6b"/><circle cx="20" cy="15.2" r="6.4" fill="#8d5a3b"/><path d="M13.4 14.8c0-4.4 3-6.8 6.6-6.8s6.6 2.4 6.6 6.8c-1.8-2-4-2.8-6.6-2.8s-4.8.8-6.6 2.8z" fill="#d6d3cf"/><path d="M13.8 23.6c2 1.8 4 2.6 6.2 2.6s4.2-.8 6.2-2.6l1 2.4c-2.2 1.8-4.6 2.6-7.2 2.6s-5-.8-7.2-2.6z" fill="#f2c14e"/><circle cx="15" cy="30" r=".9" fill="#f2c14e"/><circle cx="20" cy="31" r=".9" fill="#e0803a"/><circle cx="25" cy="30" r=".9" fill="#f2c14e"/><circle cx="13.6" cy="17.6" r=".8" fill="#e9b949"/><circle cx="26.4" cy="17.6" r=".8" fill="#e9b949"/><path d="M17.4 17.6c1.5 1.6 3.7 1.6 5.2 0" stroke="#4a2c1a" stroke-width="1" fill="none" stroke-linecap="round"/>',
};
// Per spel een willekeurige bezetting: twee machthebbers tegen je, een wijze partner naast je.
const RIVALS = ['general', 'heerseres', 'baron'];
const PARTNERS = ['wijze', 'wijsvrouw'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function castFor(mode) {
  const r = RIVALS.slice().sort(() => Math.random() - 0.5);
  return mode === 4 ? { 1: r[0], 2: pick(PARTNERS), 3: r[1] } : { 1: r[0] };
}
const iconKey = (p) => {
  if (p === 0) return 'me';
  const c = g.cast && PERSON[g.cast[p]] ? g.cast[p] : null;
  return c || (g.mode === 2 ? 'heerseres' : ({ 1: 'general', 2: 'wijze', 3: 'heerseres' })[p]);
};
const personSVG = (p) => `<svg viewBox="${iconKey(p) === 'me' ? '6 3 28 30' : '6 2 28 31'}" aria-hidden="true">${PERSON[iconKey(p)]}</svg>`;
const suitWord = (s) => E.SUIT_NAME[s][0].toUpperCase() + E.SUIT_NAME[s].slice(1);
const colorCls = (s) => `${E.RED[s] ? 'red' : 'black'} s-${s}`;
const ptsTxt = (n) => `${n} ${n === 1 ? 'punt' : 'punten'}`;
const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ---------- feedback: sound, vibration, screen reader ----------
function haptic(p) {
  if (!view.trillen || !navigator.vibrate) return;
  try {
    navigator.vibrate(p);
  } catch (e) {
    /* not allowed here */
  }
}
const sfx = (name) => S.play(name);
S.setSound(view.geluid);
let srBuf = [];
let srTimer = 0;
function announce(text) {
  if (!text) return;
  srBuf.push(strip(text));
  clearTimeout(srTimer);
  srTimer = setTimeout(() => {
    const el = $('sr');
    el.textContent = '';
    const msg = srBuf.join(' ');
    srBuf = [];
    requestAnimationFrame(() => (el.textContent = msg));
  }, 60);
}

// ---------- screens ----------
let rulesFrom = 's-home';
let settingsFrom = 's-home';
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.id !== id));
  if (id === 's-home') refreshHome();
  if (id === 's-rules') buildRules();
  if (id === 's-settings') buildSettings();
  const scr = $(id);
  if (scr) {
    scr.scrollTop = 0;
    const h = scr.querySelector('h1, h2');
    if (id !== 's-home' && h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }
}
function toMenu() {
  stopTimers();
  closeOverlay();
  $('table').hidden = true;
  $('screens').hidden = false;
  app.classList.add('is-menu');
  show('s-home');
}
function toScreen(id, from) {
  stopTimers();
  closeOverlay();
  if (id === 's-rules') rulesFrom = from;
  if (id === 's-settings') settingsFrom = from;
  $('table').hidden = true;
  $('screens').hidden = false;
  app.classList.add('is-menu');
  show(id);
}
function toTable() {
  $('screens').hidden = true;
  $('table').hidden = false;
  app.classList.remove('is-menu');
  $('table').classList.toggle('two', g.mode === 2);
  $('table').classList.toggle('four', g.mode === 4);
  lastSaid = g.deal ? g.deal.said.length : 0;
  trickKey = '';
  shownEnd = null;
  barShown = null;
  fit();
  step();
  if (!read(KEY.tour, false)) setTimeout(() => startTour(), 350);
}
function back(from) {
  if (from === 'table' && g) toTable();
  else show('s-home');
}

function refreshHome() {
  const has = !!g && !g.over;
  $('btn-resume').hidden = !has;
  if (has) $('resume-sub').textContent = `Met ${g.mode === 4 ? 'vier' : 'twee'} · ${teamLabel(0)} ${g.scores[0]}, ${teamLabel(1)} ${g.scores[1]} · ronde ${g.dealNo}`;
}

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  rulesFrom = 's-home';
  settingsFrom = 's-home';
  show(b.dataset.go);
}));
$('rules-back').addEventListener('click', () => back(rulesFrom));
$('settings-back').addEventListener('click', () => back(settingsFrom));
$('btn-resume').addEventListener('click', () => g && toTable());
$('btn-four').addEventListener('click', () => askNew(4));
$('btn-two').addEventListener('click', () => askNew(2));

function askNew(mode, onNo) {
  if (g && !g.over) {
    overlay(`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h3 id="dlg-t">Nieuw spel?</h3><p>Je lopende spel stopt dan. De stand is ${teamLabel(0)} ${g.scores[0]}, ${teamLabel(1)} ${g.scores[1]}.</p>
      <div class="row"><button class="btn btn-ghost" data-x="no">Nee</button><button class="btn btn-main" data-x="yes">Ja, start</button></div></div>`, (x) => {
      closeOverlay();
      if (x === 'yes') newGame(mode);
      else if (onNo) onNo();
    });
  } else newGame(mode);
}
function newGame(mode) {
  g = E.createGame(mode, rules);
  g.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  g.cast = castFor(mode);
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
      <div class="var-actions"><button class="btn btn-ghost" id="btn-classic">Klassieke regels</button><span class="var-note" id="var-note" aria-live="polite">${running ? 'Je lopende spel houdt de regels van bij de start.' : ''}</span></div>
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
}
document.querySelector('.rules-nav').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  const t = document.querySelector(a.getAttribute('href'));
  if (t) t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
});

// ---------- settings screen ----------
function segHTML(key, opts, label) {
  return `<div class="seg" role="group" aria-label="${label}">${opts.map(([v, t]) => `<button data-v="${key}:${v}" aria-pressed="${view[key] === v}">${t}</button>`).join('')}</div>`;
}
function toggleHTML(key, title, text) {
  return `<label class="toggle"><span>${title}${text ? `<small>${text}</small>` : ''}</span><input type="checkbox" data-view="${key}" ${view[key] ? 'checked' : ''}><i></i></label>`;
}
function buildSettings() {
  const four = ['hA', 'kA', 'rA', 'sA'].map((c) => cardHTML(c, { extra: 'mini' })).join('');
  $('settings-body').innerHTML = `
    <p class="sub-h">Spelen</p>
    <div class="seg-wrap">Tempo<small class="var-note">Hoe snel de anderen spelen.</small>${segHTML('tempo', [['rustig', 'Rustig'], ['normaal', 'Normaal'], ['vlot', 'Vlot']], 'Tempo')}</div>
    <div class="seg-wrap">Een kaart spelen<small class="var-note">Slepen naar het midden kan altijd.</small>${segHTML('tik', [['een', 'Eén tik'], ['twee', 'Tik, dan bevestig']], 'Een kaart spelen')}</div>
    ${toggleHTML('tips', 'Tip-knop', 'Toont een goede kaart, met de reden erbij.')}
    <p class="sub-h">Kaarten</p>
    <label class="toggle"><span>Vier kleuren<small>Ruiten blauw, klaveren groen. Handig als je rood en zwart moeilijk uit elkaar houdt.</small><span class="mini-row preview ${view.vier ? 'four' : ''}" id="four-prev">${four}</span></span><input type="checkbox" data-view="vier" ${view.vier ? 'checked' : ''}><i></i></label>
    ${toggleHTML('punten', 'Punten op de kaarten', 'Een geel bolletje toont hoeveel een kaart waard is.')}
    <p class="sub-h">Geluid en trillen</p>
    ${toggleHTML('geluid', 'Geluid', 'Zachte tikjes en belletjes. Staat standaard uit.')}
    ${toggleHTML('trillen', 'Trillen', 'Een kort tikje bij een kaart, op een gsm die dat kan.')}
    <p class="sub-h">Hulp</p>
    <button class="btn btn-ghost" id="btn-tour">Rondleiding opnieuw bekijken</button>`;
  const body = $('settings-body');
  body.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
    const [k, v] = b.dataset.v.split(':');
    view[k] = v;
    saveView();
    b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  body.querySelectorAll('input[data-view]').forEach((inp) => inp.addEventListener('change', () => {
    view[inp.dataset.view] = inp.checked;
    saveView();
    applyView();
    if (inp.dataset.view === 'geluid' && inp.checked) {
      S.unlock();
      setTimeout(() => sfx('trick-us'), 30);
    }
    if (inp.dataset.view === 'trillen' && inp.checked) haptic(12);
    if (inp.dataset.view === 'vier') $('four-prev').classList.toggle('four', inp.checked);
  }));
  $('btn-tour').addEventListener('click', () => {
    write(KEY.tour, null);
    if (g && !g.over) toTable();
    else {
      $('btn-tour').textContent = 'De rondleiding start bij je volgende spel.';
    }
  });
}
function applyView() {
  document.body.classList.toggle('no-pts', !view.punten);
  document.body.classList.toggle('four-color', !!view.vier);
  S.setSound(view.geluid);
}

// ---------- overlays ----------
let overlayCb = null;
let overlayReturn = null;
function overlay(html, cb, cls = '') {
  const o = $('overlays');
  overlayReturn = document.activeElement;
  o.innerHTML = `<div class="overlay ${cls}">${html}</div>`;
  overlayCb = cb;
  $('table').setAttribute('aria-hidden', 'true');
  const first = o.querySelector('.btn-main') || o.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}
function closeOverlay() {
  $('overlays').innerHTML = '';
  overlayCb = null;
  $('table').removeAttribute('aria-hidden');
  if (overlayReturn && document.contains(overlayReturn) && !$('table').hidden) {
    try {
      overlayReturn.focus({ preventScroll: true });
    } catch (e) {
      /* gone */
    }
  }
  overlayReturn = null;
}
$('overlays').addEventListener('click', (e) => {
  const b = e.target.closest('[data-x]');
  if (b && overlayCb) overlayCb(b.dataset.x);
});

function openPause() {
  if (!g) return;
  stopTimers();
  overlay(`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h3 id="dlg-t">Pauze</h3>
    <p>${teamLabel(0)} <b class="us-t">${g.scores[0]}</b> · ${teamLabel(1)} <b>${g.scores[1]}</b> · tot ${g.rules.target}</p>
    <button class="btn btn-main" data-x="go">Verder spelen</button>
    <div class="row"><button class="btn btn-ghost" data-x="settings">Instellingen</button><button class="btn btn-ghost" data-x="rules">Spelregels</button></div>
    <div class="row"><button class="btn btn-ghost" data-x="again">Nieuw spel</button><button class="btn btn-ghost" data-x="home">Menu</button></div>
    <p class="fine">Je spel blijft bewaard, ook als je de pagina sluit.</p></div>`, (x) => {
    closeOverlay();
    if (x === 'rules') toScreen('s-rules', 'table');
    else if (x === 'settings') toScreen('s-settings', 'table');
    else if (x === 'home') toMenu();
    else if (x === 'again') {
      const mode = g.mode;
      g.over = true; // so askNew does not ask twice
      g = null;
      write(KEY.game, null);
      newGame(mode);
    } else step();
  });
}
$('btn-menu').addEventListener('click', openPause);

function lastTrickSheet() {
  const d = g.deal;
  const t = d.tricks[d.tricks.length - 1];
  if (!t) return;
  stopTimers();
  const figs = t.cards.map((x) => `<figure class="${x.p === t.winner ? 'win' : ''}">${cardHTML(x.c)}<figcaption>${shortOf(x.p)}</figcaption></figure>`).join('');
  overlay(`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h3 id="dlg-t">Vorige slag</h3><div class="last-trick">${figs}</div><p>${nameOf(t.winner)} won deze slag: <b>${ptsTxt(t.pts)}</b>.</p><button class="btn btn-main" data-x="ok">Oké</button></div>`, () => {
    closeOverlay();
    step();
  });
}
$('btn-last').addEventListener('click', lastTrickSheet);

// ---------- sizes: cards always as big as the screen allows ----------
function fit() {
  const t = $('table');
  if (t.hidden || !g) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const land = W > H && H < 560;
  const wide = !land && W >= 1100 && H >= 640;
  t.classList.toggle('land', land);
  t.classList.toggle('wide', wide);
  t.classList.toggle('port', !land && !wide);
  const hw = $('hand').clientWidth || W - 16;
  let cw = Math.min(hw - 7 * 44, (H * (land ? 0.25 : 0.165)) / 1.42, land ? 86 : 124);
  cw = Math.max(46, Math.floor(cw));
  t.style.setProperty('--cw', cw + 'px');
  const f = $('felt').getBoundingClientRect();
  const fw = f.width;
  const fh = f.height;
  let cwt;
  let cws = cw;
  if (g.mode === 4) {
    const tr = $('trick').getBoundingClientRect();
    cwt = Math.min(tr.width / 2.6, tr.height / 2.5, cw * (land ? 1.15 : 1.45), 150);
  } else if (land) {
    cws = Math.min(cw, (fh - 50) / 2 / 1.46, (fw * 0.3 - 16) / 2);
    cwt = Math.min(cw * 1.3, (fh - 16) / 1.42 / 1.18, (fw - 4 * cws - 120) / 1.9);
  } else {
    cws = Math.min(cw * 1.05, (fw - 40) / 4.35, (fh - 112) / 4.6);
    cwt = Math.min(cw * 1.3, (fh - 112 - 2 * (1.42 * cws + 12)) / 1.42 / 1.16, (fw - 20) / 1.9);
  }
  t.style.setProperty('--cwt', Math.max(40, Math.floor(cwt)) + 'px');
  t.style.setProperty('--cws', Math.max(38, Math.floor(cws)) + 'px');
}

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

function multParts() {
  const d = g.deal;
  const parts = [];
  if (g.rules.gelijkDubbel && g.carry) parts.push(`vorige ronde gelijk (×${2 ** g.carry})`);
  if (d.trump === null) {
    if (d.blind) parts.push('blind zonder troef (×4)');
    else if (g.rules.zonderDubbel) parts.push('zonder troef (×2)');
  }
  if (d.mee != null) parts.push(`${shortOf(d.mee)} ging mee (×2)`);
  if (d.terug != null) parts.push(`${shortOf(d.terug)} zei terug (×2)`);
  return parts;
}

function renderHud(pd) {
  const d = g.deal;
  const m = E.currentMultiplier(g);
  let t;
  if (d.trump === undefined) t = `<span class="tc-q">Troef?</span>${g.carry && g.rules.gelijkDubbel ? ` <span class="x">×${2 ** g.carry}</span>` : ''}`;
  else if (d.trump === null) t = `<span class="zt">${d.blind ? 'Blind zonder' : 'Zonder troef'}</span>`;
  else t = `${suitIcon(d.trump, colorCls(d.trump))}<span>${suitWord(d.trump)}</span>`;
  if (d.trump !== undefined && m > 1) t += ` <span class="x">×${m}</span>`;
  $('h-trump').innerHTML = t;
  $('h-trump').className = `trump-chip ${d.trump ? colorCls(d.trump) : ''} ${d.trump === undefined ? 'open' : ''}`;
  const sub = d.phase === 'blind' || d.phase === 'trump' ? `${nameOf(g.dealer)} deelt` : d.phase === 'mee' || d.phase === 'terug' ? 'Meegaan?' : `Slag ${Math.min(d.tricks.length + 1, E.tricksPerDeal(g))} van ${E.tricksPerDeal(g)}`;
  $('h-round').textContent = `Ronde ${g.dealNo} · ${sub}`;
  const trumpName = d.trump === undefined ? 'nog niet gekozen' : d.trump === null ? (d.blind ? 'blind zonder troef' : 'zonder troef') : E.SUIT_NAME[d.trump];
  $('h-mid').setAttribute('aria-label', `Troef: ${trumpName}${m > 1 ? `, deze ronde telt ${m} keer` : ''}. Tik voor uitleg.`);
  $('h-score').innerHTML = `<small>Stand</small><div class="sc2"><b class="us">${g.scores[0]}</b><span>–</span><b class="them">${g.scores[1]}</b></div><small>tot ${g.rules.target}</small>`;
  $('h-score').setAttribute('aria-label', `Stand: ${teamLabel(0)} ${g.scores[0]}, ${teamLabel(1)} ${g.scores[1]}, spelen tot ${g.rules.target}`);
  $('h-score').setAttribute('role', 'img');
  renderBar(pd);
}

// Live round points: who gets over the line in the middle (more than 30 of 60) wins the round.
let barShown = null;
function renderBar() {
  const d = g.deal;
  const el = $('roundbar');
  if (!el.firstChild) {
    el.innerHTML = `<div class="rb-team us"><span class="rb-n"></span><b class="rb-v">0</b></div>
      <div class="rb-track"><i class="rb-us"></i><i class="rb-them"></i><em class="rb-mid"><span>30</span></em></div>
      <div class="rb-team them"><b class="rb-v">0</b><span class="rb-n"></span></div>`;
  }
  const [a, b] = d.taken;
  const names = el.querySelectorAll('.rb-n');
  names[0].textContent = g.mode === 4 ? 'Wij' : 'Jij';
  names[1].textContent = g.mode === 4 ? 'Zij' : 'Tegen';
  el.querySelector('.rb-us').style.width = `${(a / 60) * 100}%`;
  el.querySelector('.rb-them').style.width = `${(b / 60) * 100}%`;
  el.classList.toggle('us-over', a > 30);
  el.classList.toggle('them-over', b > 30);
  const vals = el.querySelectorAll('.rb-v');
  const prev = barShown || [a, b];
  countTo(vals[0], prev[0], a);
  countTo(vals[1], prev[1], b);
  barShown = [a, b];
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Punten in deze ronde: ${teamLabel(0)} ${a}, ${teamLabel(1)} ${b}. Meer dan 30 wint de ronde.`);
}
function countTo(el, from, to) {
  if (from === to || reduced()) {
    el.textContent = to;
    return;
  }
  const t0 = performance.now();
  const len = dur(520);
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / len);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function fanBacks(n, max = 8) {
  if (!n) return '';
  return `<div class="backs" aria-hidden="true">${Array.from({ length: Math.min(n, max) }, () => '<i></i>').join('')}</div>`;
}

function seatHTML(p, pd) {
  const d = g.deal;
  const tags = [];
  if (pd.p === p && ['play', 'trump', 'blind', 'mee', 'terug'].includes(pd.type)) tags.push('<span class="tag-s turn-t">aan zet</span>');
  if (g.dealer === p) tags.push('<span class="tag-s deal" title="deler">deler</span>');
  if (d.mee === p) tags.push('<span class="tag-s mee">mee ×2</span>');
  if (d.terug === p) tags.push('<span class="tag-s terug">terug ×2</span>');
  const n = d.hands[p].length;
  const backs = p !== 0 ? fanBacks(n) : '';
  const count = p !== 0 ? `<span class="cnt">${n}${g.mode === 2 ? ' in hand' : ''}</span>` : '';
  return `<div class="avatar">${personSVG(p)}</div><div class="who"><div class="nm">${shortOf(p)}${count}</div>${backs}<div class="info">${tags.join('')}</div></div>`;
}

function renderSeats(pd) {
  const seats = g.mode === 4 ? [0, 1, 2, 3] : [0, 1];
  for (const pos of ['me', 'left', 'top', 'right']) {
    const el = $('pos-' + pos);
    el.innerHTML = '';
    el.className = `seat seat-${pos}`;
    el.removeAttribute('aria-label');
  }
  const d = g.deal;
  for (const p of seats) {
    const el = seatEl(p);
    el.innerHTML = seatHTML(p, pd);
    const turn = pd.p === p && ['play', 'trump', 'blind', 'mee', 'terug'].includes(pd.type);
    el.className = `seat seat-${posOf(p)} ${teamOf(p) === 0 ? 'us' : 'them'} ${turn ? 'turn' : ''}`;
    const bits = [nameOf(p)];
    if (turn) bits.push('aan zet');
    if (g.dealer === p) bits.push('deler');
    if (d.mee === p) bits.push('ging mee');
    if (d.terug === p) bits.push('zei terug');
    if (p !== 0) bits.push(`${d.hands[p].length} kaarten in de hand`);
    el.setAttribute('aria-label', bits.join(', '));
    el.setAttribute('role', 'group');
  }
}

let tipCard = null;
function renderStacks(pd) {
  const d = g.deal;
  if (!d.stacks) return;
  const mine = pd.type === 'play' && pd.p === 0 ? E.legalFor(g, 0).legal : null;
  for (const [p, id] of [[0, 'stacks-me'], [1, 'stacks-opp']]) {
    $(id).innerHTML = d.stacks[p].map((s, i) => {
      if (!s.length) return '<div class="stack empty" aria-hidden="true"></div>';
      const top = s[s.length - 1];
      const under = s.length > 1 ? backHTML('under') : '';
      let card;
      const tr = d.trump && E.suitOf(top) === d.trump ? 'trump' : '';
      if (p === 0) {
        const ok = mine && mine.includes(top);
        const cls = mine ? (ok ? 'legal' : 'dim') : '';
        const lab = `${cardLabel(top)}${tr ? ', troef' : ''}, open op tafel${mine ? (ok ? ', mag' : ', mag nu niet') : ''}`;
        card = cardHTML(top, { tag: 'button', extra: `top ${cls} ${tr} ${tipCard === top ? 'tip' : ''}`, attrs: `data-src="stack" data-i="${i}" aria-label="${lab}" ${mine && !ok ? 'aria-disabled="true"' : ''}` });
      } else card = cardHTML(top, { extra: `top ${tr}` });
      return `<div class="stack ${s.length === 1 ? 'single' : ''}">${under}${card}</div>`;
    }).join('');
  }
}

let trickKey = '';
function renderTrick(pd) {
  const d = g.deal;
  const el = $('trick');
  const cards = d.trick;
  const key = cards.map((x) => x.c).join(',');
  const prev = trickKey.split(',');
  trickKey = key;
  el.classList.remove('out');
  if (!cards.length) {
    let msg = '';
    if (pd.type === 'play' && pd.p === 0) msg = d.tricks.length === 0 ? 'Jij komt uit.<br><small>Speel een kaart.</small>' : 'Jij komt uit.';
    el.innerHTML = msg ? `<div class="lead-hint">${msg}</div>` : '';
    return;
  }
  const win = E.trickWinner(g);
  const done = pd.type === 'trick';
  const pts = cards.reduce((s, x) => s + E.points(x.c), 0);
  el.innerHTML = cards.map((x, i) => {
    const w = x.p === win;
    const chip = w ? `<span class="win-chip ${done ? 'done' : ''}">${done ? `+${pts}` : 'hoogste'}</span>` : '';
    const tr = d.trump && E.suitOf(x.c) === d.trump ? 'trump' : '';
    return `<div class="tc p${x.p} ${!prev.includes(x.c) ? 'in' : ''} ${w ? 'lead' : ''} ${done && w ? 'win' : ''}" data-c="${x.c}" style="z-index:${i + 1}">${cardHTML(x.c, { extra: tr, attrs: `aria-label="${shortOf(x.p)}: ${cardLabel(x.c)}${w ? ', hoogste' : ''}"` })}${chip}</div>`;
  }).join('');
}

function handHidden() {
  const d = g.deal;
  if (d.phase === 'blind' && g.dealer === 0) return true;
  if (g.mode === 4 && (d.phase === 'blind' || d.phase === 'trump') && g.dealer === 2 && d.chooser === 2) return true;
  return false;
}

let selected = null;
let dealtFor = '';
function renderHand(pd) {
  const d = g.deal;
  const el = $('hand');
  const hidden = handHidden();
  const focusC = document.activeElement && document.activeElement.closest && document.activeElement.closest('#hand, #stacks-me') ? document.activeElement.dataset.c : null;
  const focusI = focusC ? [...el.children].findIndex((x) => x.dataset.c === focusC) : -1;
  el.classList.toggle('hidden-hand', hidden);
  const myTurn = pd.type === 'play' && pd.p === 0;
  const legal = myTurn ? E.legalFor(g, 0).legal : null;
  el.classList.toggle('my-turn', myTurn);
  const cards = sortHand(d.hands[0], d.trump);
  if (selected && !(legal && legal.includes(selected) && cards.includes(selected))) selected = null;
  el.innerHTML = hidden
    ? cards.map(() => backHTML()).join('')
    : cards.map((c) => {
      const ok = legal && legal.includes(c);
      const tr = d.trump && E.suitOf(c) === d.trump ? 'trump' : '';
      const cls = `${legal ? (ok ? 'legal' : 'dim') : ''} ${tr} ${tipCard === c ? 'tip' : ''} ${selected === c ? 'sel' : ''}`;
      const lab = `${cardLabel(c)}${tr ? ', troef' : ''}${legal ? (ok ? ', mag' : ', mag nu niet') : ''}`;
      return cardHTML(c, { tag: 'button', extra: cls, attrs: `data-src="hand" tabindex="-1" aria-label="${lab}" ${legal && !ok ? 'aria-disabled="true"' : ''}` });
    }).join('');
  layoutHand();
  rovingInit(focusC, focusI);
  // deal animation once per deal
  const dk = `${g.id || ''}:${g.dealNo}`;
  if (dealtFor !== dk && !d.tricks.length && !d.trick.length && ['blind', 'trump', 'mee', 'terug', 'play'].includes(d.phase)) {
    dealtFor = dk;
    dealAnim();
  }
}

function layoutHand() {
  const el = $('hand');
  const cards = [...el.children];
  const n = cards.length;
  if (!n) return;
  const pad = 8;
  const W = el.clientWidth - pad * 2;
  const cw = cards[0].offsetWidth;
  const step = n > 1 ? Math.min(cw + 10, (W - cw) / (n - 1)) : 0;
  const overlap = step < cw;
  const x0 = pad + (W - (cw + step * (n - 1))) / 2;
  const mid = (n - 1) / 2;
  const rotK = overlap ? 1.7 : 0.9;
  const dyK = overlap ? 1.6 : 0.8;
  cards.forEach((c, i) => {
    const k = i - mid;
    c.style.left = `${Math.round(x0 + i * step)}px`;
    c.style.zIndex = String(i + 1);
    c.style.setProperty('--rot', `${(k * rotK).toFixed(2)}deg`);
    c.style.setProperty('--dy', `${((k * k - mid * mid) * dyK).toFixed(1)}px`);
  });
}

function dealAnim() {
  sfx('deal');
  if (reduced()) return;
  const dealerSeat = seatEl(g.dealer);
  const src = dealerSeat ? dealerSeat.getBoundingClientRect() : $('felt').getBoundingClientRect();
  const sx = src.left + src.width / 2;
  const sy = src.top + src.height / 2;
  [...$('hand').children].forEach((c, i) => {
    const r = c.getBoundingClientRect();
    c.animate([
      { translate: `${sx - (r.left + r.width / 2)}px ${sy - (r.top + r.height / 2)}px`, scale: 0.4, opacity: 0 },
      { translate: '0 0', scale: 1, opacity: 1 },
    ], { duration: dur(360), delay: dur(45) * i, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
  });
  document.querySelectorAll('#felt .backs i, .stacks .card').forEach((c, i) => {
    c.animate([{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }], { duration: dur(260), delay: dur(20) * i, fill: 'backwards' });
  });
}

// roving focus: one card in the tab order, arrows move between cards
let rovingIdx = 0;
function playables() {
  return [...document.querySelectorAll('#stacks-me button.card, #hand button.card')];
}
function rovingInit(focusC, focusI) {
  const list = playables();
  if (!list.length) return;
  let i = focusC ? list.findIndex((x) => x.dataset.c === focusC) : -1;
  if (i < 0 && focusI >= 0) i = Math.min(focusI, list.length - 1);
  if (i < 0) i = Math.min(rovingIdx, list.length - 1);
  if (i < 0) i = 0;
  rovingIdx = i;
  list.forEach((x, k) => (x.tabIndex = k === i ? 0 : -1));
  if (focusC || focusI >= 0) list[i].focus({ preventScroll: true });
}

function statusFor(pd) {
  const d = g.deal;
  switch (pd.type) {
    case 'blind': return pd.p === 0 ? '<b>Jij deelt.</b> Blind spelen?' : `<b>${nameOf(pd.p)}</b> deelt <span class="mut">en denkt na…</span>`;
    case 'trump': return pd.p === 0 ? '<b>Kies de troef.</b>' : `<b>${nameOf(pd.p)}</b> kiest troef<span class="mut">…</span>`;
    case 'mee': return pd.p === 0 ? '<b>Ga je mee?</b>' : `<b>${nameOf(pd.p)}</b> denkt na<span class="mut">…</span>`;
    case 'terug': return pd.p === 0 ? '<b>Zeg je terug?</b>' : `<b>${nameOf(pd.p)}</b> denkt na<span class="mut">…</span>`;
    case 'play':
      if (pd.p === 0) return `<b>Jij bent aan zet.</b> <span class="mut">${obligation()}</span>`;
      return `<b>${nameOf(pd.p)}</b> is aan zet<span class="mut">…</span>${d.trick.length ? ` <span class="mut">${shortOf(E.trickWinner(g))} heeft de slag.</span>` : ''}`;
    case 'trick': {
      const w = E.trickWinner(g);
      const pts = d.trick.reduce((s, x) => s + E.points(x.c), 0);
      return `<b>${nameOf(w)}</b> wint de slag <span class="gain-t ${teamOf(w) === 0 ? 'us' : 'them'}">+${pts}</span>`;
    }
    case 'end': case 'over': return '<b>De ronde is gedaan.</b>';
  }
  return '';
}
// What must I do right now? Said before you tap, not only after a wrong tap.
function obligation() {
  const d = g.deal;
  if (!d.trick.length) return 'Je komt uit: alles mag.';
  const info = E.legalFor(g, 0);
  const ledName = info.led ? E.SUIT_NAME[info.led] : '';
  const partnerHas = g.mode === 4 && info.win && teamOf(info.win.p) === 0;
  switch (info.rule) {
    case 'bekennen': return `Bekennen: speel ${ledName}.`;
    case 'hoger': return `Ga hoger in ${ledName}.`;
    case 'kopen': return `Geen ${ledName}: koop met troef.`;
    case 'overtroeven': return 'Troef hoger dan de troef op tafel.';
    case 'ondertroeven': return 'Niet ondertroeven: speel een andere kleur.';
  }
  if (partnerHas) return 'Je partner heeft de slag: je bent vrij.';
  const follow = E.available(g, 0).some((c) => E.suitOf(c) === info.led);
  if (!follow) return `Geen ${ledName}: alles mag.`;
  return 'Speel een kaart die oplicht.';
}

// decision panel for the human
let decideMin = false;
let tipChoice = null;
function renderDecide(pd) {
  const el = $('decide');
  const d = g.deal;
  const mine = pd.p === 0 && ['blind', 'trump', 'mee', 'terug'].includes(pd.type);
  if (!mine) {
    el.hidden = true;
    el.classList.remove('min');
    decideMin = false;
    tipChoice = null;
    return;
  }
  const wasHidden = el.hidden;
  el.hidden = false;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-labelledby', 'dec-t');
  const minBtn = g.mode === 2 ? `<button class="chip-btn min-btn" data-d="min">${decideMin ? 'Toon de keuze' : 'Bekijk de tafel'}</button>` : '';
  el.classList.toggle('min', decideMin);
  if (decideMin) {
    el.innerHTML = minBtn;
    return;
  }
  const tc = (v) => (tipChoice === v ? 'tip' : '');
  const trumpTxt = d.trump === null ? (d.blind ? 'blind zonder troef' : 'zonder troef') : d.trump ? `${E.SUIT_NAME[d.trump]} als troef` : '';
  if (pd.type === 'blind') {
    el.innerHTML = `<h3 id="dec-t">Blind zonder troef?</h3><p>Je hebt je kaarten nog niet gezien. Kies je nu zonder troef, dan telt deze ronde <b>vier keer</b>.</p>
      <div class="row"><button class="btn btn-ghost ${tc('no')}" data-d="blind-no">Kaarten bekijken</button><button class="btn btn-main ${tc('yes')}" data-d="blind-yes">Blind spelen</button></div>`;
  } else if (pd.type === 'trump') {
    const avail = E.available(g, 0);
    const btns = E.SUITS.map((s) => {
      const mine = avail.filter((c) => E.suitOf(c) === s);
      const n = mine.length;
      const p = mine.reduce((a, c) => a + E.points(c), 0);
      return `<button class="suit-btn ${colorCls(s)} ${tc(s)}" data-d="t-${s}" aria-label="${E.SUIT_NAME[s]} troef, je hebt er ${n}, samen ${p} punten">${suitIcon(s)}<span>${suitWord(s)}</span><small>${n} ${n === 1 ? 'kaart' : 'kaarten'}<br>${p} ${p === 1 ? 'punt' : 'punten'}</small></button>`;
    }).join('');
    const who = d.passed ? `${nameOf(g.dealer)} laat jou kiezen.` : g.mode === 2 ? 'Jij deelt. Kijk naar je hand en je open kaarten.' : 'Jij deelt. Welke kleur wordt troef?';
    el.innerHTML = `<h3 id="dec-t">Kies troef</h3><p>${who}</p><div class="suit-grid">${btns}</div>
      <button class="btn btn-ghost ${tc('zonder')}" data-d="t-zonder">Zonder troef${g.rules.zonderDubbel ? ' <small class="dbl">telt dubbel</small>' : ''}</button>
      ${pd.canPass ? '<button class="btn btn-ghost" data-d="t-pass">Partner laten kiezen</button>' : ''}${minBtn}`;
  } else if (pd.type === 'mee') {
    el.innerHTML = `<h3 id="dec-t">Meegaan?</h3><p>${nameOf(d.chooser)} koos <b>${trumpTxt}</b>. Ga je mee, dan telt deze ronde <b>dubbel</b>. Doe dat als je denkt dat ${g.mode === 4 ? 'jullie' : 'jij'} toch meer dan 30 haalt.</p>
      <div class="row"><button class="btn btn-ghost ${tc('no')}" data-d="mee-no">Niet mee</button><button class="btn btn-main ${tc('yes')}" data-d="mee-yes">Meegaan</button></div>${minBtn}`;
  } else if (pd.type === 'terug') {
    el.innerHTML = `<h3 id="dec-t">Terug?</h3><p>${nameOf(d.mee)} gaat mee met ${trumpTxt}. Zeg je terug, dan telt de ronde <b>nog eens dubbel</b>.</p>
      <div class="row"><button class="btn btn-ghost ${tc('no')}" data-d="terug-no">Niet terug</button><button class="btn btn-main ${tc('yes')}" data-d="terug-yes">Terug</button></div>${minBtn}`;
  }
  if (wasHidden && $('overlays').childElementCount === 0) {
    const f = el.querySelector('.btn-main, .suit-btn');
    if (f && document.activeElement && document.activeElement !== document.body && !el.contains(document.activeElement)) f.focus({ preventScroll: true });
    announce(strip(el.querySelector('h3').textContent + '. ' + (el.querySelector('p') ? el.querySelector('p').textContent : '')));
  }
}
$('decide').addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  S.unlock();
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
  tipChoice = null;
  haptic(10);
  E.act(g, a);
  saveGame();
  step();
  if (e.detail === 0) {
    // keyboard: keep focus on the table, not lost on a button that is gone
    const f = $('decide').hidden ? playables()[rovingIdx] || playables()[0] : $('decide').querySelector('button');
    if (f) f.focus({ preventScroll: true });
  }
});

// speech bubbles for what the others say
let lastSaid = 0;
function sayText(x) {
  if (E.SUITS.includes(x.what)) return `${suitIcon(x.what, colorCls(x.what))} ${suitWord(x.what)} is troef`;
  return { zonder: 'Zonder troef!', blind: 'Blind zonder troef!', pass: 'Kies jij maar', mee: 'Ik ga mee!', 'niet-mee': 'Ik pas', terug: 'Terug!', 'niet-terug': 'Ik pas' }[x.what] || '';
}
function bubbles() {
  const d = g.deal;
  const fresh = d.said.slice(lastSaid);
  lastSaid = d.said.length;
  for (const x of fresh) {
    if (x.p === 0) continue;
    const el = seatEl(x.p);
    if (!el) continue;
    const b = document.createElement('div');
    const loud = ['mee', 'terug', 'zonder', 'blind'].includes(x.what);
    b.className = `bubble ${loud ? 'loud' : ''}`;
    b.innerHTML = sayText(x);
    el.appendChild(b);
    announce(`${shortOf(x.p)}: ${strip(sayText(x))}.`);
    if (loud) haptic(18);
    setTimeout(() => b.remove(), Math.max(900, wait(1900)));
  }
}

let toastTimer = 0;
function toast(html, ms = 3000) {
  const t = $('toast');
  t.innerHTML = html;
  t.hidden = false;
  t.classList.remove('pop');
  void t.offsetWidth;
  t.classList.add('pop');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}
$('toast').addEventListener('click', () => ($('toast').hidden = true));

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

// ---------- tip ----------
const WHY = {
  enige: 'Dit is de enige kaart die mag.',
  zeker: 'Deze kaart wint zeker: niemand kan er nog over.',
  troefhalen: 'Een kleine troef haalt de troeven van de tegenpartij weg.',
  'laag-uit': 'Kom uit met een kaart die weinig waard is. Gaat de slag naar de tegenpartij, dan verlies je weinig.',
  'partner-punten': 'Je partner wint deze slag. Leg er punten bij.',
  'partner-laag': 'Je partner wint deze slag. Hou je sterke kaarten voor later.',
  'pakken-zeker': 'Hiermee pak je de slag, en niemand kan er nog over.',
  'kopen-laag': 'Pak de slag met een kleine troef. Hou de grote voor later.',
  gokken: 'Er liggen veel punten. Probeer de slag te pakken.',
  goedkoop: 'Deze slag win je niet zeker. Leg je goedkoopste kaart.',
};
function giveTip() {
  if (!g) return;
  const pd = E.pending(g);
  if (pd.p !== 0) return;
  S.unlock();
  let html = '';
  if (pd.type === 'play') {
    const { card, why } = decidePlayWhy(g, 0);
    tipCard = card;
    html = `<b>Tip:</b> ${cardLabel(card).split(',')[0]}. ${WHY[why] || ''}`;
    render(pd);
  } else if (pd.type === 'trump') {
    const ch = decideTrump(g, 0, false);
    tipChoice = ch;
    html = ch === 'zonder'
      ? '<b>Tip:</b> zonder troef. Je hebt sterke manilles in meer dan één kleur.'
      : `<b>Tip:</b> ${E.SUIT_NAME[ch]}. Daar heb je de meeste en sterkste kaarten.`;
    renderDecide(pd);
  } else if (pd.type === 'mee' || pd.type === 'terug') {
    const yes = pd.type === 'mee' ? decideMee(g, 0) : decideTerug(g, 0);
    tipChoice = yes ? 'yes' : 'no';
    html = yes ? '<b>Tip:</b> doe het. Je hebt een sterke hand voor deze troef.' : '<b>Tip:</b> beter niet. Je hand is niet sterk genoeg. Dan verlies je dubbel.';
    renderDecide(pd);
  } else if (pd.type === 'blind') {
    const yes = decideBlind(g, 0);
    tipChoice = yes ? 'yes' : 'no';
    html = yes ? '<b>Tip:</b> je staat ver achter. Een gok kan nu helpen.' : '<b>Tip:</b> bekijk eerst je kaarten. Blind spelen is een grote gok.';
    renderDecide(pd);
  }
  if (html) {
    toast(html, 5200);
    announce(html);
  }
}
$('btn-tip').addEventListener('click', giveTip);
$('h-mid').addEventListener('click', () => {
  if (!g || !g.deal) return;
  const d = g.deal;
  const parts = multParts();
  let txt;
  if (d.trump === undefined) txt = 'De troef is nog niet gekozen. De troefkleur wint van alle andere kleuren.';
  else if (d.trump === null) txt = '<b>Zonder troef.</b> Alleen de gevraagde kleur telt. De hoogste kaart van die kleur wint.';
  else txt = `<b>${suitWord(d.trump)} is troef.</b> Een ${E.SUIT_NAME[d.trump]}kaart wint van elke kaart van een andere kleur.`;
  if (parts.length) txt += ` Deze ronde telt <b>×${E.currentMultiplier(g)}</b>: ${parts.join(', ')}.`;
  toast(txt, 5200);
});

// ---------- playing a card: tap, tap-tap, drag or keyboard ----------
let fly = null;
function tryPlay(c, el, via) {
  const pd = E.pending(g);
  if (pd.type !== 'play') {
    if (['blind', 'trump', 'mee', 'terug'].includes(pd.type) && pd.p === 0) toast('Maak eerst je keuze op de tafel.');
    else if (pd.type === 'trick') toast('Even wachten: de slag wordt opgeraapt.');
    else toast('Even wachten: de anderen kiezen nog.');
    return false;
  }
  if (pd.p !== 0) {
    toast(`Wacht even: <b>${nameOf(pd.p)}</b> is aan zet.`);
    return false;
  }
  const { legal } = E.legalFor(g, 0);
  if (!legal.includes(c)) {
    toast(reasonText(c));
    announce(reasonText(c));
    sfx('nope');
    haptic([14, 50, 14]);
    if (!reduced()) {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }
    return false;
  }
  if (via === 'tap' && view.tik === 'twee' && selected !== c) {
    selected = c;
    document.querySelectorAll('#hand .card.sel, #stacks-me .card.sel').forEach((x) => x.classList.remove('sel'));
    el.classList.add('sel');
    haptic(6);
    toast('Tik nog eens op de kaart om ze te spelen.', 1800);
    return false;
  }
  $('toast').hidden = true;
  const r = el.getBoundingClientRect();
  fly = { c, rect: r };
  selected = null;
  tipCard = null;
  haptic(10);
  sfx('card');
  E.act(g, { type: 'play', card: c });
  saveGame();
  step();
  return true;
}

let drag = null;
let suppressClick = false;
$('table').addEventListener('pointerdown', (e) => {
  S.unlock();
  const b = e.target.closest('button.card[data-c]');
  if (!b || e.button > 0) return;
  const pd = E.pending(g);
  if (pd.type !== 'play' || pd.p !== 0) return;
  drag = { el: b, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false };
});
$('table').addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0;
  const dy = e.clientY - drag.y0;
  if (!drag.on) {
    if (dy < -14 && Math.abs(dy) > Math.abs(dx) * 0.8) {
      drag.on = true;
      drag.el.classList.add('drag');
      try {
        drag.el.setPointerCapture(e.pointerId);
      } catch (err) {
        /* fine */
      }
    } else return;
  }
  drag.el.style.translate = `${dx}px ${dy}px`;
  const hand = $('hand').getBoundingClientRect();
  drag.el.classList.toggle('drop-ok', e.clientY < hand.top - 20);
});
function endDrag(e, cancel) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag;
  drag = null;
  if (!d.on) return;
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 60);
  const hand = $('hand').getBoundingClientRect();
  const over = !cancel && e.clientY < hand.top - 20;
  if (over && tryPlay(d.el.dataset.c, d.el, 'drag')) return;
  d.el.classList.remove('drag', 'drop-ok');
  d.el.style.translate = '';
}
$('table').addEventListener('pointerup', (e) => endDrag(e, false));
$('table').addEventListener('pointercancel', (e) => endDrag(e, true));

$('table').addEventListener('click', (e) => {
  const b = e.target.closest('button.card[data-c]');
  if (!b || suppressClick) return;
  const list = playables();
  const i = list.indexOf(b);
  if (i >= 0) {
    rovingIdx = i;
    list.forEach((x, k) => (x.tabIndex = k === i ? 0 : -1));
  }
  tryPlay(b.dataset.c, b, e.detail === 0 ? 'key' : 'tap');
});

// ---------- the driver ----------
let timer = 0;
function stopTimers() {
  clearTimeout(timer);
  timer = 0;
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

function renderSide() {
  const el = $('side');
  if (!$('table').classList.contains('wide')) {
    el.innerHTML = '';
    return;
  }
  const d = g.deal;
  const rows = d.tricks.map((t, i) => {
    const mini = t.cards.map((x) => `<span class="${x.p === t.winner ? 'w' : ''}">${cardHTML(x.c, { extra: 'mini' })}</span>`).join('');
    return `<li class="${teamOf(t.winner) === 0 ? 'us' : 'them'}"><span class="n">${i + 1}</span><span class="mini-row">${mini}</span><span class="who-w">${shortOf(t.winner)}</span><b>+${t.pts}</b></li>`;
  }).reverse().join('');
  const parts = multParts();
  el.innerHTML = `<h2>Ronde ${g.dealNo}</h2>
    <p class="side-sub">${nameOf(g.dealer)} deelt${parts.length ? ` · telt ×${E.currentMultiplier(g)}` : ''}</p>
    ${parts.length ? `<p class="side-x">${parts.join('<br>')}</p>` : ''}
    <h3>Slagen</h3>
    ${rows ? `<ol class="tricks">${rows}</ol>` : '<p class="side-empty">Nog geen slagen. Wie meer dan 30 van de 60 punten haalt, wint de ronde.</p>'}`;
}

function render(pd) {
  renderHud(pd);
  renderSeats(pd);
  renderStacks(pd);
  renderTrick(pd);
  renderHand(pd);
  renderDecide(pd);
  renderSide();
  $('status').innerHTML = statusFor(pd);
  const d = g.deal;
  const lt = d.tricks[d.tricks.length - 1];
  const showLast = !!lt && pd.type !== 'end' && pd.type !== 'over' && !$('table').classList.contains('wide');
  $('btn-last').hidden = !showLast;
  if (showLast) $('btn-last').innerHTML = `<span class="lt-cards" aria-hidden="true">${lt.cards.map((x) => `<i class="${x.p === lt.winner ? 'w' : ''} ${E.RED[E.suitOf(x.c)] ? 'red' : 'black'} s-${E.suitOf(x.c)}">${E.rankOf(x.c)}</i>`).join('')}</span><span class="lt-l">Vorige</span>`;
  const tipOk = view.tips && pd.p === 0 && ['play', 'trump', 'mee', 'terug', 'blind'].includes(pd.type) && !handHidden();
  $('btn-tip').hidden = !tipOk;
  bubbles();
}

function flyIn() {
  if (!fly) return;
  const { c, rect } = fly;
  fly = null;
  if (reduced() || !rect) return;
  const el = document.querySelector(`#trick .tc[data-c="${c}"] .card`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const dx = rect.left + rect.width / 2 - (r.left + r.width / 2);
  const dy = rect.top + rect.height / 2 - (r.top + r.height / 2);
  const s = Math.max(0.2, rect.width / r.width);
  el.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: rect.ghost ? 0 : 1 },
    { transform: 'none', opacity: 1 },
  ], { duration: dur(rect.ghost ? 300 : 260), easing: 'cubic-bezier(.2,.8,.25,1)' });
}

function aiSource(p, c) {
  const stack = document.querySelector(`#stacks-opp [data-c="${c}"]`);
  if (stack) return stack.getBoundingClientRect();
  const seat = seatEl(p);
  const a = seat && (seat.querySelector('.backs') || seat.querySelector('.avatar'));
  if (!a) return null;
  const r = a.getBoundingClientRect();
  const w = 30;
  return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - w * 0.7, width: w, height: w * 1.42, ghost: true };
}

function collectTrick(w, done) {
  const cards = [...document.querySelectorAll('#trick .tc .card')];
  const seat = seatEl(w);
  const av = seat && seat.querySelector('.avatar');
  if (reduced() || !av || !cards.length) {
    done();
    return;
  }
  const t = av.getBoundingClientRect();
  const tx = t.left + t.width / 2;
  const ty = t.top + t.height / 2;
  const len = dur(380);
  cards.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    el.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${tx - (r.left + r.width / 2)}px, ${ty - (r.top + r.height / 2)}px) scale(0.28)`, opacity: 0.1 },
    ], { duration: len, delay: i * dur(25), easing: 'cubic-bezier(.55,0,.7,.4)', fill: 'forwards' });
  });
  timer = setTimeout(done, len + cards.length * dur(25));
}

function gainPop(w, pts) {
  const seat = seatEl(w);
  if (!seat) return;
  const s = document.createElement('span');
  s.className = `gain ${teamOf(w) === 0 ? 'us' : 'them'}`;
  s.textContent = `+${pts}`;
  s.setAttribute('aria-hidden', 'true');
  seat.appendChild(s);
  setTimeout(() => s.remove(), reduced() ? 900 : 1300);
}

let lastTurnAnnounced = '';
function step() {
  if ($('table').hidden || !g) return;
  if (tourOn) return;
  clearTimeout(timer);
  track();
  const pd = E.pending(g);
  render(pd);
  flyIn();
  if (pd.type === 'play' && pd.p === 0) {
    const k = `${g.dealNo}:${g.deal.tricks.length}:${g.deal.trick.length}`;
    if (lastTurnAnnounced !== k) {
      lastTurnAnnounced = k;
      announce(`Jij bent aan zet. ${obligation()}`);
    }
  }
  if (pd.type === 'trick') {
    const w = E.trickWinner(g);
    const pts = g.deal.trick.reduce((s, x) => s + E.points(x.c), 0);
    timer = setTimeout(() => {
      collectTrick(w, () => {
        E.act(g, { type: 'trick' });
        saveGame();
        sfx(teamOf(w) === 0 ? 'trick-us' : 'trick-them');
        if (teamOf(w) === 0) haptic(pts >= 8 ? [10, 40, 10] : 8);
        gainPop(w, pts);
        const d = g.deal;
        announce(`${nameOf(w)} wint de slag: ${ptsTxt(pts)}. Deze ronde: ${teamLabel(0)} ${d.taken[0]}, ${teamLabel(1)} ${d.taken[1]}.`);
        step();
      });
    }, wait(pts >= 8 ? 1150 : 950));
    return;
  }
  if (pd.type === 'end' || pd.type === 'over') {
    if (shownEnd !== g.dealNo) {
      shownEnd = g.dealNo;
      timer = setTimeout(showDealEnd, wait(450));
    }
    return;
  }
  if (pd.p !== 0) {
    const delay = pd.type === 'play' ? 700 : 1000;
    timer = setTimeout(() => {
      const a = decide(g, pd);
      if (a.type === 'play') {
        fly = { c: a.card, rect: aiSource(pd.p, a.card) };
        sfx('card');
      }
      E.act(g, a);
      saveGame();
      if (a.type === 'play') announce(`${shortOf(pd.p)} speelt ${cardLabel(a.card)}.`);
      step();
    }, wait(delay));
  }
}

// ---------- end of a round, end of the game ----------
function factorText(f, d) {
  switch (f.key) {
    case 'gelijk': return 'Vorige ronde was gelijk';
    case 'zonder': return 'Zonder troef telt dubbel';
    case 'blind': return 'Blind zonder troef telt vier keer';
    case 'mee': return `${shortOf(d.mee)} ging mee`;
    case 'terug': return `${shortOf(d.terug)} zei terug`;
    case 'alle': return 'Alle slagen voor één kant';
  }
  return '';
}

function endBar(d, r) {
  const [a, b] = d.taken;
  return `<div class="end-bar" role="img" aria-label="${teamLabel(0)} ${a} punten, ${teamLabel(1)} ${b} punten">
    <div class="eb-track"><i class="rb-us" style="--w:${(a / 60) * 100}%"></i><i class="rb-them" style="--w:${(b / 60) * 100}%"></i><em class="rb-mid"><span>30</span></em></div>
    <div class="eb-lab"><span class="us ${!r.tie && r.winTeam === 0 ? 'best' : ''}"><b>${a}</b> ${teamLabel(0)} · ${d.won[0]} ${d.won[0] === 1 ? 'slag' : 'slagen'}</span><span class="them ${!r.tie && r.winTeam === 1 ? 'best' : ''}">${d.won[1]} ${d.won[1] === 1 ? 'slag' : 'slagen'} · ${teamLabel(1)} <b>${b}</b></span></div>
  </div>`;
}

function whoGot(d) {
  if (g.mode !== 4) return '';
  const per = [0, 0, 0, 0];
  const cnt = [0, 0, 0, 0];
  for (const t of d.tricks) {
    per[t.winner] += t.pts;
    cnt[t.winner]++;
  }
  const best = Math.max(...per);
  return `<div class="who-got">${[0, 2, 1, 3].map((p) => `<div class="wg ${teamOf(p) === 0 ? 'us' : 'them'} ${per[p] === best && best > 0 ? 'top' : ''}"><span class="avatar sm">${personSVG(p)}</span><span class="wg-n">${shortOf(p)}</span><b>${per[p]}</b><small>${cnt[p]} ${cnt[p] === 1 ? 'slag' : 'slagen'}</small></div>`).join('')}</div>`;
}

function standBars(r) {
  const T = g.rules.target;
  return `<div class="stand">${[0, 1].map((t) => {
    const now = g.scores[t];
    const gained = !r.tie && r.winTeam === t ? r.gained : 0;
    const before = now - gained;
    return `<div class="st ${t === 0 ? 'us' : 'them'}"><span class="st-n">${teamLabel(t)}</span><div class="st-track"><i class="st-old" style="width:${Math.min(100, (before / T) * 100)}%"></i><i class="st-new" style="left:${Math.min(100, (before / T) * 100)}%;width:${Math.min(100, (gained / T) * 100)}%"></i></div><b data-from="${before}" data-to="${now}">${now}</b></div>`;
  }).join('')}<small class="st-goal">tot ${T}</small></div>`;
}

function confetti() {
  if (reduced()) return '';
  const suits = ['h', 'k', 'r', 's'];
  let out = '';
  for (let i = 0; i < 26; i++) {
    const s = suits[i % 4];
    const x = ((i * 37) % 100) + (i % 3) * 1.3;
    const delay = (i % 9) * 0.12;
    const d = 2.2 + (i % 5) * 0.35;
    const sz = 14 + (i % 4) * 6;
    out += `<span class="cf ${E.RED[s] ? 'red' : 'black'}" style="left:${x}%;--d:${d}s;--dl:${delay}s;--s:${sz}px;--r:${(i % 2 ? 1 : -1) * (90 + i * 13)}deg">${suitIcon(s)}</span>`;
  }
  return `<div class="confetti" aria-hidden="true">${out}</div>`;
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
    rows.push(`<div><span>${d.taken[win]} punten: ${r.base} boven de 30</span><b>${r.base}</b></div>`);
    for (const f of r.factors) rows.push(`<div><span>${factorText(f, d)}</span><b>×${f.x}</b></div>`);
    if (r.capped) rows.push('<div><span>Maar hoogstens vier keer</span><b>= ×4</b></div>');
    rows.push(`<div class="tot ${win === 0 ? 'us' : 'them'}"><span>Erbij voor ${g.mode === 4 ? (win === 0 ? 'ons' : 'hen') : win === 0 ? 'jou' : 'de tegenspeler'}</span><b>+${r.gained}</b></div>`);
  } else {
    rows.push(`<div><span>${g.rules.gelijkDubbel ? 'Niemand krijgt punten. De volgende ronde telt dubbel.' : 'Niemand krijgt punten.'}</span></div>`);
  }
  const body = `${endBar(d, r)}${whoGot(d)}<div class="calc">${rows.join('')}</div>${standBars(r)}`;
  const goodForUs = !r.tie && win === 0;
  if (g.over) {
    const won = g.winner === 0;
    sfx(won ? 'win' : 'lose');
    haptic(won ? [20, 60, 20, 60, 40] : 30);
    overlay(`${won ? confetti() : ''}<div class="sheet sheet-end ${won ? 'won' : 'lost'}" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <p class="eyebrow">Einde van het spel</p>
      <h3 id="dlg-t" class="${won ? 'win' : 'lose'}">${won ? 'Gewonnen!' : 'Verloren'}</h3>
      <p class="lead">${won ? (g.mode === 4 ? 'Jij en je partner halen' : 'Jij haalt') : g.mode === 4 ? 'De tegenpartij haalt' : 'De tegenspeler haalt'} als eerste ${g.rules.target}. ${head}.</p>
      ${body}
      <div class="row"><button class="btn btn-ghost" data-x="home">Menu</button><button class="btn btn-main" data-x="again">Nog een spel</button></div></div>`, (x) => {
      closeOverlay();
      const mode = g.mode;
      g = null;
      write(KEY.game, null);
      if (x === 'again') newGame(mode);
      else toMenu();
    }, 'end');
    animateEnd();
    return;
  }
  sfx(goodForUs ? 'round' : 'trick-them');
  overlay(`<div class="sheet sheet-end" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><p class="eyebrow">Ronde ${g.dealNo}</p><h3 id="dlg-t" class="${goodForUs ? 'win' : ''}">${head}</h3>
    ${body}
    <button class="btn btn-main" data-x="next">Volgende ronde</button></div>`, () => {
    closeOverlay();
    E.act(g, { type: 'end' });
    lastSaid = 0;
    trickKey = '';
    barShown = null;
    saveGame();
    announce(`Ronde ${g.dealNo}. ${nameOf(g.dealer)} deelt.`);
    step();
  }, 'end');
  animateEnd();
}
function animateEnd() {
  const o = $('overlays');
  if (reduced()) return;
  o.querySelectorAll('.eb-track i').forEach((i) => i.animate([{ width: '0%' }, { width: getComputedStyle(i).getPropertyValue('--w') }], { duration: dur(700), easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards', delay: dur(120) }));
  o.querySelectorAll('.st-new').forEach((i) => i.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: dur(700), delay: dur(600), easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' }));
  o.querySelectorAll('.stand b[data-from]').forEach((b) => {
    const from = +b.dataset.from;
    const to = +b.dataset.to;
    if (from !== to) setTimeout(() => countTo(b, from, to), dur(600));
  });
}

// ---------- first-time tour ----------
let tourOn = false;
function tourSteps() {
  const two = g.mode === 2;
  return [
    { sel: '#hand', title: 'Jouw kaarten', text: `Kaarten die oplichten, mag je spelen. Tik erop, of sleep ze naar het midden.${two ? ' Je open kaarten op tafel mag je ook spelen.' : ''}` },
    { sel: '#h-mid', title: 'Troef', text: 'Hier staat de troef. Een troef wint van elke andere kleur. Staat er ×2, dan telt de ronde dubbel. Tik erop voor uitleg.' },
    { sel: '#roundbar', title: 'Punten in deze ronde', text: 'Er zijn 60 punten te verdienen. Wie over de streep in het midden gaat, dus meer dan 30 haalt, wint de ronde.' },
    { sel: '#status-row', title: 'Wat moet je doen?', text: 'Hier lees je wie aan zet is en wat je moet doen. Twijfel je? Tik op Tip.' },
  ];
}
function startTour() {
  if (tourOn || !g || $('table').hidden || $('overlays').childElementCount) return;
  tourOn = true;
  stopTimers();
  let i = 0;
  const steps = tourSteps();
  const host = document.createElement('div');
  host.className = 'coach';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-labelledby', 'coach-t');
  document.body.appendChild(host);
  $('table').setAttribute('aria-hidden', 'true');
  const end = () => {
    write(KEY.tour, true);
    host.remove();
    tourOn = false;
    window.removeEventListener('resize', draw);
    document.removeEventListener('keydown', key, true);
    $('table').removeAttribute('aria-hidden');
    step();
  };
  function draw() {
    const s = steps[i];
    const t = document.querySelector(s.sel);
    const r = t ? t.getBoundingClientRect() : { left: 20, top: 20, width: 100, height: 40 };
    const pad = 8;
    const box = { l: Math.max(4, r.left - pad), t: Math.max(4, r.top - pad), w: Math.min(innerWidth - 8, r.width + pad * 2), h: r.height + pad * 2 };
    const below = box.t + box.h + 200 < innerHeight;
    host.innerHTML = `<div class="coach-spot" style="left:${box.l}px;top:${box.t}px;width:${box.w}px;height:${box.h}px"></div>
      <div class="coach-card ${below ? 'below' : 'above'}" style="${below ? `top:${box.t + box.h + 14}px` : `bottom:${innerHeight - box.t + 14}px`}">
        <p class="coach-n">${i + 1} van ${steps.length}</p>
        <h3 id="coach-t">${s.title}</h3><p>${s.text}</p>
        <div class="row"><button class="btn btn-ghost" data-c="skip">Overslaan</button><button class="btn btn-main" data-c="next">${i === steps.length - 1 ? 'Spelen!' : 'Volgende'}</button></div>
      </div>`;
    host.querySelector('[data-c="next"]').focus({ preventScroll: true });
  }
  const key = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      end();
    }
  };
  host.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    if (b.dataset.c === 'skip') end();
    else if (++i >= steps.length) end();
    else draw();
  });
  window.addEventListener('resize', draw);
  document.addEventListener('keydown', key, true);
  draw();
}

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  if (tourOn) return;
  const ov = $('overlays').firstChild;
  if (ov) {
    if (e.key === 'Escape' && overlayCb) {
      const b = $('overlays').querySelector('[data-x="go"], [data-x="ok"], [data-x="no"]');
      if (b) overlayCb(b.dataset.x);
    }
    if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = [...$('overlays').querySelectorAll('button')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    }
    return;
  }
  if ($('table').hidden || !g) return;
  const inCards = document.activeElement && document.activeElement.closest && document.activeElement.closest('#hand, #stacks-me');
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') && (inCards || document.activeElement === document.body)) {
    const list = playables();
    if (!list.length) return;
    e.preventDefault();
    let i = list.indexOf(document.activeElement);
    if (i < 0) i = rovingIdx;
    else if (e.key === 'ArrowLeft') i = Math.max(0, i - 1);
    else if (e.key === 'ArrowRight') i = Math.min(list.length - 1, i + 1);
    else if (e.key === 'Home') i = 0;
    else i = list.length - 1;
    rovingIdx = i;
    list.forEach((x, k) => (x.tabIndex = k === i ? 0 : -1));
    list[i].focus();
  } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !inCards && document.activeElement === document.body) {
    const list = playables();
    if (list.length) {
      e.preventDefault();
      list[Math.min(rovingIdx, list.length - 1)].focus();
    }
  } else if ((e.key === 't' || e.key === 'T') && !$('btn-tip').hidden && !e.ctrlKey && !e.metaKey) {
    giveTip();
  } else if (e.key === 'Escape') {
    openPause();
  }
});

// ---------- lifecycle ----------
let rz = 0;
window.addEventListener('resize', () => {
  if ($('table').hidden) return;
  cancelAnimationFrame(rz);
  rz = requestAnimationFrame(() => {
    fit();
    layoutHand();
    renderSide();
  });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && g) saveGame();
});
// ---------- als app installeren ----------
{
  const STANDALONE = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const btn = $('btn-install');
  let deferred = null;
  if (btn && !STANDALONE) btn.hidden = false;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', () => { if (btn) btn.hidden = true; deferred = null; });
  btn && btn.addEventListener('click', async () => {
    if (deferred) { deferred.prompt(); const r = await deferred.userChoice; deferred = null; if (r.outcome === 'accepted') btn.hidden = true; return; }
    const steps = IOS
      ? '<li>Tik in je browser op de deelknop (vierkant met pijl omhoog).</li><li>Kies <b>Zet op beginscherm</b>.</li><li>Open Manillen voortaan via het nieuwe icoon.</li>'
      : '<li>Tik in je browser rechtsboven op de drie puntjes <b>⋮</b>.</li><li>Kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.</li><li>Open Manillen voortaan via het nieuwe icoon.</li>';
    overlay(`<div class="sheet install-sheet"><h3>Speel als app</h3><p>Dan opent Manillen schermvullend, in één tik, ook zonder internet.</p><ol class="install-steps">${steps}</ol><button class="btn btn-main" data-x="ok">Begrepen</button></div>`, () => closeOverlay());
  });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

$('logo').innerHTML = ['kH', 'h10', 'sA'].map((c) => cardHTML(c)).join('');
applyView();

// Test hook for automated checks (harmless in normal play).
window.__mn = { get g() { return g; }, E, archive, step, newGame, tip: () => decidePlayWhy(g, 0) };

toMenu();
