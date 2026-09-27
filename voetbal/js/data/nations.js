// Nations of the game's own football world: Dutch names, flags (SVG, viewBox
// 0 0 30 20) and kits. All of them are fictional and designed for this game;
// none copies a real country, flag or federation.

const star = (cx, cy, r, fill) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
};
const field = (c) => `<rect width="30" height="20" fill="${c}"/>`;

const FLAGS = {
  // Main nations (full national teams).
  ALD: field('#F4EFE3') + '<path d="M0 15L22.5 0H30V5L7.5 20H0Z" fill="#B0203A"/><circle cx="6" cy="5.2" r="2.8" fill="#E0A526"/>',
  BRV: '<path d="M0 0H30L0 20Z" fill="#1D2B5E"/><path d="M30 0V20H0Z" fill="#F0705A"/>' + star(8, 6.4, 3, '#FFFFFF'),
  CVR:
    field('#0E7C7B') +
    '<rect width="8" height="20" fill="#F28C28"/><circle cx="19" cy="10" r="4.2" fill="none" stroke="#FFFFFF" stroke-width="1.6"/><circle cx="19" cy="10" r="1.6" fill="#F28C28"/>',
  DMR: field('#145A32') + '<circle cx="15" cy="10" r="5.6" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>' + star(15, 10, 2.6, '#D4AF37'),
  ESR: '<rect width="15" height="20" fill="#6EC1E4"/><rect x="15" width="15" height="20" fill="#7A1F3D"/>' + star(15, 10, 3.6, '#FFFFFF'),
  GAV: field('#23272E') + '<path d="M0 0L13 10 0 20Z" fill="#9BD13F"/><rect x="13" y="9.3" width="17" height="1.4" fill="#FFFFFF"/>',
  HLS:
    field('#5B2A86') +
    '<rect y="7" width="30" height="6" fill="#F2B705"/><path d="M0 10Q3.75 8 7.5 10T15 10T22.5 10T30 10" fill="none" stroke="#FFFFFF" stroke-width="1"/>',
  KDV: field('#2E5E8C') + '<circle cx="6.5" cy="6" r="3.2" fill="#C8323C"/><rect y="13" width="30" height="1.3" fill="#FFFFFF"/><rect y="15.8" width="30" height="1.3" fill="#FFFFFF"/>',
  MRD: field('#F07F1A') + '<path d="M0 8L12 20H0Z" fill="#1B2F5B"/>' + star(3.8, 15.6, 2.1, '#FFFFFF'),
  NRV: field('#A9D6F5') + '<path d="M0 16L7 8 12 13 18 5 25 12 30 9V16Z" fill="#FFFFFF"/><rect y="16" width="30" height="4" fill="#173A63"/>',
  TAV: field('#6D1A36') + '<path d="M0 0H7L30 15.3V20H23L0 4.7Z" fill="#8ECAE6"/><circle cx="15" cy="10" r="2.6" fill="#FFFFFF"/>',
  // Smaller nations (players only; their best form the all-star side).
  PVN:
    field('#0F5B45') +
    '<circle cx="15" cy="10" r="5.4" fill="none" stroke="#E8B535" stroke-width="1.4"/><circle cx="15" cy="10" r="3.2" fill="#20A39E"/><circle cx="15" cy="10" r="1.4" fill="#10264A"/>',
  ZRK: field('#1BA3A3') + '<path d="M0 0H6L30 14V20H24L0 6Z" fill="#FFFFFF"/><path d="M0 2.6L30 17.4" stroke="#D7263D" stroke-width="1.2"/>',
  SOR: field('#2B2D6E') + '<path d="M0 12Q5 9 10 12T20 12T30 12" fill="none" stroke="#FFFFFF" stroke-width="1.8"/><circle cx="6" cy="5.5" r="2.2" fill="#FF7F66"/>',
  VEL: field('#FFD23F') + '<path d="M0 0H6L15 12 24 0H30L15 20Z" fill="#008C8C"/>',
  TDR: field('#F3E9D2') + '<path d="M0 11L5 6 10 11 15 6 20 11 25 6 30 11V15H0Z" fill="#C4561D"/><rect y="15" width="30" height="5" fill="#1C2541"/>',
  ROV: field('#2D6A4F') + '<rect y="12" width="30" height="3" fill="#F4C430"/><path d="M7 3.2L9.6 6 7 8.8 4.4 6Z" fill="#FFFFFF"/>',
  SMK: field('#102A43') + '<circle cx="21" cy="7" r="3.2" fill="#F0B429"/><rect y="13" width="30" height="1.4" fill="#FFFFFF"/>',
  // Special sides.
  WLD:
    field('#1B1F3B') +
    '<g fill="none" stroke="#F5C542"><circle cx="15" cy="10" r="6.5" stroke-width="1"/><ellipse cx="15" cy="10" rx="3" ry="6.5" stroke-width=".8"/><path d="M8.5 10h13M9.6 6.5h10.8M9.6 13.5h10.8" stroke-width=".7"/></g>',
  ELF: field('#0B1B33') + star(15, 10, 6, '#F5C542'),
};
const FALLBACK_FLAG = field('#1B1F3B');

export const NATION_NAMES = {
  ALD: 'Aldoria', BRV: 'Brevanië', CVR: 'Calvaro', DMR: 'Dunmere', ESR: 'Esterra', GAV: 'Galvanië',
  HLS: 'Hollaris', KDV: 'Kardovië', MRD: 'Marendië', NRV: 'Norvania', TAV: 'Tavarin',
  PVN: 'Pavonië', ZRK: 'Zirkonië', SOR: 'Sorakai', VEL: 'Veloria', TDR: 'Tandara', ROV: 'Rovenië', SMK: 'Solmark',
  WLD: 'Wereldsterren', ELF: 'Gouden Elf',
};

export function flagSVG(code, cls = 'flag') {
  const inner = FLAGS[code] || FALLBACK_FLAG;
  return `<svg class="${cls}" viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;
}

// Kit: shirt, shorts, socks, trim (collar/cuffs/number), optional pattern.
const kit = (shirt, shorts, socks, trim, pattern = 'plain', pat = null) => ({ shirt, shorts, socks, trim, pattern, pat });

export const KITS = {
  ALD: { home: kit('#F4EFE3', '#B0203A', '#F4EFE3', '#B0203A', 'sash', '#B0203A'), away: kit('#B0203A', '#F4EFE3', '#B0203A', '#E0A526') },
  BRV: { home: kit('#1D2B5E', '#1D2B5E', '#F0705A', '#F0705A'), away: kit('#F0705A', '#1D2B5E', '#F0705A', '#FFFFFF') },
  CVR: { home: kit('#0E7C7B', '#FFFFFF', '#0E7C7B', '#F28C28'), away: kit('#F28C28', '#0E7C7B', '#F28C28', '#FFFFFF') },
  DMR: { home: kit('#145A32', '#FFFFFF', '#145A32', '#D4AF37'), away: kit('#F5F5F0', '#145A32', '#F5F5F0', '#145A32', 'band', '#145A32') },
  ESR: { home: kit('#7A1F3D', '#7A1F3D', '#6EC1E4', '#6EC1E4', 'band', '#6EC1E4'), away: kit('#6EC1E4', '#FFFFFF', '#6EC1E4', '#7A1F3D') },
  GAV: { home: kit('#23272E', '#23272E', '#9BD13F', '#9BD13F'), away: kit('#9BD13F', '#23272E', '#23272E', '#23272E') },
  HLS: { home: kit('#5B2A86', '#F2B705', '#5B2A86', '#F2B705'), away: kit('#F2B705', '#5B2A86', '#F2B705', '#5B2A86') },
  KDV: { home: kit('#2E5E8C', '#FFFFFF', '#2E5E8C', '#C8323C', 'stripes', '#FFFFFF'), away: kit('#C8323C', '#2E5E8C', '#C8323C', '#FFFFFF') },
  MRD: { home: kit('#F07F1A', '#1B2F5B', '#F07F1A', '#1B2F5B'), away: kit('#1B2F5B', '#1B2F5B', '#1B2F5B', '#F07F1A') },
  NRV: { home: kit('#A9D6F5', '#173A63', '#A9D6F5', '#173A63'), away: kit('#173A63', '#173A63', '#FFFFFF', '#A9D6F5') },
  TAV: { home: kit('#6D1A36', '#FFFFFF', '#6D1A36', '#8ECAE6', 'sash', '#8ECAE6'), away: kit('#8ECAE6', '#6D1A36', '#8ECAE6', '#6D1A36') },
  WLD: { home: kit('#4C1D95', '#4C1D95', '#4C1D95', '#F5C542'), away: kit('#0F0F14', '#0F0F14', '#0F0F14', '#F5C542') },
  ELF: { home: kit('#0B1B33', '#0B1B33', '#0B1B33', '#F5C542', 'sash', '#F5C542'), away: kit('#F5F5F5', '#F5F5F5', '#F5F5F5', '#0B1B33', 'sash', '#F5C542') },
};

export const GK_COLORS = ['#A3E635', '#F472B6', '#FBBF24', '#22D3EE', '#1F2937', '#F97316', '#8B5CF6'];
