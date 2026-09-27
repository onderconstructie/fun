// "Mijn Elf": formation, line-up and collection.

import { $, esc, cardHTML, topbar, coinsHTML } from './dom.js';
import { FORMATIONS, FORMATION_NAMES, positionPenalty } from '../data/formations.js';
import { PLAYER_BY_ID } from '../data/players.js';
import { flagSVG } from '../data/nations.js';
import { ownedCards, myTeam, bestXI } from '../game/profile.js';

export function initSquad(app) {
  let sel = 1;
  const el = $('#s-squad');

  function enter() {
    sel = Math.min(sel, 10);
    render();
  }

  function slotXY(s) {
    if (s.pos === 'GK') return [8, 50];
    return [23 + s.d * 60, 17 + s.l * 66];
  }

  function render() {
    const p = app.profile;
    const f = p.squad.formation;
    const slots = FORMATIONS[f];
    const team = myTeam(p);
    const lineup = p.squad.slots.map((id) => PLAYER_BY_ID[id]);
    const slotHTML = slots
      .map((s, i) => {
        const c = lineup[i];
        const pen = positionPenalty(c.pos, c.alt, s.pos);
        const [x, y] = slotXY(s);
        return `<button class="slot ${i === sel ? 'sel' : ''}" data-slot="${i}" style="left:${x}%;top:${y}%">
          ${cardHTML({ ...c, ovr: c.ovr - pen })}
          <span class="slot-pos ${pen ? 'warn' : ''}">${s.pos}${pen ? ` −${pen}` : ''}</span></button>`;
      })
      .join('');
    const cur = slots[sel];
    const inXI = new Set(p.squad.slots);
    const list = ownedCards(p)
      .map((c) => ({ c, pen: positionPenalty(c.pos, c.alt, cur.pos) }))
      .sort((a, b) => b.c.ovr - b.pen - (a.c.ovr - a.pen));
    const items = list
      .map(({ c, pen }) => `<button class="pick-item ${inXI.has(c.id) ? 'in-xi' : ''}" data-id="${esc(c.id)}">
          <span class="pi-ovr">${c.ovr - pen}</span>
          <span><span class="pi-name">${esc(c.name)}</span>
          <span class="pi-meta"><span class="card-flag">${flagSVG(c.nation)}</span>${c.pos}${c.alt.length ? '/' + c.alt.join('/') : ''} · basis ${c.ovr}${c.legend ? ' · Legende' : ''}</span></span>
          <span class="pi-fit ${pen ? 'bad' : ''}">${pen ? `−${pen}` : '✓'}</span></button>`)
      .join('');
    el.innerHTML = `${topbar(p.clubName || 'Mijn Elf', coinsHTML(p.coins))}
      <div class="squad-wrap">
        <div class="squad-pitch" id="sq-pitch">${slotHTML}</div>
        <div class="squad-side">
          <div class="squad-head">
            <div><div class="ovr-big">${team.ovr}</div><div class="ovr-cap">Team OVR</div></div>
            <div class="seg" id="sq-form">${FORMATION_NAMES.map((n) => `<button data-f="${n}" aria-pressed="${n === f}">${n}</button>`).join('')}</div>
          </div>
          <div class="squad-head">
            <button class="btn btn-ghost" id="sq-auto" style="height:38px;font-size:17px">Beste elf</button>
            <button class="btn btn-ghost" id="sq-name" style="height:38px;font-size:17px">Naam</button>
            <button class="btn btn-gold" data-go="s-packs" style="height:38px;font-size:17px">Pakketten</button>
          </div>
          <div class="ovr-cap">Kies speler voor ${cur.pos} (${list.length} in collectie)</div>
          <div class="pick-list" id="sq-list">${items || '<div class="pick-empty">Nog geen spelers</div>'}</div>
        </div>
      </div>`;
  }

  el.addEventListener('click', (e) => {
    const p = app.profile;
    const slot = e.target.closest('[data-slot]');
    if (slot) {
      sel = Number(slot.dataset.slot);
      app.sound.click();
      render();
      return;
    }
    const f = e.target.closest('[data-f]');
    if (f) {
      p.squad.formation = f.dataset.f;
      app.save();
      app.sound.click();
      render();
      return;
    }
    const item = e.target.closest('.pick-item');
    if (item) {
      const id = item.dataset.id;
      const slots = p.squad.slots;
      const from = slots.indexOf(id);
      if (from === sel) return;
      if (from >= 0) [slots[from], slots[sel]] = [slots[sel], slots[from]];
      else slots[sel] = id;
      app.save();
      app.sound.click();
      app.haptic(8);
      render();
      return;
    }
    if (e.target.closest('#sq-auto')) {
      p.squad.slots = bestXI(p, p.squad.formation);
      app.save();
      app.toast('Sterkste elf opgesteld');
      render();
      return;
    }
    if (e.target.closest('#sq-name')) {
      const n = prompt('Naam van je club', p.clubName || 'Mijn Elf');
      if (n && n.trim()) {
        p.clubName = n.trim().slice(0, 18);
        app.save();
        render();
      }
    }
  });

  return { enter };
}
