// Nations: Dutch names, simplified flags (SVG, viewBox 0 0 30 20) and kits.
// Kits use generic national colours only (no federation crests or brand marks).

const star = (cx, cy, r, fill) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
};
const v3 = (a, b, c) =>
  `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
const h3 = (a, b, c) =>
  `<rect width="30" height="6.67" fill="${a}"/><rect y="6.67" width="30" height="6.67" fill="${b}"/><rect y="13.33" width="30" height="6.67" fill="${c}"/>`;
const h2 = (a, b) => `<rect width="30" height="10" fill="${a}"/><rect y="10" width="30" height="10" fill="${b}"/>`;
const nordic = (bg, cross, inner) =>
  `<rect width="30" height="20" fill="${bg}"/><rect x="8" width="5" height="20" fill="${cross}"/><rect y="7.5" width="30" height="5" fill="${cross}"/>` +
  (inner ? `<rect x="9.4" width="2.2" height="20" fill="${inner}"/><rect y="8.9" width="30" height="2.2" fill="${inner}"/>` : '');
const smallCross = (cx, cy) =>
  `<rect x="${cx - 0.5}" y="${cy - 1.6}" width="1" height="3.2" fill="#FF0000"/><rect x="${cx - 1.6}" y="${cy - 0.5}" width="3.2" height="1" fill="#FF0000"/>`;

const FLAGS = {
  FRA: v3('#0055A4', '#FFFFFF', '#EF4135'),
  ESP: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
  ENG: '<rect width="30" height="20" fill="#FFFFFF"/><rect x="13" width="4" height="20" fill="#CE1124"/><rect y="8" width="30" height="4" fill="#CE1124"/>',
  BRA:
    '<rect width="30" height="20" fill="#009C3B"/><path d="M15 2.4L27.4 10 15 17.6 2.6 10Z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.3" fill="#002776"/><path d="M10.9 9.1Q15 8 19.1 10.5" stroke="#FFFFFF" stroke-width="0.8" fill="none"/>',
  ARG: '<rect width="30" height="20" fill="#74ACDF"/><rect y="6.67" width="30" height="6.67" fill="#FFFFFF"/><circle cx="15" cy="10" r="1.9" fill="#F6B40E"/>',
  POR:
    '<rect width="30" height="20" fill="#FF0000"/><rect width="12" height="20" fill="#006600"/><circle cx="12" cy="10" r="3.6" fill="#FFCC00"/><circle cx="12" cy="10" r="2.3" fill="#FF0000"/><path d="M10.9 8.6h2.2v2.1a1.1 1.1 0 0 1-2.2 0z" fill="#FFFFFF"/>',
  GER: h3('#000000', '#DD0000', '#FFCE00'),
  NED: h3('#AE1C28', '#FFFFFF', '#21468B'),
  BEL: v3('#000000', '#FAE042', '#ED2939'),
  ITA: v3('#009246', '#FFFFFF', '#CE2B37'),
  URU:
    '<rect width="30" height="20" fill="#FFFFFF"/><g fill="#0038A8"><rect y="2.22" width="30" height="2.22"/><rect y="6.67" width="30" height="2.22"/><rect y="11.11" width="30" height="2.22"/><rect y="15.56" width="30" height="2.22"/></g><rect width="11.1" height="11.1" fill="#FFFFFF"/><circle cx="5.55" cy="5.55" r="3" fill="#FCD116"/>',
  NOR: nordic('#BA0C2F', '#FFFFFF', '#00205B'),
  EGY: h3('#CE1126', '#FFFFFF', '#000000') + '<path d="M15 7.6l1.5 1.2-.6 2.7h-1.8l-.6-2.7z" fill="#C09300"/>',
  GEO:
    '<rect width="30" height="20" fill="#FFFFFF"/><rect x="13" width="4" height="20" fill="#FF0000"/><rect y="8" width="30" height="4" fill="#FF0000"/>' +
    smallCross(6.5, 4) + smallCross(23.5, 4) + smallCross(6.5, 16) + smallCross(23.5, 16),
  MAR:
    '<rect width="30" height="20" fill="#C1272D"/><path d="M15 5.2L16.4 9.5 20.9 9.5 17.3 12.1 18.6 16.4 15 13.8 11.4 16.4 12.7 12.1 9.1 9.5 13.6 9.5Z" fill="none" stroke="#006233" stroke-width="0.9"/>',
  SVN: h3('#FFFFFF', '#0000FF', '#FF0000') + '<path d="M7 4h5v4.5a2.5 2.5 0 0 1-5 0z" fill="#0000FF" stroke="#FF0000" stroke-width="0.5"/>',
  KOR:
    '<rect width="30" height="20" fill="#FFFFFF"/><circle cx="15" cy="10" r="4.4" fill="#0047A0"/><path d="M10.6 10a4.4 4.4 0 0 1 8.8 0 2.2 2.2 0 0 1-4.4 0 2.2 2.2 0 0 0-4.4 0z" fill="#CD2E3A"/><g stroke="#000000" stroke-width="0.7"><path d="M4.5 5.5l2.4-2.4M5.4 6.4l2.4-2.4M6.3 7.3l2.4-2.4"/><path d="M21.3 4.9l2.4 2.4M22.2 4l2.4 2.4M23.1 3.1l2.4 2.4"/><path d="M4.5 14.5l2.4 2.4M5.4 13.6l2.4 2.4M6.3 12.7l2.4 2.4"/><path d="M21.3 15.1l2.4-2.4M22.2 16l2.4-2.4M23.1 16.9l2.4-2.4"/></g>',
  CRO:
    h3('#FF0000', '#FFFFFF', '#171796') +
    '<rect x="12.6" y="5" width="4.8" height="6.4" fill="#FFFFFF" stroke="#FF0000" stroke-width="0.3"/><g fill="#FF0000"><rect x="12.6" y="5" width="1.6" height="1.6"/><rect x="15.8" y="5" width="1.6" height="1.6"/><rect x="14.2" y="6.6" width="1.6" height="1.6"/><rect x="12.6" y="8.2" width="1.6" height="1.6"/><rect x="15.8" y="8.2" width="1.6" height="1.6"/><rect x="14.2" y="9.8" width="1.6" height="1.6"/></g>',
  CAN:
    '<rect width="30" height="20" fill="#FFFFFF"/><rect width="7.5" height="20" fill="#D80621"/><rect x="22.5" width="7.5" height="20" fill="#D80621"/><path d="M15 4.4l1 2 1.5-.5-.6 3 1.8-1.2.3 1.2 1.6-.3-.8 1.8.9.5-3.2 2.4.3 1.4-2.3-.3v2.5h-1v-2.5l-2.3.3.3-1.4-3.2-2.4.9-.5-.8-1.8 1.6.3.3-1.2 1.8 1.2-.6-3 1.5.5z" fill="#D80621"/>',
  ECU: '<rect width="30" height="10" fill="#FFDD00"/><rect y="10" width="30" height="5" fill="#034EA2"/><rect y="15" width="30" height="5" fill="#ED1C24"/><circle cx="15" cy="10" r="2.2" fill="#8C6A2F"/>',
  HUN: h3('#CD2A3E', '#FFFFFF', '#436F4D'),
  SWE: '<rect width="30" height="20" fill="#006AA7"/><rect x="9" width="4" height="20" fill="#FECC02"/><rect y="8" width="30" height="4" fill="#FECC02"/>',
  NGA: v3('#008751', '#FFFFFF', '#008751'),
  POL: h2('#FFFFFF', '#DC143C'),
  SCO: '<rect width="30" height="20" fill="#005EB8"/><path d="M0 0L30 20M30 0L0 20" stroke="#FFFFFF" stroke-width="3.2"/>',
  TUR: '<rect width="30" height="20" fill="#E30A17"/><circle cx="11" cy="10" r="5" fill="#FFFFFF"/><circle cx="12.3" cy="10" r="4" fill="#E30A17"/>' + star(17.6, 10, 2.2, '#FFFFFF'),
  COL: '<rect width="30" height="10" fill="#FCD116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#CE1126"/>',
  GHA: h3('#CE1126', '#FCD116', '#006B3F') + star(15, 10, 3, '#000000'),
  CMR: v3('#007A5E', '#CE1126', '#FCD116') + star(15, 10, 2.6, '#FCD116'),
  JPN: '<rect width="30" height="20" fill="#FFFFFF"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>',
  USA:
    '<rect width="30" height="20" fill="#FFFFFF"/><g fill="#B22234">' +
    [0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y="${(i * 20) / 13}" width="30" height="${20 / 13}"/>`).join('') +
    '</g><rect width="12" height="10.77" fill="#3C3B6E"/><g fill="#FFFFFF"><circle cx="2.4" cy="2.2" r=".6"/><circle cx="6" cy="2.2" r=".6"/><circle cx="9.6" cy="2.2" r=".6"/><circle cx="4.2" cy="5.3" r=".6"/><circle cx="7.8" cy="5.3" r=".6"/><circle cx="2.4" cy="8.4" r=".6"/><circle cx="6" cy="8.4" r=".6"/><circle cx="9.6" cy="8.4" r=".6"/></g>',
  SUI: '<rect width="30" height="20" fill="#DA291C"/><rect x="13.5" y="4" width="3" height="12" fill="#FFFFFF"/><rect x="9" y="8.5" width="12" height="3" fill="#FFFFFF"/>',
  SRB: h3('#C6363C', '#0C4076', '#FFFFFF'),
  DEN: '<rect width="30" height="20" fill="#C8102E"/><rect x="9" width="3.6" height="20" fill="#FFFFFF"/><rect y="8.2" width="30" height="3.6" fill="#FFFFFF"/>',
  GUI: v3('#CE1126', '#FCD116', '#009460'),
  CIV: v3('#F77F00', '#FFFFFF', '#009E60'),
  ALG:
    '<rect width="15" height="20" fill="#006633"/><rect x="15" width="15" height="20" fill="#FFFFFF"/><path fill-rule="evenodd" d="M19.5 10a4.5 4.5 0 1 1-9 0 4.5 4.5 0 1 1 9 0zM19.5 10a3.5 3.5 0 1 0-7 0 3.5 3.5 0 1 0 7 0z" fill="#D21034"/>' +
    star(17, 10, 1.6, '#D21034'),
  SEN: v3('#00853F', '#FDEF42', '#E31B23') + star(15, 10, 2.6, '#00853F'),
  UKR: h2('#0057B7', '#FFD700'),
  MEX: v3('#006847', '#FFFFFF', '#CE1126') + '<circle cx="15" cy="10" r="1.8" fill="#8C5A2B"/>',
  CZE: '<rect width="30" height="10" fill="#FFFFFF"/><rect y="10" width="30" height="10" fill="#D7141A"/><path d="M0 0L15 10 0 20Z" fill="#11457E"/>',
  CIS: '<rect width="30" height="20" fill="#1b1f3b"/>',
  WLD:
    '<rect width="30" height="20" fill="#1B1F3B"/><g fill="none" stroke="#F5C542"><circle cx="15" cy="10" r="6.5" stroke-width="1"/><ellipse cx="15" cy="10" rx="3" ry="6.5" stroke-width=".8"/><path d="M8.5 10h13M9.6 6.5h10.8M9.6 13.5h10.8" stroke-width=".7"/></g>',
  ELF:
    '<rect width="30" height="20" fill="#0B1B33"/>' + star(15, 10, 6, '#F5C542'),
};

export const NATION_NAMES = {
  FRA: 'Frankrijk', ESP: 'Spanje', ENG: 'Engeland', BRA: 'Brazilië', ARG: 'Argentinië', POR: 'Portugal',
  GER: 'Duitsland', NED: 'Nederland', BEL: 'België', ITA: 'Italië', URU: 'Uruguay', NOR: 'Noorwegen',
  EGY: 'Egypte', GEO: 'Georgië', MAR: 'Marokko', SVN: 'Slovenië', KOR: 'Zuid-Korea', CRO: 'Kroatië',
  CAN: 'Canada', ECU: 'Ecuador', HUN: 'Hongarije', SWE: 'Zweden', NGA: 'Nigeria', POL: 'Polen',
  SCO: 'Schotland', TUR: 'Turkije', COL: 'Colombia', GHA: 'Ghana', CMR: 'Kameroen', JPN: 'Japan',
  USA: 'Verenigde Staten', SUI: 'Zwitserland', SRB: 'Servië', DEN: 'Denemarken', GUI: 'Guinee',
  CIV: 'Ivoorkust', ALG: 'Algerije', SEN: 'Senegal', UKR: 'Oekraïne', MEX: 'Mexico', CZE: 'Tsjechië',
  WLD: 'Wereldsterren', ELF: 'Gouden Elf',
};

export function flagSVG(code, cls = 'flag') {
  const inner = FLAGS[code] || FLAGS.CIS;
  return `<svg class="${cls}" viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;
}

// Kit: shirt, shorts, socks, trim (collar/cuffs/number), optional pattern.
const kit = (shirt, shorts, socks, trim, pattern = 'plain', pat = null) => ({ shirt, shorts, socks, trim, pattern, pat });

export const KITS = {
  FRA: { home: kit('#1F3A8A', '#FFFFFF', '#C8102E', '#FFFFFF'), away: kit('#F4F4F4', '#1F3A8A', '#F4F4F4', '#1F3A8A') },
  ESP: { home: kit('#C8102E', '#1B2A5B', '#1B2A5B', '#F1BF00'), away: kit('#F3EFE0', '#F3EFE0', '#F3EFE0', '#C8102E') },
  ENG: { home: kit('#F8F8F8', '#1C2541', '#F8F8F8', '#C8102E'), away: kit('#B3121F', '#B3121F', '#B3121F', '#1C2541') },
  BRA: { home: kit('#FFD60A', '#1E40AF', '#FFFFFF', '#009C3B'), away: kit('#1E40AF', '#FFFFFF', '#1E40AF', '#FFD60A') },
  ARG: { home: kit('#FFFFFF', '#111111', '#FFFFFF', '#111111', 'stripes', '#75AADB'), away: kit('#2B2D6E', '#2B2D6E', '#2B2D6E', '#75AADB') },
  POR: { home: kit('#A4161A', '#A4161A', '#A4161A', '#0B6E4F'), away: kit('#F1F1F1', '#F1F1F1', '#F1F1F1', '#0B6E4F') },
  GER: { home: kit('#F8F8F8', '#111111', '#F8F8F8', '#111111', 'band', '#DD0000'), away: kit('#1A1A2E', '#1A1A2E', '#1A1A2E', '#E5B100') },
  NED: { home: kit('#FF6A13', '#FF6A13', '#FF6A13', '#111111'), away: kit('#1F3B73', '#1F3B73', '#1F3B73', '#FF6A13') },
  BEL: { home: kit('#C8102E', '#C8102E', '#C8102E', '#FAE042'), away: kit('#F5F5F5', '#F5F5F5', '#F5F5F5', '#C8102E') },
  ITA: { home: kit('#1565C0', '#FFFFFF', '#1565C0', '#FFFFFF'), away: kit('#F8F8F8', '#1565C0', '#F8F8F8', '#1565C0') },
  URU: { home: kit('#69B3E7', '#111111', '#111111', '#FFFFFF'), away: kit('#F8F8F8', '#111111', '#F8F8F8', '#69B3E7') },
  WLD: { home: kit('#4C1D95', '#4C1D95', '#4C1D95', '#F5C542'), away: kit('#0F0F14', '#0F0F14', '#0F0F14', '#F5C542') },
  ELF: { home: kit('#0B1B33', '#0B1B33', '#0B1B33', '#F5C542', 'sash', '#F5C542'), away: kit('#F5F5F5', '#F5F5F5', '#F5F5F5', '#0B1B33', 'sash', '#F5C542') },
};

export const GK_COLORS = ['#A3E635', '#F472B6', '#FBBF24', '#22D3EE', '#1F2937', '#F97316', '#8B5CF6'];
