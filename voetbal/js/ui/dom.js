// Tiny DOM helpers.

import { flagSVG } from '../data/nations.js';
import { STAT_LABELS, GK_STAT_LABELS, TIER_NAMES, tierOf } from '../data/players.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function fmt(n) {
  return Math.round(n).toLocaleString('nl-NL');
}

const SILHOUETTE =
  '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 12c-10 0-17 8-17 19 0 8 4 15 10 18v5c-12 3-26 9-31 16-3 5-4 12-4 20h84c0-8-1-15-4-20-5-7-19-13-31-16v-5c6-3 10-10 10-18 0-11-7-19-17-19z"/></svg>';

export function cardHTML(p, size = '', extra = '') {
  const tier = tierOf(p);
  const labels = p.pos === 'GK' ? GK_STAT_LABELS : STAT_LABELS;
  const stats = labels.map((l, i) => `<span><b>${p.stats[i]}</b>${l}</span>`).join('');
  return `<div class="card t-${tier} ${size}" data-id="${esc(p.id)}" ${extra}>
    <div class="card-ovr">${p.ovr}</div>
    <div class="card-pos">${p.pos}</div>
    <div class="card-flag">${flagSVG(p.nation)}</div>
    <div class="card-sil">${SILHOUETTE}</div>
    <div class="card-name">${esc(p.short)}</div>
    <div class="card-stats">${stats}</div>
    <div class="card-tier">${TIER_NAMES[tier].toUpperCase()}</div>
  </div>`;
}

export const ICON_BACK =
  '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_NEXT =
  '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_PREV = ICON_BACK;

export function topbar(title, right = '') {
  return `<header class="topbar">
    <button class="icon-btn back" data-back aria-label="Terug">${ICON_BACK}</button>
    <h2 class="screen-title">${esc(title)}</h2>
    <div class="tb-right">${right}</div>
  </header>`;
}

export function coinsHTML(n, id = '') {
  return `<div class="coins" ${id ? `id="${id}"` : ''}><i class="coin"></i><b>${fmt(n)}</b></div>`;
}
