/* MULTIPOLAR — ui/ui.js  (all screens and interaction) */
(function (MP) {
  'use strict';

  const $ = id => document.getElementById(id);
  const h = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sign = v => (v > 0 ? '+' : '') + (Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v));

  const UI = { screen: 'splash', sel: null, pending: null, tab: 'ALL', S: null, choice: null };

  /* ================= screens ================= */
  function show(name) {
    UI.screen = name;
    ['splash', 'select', 'board', 'brief', 'end', 'dossier'].forEach(s => {
      const e = $('scr-' + s);
      if (e) e.classList.toggle('on', s === name);
    });
    window.scrollTo(0, 0);
  }
  function closeSheet() { $('sheet').classList.remove('on'); }
  function openSheet(build) {
    const b = $('sheet-body');
    b.innerHTML = '';
    b.appendChild(h('div', 'grab'));
    build(b);
    $('sheet').classList.add('on');
    b.scrollTop = 0;
  }

  /* ================= power selection ================= */
  function renderSelect() {
    const wrap = $('select-body');
    wrap.innerHTML = '';
    wrap.appendChild(h('div', 'eyebrow', 'Step 1 — choose your seat'));
    wrap.appendChild(h('h2', null, 'Which capital?'));
    wrap.appendChild(h('p', 'muted tiny', 'Every seat has a different problem. The United States has the most ' +
      'instruments and the most commitments; Russia has the fewest and the highest tolerance for risk. ' +
      'Difficulty is a property of the position, not a setting.'));

    const grid = h('div', 'pgrid');
    grid.style.marginTop = '14px';
    MP.playableList.forEach(id => {
      const P = MP.POWERS[id];
      const b = h('button', 'pcard' + (UI.choice === id ? ' sel' : ''));
      b.innerHTML = '<i class="bar" style="background:' + P.color + '"></i>' +
        '<div class="flag">' + P.flag + '</div>' +
        '<div class="nm">' + esc(P.name) + '</div>' +
        '<div class="sub">' + esc(P.bloc) + ' · $' + P.gdp + 'tn · ' +
        (P.warheads ? P.warheads.toLocaleString() + ' warheads' : 'non-nuclear') + '</div>';
      b.onclick = () => { UI.choice = id; renderSelect(); renderDossier(id); };
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    wrap.appendChild(h('div', null, '<div id="dossier-slot"></div>'));
    if (UI.choice) renderDossier(UI.choice);
    $('start-btn').disabled = !UI.choice;
    $('start-btn').textContent = UI.choice ? 'Take the seat — ' + MP.POWERS[UI.choice].name : 'Select a capital';
  }

  function renderDossier(id) {
    const slot = $('dossier-slot');
    if (!slot) return;
    const P = MP.POWERS[id];
    slot.innerHTML = '';
    const c = h('div', 'card');
    c.style.marginTop = '12px';
    c.innerHTML =
      '<div class="row between"><h3>' + P.flag + ' ' + esc(P.name) + '</h3>' +
      '<span class="pill">' + esc(P.bloc) + '</span></div>' +
      '<p class="tiny muted" style="margin:8px 0 12px">' + esc(P.brief) + '</p>' +
      '<div class="eyebrow">Position</div>' +
      stat('GDP', '$' + P.gdp + ' tn') +
      stat('Defence outlay', '$' + P.milUSD + ' bn') +
      stat('Active personnel', (P.troops / 1000).toFixed(0) + 'k') +
      stat('Nuclear stockpile', P.warheads ? P.warheads.toLocaleString() + (P.undeclared ? ' (undeclared)' : '') : (P.threshold ? 'threshold state' : 'none')) +
      stat('UNSC veto', P.veto ? 'yes' + (P.vetoNote ? ' (' + P.vetoNote + ')' : '') : 'no') +
      stat('Escalation tolerance', bars(P.escTol)) +
      stat('Domestic constraint', bars(P.domConstr)) +
      stat('Coercion resilience', bars(P.resilience)) +
      '<div class="eyebrow" style="margin-top:14px">Doctrine</div>' +
      '<p class="tiny muted" style="margin-top:5px">' + esc(P.doctrine) + '</p>' +
      '<div class="eyebrow" style="margin-top:14px">Declared red lines</div>' +
      P.redlines.map(r => '<div class="obj">' + esc(r) + '</div>').join('') +
      '<div class="eyebrow" style="margin-top:14px">Campaign objectives</div>' +
      P.objectives.map(o => '<div class="obj">' + esc(o.text) + '</div>').join('');
    slot.appendChild(c);
  }
  const stat = (k, v) => '<div class="stat"><span class="muted">' + k + '</span><b>' + v + '</b></div>';
  const bars = v => {
    const n = Math.round(v * 5);
    return '<span style="letter-spacing:2px">' + '▮'.repeat(n) + '<span style="opacity:.25">' + '▮'.repeat(5 - n) + '</span></span>';
  };

  /* ================= board ================= */
  function renderBoard() {
    const S = UI.S, P = MP.POWERS[S.player], ps = S.powers[S.player];

    /* top bar */
    const top = $('topbar');
    top.innerHTML =
      '<div class="l1"><div class="who">' + P.flag + ' ' + esc(P.name) + '</div>' +
      '<div class="qtr">' + S.quarterOf(S.turn) + ' · turn ' + S.turn + '/' + S.maxTurns + '</div></div>' +
      '<div class="pcbar">' +
      Array.from({ length: 12 }, (_, i) => '<i class="pcdot' + (i < ps.pc ? ' on' : '') + '"></i>').join('') +
      '<span class="pclabel">' + Math.round(ps.pc) + ' political capital</span></div>';

    /* indices */
    const nr = Math.round(S.g.nuclearRisk);
    $('indices').innerHTML =
      idx('Oil', '$' + Math.round(S.g.oil), S.g.oil > 90 ? 'up' : S.g.oil < 70 ? 'dn' : '') +
      idx('Trade', Math.round(S.g.trade), S.g.trade < 92 ? 'up' : '') +
      idx('Economy', Math.round(ps.econ), ps.econ < 96 ? 'up' : ps.econ > 103 ? 'dn' : '') +
      idx('Nuclear risk', nr, nr > 45 ? 'up' : '');

    /* national condition */
    const cond = $('condition');
    cond.innerHTML =
      gauge('Approval', ps.approval, ps.approval < 30 ? 'var(--red)' : 'var(--amber)') +
      gauge('Alliance cohesion', ps.cohesion, 'var(--cyan)') +
      gauge('Legitimacy', ps.legit, 'var(--violet)') +
      gauge('Readiness', ps.readiness, 'var(--green)') +
      (ps.pressure > 8 ? gauge('Coercive pressure on you', ps.pressure, 'var(--red)') : '');

    /* standing warnings — you should be able to see a collapse coming */
    const warns = [];
    if (ps.approval < 25) warns.push('Domestic support is at ' + Math.round(ps.approval) +
      '. Below 12 your government falls and the campaign ends. Restraint and economic recovery are the only ways back.');
    if (ps.econ < 88) warns.push('The economy is at ' + Math.round(ps.econ) +
      '. Below 68 you lose the ability to fund any of this.');
    if (S.g.nuclearRisk > 45) warns.push('Nuclear risk is at ' + Math.round(S.g.nuclearRisk) +
      '. Above 55 there is a hazard roll every quarter, and it ends the campaign for everyone.');
    if (ps.pressure > 45) warns.push('Coercive pressure on you is at ' + Math.round(ps.pressure) +
      '. Your economy is being ground down; adaptation takes quarters to build.');
    $('warnings').innerHTML = warns.map(w => '<div class="warn">⚠ ' + w + '</div>').join('');

    /* map */
    const mw = $('mapwrap');
    mw.innerHTML = '';
    mw.appendChild(MP.map.render(S, UI.sel, id => openTheater(id)));

    /* theatres */
    const list = $('theaters');
    list.innerHTML = '';
    MP.theaterList
      .slice()
      .sort((a, b) => (S.theaters[b].rung * 10 + S.theaters[b].tension / 10) - (S.theaters[a].rung * 10 + S.theaters[a].tension / 10))
      .forEach(id => list.appendChild(theaterCard(id)));

    $('endturn').textContent = S.turn >= S.maxTurns ? 'Final assessment ▸' : 'End quarter ▸';
  }
  const idx = (k, v, cls) => '<div><div class="k">' + k + '</div><div class="v ' + (cls || '') + '">' + v + '</div></div>';
  const gauge = (k, v, col) =>
    '<div style="margin-bottom:9px"><div class="row between tiny"><span class="muted">' + k + '</span>' +
    '<b>' + Math.round(v) + '</b></div><div class="meter"><i style="width:' + Math.max(1, Math.min(100, v)) +
    '%;background:' + col + '"></i></div></div>';

  function theaterCard(id) {
    const S = UI.S, T = MP.THEATERS[id], t = S.theaters[id];
    const side = MP.sideOf(T, S.player);
    const col = MP.map.rungColor(t.rung);
    const b = h('button', 'thcard');
    const mine = side ? (side === 'A' ? t.control : 100 - t.control) : null;
    b.innerHTML =
      '<div class="hd"><div><div class="nm">' + esc(T.name) + '</div>' +
      '<div class="rgn">' + esc(T.region) + (side ? ' · you back ' + esc(side === 'A' ? T.sideALabel : T.sideBLabel) : ' · not engaged') + '</div></div>' +
      '<div class="rg" style="background:' + col + '22;color:' + col + ';border:1px solid ' + col + '55">RUNG ' + t.rung + '</div></div>' +
      '<div class="ctrlbar"><i style="width:' + t.control + '%;background:#ff7a7a"></i>' +
      '<i style="width:' + (100 - t.control) + '%;background:#58c6ff"></i></div>' +
      '<div class="legend"><span>' + esc(T.sideALabel) + ' ' + Math.round(t.control) + '%</span>' +
      '<span>' + (mine !== null ? '<b style="color:var(--amber)">your side ' + Math.round(mine) + '%</b>' : MP.LADDER[t.rung].name) + '</span>' +
      '<span>' + Math.round(100 - t.control) + '% ' + esc(T.sideBLabel) + '</span></div>' +
      '<div class="meter" style="margin-top:8px"><i style="width:' + t.tension + '%;background:linear-gradient(90deg,#ffb547,#ff5a5a)"></i></div>' +
      '<div class="legend"><span>tension ' + Math.round(t.tension) + '</span><span>' + esc(MP.LADDER[t.rung].name) + '</span></div>';
    b.onclick = () => openTheater(id);
    return b;
  }

  /* ================= theatre sheet ================= */
  function openTheater(id) {
    UI.sel = id;
    const S = UI.S, T = MP.THEATERS[id], t = S.theaters[id];
    openSheet(body => {
      body.appendChild(h('div', 'eyebrow', T.region));
      body.appendChild(h('h2', null, T.name));
      body.appendChild(h('p', 'tiny muted', esc(T.brief)));

      const st = h('div', 'card');
      st.style.marginTop = '12px';
      const side = MP.sideOf(T, S.player), opp = MP.opponentOf(T, S.player);
      st.innerHTML =
        stat('Escalation', 'rung ' + t.rung + ' — ' + MP.LADDER[t.rung].name) +
        stat(T.axisLabel, Math.round(t.control) + ' / ' + Math.round(100 - t.control)) +
        stat('Tension', Math.round(t.tension) + '/100') +
        stat('Your position', side ? 'backing ' + (side === 'A' ? T.sideALabel : T.sideBLabel) : 'not aligned here') +
        stat('Principal opponent', opp ? MP.POWERS[opp].flag + ' ' + MP.POWERS[opp].name : '—') +
        stat('Ceiling', 'rung ' + T.escalationCeiling + (T.nuclearDyad ? ' · nuclear dyad' : '')) +
        '<div class="quote" style="margin-top:12px">' + MP.LADDER[t.rung].desc + '</div>';
      body.appendChild(st);

      const dr = h('div', 'card');
      dr.innerHTML = '<div class="eyebrow">What is actually driving this</div>' +
        T.drivers.map(d => '<div class="obj">' + esc(d) + '</div>').join('');
      body.appendChild(dr);

      body.appendChild(h('div', 'eyebrow', 'Instruments available here'));
      body.appendChild(actionList({ theater: id }));
    });
  }

  /* ================= instruments (non-theatre) ================= */
  function openInstruments() {
    openSheet(body => {
      body.appendChild(h('div', 'eyebrow', 'Statecraft'));
      body.appendChild(h('h2', null, 'Global instruments'));
      body.appendChild(h('p', 'tiny muted', 'Actions aimed at another capital rather than at a particular theatre.'));
      body.appendChild(actionList({}));
    });
  }

  function actionList(opts) {
    const S = UI.S, box = h('div');
    const tabs = h('div', 'tabs');
    ['ALL', 'DIP', 'INFO', 'MIL', 'ECON'].forEach(c => {
      const b = h('button', UI.tab === c ? 'on' : null, c === 'ALL' ? 'All' : MP.CATS[c].icon + ' ' + MP.CATS[c].name.slice(0, 4));
      b.onclick = () => { UI.tab = c; const nb = actionList(opts); box.replaceWith(nb); };
      tabs.appendChild(b);
    });
    box.appendChild(tabs);

    const ps = S.powers[S.player];
    let n = 0;
    MP.ACTIONS.forEach(A => {
      if (UI.tab !== 'ALL' && A.cat !== UI.tab) return;
      /* an action is listed if it is legal for at least one target/theatre */
      let probe = null;
      if (A.scope === 'theater') {
        if (!opts.theater) return;
        probe = MP.forecast(S, S.player, A.id, { theater: opts.theater });
      } else if (A.scope === 'power') {
        const cands = MP.powerList.filter(x => x !== S.player);
        for (const t of cands) {
          probe = MP.forecast(S, S.player, A.id, Object.assign({}, opts, { target: t }));
          if (probe) break;
        }
      } else {
        probe = MP.forecast(S, S.player, A.id, opts);
      }
      if (!probe) return;
      n++;
      const afford = ps.pc >= A.pc;
      const card = h('button', 'acard' + (afford ? '' : ' off'));
      card.innerHTML =
        '<div class="t"><span class="nm">' + esc(A.name) + '</span>' +
        '<span class="cost">' + A.pc + ' PC</span></div>' +
        '<div class="row" style="gap:6px;margin-top:6px"><span class="pill ' + A.cat.toLowerCase() + '">' +
        MP.CATS[A.cat].icon + ' ' + MP.CATS[A.cat].name + '</span></div>' +
        '<div class="bl">' + esc(A.blurb) + '</div>';
      card.onclick = () => {
        if (!afford) { toast('Not enough political capital — end the quarter to recover.'); return; }
        if (A.scope === 'power' && !opts.target) pickTarget(A, opts);
        else openForecast(A.id, opts);
      };
      box.appendChild(card);
    });
    if (!n) box.appendChild(h('p', 'tiny muted', 'No instruments of this type are available here.'));
    return box;
  }

  function pickTarget(A, opts) {
    const S = UI.S;
    openSheet(body => {
      body.appendChild(h('div', 'eyebrow', A.name));
      body.appendChild(h('h2', null, 'Directed at whom?'));
      const list = h('div');
      MP.powerList.filter(x => x !== S.player).forEach(id => {
        const o = Object.assign({}, opts, { target: id });
        const f = MP.forecast(S, S.player, A.id, o);
        if (!f) return;
        const P = MP.POWERS[id], aff = MP.getAff(S, S.player, id);
        const rel = aff > 0.5 ? 'ally' : aff > 0.15 ? 'partner' : aff > -0.15 ? 'neutral' : aff > -0.5 ? 'rival' : 'adversary';
        const b = h('button', 'acard');
        b.innerHTML = '<div class="t"><span class="nm">' + P.flag + ' ' + esc(P.name) + '</span>' +
          '<span class="cost" style="color:var(--dim)">' + rel + '</span></div>' +
          '<div class="bl">$' + P.gdp + 'tn · relationship ' + (Math.round(aff * 100) / 100) + '</div>';
        b.onclick = () => openForecast(A.id, o);
        list.appendChild(b);
      });
      body.appendChild(list);
    });
  }

  /* ================= forecast ================= */
  function deltaRows(f) {
    const S = UI.S, fx = f.fx, rows = [];
    const names = {
      econ: 'economic index', approval: 'approval', cohesion: 'alliance cohesion',
      legit: 'international legitimacy', readiness: 'military readiness',
      pressure: 'coercive pressure', tech: 'technology access', warStress: 'war stress',
      nuclearProgress: 'nuclear programme', pc: 'political capital'
    };
    const add = (label, v, invert) => {
      if (typeof v !== 'number' || Math.abs(v) < 0.05) return;
      rows.push({ label, v, invert: !!invert });
    };
    Object.keys(fx.self || {}).forEach(k => names[k] && add('Your ' + names[k], fx.self[k]));
    if (f.ctx.target && fx.tgt) {
      const T = MP.POWERS[f.ctx.target];
      /* for a target, "less" is normally the outcome you want — except for the
         pressure and war-stress you are trying to impose on them */
      const notInverted = { pressure: 1, warStress: 1 };
      Object.keys(fx.tgt).forEach(k => names[k] &&
        add(T.short + ' ' + names[k], fx.tgt[k], !notInverted[k]));
    }
    if (fx.recipientEcon) add(MP.POWERS[fx.recipientEcon.id].short + ' economic index', fx.recipientEcon.econ);
    if (fx.th && f.ctx.tdef) {
      const T = f.ctx.tdef;
      add('Theatre tension', fx.th.tension, true);
      if (typeof fx.th.control === 'number') {
        const side = f.ctx.side;
        const v = side === 'B' ? -fx.th.control : fx.th.control;
        rows.push({ label: side ? 'Balance toward your side' : 'Balance toward ' + T.sideALabel, v, invert: false });
      }
      if (fx.th.rung) rows.push({ label: 'Escalation rung', v: fx.th.rung, invert: true });
      if (fx.th.deterrence) add('Deterrent posture', fx.th.deterrence);
      if (fx.th.defence) add('Defensive coverage', fx.th.defence);
    }
    if (fx.g) {
      if (fx.g.oil) rows.push({ label: 'Oil price', v: fx.g.oil, pct: true, invert: MP.POWERS[S.player].oilBeta < 0 });
      add('Global trade index', fx.g.trade);
      add('Nuclear risk', fx.g.nuclearRisk, true);
    }
    return rows;
  }

  function openForecast(actionId, opts) {
    const S = UI.S;
    const f = MP.forecast(S, S.player, actionId, opts);
    if (!f) { toast('That is not available.'); return; }
    UI.pending = { actionId, opts };

    openSheet(body => {
      body.appendChild(h('div', 'eyebrow', MP.CATS[f.action.cat].name + ' instrument · ' + f.cost + ' PC'));
      body.appendChild(h('h2', null, f.action.name +
        (f.ctx.tdef ? ' — ' + f.ctx.tdef.name : f.ctx.target ? ' — ' + MP.POWERS[f.ctx.target].name : '')));
      body.appendChild(h('p', 'tiny muted', esc(f.action.blurb)));

      /* projected effects */
      const pr = h('div', 'card');
      pr.style.marginTop = '12px';
      let html = '<div class="eyebrow">Projected effect this quarter</div>';
      const rows = deltaRows(f);
      if (!rows.length) html += '<p class="tiny muted" style="margin-top:8px">No measurable first-order effect.</p>';
      rows.forEach(r => {
        const good = r.invert ? r.v < 0 : r.v > 0;
        const lo = r.v * (1 - f.variance), hi = r.v * (1 + f.variance);
        html += '<div class="fx"><span class="lbl">' + esc(r.label) + '</span>' +
          '<span class="val ' + (good ? 'pos' : 'neg') + '">' + sign(r.v) + (r.pct ? '%' : '') +
          '<span class="band">range ' + sign(Math.min(lo, hi)) + ' … ' + sign(Math.max(lo, hi)) + '</span></span></div>';
      });
      pr.innerHTML = html;
      body.appendChild(pr);

      /* why the model says so */
      const fac = h('div', 'card');
      fac.innerHTML = '<div class="eyebrow">Why the model says so</div>' +
        f.factors.map(x => '<div class="factor"><div class="fh"><span>' + esc(x.label) + '</span><b>' +
          esc(String(x.value)) + '</b></div><div class="fn">' + esc(x.note) + '</div></div>').join('');
      body.appendChild(fac);

      if (f.redlineRisk > 0.05) {
        body.appendChild(h('div', 'warn', '⚠ <b>Red-line exposure ' + Math.round(f.redlineRisk * 100) + '%.</b> ' +
          esc(MP.POWERS[f.redlineOpp].name) + ' has declared thresholds covering this kind of action. ' +
          'Crossing one produces counter-escalation that you do not control.'));
      }
      if (f.risks && f.risks.length) {
        body.appendChild(h('div', 'card',
          '<div class="eyebrow">Ways this goes wrong</div>' +
          f.risks.map(r => '<div class="factor"><div class="fh"><span>' + esc(r.text) + '</span><b>' +
            Math.round(r.p * 100) + '%</b></div></div>').join('')));
      }
      if (f.boons && f.boons.length) {
        body.appendChild(h('div', 'card',
          '<div class="eyebrow">Ways this goes right</div>' +
          f.boons.map(r => '<div class="factor"><div class="fh"><span>' + esc(r.text) + '</span><b>' +
            Math.round(r.p * 100) + '%</b></div></div>').join('')));
      }

      body.appendChild(h('div', 'note', '<b>Precedent.</b> ' + esc(f.precedent)));

      const go = h('button', 'btn', 'Commit — ' + f.cost + ' PC');
      go.onclick = () => commit(actionId, opts);
      body.appendChild(go);
      const no = h('button', 'btn ghost', 'Back');
      no.onclick = closeSheet;
      body.appendChild(no);
    });
  }

  /* ================= commit ================= */
  function commit(actionId, opts) {
    const S = UI.S;
    const before = snapshot(S);
    const res = MP.execute(S, S.player, actionId, opts);
    if (res.error) { toast(res.error); return; }
    const after = snapshot(S);
    MP.save(S);
    openSheet(body => {
      body.appendChild(h('div', 'eyebrow', 'After-action assessment'));
      body.appendChild(h('h2', null, res.forecast.action.name));
      body.appendChild(h('p', 'tiny muted', esc(res.forecast.narrative)));

      if (res.redline) {
        body.appendChild(h('div', 'warn', '⚠ <b>Red line crossed.</b> ' +
          esc(MP.POWERS[res.redline.opp].name) + ' treats this as: “' + esc(res.redline.line) + '”. ' +
          'The theatre has escalated and the response is now theirs to choose.'));
      }
      res.fired.forEach(t => body.appendChild(h('div', 'warn', '▸ ' + esc(t))));
      (res.boons || []).forEach(t => body.appendChild(h('div', 'note', '▸ ' + esc(t))));

      body.appendChild(diffCard(before, after, 'What actually moved'));

      const go = h('button', 'btn', 'Continue');
      go.onclick = () => { closeSheet(); renderBoard(); };
      body.appendChild(go);
    });
  }

  function snapshot(S) {
    const ps = S.powers[S.player];
    const o = {
      econ: ps.econ, approval: ps.approval, cohesion: ps.cohesion, legit: ps.legit,
      readiness: ps.readiness, pressure: ps.pressure, pc: ps.pc,
      oil: S.g.oil, trade: S.g.trade, nuclearRisk: S.g.nuclearRisk, th: {}
    };
    MP.theaterList.forEach(t => {
      o.th[t] = { tension: S.theaters[t].tension, control: S.theaters[t].control, rung: S.theaters[t].rung };
    });
    return o;
  }

  function diffCard(a, b, title) {
    const S = UI.S, c = h('div', 'card');
    const rows = [];
    const row = (label, delta, now, good, unit) => {
      if (Math.abs(delta) < 0.25) return;
      rows.push('<div class="fx"><span class="lbl">' + esc(label) + '</span><span class="val ' +
        (good ? 'pos' : 'neg') + '">' + sign(delta) +
        (now === null ? '' : '<span class="band">now ' + Math.round(now) + (unit || '') + '</span>') +
        '</span></div>');
    };
    const push = (label, x, y, invert) => {
      const d = y - x;
      row(label, d, y, invert ? d < 0 : d > 0);
    };
    push('Economic index', a.econ, b.econ);
    push('Approval', a.approval, b.approval);
    push('Alliance cohesion', a.cohesion, b.cohesion);
    push('Legitimacy', a.legit, b.legit);
    push('Readiness', a.readiness, b.readiness);
    push('Coercive pressure on you', a.pressure, b.pressure, true);
    push('Oil price', a.oil, b.oil, MP.POWERS[S.player].oilBeta > 0);
    push('Global trade', a.trade, b.trade);
    push('Nuclear risk', a.nuclearRisk, b.nuclearRisk, true);

    MP.theaterList.forEach(t => {
      const T = MP.THEATERS[t], side = MP.sideOf(T, S.player);
      const dc = b.th[t].control - a.th[t].control;
      if (Math.abs(dc) > 0.25) {
        /* express the shift from the player's point of view */
        const v = side === 'B' ? -dc : dc;
        const now = side === 'B' ? 100 - b.th[t].control : b.th[t].control;
        row(T.name + ' — ' + (side ? 'your side holds' : T.sideALabel + ' holds'), v, now, v > 0, '%');
      }
      push(T.name + ' — tension', a.th[t].tension, b.th[t].tension, true);
      if (b.th[t].rung !== a.th[t].rung) {
        rows.push('<div class="fx"><span class="lbl">' + esc(T.name) + ' — escalation</span><span class="val ' +
          (b.th[t].rung < a.th[t].rung ? 'pos' : 'neg') + '">rung ' + a.th[t].rung + ' → ' + b.th[t].rung +
          '<span class="band">' + esc(MP.LADDER[b.th[t].rung].name) + '</span></span></div>');
      }
    });
    c.innerHTML = '<div class="eyebrow">' + title + '</div>' +
      (rows.length ? rows.join('') : '<p class="tiny muted" style="margin-top:8px">Nothing measurable moved.</p>');
    return c;
  }

  /* ================= end of quarter ================= */
  function endTurn() {
    const S = UI.S;
    const before = snapshot(S);
    const out = MP.endTurn(S);
    const after = snapshot(S);
    MP.save(S);

    const body = $('brief-body');
    body.innerHTML = '';
    body.appendChild(h('div', 'eyebrow', 'Intelligence summary'));
    body.appendChild(h('h2', null, S.quarterOf(Math.max(1, S.turn - (S.over ? 0 : 1)))));

    const feed = h('div');
    feed.style.marginTop = '8px';
    out.aiReports.forEach(r => {
      const P = MP.POWERS[r.actor];
      const where = r.theater ? MP.THEATERS[r.theater].name : (r.target ? MP.POWERS[r.target].name : 'globally');
      feed.appendChild(feedItem(r.cat.toLowerCase(), P.flag + ' ' + P.short + ' — ' + r.name,
        where, r.narrative + (r.redline ? ' This crosses a declared ' + MP.POWERS[r.redline.opp].short + ' red line.' : '')));
    });
    out.notes.forEach(n => feed.appendChild(feedItem(n.tag === 'ESCALATION' ? 'bad' : 'evt', n.headline, n.tag, n.detail)));
    out.events.forEach(e => feed.appendChild(feedItem(e.tag === 'CATASTROPHE' ? 'bad' : 'evt', e.headline, e.tag, e.detail)));
    if (!feed.children.length) feed.appendChild(h('p', 'tiny muted', 'A quiet quarter. Nobody moved.'));
    body.appendChild(feed);
    body.appendChild(diffCard(before, after, 'Net change to your position'));

    const cont = h('button', 'btn', S.over ? 'Final assessment ▸' : 'Continue to ' + S.quarterOf(S.turn));
    cont.onclick = () => { if (S.over) renderEnd(); else { show('board'); renderBoard(); } };
    body.appendChild(cont);
    show('brief');
  }

  function feedItem(cls, head, sub, text) {
    const d = h('div', 'feeditem ' + cls);
    d.innerHTML = '<div class="fs">' + esc(sub) + '</div><div class="fh">' + esc(head) + '</div>' +
      '<div class="fb">' + esc(text) + '</div>';
    return d;
  }

  /* ================= end screen ================= */
  function renderEnd() {
    const S = UI.S, sc = MP.scoreCampaign(S), P = MP.POWERS[S.player];
    const body = $('end-body');
    body.innerHTML = '';
    const endings = {
      complete: ['Campaign complete', 'Twelve quarters of decisions, compounded.'],
      nuclear: ['Nuclear use', 'A weapon was used. Every objective on your list became irrelevant the moment it detonated — which is precisely why the threshold is modelled as a cliff and not a slope.'],
      collapse: ['Government fell', 'Domestic support collapsed below the level at which any foreign policy can be sustained. Foreign policy is downstream of domestic politics, always.'],
      economic: ['Economic collapse', 'The economy contracted past the point where the instruments of statecraft could be paid for.']
    };
    const e = endings[S.ending] || endings.complete;

    body.appendChild(h('div', 'eyebrow', P.flag + ' ' + P.name + ' · ' + S.quarterOf(S.turn)));
    body.appendChild(h('h2', null, e[0]));
    body.appendChild(h('p', 'tiny muted', e[1]));

    const card = h('div', 'card');
    card.style.marginTop = '14px';
    card.innerHTML = '<div class="scorebig">' + sc.score + '</div><div class="grade">' + sc.grade + '</div>' +
      '<div class="eyebrow" style="margin-top:18px">Objectives</div>' +
      sc.rows.map(r => '<div class="objrow"><div class="ot"><span>' + esc(r.text) + '</span><b>' +
        Math.round(r.value * 100) + '%</b></div><div class="om"><i style="width:' +
        Math.round(r.value * 100) + '%"></i></div></div>').join('');
    body.appendChild(card);

    /* trajectory */
    if (S.history.length) {
      const mx = Math.max.apply(null, S.history.map(x => x.nuclearRisk).concat([20]));
      const sp = h('div', 'card');
      sp.innerHTML = '<div class="eyebrow">Nuclear risk by quarter</div><div class="spark">' +
        S.history.map(x => '<i style="height:' + Math.max(3, x.nuclearRisk / mx * 100) + '%;background:' +
          (x.nuclearRisk > 45 ? 'var(--red)' : 'var(--amber)') + '"></i>').join('') + '</div>' +
        '<div class="legend"><span>' + S.quarterOf(1) + '</span><span>peak ' + Math.round(mx) + '</span></div>' +
        '<div class="eyebrow" style="margin-top:14px">Oil price by quarter</div><div class="spark">' +
        (function () {
          const os = S.history.map(x => x.oil), lo = Math.min.apply(null, os) * 0.92, hi = Math.max.apply(null, os) * 1.02;
          return S.history.map(x => '<i style="height:' + Math.max(4, (x.oil - lo) / Math.max(1, hi - lo) * 100) +
            '%;background:var(--cyan)"></i>').join('');
        })() +
        '</div><div class="legend"><span>$' + S.history[0].oil + '</span><span>$' + S.history[S.history.length - 1].oil + '</span></div>';
      body.appendChild(sp);
    }

    /* where the world ended up */
    const w = h('div', 'card');
    w.innerHTML = '<div class="eyebrow">The board you leave behind</div>' +
      MP.theaterList.map(t => {
        const T = MP.THEATERS[t], st = S.theaters[t], base = T.rung;
        const arrow = st.rung > base ? '▲' : st.rung < base ? '▼' : '=';
        const col = st.rung > base ? 'var(--red)' : st.rung < base ? 'var(--green)' : 'var(--dim)';
        return '<div class="stat"><span class="muted">' + esc(T.name) + '</span><b style="color:' + col + '">' +
          arrow + ' rung ' + st.rung + ' (' + MP.LADDER[st.rung].name + ')</b></div>';
      }).join('');
    body.appendChild(w);

    const again = h('button', 'btn', 'New campaign');
    again.onclick = () => { MP.clearSave(); UI.choice = null; renderSelect(); show('select'); };
    body.appendChild(again);
    const rev = h('button', 'btn ghost', 'Review the decision log');
    rev.onclick = () => openLog();
    body.appendChild(rev);
    show('end');
  }

  function openLog() {
    const S = UI.S;
    openSheet(body => {
      body.appendChild(h('div', 'eyebrow', 'Decision log'));
      body.appendChild(h('h2', null, 'Every move, in order'));
      const mine = S.log.filter(e => e.actor === S.player);
      if (!mine.length) body.appendChild(h('p', 'tiny muted', 'You never moved.'));
      mine.forEach(e => {
        const where = e.theater ? MP.THEATERS[e.theater].name : (e.target ? MP.POWERS[e.target].name : 'global');
        body.appendChild(feedItem(e.cat.toLowerCase(), e.name + ' — ' + where,
          'Q' + (((e.turn - 1) % 4) + 1) + ' ' + (2026 + Math.floor((e.turn - 1) / 4)),
          e.narrative + (e.redline ? ' [RED LINE CROSSED]' : '')));
      });
    });
  }

  /* ================= misc ================= */
  let toastT = null;
  function toast(msg) {
    let t = $('toast');
    if (!t) {
      t = h('div'); t.id = 'toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:90;' +
        'background:#1c2536;border:1px solid #35496b;color:#e8eef8;padding:10px 16px;border-radius:10px;' +
        'font-size:13px;max-width:88%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5)';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2200);
  }

  function openAbout() {
    openSheet(body => {
      body.appendChild(h('div', 'eyebrow', 'About the model'));
      body.appendChild(h('h2', null, 'What this is, and what it is not'));
      body.appendChild(h('div', 'note',
        '<b>This is a simulation, not a prediction.</b> It is a transparent model built from ' +
        'open-source figures and widely-documented strategic behaviour. It cannot tell you what ' +
        'will happen. It can show you how the pieces are coupled — which is the part most ' +
        'commentary leaves out.'));
      body.appendChild(h('p', 'tiny muted',
        'Every number the model uses is visible before you commit an action: trade leverage, coalition ' +
        'breadth, force projection, target adaptation, red-line exposure. If a forecast looks wrong to ' +
        'you, the inputs are on screen and you can argue with them. That is the point.'));
      body.appendChild(h('div', 'card',
        '<div class="eyebrow">Modelling choices worth knowing</div>' +
        ['Sanctions bite in proportion to coalition breadth and the target\'s ability to substitute; ' +
          'repeated packages decay as adaptation rises.',
          'Attrition converts material advantage into territory very slowly. Defence is favoured.',
          'The escalation ladder is climbed quickly and descended slowly. Above rung 6 it moves only ' +
          'by deliberate decision or by crossing a declared red line.',
          'Nuclear use is a per-quarter hazard driven by the risk index, not a scripted event. ' +
          'It ends the campaign for everyone.',
          'Every instrument has diminishing returns. The second identical move is worth less than the first.',
          'Relationships have gravity: warmth bought with summits decays back toward structural interests.'
        ].map(x => '<div class="obj">' + esc(x) + '</div>').join('')));
      body.appendChild(h('div', 'card',
        '<div class="eyebrow">Figures</div><p class="tiny muted" style="margin-top:6px">' +
        'GDP, defence outlays, manpower and warhead counts are rounded open-source approximations for a ' +
        '2025/26 baseline, of the kind published by the IMF, SIPRI, IISS and FAS. They are tuned for ' +
        'playability and should not be cited. Theatre descriptions summarise widely-reported public ' +
        'facts as of the model baseline; they are not an intelligence product and take no side.</p>'));
      body.appendChild(h('p', 'tiny muted',
        'Not affiliated with, endorsed by, or representing any government or organisation. ' +
        'Real conflicts kill real people; this is a strategy game about the structure of decisions, ' +
        'and it deliberately abstracts away the human cost it cannot represent honestly.'));
      const b = h('button', 'btn ghost', 'Close');
      b.onclick = closeSheet;
      body.appendChild(b);
    });
  }

  /* ================= boot ================= */
  function start(playerId, turns) {
    UI.S = MP.newState(playerId, turns);
    MP.save(UI.S);
    show('board');
    renderBoard();
  }

  function init() {
    $('go-select').onclick = () => { renderSelect(); show('select'); };
    $('about-1').onclick = openAbout;
    $('about-2').onclick = openAbout;
    $('start-btn').onclick = () => { if (UI.choice) start(UI.choice, 12); };
    $('back-splash').onclick = () => show('splash');
    $('endturn').onclick = endTurn;
    $('instruments').onclick = openInstruments;
    $('sheet-scrim').onclick = closeSheet;
    $('log-btn').onclick = openLog;

    const saved = MP.load();
    if (saved && !saved.over) {
      UI.S = saved;
      $('resume-btn').classList.remove('hide');
      $('resume-btn').textContent = 'Resume — ' + MP.POWERS[saved.player].name + ', ' + saved.quarterOf(saved.turn);
      $('resume-btn').onclick = () => { show('board'); renderBoard(); };
    }
  }

  MP.ui = { init, show, renderBoard, toast, UI };
})(window.MP = window.MP || {});
