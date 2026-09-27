// In-race HUD: place, progress bar with every rider, speedometer with the
// speed you stole, coins, countdown, banners and the "someone is coming up
// behind you" warning.

import { KMH, MAX_BOOST } from '../config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.pos = $('h-pos');
    this.of = $('h-of');
    this.track = $('h-track');
    this.kmh = $('h-kmh');
    this.stolen = $('h-stolen');
    this.turbo = $('h-turbo');
    this.coins = $('h-coins');
    this.count = $('countdown');
    this.bannerEl = $('banner');
    this.warn = $('warn');
    this.horn = $('btn-horn');
    this.dots = [];
    this.last = {};
    this.bannerT = 0;
  }

  setRace(race) {
    this.track.querySelectorAll('.dot').forEach((d) => d.remove());
    this.dots = race.racers.map((r) => {
      const d = document.createElement('i');
      d.className = 'dot' + (r.isPlayer ? ' me' : '') + (r.isBoss ? ' boss' : '');
      d.style.background = r.color;
      this.track.appendChild(d);
      return d;
    });
    this.of.textContent = `/${race.racers.length}`;
    this.last = {};
    this.bannerT = 0;
    this.bannerEl.classList.remove('show');
    this.count.className = '';
    this.warn.classList.remove('show');
  }

  update(race, dt) {
    const P = race.player;
    const L = this.last;
    const place = P.finished ? race.playerPlace : P.place || race.racers.length;
    if (place !== L.place) {
      this.pos.textContent = `${place}e`;
      this.pos.parentElement.classList.toggle('podium', place <= 3);
      L.place = place;
    }
    const k = Math.round(P.speed / KMH);
    if (k !== L.kmh) {
      this.kmh.textContent = k;
      L.kmh = k;
    }
    const kept = Math.round((P.base - P.base0) / KMH);
    if (kept !== L.kept) {
      this.stolen.textContent = kept > 0 ? `+${kept}` : `${kept}`;
      this.stolen.classList.toggle('show', kept !== 0);
      this.stolen.classList.toggle('neg', kept < 0);
      L.kept = kept;
    }
    const tb = Math.round((P.boost / MAX_BOOST) * 100);
    if (tb !== L.tb) {
      this.turbo.style.transform = `scaleX(${Math.min(1, tb / 100)})`;
      L.tb = tb;
    }
    if (race.stats.coins !== L.coins) {
      this.coins.textContent = race.stats.coins;
      L.coins = race.stats.coins;
    }
    // Progress bar.
    const w = this.track.clientWidth || 1;
    race.racers.forEach((r, i) => {
      const x = Math.round(race.progress(r) * w);
      if (this.dots[i]._x !== x) {
        this.dots[i].style.transform = `translateX(${x}px)`;
        this.dots[i]._x = x;
      }
    });
    // Horn cooldown.
    const hr = P.hornT > 0 ? 1 : 0;
    if (hr !== L.hr) {
      this.horn.classList.toggle('cool', !!hr);
      L.hr = hr;
    }
    // Warning: a faster rider right behind you (they will take your speed!).
    let threat = null;
    if (race.phase === 'race') {
      for (const r of race.racers) {
        if (r === P || r.finished) continue;
        const dz = P.z - r.z;
        if (dz < 60 || dz > 2600 || r.speed < P.speed + 2 * KMH || Math.abs(r.x - P.x) > 0.7 || P.immune > 0) continue;
        if (!threat || dz < P.z - threat.z) threat = r;
      }
    }
    if (threat) {
      this.warn.style.setProperty('--c', threat.color);
      const off = Math.max(-1, Math.min(1, (threat.x - P.x) / 0.7));
      this.warn.style.transform = `translateX(calc(-50% + ${Math.round(off * 22)}vw))`;
      if (!this.warn.classList.contains('show')) this.warn.classList.add('show');
    } else if (this.warn.classList.contains('show')) this.warn.classList.remove('show');
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.bannerEl.classList.remove('show');
    }
  }

  countdown(text) {
    const el = this.count;
    el.textContent = text;
    el.className = '';
    void el.offsetWidth;
    el.className = text === 'GO!' ? 'show go' : 'show';
  }

  banner(html, secs = 1.6, kind = '') {
    const el = this.bannerEl;
    el.innerHTML = html;
    el.className = 'show ' + kind;
    this.bannerT = secs;
  }
}
