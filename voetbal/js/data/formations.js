// Formations: slots with a role label, depth d (0 = back line, 1 = front line)
// and lateral position l (0 = left, 1 = right, from the team's own view).
// Slot 0 is always the goalkeeper.

const S = (pos, d, l) => ({ pos, d, l });
const GK = S('GK', -1, 0.5);
const BACK4 = [S('LB', 0.04, 0.1), S('CB', 0, 0.37), S('CB', 0, 0.63), S('RB', 0.04, 0.9)];
const BACK3 = [S('CB', 0, 0.24), S('CB', 0, 0.5), S('CB', 0, 0.76)];

export const FORMATIONS = {
  '4-3-3': [GK, ...BACK4, S('CM', 0.45, 0.3), S('CDM', 0.3, 0.5), S('CM', 0.45, 0.7), S('LW', 0.88, 0.13), S('ST', 1, 0.5), S('RW', 0.88, 0.87)],
  '4-4-2': [GK, ...BACK4, S('LM', 0.5, 0.1), S('CM', 0.42, 0.38), S('CM', 0.42, 0.62), S('RM', 0.5, 0.9), S('ST', 1, 0.4), S('ST', 1, 0.6)],
  '4-2-3-1': [GK, ...BACK4, S('CDM', 0.3, 0.38), S('CDM', 0.3, 0.62), S('LW', 0.76, 0.12), S('CAM', 0.72, 0.5), S('RW', 0.76, 0.88), S('ST', 1, 0.5)],
  '3-5-2': [GK, ...BACK3, S('LM', 0.48, 0.06), S('CM', 0.44, 0.33), S('CDM', 0.3, 0.5), S('CM', 0.44, 0.67), S('RM', 0.48, 0.94), S('ST', 1, 0.4), S('ST', 1, 0.6)],
  '3-4-3': [GK, ...BACK3, S('LM', 0.46, 0.07), S('CM', 0.4, 0.38), S('CM', 0.4, 0.62), S('RM', 0.46, 0.93), S('LW', 0.9, 0.16), S('ST', 1, 0.5), S('RW', 0.9, 0.84)],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

// Line (depth band) and side for each position, used for position fit.
const LINE = { GK: 0, CB: 1, LB: 1, RB: 1, CDM: 2, CM: 2.5, LM: 2.5, RM: 2.5, CAM: 3, LW: 3.5, RW: 3.5, ST: 4 };
const SIDE = { LB: -1, LM: -1, LW: -1, RB: 1, RM: 1, RW: 1 };

// OVR penalty when a player with position `pos` (+ alternatives) plays `slotPos`.
export function positionPenalty(pos, alt, slotPos) {
  if (pos === slotPos || (alt && alt.includes(slotPos))) return 0;
  if (pos === 'GK' || slotPos === 'GK') return 40;
  let best = 99;
  for (const p of [pos, ...(alt || [])]) {
    const dl = Math.abs(LINE[p] - LINE[slotPos]);
    const sa = SIDE[p] || 0, sb = SIDE[slotPos] || 0;
    let pen = dl * 4;
    if (sa && sb && sa !== sb) pen += 3;
    else if (sa !== sb) pen += 1;
    best = Math.min(best, Math.round(pen));
  }
  return Math.min(best, 15);
}

// Role groups used by AI and for auto-picking squads.
export function roleOf(pos) {
  if (pos === 'GK') return 'gk';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'def';
  if (pos === 'CDM' || pos === 'CM' || pos === 'LM' || pos === 'RM' || pos === 'CAM') return 'mid';
  return 'att';
}
