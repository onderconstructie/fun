// Appearance for the player sprites: skin tone, hair, beard, preferred foot
// and boot colour. Every card carries its own look code (see players.js);
// the user's custom players and anything unknown get a neutral default.
//
// Look code: 'skin hair colour [b1|b2] [L]'
//   skin 1 (lightest) .. 6 (darkest)
//   hair: bald buzz short swept crop curly afro long bun dreads twists
//   colour: k black, d dark brown, b brown, l blond, p platinum, r ginger, g grey
//   b1 stubble, b2 beard, L left-footed

export const SKINS = ['#f2d3bc', '#e3b48f', '#c98f63', '#a86d45', '#83502f', '#5a341f'];
export const HAIR_COLORS = { k: '#15100d', d: '#3a2417', b: '#6a4424', l: '#caa25b', p: '#e8d8ae', r: '#a24b22', g: '#9b9b9b' };
const BOOTS = ['#111827', '#f8fafc', '#facc15', '#22d3ee', '#fb7185', '#a3e635', '#f97316', '#e11d48', '#6366f1', '#10b981'];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const DEFAULT_HAIR = ['short', 'short', 'swept', 'buzz', 'crop'];

// Resolved look for a player card: colours ready for drawing.
export function lookFor(card) {
  const id = (card && card.id) || '';
  const h = hash(id);
  let skin = 3, hair = DEFAULT_HAIR[h % DEFAULT_HAIR.length], color = 'd', beard = 0, left = false;
  const spec = card && card.look;
  if (spec) {
    const t = spec.split(' ');
    skin = +t[0] || 3;
    hair = t[1] || hair;
    color = t[2] || color;
    for (const x of t.slice(3)) {
      if (x === 'L') left = true;
      else if (x[0] === 'b') beard = +x[1];
    }
  }
  return {
    skin: SKINS[Math.max(1, Math.min(6, skin)) - 1],
    hair,
    hairColor: HAIR_COLORS[color] || HAIR_COLORS.d,
    beard,
    left,
    boots: BOOTS[(h >>> 8) % BOOTS.length],
  };
}
