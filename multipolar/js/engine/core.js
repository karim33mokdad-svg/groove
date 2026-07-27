/* MULTIPOLAR — engine/core.js
 * State construction, the escalation ladder, and the shared maths.
 */
(function (MP) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------------ */
  /* The escalation ladder. Shared across all theatres so that a rung    */
  /* means the same thing everywhere — that is what makes cross-theatre  */
  /* spillover legible.                                                  */
  /* ------------------------------------------------------------------ */
  const LADDER = [
    { r: 0, name: 'Normal competition', desc: 'Rivalry conducted through trade, diplomacy and influence.' },
    { r: 1, name: 'Diplomatic friction', desc: 'Protests, expulsions, recalled ambassadors.' },
    { r: 2, name: 'Coercive posturing', desc: 'Exercises, deployments, declaratory threats.' },
    { r: 3, name: 'Grey-zone operations', desc: 'Deniable action: cyber, sabotage, militia, cable cuts.' },
    { r: 4, name: 'Armed incidents', desc: 'Shots fired, shoot-downs, seizures. Casualties are few and contested.' },
    { r: 5, name: 'Limited strikes', desc: 'Acknowledged military strikes on defined target sets.' },
    { r: 6, name: 'Sustained operations', desc: 'Open warfare between organised forces. No off-ramp is in use.' },
    { r: 7, name: 'Major theatre war', desc: 'Full mobilised conflict; great powers directly engaged.' },
    { r: 8, name: 'Strategic strikes', desc: 'Attacks on homelands, C2 and strategic infrastructure.' },
    { r: 9, name: 'Nuclear alert', desc: 'Forces dispersed and readied. Decision timelines collapse to minutes.' },
    { r: 10, name: 'Nuclear use', desc: 'The model stops being a game here.' }
  ];

  /* ------------------------------------------------------------------ */
  function newState(playerId, turns) {
    const S = {
      version: 1,
      player: playerId,
      turn: 1,
      maxTurns: turns || 12,
      quarterOf: t => {
        const q = ((t - 1) % 4) + 1, y = 2026 + Math.floor((t - 1) / 4);
        return 'Q' + q + ' ' + y;
      },
      powers: {},
      theaters: {},
      aff: {},
      g: { oil: 78, trade: 100, nuclearRisk: 6, food: 100 },
      log: [],
      feed: [],
      history: [],
      pendingCoalition: 0,
      over: false,
      ending: null
    };

    MP.powerList.forEach(id => {
      const P = MP.POWERS[id];
      S.powers[id] = {
        id,
        econ: 100,
        approval: id === 'RU' ? 62 : id === 'CN' ? 66 : id === 'KP' ? 70 : id === 'IR' ? 44 : id === 'US' ? 46 : id === 'EU' ? 48 : id === 'IL' ? 44 : id === 'UA' ? 58 : 52,
        cohesion: P.bloc === 'NATO' ? 68 : P.bloc === 'None' ? 50 : 58,
        legit: id === 'RU' ? 26 : id === 'KP' ? 10 : id === 'IR' ? 24 : id === 'IL' ? 32 : id === 'CN' ? 46 : id === 'US' ? 58 : id === 'EU' ? 70 : id === 'IN' ? 62 : 50,
        readiness: id === 'RU' ? 62 : id === 'UA' ? 55 : id === 'US' ? 74 : 68,
        pc: 0, pcMax: 12,
        pressure: id === 'RU' ? 62 : id === 'IR' ? 70 : id === 'KP' ? 78 : 4,
        adaptation: id === 'RU' ? 0.45 : id === 'IR' ? 0.55 : id === 'KP' ? 0.7 : 0.05,
        tech: id === 'US' ? 96 : id === 'CN' ? 62 : id === 'EU' ? 82 : id === 'JP' ? 84 : id === 'TW' ? 92 : id === 'RU' ? 44 : id === 'IN' ? 54 : id === 'IL' ? 80 : 40,
        warStress: id === 'RU' ? 42 : id === 'UA' ? 66 : id === 'IL' ? 38 : id === 'IR' ? 28 : 6,
        coalitionBonus: 0,
        entangle: 0,
        nuclearProgress: id === 'IR' ? 62 : 0,
        lastActions: [], usage: {}
      };
      /* structural baselines: alliances and relationships have gravity, and
         drift back toward the underlying interests that produced them */
      S.powers[id].cohesionBase = S.powers[id].cohesion;
      S.powers[id].legitBase = S.powers[id].legit;
      S.powers[id].pc = pcIncome(S, id);
    });

    MP.theaterList.forEach(id => {
      const T = MP.THEATERS[id];
      S.theaters[id] = {
        id,
        control: T.control,
        tension: T.tension,
        rung: T.rung,
        deterrence: 0,
        defence: 0,
        momentum: 0,
        events: []
      };
    });

    /* mutable affinity copy so relationships can actually move */
    MP.powerList.forEach(a => MP.powerList.forEach(b => {
      if (a < b) S.aff[a + '|' + b] = MP.affinity(a, b);
    }));

    return S;
  }

  function getAff(S, a, b) {
    if (a === b) return 1;
    const k = a < b ? a + '|' + b : b + '|' + a;
    return S.aff[k] !== undefined ? S.aff[k] : MP.affinity(a, b);
  }
  function addAff(S, a, b, d) {
    if (a === b) return;
    const k = a < b ? a + '|' + b : b + '|' + a;
    S.aff[k] = clamp(getAff(S, a, b) + d, -1, 1);
  }

  /* Political capital regenerated each turn: legitimacy at home and abroad
     is what lets a government spend on foreign policy at all. */
  function pcIncome(S, id) {
    const p = S.powers[id], P = MP.POWERS[id];
    const domestic = (p.approval / 100) * (1 + (1 - P.domConstr));
    const external = (p.legit / 100) * 0.6 + (p.cohesion / 100) * 0.6;
    const economic = clamp(p.econ / 100, 0.5, 1.3);
    return clamp(Math.round((2.2 + domestic * 2.6 + external * 2.2) * economic), 1, 12);
  }

  /* Which side of a theatre a power sits on, including via its backers. */
  function sideOf(tdef, id) {
    if (tdef.sideA === id) return 'A';
    if (tdef.sideB === id) return 'B';
    if ((tdef.backers[tdef.sideA] || []).indexOf(id) >= 0) return 'A';
    if ((tdef.backers[tdef.sideB] || []).indexOf(id) >= 0) return 'B';
    return null;
  }
  function principal(tdef, side) { return side === 'A' ? tdef.sideA : tdef.sideB; }
  function opponentOf(tdef, id) {
    const s = sideOf(tdef, id);
    if (!s) return null;
    return principal(tdef, s === 'A' ? 'B' : 'A');
  }

  /* Does an action cross one of the opponent's declared thresholds? The model
     keys off action id + theatre state rather than parsing the prose. */
  function redlineProb(actionId, S, actor, tdef, th) {
    if (!tdef) return { p: 0, opp: null };
    const opp = opponentOf(tdef, actor);
    if (!opp || opp === actor) return { p: 0, opp: null };
    const O = MP.POWERS[opp];
    const hard = {
      mil_strike: th.rung >= 5 ? 0.55 : 0.3,
      mil_deploy: (tdef.id === 'UKR' && opp === 'RU') ? 0.75 : 0.12,
      mil_nuclear_signal: 0.4,
      mil_covert: 0.3,
      eco_energy: (opp === 'IR' || opp === 'RU') ? 0.3 : 0.08
    };
    const base = hard[actionId] || 0;
    if (base <= 0) return { p: 0, opp: null };
    /* a capital with low escalation tolerance draws its lines closer in */
    const p = clamp(base * (1 + (1 - O.escTol) * 0.4), 0, 0.95);
    return { p, opp };
  }

  /* Does an action cross one of the opponent's declared thresholds? */
  function crossesRedline(actionId, S, actor, tdef, th) {
    const r = redlineProb(actionId, S, actor, tdef, th);
    if (!r.p || Math.random() >= r.p) return null;
    const O = MP.POWERS[r.opp];
    return { opp: r.opp, line: O.redlines[Math.floor(Math.random() * O.redlines.length)] };
  }

  /* Nuclear risk: a function of the highest rung in a nuclear dyad, alert
     signalling, and how many nuclear-armed powers are directly engaged. */
  function computeNuclearRisk(S) {
    let risk = S.g.nuclearRisk * 0.80; /* alert states relax if nothing sustains them */
    MP.theaterList.forEach(id => {
      const t = S.theaters[id], T = MP.THEATERS[id];
      if (!T.nuclearDyad) { risk += Math.max(0, t.rung - 7) * 1.5; return; }
      if (t.rung >= 6) risk += (t.rung - 5) * 2.2;
      if (t.rung >= 8) risk += 7;
      if (t.tension > 85) risk += 1.2;
    });
    return clamp(risk, 2, 100);
  }

  MP.LADDER = LADDER;
  MP.newState = newState;
  MP.getAff = getAff;
  MP.addAff = addAff;
  MP.pcIncome = pcIncome;
  MP.sideOf = sideOf;
  MP.principal = principal;
  MP.opponentOf = opponentOf;
  MP.crossesRedline = crossesRedline;
  MP.redlineProb = redlineProb;
  MP.computeNuclearRisk = computeNuclearRisk;
  MP.clamp = clamp;
})(window.MP = window.MP || {});
