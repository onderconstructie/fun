// The levels are built from a seed, a shape and a colouring, so 30 levels fit
// in a few lines and always come out the same.

import { COLS, NCOLORS, STONE } from './engine.js';
import { makeRng, shuffle } from './util.js';

export const LEVEL_COUNT = 30;

const SHAPES = ['full', 'vee', 'diamond', 'zigzag', 'pillars', 'holes', 'hill', 'arch', 'checker', 'wave'];
const PAINTS = ['clumps', 'bands', 'columns', 'clumps', 'diagonal'];

const shifted = (r, parity) => ((r + parity) & 1) === 1;
const ncols = (r, parity) => (shifted(r, parity) ? COLS - 1 : COLS);

function inShape(shape, r, c, rows, n, rng) {
  const mid = (n - 1) / 2;
  const dx = Math.abs(c - mid);
  switch (shape) {
    case 'vee': // wide at the top, a point at the bottom
      return dx <= mid - r * (mid / rows) + 0.6;
    case 'diamond':
      return r < 2 || dx <= Math.min(r, rows - 1 - r) + 1.6;
    case 'zigzag':
      return r < 2 || (Math.floor(c / 3) + Math.floor(r / 2)) % 2 === 0;
    case 'pillars':
      return r < 2 || c % 4 !== 1;
    case 'holes':
      return r < 1 || rng() > 0.18;
    case 'hill':
      return dx <= 1.5 + (rows - r) * 0.9 || r < 2;
    case 'arch':
      return r < 2 || dx > 1.6 || r < rows - 3;
    case 'checker':
      return r < 2 || (Math.floor(c / 2) + r) % 2 === 0;
    case 'wave':
      return r < rows - 2 || Math.sin(c * 0.9) > -0.2;
    default:
      return true;
  }
}

function paint(kind, rows, parity, colors, rng) {
  let grid = rows.map((row) => row.slice());
  const pick = () => colors[Math.floor(rng() * colors.length)];
  if (kind === 'bands') {
    const order = shuffle(colors.slice(), rng);
    grid.forEach((row, r) => row.forEach((v, c) => v === 0 && (row[c] = order[Math.floor(r / 2) % order.length] + 1)));
  } else if (kind === 'columns') {
    const order = shuffle(colors.slice(), rng);
    grid.forEach((row, r) => row.forEach((v, c) => v === 0 && (row[c] = order[Math.floor((c + (r % 4 < 2 ? 0 : 1)) / 2) % order.length] + 1)));
  } else if (kind === 'diagonal') {
    const order = shuffle(colors.slice(), rng);
    grid.forEach((row, r) => row.forEach((v, c) => v === 0 && (row[c] = order[Math.floor((c + r) / 2) % order.length] + 1)));
  } else {
    // clumps: grow small blobs of 2 to 4 of one colour
    const free = [];
    grid.forEach((row, r) => row.forEach((v, c) => v === 0 && free.push([r, c])));
    shuffle(free, rng);
    for (const [r, c] of free) {
      if (grid[r][c] !== 0) continue;
      const col = pick() + 1;
      let size = 2 + Math.floor(rng() * 3);
      const stack = [[r, c]];
      while (stack.length && size > 0) {
        const [a, b] = stack.splice(Math.floor(rng() * stack.length), 1)[0];
        if (grid[a]?.[b] !== 0) continue;
        grid[a][b] = col;
        size--;
        for (const nb of nbrs(a, b, parity, grid.length)) stack.push(nb);
      }
    }
  }
  grid = grid.map((row) => row.map((v) => (v > 0 ? v - 1 : v)));
  anchor(grid, parity, colors, rng);
  return grid;
}

// The two rows under the ceiling get mixed colours (no two neighbours alike),
// so the field hangs on many separate points and one lucky shot cannot drop it all.
function anchor(grid, parity, colors, rng) {
  for (let r = 0; r < Math.min(2, grid.length); r++)
    for (let c = 0; c < ncols(r, parity); c++) {
      if (grid[r][c] < 0) continue;
      const taken = new Set(nbrs(r, c, parity, grid.length).filter(([a]) => a <= r).map(([a, b]) => grid[a][b]));
      if (!taken.has(grid[r][c])) continue;
      const ok = colors.filter((k) => !taken.has(k));
      if (ok.length) grid[r][c] = ok[Math.floor(rng() * ok.length)];
    }
}

function nbrs(r, c, parity, nrows) {
  const s = shifted(r, parity);
  const a = s ? c : c - 1;
  return [
    [r, c - 1],
    [r, c + 1],
    [r - 1, a],
    [r - 1, a + 1],
    [r + 1, a],
    [r + 1, a + 1],
  ].filter(([x, y]) => x >= 0 && x < nrows && y >= 0 && y < ncols(x, parity));
}

// Drop cells that would not hang from the ceiling.
function keepConnected(grid, parity) {
  const seen = new Set();
  const stack = [];
  grid[0].forEach((v, c) => v >= 0 && (seen.add(c), stack.push([0, c])));
  while (stack.length) {
    const [a, b] = stack.pop();
    for (const [x, y] of nbrs(a, b, parity, grid.length)) {
      const k = x * COLS + y;
      if (!seen.has(k) && grid[x][y] >= 0) seen.add(k), stack.push([x, y]);
    }
  }
  grid.forEach((row, r) => row.forEach((v, c) => v >= 0 && !seen.has(r * COLS + c) && (row[c] = -1)));
}

export function levelInfo(n) {
  // n: 1..LEVEL_COUNT
  const colorsN = n <= 3 ? 3 : n <= 10 ? 4 : n <= 20 ? 5 : NCOLORS;
  const rows = Math.min(9, 4 + Math.floor((n + 1) / 3));
  const stones = n < 9 ? 0 : Math.min(5, 1 + Math.floor((n - 9) / 3));
  const shape = n === 1 ? 'full' : SHAPES[(n - 1) % SHAPES.length];
  // Loose islands (zigzag, checker) hang on many points: those get one extra miss.
  const extra = shape === 'zigzag' || shape === 'checker' ? 1 : 0;
  const missLimit = (n <= 5 ? 7 : n <= 15 ? 6 : 5) + extra;
  return { colorsN, rows, stones, missLimit, shape };
}

export function makeLevel(n) {
  const rng = makeRng(n * 7919 + 1301);
  const info = levelInfo(n);
  const parity = 0;
  const shape = info.shape;
  const paintKind = n <= 2 ? 'bands' : PAINTS[(n * 3) % PAINTS.length];
  const colors = shuffle([...Array(NCOLORS).keys()], rng).slice(0, info.colorsN).sort();
  let grid = [];
  for (let r = 0; r < info.rows; r++) {
    const row = new Array(COLS).fill(-1);
    const nc = ncols(r, parity);
    for (let c = 0; c < nc; c++) if (inShape(shape, r, c, info.rows, nc, rng)) row[c] = 0;
    grid.push(row);
  }
  keepConnected(grid, parity);
  grid = paint(paintKind, grid, parity, colors, rng);
  // Stones only from row 2 down, so they always fall once the colour above them is gone.
  const spots = [];
  grid.forEach((row, r) => r >= 2 && row.forEach((v, c) => v >= 0 && spots.push([r, c])));
  shuffle(spots, rng)
    .slice(0, info.stones)
    .forEach(([r, c]) => (grid[r][c] = STONE));
  return { rows: grid, parity, colors, missLimit: info.missLimit, shape };
}

export function makeEndless(seed) {
  const rng = makeRng(seed);
  const colors = [0, 1, 2, 3];
  let grid = [];
  for (let r = 0; r < 6; r++) {
    const row = new Array(COLS).fill(-1);
    for (let c = 0; c < ncols(r, 0); c++) row[c] = 0;
    grid.push(row);
  }
  grid = paint('clumps', grid, 0, colors, rng);
  return { rows: grid, parity: 0, colors, missLimit: 7 };
}

// Stars: how many shots you needed. 3 stars = as good as a strong bot,
// 2 stars = as good as a casual one. Both numbers per level come from
// tools/bot.mjs (run it with PAR=1 after changing levels).
// prettier-ignore
export const PAR = [[19,22],[17,20],[17,21],[29,40],[28,38],[30,38],[26,31],[28,35],[30,38],[25,31],[46,58],[33,35],[39,46],[36,49],[36,50],[37,65],[40,56],[36,50],[41,70],[34,51],[39,48],[36,48],[42,50],[48,74],[42,50],[45,68],[51,66],[46,71],[58,81],[50,76]];

export function starsFor(n, shots) {
  const [three, two] = PAR[n - 1] || [0, 0];
  return shots <= three ? 3 : shots <= two ? 2 : 1;
}
