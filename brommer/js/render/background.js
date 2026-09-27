// Sky and parallax scenery layers per world, drawn once per theme into wide
// offscreen canvases that tile horizontally.

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rnd(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Each layer is W x H px with its "ground line" at the bottom; drawn so the
// bottom sits on the horizon.
function layer(theme, which, W, H) {
  const c = mk(W * 2, H * 2);
  const g = c.getContext('2d');
  g.scale(2, 2);
  const r = rnd(which === 'far' ? 7 : 13);
  const fog = theme.fog;
  const far = which === 'far';
  const tint = (hex, k) => blend(hex, fog, k);
  const bg = theme.bg;
  if (bg === 'polder' || bg === 'bollen') {
    // Tree lines, farms and windmills on a flat horizon.
    const col = far ? tint('#3f7a4a', 0.55) : tint('#356b3f', 0.25);
    g.fillStyle = col;
    for (let x = 0; x < W; ) {
      const w = 20 + r() * 60, h = (far ? 10 : 16) + r() * (far ? 14 : 26);
      g.beginPath();
      g.ellipse(x + w / 2, H - 2, w / 2, h, 0, Math.PI, 0);
      g.fill();
      x += w * (0.6 + r() * 0.8) + (r() < 0.2 ? 40 + r() * 80 : 0);
    }
    g.fillRect(0, H - 4, W, 4);
    const mills = far ? 5 : 3;
    for (let i = 0; i < mills; i++) {
      const x = ((i + r() * 0.6) / mills) * W, h = far ? 26 + r() * 10 : 44 + r() * 14;
      g.fillStyle = far ? tint('#4b3d33', 0.5) : tint('#4b3d33', 0.2);
      g.beginPath();
      g.moveTo(x - h * 0.16, H);
      g.lineTo(x + h * 0.16, H);
      g.lineTo(x + h * 0.08, H - h);
      g.lineTo(x - h * 0.08, H - h);
      g.fill();
      g.strokeStyle = g.fillStyle;
      g.lineWidth = Math.max(1.5, h * 0.05);
      const a = r() * Math.PI;
      for (let k = 0; k < 2; k++) {
        const aa = a + (k * Math.PI) / 2;
        g.beginPath();
        g.moveTo(x - Math.cos(aa) * h * 0.55, H - h - Math.sin(aa) * h * 0.55);
        g.lineTo(x + Math.cos(aa) * h * 0.55, H - h + Math.sin(aa) * h * 0.55);
        g.stroke();
      }
    }
    if (!far) {
      for (let i = 0; i < 4; i++) {
        const x = r() * W, w = 30 + r() * 20;
        g.fillStyle = tint('#9b3d2e', 0.2);
        g.beginPath();
        g.moveTo(x, H - 10);
        g.lineTo(x + w / 2, H - 26 - r() * 6);
        g.lineTo(x + w, H - 10);
        g.fill();
        g.fillStyle = tint('#efe6d6', 0.2);
        g.fillRect(x + 3, H - 10, w - 6, 10);
      }
    }
  } else if (bg === 'stad') {
    // Skyline of gables, church towers and a few taller blocks.
    for (let x = -10; x < W; ) {
      const w = 18 + r() * 34, h = (far ? 24 : 34) + r() * (far ? 26 : 40);
      const col = far ? tint(['#8a6a5a', '#7a8594', '#9a8a70'][Math.floor(r() * 3)], 0.55) : tint(['#9b4a36', '#6d5a50', '#5f7188', '#8c7a5a'][Math.floor(r() * 4)], 0.25);
      g.fillStyle = col;
      g.fillRect(x, H - h, w, h);
      g.beginPath();
      g.moveTo(x, H - h);
      g.lineTo(x + w / 2, H - h - w * 0.45);
      g.lineTo(x + w, H - h);
      g.fill();
      if (!far && r() < 0.6) {
        g.fillStyle = tint('#ffe9a8', 0.4);
        for (let k = 0; k < 3; k++) g.fillRect(x + 4 + k * (w / 3.2), H - h + 8, 3, 4);
      }
      if (r() < (far ? 0.12 : 0.08)) {
        const th = h * 2.2;
        g.fillStyle = far ? tint('#6f7a78', 0.5) : tint('#6f7a78', 0.2);
        g.fillRect(x + w / 2 - 6, H - th, 12, th);
        g.beginPath();
        g.moveTo(x + w / 2 - 8, H - th);
        g.lineTo(x + w / 2, H - th - 30);
        g.lineTo(x + w / 2 + 8, H - th);
        g.fill();
      }
      x += w;
    }
  } else if (bg === 'strand') {
    if (far) {
      // Sea on the horizon with a ship or two.
      g.fillStyle = tint('#2f86c8', 0.35);
      g.fillRect(0, H - 14, W, 14);
      g.fillStyle = tint('#ffffff', 0.4);
      for (let i = 0; i < 40; i++) g.fillRect(r() * W, H - 12 + r() * 10, 6 + r() * 12, 1.5);
      for (let i = 0; i < 2; i++) {
        const x = r() * W;
        g.fillStyle = tint('#394a5a', 0.5);
        g.fillRect(x, H - 20, 34, 6);
        g.fillRect(x + 8, H - 26, 12, 6);
      }
    } else {
      // Dunes.
      g.fillStyle = tint('#e2cc8e', 0.2);
      for (let x = -40; x < W; ) {
        const w = 80 + r() * 120, h = 16 + r() * 22;
        g.beginPath();
        g.ellipse(x + w / 2, H, w / 2, h, 0, Math.PI, 0);
        g.fill();
        x += w * 0.7;
      }
      g.strokeStyle = tint('#8aa35a', 0.3);
      g.lineWidth = 1.5;
      for (let i = 0; i < 90; i++) {
        const x = r() * W, y = H - 6 - r() * 16;
        g.beginPath();
        g.moveTo(x, y + 6);
        g.lineTo(x + (r() - 0.5) * 6, y);
        g.stroke();
      }
    }
  } else if (bg === 'bos') {
    // Rolling hills covered with pines.
    const col = far ? tint('#35604a', 0.5) : tint('#244a34', 0.2);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, H - (far ? 26 : 14) - Math.sin(x * 0.012 + (far ? 1 : 3)) * (far ? 16 : 10) - Math.sin(x * 0.031) * 6);
    g.lineTo(W, H);
    g.fill();
    for (let i = 0; i < (far ? 160 : 90); i++) {
      const x = r() * W, base = H - (far ? 20 : 8) - Math.sin(x * 0.012 + (far ? 1 : 3)) * (far ? 16 : 10) - Math.sin(x * 0.031) * 6;
      const h = (far ? 12 : 22) + r() * (far ? 10 : 18);
      g.beginPath();
      g.moveTo(x - h * 0.28, base + 4);
      g.lineTo(x, base - h);
      g.lineTo(x + h * 0.28, base + 4);
      g.fill();
    }
  }
  return c;
}

function blend(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ch = (x, s) => (x >> s) & 255;
  const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

export class Background {
  constructor(theme) {
    this.theme = theme;
    this.far = layer(theme, 'far', 1600, 90);
    this.near = layer(theme, 'near', 1600, 110);
    this.clouds = [];
    const r = rnd(99);
    const n = Math.round(4 + theme.clouds * 8);
    for (let i = 0; i < n; i++) this.clouds.push({ x: r(), y: 0.08 + r() * 0.5, s: 0.6 + r() * 0.9, v: r() });
  }

  // offset: horizontal scroll (grows with curves), horizon: screen y of the horizon.
  draw(g, W, H, horizon, offset, scale) {
    const th = this.theme;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, Math.ceil(horizon) + 2);
    // Sun.
    const sx = ((th.sun.x - offset * 0.05) % 1 + 1) % 1 * W, sy = th.sun.y * horizon;
    const sr = Math.min(W, H) * 0.075;
    const glow = g.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 4);
    glow.addColorStop(0, 'rgba(255, 250, 220, 0.7)');
    glow.addColorStop(1, 'rgba(255, 250, 220, 0)');
    g.fillStyle = glow;
    g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fillStyle = th.sun.color;
    g.fill();
    // Clouds.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of this.clouds) {
      const x = (((c.x - offset * 0.08) % 1) + 1) % 1 * (W + 300) - 150;
      const y = c.y * horizon * 0.8;
      const s = c.s * Math.max(40, W * 0.06);
      g.beginPath();
      g.ellipse(x, y, s, s * 0.32, 0, 0, Math.PI * 2);
      g.ellipse(x - s * 0.5, y + s * 0.08, s * 0.55, s * 0.26, 0, 0, Math.PI * 2);
      g.ellipse(x + s * 0.45, y + s * 0.05, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
      g.ellipse(x + s * 0.1, y - s * 0.16, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
      g.fill();
    }
    this.drawLayer(g, this.far, W, horizon, offset * 0.25, scale);
    this.drawLayer(g, this.near, W, horizon, offset * 0.5, scale);
  }

  drawLayer(g, img, W, horizon, offset, scale) {
    const h = (img.height / 2) * scale, w = (img.width / 2) * scale;
    let x = -((((offset * w) % w) + w) % w);
    for (; x < W; x += w) g.drawImage(img, x, horizon - h + 1, w + 1, h);
  }
}
