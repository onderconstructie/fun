// Procedural sprites (no image files): every roadside object, the obstacles
// and the mopeds (seen from behind) are drawn once into offscreen canvases
// and then scaled by the renderer. Sizes are in world units (road half-width
// = 2000, about 3.3 m).

import { shade } from '../util.js';

function mk(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g, c.width, c.height);
  return c;
}

function ell(g, x, y, rx, ry, fill) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

function rr(g, x, y, w, h, r, fill) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}

function poly(g, pts, fill, stroke, lw) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw || 1;
    g.stroke();
  }
}

function lin(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  return gr;
}

function line(g, x0, y0, x1, y1, color, lw) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.stroke();
}

// Little seeded random for sprite details.
function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ------------------------------------------------------------------ nature
const GREENS = [['#3f9a3a', '#5cbf4a', '#88d860'], ['#2f7f37', '#48a043', '#6fc15a'], ['#4f9f2f', '#72bf3a', '#a3d95a']];

function drawTree(g, W, H, v) {
  const [c0, c1, c2] = GREENS[v % 3];
  rr(g, W * 0.45, H * 0.55, W * 0.1, H * 0.45, W * 0.03, '#7a5433');
  rr(g, W * 0.47, H * 0.55, W * 0.03, H * 0.45, W * 0.02, '#946842');
  const blobs = [[0.5, 0.36, 0.34], [0.3, 0.46, 0.22], [0.7, 0.46, 0.22], [0.38, 0.22, 0.22], [0.62, 0.24, 0.22]];
  for (const [x, y, r] of blobs) ell(g, W * x, H * y + H * 0.02, W * r, W * r * 0.95, c0);
  for (const [x, y, r] of blobs) ell(g, W * x - W * 0.02, H * y, W * r * 0.92, W * r * 0.88, c1);
  ell(g, W * 0.4, H * 0.22, W * 0.12, W * 0.1, c2);
  ell(g, W * 0.27, H * 0.42, W * 0.08, W * 0.07, c2);
}

function drawPoplar(g, W, H, v) {
  const [c0, c1, c2] = GREENS[(v + 1) % 3];
  rr(g, W * 0.44, H * 0.8, W * 0.12, H * 0.2, W * 0.04, '#6e4a2c');
  ell(g, W * 0.5, H * 0.45, W * 0.46, H * 0.4, c0);
  ell(g, W * 0.46, H * 0.43, W * 0.36, H * 0.37, c1);
  ell(g, W * 0.38, H * 0.33, W * 0.14, H * 0.18, c2);
}

function drawPine(g, W, H, v) {
  const dark = ['#1f5a32', '#245f2c', '#1c4f35'][v % 3];
  const mid = ['#2e7a42', '#337a36', '#2a6b46'][v % 3];
  rr(g, W * 0.45, H * 0.82, W * 0.1, H * 0.18, W * 0.03, '#5d3b22');
  for (let i = 0; i < 4; i++) {
    const y0 = H * (0.06 + i * 0.19), y1 = H * (0.36 + i * 0.16);
    const hw = W * (0.2 + i * 0.1);
    poly(g, [W / 2, y0, W / 2 + hw, y1, W / 2 - hw, y1], dark);
    poly(g, [W / 2, y0 + H * 0.02, W / 2 + hw * 0.1, y1 - H * 0.01, W / 2 - hw * 0.85, y1 - H * 0.01], mid);
  }
}

function drawOak(g, W, H, v) {
  const [c0, c1, c2] = GREENS[(v + 2) % 3];
  poly(g, [W * 0.42, H, W * 0.58, H, W * 0.55, H * 0.5, W * 0.45, H * 0.5], '#6b4528');
  line(g, W * 0.5, H * 0.6, W * 0.3, H * 0.42, '#6b4528', W * 0.04);
  line(g, W * 0.5, H * 0.6, W * 0.7, H * 0.4, '#6b4528', W * 0.04);
  const rand = rnd(v + 3);
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2, d = rand() * 0.28;
    ell(g, W * (0.5 + Math.cos(a) * d), H * (0.34 + Math.sin(a) * d * 0.7), W * (0.14 + rand() * 0.06), W * 0.13, i % 3 ? c0 : c1);
  }
  for (let i = 0; i < 6; i++) ell(g, W * (0.3 + rand() * 0.4), H * (0.16 + rand() * 0.25), W * 0.07, W * 0.06, c2);
}

function drawBush(g, W, H, v) {
  const [c0, c1, c2] = GREENS[v % 3];
  for (const [x, r] of [[0.28, 0.24], [0.5, 0.3], [0.72, 0.24]]) ell(g, W * x, H * 0.62, W * r, H * 0.42, c0);
  for (const [x, r] of [[0.3, 0.18], [0.5, 0.22], [0.7, 0.16]]) ell(g, W * x - W * 0.02, H * 0.52, W * r, H * 0.32, c1);
  ell(g, W * 0.42, H * 0.38, W * 0.1, H * 0.12, c2);
}

function drawReed(g, W, H, v) {
  const rand = rnd(v + 11);
  for (let i = 0; i < 16; i++) {
    const x = W * (0.1 + rand() * 0.8), top = H * (0.1 + rand() * 0.4);
    line(g, x, H, x + (rand() - 0.5) * W * 0.12, top, i % 2 ? '#6f9a3a' : '#89b24a', W * 0.035);
    if (i % 4 === 0) rr(g, x - W * 0.025, top - H * 0.02, W * 0.05, H * 0.14, W * 0.02, '#7a4b26');
  }
}

function drawMushroom(g, W, H) {
  rr(g, W * 0.38, H * 0.45, W * 0.24, H * 0.55, W * 0.1, '#f4ecd8');
  ell(g, W * 0.5, H * 0.45, W * 0.48, H * 0.3, '#d62f2f');
  ell(g, W * 0.5, H * 0.5, W * 0.46, H * 0.12, '#b52424');
  ell(g, W * 0.5, H * 0.38, W * 0.44, H * 0.24, '#e53935');
  for (const [x, y, r] of [[0.32, 0.36, 0.07], [0.55, 0.26, 0.08], [0.7, 0.42, 0.06], [0.45, 0.44, 0.05]]) ell(g, W * x, H * y, W * r, W * r * 0.8, '#fff');
}

function drawLog(g, W, H) {
  rr(g, W * 0.04, H * 0.3, W * 0.86, H * 0.66, H * 0.3, '#7a5231');
  rr(g, W * 0.08, H * 0.36, W * 0.8, H * 0.12, H * 0.06, '#94683f');
  ell(g, W * 0.88, H * 0.63, W * 0.1, H * 0.33, '#c8a06a');
  ell(g, W * 0.88, H * 0.63, W * 0.05, H * 0.17, '#a57e4c');
}

function drawRock(g, W, H) {
  poly(g, [W * 0.05, H, W * 0.12, H * 0.45, W * 0.4, H * 0.1, W * 0.75, H * 0.2, W * 0.95, H * 0.6, W * 0.92, H], '#8d949c');
  poly(g, [W * 0.18, H * 0.5, W * 0.4, H * 0.18, W * 0.62, H * 0.24, W * 0.45, H * 0.5], '#a9b0b8');
  poly(g, [W * 0.6, H * 0.95, W * 0.9, H * 0.62, W * 0.93, H * 0.98], '#747b83');
}

function drawDeer(g, W, H) {
  const c = '#9a6232', d = '#7a4a22';
  for (const x of [0.28, 0.36, 0.62, 0.7]) line(g, W * x, H * 0.62, W * x, H * 0.98, d, W * 0.045);
  ell(g, W * 0.48, H * 0.55, W * 0.3, H * 0.14, c);
  ell(g, W * 0.22, H * 0.55, W * 0.05, H * 0.05, '#f3e3cf');
  poly(g, [W * 0.66, H * 0.5, W * 0.78, H * 0.22, W * 0.86, H * 0.24, W * 0.76, H * 0.56], c);
  ell(g, W * 0.84, H * 0.22, W * 0.09, H * 0.06, c);
  line(g, W * 0.8, H * 0.16, W * 0.74, H * 0.02, d, W * 0.02);
  line(g, W * 0.76, H * 0.08, W * 0.7, H * 0.06, d, W * 0.02);
  line(g, W * 0.86, H * 0.16, W * 0.92, H * 0.03, d, W * 0.02);
  ell(g, W * 0.9, H * 0.22, W * 0.015, W * 0.015, '#222');
}

// ------------------------------------------------------------------ polder & flowers
function drawWindmill(g, W, H) {
  // Tower (sails are drawn separately so they can turn).
  poly(g, [W * 0.3, H, W * 0.7, H, W * 0.6, H * 0.3, W * 0.4, H * 0.3], '#5b4636');
  poly(g, [W * 0.3, H, W * 0.42, H, W * 0.46, H * 0.3, W * 0.4, H * 0.3], '#6f5745');
  rr(g, W * 0.24, H * 0.62, W * 0.52, H * 0.035, 2, '#3b2e24');
  poly(g, [W * 0.36, H * 0.32, W * 0.64, H * 0.32, W * 0.58, H * 0.2, W * 0.42, H * 0.2], '#3d6b4a');
  rr(g, W * 0.46, H * 0.86, W * 0.08, H * 0.14, W * 0.03, '#2f241c');
  rr(g, W * 0.46, H * 0.44, W * 0.07, H * 0.07, 2, '#f1efe6');
  rr(g, W * 0.47, H * 0.7, W * 0.06, H * 0.06, 2, '#f1efe6');
  ell(g, W * 0.5, H * 0.24, W * 0.04, W * 0.04, '#2a2a2a');
}

function drawSails(g, W, H) {
  const cx = W / 2, cy = H / 2, R = W * 0.49;
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(cx, cy);
    g.rotate((i * Math.PI) / 2);
    line(g, 0, 0, 0, -R, '#4a3a2c', W * 0.025);
    g.fillStyle = '#efe7d6';
    g.fillRect(W * 0.012, -R, W * 0.09, R * 0.78);
    g.strokeStyle = '#6b5a47';
    g.lineWidth = W * 0.006;
    for (let k = 0; k <= 6; k++) {
      g.beginPath();
      g.moveTo(W * 0.012, -R + (k * R * 0.78) / 6);
      g.lineTo(W * 0.102, -R + (k * R * 0.78) / 6);
      g.stroke();
    }
    g.strokeRect(W * 0.012, -R, W * 0.09, R * 0.78);
    g.restore();
  }
  ell(g, cx, cy, W * 0.035, W * 0.035, '#2a2a2a');
}

const ROOFS = ['#b5432e', '#8c3b2b', '#5d5d66', '#9a6b3c'];
function drawFarm(g, W, H, v) {
  const roof = ROOFS[v % ROOFS.length];
  const wall = ['#f1eadc', '#c9573f', '#e8dcc2'][v % 3];
  rr(g, W * 0.06, H * 0.5, W * 0.56, H * 0.5, 2, wall);
  poly(g, [W * 0.02, H * 0.52, W * 0.34, H * 0.08, W * 0.66, H * 0.52], roof);
  poly(g, [W * 0.34, H * 0.08, W * 0.66, H * 0.52, W * 0.6, H * 0.52, W * 0.34, H * 0.16], shade(roof, -0.2));
  for (const x of [0.14, 0.42]) {
    rr(g, W * x, H * 0.62, W * 0.1, H * 0.14, 2, '#2d4a66');
    g.strokeStyle = '#fff';
    g.lineWidth = W * 0.012;
    g.strokeRect(W * x, H * 0.62, W * 0.1, H * 0.14);
  }
  rr(g, W * 0.28, H * 0.7, W * 0.09, H * 0.3, 2, '#3f6b3f');
  // Barn.
  rr(g, W * 0.62, H * 0.42, W * 0.36, H * 0.58, 2, '#7b3b2c');
  poly(g, [W * 0.6, H * 0.44, W * 0.8, H * 0.2, W * 1.0, H * 0.44], '#4f3a2e');
  rr(g, W * 0.72, H * 0.6, W * 0.16, H * 0.4, 2, '#5a2a1f');
  line(g, W * 0.72, H * 0.6, W * 0.88, H, '#f1eadc', W * 0.01);
  line(g, W * 0.88, H * 0.6, W * 0.72, H, '#f1eadc', W * 0.01);
}

function drawCow(g, W, H, v) {
  const flip = v % 2;
  g.save();
  if (flip) {
    g.translate(W, 0);
    g.scale(-1, 1);
  }
  for (const x of [0.24, 0.34, 0.62, 0.72]) line(g, W * x, H * 0.55, W * x, H * 0.97, '#2b2b2b', W * 0.06);
  ell(g, W * 0.48, H * 0.46, W * 0.36, H * 0.24, '#f7f7f2');
  ell(g, W * 0.38, H * 0.4, W * 0.1, H * 0.12, '#1f1f1f');
  ell(g, W * 0.62, H * 0.5, W * 0.12, H * 0.1, '#1f1f1f');
  ell(g, W * 0.5, H * 0.3, W * 0.07, H * 0.06, '#1f1f1f');
  ell(g, W * 0.58, H * 0.66, W * 0.07, H * 0.05, '#f4a9b0');
  ell(g, W * 0.86, H * 0.38, W * 0.12, H * 0.14, '#f7f7f2');
  ell(g, W * 0.92, H * 0.45, W * 0.07, H * 0.07, '#f2b8b8');
  ell(g, W * 0.82, H * 0.32, W * 0.05, H * 0.07, '#1f1f1f');
  poly(g, [W * 0.8, H * 0.26, W * 0.76, H * 0.18, W * 0.83, H * 0.24], '#d8d0b8');
  poly(g, [W * 0.92, H * 0.26, W * 0.96, H * 0.18, W * 0.89, H * 0.24], '#d8d0b8');
  line(g, W * 0.12, H * 0.4, W * 0.08, H * 0.7, '#2b2b2b', W * 0.02);
  g.restore();
}

function drawSheep(g, W, H, v) {
  const flip = v % 2;
  g.save();
  if (flip) {
    g.translate(W, 0);
    g.scale(-1, 1);
  }
  for (const x of [0.28, 0.4, 0.6, 0.7]) line(g, W * x, H * 0.6, W * x, H * 0.97, '#2b2b2b', W * 0.05);
  const rand = rnd(v + 5);
  for (let i = 0; i < 9; i++) ell(g, W * (0.22 + rand() * 0.5), H * (0.38 + rand() * 0.25), W * 0.16, H * 0.2, i % 2 ? '#f4f2ea' : '#e6e2d6');
  ell(g, W * 0.84, H * 0.42, W * 0.1, H * 0.13, '#2b2b2b');
  ell(g, W * 0.8, H * 0.34, W * 0.06, H * 0.05, '#f4f2ea');
  g.restore();
}

function drawFence(g, W, H) {
  for (const x of [0.05, 0.5, 0.95]) rr(g, W * x - W * 0.025, H * 0.1, W * 0.05, H * 0.9, 2, '#8b6a45');
  rr(g, 0, H * 0.28, W, H * 0.1, 2, '#a07c52');
  rr(g, 0, H * 0.6, W, H * 0.1, 2, '#a07c52');
}

function drawBike(g, W, H, v) {
  const col = ['#1f2937', '#b91c1c', '#1d4ed8', '#15803d', '#f8fafc'][v % 5];
  g.lineWidth = W * 0.035;
  g.strokeStyle = '#222';
  for (const x of [0.22, 0.78]) {
    g.beginPath();
    g.arc(W * x, H * 0.66, H * 0.3, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = col;
  g.lineWidth = W * 0.04;
  g.beginPath();
  g.moveTo(W * 0.22, H * 0.66);
  g.lineTo(W * 0.42, H * 0.36);
  g.lineTo(W * 0.7, H * 0.36);
  g.lineTo(W * 0.78, H * 0.66);
  g.moveTo(W * 0.42, H * 0.36);
  g.lineTo(W * 0.5, H * 0.66);
  g.lineTo(W * 0.7, H * 0.36);
  g.moveTo(W * 0.7, H * 0.36);
  g.lineTo(W * 0.66, H * 0.14);
  g.stroke();
  line(g, W * 0.58, H * 0.12, W * 0.74, H * 0.12, '#222', W * 0.04);
  rr(g, W * 0.36, H * 0.22, W * 0.14, H * 0.06, 3, '#3b2a1e');
}

function drawBikes(g, W, H, v) {
  for (let i = 0; i < 3; i++) {
    const c = mk(W * 0.42, H, (g2, w2, h2) => drawBike(g2, w2, h2, v + i));
    g.drawImage(c, W * (0.02 + i * 0.28), 0);
  }
}

// ------------------------------------------------------------------ town
const BRICK = ['#a8452f', '#7d3f2c', '#e6d7b8', '#5f7f9a', '#2f6b5a', '#c2703f', '#8f5a9c', '#d9c07a'];
function drawHouse(g, W, H, v) {
  const wall = BRICK[v % BRICK.length];
  const gable = v % 3;
  const top = H * 0.16;
  // Facade with a Dutch gable.
  if (gable === 0) poly(g, [0, H, 0, H * 0.34, W * 0.2, H * 0.34, W * 0.2, H * 0.24, W * 0.35, H * 0.24, W * 0.35, top, W * 0.65, top, W * 0.65, H * 0.24, W * 0.8, H * 0.24, W * 0.8, H * 0.34, W, H * 0.34, W, H], wall);
  else if (gable === 1) {
    poly(g, [0, H, 0, H * 0.32, W * 0.22, H * 0.28, W * 0.3, top, W * 0.7, top, W * 0.78, H * 0.28, W, H * 0.32, W, H], wall);
    ell(g, W * 0.5, top, W * 0.2, H * 0.06, wall);
  } else poly(g, [0, H, 0, H * 0.36, W * 0.5, H * 0.08, W, H * 0.36, W, H], wall);
  const trim = wall === '#e6d7b8' || wall === '#d9c07a' ? '#7d3f2c' : '#f4efe4';
  rr(g, 0, H * 0.36, W, H * 0.02, 0, trim);
  for (const row of [0.44, 0.62]) {
    for (const x of [0.12, 0.42, 0.72]) {
      rr(g, W * x, H * row, W * 0.16, H * 0.13, 2, '#2b4a63');
      g.strokeStyle = '#f7f3ea';
      g.lineWidth = W * 0.022;
      g.strokeRect(W * x, H * row, W * 0.16, H * 0.13);
      line(g, W * (x + 0.08), H * row, W * (x + 0.08), H * (row + 0.13), '#f7f3ea', W * 0.012);
    }
  }
  rr(g, W * 0.4, H * 0.8, W * 0.2, H * 0.2, 2, ['#1f4d3a', '#7a1f1f', '#1f3a7a'][v % 3]);
  rr(g, W * 0.08, H * 0.82, W * 0.24, H * 0.1, 2, '#2b4a63');
  rr(g, W * 0.68, H * 0.82, W * 0.24, H * 0.1, 2, '#2b4a63');
  if (gable !== 2) rr(g, W * 0.46, H * 0.2, W * 0.08, H * 0.08, 2, '#2b4a63');
  // Side shading so rows of houses read as separate buildings.
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(W * 0.94, H * 0.3, W * 0.06, H * 0.7);
}

function drawLamp(g, W, H) {
  rr(g, W * 0.42, H * 0.12, W * 0.16, H * 0.88, W * 0.06, '#26343a');
  rr(g, W * 0.34, H * 0.94, W * 0.32, H * 0.06, 2, '#1c272c');
  poly(g, [W * 0.2, H * 0.12, W * 0.8, H * 0.12, W * 0.68, H * 0.02, W * 0.32, H * 0.02], '#26343a');
  rr(g, W * 0.28, H * 0.12, W * 0.44, H * 0.07, 3, '#ffe9a8');
}

function drawBench(g, W, H) {
  for (const x of [0.12, 0.84]) rr(g, W * x, H * 0.45, W * 0.05, H * 0.55, 2, '#3b3f46');
  rr(g, W * 0.04, H * 0.45, W * 0.92, H * 0.14, 3, '#8b5a33');
  rr(g, W * 0.04, H * 0.1, W * 0.92, H * 0.14, 3, '#9c6a3f');
  rr(g, W * 0.04, H * 0.28, W * 0.92, H * 0.1, 3, '#8b5a33');
}

function drawPlanter(g, W, H, v) {
  const [c0, c1] = GREENS[v % 3];
  rr(g, W * 0.46, H * 0.4, W * 0.08, H * 0.45, 2, '#6b4a2c');
  ell(g, W * 0.5, H * 0.3, W * 0.42, H * 0.26, c0);
  ell(g, W * 0.45, H * 0.26, W * 0.32, H * 0.2, c1);
  rr(g, W * 0.22, H * 0.78, W * 0.56, H * 0.22, W * 0.08, '#8e96a0');
  rr(g, W * 0.22, H * 0.78, W * 0.56, H * 0.05, 2, '#a7aeb6');
}

function drawChurch(g, W, H) {
  rr(g, W * 0.22, H * 0.36, W * 0.56, H * 0.64, 2, '#8d8a80');
  rr(g, W * 0.22, H * 0.36, W * 0.14, H * 0.64, 0, '#a19d92');
  poly(g, [W * 0.22, H * 0.37, W * 0.5, 0, W * 0.78, H * 0.37], '#3f5a52');
  poly(g, [W * 0.5, 0, W * 0.78, H * 0.37, W * 0.62, H * 0.37], '#344a44');
  ell(g, W * 0.5, H * 0.46, W * 0.14, W * 0.14, '#f2efe6');
  line(g, W * 0.5, H * 0.46, W * 0.5, H * 0.42, '#222', W * 0.02);
  line(g, W * 0.5, H * 0.46, W * 0.56, H * 0.46, '#222', W * 0.02);
  rr(g, W * 0.42, H * 0.58, W * 0.16, H * 0.2, W * 0.08, '#2f3b46');
  rr(g, W * 0.4, H * 0.86, W * 0.2, H * 0.14, W * 0.06, '#4a3424');
  line(g, W * 0.5, 0, W * 0.5, -H * 0.02, '#c9a227', W * 0.03);
}

// ------------------------------------------------------------------ beach
function drawDuneGrass(g, W, H, v) {
  ell(g, W * 0.5, H * 0.98, W * 0.5, H * 0.22, '#e8d49a');
  const rand = rnd(v + 21);
  for (let i = 0; i < 14; i++) {
    const x = W * (0.2 + rand() * 0.6);
    line(g, x, H * 0.92, x + (rand() - 0.5) * W * 0.4, H * (0.08 + rand() * 0.4), i % 2 ? '#8aa35a' : '#a3b86a', W * 0.03);
  }
}

const HUT = [['#e53935', '#fff'], ['#1e88e5', '#fff'], ['#fdd835', '#fff'], ['#43a047', '#fff'], ['#fb8c00', '#fff'], ['#8e24aa', '#fff']];
function drawHut(g, W, H, v) {
  const [a, b] = HUT[v % HUT.length];
  const n = 6;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect(W * 0.1 + (i * W * 0.8) / n, H * 0.3, (W * 0.8) / n + 0.5, H * 0.66);
  }
  poly(g, [W * 0.02, H * 0.32, W * 0.5, H * 0.04, W * 0.98, H * 0.32], shade(a, -0.15));
  rr(g, W * 0.38, H * 0.52, W * 0.24, H * 0.44, 2, 'rgba(0,0,0,0.25)');
  rr(g, W * 0.06, H * 0.94, W * 0.88, H * 0.06, 2, '#b8955e');
}

function drawParasol(g, W, H, v) {
  const cols = [['#e53935', '#fff'], ['#1e88e5', '#fff'], ['#fdd835', '#e53935'], ['#43a047', '#fff']][v % 4];
  line(g, W * 0.5, H * 0.2, W * 0.5, H, '#e7e1d2', W * 0.035);
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i * Math.PI) / 6, a1 = Math.PI + ((i + 1) * Math.PI) / 6;
    g.beginPath();
    g.moveTo(W * 0.5, H * 0.22);
    g.ellipse(W * 0.5, H * 0.3, W * 0.48, H * 0.22, 0, a0, a1);
    g.closePath();
    g.fillStyle = cols[i % 2];
    g.fill();
  }
  rr(g, W * 0.18, H * 0.9, W * 0.64, H * 0.08, 3, ['#ff7043', '#29b6f6', '#ffca28'][v % 3]);
}

function drawLifeguard(g, W, H) {
  for (const [x0, x1] of [[0.2, 0.32], [0.8, 0.68]]) line(g, W * x0, H, W * x1, H * 0.45, '#b98a52', W * 0.05);
  line(g, W * 0.24, H * 0.75, W * 0.76, H * 0.75, '#b98a52', W * 0.03);
  rr(g, W * 0.24, H * 0.2, W * 0.52, H * 0.28, 3, '#f4f1e8');
  poly(g, [W * 0.18, H * 0.22, W * 0.5, H * 0.08, W * 0.82, H * 0.22], '#e53935');
  rr(g, W * 0.3, H * 0.26, W * 0.4, H * 0.1, 2, '#2b4a63');
  line(g, W * 0.82, H * 0.22, W * 0.82, 0, '#555', W * 0.02);
  poly(g, [W * 0.82, 0, W * 0.98, H * 0.04, W * 0.82, H * 0.08], '#e53935');
}

function drawLighthouse(g, W, H) {
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = H * (0.18 + (i * 0.82) / bands), y1 = H * (0.18 + ((i + 1) * 0.82) / bands);
    const t0 = y0 / H, t1 = y1 / H;
    const hw0 = W * (0.16 + 0.16 * t0), hw1 = W * (0.16 + 0.16 * t1);
    poly(g, [W / 2 - hw0, y0, W / 2 + hw0, y0, W / 2 + hw1, y1, W / 2 - hw1, y1], i % 2 ? '#f4f1e8' : '#d32f2f');
  }
  rr(g, W * 0.3, H * 0.1, W * 0.4, H * 0.09, 2, '#fff3b0');
  poly(g, [W * 0.26, H * 0.1, W * 0.5, 0, W * 0.74, H * 0.1], '#263238');
  rr(g, W * 0.24, H * 0.17, W * 0.52, H * 0.03, 2, '#263238');
}

function drawFlag(g, W, H, v) {
  line(g, W * 0.2, H * 0.02, W * 0.2, H, '#d7d9dc', W * 0.08);
  if (v % 3 === 0) {
    // Checkered.
    const s = W * 0.2;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      g.fillStyle = (r + c) % 2 ? '#111' : '#fff';
      g.fillRect(W * 0.24 + c * s, H * 0.04 + r * s, s, s);
    }
  } else {
    const col = ['#ff3b6b', '#35b6ff', '#ffd23f', '#b8f000', '#ff6b35'][v % 5];
    poly(g, [W * 0.24, H * 0.04, W * 1.0, H * 0.14, W * 0.24, H * 0.26], col);
  }
}

// ------------------------------------------------------------------ race furniture
function drawCrowd(g, W, H, v) {
  const rand = rnd(v + 31);
  const cols = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#f8fafc', '#14b8a6'];
  const skins = ['#f1c7a5', '#d9a07a', '#a86f4c', '#6b4631', '#f5d6bd'];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 7; i++) {
      const x = W * (0.07 + i * 0.145 + (row ? 0.07 : 0)), base = H * (row ? 1 : 0.8);
      const hgt = H * (0.4 + rand() * 0.1);
      rr(g, x - W * 0.05, base - hgt * 0.62, W * 0.1, hgt * 0.62, W * 0.03, cols[Math.floor(rand() * cols.length)]);
      ell(g, x, base - hgt * 0.74, W * 0.04, W * 0.045, skins[Math.floor(rand() * skins.length)]);
      if (rand() < 0.4) line(g, x + W * 0.04, base - hgt * 0.55, x + W * 0.08, base - hgt * 0.95, skins[0], W * 0.02);
    }
  }
}

function drawChevron(g, W, H, dir) {
  line(g, W * 0.5, H * 0.5, W * 0.5, H, '#9aa1a8', W * 0.08);
  rr(g, W * 0.02, H * 0.05, W * 0.96, H * 0.5, W * 0.06, '#f4f4f4');
  rr(g, W * 0.02, H * 0.05, W * 0.96, H * 0.5, W * 0.06, 'rgba(0,0,0,0)');
  g.strokeStyle = '#d32f2f';
  g.lineWidth = W * 0.05;
  g.strokeRect(W * 0.04, H * 0.07, W * 0.92, H * 0.46);
  for (let i = 0; i < 2; i++) {
    const x = W * (0.3 + i * 0.3);
    const pts = dir > 0 ? [x - W * 0.1, H * 0.14, x + W * 0.08, H * 0.3, x - W * 0.1, H * 0.46] : [x + W * 0.1, H * 0.14, x - W * 0.08, H * 0.3, x + W * 0.1, H * 0.46];
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    g.lineTo(pts[2], pts[3]);
    g.lineTo(pts[4], pts[5]);
    g.strokeStyle = '#d32f2f';
    g.lineWidth = W * 0.09;
    g.stroke();
  }
}

function drawBillboard(g, W, H) {
  for (const x of [0.2, 0.8]) rr(g, W * x - W * 0.02, H * 0.5, W * 0.04, H * 0.5, 2, '#5b6470');
  rr(g, W * 0.02, H * 0.04, W * 0.96, H * 0.56, W * 0.03, '#0d1426');
  rr(g, W * 0.04, H * 0.07, W * 0.92, H * 0.5, W * 0.025, lin(g, 0, 0, W, 0, [[0, '#ff3b6b'], [1, '#ff8a1f']]));
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `italic 800 ${Math.round(H * 0.2)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.fillText('BROMMER', W * 0.5, H * 0.23);
  g.fillStyle = '#ffe14d';
  g.font = `italic 800 ${Math.round(H * 0.14)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.fillText('& THE FINISH', W * 0.5, H * 0.44);
}

function drawCone(g, W, H) {
  rr(g, W * 0.05, H * 0.88, W * 0.9, H * 0.12, 2, '#e65100');
  poly(g, [W * 0.2, H * 0.9, W * 0.8, H * 0.9, W * 0.56, H * 0.04, W * 0.44, H * 0.04], '#ff6d00');
  poly(g, [W * 0.3, H * 0.62, W * 0.7, H * 0.62, W * 0.64, H * 0.44, W * 0.36, H * 0.44], '#f5f5f5');
  poly(g, [W * 0.4, H * 0.28, W * 0.6, H * 0.28, W * 0.57, H * 0.18, W * 0.43, H * 0.18], '#f5f5f5');
}

function drawBarrier(g, W, H) {
  for (const x of [0.12, 0.88]) {
    line(g, W * x, H * 0.3, W * (x - 0.06), H, '#444', W * 0.025);
    line(g, W * x, H * 0.3, W * (x + 0.06), H, '#444', W * 0.025);
  }
  g.save();
  g.beginPath();
  g.roundRect(W * 0.02, H * 0.3, W * 0.96, H * 0.32, H * 0.04);
  g.clip();
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#e53935';
  for (let x = -W; x < W * 1.2; x += W * 0.14) {
    g.beginPath();
    g.moveTo(x, H * 0.62);
    g.lineTo(x + W * 0.07, H * 0.62);
    g.lineTo(x + W * 0.07 + H * 0.32, H * 0.3);
    g.lineTo(x + H * 0.32, H * 0.3);
    g.fill();
  }
  g.restore();
  ell(g, W * 0.12, H * 0.2, W * 0.05, W * 0.05, '#ffb300');
  ell(g, W * 0.88, H * 0.2, W * 0.05, W * 0.05, '#ffb300');
}

function drawPuddle(g, W, H) {
  ell(g, W / 2, H / 2, W * 0.49, H * 0.46, 'rgba(60, 110, 170, 0.75)');
  ell(g, W * 0.46, H * 0.44, W * 0.34, H * 0.28, 'rgba(120, 175, 230, 0.7)');
  ell(g, W * 0.38, H * 0.36, W * 0.12, H * 0.1, 'rgba(230, 245, 255, 0.8)');
}

function drawTractor(g, W, H, v) {
  const body = ['#2e7d32', '#e65100', '#c62828', '#1565c0'][v % 4];
  // Seen from behind: big rear tyres, cab, exhaust.
  rr(g, W * 0.3, H * 0.28, W * 0.4, H * 0.42, W * 0.04, body);
  rr(g, W * 0.32, H * 0.04, W * 0.36, H * 0.3, W * 0.03, '#263238');
  rr(g, W * 0.35, H * 0.07, W * 0.3, H * 0.22, W * 0.02, 'rgba(160, 210, 240, 0.85)');
  rr(g, W * 0.3, H * 0.02, W * 0.4, H * 0.04, 3, body);
  line(g, W * 0.72, H * 0.4, W * 0.72, H * 0.06, '#555', W * 0.03);
  for (const x of [0.02, 0.7]) {
    rr(g, W * x, H * 0.4, W * 0.28, H * 0.6, W * 0.06, '#1b1b1b');
    for (let k = 0; k < 6; k++) rr(g, W * (x + 0.02), H * (0.44 + k * 0.09), W * 0.24, H * 0.03, 2, '#333');
    rr(g, W * (x + 0.08), H * 0.6, W * 0.12, H * 0.2, 3, '#f9a825');
  }
  rr(g, W * 0.4, H * 0.62, W * 0.2, H * 0.1, 2, '#222');
  ell(g, W * 0.36, H * 0.66, W * 0.03, W * 0.03, '#ff5252');
  ell(g, W * 0.64, H * 0.66, W * 0.03, W * 0.03, '#ff5252');
  rr(g, W * 0.44, H * 0.74, W * 0.12, H * 0.08, 2, '#ff9800');
}

function drawCoin(g, W, H) {
  ell(g, W / 2, H / 2, W * 0.48, H * 0.48, '#b07d12');
  ell(g, W / 2 - W * 0.03, H / 2, W * 0.44, H * 0.46, '#f5c542');
  ell(g, W / 2 - W * 0.03, H / 2, W * 0.3, H * 0.32, '#e0ac25');
  ell(g, W * 0.38, H * 0.32, W * 0.1, H * 0.12, '#fff6c8');
}

// kind: [world width, world height, render height px, variants, draw]
const KINDS = {
  tree: [2800, 4000, 220, 3, drawTree],
  poplar: [1500, 6200, 260, 3, drawPoplar],
  pine: [2400, 5200, 240, 3, drawPine],
  oak: [4200, 5000, 240, 3, drawOak],
  bush: [1800, 1000, 90, 3, drawBush],
  reed: [900, 1000, 90, 3, drawReed],
  mushroom: [900, 900, 96, 1, drawMushroom],
  log: [1700, 520, 60, 1, drawLog],
  rock: [1300, 900, 80, 1, drawRock],
  deer: [1300, 1400, 120, 1, drawDeer],
  windmill: [3600, 7600, 320, 1, drawWindmill],
  sails: [7200, 7200, 300, 1, drawSails],
  farm: [6000, 3600, 200, 4, drawFarm],
  cow: [1500, 1000, 100, 2, drawCow],
  sheep: [900, 650, 80, 2, drawSheep],
  fence: [1800, 650, 60, 1, drawFence],
  bike: [1100, 700, 70, 5, drawBike],
  bikes: [2600, 700, 80, 3, drawBikes],
  house: [3600, 6000, 300, 8, drawHouse],
  lamp: [700, 3300, 200, 1, drawLamp],
  bench: [1200, 560, 60, 1, drawBench],
  planter: [1500, 2600, 160, 3, drawPlanter],
  church: [3400, 11000, 360, 1, drawChurch],
  dunegrass: [1400, 900, 90, 3, drawDuneGrass],
  hut: [1500, 1700, 140, 6, drawHut],
  parasol: [1600, 1600, 130, 4, drawParasol],
  lifeguard: [1900, 3200, 200, 1, drawLifeguard],
  lighthouse: [2400, 9600, 360, 1, drawLighthouse],
  flag: [560, 1900, 120, 6, drawFlag],
  crowd: [2200, 1100, 110, 4, drawCrowd],
  chevronL: [620, 700, 90, 1, (g, W, H) => drawChevron(g, W, H, -1)],
  chevronR: [620, 700, 90, 1, (g, W, H) => drawChevron(g, W, H, 1)],
  billboard: [4200, 2600, 200, 1, drawBillboard],
  cone: [300, 460, 64, 1, drawCone],
  barrier: [1700, 800, 110, 1, drawBarrier],
  puddle: [900, 900, 120, 1, drawPuddle],
  tractor: [1250, 1900, 220, 4, drawTractor],
  coin: [340, 340, 64, 1, drawCoin],
};

// ------------------------------------------------------------------ mopeds (rear view)
// Drawn in a W x H box with the tyre contact point at the bottom centre.
export const MOPED_W = 560, MOPED_H = 900;

export function drawMoped(g, W, H, o) {
  const body = o.color;
  const dark = shade(body, -0.35);
  const light = shade(body, 0.3);
  const X = (u) => u * W, Y = (v) => v * H;
  // Mirrors and handlebar ends stick out at the sides.
  line(g, X(0.2), Y(0.43), X(0.09), Y(0.25), '#3a3f47', W * 0.022);
  line(g, X(0.8), Y(0.43), X(0.91), Y(0.25), '#3a3f47', W * 0.022);
  ell(g, X(0.08), Y(0.23), W * 0.055, H * 0.035, '#20242b');
  ell(g, X(0.92), Y(0.23), W * 0.055, H * 0.035, '#20242b');
  ell(g, X(0.08), Y(0.23), W * 0.035, H * 0.022, '#9fb4c8');
  ell(g, X(0.92), Y(0.23), W * 0.035, H * 0.022, '#9fb4c8');
  // Tyre.
  rr(g, X(0.41), Y(0.76), X(0.18), Y(0.24), W * 0.07, '#17191d');
  rr(g, X(0.46), Y(0.78), X(0.03), Y(0.2), W * 0.02, '#2c2f35');
  // Legs, feet on the pegs.
  poly(g, [X(0.36), Y(0.5), X(0.46), Y(0.54), X(0.34), Y(0.8), X(0.22), Y(0.78)], '#2b3140');
  poly(g, [X(0.64), Y(0.5), X(0.54), Y(0.54), X(0.66), Y(0.8), X(0.78), Y(0.78)], '#2b3140');
  rr(g, X(0.17), Y(0.77), X(0.17), Y(0.06), W * 0.03, '#15171b');
  rr(g, X(0.66), Y(0.77), X(0.17), Y(0.06), W * 0.03, '#15171b');
  // Rear bodywork per style.
  if (o.style === 'scooter') {
    g.beginPath();
    g.ellipse(X(0.5), Y(0.66), W * 0.25, H * 0.13, 0, 0, Math.PI * 2);
    g.fillStyle = lin(g, X(0.25), 0, X(0.75), 0, [[0, dark], [0.35, body], [0.6, light], [1, dark]]);
    g.fill();
    rr(g, X(0.38), Y(0.6), X(0.24), Y(0.05), W * 0.03, '#ff3b3b');
  } else if (o.style === 'sport') {
    poly(g, [X(0.36), Y(0.76), X(0.64), Y(0.76), X(0.6), Y(0.52), X(0.4), Y(0.52)], body);
    poly(g, [X(0.47), Y(0.76), X(0.53), Y(0.76), X(0.52), Y(0.52), X(0.48), Y(0.52)], light);
    poly(g, [X(0.33), Y(0.54), X(0.67), Y(0.54), X(0.62), Y(0.49), X(0.38), Y(0.49)], dark);
    rr(g, X(0.38), Y(0.64), X(0.08), Y(0.035), 3, '#ff3b3b');
    rr(g, X(0.54), Y(0.64), X(0.08), Y(0.035), 3, '#ff3b3b');
  } else {
    // Classic: slim frame, luggage rack, round light.
    line(g, X(0.38), Y(0.56), X(0.44), Y(0.76), '#50565f', W * 0.03);
    line(g, X(0.62), Y(0.56), X(0.56), Y(0.76), '#50565f', W * 0.03);
    rr(g, X(0.34), Y(0.55), X(0.32), Y(0.04), 3, '#8b929c');
    rr(g, X(0.37), Y(0.6), X(0.26), Y(0.08), W * 0.03, body);
    ell(g, X(0.5), Y(0.7), W * 0.05, W * 0.05, '#ff3b3b');
  }
  // Mudguard + number plate.
  g.beginPath();
  g.ellipse(X(0.5), Y(0.79), W * 0.12, H * 0.05, 0, Math.PI, 0);
  g.fillStyle = dark;
  g.fill();
  rr(g, X(0.42), Y(0.79), X(0.16), Y(0.055), 2, '#f5d33a');
  g.strokeStyle = '#333';
  g.lineWidth = W * 0.008;
  g.strokeRect(X(0.42), Y(0.79), X(0.16), Y(0.055));
  // Torso (jacket) and arms reaching for the grips.
  const jacket = o.jacket || body;
  poly(g, [X(0.29), Y(0.24), X(0.71), Y(0.24), X(0.66), Y(0.54), X(0.34), Y(0.54)], jacket);
  poly(g, [X(0.29), Y(0.24), X(0.4), Y(0.24), X(0.4), Y(0.54), X(0.34), Y(0.54)], shade(jacket, -0.18));
  poly(g, [X(0.6), Y(0.24), X(0.71), Y(0.24), X(0.66), Y(0.54), X(0.6), Y(0.54)], shade(jacket, 0.12));
  rr(g, X(0.34), Y(0.36), X(0.32), Y(0.035), 2, 'rgba(255,255,255,0.85)');
  line(g, X(0.31), Y(0.27), X(0.2), Y(0.42), jacket, W * 0.075);
  line(g, X(0.69), Y(0.27), X(0.8), Y(0.42), jacket, W * 0.075);
  ell(g, X(0.19), Y(0.43), W * 0.045, W * 0.045, '#1d1f24');
  ell(g, X(0.81), Y(0.43), W * 0.045, W * 0.045, '#1d1f24');
  // Helmet.
  const hc = o.helmet;
  ell(g, X(0.5), Y(0.2), W * 0.08, H * 0.03, '#2b2b2b');
  ell(g, X(0.5), Y(0.13), W * 0.15, W * 0.16, hc);
  g.save();
  g.beginPath();
  g.ellipse(X(0.5), Y(0.13), W * 0.15, W * 0.16, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = shade(hc, -0.2);
  g.fillRect(X(0.56), Y(0.0), W * 0.2, H * 0.3);
  g.fillStyle = hc === '#f8fafc' ? '#ff3b6b' : '#ffffff';
  g.fillRect(X(0.47), Y(0.0), W * 0.06, H * 0.3);
  g.restore();
  ell(g, X(0.44), Y(0.08), W * 0.04, W * 0.03, 'rgba(255,255,255,0.45)');
  // Boss accessories.
  if (o.hat === 'straw') {
    ell(g, X(0.5), Y(0.07), W * 0.3, H * 0.04, '#e8c26b');
    ell(g, X(0.5), Y(0.045), W * 0.16, H * 0.05, '#f0d27f');
    rr(g, X(0.36), Y(0.055), X(0.28), Y(0.02), 2, '#b5452e');
  } else if (o.hat === 'flower') {
    line(g, X(0.5), Y(0.05), X(0.56), Y(-0.0) + H * 0.01, '#2e7d32', W * 0.03);
    ell(g, X(0.57), Y(0.02), W * 0.07, W * 0.06, '#ff3355');
    ell(g, X(0.57), Y(0.02), W * 0.025, W * 0.025, '#ffd23f');
  } else if (o.hat === 'chain') {
    g.strokeStyle = '#f5c542';
    g.lineWidth = W * 0.025;
    g.beginPath();
    g.ellipse(X(0.5), Y(0.26), W * 0.16, H * 0.06, 0, 0, Math.PI);
    g.stroke();
    ell(g, X(0.5), Y(0.32), W * 0.04, W * 0.04, '#f5c542');
  } else if (o.hat === 'shades') {
    rr(g, X(0.62), Y(0.16), X(0.14), Y(0.4), W * 0.05, '#35b6ff');
    rr(g, X(0.66), Y(0.18), X(0.06), Y(0.36), W * 0.03, '#fff');
  } else if (o.hat === 'crown') {
    poly(g, [X(0.38), Y(0.05), X(0.62), Y(0.05), X(0.64), Y(-0.0) + H * 0.005, X(0.57), Y(0.03), X(0.5), Y(0.0) + H * 0.002, X(0.43), Y(0.03), X(0.36), Y(0.005)], '#f5c542');
    ell(g, X(0.5), Y(0.035), W * 0.02, W * 0.02, '#ff3355');
  }
}

// ------------------------------------------------------------------ bank
export class SpriteBank {
  constructor() {
    this.cache = new Map();
    this.lite = false;
  }

  // Returns { img, w, h } where w/h are world units.
  get(kind, v = 0) {
    const def = KINDS[kind];
    if (!def) return null;
    const vi = def[3] > 1 ? v % def[3] : 0;
    const key = kind + ':' + vi;
    let s = this.cache.get(key);
    if (!s) {
      const [w, h, px, , draw] = def;
      const ph = this.lite ? px * 0.6 : px;
      const img = mk((ph * w) / h, ph, (g, W, H) => draw(g, W, H, vi));
      s = { img, w, h };
      this.cache.set(key, s);
    }
    return s;
  }

  moped(r) {
    const key = `m:${r.color}:${r.helmet}:${r.style}:${r.hat || ''}:${r.isPlayer ? 1 : 0}`;
    let s = this.cache.get(key);
    if (!s) {
      const ph = r.isPlayer ? 380 : this.lite ? 150 : 240;
      const img = mk((ph * MOPED_W) / MOPED_H, ph, (g, W, H) => drawMoped(g, W, H, r));
      s = { img, w: MOPED_W, h: MOPED_H };
      this.cache.set(key, s);
    }
    return s;
  }

  // Text in the billboard needs the web font; redraw once it has loaded.
  refresh() {
    for (const k of [...this.cache.keys()]) if (k.startsWith('billboard')) this.cache.delete(k);
  }
}

// Side-view moped for the garage cards. Shapes are SVG paths in a 200 x 114
// box, scaled to the canvas.
const SIDE = {
  klassiek: [
    ['s', '#c9d1db', 4.5, 'M92 88C70 94 40 92 22 86'],
    ['f', '#c9d1db', 0, 'M16 80h26a4.5 4.5 0 0 1 0 9H16a4.5 4.5 0 0 1 0-9z'],
    ['wheel', 50, 84, 22, 'spokes'],
    ['wheel', 154, 84, 22, 'spokes'],
    ['s', '#3b4250', 5, 'M50 84L86 64'],
    ['s', 'body', 5, 'M24 74A28 28 0 0 1 72 64'],
    ['s', '#3b4250', 6, 'M134 38C124 52 108 62 94 76'],
    ['s', '#3b4250', 5, 'M72 48L92 76'],
    ['f', '#5b6270', 0, 'M87 64h20a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H87a5 5 0 0 1-5-5V69a5 5 0 0 1 5-5z'],
    ['s', '#8b94a4', 2.5, 'M88 67v16M94 67v16M100 67v16M106 67v16'],
    ['f', '#2a2e35', 0, 'M98 81a5 5 0 1 1 0 10a5 5 0 1 1 0-10z'],
    ['s', '#8b929c', 3.5, 'M98 86L108 98'],
    ['f', '#23262c', 0, 'M104 96h10v4h-10z'],
    ['s', '#c9d1db', 4, 'M14 46H56'],
    ['s', '#c9d1db', 3, 'M22 46L50 84M40 46L50 62'],
    ['f', '#ff3b3b', 0, 'M10 40h10v8H10z'],
    ['f', 'body', 0, 'M88 56C92 44 116 38 130 44C126 54 104 60 88 56Z'],
    ['s', 'light', 3, 'M96 50C104 45 116 43 124 45'],
    ['f', '#23262c', 0, 'M42 46C44 38 80 36 90 44L88 50C74 52 54 52 44 51Z'],
    ['s', 'rgba(255,255,255,0.18)', 2, 'M50 42C60 39 76 39 84 42'],
    ['s', '#c9d1db', 5, 'M136 36L154 84'],
    ['s', 'body', 5, 'M134 72A26 26 0 0 1 176 74'],
    ['s', '#23262c', 4, 'M134 34C130 24 122 18 114 16'],
    ['s', '#111111', 6, 'M116 16L106 15'],
    ['s', '#3a3f47', 2.5, 'M124 22L118 7'],
    ['f', '#20242b', 0, 'M112 5a5 3.5 0 1 0 10 0a5 3.5 0 1 0-10 0z'],
    ['f', '#c9d1db', 0, 'M136 32a8 8 0 1 0 16 0a8 8 0 1 0-16 0z'],
    ['f', '#fff6c8', 0, 'M139.5 32a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0z'],
  ],
  scooter: [
    ['s', '#c9d1db', 5, 'M62 97L30 97'],
    ['f', '#c9d1db', 0, 'M22 92h14a4.5 4.5 0 0 1 0 9H22a4.5 4.5 0 0 1 0-9z'],
    ['wheel', 48, 88, 18, 'disc'],
    ['wheel', 156, 88, 18, 'disc'],
    ['f', 'bodyg', 0, 'M10 76C6 54 24 40 50 40L92 42C98 56 98 72 94 82L80 84C76 66 62 60 48 60C32 60 22 70 20 82L12 82Z'],
    ['s', 'light', 3, 'M20 50C30 44 60 42 88 44'],
    ['s', 'dark', 2, 'M58 60C68 52 84 52 92 60'],
    ['f', '#2b3140', 0, 'M92 80L124 80L126 88L90 88Z'],
    ['f', 'bodyg', 0, 'M122 88C130 66 132 40 138 20L150 16C156 40 150 68 140 88Z'],
    ['f', 'body', 0, 'M140 78C146 66 168 66 174 78L170 81C164 73 150 73 144 81Z'],
    ['f', '#23262c', 0, 'M22 40C24 30 78 28 90 36L90 42L24 44Z'],
    ['f', 'body', 0, 'M134 16C136 8 158 8 164 14L162 20L136 22Z'],
    ['f', '#fff6c8', 0, 'M157 17a5 5 0 1 0 10 0a5 5 0 1 0-10 0z'],
    ['s', '#111111', 5, 'M136 14L126 12'],
    ['s', '#3a3f47', 2.5, 'M142 11L136 3'],
    ['f', '#20242b', 0, 'M130 3a5 3 0 1 0 10 0a5 3 0 1 0-10 0z'],
    ['f', '#ff3b3b', 0, 'M6 58h8v10H6z'],
  ],
  sport: [
    ['s', '#3b4250', 6, 'M48 85L92 74'],
    ['s', '#c9d1db', 5, 'M92 80C70 78 50 68 34 56'],
    ['s', '#23262c', 7, 'M34 56L28 50'],
    ['wheel', 48, 85, 21, 'star'],
    ['wheel', 156, 85, 21, 'star'],
    ['f', '#3b4250', 0, 'M88 62h24a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H88a4 4 0 0 1-4-4V66a4 4 0 0 1 4-4z'],
    ['s', '#c9d1db', 5, 'M158 40L156 85'],
    ['f', 'body', 0, 'M138 70C146 60 166 60 174 70L170 73C162 66 150 66 142 73Z'],
    ['f', 'bodyg', 0, 'M92 56L26 36C20 36 18 44 24 46L90 70Z'],
    ['f', '#23262c', 0, 'M40 40C54 34 76 36 94 44L92 50L44 46Z'],
    ['f', 'light', 0, 'M92 52C98 38 122 34 138 38L126 56Z'],
    ['f', 'bodyg', 0, 'M100 78L130 80C150 78 170 62 172 46L164 34C150 30 132 34 122 44C114 52 106 62 100 78Z'],
    ['f', 'rgba(160,210,240,0.75)', 0, 'M162 34C158 20 150 16 140 16L144 32Z'],
    ['s', '#111111', 4, 'M140 32L128 34'],
    ['s', 'light', 4, 'M110 66C130 64 150 58 164 46'],
    ['f', '#f8fafc', 0, 'M127 58a11 9 0 1 0 22 0a11 9 0 1 0-22 0z'],
    ['num', 138, 62],
    ['f', '#fff6c8', 0, 'M164 44a4 4 0 1 0 8 0a4 4 0 1 0-8 0z'],
    ['f', '#ff3b3b', 0, 'M20 38h8v5h-8z'],
  ],
};
const NUMBERS = { bliksem: '3', raket: '7', goud: '1' };

export function drawMopedSide(canvas, m, color) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const body = color || m.color;
  const cols = { body, dark: shade(body, -0.35), light: shade(body, 0.35) };
  const sc = Math.min(W / 200, H / 114);
  g.save();
  g.translate((W - 200 * sc) / 2, (H - 114 * sc) / 2);
  g.scale(sc, sc);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Shadow.
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(102, 108, 88, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  const bodyGrad = g.createLinearGradient(0, 10, 0, 100);
  bodyGrad.addColorStop(0, cols.light);
  bodyGrad.addColorStop(0.45, body);
  bodyGrad.addColorStop(1, cols.dark);
  const paint = (c) => (c === 'bodyg' ? bodyGrad : cols[c] || c);
  for (const step of SIDE[m.style] || SIDE.klassiek) {
    const [op] = step;
    if (op === 'wheel') {
      const [, x, y, r, kind] = step;
      g.fillStyle = '#15171b';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      if (kind === 'spokes') {
        g.fillStyle = '#aeb6c0';
        g.beginPath();
        g.arc(x, y, r * 0.78, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#2a2e35';
        g.beginPath();
        g.arc(x, y, r * 0.7, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#c9d1db';
        g.lineWidth = 0.9;
        g.beginPath();
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6;
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
        }
        g.stroke();
      } else if (kind === 'disc') {
        g.fillStyle = '#aeb6c0';
        g.beginPath();
        g.arc(x, y, r * 0.66, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#6b7280';
        for (let k = 0; k < 5; k++) {
          const a = (k * Math.PI * 2) / 5;
          g.beginPath();
          g.arc(x + Math.cos(a) * r * 0.38, y + Math.sin(a) * r * 0.38, r * 0.11, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.fillStyle = '#2a2e35';
        g.beginPath();
        g.arc(x, y, r * 0.74, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = body;
        g.lineWidth = 3;
        g.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = (k * Math.PI * 2) / 5 - Math.PI / 2;
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
        }
        g.stroke();
      }
      g.fillStyle = '#d5dbe3';
      g.beginPath();
      g.arc(x, y, r * 0.18, 0, Math.PI * 2);
      g.fill();
    } else if (op === 'num') {
      g.fillStyle = '#111827';
      g.font = 'italic 800 14px "Barlow Condensed", "Arial Narrow", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(NUMBERS[m.id] || '5', step[1], step[2] + 1);
    } else {
      const [, c, lw, d] = step;
      const p = new Path2D(d);
      if (op === 'f') {
        g.fillStyle = paint(c);
        g.fill(p);
      } else {
        g.strokeStyle = paint(c);
        g.lineWidth = lw;
        g.stroke(p);
      }
    }
  }
  g.restore();
}
