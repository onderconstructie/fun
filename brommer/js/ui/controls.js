// Steering: hold the left or right half of the screen, arrow keys / A-D,
// a gamepad stick, or (optional) tilt the phone like a steering wheel.
// The moped gives gas by itself; hold REM (or arrow down / S) to slow down.

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
    this.brakePtr = new Set();
    this.brakeOn = false;
    this.brakeBtn = opts.brakeBtn || null;
    if (this.brakeBtn) this.bindBrake(this.brakeBtn);
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
    this.brakePtr.clear();
    this.paint();
  }

  // The REM button: braking lasts as long as a finger holds it.
  bindBrake(b) {
    b.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      this.brakePtr.add(e.pointerId);
      this.paint();
      if (this.opts.haptic) this.opts.haptic(8);
    });
    const up = (e) => {
      if (this.brakePtr.delete(e.pointerId)) this.paint();
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
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
    this.paintBrake(this.brakePtr.size > 0 || this.keyBrake());
  }

  paintBrake(on) {
    if (on === this.brakeOn) return;
    this.brakeOn = on;
    if (this.brakeBtn) this.brakeBtn.classList.toggle('on', on);
  }

  // ------------------------------------------------------------ keyboard / gamepad
  onKey(e, down) {
    if (!this.enabled) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowdown', 'a', 'd', 's', ' ', 'h'].includes(k)) e.preventDefault();
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

  keyBrake() {
    return this.keys.has('arrowdown') || this.keys.has('s');
  }

  // Stick or d-pad steers, A/B toots, left trigger, X or d-pad down brakes.
  pad() {
    const none = { steer: 0, brake: 0 };
    if (!navigator.getGamepads) return none;
    const pads = navigator.getGamepads();
    const gp = pads && [...pads].find((p) => p && p.connected);
    if (!gp) return none;
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (btn(9) && !this.padPrev[9] && this.opts.onPause) this.opts.onPause();
    if ((btn(0) || btn(1)) && !(this.padPrev[0] || this.padPrev[1]) && this.opts.onHorn) this.opts.onHorn();
    this.padPrev = gp.buttons.map((b) => b.pressed);
    const ax = gp.axes[0] || 0;
    const steer = btn(14) ? -1 : btn(15) ? 1 : Math.abs(ax) > 0.15 ? Math.max(-1, Math.min(1, ax * 1.2)) : 0;
    const lt = gp.buttons[6] ? gp.buttons[6].value || (gp.buttons[6].pressed ? 1 : 0) : 0;
    const brake = btn(2) || btn(13) ? 1 : lt > 0.1 ? Math.min(1, lt * 1.2) : 0;
    return { steer, brake };
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
  // Steering (-1..1) and brake (0..1) from whatever is being used.
  read() {
    const pad = this.pad();
    const steer = this.keySteer() || this.touchSteer() || pad.steer || this.tiltSteer();
    const brake = this.brakePtr.size > 0 || this.keyBrake() ? 1 : pad.brake;
    this.paintBrake(brake > 0);
    return { steer, brake };
  }
}
