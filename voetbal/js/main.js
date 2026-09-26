// Gouden Elf – app controller: boot, navigation, game loop and match glue.

import { Match, STEP } from './engine/match.js';
import { ST } from './engine/player.js';
import { Recorder, clipScene } from './engine/replay.js';
import { CX, CY, L } from './engine/constants.js';
import { Renderer } from './render/renderer.js';
import { Controls } from './ui/controls.js';
import { Hud } from './ui/hud.js';
import { Sound } from './audio.js';
import { loadProfile, saveProfile } from './game/profile.js';
import { $, $$ } from './ui/dom.js';
import { initScreens } from './ui/screens.js';
import { Overlays } from './ui/overlays.js';

const app = {
  state: 'boot', // boot | menu | match
  profile: null,
  sound: new Sound(),
  renderer: null,
  controls: null,
  hud: null,
  overlays: null,
  match: null,
  cfg: null,
  stack: [],
  paused: false,
  replay: null,
  acc: 0,
  last: 0,
  replayTimer: 0,
  input: { mx: 0, my: 0, sprint: false, press: false, actions: [] },
  goalPending: null,
  wakeLock: null,
  perf: { samples: [], dpr: 2 },
  tutorialStep: 0,
  firstTouchHints: {},
};
window.__app = app;

// ---------------------------------------------------------------- utilities
app.save = () => saveProfile(app.profile);

app.haptic = (ms) => {
  if (!app.profile || !app.profile.settings.vibration) return;
  if (navigator.vibrate) {
    try {
      navigator.vibrate(ms);
    } catch (e) {
      /* ignore */
    }
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
  app.sound.click();
};

app.back = () => {
  const prev = app.stack.pop() || 's-home';
  app.go(prev, false);
};

function showMenu(id = 's-home') {
  app.state = 'menu';
  $('#app').classList.add('is-menu');
  $('#app').classList.remove('is-match', 'replay');
  $('#hud').hidden = true;
  $('#controls').hidden = true;
  $('#screens').hidden = false;
  app.controls.setEnabled(false);
  app.sound.crowd(false);
  app.stack = [];
  for (const s of $$('.screen')) s.hidden = s.id !== id;
  app.screens.enter(id);
  releaseWakeLock();
}
app.showMenu = showMenu;

// ---------------------------------------------------------------- sizing
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, app.perf.dpr);
  app.renderer.resize(w, h, dpr);
  app.controls.measure();
  app.hud.sizeRadar();
}

// ---------------------------------------------------------------- match lifecycle
app.startMatch = (cfg) => {
  app.cfg = cfg;
  const s = app.profile.settings;
  const halfSeconds = cfg.halfSeconds || Math.round((s.duration * 60) / 2);
  const m = new Match({
    home: cfg.home,
    away: cfg.away,
    humanSide: 0,
    difficulty: cfg.difficulty || s.difficulty,
    mode: cfg.mode === 'match' || cfg.mode === 'cup' ? 'match' : cfg.mode,
    settings: { halfSeconds, autoSwitch: s.autoSwitch, assist: s.assist, offside: s.offside },
  });
  m.recorder = new Recorder(m.players.length, 9);
  app.match = m;
  if (cfg.setup) cfg.setup(m);
  app.renderer.setMatch(m);
  app.renderer.director.zoomPref = s.zoom;
  app.hud.setTeams(m);
  app.hud.radarOn = s.radar && cfg.mode !== 'penalties';
  $('#radar').hidden = !app.hud.radarOn;
  app.state = 'match';
  app.paused = false;
  app.replay = null;
  app.goalPending = null;
  app.acc = 0;
  $('#app').classList.remove('is-menu', 'replay');
  $('#app').classList.add('is-match');
  $('#screens').hidden = true;
  $('#hud').hidden = false;
  $('#controls').hidden = false;
  app.overlays.closeAll();
  app.controls.setEnabled(true);
  app.controls.setLefty(s.lefty);
  app.controls.setScale(s.buttonSize);
  resize();
  enterImmersive();
  history.pushState({ match: 1 }, '');
  app.sound.crowd(true, 0.2);
  if (!app.profile.tutorialSeen) {
    app.overlays.tutorial(() => {
      app.profile.tutorialSeen = true;
      app.save();
    });
  }
};

app.endMatch = () => {
  app.match = null;
  app.replay = null;
  app.goalPending = null;
  showMenu(app.cfg && app.cfg.returnTo ? app.cfg.returnTo : 's-home');
};

app.pause = (why) => {
  if (app.state !== 'match' || app.paused || !app.match) return;
  if (app.match.phase === 'fulltime') return;
  app.paused = true;
  app.controls.releaseAll();
  app.sound.crowd(true, 0);
  app.overlays.pause(why);
};

app.resume = () => {
  app.paused = false;
  app.last = performance.now();
  app.acc = 0;
};

function enterImmersive() {
  const s = app.profile.settings;
  const el = document.documentElement;
  if (s.fullscreen && !document.fullscreenElement && el.requestFullscreen && matchMedia('(pointer: coarse)').matches) {
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
      .catch(() => {});
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

// ---------------------------------------------------------------- input mapping
const tmpP = {};
function screenToWorld(m, sx, sy, out) {
  const cam = app.renderer.cam;
  const p = m.controlled || m.ball;
  const mag = Math.min(1, Math.hypot(sx, sy));
  if (mag < 0.01) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  if (!cam.project(p.x, p.y, 0, tmpP)) {
    out[0] = sx;
    out[1] = sy;
    return out;
  }
  const g = cam.groundAt(tmpP.x + (sx / mag) * 60, tmpP.y + (sy / mag) * 60);
  if (!g) {
    out[0] = sx;
    out[1] = sy;
    return out;
  }
  let wx = g.x - p.x, wy = g.y - p.y;
  const l = Math.hypot(wx, wy) || 1;
  out[0] = (wx / l) * mag;
  out[1] = (wy / l) * mag;
  return out;
}

function context(m) {
  // Which button layout fits the moment.
  if (m.pens) {
    const r = m.restart;
    return m.phase === 'setpiece' && r && r.team === m.human ? 'penalty' : 'none';
  }
  if (m.phase === 'setpiece' || m.phase === 'kickoff') {
    const r = m.restart;
    if (r && r.team === m.human) return r.type === 'freekick' || r.type === 'penalty' ? 'setShoot' : 'setPass';
    if (r && r.type === 'penalty') return 'none';
    return 'defend';
  }
  const b = m.ball;
  const p = m.controlled;
  if (b.owner && b.owner.team.index === m.human) return b.owner.isGK && b.owner.state === ST.HOLD ? 'setPass' : 'attack';
  if (b.owner && b.owner.team.index !== m.human) return 'defend';
  if (m.possTeam === m.human) return 'attack';
  if (m.possTeam >= 0) return 'defend';
  // Loose: attack if our player is closer.
  if (p && p.icT < 0.6) return 'attack';
  return app.controls.layout === 'setPass' || app.controls.layout === 'setShoot' ? 'attack' : app.controls.layout;
}

const vec = [0, 0];
function buildInput(m) {
  const c = app.controls.update();
  const inp = app.input;
  screenToWorld(m, c.x, c.y, vec);
  inp.mx = vec[0];
  inp.my = vec[1];
  inp.sprint = c.sprint;
  inp.press = c.press;
  for (const a of app.controls.takeActions()) {
    if (a.type === 'skill') {
      screenToWorld(m, a.sdx, a.sdy, vec);
      a.dx = vec[0];
      a.dy = vec[1];
    }
    inp.actions.push(a);
  }
  return c;
}

// ---------------------------------------------------------------- events
function handleEvents(m) {
  const s = app.sound, hud = app.hud;
  for (const e of m.events) {
    switch (e.type) {
      case 'kick': {
        s.kick(Math.min(1, e.power / 30));
        if (e.player && e.player.human) app.haptic(8);
        break;
      }
      case 'whistle':
        s.whistle(e.kind);
        break;
      case 'banner':
        hud.banner(e.text, 1.5, e.restart === 'penalty');
        break;
      case 'post':
        s.post();
        hud.banner('Paal!', 1.2);
        app.renderer.cam.shake = 0.4;
        break;
      case 'net':
        s.net();
        break;
      case 'save':
        s.thud(0.6);
        s.ooh(0.7);
        if (e.player && e.player.team.index === m.human) app.haptic(20);
        break;
      case 'nearmiss':
        s.ooh(0.9);
        break;
      case 'goal':
        onGoal(m, e);
        break;
      case 'foul':
        hud.banner('Overtreding', 1.2);
        break;
      case 'card':
        hud.banner(`Gele kaart · ${e.player.name}`, 1.8, true);
        break;
      case 'tackle':
        if (e.won) {
          s.thud(0.5);
          if (e.player.team.index === m.human) app.haptic(12);
        }
        break;
      case 'halftime':
        app.sound.crowd(true, 0.1);
        app.overlays.halftime(m);
        break;
      case 'fulltime':
        app.sound.crowd(true, 0.15);
        setTimeout(() => app.overlays.results(m, app.cfg), 900);
        break;
      case 'setpiece':
        setpieceHint(m, e);
        break;
      case 'kickoff':
        if (e.team === m.human) hud.hint('Druk op <b>PASS</b> voor de aftrap', 2.5);
        app.renderer.director.snap(CX, CY);
        break;
      case 'cut':
        app.renderer.director.snap(m.ball.x, m.ball.y);
        break;
      case 'roundEnd':
        if (app.cfg && app.cfg.onRoundEnd) app.cfg.onRoundEnd(m, e);
        break;
      default:
        break;
    }
  }
  m.events.length = 0;
}

function setpieceHint(m, e) {
  if (e.team !== m.human) {
    if (e.restart === 'penalty') app.hud.hint('Kies een hoek met de joystick om te duiken', 3);
    return;
  }
  const t = {
    throw: 'Richt met de joystick · <b>PASS</b> om in te gooien',
    corner: 'Richt · <b>PASS</b> = voorzet, <b>LANG</b> = kort nemen',
    goalkick: '<b>PASS</b> = kort · <b>LANG</b> = lange trap',
    freekick: 'Houd <b>SCHIET</b> vast voor kracht · of <b>PASS</b>',
    penalty: 'Richt met de joystick · houd <b>SCHIET</b> vast',
  }[e.restart];
  if (t) app.hud.hint(t, 3.2);
}

function onGoal(m, e) {
  const s = app.sound;
  s.net();
  const ours = e.team === m.human;
  s.roar(ours ? 1 : 0.55);
  app.renderer.cam.shake = ours ? 0.9 : 0.4;
  app.haptic(ours ? [40, 60, 80] : 20);
  const scorer = e.scorer ? e.scorer.name : '';
  const line = e.own ? `Eigen doelpunt · ${e.minute}` : `${scorer} · ${e.minute}${e.assist ? ` · assist ${e.assist.name}` : ''}`;
  app.hud.goal(e.own ? 'EIGEN GOAL' : ours ? 'DOELPUNT!' : 'TEGENGOAL', line);
  if (app.profile.settings.replays && m.recorder && !m.attack) {
    app.goalPending = { t: 1.3 };
    m.holdGoal = true;
  }
}

function startReplay(m) {
  const clip = m.recorder.tail(Math.round(6.2 * 60));
  if (clip.frames < 30) {
    m.holdGoal = false;
    return;
  }
  app.replay = { clip, t: 0, speed: 0.62, scene: null };
  $('#app').classList.add('replay');
  app.controls.releaseAll();
}

function endReplay() {
  if (!app.replay) return;
  app.replay = null;
  $('#app').classList.remove('replay');
  if (app.match) {
    app.match.holdGoal = false;
    app.renderer.director.snap(CX, CY);
  }
}
app.skipReplay = endReplay;

// ---------------------------------------------------------------- main loop
function excitement(m) {
  const b = m.ball;
  const d = Math.min(Math.abs(b.x), Math.abs(L - b.x));
  let e = Math.max(0, 1 - d / 35) * 0.7;
  if (m.phase === 'goal') e = 1;
  return e;
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - app.last) / 1000;
  app.last = now;
  if (!(dt > 0)) return;
  if (dt > 0.1) dt = 0.1;
  if (app.state !== 'match' || !app.match) return;
  const m = app.match;
  const portraitPhone = window.innerHeight > window.innerWidth && matchMedia('(pointer: coarse)').matches;

  if (app.replay) {
    renderReplay(dt);
    return;
  }

  let intent = null;
  if (!app.paused && !portraitPhone && !app.overlays.blocking()) {
    intent = buildInput(m);
    app.acc += dt;
    let steps = 0;
    while (app.acc >= STEP && steps < 4) {
      m.step(STEP, app.input);
      app.input.actions.length = 0;
      app.acc -= STEP;
      steps++;
    }
    if (steps === 4) app.acc = 0;
    handleEvents(m);
    if (app.goalPending) {
      app.goalPending.t -= dt;
      if (app.goalPending.t <= 0) {
        app.goalPending = null;
        startReplay(m);
      }
    }
  }
  renderLive(m, dt, intent);
  trackPerf(dt);
}

function renderLive(m, dt, intent) {
  const r = app.renderer;
  const a = app.paused ? 1 : Math.min(1, app.acc / STEP);
  const sc = r.sceneFromMatch(m, a);
  const b = m.ball;
  const dir = m.possTeam >= 0 ? m.teams[m.possTeam].dir : 0;
  const snappy = m.phase === 'setpiece' || m.phase === 'kickoff';
  if (m.pens && m.pens.taker) r.director.behind(m.pens.spotX, m.teams[m.pens.turn].dir);
  else r.director.update(dt, { x: sc.ball.x, y: sc.ball.y, vx: b.vx, vy: b.vy, dir }, { snappy, zoom: m.phase === 'goal' ? 1.15 : 1 });
  // Aim + pass preview.
  const p = m.controlled;
  r.aim = null;
  r.highlight = null;
  r.reticle = null;
  const shotSetpiece = m.restart && (m.restart.type === 'penalty' || m.restart.type === 'freekick');
  if (p && m.restart && (m.phase === 'setpiece' || m.phase === 'kickoff') && m.restart.taker === p && shotSetpiece && (m.pens || m.restart.type === 'penalty' || intent)) {
    // Target on the goal mirrors humanShot(): joystick picks the side, power the height.
    const my = Math.abs(app.input.my) > 0.2 ? Math.max(-1, Math.min(1, app.input.my)) : m.restart.aimY || 0;
    const charge = app.controls.charging ? app.controls.charge : 0.55;
    const gx = p.team.oppGoalX;
    const gy = my ? CY + my * 3.11 : CY;
    r.reticle = { x: gx, y: gy, z: 0.25 + Math.pow(charge, 1.5) * 1.75, hot: charge > 0.86 };
    if (m.restart.type === 'freekick') r.aim = { x: b.x, y: b.y, dx: p.fx, dy: p.fy, len: 9 };
  } else if (p && m.restart && (m.phase === 'setpiece' || m.phase === 'kickoff') && m.restart.taker === p) {
    r.aim = { x: b.x, y: b.y, dx: p.fx, dy: p.fy, len: 9 };
  } else if (p && b.owner === p && m.phase === 'play') {
    const mag = Math.hypot(app.input.mx, app.input.my);
    const dx = mag > 0.25 ? app.input.mx / mag : p.fx, dy = mag > 0.25 ? app.input.my / mag : p.fy;
    const q = m.pickReceiver(p, dx, dy, false);
    if (q) r.highlight = { x: q.x, y: q.y };
  }
  const idx = p ? m.players.indexOf(p) : null;
  const owner = b.owner;
  r.draw(sc, {
    controlled: m.pens ? null : idx,
    controlledName: p ? p.name : '',
    carrier: owner && owner !== p ? m.players.indexOf(owner) : null,
    carrierName: owner ? owner.name : '',
    excitement: excitement(m),
    ringPulse: 0,
  });
  app.hud.update(m, dt, p);
  app.sound.crowd(!app.paused, excitement(m));
  if (intent !== null || app.paused) app.controls.setLayout(context(m));
}

function renderReplay(dt) {
  const rp = app.replay;
  const r = app.renderer;
  const m = app.match;
  if (!rp.scene) {
    rp.scene = r.scene;
  }
  rp.t += dt * 60 * rp.speed;
  if (rp.t >= rp.clip.frames - 1) {
    endReplay();
    return;
  }
  clipScene(rp.clip, rp.t, rp.scene);
  const sc = rp.scene;
  r.director.update(dt, { x: sc.ball.x, y: sc.ball.y, vx: 0, vy: 0, dir: 0 }, { zoom: 1.45, snappy: rp.t < 2 });
  r.draw(sc, { replay: true, excitement: 0.6 });
  app.hud.update(m, dt, null);
}

// Adaptive resolution: drop DPR when frames are slow.
function trackPerf(dt) {
  const pf = app.perf;
  pf.samples.push(dt);
  if (pf.samples.length < 120) return;
  pf.samples.sort((a, b) => a - b);
  const med = pf.samples[60];
  pf.samples.length = 0;
  if (med > 0.024 && pf.dpr > 1) {
    pf.dpr = Math.max(1, pf.dpr - 0.5);
    resize();
  }
}

// ---------------------------------------------------------------- boot
function boot() {
  app.profile = loadProfile();
  const s = app.profile.settings;
  app.sound.enabled = s.sound;
  app.renderer = new Renderer($('#pitch'));
  app.hud = new Hud();
  app.controls = new Controls($('#controls'), { haptic: app.haptic, onPause: () => app.pause() });
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
      if (app.state === 'match') requestWakeLock();
    }
  });
  window.addEventListener('pagehide', () => app.save());
  window.addEventListener('popstate', () => {
    if (app.state === 'match') {
      history.pushState({ match: 1 }, '');
      if (app.replay) endReplay();
      else app.pause();
    }
  });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  // Global delegation for simple navigation buttons.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go],[data-back]');
    if (!t) return;
    if (t.hasAttribute('data-back')) app.back();
    else app.go(t.getAttribute('data-go'));
  });
  // Unlock audio on first interaction (required on iOS).
  const unlock = () => app.sound.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  $('#btn-pause').addEventListener('click', () => app.pause());
  $('#pitch').addEventListener('pointerdown', () => {
    if (app.replay) endReplay();
  });
  $('#hud').addEventListener('pointerdown', (e) => {
    if (app.replay && e.target.closest('#replay-tag')) endReplay();
  });
  $('#controls').addEventListener('pointerdown', () => {
    if (app.replay) endReplay();
  });

  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('800 16px "Barlow Condensed"'), document.fonts.load('700 12px "Barlow Condensed"')]).then(() => {
      if (app.renderer.stadium) app.renderer.stadium.refreshTextures();
    });
  }

  app.state = 'menu';
  for (const sc of $$('.screen')) sc.hidden = sc.id !== 's-title';
  app.screens.enter('s-title');
  app.last = performance.now();
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
