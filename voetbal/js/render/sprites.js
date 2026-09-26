// Procedural player and ball sprites, drawn as billboards at their foot point.

import { ST } from '../engine/player.js';

const SKIN = '#b98262';
const HAIR = '#1d1715';
const BOOT = '#111317';

const A = { x: 0, y: 0, s: 0, z: 0, ok: false };
const B = { x: 0, y: 0, s: 0, z: 0, ok: false };

// Screen-space basis at a world point: foot position, px per metre up, facing vector.
export function basis(cam, x, y, fx, fy, out) {
  if (!cam.project(x, y, 0, A)) return false;
  cam.project(x, y, 1, B);
  out.x = A.x;
  out.y = A.y;
  out.s = A.s;
  out.depth = A.z;
  out.u = Math.max(1, A.y - B.y); // vertical px per metre
  cam.project(x + fx, y + fy, 0, B);
  out.fx = B.x - A.x; // screen vector of 1 m facing
  out.fy = B.y - A.y;
  return true;
}

export function drawShadow(ctx, v, alpha = 0.32) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(v.x, v.y, 0.42 * v.s, 0.42 * v.s * (v.u / v.s) * 0.45 + 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

// kit: {shirt, shorts, socks, trim, pattern, pat}
export function drawPlayer(ctx, v, p, kit) {
  const s = v.s, u = v.u;
  const flen = Math.sqrt(v.fx * v.fx + v.fy * v.fy) || 1;
  const sfx = v.fx / flen; // screen facing unit
  const side = sfx >= 0 ? 1 : -1;
  const toward = v.fy / flen; // >0: facing the camera
  const speed = p.speedNow || 0;
  const state = p.state;

  ctx.save();
  ctx.translate(v.x, v.y - (p.z || 0) * u);

  if (state === ST.DOWN || state === ST.SLIDE) {
    ctx.rotate(side * (state === ST.DOWN ? 1.45 : 1.15));
    ctx.translate(0, state === ST.DOWN ? 0.1 * u : 0);
  } else if (state === ST.DIVE && p.diveAng !== undefined) {
    ctx.translate(0, -0.2 * u);
    ctx.rotate(p.diveAng);
  }

  // Leg swing.
  const stride = Math.min(1, speed / 6.5);
  const ph = p.anim || 0;
  let la = Math.sin(ph) * 0.3 * stride, lb = -la;
  let liftA = Math.max(0, Math.cos(ph)) * 0.14 * stride, liftB = Math.max(0, -Math.cos(ph)) * 0.14 * stride;
  if (state === ST.KICK || (p.kickT > 0 && state !== ST.DOWN)) {
    const k = 1 - Math.max(0, p.kickT) / 0.3;
    la = -0.25 + k * 0.75;
    liftA = 0.05 + Math.sin(k * Math.PI) * 0.3;
    lb = -0.05;
    liftB = 0;
  } else if (state === ST.TACKLE) {
    la = 0.55;
    liftA = 0.08;
    lb = -0.2;
  } else if (state === ST.SLIDE) {
    la = 0.5;
    lb = 0.35;
  } else if (state === ST.CELEBRATE && speed < 1) {
    la = 0.12;
    lb = -0.12;
  }

  const hipY = -0.9 * u, shY = -1.42 * u, headY = -1.62 * u;
  const lean = Math.min(0.12, speed * 0.016) * side * s + (state === ST.TACKLE ? side * 0.18 * s : 0);
  const hw = 0.085 * s; // half hip width
  const legW = Math.max(1.5, 0.15 * s);

  // Legs (socks colour), from hip to foot.
  const fxs = sfx * s, fys = (v.fy / flen) * s * 0.35;
  ctx.lineCap = 'round';
  ctx.lineWidth = legW;
  ctx.strokeStyle = kit.socks;
  ctx.beginPath();
  ctx.moveTo(-hw * side * 0.6, hipY);
  ctx.lineTo(la * fxs * side * side, -liftA * u + la * fys);
  ctx.moveTo(hw * side * 0.6, hipY);
  ctx.lineTo(lb * fxs * side * side, -liftB * u + lb * fys);
  ctx.stroke();
  // Boots.
  ctx.fillStyle = BOOT;
  const bs = Math.max(1, 0.07 * s);
  ctx.fillRect(la * fxs - bs, -liftA * u + la * fys - bs * 0.6, bs * 2, bs * 1.2);
  ctx.fillRect(lb * fxs - bs, -liftB * u + lb * fys - bs * 0.6, bs * 2, bs * 1.2);

  // Shorts.
  ctx.fillStyle = kit.shorts;
  const shortsTop = -1.0 * u, shortsBot = -0.72 * u;
  ctx.beginPath();
  ctx.moveTo(-0.17 * s + lean * 0.3, shortsTop);
  ctx.lineTo(0.17 * s + lean * 0.3, shortsTop);
  ctx.lineTo(0.2 * s, shortsBot);
  ctx.lineTo(-0.2 * s, shortsBot);
  ctx.closePath();
  ctx.fill();

  // Torso.
  const tw = 0.23 * s;
  ctx.fillStyle = kit.shirt;
  ctx.beginPath();
  ctx.moveTo(-tw * 0.9, -0.96 * u);
  ctx.lineTo(tw * 0.9, -0.96 * u);
  ctx.lineTo(tw + lean, shY);
  ctx.lineTo(-tw + lean, shY);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  if (kit.pattern === 'stripes' && kit.pat) {
    ctx.fillStyle = kit.pat;
    const sw = (tw * 2) / 5;
    for (let i = 1; i < 5; i += 2) {
      const x0 = -tw + i * sw;
      ctx.beginPath();
      ctx.moveTo(x0 * 0.9, -0.96 * u);
      ctx.lineTo((x0 + sw) * 0.9, -0.96 * u);
      ctx.lineTo(x0 + sw + lean, shY);
      ctx.lineTo(x0 + lean, shY);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kit.pattern === 'band' && kit.pat) {
    ctx.fillStyle = kit.pat;
    ctx.fillRect(-tw + lean * 0.7, -1.3 * u, tw * 2, 0.08 * u);
  } else if (kit.pattern === 'sash' && kit.pat) {
    ctx.fillStyle = kit.pat;
    ctx.beginPath();
    ctx.moveTo(-tw + lean, shY);
    ctx.lineTo(-tw * 0.4 + lean, shY);
    ctx.lineTo(tw * 0.9, -1.05 * u);
    ctx.lineTo(tw * 0.9, -0.96 * u - 0.08 * u);
    ctx.lineTo(tw * 0.5, -0.96 * u);
    ctx.closePath();
    ctx.fill();
  }
  // Collar / trim.
  ctx.fillStyle = kit.trim;
  ctx.fillRect(-tw * 0.45 + lean, shY - 0.02 * u, tw * 0.9, Math.max(1, 0.05 * u));

  // Arms.
  const armW = Math.max(1.2, 0.1 * s);
  ctx.lineWidth = armW;
  ctx.strokeStyle = kit.shirt;
  const ay = shY + 0.05 * u;
  let a1x, a1y, a2x, a2y;
  if (state === ST.CELEBRATE || state === ST.THROW) {
    a1x = -0.3 * s;
    a1y = -2.05 * u;
    a2x = 0.3 * s;
    a2y = -2.05 * u;
  } else if (state === ST.HOLD) {
    a1x = side * 0.3 * s;
    a1y = -1.1 * u;
    a2x = side * 0.34 * s;
    a2y = -1.12 * u;
  } else if (state === ST.DIVE) {
    a1x = -0.08 * s;
    a1y = -2.2 * u;
    a2x = 0.08 * s;
    a2y = -2.2 * u;
  } else {
    const sw = -la * 0.9;
    a1x = -0.26 * s + sw * fxs * 0.6;
    a1y = -0.98 * u;
    a2x = 0.26 * s - sw * fxs * 0.6;
    a2y = -0.98 * u;
  }
  ctx.beginPath();
  ctx.moveTo(-tw * 0.95 + lean, ay);
  ctx.lineTo(a1x + lean * 0.5, a1y);
  ctx.moveTo(tw * 0.95 + lean, ay);
  ctx.lineTo(a2x + lean * 0.5, a2y);
  ctx.stroke();
  // Hands (gloves for keepers).
  ctx.fillStyle = p.isGK ? '#f1f5f9' : SKIN;
  const hr = Math.max(0.8, 0.055 * s);
  ctx.beginPath();
  ctx.arc(a1x + lean * 0.5, a1y, hr, 0, Math.PI * 2);
  ctx.arc(a2x + lean * 0.5, a2y, hr, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  const hr2 = Math.max(1.6, 0.125 * u);
  const hx = lean * 1.1;
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(hx, headY, hr2, 0, Math.PI * 2);
  ctx.fill();
  // Hair: covers the back of the head; more when facing away.
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  if (toward < -0.3) {
    ctx.arc(hx, headY, hr2 * 1.02, 0, Math.PI * 2);
  } else {
    ctx.arc(hx - side * hr2 * 0.15, headY - hr2 * 0.1, hr2 * 1.02, Math.PI * (side > 0 ? 0.85 : -0.15), Math.PI * (side > 0 ? 2.15 : 1.15));
  }
  ctx.fill();
  ctx.restore();
}

export function drawBall(ctx, cam, x, y, z, rot, big = 1) {
  if (!cam.project(x, y, 0, A)) return;
  const s = A.s;
  // Shadow shrinks and fades with height.
  const hf = Math.max(0.35, 1 - z / 8);
  ctx.fillStyle = `rgba(0,0,0,${0.35 * hf})`;
  ctx.beginPath();
  ctx.ellipse(A.x, A.y, 0.2 * s * hf * big, 0.08 * s * hf * big + 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!cam.project(x, y, z + 0.11, B)) return;
  const r = Math.max(2.4, 0.2 * B.s * big);
  const g = ctx.createRadialGradient(B.x - r * 0.35, B.y - r * 0.35, r * 0.1, B.x, B.y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#c9ced6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(B.x, B.y, r, 0, Math.PI * 2);
  ctx.fill();
  // Rotating panels.
  ctx.fillStyle = '#1f2937';
  const a = rot % (Math.PI * 2);
  for (let i = 0; i < 3; i++) {
    const ang = a + (i * Math.PI * 2) / 3;
    const px = B.x + Math.cos(ang) * r * 0.5, py = B.y + Math.sin(ang) * r * 0.35;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
}
