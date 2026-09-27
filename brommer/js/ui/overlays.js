// Modal overlays during a race: first-time tutorial, pause and results.

import { $, esc, fmt, ICON_LOCK } from './dom.js';
import { fmtTime, fmtSecs } from '../util.js';
import { MAIN_LEVELS, levelTitle } from '../data/levels.js';
import { MOPEDS } from '../data/mopeds.js';

export class Overlays {
  constructor(app) {
    this.app = app;
    this.root = $('#overlays');
    this.open = null;
  }

  blocking() {
    return !!this.open;
  }

  closeAll() {
    this.root.innerHTML = '';
    this.open = null;
  }

  show(kind, html, onClick) {
    this.root.innerHTML = `<div class="overlay" data-kind="${kind}">${html}</div>`;
    this.open = kind;
    const el = this.root.firstElementChild;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) {
        this.app.sound.click();
        onClick(b.dataset.act, e);
      }
    });
    return el;
  }

  // ------------------------------------------------------------ tutorial
  // isNew: a returning player sees it once more after the rules changed.
  tutorial(onDone, isNew = false) {
    const html = `<div class="panel tut">
      <h2>${isNew ? 'Nieuw: remmen en boost' : 'Zo win je'}</h2>
      <div class="tut-grid">
        <div class="tut-card"><div class="tut-ico">
          <svg viewBox="0 0 64 40"><rect x="2" y="4" width="26" height="32" rx="6" fill="rgba(255,255,255,.14)" stroke="currentColor" stroke-width="2"/><rect x="36" y="4" width="26" height="32" rx="6" fill="rgba(255,255,255,.14)" stroke="currentColor" stroke-width="2"/><path d="M19 13l-7 7 7 7M45 13l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div><h3>Sturen en remmen</h3><p>Houd <b>links</b> of <b>rechts</b> ingedrukt. Gas geven gaat vanzelf. Langzamer? Houd <b>REM</b> ingedrukt.</p></div>
        <div class="tut-card hot"><div class="tut-ico">
          <svg viewBox="0 0 64 40"><circle cx="18" cy="22" r="10" fill="#35b6ff"/><circle cx="44" cy="22" r="10" fill="#ff6b35"/><path d="M30 6l-4 9h6l-4 9" fill="none" stroke="#ffe14d" stroke-width="3" stroke-linejoin="round"/></svg>
        </div><h3>Bots = boost</h3><p>Rij tegen een andere brommer aan. Dan <b>pak jij zijn snelheid</b>: jij krijgt een boost en hij wordt even trager!</p></div>
        <div class="tut-card gold"><div class="tut-ico">
          <svg viewBox="0 0 64 40"><rect x="6" y="18" width="16" height="18" rx="2" fill="#c0c7d0"/><rect x="24" y="8" width="16" height="28" rx="2" fill="#f5c542"/><rect x="42" y="24" width="16" height="12" rx="2" fill="#d08a4a"/><text x="32" y="26" font-size="12" font-weight="800" text-anchor="middle" fill="#2a1a00">1</text></svg>
        </div><h3>Top 3 = muntjes</h3><p>Eindig bij de <b>eerste drie</b> voor veel muntjes. Koop er nieuwe brommers mee.</p></div>
      </div>
      <div class="btns"><button class="btn btn-primary btn-xl pulse" data-act="go"><span>Start!</span></button></div>
    </div>`;
    this.show('tutorial', html, (act) => {
      if (act === 'go') {
        this.closeAll();
        this.app.resume();
        if (onDone) onDone();
      }
    });
  }

  // ------------------------------------------------------------ pause
  pause(why) {
    const s = this.app.profile.settings;
    const html = `<div class="panel" style="width:min(400px,100%)">
      <h2>${why === 'hidden' ? 'Gepauzeerd' : 'Pauze'}</h2>
      <div class="menu-list">
        <button class="btn btn-primary" data-act="resume"><span>Verder rijden</span></button>
        <button class="btn btn-ghost" data-act="sound"><span>Geluid: ${s.sound ? 'aan' : 'uit'}</span></button>
        <button class="btn btn-ghost" data-act="help"><span>Hoe win je?</span></button>
        <button class="btn btn-ghost" data-act="restart"><span>Opnieuw beginnen</span></button>
        <button class="btn btn-ghost" data-act="quit"><span>Stoppen</span></button>
      </div>
    </div>`;
    this.show('pause', html, (act, e) => {
      const app = this.app;
      if (act === 'resume') {
        this.closeAll();
        app.resume();
      } else if (act === 'sound') {
        s.sound = !s.sound;
        app.sound.setEnabled(s.sound);
        app.save();
        e.target.closest('button').querySelector('span').textContent = `Geluid: ${s.sound ? 'aan' : 'uit'}`;
      } else if (act === 'help') {
        this.tutorial(() => this.app.pause());
      } else if (act === 'restart') {
        this.closeAll();
        app.startRace(app.level);
      } else if (act === 'quit') {
        this.closeAll();
        app.quitRace();
      }
    });
  }

  // ------------------------------------------------------------ results
  results(race, res) {
    const app = this.app;
    const n = race.cfg.n;
    const place = res.place;
    const title = place === 1 ? 'Gewonnen!' : place <= 3 ? `${place}e plaats!` : `${place}e plaats`;
    const sub =
      place === 1 ? (race.cfg.boss ? `Je hebt ${esc(race.cfg.boss.name)} verslagen!` : 'Jij bent de snelste!')
      : place <= 3 ? 'Top 3: dat levert muntjes op!'
      : race.stats.steals === 0 ? 'Tip: bots tegen de anderen om hun snelheid te pakken!'
      : 'Net geen top 3. Probeer het nog eens!';
    const rows = race.results().map((e) => {
      const r = e.r;
      const t = e.place === 1 ? fmtTime(e.time) : `+${fmtSecs(e.time - res.winnerTime)} s`;
      return `<li class="${r.isPlayer ? 'me' : ''} ${e.place <= 3 ? 'pod' : ''}">
        <span class="st-pos">${e.place}</span><i class="st-dot" style="background:${r.color}"></i>
        <span class="st-name">${esc(r.name)}${r.isBoss ? ' ★' : ''}</span>
        <span class="st-steals" title="Keer snelheid gepakt">${r.steals ? `⚡${r.steals}` : ''}</span>
        <span class="st-time" ${e.est ? 'title="Nog onderweg: geschatte tijd"' : ''}>${e.est ? '≈ ' : ''}${t}</span></li>`;
    }).join('');
    const nextOk = place <= 3;
    const primary = nextOk
      ? `<button class="btn btn-primary" data-act="next"><span>Level ${n + 1}</span></button>`
      : `<button class="btn btn-primary" data-act="again"><span>Nog een keer</span></button>`;
    const buyable = MOPEDS.find((m) => !app.profile.owned.includes(m.id) && app.profile.coins >= m.price);
    const html = `<div class="panel results ${place <= 3 ? 'won' : ''}">
      <div class="res-left">
        <div class="res-head">
          <div class="res-place p${Math.min(place, 4)}">${place}<small>e</small></div>
          <div><h2>${title}</h2><p class="res-sub">${sub}</p></div>
        </div>
        <ol class="standings">${rows}</ol>
      </div>
      <div class="res-right">
        <div class="res-stats">
          <span><b>${race.stats.steals}×</b> gepakt</span>
          <span><b>${Math.round(race.stats.topKmh)}</b> km/u top</span>
          ${race.stats.bestCombo > 1 ? `<span><b>×${race.stats.bestCombo}</b> combo</span>` : ''}
        </div>
        <div class="rewards">
          <div class="rw"><span>${place <= 3 ? `Podium (${place}e)` : 'Podium'}</span><b>${place <= 3 ? `+${fmt(res.podium)}` : '–'}</b></div>
          <div class="rw"><span>Muntjes op de weg</span><b>+${fmt(res.road)}</b></div>
          <div class="rw total"><i class="coin"></i><b id="reward-n">+0</b></div>
        </div>
        ${res.unlockedNew ? `<div class="unlock">🔓 Level ${n + 1} is vrij: ${esc(levelTitle(n + 1))}${n + 1 > MAIN_LEVELS ? ' (nog moeilijker!)' : ''}</div>` : ''}
        ${!nextOk && app.profile.unlocked <= n ? `<div class="unlock locked">${ICON_LOCK}<span>Top 3 speelt level ${n + 1} vrij</span></div>` : ''}
        ${buyable ? `<div class="unlock shop">Je kunt de <b>${esc(buyable.name)}</b> kopen in de garage!</div>` : ''}
        <div class="btns">${primary}
          ${nextOk ? '<button class="btn btn-ghost" data-act="again"><span>Opnieuw</span></button>' : ''}
          <button class="btn btn-ghost" data-act="garage"><span>Garage</span></button>
          <button class="btn btn-ghost" data-act="menu"><span>Menu</span></button>
        </div>
      </div>
    </div>`;
    this.show('results', html, (act) => {
      if (act === 'next') {
        this.closeAll();
        app.startRace(n + 1);
      } else if (act === 'again') {
        this.closeAll();
        app.startRace(n);
      } else if (act === 'garage') {
        this.closeAll();
        app.endRace('s-garage');
      } else if (act === 'menu') {
        this.closeAll();
        app.endRace('s-home');
      }
    });
    // Count the coins up.
    const el = $('#reward-n');
    const total = res.podium + res.road;
    const t0 = performance.now();
    const tick = () => {
      if (!el.isConnected) return;
      const k = Math.min(1, (performance.now() - t0) / 1100);
      el.textContent = '+' + fmt(total * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
      else if (total > 0) app.sound.cash();
    };
    setTimeout(() => requestAnimationFrame(tick), 400);
    if (res.unlockedNew) setTimeout(() => app.sound.unlockJingle(), 1500);
  }
}

