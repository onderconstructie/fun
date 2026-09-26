// Pack store and pack opening (with a walkout for the best pull).

import { $, esc, fmt, cardHTML, topbar, coinsHTML } from './dom.js';
import { PACKS, openPack, addToCollection } from '../game/packs.js';
import { tierOf, TIER_NAMES } from '../data/players.js';
import { flagSVG } from '../data/nations.js';

const STAR =
  '<svg class="pk-star" viewBox="0 0 120 120" aria-hidden="true"><path d="M60 6l14 29 32 5-23 22 5 32-28-15-28 15 5-32L14 40l32-5z" fill="currentColor" opacity=".9"/></svg>';

const GLOW = { goud: '#f5c542', elite: '#35c6ff', ster: '#a855f7', legende: '#ffffff' };

export function initPacks(app) {
  const el = $('#s-packs');

  function enter() {
    render();
  }

  function render() {
    const p = app.profile;
    const free = p.freePacks.map((k, i) => {
      const d = PACKS[k];
      return `<div class="pack ${d.cls}">${STAR}<div class="pk-name">${esc(d.name)}</div><div class="pk-desc">${esc(d.desc)}</div>
        <button class="btn btn-primary" data-free="${i}"><span>Gratis</span></button></div>`;
    });
    const shop = ['goud', 'elite', 'ster'].map((k) => {
      const d = PACKS[k];
      const can = p.coins >= d.price;
      return `<div class="pack ${d.cls}">${STAR}<div class="pk-name">${esc(d.name)}</div><div class="pk-desc">${esc(d.desc)}</div>
        <button class="btn ${can ? 'btn-gold' : 'btn-ghost'}" data-buy="${k}" ${can ? '' : 'aria-disabled="true"'}><i class="coin"></i><span>${fmt(d.price)}</span></button></div>`;
    });
    el.innerHTML = `${topbar('Pakketten', coinsHTML(p.coins))}
      <div class="packs-row">${free.join('')}${shop.join('')}</div>
      <p class="legal" style="text-align:center">Munten verdien je alleen door te spelen. Er is niets te koop voor echt geld.</p>`;
  }

  el.addEventListener('click', (e) => {
    const p = app.profile;
    const f = e.target.closest('[data-free]');
    if (f) {
      const i = Number(f.dataset.free);
      const type = p.freePacks[i];
      p.freePacks.splice(i, 1);
      open(type);
      return;
    }
    const b = e.target.closest('[data-buy]');
    if (b) {
      const type = b.dataset.buy;
      const d = PACKS[type];
      if (p.coins < d.price) {
        app.toast(`Je hebt nog ${fmt(d.price - p.coins)} munten tekort. Speel een wedstrijd!`);
        return;
      }
      p.coins -= d.price;
      open(type);
    }
  });

  function open(type) {
    const p = app.profile;
    const cards = openPack(type);
    const results = addToCollection(p, cards);
    app.save();
    render();
    const best = cards[0];
    const tier = tierOf(best);
    const walkout = tier === 'ster' || tier === 'legende';
    const root = $('#overlays');
    root.innerHTML = `<div class="overlay pack-open" data-kind="pack">
      <div class="po-stage" id="po-stage">
        <div class="pack po-pack ${PACKS[type].cls}" id="po-pack" style="box-shadow:0 0 60px ${GLOW[tier]}, 0 0 120px ${GLOW[tier]}88">${STAR}<div class="pk-name">${esc(PACKS[type].name)}</div></div>
      </div>
      <div class="po-hint" id="po-hint">Tik om te openen</div>
      <div class="btns" id="po-btns" hidden>
        <button class="btn btn-primary" data-act="squad"><span>Naar Mijn Elf</span></button>
        <button class="btn btn-ghost" data-act="close"><span>Sluiten</span></button>
      </div>
    </div>`;
    app.overlays.open = 'pack';
    app.sound.whoosh(0.9);
    const ov = root.firstElementChild;
    let stage = 0;
    const stageEl = $('#po-stage');
    const reveal = () => {
      $('#po-hint').hidden = true;
      stageEl.innerHTML = `<div class="po-cards">${results
        .map((r, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;animation-delay:${i * 0.12}s">${cardHTML(r.card, i === 0 && walkout ? 'lg' : '', `style="animation-delay:${i * 0.15}s"`)}
          <div class="po-note">${r.dup ? `Dubbel · +${fmt(r.coins)} munten` : `<b style="color:#c6ff3d">NIEUW</b> · ${TIER_NAMES[tierOf(r.card)]}`}</div></div>`)
        .join('')}</div>`;
      $('#po-btns').hidden = false;
      app.sound.reveal(walkout);
      app.haptic(walkout ? [30, 50, 90] : 25);
    };
    const steps = walkout
      ? [
          () => `<div class="rays"></div><div class="walkout"><div class="wo-flag">${flagSVG(best.nation)}</div></div>`,
          () => `<div class="rays"></div><div class="walkout"><div class="wo-flag">${flagSVG(best.nation)}</div><div class="wo-step">${best.pos}</div></div>`,
          () => `<div class="rays"></div><div class="walkout"><div class="wo-flag">${flagSVG(best.nation)}</div><div class="wo-step" style="color:${GLOW[tier]}">${best.ovr}</div></div>`,
        ]
      : [];
    ov.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) {
        root.innerHTML = '';
        app.overlays.open = null;
        if (act.dataset.act === 'squad') app.go('s-squad');
        return;
      }
      if (stage === 0) {
        stage = 1;
        if (steps.length) {
          let i = 0;
          const next = () => {
            if (!document.getElementById('po-stage')) return;
            if (i < steps.length) {
              stageEl.innerHTML = steps[i++]();
              app.sound.thud(0.7);
              app.haptic(15);
              setTimeout(next, 950);
            } else reveal();
          };
          $('#po-hint').hidden = true;
          next();
        } else reveal();
      }
    });
  }

  return { enter };
}
