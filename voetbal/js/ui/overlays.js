// Modal overlays during a match: tutorial, pause, half-time, results and the
// attack-duel interlude.

import { $, esc, fmt } from './dom.js';
import { flagSVG } from '../data/nations.js';

const MULT = { amateur: 0.6, pro: 1, wereldklasse: 1.4, legende: 1.9 };

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
  tutorial(onDone) {
    const html = `<div class="panel" style="width:min(680px,100%)">
      <h2>Zo speel je</h2>
      <div class="help-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
        <div class="help-card"><h3>Links: lopen</h3><p>Duim links op het scherm = joystick. Tot de rand duwen = <b>sprint</b>.</p></div>
        <div class="help-card"><h3>Rechts: acties</h3><p><span class="chip chip-pass">PASS</span> naar de witte ring · <span class="chip chip-through">DOOR</span> diepe bal · <span class="chip chip-shoot">SCHIET</span> vasthouden voor kracht.</p></div>
        <div class="help-card"><h3>Vegen</h3><p>Omhoog vegen op een knop = <b>hoge bal / stift</b>. Vegen op een lege plek = <b>dribbel-actie</b>.</p></div>
        <div class="help-card"><h3>Verdedigen</h3><p><span class="chip chip-shoot">TACKLE</span> · <span class="chip chip-pass">WISSEL</span> · <span class="chip chip-through">DRUK</span> vasthouden = automatisch druk zetten.</p></div>
      </div>
      <div class="btns"><button class="btn btn-primary btn-xl" data-act="go"><span>Aftrap!</span></button></div>
    </div>`;
    this.show('tutorial', html, (act) => {
      if (act === 'go') {
        this.closeAll();
        this.app.resume();
        onDone && onDone();
      }
    });
  }

  // ------------------------------------------------------------ pause
  pause(why) {
    const s = this.app.profile.settings;
    const html = `<div class="panel" style="width:min(420px,100%)">
      <h2>${why === 'hidden' ? 'Gepauzeerd' : 'Pauze'}</h2>
      <div class="menu-list">
        <button class="btn btn-primary" data-act="resume"><span>Verder spelen</span></button>
        <button class="btn btn-ghost" data-act="sound"><span>Geluid: ${s.sound ? 'aan' : 'uit'}</span></button>
        <button class="btn btn-ghost" data-act="help"><span>Besturing</span></button>
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
        this.tutorial(() => this.pause());
        app.paused = true;
      } else if (act === 'restart') {
        this.closeAll();
        app.startMatch(app.cfg);
      } else if (act === 'quit') {
        app.quitMatch();
      }
    });
  }

  // ------------------------------------------------------------ half-time
  halftime(m) {
    this.app.paused = true;
    const html = `<div class="panel">
      <h2>Rust</h2>
      ${this.scoreBlock(m)}
      ${this.statsBlock(m)}
      <div class="btns"><button class="btn btn-primary btn-xl" data-act="go"><span>Tweede helft</span></button></div>
    </div>`;
    this.show('halftime', html, (act) => {
      if (act === 'go') {
        this.closeAll();
        m.resume();
        this.app.resume();
      }
    });
  }

  scoreBlock(m) {
    const [a, b] = m.teams;
    const sc = (t) => m.goals.filter((g) => g.team === t.index).map((g) => `${esc(g.own ? `${g.scorer ? g.scorer.name : ''} (e.d.)` : g.scorer ? g.scorer.name : '')} ${esc(g.minute)}`);
    const la = sc(a), lb = sc(b);
    const rows = [];
    for (let i = 0; i < Math.max(la.length, lb.length); i++) rows.push(`<div>${la[i] || ''}</div><div>${lb[i] || ''}</div>`);
    const pens = m.pens ? `<div class="scorers" style="grid-template-columns:1fr"><div style="text-align:center">na strafschoppen</div></div>` : '';
    return `<div class="final-score">
        <div class="fs-team"><div class="tp-flag">${flagSVG(a.def.flag)}</div><b>${esc(a.short)}</b></div>
        <div class="fs-num">${a.score}</div><div class="fs-dash">–</div><div class="fs-num">${b.score}</div>
        <div class="fs-team"><div class="tp-flag">${flagSVG(b.def.flag)}</div><b>${esc(b.short)}</b></div>
      </div>${pens}
      ${rows.length ? `<div class="scorers">${rows.join('')}</div>` : ''}`;
  }

  statsBlock(m) {
    if (m.pens) return '';
    const [a, b] = m.teams;
    const A = a.stats, B = b.stats;
    const poss = A.possession + B.possession || 1;
    const pa = Math.round((100 * A.possession) / poss);
    const row = (label, x, y, pct) => {
      const tot = x + y || 1;
      const fa = pct ? x : (100 * x) / tot, fb = pct ? y : (100 * y) / tot;
      return `<div class="stat-row"><div class="l">${x}${pct ? '%' : ''}</div><div class="stat-bar" style="--a:${fa};--b:${fb}"><span>${label}</span></div><div>${y}${pct ? '%' : ''}</div></div>`;
    };
    const acc = (t) => (t.passes ? Math.round((100 * t.passesDone) / t.passes) : 0);
    if (m.attack) return row('Schoten', A.shots, B.shots) + row('Op doel', A.onTarget, B.onTarget);
    return (
      row('Balbezit', pa, 100 - pa, true) +
      row('Schoten', A.shots, B.shots) +
      row('Op doel', A.onTarget, B.onTarget) +
      row('Passnauwkeurigheid', acc(A), acc(B), true) +
      row('Tackles', A.tackles, B.tackles) +
      row('Hoekschoppen', A.corners, B.corners) +
      row('Overtredingen', A.fouls, B.fouls)
    );
  }

  // ------------------------------------------------------------ results
  results(m, cfg) {
    const app = this.app;
    const p = app.profile;
    const my = m.teams[0].score, opp = m.teams[1].score;
    const won = my > opp, draw = my === opp;
    const mult = MULT[cfg.difficulty] ?? 1;
    let coins;
    if (cfg.mode === 'penalties') coins = won ? 250 : 80;
    else coins = (won ? 400 : draw ? 200 : 100) + Math.min(150, my * 25);
    coins = Math.round((coins * mult) / 10) * 10;
    let extra = cfg.onResult ? cfg.onResult(m) : null;
    if (extra && extra.coins) coins += extra.coins;
    p.coins += coins;
    p.stats.played++;
    if (won) p.stats.won++;
    else if (draw) p.stats.drawn++;
    else p.stats.lost++;
    p.stats.gf += my;
    p.stats.ga += opp;
    app.save();
    app.paused = true;
    const title = won ? 'Gewonnen!' : draw ? 'Gelijkspel' : 'Verloren';
    const note = extra && extra.note ? `<p class="po-note" style="margin-top:6px">${esc(extra.note)}</p>` : '';
    const primary = cfg.cup ? '<button class="btn btn-primary" data-act="cup"><span>Verder</span></button>' : '<button class="btn btn-primary" data-act="again"><span>Nog een keer</span></button>';
    const html = `<div class="panel">
      <h2>${title}</h2>
      ${this.scoreBlock(m)}
      ${this.statsBlock(m)}
      ${note}
      <div class="reward"><i class="coin"></i><span id="reward-n">+0</span></div>
      <div class="btns">${primary}<button class="btn btn-ghost" data-act="menu"><span>Menu</span></button></div>
    </div>`;
    this.show('results', html, (act) => {
      if (act === 'again') {
        this.closeAll();
        app.startMatch(app.cfg);
      } else if (act === 'cup') {
        this.closeAll();
        app.cfg.returnTo = 's-cup';
        app.endMatch();
      } else if (act === 'menu') {
        this.closeAll();
        app.endMatch();
      }
    });
    // Count-up.
    const el = $('#reward-n');
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 900);
      el.textContent = '+' + fmt(coins * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
      else app.sound.coin();
    };
    setTimeout(() => requestAnimationFrame(tick), 350);
    if (won) app.sound.roar(0.5);
  }

  // ------------------------------------------------------------ attack duel interlude
  attackInterlude(m, duel) {
    const app = this.app;
    app.paused = true;
    const res = duel.opponentAttack();
    const them = m.teams[1];
    const html = `<div class="panel" style="width:min(460px,100%);text-align:center">
      <h2>${esc(them.name)} valt aan</h2>
      <div class="final-score" style="margin:2px 0 8px">
        <div class="fs-num" style="font-size:44px">${m.teams[0].score - 0}</div><div class="fs-dash">–</div><div class="fs-num" style="font-size:44px" id="ai-opp">${them.score - (res.goal ? 1 : 0)}</div>
      </div>
      <p style="font-size:20px;font-weight:700" id="ai-line">${res.minute}' · ${esc(res.scorer.name)} ${esc(res.how)}…</p>
      <p style="font-size:30px;font-weight:800;font-style:italic;min-height:40px;margin-top:6px" id="ai-res"></p>
    </div>`;
    this.show('attack', html, () => {});
    app.sound.crowd(true, 0.55);
    setTimeout(() => {
      const r = $('#ai-res');
      if (!r) return;
      if (res.goal) {
        r.textContent = 'DOELPUNT';
        r.style.color = '#ff8fa3';
        $('#ai-opp').textContent = them.score;
        app.sound.roar(0.45);
        app.haptic(30);
      } else {
        r.textContent = `GERED DOOR ${res.keeper.name.toUpperCase()}`;
        r.style.color = '#c6ff3d';
        app.sound.ooh(0.8);
      }
    }, 1300);
    setTimeout(() => {
      if (this.open !== 'attack') return;
      this.closeAll();
      if (duel.finished) {
        m.phase = 'fulltime';
        app.resume();
        m.emit('whistle', { kind: 'end' });
        m.emit('fulltime');
      } else {
        duel.setupRound();
        app.resume();
      }
    }, 3000);
  }
}
