// Touch controls: floating joystick (left), context buttons (right), swipe
// gestures (skill moves, chip/lob), plus keyboard and gamepad support.
// Produces screen-space intents; main.js maps them to pitch directions.

const LAYOUTS = {
  attack: { shoot: 'SCHIET', pass: 'PASS', through: 'DOOR', sprint: 'SPRINT' },
  defend: { shoot: 'TACKLE', pass: 'WISSEL', through: 'DRUK', sprint: 'SPRINT' },
  setShoot: { shoot: 'SCHIET', pass: 'PASS', through: 'LANG', sprint: '' },
  setPass: { shoot: '', pass: 'PASS', through: 'LANG', sprint: '' },
  penalty: { shoot: 'SCHIET', pass: '', through: '', sprint: '' },
  keeper: { shoot: '', pass: 'WISSEL', through: 'DRUK', sprint: 'SPRINT' },
  none: { shoot: '', pass: '', through: '', sprint: '' },
};

const CHARGE_TIME = 0.95;

export class Controls {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.joy = root.querySelector('#joy');
    this.knob = root.querySelector('#joy-knob');
    this.powerFg = root.querySelector('#power-fg');
    this.btn = {};
    for (const id of ['shoot', 'pass', 'through', 'sprint']) {
      this.btn[id] = { el: root.querySelector('#b-' + id), label: root.querySelector('#l-' + id), x: 0, y: 0, r: 0, ptr: null, t0: 0, sx: 0, sy: 0, maxUp: 0, travel: 0 };
    }
    this.layout = 'attack';
    this.enabled = false;
    this.lefty = false;
    this.ptrs = new Map();
    this.jx = 0; // joystick vector (screen space, -1..1)
    this.jy = 0;
    this.base = { x: 0, y: 0 };
    this.joyPtr = null;
    this.R = 52;
    this.actions = [];
    this.sprintHeld = false;
    this.pressHeld = false;
    this.charge = 0;
    this.charging = false;
    this.keys = new Set();
    this.padPrev = [];
    this.lastPadButtons = [];

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    root.addEventListener('pointerdown', this.onDown, { passive: false });
    root.addEventListener('pointermove', this.onMove, { passive: false });
    root.addEventListener('pointerup', this.onUp, { passive: false });
    root.addEventListener('pointercancel', this.onUp, { passive: false });
    root.addEventListener('lostpointercapture', (e) => this.onUp(e));
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.releaseAll();
  }

  setLefty(on) {
    this.lefty = on;
    this.root.classList.toggle('lefty', on);
    this.measure();
  }

  setScale(s) {
    document.documentElement.style.setProperty('--bs', String(s));
    this.measure();
  }

  // Cache button hit areas (call on resize / layout change).
  measure() {
    const bs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bs')) || 1;
    this.R = 50 * bs;
    for (const b of Object.values(this.btn)) {
      const r = b.el.getBoundingClientRect();
      b.x = r.left + r.width / 2;
      b.y = r.top + r.height / 2;
      b.r = r.width / 2;
    }
    this.resetJoyVisual();
  }

  setLayout(name) {
    if (this.layout === name) return;
    this.layout = name;
    const L = LAYOUTS[name] || LAYOUTS.none;
    for (const id of Object.keys(this.btn)) {
      const b = this.btn[id];
      const txt = L[id];
      b.label.textContent = txt;
      b.el.classList.toggle('hide', !txt);
    }
    this.root.classList.toggle('defend', name === 'defend' || name === 'keeper');
    // Releasing a held button under a changed meaning must not fire.
    for (const b of Object.values(this.btn)) {
      if (b.ptr !== null) b.cancelled = true;
    }
    if (name !== 'attack' && name !== 'setShoot' && name !== 'penalty') this.stopCharge();
  }

  releaseAll() {
    this.ptrs.clear();
    this.joyPtr = null;
    this.jx = this.jy = 0;
    this.sprintHeld = false;
    this.pressHeld = false;
    this.stopCharge();
    for (const b of Object.values(this.btn)) {
      b.ptr = null;
      b.el.classList.remove('down');
    }
    this.resetJoyVisual();
  }

  resetJoyVisual() {
    this.joy.classList.remove('active', 'sprint');
    this.joy.style.left = '';
    this.joy.style.top = '';
    this.knob.style.transform = '';
  }

  // ------------------------------------------------------------ pointers
  hitButton(x, y) {
    let best = null, bd = 1e9;
    for (const [id, b] of Object.entries(this.btn)) {
      if (b.el.classList.contains('hide')) continue;
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r + 16 && d < bd) {
        bd = d;
        best = id;
      }
    }
    return best;
  }

  onDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const x = e.clientX, y = e.clientY;
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    const id = this.hitButton(x, y);
    if (id) {
      const b = this.btn[id];
      b.ptr = e.pointerId;
      b.t0 = performance.now();
      b.sx = x;
      b.sy = y;
      b.maxUp = 0;
      b.travel = 0;
      b.cancelled = false;
      b.el.classList.add('down');
      this.ptrs.set(e.pointerId, { kind: 'btn', id });
      this.buttonDown(id);
      this.haptic(6);
      return;
    }
    const w = window.innerWidth;
    const joySide = this.lefty ? x > w * 0.55 : x < w * 0.45;
    if (joySide && this.joyPtr === null && y > 64) {
      this.joyPtr = e.pointerId;
      const R = this.R;
      const sl = 16 + R, sr = w - 16 - R;
      this.base.x = Math.min(sr, Math.max(sl, x));
      this.base.y = Math.min(window.innerHeight - 12 - R, Math.max(70 + R, y));
      this.joy.style.left = this.base.x + 'px';
      this.joy.style.top = this.base.y + 'px';
      this.joy.classList.add('active');
      this.ptrs.set(e.pointerId, { kind: 'joy' });
      this.moveJoy(x, y);
      return;
    }
    this.ptrs.set(e.pointerId, { kind: 'swipe', x, y, t0: performance.now() });
  }

  onMove(e) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.kind === 'joy') this.moveJoy(e.clientX, e.clientY);
    else if (p.kind === 'btn') {
      const b = this.btn[p.id];
      b.maxUp = Math.max(b.maxUp, b.sy - e.clientY);
      b.travel = Math.max(b.travel, Math.hypot(e.clientX - b.sx, e.clientY - b.sy));
    }
  }

  onUp(e) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    if (p.kind === 'joy') {
      this.joyPtr = null;
      this.jx = this.jy = 0;
      this.resetJoyVisual();
    } else if (p.kind === 'btn') {
      const b = this.btn[p.id];
      b.ptr = null;
      b.el.classList.remove('down');
      if (!b.cancelled) this.buttonUp(p.id, b);
    } else if (p.kind === 'swipe') {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 38 && performance.now() - p.t0 < 350 && this.layout === 'attack') {
        this.actions.push({ type: 'skill', sdx: dx / d, sdy: dy / d });
        this.haptic(10);
      }
    }
  }

  moveJoy(x, y) {
    const R = this.R;
    let dx = x - this.base.x, dy = y - this.base.y;
    let d = Math.hypot(dx, dy);
    const follow = R * 1.4;
    if (d > follow) {
      // Drag the base along so the thumb never "loses" the stick.
      const k = (d - follow) / d;
      this.base.x += dx * k;
      this.base.y += dy * k;
      this.joy.style.left = this.base.x + 'px';
      this.joy.style.top = this.base.y + 'px';
      dx = x - this.base.x;
      dy = y - this.base.y;
      d = follow;
    }
    const m = Math.min(1, d / R);
    const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
    this.jx = nx * m;
    this.jy = ny * m;
    this.knob.style.transform = `translate(${nx * Math.min(d, R)}px, ${ny * Math.min(d, R)}px)`;
    this.joy.classList.toggle('sprint', m > 0.93 || this.sprintHeld);
  }

  // ------------------------------------------------------------ button semantics
  buttonDown(id) {
    const L = this.layout;
    if (id === 'sprint') this.sprintHeld = true;
    if (id === 'shoot' && (L === 'attack' || L === 'setShoot' || L === 'penalty')) this.startCharge();
    if (id === 'through' && (L === 'defend' || L === 'keeper')) this.pressHeld = true;
    if (id === 'pass' && (L === 'defend' || L === 'keeper')) this.actions.push({ type: 'switch' });
    if (id === 'shoot' && L === 'defend') this.tackleArm = performance.now();
  }

  buttonUp(id, b) {
    const L = this.layout;
    const up = b.maxUp > 34;
    if (id === 'sprint') {
      this.sprintHeld = false;
      return;
    }
    if (L === 'attack' || L === 'setShoot' || L === 'setPass' || L === 'penalty') {
      if (id === 'shoot' && L !== 'setPass') {
        const power = this.stopCharge();
        this.actions.push({ type: 'shoot', power, chip: up });
        this.haptic(14);
      } else if (id === 'pass') {
        this.actions.push({ type: 'pass', lob: up });
      } else if (id === 'through') {
        this.actions.push({ type: 'through', lob: up });
      }
      return;
    }
    if (L === 'defend' || L === 'keeper') {
      if (id === 'through') this.pressHeld = false;
      if (id === 'shoot') this.actions.push({ type: 'tackle', slide: b.travel > 34 });
    }
  }

  startCharge() {
    this.charging = true;
    this.chargeT0 = performance.now();
    this.charge = 0.2;
  }

  stopCharge() {
    const c = this.charging ? this.charge : 0.5;
    this.charging = false;
    this.charge = 0;
    if (this.powerFg) this.powerFg.style.strokeDashoffset = '289';
    return c;
  }

  haptic(ms) {
    if (this.opts.haptic) this.opts.haptic(ms);
  }

  // ------------------------------------------------------------ keyboard / gamepad
  onKey(e, down) {
    if (!this.enabled) return;
    const k = e.key.toLowerCase();
    const handled = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'j', 'k', 'l', 'shift', 'u'].includes(k);
    if (handled) e.preventDefault();
    if (e.repeat) return;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    const L = this.layout;
    const lob = this.keys.has('u');
    if (k === 'shift') this.sprintHeld = down;
    if (k === 'j') {
      if (down && (L === 'attack' || L === 'setShoot' || L === 'penalty')) this.startCharge();
      else if (!down && (L === 'attack' || L === 'setShoot' || L === 'penalty')) this.actions.push({ type: 'shoot', power: this.stopCharge(), chip: lob });
      else if (down && L === 'defend') this.actions.push({ type: 'tackle', slide: this.keys.has('shift') });
    }
    if (k === 'k' && down) {
      if (L === 'defend' || L === 'keeper') this.actions.push({ type: 'switch' });
      else this.actions.push({ type: 'pass', lob });
    }
    if (k === 'l') {
      if (L === 'defend' || L === 'keeper') this.pressHeld = down;
      else if (down) this.actions.push({ type: 'through', lob });
    }
    if (k === ' ' && down && L === 'attack') {
      const [x, y] = this.keyVec();
      const m = Math.hypot(x, y) || 1;
      this.actions.push({ type: 'skill', sdx: x / m || 1, sdy: y / m });
    }
  }

  keyVec() {
    let x = 0, y = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) x -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) x += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) y -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) y += 1;
    return [x, y];
  }

  pollPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    const gp = pads && [...pads].find((p) => p && p.connected);
    if (!gp) return null;
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const prev = this.lastPadButtons;
    const edge = (i) => btn(i) && !prev[i];
    const rel = (i) => !btn(i) && prev[i];
    const L = this.layout;
    const lob = btn(4);
    if (L === 'defend' || L === 'keeper') {
      if (edge(0)) this.actions.push({ type: 'switch' });
      if (edge(1)) this.actions.push({ type: 'tackle', slide: btn(7) });
      this.pressHeld = btn(3) || btn(2);
    } else {
      if (edge(0)) this.actions.push({ type: 'pass', lob });
      if (edge(3)) this.actions.push({ type: 'through', lob });
      if (edge(1)) this.startCharge();
      if (rel(1)) this.actions.push({ type: 'shoot', power: this.stopCharge(), chip: lob });
      if (edge(2)) this.actions.push({ type: 'skill', sdx: gp.axes[0] || 1, sdy: gp.axes[1] || 0 });
    }
    this.lastPadButtons = gp.buttons.map((b) => b.pressed);
    if (edge(9) && this.opts.onPause) this.opts.onPause();
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    return { x: Math.abs(ax) > 0.15 ? ax : 0, y: Math.abs(ay) > 0.15 ? ay : 0, sprint: btn(7) || btn(5) };
  }

  // Called every frame. Returns screen-space intent.
  update() {
    if (this.charging) {
      const t = (performance.now() - this.chargeT0) / 1000;
      this.charge = Math.min(1, 0.2 + (0.8 * t) / CHARGE_TIME);
      if (this.powerFg) {
        this.powerFg.style.strokeDashoffset = String(289 * (1 - this.charge));
        this.powerFg.style.stroke = this.charge > 0.86 ? '#ff4d6d' : this.charge > 0.62 ? '#f5c542' : '#c6ff3d';
      }
    }
    let x = this.jx, y = this.jy, sprint = this.sprintHeld;
    const [kx, ky] = this.keyVec();
    if (kx || ky) {
      const m = Math.hypot(kx, ky);
      x = kx / m;
      y = ky / m;
      if (!this.keys.has('shift')) {
        x *= 0.8;
        y *= 0.8;
      }
    }
    const pad = this.pollPad();
    if (pad && (pad.x || pad.y)) {
      x = pad.x;
      y = pad.y;
      sprint = sprint || pad.sprint;
    }
    return { x, y, sprint, press: this.pressHeld, charging: this.charging, charge: this.charge };
  }

  takeActions() {
    const a = this.actions;
    this.actions = [];
    return a;
  }
}
