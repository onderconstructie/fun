// Bellenplop: screens, input, the game loop and saving progress.

import { Game, SHOOT_X, SHOOT_Y, R, BOMB, RAINBOW } from './engine.js';
import { makeLevel, makeEndless, LEVEL_COUNT, PAR, starsFor } from './levels.js';
import { Renderer, COLORS } from './render.js';
import { Sound } from './audio.js';
import { fmt, TAU } from './util.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const canvas = $('field');
const renderer = new Renderer(canvas);
const sound = new Sound();

// ---------- saved progress ----------
const KEY = 'bellenplop-v1';
const DEFAULTS = { unlocked: 1, stars: {}, best: {}, endlessBest: 0, settings: { sound: true, vibration: true, shapes: false }, tipSeen: false };
let profile = load();
function load() {
  let p = null;
  try {
    p = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (e) {
    p = null;
  }
  if (!p || typeof p !== 'object') p = {};
  return { ...DEFAULTS, ...p, settings: { ...DEFAULTS.settings, ...(p.settings || {}) }, stars: p.stars || {}, best: p.best || {} };
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch (e) {
    /* private mode: play without saving */
  }
}
const totalStars = () => Object.values(profile.stars).reduce((a, b) => a + b, 0);

// ---------- screens ----------
let game = null;
let levelNo = 0;
let paused = false;
let endTimer = -1;

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.id !== id));
  if (id === 's-home') refreshHome();
  if (id === 's-levels') buildLevels();
  if (id === 's-settings') syncSettings();
  const scr = $(id);
  if (scr) scr.scrollTop = 0;
}

function toMenu(id = 's-home') {
  game = null;
  paused = false;
  closeOverlay();
  $('hud').hidden = true;
  $('tip').hidden = true;
  app.classList.add('is-menu');
  $('screens').hidden = false;
  show(id);
}

document.querySelectorAll('[data-go]').forEach((b) =>
  b.addEventListener('click', () => {
    sound.unlock();
    show(b.dataset.go);
  }),
);

function refreshHome() {
  const done = Object.keys(profile.stars).length;
  $('home-levels').textContent = done ? `${done} van ${LEVEL_COUNT} gehaald · ${totalStars()} ★` : `${LEVEL_COUNT} levels om te ploppen`;
  $('home-endless').textContent = profile.endlessBest ? `Record: ${fmt(profile.endlessBest)} punten` : 'Hoe lang hou jij het vol?';
}

function buildLevels() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  $('lv-stars').textContent = `${totalStars()} / ${LEVEL_COUNT * 3} ★`;
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const b = document.createElement('button');
    const locked = n > profile.unlocked;
    const st = profile.stars[n] || 0;
    b.className = 'lv' + (locked ? ' locked' : '') + (n === profile.unlocked && !profile.stars[n] ? ' current' : '');
    b.innerHTML = `<b>${n}</b><span class="st">${[1, 2, 3].map((k) => `<span class="${k <= st ? 'on' : ''}">★</span>`).join('')}</span>`;
    b.setAttribute('aria-label', locked ? `Level ${n}, nog op slot` : `Level ${n}, ${st} sterren`);
    if (locked) b.disabled = true;
    else
      b.addEventListener('click', () => {
        sound.unlock();
        startLevel(n);
      });
    grid.appendChild(b);
  }
}

function syncSettings() {
  $('set-sound').checked = profile.settings.sound;
  $('set-vibration').checked = profile.settings.vibration;
  $('set-shapes').checked = profile.settings.shapes;
}
$('set-sound').addEventListener('change', (e) => {
  profile.settings.sound = e.target.checked;
  sound.setEnabled(e.target.checked);
  save();
});
$('set-vibration').addEventListener('change', (e) => {
  profile.settings.vibration = e.target.checked;
  save();
  buzz(20);
});
$('set-shapes').addEventListener('change', (e) => {
  profile.settings.shapes = e.target.checked;
  renderer.shapes = e.target.checked;
  save();
});
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Alle levels, sterren en records wissen?')) return;
  const settings = profile.settings;
  profile = { ...DEFAULTS, settings, stars: {}, best: {} };
  save();
  show('s-home');
});
$('btn-endless').addEventListener('click', () => {
  sound.unlock();
  startEndless();
});

function buzz(p) {
  if (!profile.settings.vibration || !navigator.vibrate) return;
  try {
    navigator.vibrate(p);
  } catch (e) {
    /* ignore */
  }
}

// ---------- starting a game ----------
function begin(g) {
  game = g;
  paused = false;
  endTimer = -1;
  closeOverlay();
  renderer.reset();
  shownScore = 0;
  $('h-score').textContent = '0';
  aim.active = false;
  app.classList.remove('is-menu');
  $('screens').hidden = true;
  $('hud').hidden = false;
  layout();
  updateHud();
}

function startLevel(n) {
  levelNo = n;
  begin(new Game({ mode: 'level', level: makeLevel(n), seed: (Date.now() ^ (n * 7919)) >>> 0 }));
  $('tip').hidden = !(n === 1 && !profile.tipSeen);
}

function startEndless() {
  levelNo = 0;
  const seed = Date.now() >>> 0;
  begin(new Game({ mode: 'endless', level: makeEndless(seed), seed }));
  $('tip').hidden = profile.tipSeen;
}

function restart() {
  if (!game) return;
  if (game.mode === 'endless') startEndless();
  else startLevel(levelNo);
}

// ---------- HUD ----------
let shownScore = 0;
function updateHud() {
  if (!game) return;
  if (game.mode === 'endless') {
    $('h-title').textContent = 'Eindeloos';
    $('h-sub').innerHTML = profile.endlessBest ? `record ${fmt(profile.endlessBest)}` : `schoten ${game.shots}`;
  } else {
    $('h-title').textContent = `Level ${levelNo}`;
    const [p3, p2] = PAR[levelNo - 1] || [0, 0];
    const goal = game.shots < p3 ? `<span class="ok">★★★</span> nog ${p3 - game.shots}` : game.shots < p2 ? `<span class="ok">★★</span> nog ${p2 - game.shots}` : '';
    $('h-sub').innerHTML = `schoten ${game.shots}${goal ? ' · ' + goal : ''}`;
  }
}

// ---------- input ----------
const aim = { active: false, angle: Math.PI / 2, x: SHOOT_X, y: 0, pointer: null, key: false };

function setAimFrom(cx, cy) {
  const [x, y] = renderer.toField(cx, cy);
  if (y > SHOOT_Y - 6) {
    aim.active = false;
    return false;
  }
  aim.angle = Math.atan2(SHOOT_Y - y, x - SHOOT_X);
  aim.x = x;
  aim.y = y;
  aim.active = true;
  return true;
}

function setAimAngle(a) {
  aim.angle = game.clampAngle(a);
  aim.x = SHOOT_X + Math.cos(aim.angle) * 200;
  aim.y = SHOOT_Y - Math.sin(aim.angle) * 200;
  aim.active = true;
}

function playing() {
  return game && !paused && (game.state === 'aim' || game.state === 'flying');
}

function shoot() {
  if (!game || game.state !== 'aim' || paused) return;
  if (game.fire(aim.angle)) {
    if (!profile.tipSeen) {
      profile.tipSeen = true;
      save();
    }
    $('tip').hidden = true;
  }
}

function swap() {
  if (game && game.swap()) sound.swap();
}

canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (!playing()) return;
  const [x, y] = renderer.toField(e.clientX, e.clientY);
  if (renderer.hitsAmmo(x, y)) {
    swap();
    aim.pointer = null;
    return;
  }
  aim.pointer = e.pointerId;
  aim.key = false;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignore */
  }
  setAimFrom(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  if (!playing()) return;
  if (aim.pointer === e.pointerId || e.pointerType === 'mouse') {
    if (e.pointerType === 'mouse' && aim.pointer === null) {
      const [x, y] = renderer.toField(e.clientX, e.clientY);
      if (renderer.hitsAmmo(x, y)) {
        aim.active = false;
        canvas.style.cursor = 'pointer';
        return;
      }
      canvas.style.cursor = 'crosshair';
    }
    aim.key = false;
    setAimFrom(e.clientX, e.clientY);
  }
});
function release(e, cancel) {
  if (aim.pointer !== e.pointerId) return;
  aim.pointer = null;
  if (!playing()) return;
  const ok = !cancel && setAimFrom(e.clientX, e.clientY);
  if (ok) shoot();
  if (e.pointerType !== 'mouse') aim.active = false;
}
canvas.addEventListener('pointerup', (e) => release(e, false));
canvas.addEventListener('pointercancel', (e) => release(e, true));
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && aim.pointer === null && !aim.key) aim.active = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const keys = new Set();
window.addEventListener('keydown', (e) => {
  sound.unlock();
  if (!game) return;
  if (e.key === 'Escape' || e.key === 'p') {
    if (game.state === 'aim' || game.state === 'flying') togglePause();
    return;
  }
  if (!playing()) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
    keys.add(e.key);
    if (!aim.active) setAimAngle(aim.angle);
    aim.key = true;
    e.preventDefault();
  } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'w') {
    if (!aim.active) setAimAngle(aim.angle);
    shoot();
    e.preventDefault();
  } else if (e.key === 'ArrowDown' || e.key === 'x' || e.key === 's' || e.key === 'Shift') {
    swap();
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key));

// ---------- pause and results ----------
function closeOverlay() {
  $('overlays').innerHTML = '';
}
function overlay(html) {
  $('overlays').innerHTML = `<div class="overlay"><div class="card">${html}</div></div>`;
  return $('overlays').querySelector('.card');
}
function bind(card, map) {
  for (const [id, fn] of Object.entries(map)) {
    const b = card.querySelector(`[data-a="${id}"]`);
    if (b)
      b.addEventListener('click', () => {
        sound.unlock();
        fn();
      });
  }
}

function togglePause() {
  if (!game) return;
  if (paused) {
    paused = false;
    closeOverlay();
    return;
  }
  paused = true;
  aim.pointer = null;
  const card = overlay(`<h3>Pauze</h3><p>${game.mode === 'endless' ? 'Eindeloos' : 'Level ' + levelNo} · ${fmt(game.score)} punten</p>
    <button class="btn btn-main btn-wide" data-a="go">Verder</button>
    <div class="row"><button class="btn btn-ghost" data-a="again">Opnieuw</button><button class="btn btn-ghost" data-a="stop">Stoppen</button></div>`);
  bind(card, { go: togglePause, again: restart, stop: () => toMenu(game.mode === 'endless' ? 's-home' : 's-levels') });
  card.querySelector('[data-a="go"]').focus();
}
$('btn-pause').addEventListener('click', () => {
  sound.unlock();
  if (game && (game.state === 'aim' || game.state === 'flying')) togglePause();
});

function showResult() {
  const g = game;
  if (g.mode === 'endless') {
    const record = g.score > profile.endlessBest;
    if (record) {
      profile.endlessBest = g.score;
      save();
    }
    const card = overlay(`<h3 class="lose">Te laag!</h3>
      <p>De bellen kwamen over de lijn.</p>
      <div class="stats"><div><b>${fmt(g.score)}</b><small>punten</small></div><div><b>${g.shots}</b><small>schoten</small></div></div>
      <p class="${record ? 'new' : ''}">${record ? 'Nieuw record!' : `Record: ${fmt(profile.endlessBest)}`}</p>
      <div class="row"><button class="btn btn-ghost" data-a="menu">Menu</button><button class="btn btn-main" data-a="again">Nog eens</button></div>`);
    bind(card, { menu: () => toMenu('s-home'), again: restart });
    card.querySelector('[data-a="again"]').focus();
    return;
  }
  if (g.state === 'won') {
    const st = starsFor(levelNo, g.shots);
    const prev = profile.stars[levelNo] || 0;
    const prevBest = profile.best[levelNo] || 0;
    profile.stars[levelNo] = Math.max(prev, st);
    profile.best[levelNo] = Math.max(prevBest, g.score);
    profile.unlocked = Math.max(profile.unlocked, Math.min(LEVEL_COUNT, levelNo + 1));
    save();
    const [p3, p2] = PAR[levelNo - 1];
    const hint = st === 3 ? 'Perfect geplopt!' : st === 2 ? `Drie sterren: ${p3} schoten of minder.` : `Twee sterren: ${p2} schoten of minder.`;
    const last = levelNo >= LEVEL_COUNT;
    const card = overlay(`<h3 class="win">${last ? 'Alles uitgespeeld!' : 'Gehaald!'}</h3>
      <div class="stars"><span>★</span><span>★</span><span>★</span></div>
      <div class="stats"><div><b>${g.shots}</b><small>schoten</small></div><div><b>${fmt(g.score)}</b><small>punten${g.score > prevBest && prevBest ? ' · record' : ''}</small></div></div>
      <p class="goal">${hint}</p>
      <div class="row"><button class="btn btn-ghost" data-a="again">Opnieuw</button><button class="btn btn-main" data-a="next">${last ? 'Levels' : 'Volgende'}</button></div>`);
    const spans = card.querySelectorAll('.stars span');
    for (let k = 0; k < st; k++)
      setTimeout(() => {
        spans[k].classList.add('on');
        sound.star(k);
        buzz(15);
      }, 350 + k * 320);
    bind(card, { again: restart, next: () => (last ? toMenu('s-levels') : startLevel(levelNo + 1)) });
    card.querySelector('[data-a="next"]').focus();
  } else {
    const card = overlay(`<h3 class="lose">Oei!</h3>
      <p>De bellen kwamen over de lijn. Tip: laat ze vallen in plaats van alles te ploppen.</p>
      <div class="row"><button class="btn btn-ghost" data-a="menu">Levels</button><button class="btn btn-main" data-a="again">Nog eens</button></div>`);
    bind(card, { menu: () => toMenu('s-levels'), again: restart });
    card.querySelector('[data-a="again"]').focus();
  }
}

// ---------- engine events → sound, effects, HUD ----------
function handleEvents() {
  const ev = game.events;
  if (!ev.length) return;
  game.events = [];
  for (const e of ev) {
    renderer.onEvent(e, game);
    switch (e.t) {
      case 'fire':
        sound.fire();
        break;
      case 'bounce':
        sound.bounce();
        break;
      case 'land':
        sound.land();
        if (game.state === 'aim' && game.pressureLeft() === 1) sound.warn();
        break;
      case 'pop':
        sound.pop(e.list.length, e.streak);
        buzz(12);
        break;
      case 'drop':
        sound.drop(e.list.length);
        buzz(e.list.length >= 5 ? 35 : 18);
        break;
      case 'ceiling':
      case 'push':
        sound.ceiling();
        buzz(50);
        break;
      case 'boom':
        sound.boom();
        buzz([30, 30, 60]);
        break;
      case 'special':
      case 'clear':
        sound.special();
        break;
      case 'won':
        sound.win();
        endTimer = 1.1;
        break;
      case 'lost':
        sound.lose();
        buzz([60, 40, 120]);
        endTimer = 1.4;
        break;
      case 'swap':
        break;
    }
  }
  updateHud();
}

// ---------- loop ----------
let last = performance.now();
let clock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  if (game && !paused) {
    if (keys.size && game.state === 'aim') {
      const dir = (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('d') ? 1 : 0);
      if (dir) setAimAngle(aim.angle + dir * 1.5 * dt);
    }
    game.update(dt);
    handleEvents();
    renderer.update(dt);
    if (endTimer > 0) {
      endTimer -= dt;
      if (endTimer <= 0 && !renderer.busy()) showResult();
      else if (endTimer <= 0) endTimer = 0.1;
    }
    // smooth score counter
    if (shownScore !== game.score) {
      shownScore += Math.ceil((game.score - shownScore) * Math.min(1, dt * 10));
      if (Math.abs(game.score - shownScore) < 2) shownScore = game.score;
      $('h-score').textContent = fmt(shownScore);
    }
  } else if (!game) {
    shownScore = 0;
    $('h-score').textContent = '0';
  }
  renderer.draw(game, aim, clock);
  requestAnimationFrame(frame);
}

// ---------- logo ----------
function drawLogo() {
  const cv = $('logo-cv');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = 240 * dpr;
  cv.height = 90 * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const pts = [[48, 58, 3], [84, 38, 0], [120, 54, 1], [156, 36, 2], [192, 56, 4]];
  pts.forEach(([x, y, c], i) => {
    const r = i === 2 ? 25 : 20;
    const rg = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    rg.addColorStop(0, '#ffffffaa');
    rg.addColorStop(0.25, COLORS[c]);
    rg.addColorStop(1, COLORS[c]);
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.arc(x, y, r, 0.2, Math.PI - 0.2);
    g.arc(x, y - r * 0.15, r * 0.95, Math.PI - 0.2, 0.2, true);
    g.fill();
    for (const s of [-1, 1]) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(x + s * r * 0.32, y - r * 0.12, r * 0.2, r * 0.24, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#141428';
      g.beginPath();
      g.arc(x + s * r * 0.32 + 1.5, y - r * 0.08, r * 0.11, 0, TAU);
      g.fill();
    }
  });
}

// ---------- lifecycle ----------
renderer.shapes = profile.settings.shapes;
sound.enabled = profile.settings.sound;
function safeBottom() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden';
  document.body.appendChild(probe);
  const v = probe.getBoundingClientRect().height;
  probe.remove();
  return v || 0;
}
function layout() {
  const hudH = $('hud').hidden ? 64 : $('hud').getBoundingClientRect().bottom + 4;
  renderer.topUI = Math.max(64, hudH);
  renderer.padB = 14 + safeBottom();
  renderer.resize();
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sound.suspend();
    if (game && !paused && (game.state === 'aim' || game.state === 'flying')) togglePause();
  }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Test hook for automated checks (harmless in normal play).
window.__bp = { get game() { return game; }, startLevel, startEndless, aim, renderer, R, BOMB, RAINBOW };

if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)
  $('tip-aim').innerHTML = '<b>Beweeg je muis</b> om te mikken, <b>klik</b> om te schieten. Pijltjes en spatie mag ook.';

drawLogo();
document.fonts?.ready.then(drawLogo);
toMenu('s-home');
layout();
requestAnimationFrame(frame);
