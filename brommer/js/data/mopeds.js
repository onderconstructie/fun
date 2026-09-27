// The garage: every moped you can ride. All names are made up for this game.
// top = top speed (km/u), accel = km/u per second from standstill,
// handling = steering multiplier, grab = how much speed you steal per bump.

export const MOPEDS = [
  { id: 'snorretje', name: 'Snorretje', style: 'klassiek', price: 0, top: 40, accel: 15, handling: 0.92, grab: 1.0, color: '#35b6ff', desc: 'Je eerste brommer. Klein, maar dapper.' },
  { id: 'zoemer', name: 'Zoemer', style: 'scooter', price: 900, top: 44, accel: 18, handling: 1.0, grab: 1.0, color: '#ffd23f', desc: 'Zoemt als een bij door de polder.' },
  { id: 'knetter', name: 'Knetter', style: 'klassiek', price: 2200, top: 48, accel: 19, handling: 0.98, grab: 1.15, color: '#ff6b35', desc: 'Knettert zo hard dat iedereen schrikt. Pakt extra veel snelheid.' },
  { id: 'bliksem', name: 'Bliksem', style: 'sport', price: 4000, top: 52, accel: 26, handling: 1.02, grab: 1.05, color: '#b8f000', desc: 'Schiet weg als een bliksemschicht.' },
  { id: 'wervelwind', name: 'Wervelwind', style: 'scooter', price: 6500, top: 56, accel: 23, handling: 1.16, grab: 1.1, color: '#2ee6c8', desc: 'Draait door elke bocht alsof het niks is.' },
  { id: 'donder', name: 'Donder', style: 'klassiek', price: 9500, top: 61, accel: 25, handling: 1.05, grab: 1.28, color: '#8b5cf6', desc: 'Zwaar en sterk. Wie je raakt, is zijn snelheid kwijt.' },
  { id: 'raket', name: 'Raket', style: 'sport', price: 14000, top: 66, accel: 29, handling: 1.1, grab: 1.15, color: '#ff3b6b', desc: 'Is het een brommer? Is het een raket? Allebei!' },
  { id: 'goud', name: 'Kampioen', style: 'sport', price: 22000, top: 72, accel: 32, handling: 1.2, grab: 1.35, color: '#f5c542', desc: 'Glimmend goud en de snelste van allemaal. Alleen voor echte kampioenen.' },
];

export const MOPED_BY_ID = Object.fromEntries(MOPEDS.map((m) => [m.id, m]));

// Stat bars (2..10) for the garage.
export function statBars(m) {
  const k = (v, a, b) => Math.max(2, Math.min(10, Math.round(2 + (8 * (v - a)) / (b - a))));
  return [
    ['Snelheid', k(m.top, 38, 72)],
    ['Optrekken', k(m.accel, 14, 32)],
    ['Sturen', k(m.handling, 0.9, 1.2)],
    ['Pakken', k(m.grab, 0.95, 1.35)],
  ];
}

// Paint colours to choose from in the garage (free).
export const PAINTS = ['#35b6ff', '#ff3b6b', '#ffd23f', '#b8f000', '#ff6b35', '#8b5cf6', '#2ee6c8', '#f8fafc', '#1f2937', '#f5c542'];
export const HELMETS = ['#f8fafc', '#1f2937', '#ff3b6b', '#35b6ff', '#ffd23f', '#b8f000', '#ff6b35', '#8b5cf6'];
