// Manillen: drawing the cards (HTML + inline SVG pips, our own simple design).

import { suitOf, rankOf, points, RED, cardName } from './engine.js';

const pip = (s, cls = '') => `<svg class="pip ${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#s-${s}"/></svg>`;
export const suitIcon = (s, cls = '') => `<svg class="sicon ${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#s-${s}"/></svg>`;

function middle(s, r) {
  if (r === 'B' || r === 'V' || r === 'H') return `<span class="face"><b>${r}</b>${pip(s, 'pip-f')}</span>`;
  if (r === '10') return `<span class="mid mid-10">${pip(s, 'pip-big')}</span>`;
  if (r === 'A') return `<span class="mid mid-a">${pip(s, 'pip-big')}</span>`;
  return `<span class="mid">${pip(s, 'pip-mid')}</span>`;
}

// tag: 'div' or 'button'. extra: classes. attrs: extra attributes.
export function cardHTML(c, { tag = 'div', extra = '', attrs = '' } = {}) {
  const s = suitOf(c);
  const r = rankOf(c);
  const pts = points(c);
  const label = cardName(c) + (pts ? `, ${pts} ${pts === 1 ? 'punt' : 'punten'}` : '');
  const role = tag === 'div' ? 'role="img"' : '';
  const lab = attrs.includes('aria-label') ? '' : `aria-label="${label}"`;
  return `<${tag} class="card ${RED[s] ? 'red' : 'black'} s-${s} r${r} ${extra}" data-c="${c}" ${role} ${lab} ${attrs}>`
    + `<span class="ix"><b>${r}</b>${pip(s, 'pip-ix')}</span>`
    + middle(s, r)
    + `<span class="ix ix2"><b>${r}</b>${pip(s, 'pip-ix')}</span>`
    + (pts ? `<i class="pt" aria-hidden="true">${pts}</i>` : '')
    + `</${tag}>`;
}

export const cardLabel = (c) => {
  const pts = points(c);
  return cardName(c) + (pts ? `, ${pts} ${pts === 1 ? 'punt' : 'punten'}` : '');
};

export const backHTML = (extra = '') => `<div class="card back ${extra}" aria-hidden="true"></div>`;

// Small inline card for the rules text.
export const mini = (c) => cardHTML(c, { extra: 'mini' });
