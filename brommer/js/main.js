// Brommer Bende – app controller: boot, navigation, game loop and race glue.

import { Race } from './engine/race.js';
import { STEP, KMH } from './config.js';
import { levelConfig, podiumReward, COIN_VALUE, isBossLevel } from './data/levels.js';
import { THEME_ORDER } from './data/themes.js';
import { Renderer } from './render/renderer.js';
import { Controls } from './ui/controls.js';
import { Hud } from './ui/hud.js';
import { Sound } from './audio.js';
import { loadProfile, saveProfile, rideOf, applyResult } from './game/profile.js';
import { $, $$, esc } from './ui/dom.js';
import { initScreens } from './ui/screens.js';
import { Overlays } from './ui/overlays.js';

const app = {
  state: 'boot', // boot | menu | race
  profile: null,
  sound: new Sound(),
  renderer: null,
  controls: null,
  hud: null,
  overlays: null,
  race: null,
  demo: null,
  demoN: 0,
  demoRun: true,
  level: 1,
  attempt: 0,
  stack: [],
  paused: false,
  acc: 0,
  last: 0,
  doneT: 0,
  resultShown: false,
  wakeLock: null,
  perf: { samples: [], dpr: 2, lite: false },
};
window.__app = app;

// ---------------------------------------------------------------- utilities
app.save = () => saveProfile(app.profile);

app.haptic = (ms) => {
  if (!app.profile || !app.profile.settings.vibration || !navigator.vibrate) return;
  try {
    navigator.vibrate(ms);
  } catch (e) {
    /* ignore */
  }
};

let toastT = null;
app.toast = (msg, secs = 2.2) => {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), secs * 1000);
};

// ---------------------------------------------------------------- navigation
app.go = (id, push = true) => {
  const cur = $$('.screen').find((s) => !s.hidden);
  if (cur && cur.id === id) return;
  if (cur && push) app.stack.push(cur.id);
  for (const s of $$('.screen')) s.hidden = s.id !== id;
  app.screens.enter(id);
  demoFor(id);
  app.sound.click();
};

app.back = () => {
  const prev = app.stack.pop() || 's-home';
  app.go(prev, false);
};

function showMenu(id = 's-home') {
  app.state = 'menu';
  app.race = null;
  $('#app').classList.add('is-menu');
  $('#app').classList.remove('is-race');
  $('#hud').hidden = true;
  $('#controls').hidden = true;
  $('#screens').hidden = false;
  app.controls.setEnabled(false);
  app.sound.stopEngine();
  app.stack = id === 's-home' ? [] : ['s-home'];
  for (const s of $$('.screen')) s.hidden = s.id !== id;
  app.screens.enter(id);
  releaseWakeLock();
  startDemo();
  demoFor(id);
}

// ---------------------------------------------------------------- sizing
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, app.perf.dpr);
  app.renderer.resize(w, h, dpr);
}

// ---------------------------------------------------------------- demo race behind the menus
function startDemo() {
  const p = app.profile;
  // Show off the worlds you have reached.
  const worlds = Math.min(THEME_ORDER.length, Math.ceil(Math.min(p.unlocked, 15) / 3));
  const n = 1 + ((app.demoN++ % worlds) * 3);
  const ride = rideOf(p);
  const demo = new Race(levelConfig(n), { ...ride, bot: { skill: 0.85, aggr: 0.6, dodge: 0.3 } }, 100 + app.demoN);
  // Skip the start: open road and a spread-out field look better behind the menus.
  demo.countdown = 0.5;
  for (let i = 0; i < 60 * 7; i++) demo.step(STEP, null);
  demo.events.length = 0;
  app.demo = demo;
  app.renderer.setRace(demo, true);
  app.renderer.draw(0);
}

// The demo only rides behind the title and home screens; other screens get a calm, darker backdrop.
function demoFor(id) {
  app.demoRun = id === 's-title' || id === 's-home';
  $('#menu-bg').classList.toggle('deep', !app.demoRun);
}

// ---------------------------------------------------------------- race lifecycle
app.startRace = (n) => {
  const p = app.profile;
  app.level = n;
  app.attempt++;
  const race = new Race(levelConfig(n), rideOf(p), app.attempt);
  app.race = race;
  app.demo = null;
  app.renderer.setRace(race);
  app.hud.setRace(race);
  app.state = 'race';
  app.paused = false;
  app.acc = 0;
  app.doneT = 0;
  app.resultShown = false;
  $('#app').classList.remove('is-menu');
  $('#app').classList.add('is-race');
  $('#screens').hidden = true;
  $('#hud').hidden = false;
  $('#controls').hidden = false;
  $('#level-tag').textContent = `Level ${n}`;
  app.overlays.closeAll();
  app.controls.setEnabled(true);
  if (p.settings.steer === 'tilt' && !app.controls.tilt) app.controls.enableTilt(true);
  resize();
  enterImmersive();
  if (!history.state || !history.state.race) history.pushState({ race: 1 }, '');
  // First the level name, then 3-2-1-GO.
  const cfg = race.cfg;
  const intro = cfg.boss
    ? `<small>Level ${n} · baas</small>${esc(cfg.boss.name)}`
    : `<small>Level ${n}</small>${esc(cfg.title)}`;
  race.countdown += 1.4;
  const showIntro = () => app.hud.banner(intro, 1.5, isBossLevel(n) ? 'boss' : 'intro');
  if (!p.tutorialSeen) {
    app.paused = true;
    app.overlays.tutorial(() => {
      p.tutorialSeen = true;
      app.save();
      showIntro();
    });
  } else showIntro();
};

app.endRace = (screen = 's-home') => {
  app.race = null;
  showMenu(screen);
};

app.quitRace = () => app.endRace('s-home');

app.pause = (why) => {
  if (app.state !== 'race' || app.paused || !app.race || app.race.phase === 'done') return;
  if (app.overlays.blocking()) return;
  app.paused = true;
  app.controls.releaseAll();
  app.sound.stopEngine();
  app.overlays.pause(why);
};

app.resume = () => {
  app.paused = false;
  app.last = performance.now();
  app.acc = 0;
  app.controls.calibrate();
};

app.horn = () => {
  if (app.state === 'race' && app.race && !app.paused && !app.overlays.blocking()) app.race.horn(app.race.player);
};

function enterImmersive() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen && matchMedia('(pointer: coarse)').matches) {
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
  requestWakeLock();
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !app.wakeLock) {
      app.wakeLock = await navigator.wakeLock.request('screen');
      app.wakeLock.addEventListener('release', () => (app.wakeLock = null));
    }
  } catch (e) {
    app.wakeLock = null;
  }
}

function releaseWakeLock() {
  if (app.wakeLock) {
    app.wakeLock.release().catch(() => {});
    app.wakeLock = null;
  }
}

// ---------------------------------------------------------------- race events → sound, HUD, effects
function near(race, r, d = 3500) {
  return Math.abs(r.z - race.player.z) < d;
}

function handleEvents(race) {
  const s = app.sound, hud = app.hud, R = app.renderer;
  for (const e of race.events) {
    switch (e.type) {
      case 'count':
        s.count(e.n);
        hud.countdown(String(e.n));
        if (e.n === 3) app.controls.calibrate();
        break;
      case 'go':
        s.go();
        hud.countdown('GO!');
        app.haptic(30);
        break;
      case 'steal':
        if (e.att.isPlayer) {
          s.steal(e.combo);
          R.sparks(e.vic, e.att, '#7df9ff');
          R.float(`+${e.gain} km/u`, '#7df9ff', true);
          R.kick = 1;
          R.flash('#7df9ff', 0.28);
          app.haptic([15, 30, 20]);
          hud.banner(e.combo > 1 ? `COMBO ×${e.combo}!` : `Gepakt! <small>${esc(e.vic.name)}</small>`, 1.4, 'good');
        } else if (e.vic.isPlayer) {
          s.robbed();
          R.sparks(e.vic, e.att, '#ff5c7a');
          R.float(`−${e.gain} km/u`, '#ff5c7a');
          R.flash('#ff2d55', 0.38);
          R.shake = 0.8;
          app.haptic(70);
          hud.banner(`${esc(e.att.name)} pakt jouw snelheid!`, 1.8, 'warn');
        } else if (near(race, e.vic, 2500)) s.bump();
        break;
      case 'bump':
        s.bump();
        app.haptic(10);
        break;
      case 'cone':
        if (e.r.isPlayer) {
          s.cone();
          R.shake = Math.max(R.shake, 0.35);
          app.haptic(20);
        } else if (near(race, e.r, 2500)) s.cone(0.4);
        break;
      case 'puddle':
        if (e.r.isPlayer) {
          s.splash();
          hud.banner('Plons!', 1, 'warn');
        }
        break;
      case 'barrier':
        if (e.r.isPlayer) {
          s.crash();
          R.shake = 1;
          R.flash('#ff2d55', 0.25);
          app.haptic(80);
          hud.banner('Au! Wegwerkzaamheden', 1.4, 'warn');
        }
        break;
      case 'crash':
        if (e.r.isPlayer) {
          s.crash();
          R.shake = 1;
          R.flash('#ff2d55', 0.25);
          app.haptic(80);
          hud.banner('Boem! Pas op voor de tractor', 1.5, 'warn');
        }
        break;
      case 'coin': {
        s.coin();
        const el = $('#h-coins').getBoundingClientRect();
        R.coinFly(e.c, (el.left - 12) * R.dpr, (el.top + el.height / 2) * R.dpr);
        break;
      }
      case 'horn':
        if (e.r.isPlayer) {
          s.horn();
          if (e.target) {
            R.float('Toet!', '#ffe14d', false, 0.45);
            hud.banner(`${esc(e.target.name)} schrikt!`, 1.1, 'good');
          }
        }
        break;
      case 'finish':
        if (e.r.isPlayer) {
          s.finish(e.place);
          app.haptic(e.place <= 3 ? [40, 60, 80] : 40);
          if (e.place <= 3) R.confetti();
          hud.banner(e.place === 1 ? 'FINISH! Jij wint!' : `FINISH! ${e.place}e plaats`, 3, e.place <= 3 ? 'good' : '');
        }
        break;
      default:
        break;
    }
  }
  race.events.length = 0;
}

function showResults(race) {
  app.resultShown = true;
  const p = app.profile;
  const place = race.playerPlace;
  const podium = podiumReward(race.cfg.n, place);
  const road = race.stats.coins * COIN_VALUE;
  const res = applyResult(p, race, podium, road);
  res.winnerTime = race.results()[0].time;
  app.save();
  app.controls.setEnabled(false);
  app.sound.stopEngine();
  app.overlays.results(race, res);
}

// Engine, the rider beside you, wind and grass rumble.
function engineSound(race, on) {
  const P = race.player;
  const kmh = P.speed / KMH;
  let nearR = null, bd = 2600;
  for (const r of race.racers) {
    if (r === P) continue;
    const d = Math.abs(r.z - P.z);
    if (d < bd) {
      bd = d;
      nearR = r;
    }
  }
  const nearInfo = nearR ? { kmh: nearR.speed / KMH, level: 1 - bd / 2600, closing: ((nearR.speed - P.speed) / KMH) * Math.sign(P.z - nearR.z) } : null;
  const wind = Math.min(1, Math.max(0, (kmh - 35) / 110)) * 0.7 + P.draft * 0.5;
  app.sound.engine(on, kmh, race.phase === 'countdown' ? 0.3 : 1, nearInfo, wind, P.offroad ? Math.min(1, kmh / 40) : 0);
}

// ---------------------------------------------------------------- main loop
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - app.last) / 1000;
  app.last = now;
  if (!(dt > 0)) return;
  if (dt > 0.1) dt = 0.1;

  if (app.state === 'menu') {
    const d = app.demo;
    if (!d || document.hidden || !app.demoRun) return;
    app.acc += dt;
    let steps = 0;
    while (app.acc >= STEP && steps < 4) {
      d.step(STEP, null);
      d.events.length = 0;
      app.acc -= STEP;
      steps++;
    }
    if (steps === 4) app.acc = 0;
    app.renderer.draw(dt);
    if (d.phase === 'done' || d.time > 80) startDemo();
    return;
  }
  if (app.state !== 'race' || !app.race) return;
  const race = app.race;
  const blocked = app.paused || app.overlays.blocking();
  if (!blocked) {
    const input = { steer: app.controls.steer() };
    app.acc += dt;
    let steps = 0;
    while (app.acc >= STEP && steps < 5) {
      race.step(STEP, input);
      app.acc -= STEP;
      steps++;
    }
    if (steps === 5) app.acc = 0;
    handleEvents(race);
  }
  app.renderer.draw(blocked ? 0 : dt);
  app.hud.update(race, blocked ? 0 : dt);
  if (!app.resultShown) engineSound(race, !blocked);
  if (race.phase === 'done' && !app.resultShown) {
    app.doneT += dt;
    if (app.doneT > 0.6) showResults(race);
  }
  trackPerf(dt);
}

// Adaptive quality: lower the resolution (then detail) when frames are slow.
function trackPerf(dt) {
  const pf = app.perf;
  pf.samples.push(dt);
  if (pf.samples.length < 90) return;
  pf.samples.sort((a, b) => a - b);
  const med = pf.samples[45];
  pf.samples.length = 0;
  if (med < 0.021) return;
  const cur = Math.min(window.devicePixelRatio || 1, pf.dpr);
  if (cur > 1) {
    pf.dpr = Math.max(1, cur - 0.25);
    resize();
  } else if (!pf.lite) {
    pf.lite = true;
    app.renderer.setLite(true);
  }
}

// ---------------------------------------------------------------- boot
function boot() {
  app.profile = loadProfile();
  const s = app.profile.settings;
  app.sound.enabled = s.sound;
  app.renderer = new Renderer($('#road'));
  app.hud = new Hud();
  app.controls = new Controls($('#controls'), { haptic: app.haptic, onPause: () => app.pause(), onHorn: () => app.horn() });
  app.overlays = new Overlays(app);
  app.screens = initScreens(app);
  resize();

  window.addEventListener('resize', () => requestAnimationFrame(resize));
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      app.pause('hidden');
      app.sound.suspend();
      app.save();
    } else {
      app.sound.resume();
      if (app.state === 'race') requestWakeLock();
    }
  });
  window.addEventListener('pagehide', () => app.save());
  window.addEventListener('popstate', () => {
    if (app.state === 'race') {
      history.pushState({ race: 1 }, '');
      app.pause();
    }
  });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  // Simple navigation buttons.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go],[data-back]');
    if (!t) return;
    if (t.hasAttribute('data-back')) app.back();
    else app.go(t.getAttribute('data-go'));
  });
  // Audio may only start after a tap (iOS).
  const unlock = () => app.sound.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  $('#btn-pause').addEventListener('click', () => app.pause());
  $('#btn-horn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    app.horn();
  });

  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('italic 800 20px "Barlow Condensed"'), document.fonts.load('800 16px "Barlow Condensed"')]).then(() => app.renderer.bank.refresh());
  }

  app.state = 'menu';
  for (const sc of $$('.screen')) sc.hidden = sc.id !== 's-title';
  app.screens.enter('s-title');
  startDemo();
  demoFor('s-title');
  app.last = performance.now();
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
