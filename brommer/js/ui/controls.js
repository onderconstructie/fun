// Steering: hold the left or right half of the screen, arrow keys / A-D,
// a gamepad stick, or (optional) tilt the phone like a steering wheel.
// The moped accelerates by itself, so steering is all a rider needs.

const TILT_FULL = Math.sin((24 * Math.PI) / 180); // tilt for full lock

export class Controls {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.enabled = false;
    this.ptr = new Map(); // pointerId -> -1 | 1
    this.keys = new Set();
    this.tilt = false;
    this.tiltUp = null;
    this.tiltZero = 0;
    this.padPrev = [];
    this.zoneL = root.querySelector('#zone-l');
    this.zoneR = root.querySelector('#zone-r');
    root.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    root.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    root.addEventListener('pointerup', (e) => this.onUp(e));
    root.addEventListener('pointercancel', (e) => this.onUp(e));
    root.addEventListener('lostpointercapture', (e) => this.onUp(e));
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    this.onOrient = this.onOrient.bind(this);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.releaseAll();
  }

  releaseAll() {
    this.ptr.clear();
    this.keys.clear();
    this.paint();
  }

  // ------------------------------------------------------------ touch
  side(x) {
    return x < window.innerWidth / 2 ? -1 : 1;
  }

  onDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    this.ptr.set(e.pointerId, this.side(e.clientX));
    this.paint();
    if (this.opts.haptic) this.opts.haptic(5);
  }

  onMove(e) {
    if (!this.ptr.has(e.pointerId)) return;
    e.preventDefault();
    const s = this.side(e.clientX);
    if (s !== this.ptr.get(e.pointerId)) {
      this.ptr.set(e.pointerId, s);
      this.paint();
    }
  }

  onUp(e) {
    if (!this.ptr.delete(e.pointerId)) return;
    this.paint();
  }

  touchSteer() {
    let l = false, r = false;
    for (const s of this.ptr.values()) {
      if (s < 0) l = true;
      else r = true;
    }
    // Both thumbs down: the last one pressed wins.
    if (l && r) return [...this.ptr.values()].pop();
    return l ? -1 : r ? 1 : 0;
  }

  paint() {
    const s = this.touchSteer();
    const k = this.keySteer();
    this.zoneL.classList.toggle('on', s < 0 || k < 0);
    this.zoneR.classList.toggle('on', s > 0 || k > 0);
  }

  // ------------------------------------------------------------ keyboard / gamepad
  onKey(e, down) {
    if (!this.enabled) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd', ' ', 'h'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    if (down && (k === 'escape' || k === 'p') && this.opts.onPause) this.opts.onPause();
    if (down && (k === ' ' || k === 'h') && this.opts.onHorn) this.opts.onHorn();
    this.paint();
  }

  keySteer() {
    let x = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) x -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) x += 1;
    return x;
  }

  padSteer() {
    if (!navigator.getGamepads) return 0;
    const pads = navigator.getGamepads();
    const gp = pads && [...pads].find((p) => p && p.connected);
    if (!gp) return 0;
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (btn(9) && !this.padPrev[9] && this.opts.onPause) this.opts.onPause();
    if ((btn(0) || btn(1)) && !(this.padPrev[0] || this.padPrev[1]) && this.opts.onHorn) this.opts.onHorn();
    this.padPrev = gp.buttons.map((b) => b.pressed);
    const ax = gp.axes[0] || 0;
    if (btn(14)) return -1;
    if (btn(15)) return 1;
    return Math.abs(ax) > 0.15 ? Math.max(-1, Math.min(1, ax * 1.2)) : 0;
  }

  // ------------------------------------------------------------ tilt
  // Gravity direction in screen coordinates from deviceorientation angles
  // (consistent between iOS and Android, unlike devicemotion's signs).
  async enableTilt(on) {
    if (!on) {
      this.tilt = false;
      window.removeEventListener('deviceorientation', this.onOrient);
      return true;
    }
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === 'function') {
      try {
        if ((await DOE.requestPermission()) !== 'granted') return false;
      } catch (e) {
        return false;
      }
    }
    window.addEventListener('deviceorientation', this.onOrient);
    this.tilt = true;
    return true;
  }

  onOrient(e) {
    if (e.beta === null || e.gamma === null) return;
    const b = (e.beta * Math.PI) / 180, g = (e.gamma * Math.PI) / 180;
    const upX = -Math.cos(b) * Math.sin(g), upY = Math.sin(b);
    const ang = (((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * Math.PI) / 180;
    this.tiltUp = Math.cos(ang) * upX - Math.sin(ang) * upY;
  }

  // Remember how the phone is held right now as "straight ahead".
  calibrate() {
    this.tiltZero = this.tiltUp || 0;
  }

  tiltSteer() {
    if (!this.tilt || this.tiltUp === null) return 0;
    const v = -(this.tiltUp - this.tiltZero) / TILT_FULL;
    return Math.abs(v) < 0.08 ? 0 : Math.max(-1, Math.min(1, v));
  }

  // ------------------------------------------------------------ per frame
  steer() {
    const k = this.keySteer();
    if (k) return k;
    const t = this.touchSteer();
    if (t) return t;
    const p = this.padSteer();
    if (p) return p;
    return this.tiltSteer();
  }
}
