// Tiny DOM helpers.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function fmt(n) {
  return Math.round(n).toLocaleString('nl-NL');
}

export const ICON_BACK =
  '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_LOCK =
  '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';
export const ICON_CHECK =
  '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

export function medalHTML(place, cls = '') {
  if (!(place >= 1 && place <= 3)) return '';
  return `<span class="medal m${place} ${cls}" aria-label="${place}e plaats">${place}</span>`;
}
