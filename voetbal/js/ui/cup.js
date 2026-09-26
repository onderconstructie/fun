// "Gouden Beker": 8-team knockout. Your ties are played, the rest simulated.

import { $, esc, topbar, coinsHTML } from './dom.js';
import { NATION_TEAMS } from '../data/teams.js';
import { flagSVG } from '../data/nations.js';
import { myTeam } from '../game/profile.js';
import { shuffle } from '../util.js';

const ROUNDS = ['Kwartfinale', 'Halve finale', 'Finale'];
const DIFFS = [['amateur', 'Amateur'], ['pro', 'Pro'], ['wereldklasse', 'Wereldklasse'], ['legende', 'Legende']];
const MULT = { amateur: 0.6, pro: 1, wereldklasse: 1.4, legende: 1.9 };

export function initCup(app) {
  const el = $('#s-cup');
  let pickIdx = 0;
  let diff = null;

  function teams() {
    return [myTeam(app.profile), ...NATION_TEAMS];
  }
  function byId(id) {
    return teams().find((t) => t.id === id);
  }

  function enter() {
    const c = app.profile.cup;
    if (!c) renderStart();
    else renderBracket();
  }

  // ------------------------------------------------------------ start
  function renderStart() {
    const list = teams();
    diff = diff || app.profile.settings.difficulty;
    const t = list[pickIdx % list.length];
    el.innerHTML = `${topbar('Gouden Beker', coinsHTML(app.profile.coins))}
      <div class="setup">
        <p class="tagline" style="margin:0">Win drie knock-outwedstrijden en pak de beker. Gelijk? Dan beslissen strafschoppen.</p>
        <div class="matchup"><div class="team-pick" id="cup-pick">
          <button class="tp-arrow" data-dir="-1" aria-label="Vorig team"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>
          <div class="tp-body"><div class="tp-side me">Jouw team</div><div class="tp-flag">${flagSVG(t.flag)}</div>
            <div class="tp-name">${esc(t.name)}</div><div class="tp-ovr">OVR ${t.ovr}</div></div>
          <button class="tp-arrow" data-dir="1" aria-label="Volgend team"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>
        </div></div>
        <div class="setup-opts"><div class="opt-row"><span class="opt-label">Niveau</span><div class="seg" id="cup-diff">${DIFFS.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === diff}">${l}</button>`).join('')}</div></div></div>
        <button class="btn btn-gold btn-xl" id="cup-go"><span>Start toernooi</span></button>
      </div>`;
  }

  function createCup() {
    const list = teams();
    const me = list[pickIdx % list.length];
    const others = shuffle(NATION_TEAMS.filter((t) => t.id !== me.id).map((t) => t.id)).slice(0, 7);
    const ids = shuffle([me.id, ...others]);
    app.profile.cup = { me: me.id, diff, teams: ids, round: 0, results: [[], [], []], out: false, champion: null };
    app.save();
  }

  // ------------------------------------------------------------ bracket
  function pairings(c, r) {
    // Teams alive at the start of round r, in bracket order.
    let alive = c.teams.slice();
    for (let k = 0; k < r; k++) {
      alive = c.results[k].map((res) => (res.winner === res.a ? res.a : res.b));
    }
    const out = [];
    for (let i = 0; i < alive.length; i += 2) out.push([alive[i], alive[i + 1]]);
    return out;
  }

  function tieHTML(a, b, res, me) {
    const row = (id, score, win) => {
      const t = byId(id);
      if (!t) return '';
      return `<div class="tie-row ${res ? (win ? 'win' : 'lose') : ''}"><span class="card-flag">${flagSVG(t.flag)}</span><span>${esc(t.name)}</span><span>${score ?? ''}</span></div>`;
    };
    const sa = res ? `${res.sa}${res.pens ? ` (${res.pa})` : ''}` : '';
    const sb = res ? `${res.sb}${res.pens ? ` (${res.pb})` : ''}` : '';
    return `<div class="tie ${a === me || b === me ? 'mine' : ''}">${row(a, sa, res && res.winner === a)}${row(b, sb, res && res.winner === b)}</div>`;
  }

  function renderBracket() {
    const c = app.profile.cup;
    const cols = [];
    for (let r = 0; r < 3; r++) {
      const pairs = r <= c.round || c.results[r].length ? pairings(c, r) : [];
      const ties = pairs.map(([a, b], i) => tieHTML(a, b, c.results[r][i], c.me)).join('');
      const empty = Array.from({ length: 4 >> r }, () => `<div class="tie"><div class="tie-row"><span></span><span style="opacity:.4">–</span><span></span></div><div class="tie-row"><span></span><span style="opacity:.4">–</span><span></span></div></div>`).join('');
      cols.push(`<div class="round"><h3>${ROUNDS[r]}</h3><div class="ties">${ties || empty}</div></div>`);
    }
    const champ = c.champion ? byId(c.champion) : null;
    cols.push(`<div class="round"><h3>Winnaar</h3><div class="ties"><div class="tie ${c.champion === c.me ? 'mine' : ''}" style="padding:10px;text-align:center">
      ${champ ? `<div class="tp-flag" style="margin:0 auto 6px">${flagSVG(champ.flag)}</div><b style="font-size:20px">${esc(champ.name)}</b>` : '<span style="opacity:.5;font-size:40px">🏆</span>'}</div></div></div>`);
    let action;
    if (c.champion) action = `<button class="btn btn-gold" id="cup-new"><span>Nieuw toernooi</span></button>`;
    else if (c.out) action = `<span class="tagline" style="margin:0">Uitgeschakeld.</span><button class="btn btn-gold" id="cup-new"><span>Nieuw toernooi</span></button>`;
    else {
      const opp = nextOpponent(c);
      action = `<button class="btn btn-primary btn-xl" id="cup-play"><span>Speel ${ROUNDS[c.round].toLowerCase()} · ${esc(byId(opp).name)}</span></button>
        <button class="btn btn-ghost" id="cup-quit" style="height:44px;font-size:17px">Opgeven</button>`;
    }
    el.innerHTML = `${topbar('Gouden Beker', coinsHTML(app.profile.coins))}
      <div class="bracket">${cols.join('')}</div>
      <div class="cup-foot">${action}</div>`;
  }

  function nextOpponent(c) {
    const pairs = pairings(c, c.round);
    const mine = pairs.find(([a, b]) => a === c.me || b === c.me);
    return mine[0] === c.me ? mine[1] : mine[0];
  }

  // Quick probabilistic result for AI-vs-AI ties.
  function simulate(a, b) {
    const ta = byId(a), tb = byId(b);
    const pois = (lam) => {
      let k = 0, p = Math.exp(-lam), s = p;
      const u = Math.random();
      while (u > s && k < 9) {
        k++;
        p *= lam / k;
        s += p;
      }
      return k;
    };
    const d = (ta.ovr - tb.ovr) / 12;
    const sa = pois(1.35 * Math.exp(d)), sb = pois(1.35 * Math.exp(-d));
    const res = { a, b, sa, sb, winner: sa > sb ? a : b };
    if (sa === sb) {
      res.pens = true;
      res.pa = 3 + Math.floor(Math.random() * 3);
      res.pb = res.pa + (Math.random() < 0.5 + d * 0.1 ? -1 : 1);
      if (res.pb < 0) res.pb = res.pa + 1;
      res.winner = res.pa > res.pb ? a : b;
    }
    return res;
  }

  function recordRound(c, myRes) {
    const pairs = pairings(c, c.round);
    c.results[c.round] = pairs.map(([a, b]) => {
      if (a === c.me || b === c.me) {
        const flip = b === c.me;
        return flip ? { a, b, sa: myRes.sb, sb: myRes.sa, pens: myRes.pens, pa: myRes.pb, pb: myRes.pa, winner: myRes.winner } : { a, b, ...myRes, winner: myRes.winner };
      }
      return simulate(a, b);
    });
    if (myRes.winner !== c.me) c.out = true;
    else if (c.round === 2) c.champion = c.me;
    if (!c.out && !c.champion) c.round++;
    // If we are out, simulate the rest so the bracket completes.
    if (c.out) {
      for (let r = c.round + 1; r < 3; r++) c.results[r] = pairings(c, r).map(([a, b]) => simulate(a, b));
      const f = c.results[2][0];
      c.champion = f ? f.winner : null;
    }
    app.save();
  }

  function playTie() {
    const c = app.profile.cup;
    const me = byId(c.me), opp = byId(nextOpponent(c));
    const half = Math.round((app.profile.settings.duration * 60) / 2);
    const mult = MULT[c.diff] ?? 1;
    app.startMatch({
      mode: 'cup', cup: true, home: me, away: opp, difficulty: c.diff, halfSeconds: half, returnTo: 's-cup',
      onResult: (m) => {
        const sa = m.teams[0].score, sb = m.teams[1].score;
        if (sa === sb) {
          // Decide by penalties right away (simulated if not played).
          c.pendingDraw = { sa, sb };
          app.save();
          return { note: 'Gelijkspel! Druk op Verder voor de strafschoppen.', coins: 0 };
        }
        const res = { sa, sb, winner: sa > sb ? c.me : opp.id };
        recordRound(c, res);
        let coins = sa > sb ? Math.round((300 * mult) / 10) * 10 : 0;
        let note = sa > sb ? (c.champion === c.me ? 'KAMPIOEN! De Gouden Beker is van jou.' : 'Door naar de volgende ronde!') : 'Uitgeschakeld in de beker.';
        if (c.champion === c.me) {
          coins += Math.round((3000 * mult) / 10) * 10;
          app.profile.stats.cups++;
        }
        return { note, coins };
      },
    });
  }

  function playPens() {
    const c = app.profile.cup;
    const me = byId(c.me), opp = byId(nextOpponent(c));
    const d = c.pendingDraw;
    app.startMode('penalties', me, opp, c.diff, 0, {
      cup: true,
      returnTo: 's-cup',
      onResult: (m) => {
        const pa = m.teams[0].score, pb = m.teams[1].score;
        const res = { sa: d.sa, sb: d.sb, pens: true, pa, pb, winner: pa > pb ? c.me : opp.id };
        c.pendingDraw = null;
        recordRound(c, res);
        let coins = 0;
        let note = pa > pb ? (c.champion === c.me ? 'KAMPIOEN na strafschoppen!' : 'Door na strafschoppen!') : 'Uitgeschakeld na strafschoppen.';
        if (c.champion === c.me) {
          coins += Math.round((3000 * (MULT[c.diff] ?? 1)) / 10) * 10;
          app.profile.stats.cups++;
        }
        return { note, coins };
      },
    });
  }

  el.addEventListener('click', (e) => {
    const c = app.profile.cup;
    const arrow = e.target.closest('#cup-pick .tp-arrow');
    if (arrow) {
      const n = teams().length;
      pickIdx = (pickIdx + Number(arrow.dataset.dir) + n) % n;
      app.sound.click();
      renderStart();
      return;
    }
    const d = e.target.closest('#cup-diff button');
    if (d) {
      diff = d.dataset.v;
      app.sound.click();
      renderStart();
      return;
    }
    if (e.target.closest('#cup-go')) {
      createCup();
      app.sound.click();
      renderBracket();
      return;
    }
    if (e.target.closest('#cup-play')) {
      if (c.pendingDraw) playPens();
      else playTie();
      return;
    }
    if (e.target.closest('#cup-new')) {
      app.profile.cup = null;
      app.save();
      renderStart();
      return;
    }
    if (e.target.closest('#cup-quit')) {
      if (confirm('Toernooi opgeven?')) {
        app.profile.cup = null;
        app.save();
        renderStart();
      }
    }
  });

  return {
    enter() {
      const c = app.profile.cup;
      if (c && c.pendingDraw) {
        renderBracket();
        const btn = $('#cup-play span');
        if (btn) btn.textContent = 'Naar de strafschoppen';
        return;
      }
      enter();
    },
  };
}

