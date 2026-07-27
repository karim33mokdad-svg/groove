/* MULTIPOLAR — engine/turn.js
 * Between-turn dynamics: attrition, economics, domestic politics, escalation
 * decay, the nuclear roll, world events, and campaign scoring.
 */
(function (MP) {
  'use strict';

  const clamp = MP.clamp;

  /* ---------------- battlefield attrition ---------------- */
  function attrition(S) {
    const notes = [];
    MP.theaterList.forEach(id => {
      const t = S.theaters[id], T = MP.THEATERS[id];
      if (t.rung < 5) { t.momentum *= 0.5; return; }

      const A = S.powers[T.sideA], B = S.powers[T.sideB];
      const wA = combatWeight(S, T, 'A'), wB = combatWeight(S, T, 'B');
      const edge = (wA - wB) / Math.max(1, wA + wB);
      /* defence is strongly favoured in attritional warfare: a large material
         edge produces a small territorial shift, not a breakthrough */
      const shift = Math.sign(edge) * Math.pow(Math.abs(edge), 1.4) * 3.2 * (t.rung >= 6 ? 1 : 0.45);
      t.control = clamp(t.control + shift + t.momentum * 0.25, 2, 98);
      t.momentum *= 0.55;

      const intensity = (t.rung - 4) * 0.9;
      A.warStress = clamp(A.warStress + intensity * 1.1, 0, 100);
      B.warStress = clamp(B.warStress + intensity * 1.1, 0, 100);
      A.readiness = clamp(A.readiness - intensity * 1.5, 0, 100);
      B.readiness = clamp(B.readiness - intensity * 1.5, 0, 100);
      A.econ = clamp(A.econ - intensity * 0.35, 40, 170);
      B.econ = clamp(B.econ - intensity * 0.35, 40, 170);

      if (Math.abs(shift) > 1.2) {
        notes.push({
          tag: 'FRONT', headline: 'Lines move in ' + T.name,
          detail: (shift > 0 ? T.sideALabel : T.sideBLabel) + ' gains ground. ' +
            'A material edge of ' + Math.round(Math.abs(edge) * 100) + '% converts into ' +
            Math.abs(Math.round(shift * 10) / 10) + ' points of control — attrition warfare ' +
            'converts advantage into territory very slowly.'
        });
      }
    });
    return notes;
  }

  function combatWeight(S, T, side) {
    const principal = side === 'A' ? T.sideA : T.sideB;
    const p = S.powers[principal], P = MP.POWERS[principal];
    let w = (p.readiness / 100) * (P.power.land * 0.5 + P.power.air * 0.3 + P.power.sea * 0.2) *
      clamp(p.econ / 100, 0.4, 1.3) * (1 - p.warStress / 260);
    (T.backers[principal] || []).forEach(b => {
      const bp = S.powers[b], BP = MP.POWERS[b];
      const support = clamp(MP.getAff(S, b, principal), 0, 1) * (bp.cohesion / 100);
      w += support * (BP.milUSD / 900) * 26;
    });
    const st = S.theaters[T.id];
    w += (side === 'A' ? 1 : -1) * 0 + (st.deterrence || 0) * 0.15;
    return Math.max(1, w);
  }

  /* ---------------- macro ---------------- */
  function economics(S) {
    const oilChange = (S.g.oil - S.gPrevOil) / Math.max(1, S.gPrevOil) * 100;
    MP.powerList.forEach(id => {
      const p = S.powers[id], P = MP.POWERS[id];
      /* oil transmission */
      p.econ += oilChange * P.oilBeta * 0.12;
      /* global trade transmission, weighted by openness (proxy: gdp share of trade) */
      p.econ += (S.g.trade - 100) * 0.02 * clamp(1.4 - P.resilience, 0.3, 1.2);
      /* coercion drag, damped by adaptation */
      p.econ -= (p.pressure / 100) * 1.5 * (1 - p.adaptation);
      /* war economy drag */
      p.econ -= (p.warStress / 100) * 0.9;
      /* mean reversion — economies recover unless something keeps hitting them */
      p.econ += (100 - p.econ) * 0.07;
      p.econ = clamp(p.econ, 40, 170);

      /* adaptation compounds: sanctioned economies learn to route around */
      if (p.pressure > 25) p.adaptation = clamp(p.adaptation + 0.035, 0, 0.95);
      p.pressure = clamp(p.pressure * 0.97, 0, 100);
      p.warStress = clamp(p.warStress * 0.94, 0, 100);
      p.readiness = clamp(p.readiness + 2.5 * clamp(p.econ / 100, 0.4, 1.2), 0, 100);
    });
    S.gPrevOil = S.g.oil;

    /* Relationships have gravity too: warmth bought with summits and capital
       decays back toward the underlying structural interests. */
    Object.keys(S.aff).forEach(k => {
      const ab = k.split('|');
      const base = MP.affinity(ab[0], ab[1]);
      S.aff[k] = S.aff[k] + (base - S.aff[k]) * 0.12;
    });

    /* Iran's programme: sanctions pressure and strikes buy time; they do not
       buy reversal. Absent either constraint or inducement, it creeps forward. */
    const ir = S.powers.IR;
    const lev = S.theaters.LEV;
    let creep = 0.9;
    if (ir.pressure > 55) creep += 0.7;       /* coercion without a deal accelerates hedging */
    if (ir.pressure < 25) creep -= 1.8;       /* relief buys restraint */
    if (lev.rung >= 6) creep += 0.9;          /* under attack, the case for a deterrent wins */
    ir.nuclearProgress = clamp(ir.nuclearProgress + creep, 0, 100);
  }

  function domestic(S) {
    MP.powerList.forEach(id => {
      const p = S.powers[id], P = MP.POWERS[id];
      const econSignal = (p.econ - 100) * 0.22;
      const warSignal = -(p.warStress / 100) * 3.4 * (0.4 + P.domConstr);
      const legitSignal = (p.legit - 50) * 0.03;
      p.approval = clamp(p.approval + econSignal + warSignal + legitSignal + (50 - p.approval) * 0.06, 0, 100);
      /* alliances decay toward their structural level unless actively managed */
      p.cohesion = clamp(p.cohesion + (p.cohesionBase - p.cohesion) * 0.16 + (p.legit - 50) * 0.02, 0, 100);
      p.legit = clamp(p.legit + (p.legitBase - p.legit) * 0.12, 0, 100);
      p.pcMax = 12;
      /* commitments fade: an instrument used long ago recovers some of its bite */
      if (p.usage) Object.keys(p.usage).forEach(k => {
        p.usage[k] *= 0.8;
        if (p.usage[k] < 0.2) delete p.usage[k];
      });
      p.pc = clamp(p.pc + MP.pcIncome(S, id), 0, p.pcMax);
    });
  }

  function escalationDecay(S) {
    const notes = [];
    MP.theaterList.forEach(id => {
      const t = S.theaters[id], T = MP.THEATERS[id];
      /* a shooting war sustains its own temperature: you cannot cool a theatre
         below the level implied by the fighting actually going on in it */
      const floor = t.rung >= 5 ? 34 + t.rung * 5 : 0;
      const baseline = Math.max(T.tension * 0.5 + 10, floor);
      t.tension = clamp(t.tension + (baseline - t.tension) * 0.18, 0, 100);
      t.deterrence = (t.deterrence || 0) * 0.85;
      t.defence = (t.defence || 0) * 0.88;
      /* rungs come down slowly and only when the temperature genuinely drops */
      if (t.tension < 38 && t.rung > (T.rungFloor || 0) && Math.random() < 0.25) { t.rung -= 1; notes.push({ tag: 'DE-ESC', headline: 'Tempo falls in ' + T.name, detail: 'Activity drops back to rung ' + t.rung + ' — ' + MP.LADDER[t.rung].name + '. Ladders are climbed quickly and descended slowly.' }); }
      else if (t.tension > 90 && t.rung < Math.min(6, T.escalationCeiling) && Math.random() < 0.16) {
        t.rung += 1;
        notes.push({ tag: 'ESCALATION', headline: 'Escalation in ' + T.name, detail: 'Sustained tension produces its own momentum: rung ' + t.rung + ' — ' + MP.LADDER[t.rung].name + '. Above this level the ladder is climbed by decision, not by drift.' });
      }

      /* exhaustion: the higher the rung, the more both sides bleed, and the
         more likely somebody quietly stops. Wars end because they cost. */
      if (t.rung >= 6 && t.rung > T.rung - 1 && t.rung > (T.rungFloor || 0)) {
        const stress = (S.powers[T.sideA].warStress + S.powers[T.sideB].warStress) / 200;
        if (Math.random() < stress * 0.15) {
          t.rung -= 1;
          t.tension = clamp(t.tension - 8, 0, 100);
          notes.push({ tag: 'EXHAUSTION', headline: 'Tempo drops in ' + T.name, detail: 'Neither side announces anything. Sortie rates fall, offensives are postponed, and the fighting settles a rung lower at ' + MP.LADDER[t.rung].name + '.' });
        }
      }
      /* cross-theatre spillover: forces and attention are finite */
      if (t.rung >= 7) {
        MP.theaterList.forEach(o => {
          if (o !== id) S.theaters[o].tension = clamp(S.theaters[o].tension + 1.2, 0, 100);
        });
      }
    });
    return notes;
  }

  function markets(S) {
    /* oil finds a level driven by risk premia in the theatres that matter */
    let premium = 0;
    MP.theaterList.forEach(id => {
      const t = S.theaters[id], T = MP.THEATERS[id];
      /* risk premium scales with BOTH temperature and rung — a rung-8 war in a
         producing region is worth far more than a tense one */
      premium += T.oilImpact * (t.tension / 100) * (1 + t.rung / 3) * 14;
    });
    const target = 48 + premium;
    S.g.oil = clamp(S.g.oil + (target - S.g.oil) * 0.35, 22, 320);

    let drag = 0;
    MP.theaterList.forEach(id => {
      const t = S.theaters[id], T = MP.THEATERS[id];
      drag += T.tradeImpact * (t.tension / 100) * (1 + t.rung / 4) * 8;
    });
    const tradeTarget = 108 - drag;
    S.g.trade = clamp(S.g.trade + (tradeTarget - S.g.trade) * 0.32, 40, 130);
    S.g.nuclearRisk = MP.computeNuclearRisk(S);
  }

  /* The roll nobody wants. Risk is a per-turn hazard, not a cliff. */
  function nuclearCheck(S) {
    const r = S.g.nuclearRisk;
    if (r < 55) return null;
    const hazard = Math.pow((r - 55) / 45, 2.4) * 0.22;
    if (Math.random() > hazard) return null;
    const dyads = MP.theaterList.filter(id => MP.THEATERS[id].nuclearDyad && S.theaters[id].rung >= 7);
    const where = dyads.length ? MP.THEATERS[dyads[0]].name : 'a nuclear dyad';
    return {
      tag: 'CATASTROPHE',
      headline: 'Nuclear weapon used in ' + where,
      detail: 'A single low-yield detonation. Every model of what happens next disagrees, and none of ' +
        'them is reassuring. The eighty-year tradition of non-use has ended, and with it the ' +
        'assumption underpinning every strategy on this board.'
    };
  }

  /* ---------------- objectives & scoring ---------------- */
  /* Objectives are calibrated against a measured passive baseline: a player
     who takes no initiative for twelve quarters lands near the middle of the
     range. Everything above that has to be earned, and every objective is a
     real quantity from the model, not a checklist tick.
     lo -> 0, hi -> 1, clamped. */
  const band = (x, lo, hi) => clamp((x - lo) / (hi - lo), 0, 1);
  const tier = (v, good, ok) => v <= good ? 1 : (v <= ok ? 0.5 : 0);

  const OBJ = {
    'US:nopeerwar': S => Math.min(tier(S.theaters.TWN.rung, 4, 6), tier(S.theaters.UKR.rung, 4, 6)),
    'US:cohesion': S => band(S.powers.US.cohesion, 62, 76),
    'US:oil': S => band(S.g.oil, 80, 68),
    'US:approval': S => band(S.powers.US.approval, 46, 60),
    'US:econ': S => band(S.powers.US.econ, 96, 104),

    'CN:taiwan': S => band(S.theaters.TWN.control, 42, 58),
    'CN:nowar': S => tier(S.theaters.TWN.rung, 5, 6),
    'CN:econ': S => band(S.powers.CN.econ, 97, 105),
    'CN:splitalliance': S => band(S.powers.US.cohesion, 78, 64),
    'CN:tech': S => band(S.powers.CN.tech, 52, 70),

    'RU:hold': S => band(S.theaters.UKR.control, 40, 58),
    'RU:sanctions': S => band(S.powers.RU.pressure, 36, 18),
    'RU:natosplit': S => band(S.powers.US.cohesion, 78, 62),
    'RU:approval': S => band(S.powers.RU.approval, 40, 60),
    'RU:oil': S => band(S.g.oil, 68, 86),

    'EU:ukraine': S => Math.min(band(S.powers.UA.econ, 88, 100), band(S.theaters.UKR.control, 64, 50)),
    'EU:energy': S => band(S.g.oil, 80, 68),
    'EU:cohesion': S => band(S.powers.EU.cohesion, 64, 80),
    'EU:noeurowar': S => Math.min(tier(S.theaters.UKR.rung, 5, 6), tier(S.theaters.ARC.rung, 3, 5)),
    'EU:econ': S => band(S.powers.EU.econ, 98, 105),

    'IN:autonomy': S => band(Math.min(MP.getAff(S, 'IN', 'US'), MP.getAff(S, 'IN', 'RU')), 0.2, 0.55),
    'IN:econ': S => band(S.powers.IN.econ, 95, 105),
    'IN:oil': S => band(S.g.oil, 82, 70),
    'IN:kashmir': S => band(S.theaters.KAS.tension, 44, 30),
    'IN:lac': S => tier(S.theaters.HIM.rung, 2, 4),

    'IR:regime': S => band(S.powers.IR.approval, 14, 44),
    'IR:sanctions': S => band(S.powers.IR.pressure, 60, 35),
    'IR:nuclear': S => band(S.powers.IR.nuclearProgress, 45, 75),
    'IR:axis': S => band(100 - S.theaters.LEV.control, 8, 30),
    'IR:nowar': S => tier(S.theaters.LEV.rung, 5, 7),

    'IL:irannuke': S => band(S.powers.IR.nuclearProgress, 88, 55),
    'IL:multifront': S => tier(S.theaters.LEV.rung, 6, 7),
    'IL:ussupport': S => band(MP.getAff(S, 'IL', 'US'), 0.6, 0.9),
    'IL:legit': S => band(S.powers.IL.legit, 18, 34),
    'IL:econ': S => band(S.powers.IL.econ, 92, 102),

    'TR:balance': S => band(Math.min(
      (MP.getAff(S, 'TR', 'US') + MP.getAff(S, 'TR', 'EU')) / 2,
      MP.getAff(S, 'TR', 'RU')), 0.12, 0.45),
    'TR:econ': S => band(S.powers.TR.econ, 97, 104),
    'TR:influence': S => {
      let gains = 0;
      ['LEV', 'UKR', 'SAH', 'ARC'].forEach(t => {
        if (S.theaters[t].tension < MP.THEATERS[t].tension * 0.75) gains++;
      });
      return clamp(gains / 2, 0, 1);
    },
    'TR:approval': S => band(S.powers.TR.approval, 46, 62),
    'TR:nowar': S => MP.theaterList.every(t => !(MP.sideOf(MP.THEATERS[t], 'TR') && S.theaters[t].rung >= 7)) ? 1 : 0
  };

  function scoreCampaign(S) {
    const P = MP.POWERS[S.player];
    const rows = (P.objectives || []).map(o => {
      const fn = OBJ[S.player + ':' + o.id];
      const v = fn ? clamp(fn(S), 0, 1) : 0.5;
      return { id: o.id, text: o.text, w: o.w, value: v };
    });
    const wsum = rows.reduce((s, r) => s + r.w, 0) || 1;
    let score = rows.reduce((s, r) => s + r.w * r.value, 0) / wsum * 100;
    /* the shared penalty: everyone loses if the taboo breaks */
    if (S.ending === 'nuclear') score = Math.min(score, 12);
    const grade = score >= 82 ? 'STRATEGIC SUCCESS' : score >= 64 ? 'FAVOURABLE POSITION'
      : score >= 46 ? 'MIXED OUTCOME' : score >= 28 ? 'STRATEGIC SETBACK' : 'STRATEGIC FAILURE';
    return { score: Math.round(score), grade, rows };
  }

  /* ---------------- the turn ---------------- */
  function endTurn(S) {
    const notes = [];
    S.gPrevOil = S.gPrevOil || S.g.oil;

    /* 1. every other capital moves */
    const aiReports = MP.ai.runAI(S, S.player);

    /* 2. the world moves */
    notes.push.apply(notes, attrition(S));
    notes.push.apply(notes, escalationDecay(S));
    markets(S);
    economics(S);
    domestic(S);

    /* 3. events */
    const evs = [];
    const n = 1 + (Math.random() < 0.45 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const e = MP.drawEvent(S);
      if (!e) continue;
      MP.applyFx(S, e.fx, null, null, null, 0.15);
      if (e.fx && e.fx.th) Object.keys(e.fx.th).forEach(tid => MP.applyTheaterDelta(S, tid, e.fx.th[tid], 0.15));
      evs.push(e);
    }
    S.g.nuclearRisk = MP.computeNuclearRisk(S);

    /* 4. the roll */
    const nuke = nuclearCheck(S);
    if (nuke) { evs.push(nuke); S.over = true; S.ending = 'nuclear'; }

    /* 5. endings */
    const me = S.powers[S.player];
    if (!S.over && me.approval < 12) { S.over = true; S.ending = 'collapse'; }
    if (!S.over && me.econ < 68) { S.over = true; S.ending = 'economic'; }
    if (!S.over && S.turn >= S.maxTurns) { S.over = true; S.ending = 'complete'; }

    S.history.push({
      turn: S.turn,
      oil: Math.round(S.g.oil), trade: Math.round(S.g.trade), nuclearRisk: Math.round(S.g.nuclearRisk),
      econ: Math.round(me.econ), approval: Math.round(me.approval),
      rungs: MP.theaterList.reduce((o, t) => (o[t] = S.theaters[t].rung, o), {})
    });

    if (!S.over) S.turn += 1;
    return { aiReports, notes, events: evs, nuke };
  }

  MP.endTurn = endTurn;
  MP.scoreCampaign = scoreCampaign;
  MP.OBJ = OBJ;
})(window.MP = window.MP || {});
