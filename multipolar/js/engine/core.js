/* MULTIPOLAR — engine/core.js
 * State construction, the escalation ladder, and the shared maths.
 */
(function (MP) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------------ */
  /* Seeded RNG. The engine never calls Math.random directly: every draw  */
  /* goes through MP.rnd. That buys two things — reproducible campaigns,  */
  /* and *common random numbers* for the outcome simulator, so that       */
  /* "with this action" and "without it" can be compared on identical     */
  /* draws instead of on noise.                                           */
  /* ------------------------------------------------------------------ */
  let _s = (Date.now() ^ 0x9e3779b9) >>> 0;
  function srand(seed) { _s = (seed >>> 0) || 0x9e3779b9; }
  function rnd() {
    /* xorshift32 — fast, adequate for this, and identical across engines */
    _s ^= _s << 13; _s >>>= 0;
    _s ^= _s >> 17;
    _s ^= _s << 5; _s >>>= 0;
    return _s / 4294967296;
  }

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
  /* Starting condition, 28 October 2026, from public reporting.
   *
   *   econ      index, 100 = pre-shock trend
   *   pressure  accumulated coercive pressure, 0-100
   *   warStress cumulative strain of active conflict
   *   discontent latent social pressure: unemployment, prices, war fatigue
   *   trust     confidence in institutions, which gates how much of a shock
   *             a government can absorb before it becomes a legitimacy crisis
   */
  const BASELINE = {
    /* Pre-midterm. Inflation re-accelerating on a ~41% oil move; tariffs at an
       effective rate near 18.5%; House and Senate both in play on 3 November. */
    US: { econ: 99, approval: 42, cohesion: 62, legit: 48, readiness: 72, tech: 96,
          discontent: 48, trust: 38, pressure: 3 },
    /* Retail sales slowing, investment contracting, domestic demand the stated
       2026 priority; export controls still biting on the leading edge. */
    CN: { econ: 97, approval: 62, cohesion: 54, legit: 45, readiness: 70, tech: 64,
          discontent: 40, trust: 58, pressure: 16, adaptation: 0.30 },
    /* War economy, deepening energy and technology alignment with Beijing;
       crude exports to China up about 35% year-on-year in Q1 2026. */
    RU: { econ: 88, approval: 56, cohesion: 48, legit: 24, readiness: 58, tech: 42,
          warStress: 54, pressure: 66, adaptation: 0.58, discontent: 46, trust: 42 },
    /* Financing Ukraine while absorbing the energy shock, with inflation back. */
    EU: { econ: 97, approval: 42, cohesion: 60, legit: 66, readiness: 64, tech: 82,
          discontent: 52, trust: 44, pressure: 4 },
    /* Fastest-growing large economy, but $97 oil is a direct tax on the story. */
    IN: { econ: 102, approval: 54, cohesion: 52, legit: 60, readiness: 66, tech: 55,
          discontent: 42, trust: 56, pressure: 4 },
    /* Post-decapitation leadership, degraded nuclear infrastructure, no IAEA
       access, ~440kg of enriched uranium unaccounted for, economy under maximum
       pressure. The most unstable position on the board. */
    IR: { econ: 76, approval: 30, cohesion: 36, legit: 16, readiness: 44, tech: 36,
          warStress: 74, pressure: 84, adaptation: 0.62, nuclearProgress: 26,
          discontent: 74, trust: 22 },
    /* Hung parliament after the 27 October election; caretaker government, two
       active fronts in ceasefire, legitimacy position eroded abroad. */
    IL: { econ: 92, approval: 38, cohesion: 50, legit: 24, readiness: 62, tech: 80,
          warStress: 64, discontent: 58, trust: 40, pressure: 6 },
    /* Straits leverage and drone exports against chronic currency stress. */
    TR: { econ: 95, approval: 44, cohesion: 50, legit: 44, readiness: 64, tech: 42,
          discontent: 56, trust: 42, pressure: 5 },
    /* Commanding majority from the February 2026 snap election; rearming. */
    JP: { econ: 98, approval: 60, cohesion: 66, legit: 62, readiness: 68, tech: 84,
          discontent: 36, trust: 54, pressure: 3 },
    /* Localised ceasefires and talks, but the fiscal and manpower position is
       the worst on the board. */
    UA: { econ: 74, approval: 50, cohesion: 56, legit: 54, readiness: 48, tech: 40,
          warStress: 82, discontent: 66, trust: 46, pressure: 8 },
    TW: { econ: 99, approval: 48, cohesion: 50, legit: 48, readiness: 66, tech: 92,
          discontent: 40, trust: 50, pressure: 6 },
    /* $97 oil is funding the diversification programme. */
    SA: { econ: 106, approval: 60, cohesion: 56, legit: 46, readiness: 64, tech: 40,
          discontent: 32, trust: 54, pressure: 3 },
    KP: { econ: 99, approval: 68, cohesion: 58, legit: 10, readiness: 68, tech: 40,
          pressure: 70, adaptation: 0.74, discontent: 44, trust: 30 },
    /* Mediated the April ceasefire; balance-of-payments position unchanged. */
    PK: { econ: 94, approval: 48, cohesion: 48, legit: 44, readiness: 62, tech: 38,
          discontent: 58, trust: 38, pressure: 10 }
  };

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
      /* baseline 28 Oct 2026: Brent ~$97 after a ~41% rise on the year, IMF
         headline inflation ~4.7% for 2026, trade dragged by the energy shock */
      g: { oil: 97, trade: 96, nuclearRisk: 14, food: 100, inflation: 4.7 },
      log: [],
      feed: [],
      history: [],
      pendingCoalition: 0,
      over: false,
      ending: null
    };

    MP.powerList.forEach(id => {
      const P = MP.POWERS[id];
      const B = BASELINE[id] || {};
      S.powers[id] = {
        id,
        econ: B.econ !== undefined ? B.econ : 100,
        approval: B.approval !== undefined ? B.approval : 52,
        cohesion: B.cohesion !== undefined ? B.cohesion : (P.bloc === 'NATO' ? 64 : P.bloc === 'None' ? 50 : 56),
        legit: B.legit !== undefined ? B.legit : 50,
        readiness: B.readiness !== undefined ? B.readiness : 66,
        pc: 0, pcMax: 12,
        pressure: B.pressure !== undefined ? B.pressure : 4,
        adaptation: B.adaptation !== undefined ? B.adaptation : 0.05,
        tech: B.tech !== undefined ? B.tech : 40,
        warStress: B.warStress !== undefined ? B.warStress : 6,
        coalitionBonus: 0,
        entangle: 0,
        nuclearProgress: B.nuclearProgress !== undefined ? B.nuclearProgress : 0,
        /* sociological state: the domestic substrate that foreign policy sits on */
        discontent: B.discontent !== undefined ? B.discontent : 30,
        trust: B.trust !== undefined ? B.trust : 50,
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

    /* leadership: the office, its clock, and its reference points */
    S.leaders = {};
    MP.powerList.forEach(id => {
      const L = MP.LEADERSHIP[id];
      if (!L) return;
      const T = MP.LEADER_TYPES[L.type];
      S.leaders[id] = {
        id, type: L.type, office: L.office, legitimacy: L.legitimacy,
        vetoPoints: T.vetoPoints, horizon: T.horizon, continuity: T.continuity,
        irregularHazard: T.irregularHazard,
        tenureQ: L.tenureQ, quartersLeft: L.quartersLeft,
        nextContest: L.nextContest, contestType: L.contestType,
        contestKind: L.contestKind || 'executive',
        pContinuity: L.pContinuity,
        consolidating: !!L.consolidating,
        transitions: 0, lastTransition: null,
        /* reference points for prospect framing: where this leadership believes
           it stands, updated slowly so that losses are felt against expectations
           rather than against the current moment */
        refApproval: S.powers[id].approval,
        refStanding: 50
      };
      S.leaders[id].refStanding = MP.leaders.standing(S, id);
    });

    /* Mutable affinity, plus the structural level it reverts toward. Day-to-day
       warmth moves freely; the attractor moves only when something structural
       changes, such as a government. */
    S.affBase = {};
    MP.powerList.forEach(a => MP.powerList.forEach(b => {
      if (a < b) { S.aff[a + '|' + b] = MP.affinity(a, b); S.affBase[a + '|' + b] = MP.affinity(a, b); }
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
    const p = clamp(base * (1 + (1 - effEscTol(S, opp)) * 0.4), 0, 0.95);
    return { p, opp };
  }

  /* Does an action cross one of the opponent's declared thresholds? */
  function crossesRedline(actionId, S, actor, tdef, th) {
    const r = redlineProb(actionId, S, actor, tdef, th);
    if (!r.p || rnd() >= r.p) return null;
    const O = MP.POWERS[r.opp];
    return { opp: r.opp, line: O.redlines[Math.floor(rnd() * O.redlines.length)] };
  }

  /* Nuclear risk: a function of the highest rung in a nuclear dyad, alert
     signalling, and how many nuclear-armed powers are directly engaged. */
  function computeNuclearRisk(S) {
    let risk = S.g.nuclearRisk * 0.74; /* alert states relax quickly once nothing sustains them */
    MP.theaterList.forEach(id => {
      const t = S.theaters[id], T = MP.THEATERS[id];
      if (!T.nuclearDyad) { risk += Math.max(0, t.rung - 7) * 1.5; return; }
      /* A nuclear-armed state at war carries risk even below the top rungs:
         the danger is not only deliberate use but the decision time that
         shrinks as the ladder rises. */
      if (t.rung >= 5) risk += (t.rung - 4) * 1.6;
      if (t.rung >= 6) risk += (t.rung - 5) * 2.0;
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
  /* Effective escalation tolerance: doctrine, plus the leader's current frame,
     plus diversionary incentive, minus the caution an approaching contest
     imposes. This is what the AI and the red-line model actually read, so a
     losing or newly-installed leadership genuinely behaves differently. */
  function effEscTol(S, id) {
    const P = MP.POWERS[id];
    if (!S.leaders || !S.leaders[id]) return P.escTol;
    return clamp(P.escTol + (S.powers[id].escShift || 0) +
      MP.leaders.frameShift(S, id) + MP.leaders.diversionary(S, id) -
      MP.leaders.cycleConstraint(S.leaders[id]) * 0.5, 0.04, 0.96);
  }

  /* Effective domestic constraint: veto points plus electoral proximity. */
  function effConstraint(S, id) {
    const P = MP.POWERS[id];
    if (!S.leaders || !S.leaders[id]) return P.domConstr;
    const L = S.leaders[id];
    return clamp(P.domConstr * 0.45 + L.vetoPoints * 0.55 + MP.leaders.cycleConstraint(L), 0.02, 0.98);
  }

  MP.effEscTol = effEscTol;
  MP.effConstraint = effConstraint;
  MP.BASELINE = BASELINE;
  MP.clamp = clamp;
  MP.srand = srand;
  MP.rnd = rnd;
})(typeof self !== 'undefined' ? (self.MP = self.MP || {}) : (this.MP = this.MP || {}));
