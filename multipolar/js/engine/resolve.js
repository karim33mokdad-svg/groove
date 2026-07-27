/* MULTIPOLAR — engine/resolve.js
 * Turning an intention into a forecast, and a forecast into a new world state.
 */
(function (MP) {
  'use strict';

  const clamp = MP.clamp;

  const BOUNDS = {
    econ: [40, 170], approval: [0, 100], cohesion: [0, 100], legit: [0, 100],
    readiness: [0, 100], pressure: [0, 100], adaptation: [0, 0.95], tech: [0, 100],
    warStress: [0, 100], nuclearProgress: [0, 100], coalitionBonus: [0, 1], entangle: [0, 1]
  };

  /* ------------------------------------------------------------------ */
  /* Diminishing returns. Statecraft is not repeatable at constant yield:  */
  /* the second security guarantee to the same partner adds almost        */
  /* nothing, the fourth sanctions package lands on an economy that has    */
  /* already re-routed. Every action carries a decay rate, and repeated    */
  /* use of the same instrument in the same place scales its effect down.  */
  /* ------------------------------------------------------------------ */
  function usageKey(actionId, opts) {
    opts = opts || {};
    return actionId + '@' + (opts.theater || '') + '/' + (opts.target || '');
  }
  function usageCount(S, actor, actionId, opts) {
    const u = S.powers[actor].usage || {};
    return u[usageKey(actionId, opts)] || 0;
  }
  function repetition(S, actor, A, opts) {
    const n = usageCount(S, actor, A.id, opts);
    const dr = A.dr === undefined ? 0.35 : A.dr;
    return { n, factor: 1 / (1 + dr * n) };
  }
  function scaleFx(fx, k) {
    if (k === 1 || !fx) return fx;
    const rung = fx.th && typeof fx.th.rung === 'number' ? fx.th.rung : null;
    const walk = o => {
      if (!o || typeof o !== 'object') return o;
      Object.keys(o).forEach(key => {
        if (typeof o[key] === 'number') o[key] = o[key] * k;
        else if (typeof o[key] === 'object') walk(o[key]);
      });
      return o;
    };
    ['self', 'tgt', 'th', 'g', 'recipientEcon', 'power', 'blocEcon'].forEach(s => { if (fx[s]) walk(fx[s]); });
    if (fx.aff) fx.aff = fx.aff.map(a => [a[0], a[1], a[2] * k]);
    /* rungs are integers: a heavily-discounted action stops moving the ladder */
    if (rung !== null) fx.th.rung = k < 0.55 ? 0 : rung;
    return fx;
  }

  function buildCtx(S, actor, actionId, opts) {
    opts = opts || {};
    const P = MP.POWERS[actor];
    const tdef = opts.theater ? MP.THEATERS[opts.theater] : null;
    const th = opts.theater ? S.theaters[opts.theater] : null;
    const side = tdef ? MP.sideOf(tdef, actor) : null;
    const opp = tdef ? MP.opponentOf(tdef, actor) : null;
    return {
      S, actor, P, ps: S.powers[actor], th, tdef, side,
      opp: opts.target && tdef ? opts.target : opp,
      target: opts.target || (tdef ? opp : null)
    };
  }

  /* Expected-value forecast. Pure — never mutates state. */
  function forecast(S, actor, actionId, opts) {
    const A = MP.ACTION_BY_ID[actionId];
    if (!A) return null;
    const ctx = buildCtx(S, actor, actionId, opts);
    if (!A.avail(ctx)) return null;
    const m = A.model(ctx);

    /* repetition decay */
    const rep = repetition(S, actor, A, opts);
    if (rep.n > 0) {
      scaleFx(m.fx, rep.factor);
      m.factors = m.factors.concat([{
        label: 'Repetition', value: '×' + (Math.round(rep.factor * 100) / 100),
        note: 'used ' + rep.n + '× already — diminishing returns' +
          (rep.factor < 0.55 ? '; no longer moves the escalation ladder' : '')
      }]);
    }

    /* coalition work done earlier in the turn multiplies economic instruments */
    if (A.cat === 'ECON' && ctx.ps.coalitionBonus > 0 && m.fx.tgt) {
      const b = 1 + ctx.ps.coalitionBonus;
      if (m.fx.tgt.econ) m.fx.tgt.econ *= b;
      if (m.fx.tgt.pressure) m.fx.tgt.pressure *= b;
      m.factors = m.factors.concat([{ label: 'Coalition multiplier', value: '×' + (Math.round(b * 100) / 100), note: 'partners lined up earlier this campaign' }]);
    }
    /* red-line exposure is part of the forecast, not a hidden trap */
    let redlineRisk = 0, redlineOpp = null;
    if (opts && opts.theater) {
      const rp = MP.redlineProb(actionId, S, actor, MP.THEATERS[opts.theater], S.theaters[opts.theater]);
      redlineRisk = rp.p; redlineOpp = rp.opp;
      if (redlineRisk > 0.05) {
        m.factors = m.factors.concat([{
          label: 'Red-line exposure', value: Math.round(redlineRisk * 100) + '%',
          note: 'risk of crossing a declared ' + MP.POWERS[redlineOpp].short + ' threshold: ' +
            MP.POWERS[redlineOpp].redlines[0].toLowerCase() + ' — counter-escalation would follow'
        }]);
      }
    }
    return Object.assign({ action: A, ctx, cost: A.pc, redlineRisk, redlineOpp }, m);
  }

  function jitter(v, variance) {
    return v * (1 + (Math.random() * 2 - 1) * variance);
  }

  function applyPowerDelta(S, id, obj, variance) {
    if (!id || !obj) return;
    const p = S.powers[id];
    Object.keys(obj).forEach(k => {
      const raw = obj[k];
      if (typeof raw !== 'number') return;
      const v = variance ? jitter(raw, variance) : raw;
      if (k === 'pc') { p.pc = clamp(p.pc + v, 0, p.pcMax); return; }
      if (p[k] === undefined) { p[k] = 0; }
      /* Cohesion and legitimacy above a power's structural level are expensive
         to buy and cheap to lose — you cannot simply stack summits into a
         perfect alliance. */
      let vv = v;
      if ((k === 'cohesion' && p.cohesionBase !== undefined && p[k] > p.cohesionBase && v > 0) ||
          (k === 'legit' && p.legitBase !== undefined && p[k] > p.legitBase && v > 0)) vv = v * 0.45;
      const b = BOUNDS[k];
      p[k] = b ? clamp(p[k] + vv, b[0], b[1]) : p[k] + vv;
    });
  }

  function applyTheaterDelta(S, thId, obj, variance) {
    if (!thId || !obj) return;
    const t = S.theaters[thId], T = MP.THEATERS[thId];
    if (typeof obj.tension === 'number') t.tension = clamp(t.tension + jitter(obj.tension, variance), 0, 100);
    if (typeof obj.control === 'number') {
      const d = jitter(obj.control, variance);
      t.control = clamp(t.control + d, 2, 98);
      t.momentum = clamp((t.momentum || 0) * 0.6 + d, -12, 12);
    }
    if (typeof obj.rung === 'number' && obj.rung !== 0) {
      t.rung = clamp(Math.round(t.rung + obj.rung), 0, T.escalationCeiling);
    }
    if (typeof obj.deterrence === 'number') t.deterrence = clamp((t.deterrence || 0) + obj.deterrence, 0, 45);
    if (typeof obj.defence === 'number') t.defence = clamp((t.defence || 0) + obj.defence, 0, 45);
  }

  function applyGlobalDelta(S, obj, variance) {
    if (!obj) return;
    if (typeof obj.oil === 'number') S.g.oil = clamp(S.g.oil * (1 + jitter(obj.oil, variance) / 100), 22, 320);
    if (typeof obj.trade === 'number') S.g.trade = clamp(S.g.trade + jitter(obj.trade, variance), 40, 130);
    if (typeof obj.nuclearRisk === 'number') S.g.nuclearRisk = clamp(S.g.nuclearRisk + jitter(obj.nuclearRisk, variance), 0, 100);
    if (typeof obj.food === 'number') S.g.food = clamp(S.g.food + obj.food, 40, 130);
  }

  function applyFx(S, fx, actor, target, thId, variance) {
    if (!fx) return;
    applyPowerDelta(S, actor, fx.self, variance);
    applyPowerDelta(S, target, fx.tgt, variance);
    if (fx.recipientEcon) applyPowerDelta(S, fx.recipientEcon.id, { econ: fx.recipientEcon.econ }, variance);
    applyTheaterDelta(S, thId, fx.th, variance);
    applyGlobalDelta(S, fx.g, variance);
    (fx.aff || []).forEach(a => MP.addAff(S, a[0], a[1], a[2]));
    if (fx.power) Object.keys(fx.power).forEach(id => applyPowerDelta(S, id, fx.power[id], 0));
    if (fx.blocEcon) Object.keys(fx.blocEcon).forEach(id => applyPowerDelta(S, id, { econ: fx.blocEcon[id] }, 0));
  }

  /* Commit an action. Returns a full after-action report for the briefing UI. */
  function execute(S, actor, actionId, opts) {
    const f = forecast(S, actor, actionId, opts);
    if (!f) return { error: 'Action unavailable' };
    const ps = S.powers[actor];
    if (ps.pc < f.cost) return { error: 'Insufficient political capital' };

    ps.pc -= f.cost;
    const thId = opts && opts.theater ? opts.theater : null;
    const target = f.ctx.target;

    /* main effect, with variance */
    applyFx(S, f.fx, actor, target, thId, f.variance);

    /* consume any coalition bonus once used on an economic instrument */
    if (f.action.cat === 'ECON' && ps.coalitionBonus > 0) ps.coalitionBonus = 0;
    if (f.fx.self && typeof f.fx.self.coalitionBonus === 'number' && f.fx.self.coalitionBonus > 0) {
      ps.coalitionBonus = clamp(f.fx.self.coalitionBonus, 0, 1);
    }

    /* record usage for diminishing returns */
    const uk = usageKey(actionId, opts || {});
    S.powers[actor].usage = S.powers[actor].usage || {};
    S.powers[actor].usage[uk] = (S.powers[actor].usage[uk] || 0) + 1;

    /* complications */
    const fired = [];
    (f.risks || []).forEach(rk => {
      if (Math.random() < rk.p) {
        applyFx(S, rk.fx, actor, target, thId, 0.2);
        fired.push(rk.text);
      }
    });

    /* the upside tail: outcomes that only occur if the gamble pays off */
    const boons = [];
    (f.boons || []).forEach(bn => {
      if (Math.random() < bn.p) {
        applyFx(S, bn.fx, actor, target, thId, 0.15);
        boons.push(bn.text);
      }
    });

    /* red lines */
    let redline = null;
    if (thId) {
      redline = MP.crossesRedline(actionId, S, actor, MP.THEATERS[thId], S.theaters[thId]);
      if (redline) {
        applyTheaterDelta(S, thId, { tension: 14, rung: 1 }, 0);
        applyGlobalDelta(S, { nuclearRisk: MP.THEATERS[thId].nuclearDyad ? 5 : 2 }, 0);
        MP.addAff(S, actor, redline.opp, -0.12);
        S.powers[redline.opp].approval = clamp(S.powers[redline.opp].approval + 4, 0, 100);
      }
    }

    ps.lastActions.push(actionId);
    if (ps.lastActions.length > 6) ps.lastActions.shift();

    const entry = {
      turn: S.turn, actor, actionId, target, theater: thId,
      name: f.action.name, cat: f.action.cat,
      narrative: f.narrative, fired, boons, redline
    };
    S.log.push(entry);
    return { ok: true, forecast: f, fired, boons, redline, entry };
  }

  MP.usageKey = usageKey;
  MP.usageCount = usageCount;
  MP.repetition = repetition;
  MP.buildCtx = buildCtx;
  MP.forecast = forecast;
  MP.applyFx = applyFx;
  MP.applyPowerDelta = applyPowerDelta;
  MP.applyTheaterDelta = applyTheaterDelta;
  MP.applyGlobalDelta = applyGlobalDelta;
  MP.execute = execute;
})(window.MP = window.MP || {});
