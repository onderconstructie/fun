// Menu screens: title, home, levels, garage, help and settings.

import { $, $$, esc, fmt, topbar, coinsHTML, medalHTML, ICON_LOCK, ICON_CHECK } from './dom.js';
import { MOPEDS, MOPED_BY_ID, PAINTS, HELMETS, statBars } from '../data/mopeds.js';
import { MAIN_LEVELS, levelTitle, themeOf, isBossLevel, podiumReward } from '../data/levels.js';
import { THEMES, THEME_ORDER } from '../data/themes.js';
import { paintOf, resetProfile, storageAvailable } from '../game/profile.js';
import { drawMopedSide } from '../render/sprites.js';

export function initScreens(app) {
  // ------------------------------------------------------------ title
  $('#btn-start').addEventListener('click', () => {
    app.sound.unlock();
    app.sound.click();
    app.go('s-home', false);
  });

  // ------------------------------------------------------------ home
  $('#tile-race').addEventListener('click', () => app.startRace(nextLevel()));
  $('#btn-fullscreen').addEventListener('click', () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => app.toast('Volledig scherm werkt hier niet'));
    else app.toast('Tip: zet de pagina op je beginscherm voor volledig scherm');
  });

  function nextLevel() {
    return app.profile.unlocked;
  }

  function enterHome() {
    const p = app.profile;
    $('#coins-home b').textContent = fmt(p.coins);
    const n = nextLevel();
    $('#race-level').textContent = `Level ${n}`;
    $('#race-title').textContent = levelTitle(n);
    $('#race-world').textContent = THEMES[themeOf(n)].name + (isBossLevel(n) ? ' · baas!' : '');
    const m = MOPED_BY_ID[p.moped];
    $('#home-moped').textContent = m.name;
    drawMopedSide($('#home-moped-cv'), m, paintOf(p));
    const cheapest = MOPEDS.find((x) => !p.owned.includes(x.id));
    $('#garage-badge').hidden = !(cheapest && p.coins >= cheapest.price);
  }

  // ------------------------------------------------------------ levels
  function levelCard(n) {
    const p = app.profile;
    const locked = n > p.unlocked;
    const best = p.best[n] && p.best[n].place;
    const boss = isBossLevel(n);
    return `<button class="lv ${locked ? 'locked' : ''} ${boss ? 'boss' : ''} th-${themeOf(n)}" data-level="${n}" ${locked ? 'disabled aria-disabled="true"' : ''}>
      <span class="lv-n">${n}</span>
      <span class="lv-t">${esc(levelTitle(n))}</span>
      <span class="lv-r">${locked ? `<i class="lv-lock">${ICON_LOCK}</i>` : best ? medalHTML(best) : `<small title="Muntjes voor de winnaar"><i class="coin"></i>${fmt(podiumReward(n, 1))}</small>`}</span>
      ${boss ? '<span class="lv-boss">BAAS</span>' : ''}
    </button>`;
  }

  function enterLevels() {
    const p = app.profile;
    const el = $('#s-levels');
    let html = `${topbar('Levels', coinsHTML(p.coins))}<div class="levels scroll">`;
    THEME_ORDER.forEach((key, w) => {
      html += `<section class="world"><h3><i class="wdot th-${key}"></i>${esc(THEMES[key].name)}</h3><div class="lv-row">`;
      for (let n = w * 3 + 1; n <= w * 3 + 3; n++) html += levelCard(n);
      html += '</div></section>';
    });
    const last = Math.max(MAIN_LEVELS + 1, p.unlocked + 1);
    html += `<section class="world"><h3><i class="wdot th-endless"></i>Nog moeilijker dan dat!</h3>
      <p class="world-sub">Na level ${MAIN_LEVELS} stopt het niet: elk level is weer wat moeilijker dan het vorige.</p><div class="lv-row">`;
    for (let n = MAIN_LEVELS + 1; n <= last; n++) html += levelCard(n);
    html += '</div></section></div>';
    el.innerHTML = html;
    el.onclick = (e) => {
      const b = e.target.closest('.lv');
      if (b && !b.disabled) app.startRace(Number(b.dataset.level));
    };
    const cur = el.querySelector(`.lv[data-level="${Math.min(p.unlocked, last)}"]`);
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  // ------------------------------------------------------------ garage
  const garage = { view: null, armed: null, armT: null };

  function enterGarage() {
    garage.view = app.profile.moped;
    garage.armed = null;
    renderGarage();
  }

  function renderGarage() {
    const p = app.profile;
    const m = MOPED_BY_ID[garage.view];
    const owned = p.owned.includes(m.id);
    const chosen = p.moped === m.id;
    const color = owned ? paintOf(p, m.id) : m.color;
    let act;
    if (chosen) act = `<button class="btn btn-ghost" disabled>${ICON_CHECK}<span>Jouw brommer</span></button>`;
    else if (owned) act = `<button class="btn btn-primary" data-act="choose"><span>Kiezen</span></button>`;
    else if (p.coins >= m.price) act = `<button class="btn btn-gold" data-act="buy"><i class="coin"></i><span>${garage.armed === m.id ? 'Zeker? Kopen!' : `Kopen · ${fmt(m.price)}`}</span></button>`;
    else act = `<button class="btn btn-ghost" disabled><span>Nog ${fmt(m.price - p.coins)} muntjes</span></button>`;
    const stats = statBars(m)
      .map(([label, v]) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v * 10}%"></i></div></div>`)
      .join('');
    const sw = (list, cur, kind) => list.map((c) => `<button class="sw ${c === cur ? 'on' : ''}" data-${kind}="${c}" style="--c:${c}" aria-label="Kleur ${c}"></button>`).join('');
    const cards = MOPEDS.map((x) => {
      const own = p.owned.includes(x.id);
      const badge = p.moped === x.id ? `<b class="gc-badge on">${ICON_CHECK}</b>` : own ? '' : `<b class="gc-badge"><i class="coin"></i>${fmt(x.price)}</b>`;
      return `<button class="gcard ${x.id === m.id ? 'sel' : ''} ${own ? 'own' : ''}" data-id="${x.id}">
        <canvas width="200" height="114" data-mini="${x.id}"></canvas><span class="gc-name">${esc(x.name)}</span>${badge}</button>`;
    }).join('');
    const el = $('#s-garage');
    el.innerHTML = `${topbar('Garage', coinsHTML(p.coins))}
      <div class="garage">
        <div class="g-main">
          <div class="g-stage ${owned ? 'has-paint' : ''}"><canvas id="g-canvas" width="640" height="366"></canvas><div class="g-top"><b>${m.top}</b> km/u</div>
            ${owned ? `<div class="g-paint"><div class="g-sw" aria-label="Kleur">${sw(PAINTS, color, 'paint')}</div><div class="g-sw helm" aria-label="Helm"><span>Helm</span>${sw(HELMETS, p.helmet, 'helmet')}</div></div>` : ''}
          </div>
          <div class="g-info">
            <h3 class="g-name">${esc(m.name)}</h3>
            <p class="g-desc">${esc(m.desc)}</p>
            <div class="g-stats">${stats}</div>
            <div class="g-act">${act}</div>
          </div>
        </div>
        <div class="g-list">${cards}</div>
      </div>`;
    drawMopedSide($('#g-canvas'), m, color);
    for (const cv of $$('canvas[data-mini]', el)) {
      const x = MOPED_BY_ID[cv.dataset.mini];
      drawMopedSide(cv, x, p.owned.includes(x.id) ? paintOf(p, x.id) : x.color);
    }
    const sel = el.querySelector('.gcard.sel');
    if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  $('#s-garage').addEventListener('click', (e) => {
    const p = app.profile;
    const card = e.target.closest('.gcard');
    if (card) {
      garage.view = card.dataset.id;
      garage.armed = null;
      app.sound.click();
      renderGarage();
      return;
    }
    const m = MOPED_BY_ID[garage.view];
    const b = e.target.closest('[data-act],[data-paint],[data-helmet]');
    if (!b) return;
    if (b.dataset.paint) {
      p.paint[m.id] = b.dataset.paint;
      app.save();
      app.sound.click();
      renderGarage();
    } else if (b.dataset.helmet) {
      p.helmet = b.dataset.helmet;
      app.save();
      app.sound.click();
      renderGarage();
    } else if (b.dataset.act === 'choose') {
      p.moped = m.id;
      app.save();
      app.sound.click();
      app.toast(`Je rijdt nu op de ${m.name}!`);
      renderGarage();
    } else if (b.dataset.act === 'buy') {
      if (garage.armed !== m.id) {
        garage.armed = m.id;
        clearTimeout(garage.armT);
        garage.armT = setTimeout(() => {
          garage.armed = null;
          if (!$('#s-garage').hidden) renderGarage();
        }, 3500);
        app.sound.click();
        renderGarage();
        return;
      }
      if (p.coins < m.price || p.owned.includes(m.id)) return;
      p.coins -= m.price;
      p.owned.push(m.id);
      p.moped = m.id;
      garage.armed = null;
      app.save();
      app.sound.cash();
      app.haptic([20, 40, 30]);
      app.toast(`Gekocht: ${m.name}! Veel plezier.`, 2.6);
      renderGarage();
    }
  });

  // ------------------------------------------------------------ settings
  function enterSettings() {
    const el = $('#s-settings');
    const p = app.profile, s = p.settings;
    const sw = (key, label, sub = '') => `
      <div class="set-item"><div><div class="si-label">${label}</div>${sub ? `<div class="si-sub">${sub}</div>` : ''}</div>
      <button class="switch" role="switch" aria-checked="${!!s[key]}" data-key="${key}" aria-label="${label}"></button></div>`;
    el.innerHTML = `${topbar('Instellingen')}
      <div class="settings-list scroll">
        <div class="set-item"><div><div class="si-label">Jouw naam</div><div class="si-sub">Zie je in de uitslag</div></div>
          <input class="name-in" id="name-in" maxlength="12" autocomplete="off" spellcheck="false" placeholder="Jij" value="${esc(p.name)}"></div>
        ${sw('sound', 'Geluid', 'Motor, botsen en muntjes')}
        ${'vibrate' in navigator ? sw('vibration', 'Trillen', 'Korte trilling bij botsen') : ''}
        <div class="set-item"><div><div class="si-label">Sturen</div><div class="si-sub">Kantelen: houd je toestel als een stuur</div></div>
          <div class="seg" id="seg-steer"><button data-v="touch" aria-pressed="${s.steer !== 'tilt'}">Tikken</button><button data-v="tilt" aria-pressed="${s.steer === 'tilt'}">Kantelen</button></div></div>
        <div class="set-item"><div><div class="si-label">Voortgang wissen</div><div class="si-sub">Muntjes, brommers en levels</div></div>
          <button class="btn btn-ghost btn-sm" id="btn-reset"><span>Wissen</span></button></div>
      </div>
      ${storageAvailable() ? '' : '<p class="legal">Let op: je browser bewaart niets (privévenster?). Je voortgang is weg als je stopt.</p>'}`;
    $('#name-in').addEventListener('change', (e) => {
      p.name = e.target.value.trim().slice(0, 12);
      app.save();
    });
    el.onclick = async (e) => {
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
      const sb = e.target.closest('#seg-steer button');
      if (sb) {
        const v = sb.dataset.v;
        if (v === 'tilt') {
          const ok = await app.controls.enableTilt(true);
          if (!ok) {
            app.toast('Kantelen werkt niet op dit toestel');
            return;
          }
        } else app.controls.enableTilt(false);
        s.steer = v;
        for (const x of sb.parentElement.children) x.setAttribute('aria-pressed', String(x === sb));
        app.save();
        app.sound.click();
        return;
      }
      if (e.target.closest('#btn-reset')) {
        if (confirm('Alles wissen? Je muntjes, brommers en levels zijn dan weg.')) {
          resetProfile();
          location.reload();
        }
      }
    };
  }

  // ------------------------------------------------------------ help
  function enterHelp() {
    $('#s-help').innerHTML = `${topbar('Hoe speel je?')}
      <div class="help-body scroll"><div class="help-grid">
        <div class="help-card"><h3>Sturen</h3><p>Je brommer geeft zelf gas. Houd de <b>linkerkant</b> of <b>rechterkant</b> van het scherm ingedrukt om te sturen.</p></div>
        <div class="help-card"><h3>Remmen</h3><p>Houd <b>REM</b> ingedrukt om langzamer te gaan, bijvoorbeeld voor een tractor. Laat je los, dan geeft je brommer weer zelf gas.</p></div>
        <div class="help-card hot"><h3>Snelheid pakken = boost!</h3><p>Bots tegen een andere brommer, van achteren of opzij. Dan <b>pak je zijn snelheid</b>: jij krijgt een boost van een paar seconden en hij wordt even trager. Wil je voorblijven? Blijf pakken!</p></div>
        <div class="help-card"><h3>Pas op!</h3><p>De anderen kunnen jouw snelheid ook pakken. Zie je onderaan een <b class="warn-chip">!</b>, dan komt er iemand snel achter je aan. Stuur opzij, of rem en laat hem voorbij: dan pak jij hém van achteren.</p></div>
        <div class="help-card"><h3>Slipstream</h3><p>Rij vlak achter iemand. Je hebt dan minder wind tegen en haalt hem sneller in.</p></div>
        <div class="help-card"><h3>Toeter</h3><p>Tik op de <b>toeter</b>: wie vlak voor je rijdt, schrikt en verliest even wat snelheid.</p></div>
        <div class="help-card"><h3>Hindernissen</h3><p>Ontwijk pionnen, plassen, wegwerkzaamheden en tractors. Pak de <b>muntjes</b> op de weg.</p></div>
        <div class="help-card gold"><h3>Top 3 = muntjes</h3><p>Eindig bij de eerste drie en je krijgt <b>heel veel muntjes</b>. Hoe moeilijker het level, hoe meer. Koop er nieuwe brommers mee in de garage.</p></div>
        <div class="help-card"><h3>Levels</h3><p>Top 3 speelt het volgende level vrij. Elke wereld eindigt met een <b>baas</b>. Na level ${MAIN_LEVELS} gaat het door: nog moeilijker dan dat!</p></div>
        <div class="help-card"><h3>Toetsenbord</h3><p>Pijltjes of A/D sturen · pijltje omlaag of S remt · spatie toetert · Esc pauzeert. Een gamepad werkt ook.</p></div>
      </div>
      <p class="legal">Alle namen, brommers en plaatsen in Brommer &amp; the Finish zijn verzonnen. Gratis hobbyproject, geen reclame. Lettertype Barlow Condensed (SIL Open Font License).</p></div>`;
  }

  const handlers = {
    's-title': () => {},
    's-home': enterHome,
    's-levels': enterLevels,
    's-garage': enterGarage,
    's-settings': enterSettings,
    's-help': enterHelp,
  };
  return {
    enter(id) {
      const h = handlers[id];
      if (h) h();
    },
  };
}
