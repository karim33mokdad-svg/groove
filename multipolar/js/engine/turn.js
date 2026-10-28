/* MULTIPOLAR — engine/turn.js
 * Between-turn dynamics: attrition, economics, domestic politics, escalation
 * decay, the nuclear roll, world events, and campaign scoring.
 */
(function (MP) {
  'use strict';

  const clamp = MP.clamp;

  /* Approximately normal, mean 0, sd ~0.29 — three uniforms beat one. */
  function gauss() { return (MP.rnd() + MP.rnd() + MP.rnd() - 1.5); }

  /* ---------------- leadership ---------------- */
  /* Elections, successions and what changes when the office changes hands.
     Transitions are where a forecast's variance actually comes from: a
     personalist system handing over is a different state, not the same state
     with a different name on the door. */
  function leadershipTurn(S) {
    const notes = [];
    MP.powerList.forEach(id => {
      const L = S.leaders && S.leaders[id];
      if (!L) return;
      const p = S.powers[id];

      L.tenureQ += 1;
      if (L.quartersLeft !== null) L.quartersLeft -= 1;
      if (L.nextContest !== null) L.nextContest -= 1;

      /* Reference points adapt, but slowly. A leadership that has been losing
         for two years eventually treats the worse position as normal — which
         is precisely how a long war stops feeling like an emergency. */
      L.refApproval += (p.approval - L.refApproval) * 0.12;
      L.refStanding += (MP.leaders.standing(S, id) - L.refStanding) * 0.12;

      /* consolidation wears off after about a year in post */
      if (L.consolidating && L.tenureQ > 4) L.consolidating = false;

      /* --- scheduled contest --- */
      if (L.nextContest !== null && L.nextContest <= 0) {
        /* performance moves the odds: economies and wars decide elections */
        const perf = clamp(
          (p.econ - 100) * 0.005 + (p.approval - 50) * 0.008 -
          (p.discontent - 45) * 0.004 - (S.g.inflation - 3) * 0.018, -0.26, 0.20);
        const pKeep = clamp(L.pContinuity + perf, 0.05, 0.97);
        const kept = MP.rnd() < pKeep;
        scheduleNext(L);

        /* A legislative contest changes the constraints an executive operates
           under; it does not change the executive. Conflating the two is how a
           model ends up claiming the United States changes government four
           times a decade. */
        if (!kept && L.contestKind === 'legislative') {
          L.vetoPoints = clamp(L.vetoPoints + 0.16, 0, 0.98);
          p.cohesion = clamp(p.cohesion - 4, 0, 100);
          p.approval = clamp(p.approval - 3, 0, 100);
          notes.push({ tag: 'POLITICS',
            headline: MP.POWERS[id].name + ': legislature changes hands',
            detail: 'The executive continues, with more veto points in front of it. Foreign-policy ' +
              'discretion survives; the money, the oversight and the cost of any new commitment ' +
              'all get harder.' });
          return;
        }
        if (kept) {
          notes.push({ tag: 'POLITICS', headline: MP.POWERS[id].name + ': incumbent arrangement holds',
            detail: 'The ' + L.contestType + ' returns the governing arrangement. Policy continuity ' +
              'is purchased for another cycle, and the leadership has a freer hand for a few quarters.' });
          L.nextContestJustHeld = true;
        } else {
          transition(S, id, L, 'contest', notes);
        }
      }

      /* --- irregular transition ---
         Coups, revolutions and forced exits are rare even in bad conditions:
         the historical base rate runs at a few per cent per YEAR for an
         authoritarian regime under serious strain. Strain is therefore summed
         rather than multiplied, and the result is capped, so that a very bad
         decade produces a realistic cumulative risk instead of a certainty. */
      const strain =
        clamp((35 - p.approval) / 35, 0, 1) * 0.40 +
        clamp((p.discontent - 50) / 50, 0, 1) * 0.55 +
        clamp((92 - p.econ) / 30, 0, 1) * 0.45 +
        clamp((p.warStress - 65) / 35, 0, 1) * 0.35 +
        clamp((35 - p.trust) / 35, 0, 1) * 0.25;
      let hazard = Math.min(L.irregularHazard * (1 + strain * 3.2), 0.015);
      /* a regime that has just changed hands does not usually change again at once */
      if (L.tenureQ < 6) hazard *= 0.3;
      if (MP.rnd() < hazard) transition(S, id, L, 'irregular', notes);
    });
    return notes;
  }

  function scheduleNext(L) {
    /* the US alternates legislative and executive contests every two years */
    if (L.contestKind === 'legislative' && L.contestType === 'legislative midterm') {
      L.contestType = 'presidential election'; L.contestKind = 'executive';
      L.pContinuity = 0.55; L.nextContest = 8; return;
    }
    if (L.contestKind === 'executive' && L.contestType === 'presidential election' && L.id === 'US') {
      L.contestType = 'legislative midterm'; L.contestKind = 'legislative';
      L.pContinuity = 0.35; L.nextContest = 8; return;
    }
    const span = { 'legislative midterm': 8, 'general election': 16, 'presidential election': 20,
      'managed presidential election': 24, 'party congress': 20, 'coalition formation': 12,
      'member-state elections': 6, 'dynastic succession': 40, 'succession': 30,
      'post-ceasefire election pressure': 12 }[L.contestType] || 16;
    L.nextContest = span;
  }

  /* A change of leadership redraws doctrine. How far it redraws is the
     regime type's continuity: a party apparatus hands over a programme, a
     personalist system hands over a vacuum. */
  function transition(S, id, L, kind, notes) {
    const p = S.powers[id], P = MP.POWERS[id];
    const discontinuity = (1 - L.continuity) * (kind === 'irregular' ? 1.4 : 1.0);

    p.escShift = clamp((p.escShift || 0) + gauss() * 0.55 * discontinuity, -0.35, 0.35);
    p.biasShift = p.biasShift || {};
    ['DIP', 'INFO', 'MIL', 'ECON'].forEach(c => {
      p.biasShift[c] = clamp((p.biasShift[c] || 1) + gauss() * 0.6 * discontinuity, 0.55, 1.6);
    });

    /* A new government re-prices its relationships — and because the change is
       structural rather than atmospheric, it moves the level that relations
       revert toward, not just today's reading. This is how realignment becomes
       durable instead of being pulled back by gravity next quarter. */
    MP.powerList.forEach(o => {
      if (o === id) return;
      const d = gauss() * 0.42 * discontinuity;
      MP.addAff(S, id, o, d);
      const k = id < o ? id + '|' + o : o + '|' + id;
      if (S.affBase) S.affBase[k] = clamp((S.affBase[k] !== undefined ? S.affBase[k] : MP.affinity(id, o)) + d * 0.65, -1, 1);
    });

    /* the politics of the handover itself */
    p.cohesion = clamp(p.cohesion - 6 * discontinuity, 0, 100);
    p.approval = clamp(kind === 'irregular' ? 42 + gauss() * 20 : 54 + gauss() * 14, 0, 100);
    if (kind === 'irregular') {
      p.legit = clamp(p.legit - 8 * discontinuity, 0, 100);
      p.discontent = clamp(p.discontent + 10, 0, 100);
    }

    L.transitions += 1;
    L.lastTransition = { turn: S.turn, kind };
    L.tenureQ = 0;
    L.consolidating = kind === 'irregular' || L.continuity < 0.5;
    L.refApproval = p.approval;
    L.refStanding = MP.leaders.standing(S, id);
    if (kind === 'irregular') scheduleNext(L);

    notes.push({
      tag: kind === 'irregular' ? 'LEADERSHIP CRISIS' : 'POLITICS',
      headline: MP.POWERS[id].name + ': ' + (kind === 'irregular'
        ? 'leadership changes outside the scheduled process'
        : 'government changes hands at the ' + L.contestType),
      detail: (kind === 'irregular'
        ? 'An unscheduled transition under economic and social strain. '
        : 'A scheduled handover. ') +
        (discontinuity > 0.4
          ? 'This is a ' + MP.LEADER_TYPES[L.type].label.toLowerCase() + ' system, so the handover is a ' +
            'genuine discontinuity: doctrine, risk appetite and alignments are all repriced.'
          : 'Institutional continuity is high here, so the programme largely survives the person.')
    });
  }

  /* ---------------- structural drift ---------------- */
  /* The slow variables. Demography and debt service are the part of a ten-year
     forecast that is close to determined, and they move underneath every
     decision anyone takes. */
  function structural(S) {
    MP.powerList.forEach(id => {
      const st = MP.STRUCTURE[id], p = S.powers[id];
      if (!st) return;
      /* quarterly trend growth, relative to the 100 index baseline */
      const trend = st.trendGrowth / 4 * 0.42;
      /* debt service crowds out: the higher the burden, the more of trend growth
         is absorbed before it reaches capability */
      const drag = st.debtService * 0.9 + Math.max(0, (S.g.inflation - 3) * 0.05);
      p.econ += trend * (1 - drag);
      /* working-age population: slow, compounding, unarguable */
      p.econ += st.workingAge / 4 * 0.18;
      /* technology base drifts with investment capacity */
      p.tech = clamp(p.tech + st.techDrift * clamp(p.econ / 100, 0.5, 1.3) -
        (p.pressure / 100) * 0.35, 0, 100);
    });
  }

  /* ---------------- sociology ---------------- */
  /* The domestic substrate. Discontent is driven by prices and war far more
     than by output; trust erodes faster than it rebuilds; and both feed back
     into what a government can afford to do abroad. */
  function sociology(S) {
    const notes = [];
    MP.powerList.forEach(id => {
      const p = S.powers[id], P = MP.POWERS[id];
      const L = S.leaders && S.leaders[id];

      /* prices bite harder than output: an energy importer feels the oil move
         directly, an exporter banks it */
      const pricePain = Math.max(0, S.g.inflation - 2.5) * 1.1 * (P.oilBeta < 0 ? 1.25 : 0.55);
      const warPain = (p.warStress / 100) * 4.0;
      const econPain = Math.max(0, 100 - p.econ) * 0.11;
      const relief = Math.max(0, p.econ - 101) * 0.09;

      /* Discontent seeks a level set by current conditions rather than
         accumulating without limit: societies adapt to sustained hardship, and
         a measure that simply ratchets to its ceiling stops carrying
         information exactly when it matters most. */
      const target = clamp(22 + pricePain * 3.6 + warPain * 4.4 + econPain * 2.2 - relief * 2.0, 0, 96);
      p.discontent = clamp(p.discontent + (target - p.discontent) * 0.18, 0, 100);

      /* Trust tracks strain asymmetrically: it falls faster than it rebuilds,
         and it approaches its floor rather than hitting it. */
      const strain = clamp((p.discontent - 45) / 55, -1, 1);
      const trustTarget = clamp(62 - strain * 52, 4, 80);
      const speed = p.trust > trustTarget ? 0.14 : 0.05;
      p.trust = clamp(p.trust + (trustTarget - p.trust) * speed, 0, 100);

      /* discontent transmits to the numbers the rest of the model already uses */
      p.approval = clamp(p.approval - Math.max(0, p.discontent - 50) * 0.09, 0, 100);
      p.cohesion = clamp(p.cohesion - Math.max(0, p.discontent - 60) * 0.05, 0, 100);
      p.legit = clamp(p.legit - Math.max(0, p.discontent - 70) * 0.04, 0, 100);

      /* mass mobilisation: a threshold phenomenon, not a gradual one */
      const openness = 1 - (L ? L.vetoPoints : 0.5) * 0.3;
      if (p.discontent > 50 && MP.rnd() < (p.discontent - 50) / 140 * openness) {
        p.approval = clamp(p.approval - 5, 0, 100);
        p.cohesion = clamp(p.cohesion - 4, 0, 100);
        p.discontent = clamp(p.discontent - 7, 0, 100);
        p.econ = clamp(p.econ - 0.5, 40, 170);
        notes.push({ tag: 'UNREST', headline: 'Sustained protest in ' + MP.POWERS[id].name,
          detail: 'Price pressure and war fatigue cross the threshold at which grievance becomes ' +
            'mobilisation. Governments survive this far more often than they fall, but it ' +
            'consumes the political capital that foreign policy runs on.' });
      }
    });
    return notes;
  }

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
      let shift = Math.sign(edge) * Math.pow(Math.abs(edge), 1.4) * 3.2 * (t.rung >= 6 ? 1 : 0.45);
      /* Diminishing returns on dominance. The further one side is ahead, the
         less each additional increment of advantage buys: what remains is the
         opponent's most defensible ground, its dispersed and surviving
         capability, and the part of the problem that force does not solve.
         Without this the model marches every won theatre to total victory,
         which is not how any of these conflicts have actually gone. */
      const lead = Math.abs(t.control - 50) / 50;
      shift *= (1 - lead * 0.85);
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
      const base = (S.affBase && S.affBase[k] !== undefined) ? S.affBase[k] : MP.affinity(ab[0], ab[1]);
      S.aff[k] = S.aff[k] + (base - S.aff[k]) * 0.09;
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
      /* Approval moves on the CHANGE in conditions as much as the level: a
         population adjusts to a bad situation that is no longer deteriorating.
         The per-quarter move is bounded so that a long war grinds support down
         without pinning it at zero, which would be both unrealistic and
         uninformative. */
      const econSignal = clamp((p.econ - 100) * 0.12, -3.0, 3.0);
      const warSignal = -(p.warStress / 100) * 2.6 * (0.4 + P.domConstr);
      const legitSignal = (p.legit - 50) * 0.03;
      const floor = 8 + (1 - P.domConstr) * 14;   /* closed systems report, and hold, a base */
      const move = clamp(econSignal + warSignal + legitSignal + (46 - p.approval) * 0.10, -6, 6);
      p.approval = clamp(p.approval + move, floor * 0.5, 100);
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
      if (t.tension < 38 && t.rung > (T.rungFloor || 0) && MP.rnd() < 0.25) { t.rung -= 1; notes.push({ tag: 'DE-ESC', headline: 'Tempo falls in ' + T.name, detail: 'Activity drops back to rung ' + t.rung + ' — ' + MP.LADDER[t.rung].name + '. Ladders are climbed quickly and descended slowly.' }); }
      else if (t.tension > 90 && t.rung < Math.min(6, T.escalationCeiling) && MP.rnd() < 0.16) {
        t.rung += 1;
        notes.push({ tag: 'ESCALATION', headline: 'Escalation in ' + T.name, detail: 'Sustained tension produces its own momentum: rung ' + t.rung + ' — ' + MP.LADDER[t.rung].name + '. Above this level the ladder is climbed by decision, not by drift.' });
      }

      /* Exhaustion and the cost of the top rungs. The higher the rung, the
         more both sides bleed and the more each quarter costs, so somebody
         eventually stops. Above rung 7 the costs are so large that the pull
         downward is strong — which is why great-power wars in the model are
         hard to reach and, once reached, do not simply persist for a decade. */
      if (t.rung >= 7) {
        const stress = (S.powers[T.sideA].warStress + S.powers[T.sideB].warStress) / 200;
        if (MP.rnd() < 0.10 + stress * 0.30) {
          t.rung -= 1;
          t.tension = clamp(t.tension - 10, 0, 100);
          notes.push({ tag: 'DE-ESC', headline: 'Great-power tempo falls in ' + T.name,
            detail: 'The cost of operating at this level is not sustainable for either side. ' +
              'Without anyone conceding anything, the fighting settles a rung lower at ' +
              MP.LADDER[t.rung].name.toLowerCase() + '.' });
        }
      }
      if (t.rung >= 6 && t.rung > T.rung - 1 && t.rung > (T.rungFloor || 0)) {
        const stress = (S.powers[T.sideA].warStress + S.powers[T.sideB].warStress) / 200;
        /* a live negotiation track roughly doubles the chance of a step down */
        const talks = T.negotiating ? 2.0 : 1.0;
        if (MP.rnd() < stress * 0.15 * talks) {
          t.rung -= 1;
          t.tension = clamp(t.tension - 8, 0, 100);
          notes.push({ tag: 'EXHAUSTION', headline: 'Tempo drops in ' + T.name, detail: 'Neither side announces anything. Sortie rates fall, offensives are postponed, and the fighting settles a rung lower at ' + MP.LADDER[t.rung].name + '.' });
        }
      }
      /* Exogenous crises. The world generates incidents on its own: a
         mass-casualty attack, a shoot-down, a collision at sea. Each dyad has
         its own historical crisis-proneness, and the rate rises with
         temperature but never falls to zero. */
      const cr = (T.crisisRate || 0.03) * (0.5 + t.tension / 100);
      if (MP.rnd() < cr) {
        t.tension = clamp(t.tension + 9 + MP.rnd() * 10, 0, 100);
        const esc = MP.rnd() < 0.12 && t.rung < Math.min(6, T.escalationCeiling);
        if (esc) t.rung += 1;
        notes.push({ tag: 'INCIDENT', headline: 'Incident in ' + T.name,
          detail: 'An unplanned event — an attack, a shoot-down, a collision — forces both ' +
            'capitals to respond on a timetable neither chose. ' +
            (esc ? 'It carries the theatre up a rung to ' + MP.LADDER[t.rung].name.toLowerCase() + '.'
                 : 'It is contained, this time.') });
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
    /* Inflation follows the energy move with a lag, and decays toward target.
       This is the channel through which a distant war reaches every electorate. */
    const oilPush = (S.g.oil - S.gPrevOil) / Math.max(1, S.gPrevOil) * 100 * 0.07;
    /* inflation is persistent and shock-prone: it reverts toward target slowly
       and gets knocked about on the way, which is what makes it politically
       lethal for incumbents */
    S.g.inflation = clamp(S.g.inflation + oilPush + (2.4 - S.g.inflation) * 0.09 +
      gauss() * 0.55 + (S.g.trade < 90 ? 0.12 : 0), 0, 40);

    S.g.nuclearRisk = MP.computeNuclearRisk(S);
  }

  /* The roll nobody wants. Risk is a per-turn hazard, not a cliff. */
  function nuclearCheck(S) {
    /* Eighty years of non-use is the single most important base rate in the
       whole model. The hazard is therefore steep in the index but small in
       absolute terms: a decade of sustained crisis should produce a low
       single-digit probability, not a coin flip. */
    const r = S.g.nuclearRisk;
    if (r < 25) return null;
    /* A continuous tail rather than a cliff, calibrated against the realised
       risk distribution rather than against a round number. As set, a decade
       containing active wars in nuclear dyads carries roughly a 2% cumulative
       probability of a weapon being used. That is deliberately a low
       single-digit figure: eighty years of non-use is the strongest base rate
       in the model, and a forecast that put this at 25% would be asserting
       something the historical record does not support. It is not zero
       either, and a model that produced zero would be hiding the tail rather
       than estimating it. */
    const hazard = Math.pow((r - 25) / 75, 2.2) * 0.045;
    if (MP.rnd() > hazard) return null;
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
    structural(S);
    domestic(S);
    notes.push.apply(notes, sociology(S));
    notes.push.apply(notes, leadershipTurn(S));

    /* 3. events */
    const evs = [];
    const n = 1 + (MP.rnd() < 0.45 ? 1 : 0);
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

    /* 5. endings — only when a seat is being played. In forecast mode nobody
       holds a seat, so the run continues to its horizon and the collapse of any
       particular government is just another thing that happens. */
    const me = S.player ? S.powers[S.player] : null;
    if (me && !S.over && me.approval < 12) { S.over = true; S.ending = 'collapse'; }
    if (me && !S.over && me.econ < 68) { S.over = true; S.ending = 'economic'; }
    if (!S.over && S.turn >= S.maxTurns) { S.over = true; S.ending = 'complete'; }

    S.history.push({
      turn: S.turn,
      oil: Math.round(S.g.oil), trade: Math.round(S.g.trade), nuclearRisk: Math.round(S.g.nuclearRisk),
      inflation: Math.round(S.g.inflation * 10) / 10,
      econ: me ? Math.round(me.econ) : null, approval: me ? Math.round(me.approval) : null,
      rungs: MP.theaterList.reduce((o, t) => (o[t] = S.theaters[t].rung, o), {})
    });

    if (!S.over) S.turn += 1;
    return { aiReports, notes, events: evs, nuke };
  }

  MP.endTurn = endTurn;
  MP.phases = { leadershipTurn, structural, sociology, attrition, markets };
  MP.scoreCampaign = scoreCampaign;
  MP.OBJ = OBJ;
})(typeof self !== 'undefined' ? (self.MP = self.MP || {}) : (this.MP = this.MP || {}));
