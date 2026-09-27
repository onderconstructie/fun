// Menu screens: title, home, match setup, settings, help.

import { $, $$, esc, fmt, ICON_PREV, ICON_NEXT, topbar } from './dom.js';
import { NATION_TEAMS } from '../data/teams.js';
import { flagSVG } from '../data/nations.js';
import { myTeam, resetProfile, todayKey, storageAvailable } from '../game/profile.js';
import { AttackDuel, Shootout } from '../engine/modes.js';
import { initSquad } from './squad.js';
import { initPacks } from './packs.js';
import { initCup } from './cup.js';

const DIFFS = [
  ['amateur', 'Amateur'],
  ['pro', 'Pro'],
  ['wereldklasse', 'Wereldklasse'],
  ['legende', 'Legende'],
];

export function initScreens(app) {
  const squad = initSquad(app);
  const packs = initPacks(app);
  const cup = initCup(app);
  const setup = { mode: 'match', pick: [0, 1], diff: 'pro', dur: 5 };

  // ------------------------------------------------------------ title
  $('#btn-start').addEventListener('click', () => {
    app.sound.unlock();
    app.sound.click();
    dailyBonus();
    app.go('s-home', false);
  });

  // ------------------------------------------------------------ home
  for (const t of $$('#s-home .tile[data-mode]')) {
    t.addEventListener('click', () => {
      const mode = t.dataset.mode;
      if (mode === 'cup') app.go('s-cup');
      else openSetup(mode);
    });
  }
  $('#btn-fullscreen').addEventListener('click', toggleFullscreen);

  function toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => app.toast('Volledig scherm wordt hier niet ondersteund'));
    else app.toast('Tip: voeg de pagina toe aan je beginscherm voor volledig scherm');
  }

  function dailyBonus() {
    const p = app.profile;
    const today = todayKey();
    if (p.lastDaily !== today) {
      const first = !p.lastDaily;
      p.lastDaily = today;
      if (!first) {
        p.coins += 500;
        if (!p.freePacks.includes('dagelijks')) p.freePacks.push('dagelijks');
        setTimeout(() => app.toast('Dagbonus: +500 munten en een gratis pakket!'), 400);
      }
      app.save();
    }
  }

  function enterHome() {
    const p = app.profile;
    $('#coins-home b').textContent = fmt(p.coins);
    $('#home-ovr').textContent = `Team OVR ${myTeam(p).ovr}`;
    $('#packs-badge').hidden = !p.freePacks.length;
    $('#packs-badge').textContent = p.freePacks.length;
  }

  // ------------------------------------------------------------ setup
  function teamList() {
    return [myTeam(app.profile), ...NATION_TEAMS];
  }

  function openSetup(mode) {
    setup.mode = mode;
    const s = app.profile.settings;
    setup.diff = s.difficulty;
    setup.dur = mode === 'attack' ? (s.attackRounds || 6) : s.duration;
    const list = teamList();
    const [a, b] = app.profile.lastPick || ['ELF', 'ALD'];
    setup.pick[0] = Math.max(0, list.findIndex((t) => t.id === a));
    setup.pick[1] = Math.max(0, list.findIndex((t) => t.id === b));
    if (setup.pick[1] === setup.pick[0]) setup.pick[1] = (setup.pick[0] + 1) % list.length;
    app.go('s-setup');
  }
  app.openSetup = openSetup;

  function renderPick(side) {
    const list = teamList();
    const t = list[setup.pick[side]];
    const stars = [...t.lineup].sort((x, y) => y.ovr - x.ovr).slice(0, 3).map((p) => esc(p.short)).join(' · ');
    const el = $('#pick' + side);
    el.innerHTML = `
      <button class="tp-arrow" data-dir="-1" aria-label="Vorig team">${ICON_PREV}</button>
      <div class="tp-body">
        <div class="tp-side ${side === 0 ? 'me' : ''}">${side === 0 ? 'Jij' : 'Tegenstander'}</div>
        <div class="tp-flag">${flagSVG(t.flag)}</div>
        <div class="tp-name">${esc(t.name)}</div>
        <div class="tp-ovr">OVR ${t.ovr}</div>
        <div class="tp-stars">${stars}</div>
      </div>
      <button class="tp-arrow" data-dir="1" aria-label="Volgend team">${ICON_NEXT}</button>`;
  }

  function cycle(side, dir) {
    const n = teamList().length;
    let i = setup.pick[side];
    do i = (i + dir + n) % n;
    while (i === setup.pick[1 - side]);
    setup.pick[side] = i;
    renderPick(side);
    app.sound.click();
  }

  for (const side of [0, 1]) {
    const el = $('#pick' + side);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.tp-arrow');
      if (b) cycle(side, Number(b.dataset.dir));
    });
    let sx = null;
    el.addEventListener('pointerdown', (e) => (sx = e.clientX));
    el.addEventListener('pointerup', (e) => {
      if (sx !== null && Math.abs(e.clientX - sx) > 40) cycle(side, e.clientX < sx ? 1 : -1);
      sx = null;
    });
  }

  function seg(el, items, value, onPick) {
    el.innerHTML = items.map(([v, label]) => `<button data-v="${v}" aria-pressed="${String(v) === String(value)}">${label}</button>`).join('');
    el.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      for (const x of el.children) x.setAttribute('aria-pressed', String(x === b));
      onPick(b.dataset.v);
      app.sound.click();
    };
  }

  function enterSetup() {
    const titles = { match: 'Snelle wedstrijd', attack: 'Aanvalsduel', penalties: 'Strafschoppen' };
    $('#setup-title').textContent = titles[setup.mode] || 'Wedstrijd';
    renderPick(0);
    renderPick(1);
    seg($('#seg-diff'), DIFFS, setup.diff, (v) => (setup.diff = v));
    const row = $('#row-dur');
    if (setup.mode === 'penalties') row.hidden = true;
    else {
      row.hidden = false;
      if (setup.mode === 'attack') {
        $('#dur-label').textContent = 'Aanvallen';
        seg($('#seg-dur'), [[4, '4'], [6, '6'], [8, '8']], setup.dur, (v) => (setup.dur = Number(v)));
      } else {
        $('#dur-label').textContent = 'Duur';
        seg($('#seg-dur'), [[3, '3 min'], [5, '5 min'], [8, '8 min']], setup.dur, (v) => (setup.dur = Number(v)));
      }
    }
  }

  $('#btn-kickoff').addEventListener('click', () => {
    const list = teamList();
    const home = list[setup.pick[0]], away = list[setup.pick[1]];
    const p = app.profile;
    p.lastPick = [home.id, away.id];
    p.settings.difficulty = setup.diff;
    if (setup.mode === 'attack') p.settings.attackRounds = setup.dur;
    else if (setup.mode === 'match') p.settings.duration = setup.dur;
    app.save();
    startMode(setup.mode, home, away, setup.diff, setup.dur);
  });

  function startMode(mode, home, away, diff, dur, extra = {}) {
    if (mode === 'attack') {
      let duel;
      app.startMatch({
        mode: 'attack', home, away, difficulty: diff, halfSeconds: 600, ...extra,
        setup: (m) => {
          duel = new AttackDuel(m, dur, diff);
          duel.setupRound();
        },
        onRoundEnd: (m) => app.overlays.attackInterlude(m, duel),
      });
    } else if (mode === 'penalties') {
      app.startMatch({
        mode: 'penalties', home, away, difficulty: diff, halfSeconds: 600, ...extra,
        setup: (m) => new Shootout(m).setupKick(),
      });
    } else {
      app.startMatch({ mode: 'match', home, away, difficulty: diff, halfSeconds: Math.round((dur * 60) / 2), ...extra });
    }
  }
  app.startMode = startMode;

  // ------------------------------------------------------------ settings
  function enterSettings() {
    const el = $('#s-settings');
    const s = app.profile.settings;
    const sw = (key, label, sub = '') => `
      <div class="set-item"><div><div class="si-label">${label}</div>${sub ? `<div class="si-sub">${sub}</div>` : ''}</div>
      <button class="switch" role="switch" aria-checked="${!!s[key]}" data-key="${key}" aria-label="${label}"></button></div>`;
    const segItem = (key, label, items) => `
      <div class="set-item"><div class="si-label">${label}</div>
      <div class="seg" data-seg="${key}">${items.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(s[key]) === String(v)}">${l}</button>`).join('')}</div></div>`;
    el.innerHTML = `${topbar('Instellingen')}
      <div class="settings-list">
        ${sw('sound', 'Geluid', 'Publiek, fluit en effecten')}
        ${'vibrate' in navigator ? sw('vibration', 'Trillen', 'Korte trillingen bij acties') : ''}
        ${segItem('zoom', 'Camera', [[1.25, 'Dichtbij'], [1, 'Normaal'], [0.82, 'Ver']])}
        ${segItem('buttonSize', 'Knoppen', [[0.88, 'Klein'], [1, 'Normaal'], [1.14, 'Groot']])}
        ${sw('lefty', 'Linkshandig', 'Joystick rechts, knoppen links')}
        ${sw('autoSwitch', 'Automatisch wisselen', 'Neemt de beste verdediger over')}
        ${sw('assist', 'Hulp bij verdedigen', 'Speler positioneert zelf als je loslaat')}
        ${sw('radar', 'Radar', 'Minikaart onderaan het scherm')}
        ${sw('replays', 'Herhalingen', 'Herhaling na elk doelpunt')}
        ${sw('offside', 'Buitenspel')}
        ${sw('fullscreen', 'Volledig scherm', 'Bij de aftrap (Android)')}
        <div class="set-item"><div><div class="si-label">Voortgang wissen</div><div class="si-sub">Munten, collectie en team</div></div>
          <button class="btn btn-ghost" id="btn-reset" style="height:38px;font-size:17px">Wissen</button></div>
      </div>
      ${storageAvailable() ? '' : '<p class="legal">Let op: je browser staat opslaan niet toe (privévenster?). Voortgang gaat verloren bij sluiten.</p>'}`;
    el.onclick = (e) => {
      const b = e.target.closest('.switch');
      if (b) {
        const key = b.dataset.key;
        s[key] = !s[key];
        b.setAttribute('aria-checked', String(s[key]));
        if (key === 'sound') app.sound.setEnabled(s.sound);
        app.save();
        app.sound.click();
        return;
      }
      const sb = e.target.closest('[data-seg] button');
      if (sb) {
        const key = sb.parentElement.dataset.seg;
        s[key] = Number(sb.dataset.v);
        for (const x of sb.parentElement.children) x.setAttribute('aria-pressed', String(x === sb));
        app.save();
        app.sound.click();
        return;
      }
      if (e.target.closest('#btn-reset')) {
        if (confirm('Alle voortgang wissen? Dit kan niet ongedaan worden.')) {
          resetProfile();
          location.reload();
        }
      }
    };
  }

  // ------------------------------------------------------------ help
  function enterHelp() {
    const el = $('#s-help');
    el.innerHTML = `${topbar('Hoe speel je?')}
      <div class="help-body"><div class="help-grid">
        <div class="help-card"><h3>Bewegen</h3><ul>
          <li>Leg je duim <b>links</b> op het scherm: de joystick verschijnt waar je drukt.</li>
          <li>Duw tot de rand om te <b>sprinten</b> (de ring licht op), of houd <span class="chip chip-sprint">SPRINT</span> vast.</li></ul></div>
        <div class="help-card"><h3>Aanvallen</h3><ul>
          <li><span class="chip chip-pass">PASS</span> speelt naar de ploegmaat in je looprichting (witte ring = ontvanger). <b>Veeg omhoog</b> = hoge bal of voorzet.</li>
          <li><span class="chip chip-through">DOOR</span> steekt de bal diep voor een lopende spits. Omhoog vegen = lob over de verdediging.</li>
          <li><span class="chip chip-shoot">SCHIET</span> <b>vasthouden</b> voor kracht, loslaten om te schieten. Rood = te hard. Omhoog vegen = <b>stift</b>.</li>
          <li><b>Veeg</b> rechts op een lege plek voor een <b>dribbel-actie</b> in die richting.</li></ul></div>
        <div class="help-card"><h3>Verdedigen</h3><ul>
          <li><span class="chip chip-shoot">TACKLE</span> tik = staande tackle, <b>vegen</b> = sliding (kans op overtreding!).</li>
          <li><span class="chip chip-pass">WISSEL</span> neemt de beste verdediger over.</li>
          <li><span class="chip chip-through">DRUK</span> vasthouden: je speler zet automatisch druk op de bal.</li></ul></div>
        <div class="help-card"><h3>Stilstaande fases</h3><ul>
          <li>Richt met de joystick (pijl), dan <span class="chip chip-pass">PASS</span> of <span class="chip chip-through">LANG</span>.</li>
          <li>Vrije trap en strafschop: <span class="chip chip-shoot">SCHIET</span> vasthouden, joystick kiest de hoek.</li>
          <li>Strafschop tegen: kies met de joystick de hoek waarin je keeper duikt.</li></ul></div>
        <div class="help-card"><h3>Spelmodi</h3><ul>
          <li><b>Snelle wedstrijd</b>: volledige match van 3, 5 of 8 minuten.</li>
          <li><b>Aanvalsduel</b>: je speelt alleen je aanvallen; de aanvallen van de tegenstander worden gesimuleerd.</li>
          <li><b>Gouden Beker</b>: knock-out toernooi met 8 teams.</li>
          <li><b>Strafschoppen</b>: vijf pogingen, daarna sudden death.</li></ul></div>
        <div class="help-card"><h3>Mijn Elf &amp; pakketten</h3><ul>
          <li>Verdien munten met elke wedstrijd (meer op hogere niveaus) en open pakketten.</li>
          <li>Dubbele spelers worden automatisch omgezet in munten.</li>
          <li>Zet spelers op hun eigen positie: buiten positie kost OVR.</li></ul></div>
        <div class="help-card"><h3>Toetsenbord &amp; controller</h3><ul>
          <li>Pijltjes/WASD bewegen · <b>J</b> schieten (vasthouden) · <b>K</b> pass/wissel · <b>L</b> door/druk · <b>Shift</b> sprint · <b>U</b> + actie = hoog · <b>Spatie</b> dribbel.</li>
          <li>Gamepad: stick, A pass, B schiet, Y door, RB/RT sprint, LB = hoog.</li></ul></div>
      </div>
      <p class="legal">Alle spelers, landen, ploegen, vlaggen en tenues in Gouden Elf zijn verzonnen voor dit spel. Elke gelijkenis met bestaande personen of teams berust op toeval. Gouden Elf is een gratis, niet-commercieel hobbyproject. Lettertype Barlow Condensed (SIL Open Font License).</p>
      </div>`;
  }

  const handlers = {
    's-title': () => {},
    's-home': enterHome,
    's-setup': enterSetup,
    's-settings': enterSettings,
    's-help': enterHelp,
    's-squad': squad.enter,
    's-packs': packs.enter,
    's-cup': cup.enter,
  };
  return {
    enter(id) {
      const h = handlers[id];
      if (h) h();
    },
  };
}
