// Manillen: the results kept across games. No screen code here, so it can be tested.
// Only finished games count. Everything stays in this browser.

export const RECENT_MAX = 20;

const emptyMode = () => ({ won: 0, lost: 0, streak: 0, best: 0 });
export const emptyBoard = () => ({ v: 1, modes: { 2: emptyMode(), 4: emptyMode() }, recent: [] });

const count = (n) => (Number.isInteger(n) && n >= 0 ? n : 0);

// Whatever is in storage: keep what is usable, never crash on it.
export function normalize(x) {
  const b = emptyBoard();
  if (!x || x.v !== 1 || typeof x.modes !== 'object' || !x.modes) return b;
  for (const m of [2, 4]) {
    const s = x.modes[m];
    if (s) b.modes[m] = { won: count(s.won), lost: count(s.lost), streak: count(s.streak), best: count(s.best) };
  }
  if (Array.isArray(x.recent)) {
    b.recent = x.recent
      .filter((r) => r && (r.mode === 2 || r.mode === 4) && Array.isArray(r.scores) && r.scores.length === 2 && Array.isArray(r.log))
      .slice(0, RECENT_MAX);
  }
  return b;
}

// How many rounds of this game have been fully played.
export const roundsDone = (g) => (g.deal && g.deal.phase === 'end' ? g.dealNo : Math.max(0, g.dealNo - 1));

// Adds a finished game once, also when the end screen opens a second time.
export function recordGame(board, g, at = Date.now()) {
  if (!g.over || g.recorded) return false;
  const won = g.winner === 0;
  const s = board.modes[g.mode];
  if (won) {
    s.won++;
    s.streak++;
    s.best = Math.max(s.best, s.streak);
  } else {
    s.lost++;
    s.streak = 0;
  }
  board.recent.unshift({ id: g.id, at, mode: g.mode, won, scores: g.scores.slice(), target: g.rules.target, rounds: roundsDone(g), log: (g.log || []).slice() });
  board.recent.length = Math.min(board.recent.length, RECENT_MAX);
  g.recorded = true;
  return true;
}

export const hasResults = (board) => board.recent.length > 0 || [2, 4].some((m) => board.modes[m].won + board.modes[m].lost > 0);
