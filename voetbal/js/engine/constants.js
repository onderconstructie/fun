// Pitch geometry (metres) and physics constants.
// World: x along the pitch (0..105, left goal at x=0), y across (0 = far
// touchline, 68 = near touchline, closest to the broadcast camera), z up.

export const L = 105;
export const W = 68;
export const CX = L / 2;
export const CY = W / 2;

export const GOAL_HW = 3.66;
export const GOAL_H = 2.44;
export const GOAL_D = 2.0;
export const POST_R = 0.06;
export const BALL_R = 0.11;

export const BOX_D = 16.5;
export const BOX_HW = 20.16;
export const SIX_D = 5.5;
export const SIX_HW = 9.16;
export const PEN_D = 11;
export const CIRCLE_R = 9.15;

export const G = 9.81;
export const STEP = 1 / 60;

export const PHYS = {
  airDrag: 0.0095, // quadratic drag coefficient per metre
  rollDecel: 1.6, // rolling resistance, m/s^2
  restitution: 0.5,
  bounceFriction: 0.8,
  bounceMin: 1.2,
  spinDecay: 0.45,
  boardX: 6, // ad boards distance behind goal lines
  boardY: 5, // ad boards distance beyond touchlines
};

export const HALF_GAME_SECONDS = 45 * 60;
