/* MULTIPOLAR — data/leaders.js
 * The leadership layer.
 *
 * WHAT THIS MODELS, AND WHAT IT DOES NOT
 *
 * It models OFFICES AND REGIME TYPES, not personalities. There is no attempt
 * here to psychoanalyse named individuals — that would be pretend precision,
 * and it would be the least defensible thing in the model. What is encoded
 * instead is the set of documented, structural facts that actually predict
 * foreign-policy behaviour:
 *
 *   - how many veto players stand between an executive and a decision
 *   - how long that executive can expect to remain in office
 *   - when the next contest for power falls, and what kind of contest it is
 *   - what the regime's claim to legitimacy rests on, and therefore what kind
 *     of failure threatens it
 *   - how much policy survives a transition
 *
 * On top of that sits one behavioural regularity with strong empirical
 * support: PROSPECT THEORY. Decision-makers who perceive themselves in a
 * domain of losses become risk-ACCEPTANT; the same decision-makers in a
 * domain of gains become risk-averse. This is among the most robust findings
 * in political psychology (Kahneman & Tversky; applied to international
 * politics by Jervis, Levy, McDermott) and it is what makes a losing power
 * dangerous rather than compliant.
 *
 * Baseline is 28 October 2026, built from public reporting. Where a situation
 * was unresolved on that date — the Israeli coalition, the US midterms — it is
 * encoded as an unresolved contest with a probability, not as a result.
 */
(function (MP) {
  'use strict';

  /* Regime archetypes. Numbers are the modelling judgements: veto points,
     planning horizon in quarters, hazard of an unscheduled transition per
     quarter, and how much doctrine survives a change of leader. */
  const TYPES = {
    'presidential-checked': {
      label: 'Checked presidential',
      vetoPoints: 0.70, horizon: 8, irregularHazard: 0.004, continuity: 0.55,
      note: 'Executive discretion in foreign affairs, but legislative and judicial ' +
        'veto points on money and mobilisation, and a fixed electoral clock.'
    },
    'coalition-parliamentary': {
      label: 'Coalition parliamentary',
      vetoPoints: 0.88, horizon: 5, irregularHazard: 0.030, continuity: 0.70,
      note: 'Every decision passes through coalition partners. Slow to commit, ' +
        'slower to reverse, and liable to fall between scheduled elections.'
    },
    'dominant-party': {
      label: 'Dominant-party parliamentary',
      vetoPoints: 0.55, horizon: 10, irregularHazard: 0.015, continuity: 0.80,
      note: 'Secure majority, internal factions as the real constraint.'
    },
    'party-institutional': {
      label: 'Party-institutional',
      vetoPoints: 0.22, horizon: 24, irregularHazard: 0.005, continuity: 0.88,
      note: 'Leadership embedded in a durable party apparatus. Long horizons, ' +
        'high policy continuity, low transparency about succession.'
    },
    'personalist': {
      label: 'Personalist',
      vetoPoints: 0.16, horizon: 20, irregularHazard: 0.012, continuity: 0.35,
      note: 'Few institutional checks and long horizons, but the system is the ' +
        'person: a transition is a genuine discontinuity rather than a handover.'
    },
    'clerical-hybrid': {
      label: 'Clerical-hybrid',
      vetoPoints: 0.45, horizon: 16, irregularHazard: 0.022, continuity: 0.50,
      note: 'An elected government operating inside an unelected clerical and ' +
        'security structure that holds the decisive files.'
    },
    'supranational': {
      label: 'Supranational union',
      vetoPoints: 0.94, horizon: 6, irregularHazard: 0.002, continuity: 0.85,
      note: 'Twenty-seven national vetoes and a rotating presidency. Moves at the ' +
        'speed of its most reluctant member, and almost never reverses.'
    },
    'competitive-authoritarian': {
      label: 'Competitive authoritarian',
      vetoPoints: 0.38, horizon: 12, irregularHazard: 0.010, continuity: 0.45,
      note: 'Elections are held and contested but not on level terms; the ' +
        'executive dominates the institutions that referee them.'
    },
    'absolute-monarchy': {
      label: 'Absolute monarchy',
      vetoPoints: 0.14, horizon: 28, irregularHazard: 0.008, continuity: 0.75,
      note: 'Dynastic succession inside a ruling family; very long horizons.'
    },
    'hereditary-totalitarian': {
      label: 'Hereditary totalitarian',
      vetoPoints: 0.04, horizon: 32, irregularHazard: 0.006, continuity: 0.80,
      note: 'No meaningful internal constraint and no exit option; regime ' +
        'survival is the only objective that matters.'
    },
    'wartime-emergency': {
      label: 'Wartime emergency',
      vetoPoints: 0.45, horizon: 4, irregularHazard: 0.020, continuity: 0.60,
      note: 'Elections suspended under martial law. Legitimacy rests on the ' +
        'conduct of the war and on continued external support.'
    }
  };

  /* Per-power leadership state as of 28 Oct 2026.
   *
   * nextContest  quarters until the next scheduled test of power (0 = now)
   * contestType  what kind of test
   * pContinuity  probability the incumbent arrangement survives that test
   * consolidating a leader installed recently and not yet secure — newly
   *              installed leaders after irregular transitions show elevated
   *              conflict propensity while establishing standing
   */
  const LEADERSHIP = {
    US: {
      type: 'presidential-checked',
      office: 'President, with Congress controlling appropriations',
      tenureQ: 7, termLimited: true, quartersLeft: 9,
      nextContest: 0, contestType: 'legislative midterm', contestKind: 'legislative', pContinuity: 0.15,
      legitimacy: 'electoral',
      situation: 'Midterm elections fall on 3 November 2026. Forecasters and prediction ' +
        'markets put the House at 80-91% likely to change hands and the Senate at ' +
        '55-65%. The executive keeps its foreign-affairs discretion either way; what ' +
        'changes is appropriations, oversight and the cost of any new commitment.',
      onContestLoss: { vetoPoints: +0.18, horizon: -3, cohesion: -4, note: 'divided government' }
    },
    CN: {
      type: 'party-institutional',
      office: 'Party General Secretary, State President, CMC Chairman',
      tenureQ: 56, termLimited: false, quartersLeft: 40,
      nextContest: 8, contestType: 'party congress', contestKind: 'legislative', pContinuity: 0.92,
      legitimacy: 'performance',
      situation: 'Term limits removed; no designated successor in public view. The binding ' +
        'constraint is economic performance — slowing retail sales and contracting ' +
        'investment against a stated 2026 priority of domestic demand — not electoral risk.',
      onContestLoss: { note: 'leadership reshuffle without regime change' }
    },
    RU: {
      type: 'personalist',
      office: 'President',
      tenureQ: 104, termLimited: false, quartersLeft: 28,
      nextContest: 18, contestType: 'managed presidential election', pContinuity: 0.93,
      legitimacy: 'nationalist',
      situation: 'Deepening energy and technology alignment with Beijing — oil exports to ' +
        'China up about 35% year-on-year in Q1 2026 — while negotiating over Ukraine. ' +
        'Legitimacy is tied to the war\'s framing, which makes an unambiguous defeat ' +
        'more dangerous to the regime than a frozen line.',
      onContestLoss: { note: 'personalist succession: high doctrinal discontinuity' }
    },
    EU: {
      type: 'supranational',
      office: 'Commission and European Council, bound by member-state unanimity on foreign policy',
      tenureQ: 10, termLimited: true, quartersLeft: 14,
      nextContest: 6, contestType: 'member-state elections', contestKind: 'legislative', pContinuity: 0.70,
      legitimacy: 'electoral',
      situation: 'Financing Ukraine and absorbing the energy shock simultaneously, with ' +
        'inflation re-accelerating. Any single capital can block; the bloc\'s power is ' +
        'regulatory and financial rather than military.',
      onContestLoss: { cohesion: -6, note: 'a member government turns sceptical' }
    },
    IN: {
      type: 'dominant-party',
      office: 'Prime Minister with a parliamentary majority',
      tenureQ: 50, termLimited: false, quartersLeft: 11,
      nextContest: 11, contestType: 'general election', pContinuity: 0.72,
      legitimacy: 'performance',
      situation: 'Buying discounted Russian crude while deepening defence and technology ' +
        'ties with Washington. An oil price near $100 is the main threat to the growth ' +
        'story that underwrites the government.',
      onContestLoss: { note: 'coalition government, slower decisions' }
    },
    IR: {
      type: 'clerical-hybrid',
      office: 'Supreme Leader above an elected presidency',
      tenureQ: 3, termLimited: false, quartersLeft: 36,
      nextContest: 10, contestType: 'presidential election', pContinuity: 0.60,
      legitimacy: 'revolutionary',
      consolidating: true,
      situation: 'Ali Khamenei was killed in the opening strikes of the war on 28 February ' +
        '2026; Mojtaba Khamenei was confirmed by the Assembly of Experts on 9 March and ' +
        'is widely assessed as more hardline. A leadership three quarters old, installed ' +
        'by decapitation rather than succession planning, governing a degraded nuclear ' +
        'programme, a damaged partner network and a sanctioned economy. This is the ' +
        'single least stable leadership position on the board.',
      onContestLoss: { note: 'contested succession inside the clerical establishment' }
    },
    IL: {
      type: 'coalition-parliamentary',
      office: 'Prime Minister, caretaker pending coalition formation',
      tenureQ: 0, termLimited: false, quartersLeft: 2,
      nextContest: 1, contestType: 'coalition formation', pContinuity: 0.45,
      legitimacy: 'security',
      situation: 'The 27 October 2026 election returned no majority: the incumbent bloc at ' +
        'about 53 seats against roughly 48 for the opposition, with Arab parties holding ' +
        'about 19 and pivotal. The principal opposition figure has refused to serve under ' +
        'the incumbent in rotation. A caretaker government cannot easily start a war or ' +
        'sign a settlement, which constrains both directions at once.',
      onContestLoss: { vetoPoints: +0.05, note: 'a different coalition, same security consensus' }
    },
    TR: {
      type: 'competitive-authoritarian',
      office: 'Executive President',
      tenureQ: 94, termLimited: true, quartersLeft: 7,
      nextContest: 7, contestType: 'presidential election', pContinuity: 0.60,
      legitimacy: 'performance',
      situation: 'Straits control and a drone-export industry give leverage disproportionate ' +
        'to the economy; currency and inflation stress is the recurring constraint, and ' +
        'the constitutional position on another term is itself contested.',
      onContestLoss: { note: 'opposition government, NATO-leaning realignment' }
    },
    JP: {
      type: 'dominant-party',
      office: 'Prime Minister',
      tenureQ: 4, termLimited: false, quartersLeft: 14,
      nextContest: 14, contestType: 'general election', pContinuity: 0.80,
      legitimacy: 'performance',
      situation: 'A February 2026 snap election returned a commanding majority — reported at ' +
        '316 of 465 seats — after the long-standing coalition partner departed and was ' +
        'replaced. The first female prime minister, governing from the conservative wing, ' +
        'with rearmament and energy import exposure as the defining files.',
      onContestLoss: { note: 'factional change within the governing party' }
    },
    UA: {
      type: 'wartime-emergency',
      office: 'President under martial law, elections suspended',
      tenureQ: 30, termLimited: false, quartersLeft: 6,
      nextContest: 4, contestType: 'post-ceasefire election pressure', pContinuity: 0.55,
      legitimacy: 'security',
      situation: 'Localised ceasefires — Oleshky in Kherson took effect on 27 October — and ' +
        'technical talks with Russia and the United States scheduled in Abu Dhabi for ' +
        'early November. Territory and security guarantees remain unresolved. A ceasefire ' +
        'would start an electoral clock that the war has suspended.',
      onContestLoss: { note: 'post-war political settlement' }
    },
    TW: {
      type: 'presidential-checked',
      office: 'President with a divided legislature',
      tenureQ: 10, termLimited: true, quartersLeft: 14,
      nextContest: 14, contestType: 'general election', pContinuity: 0.55,
      legitimacy: 'electoral',
      situation: 'Executive and legislature are held by opposing parties, which constrains ' +
        'defence budgets directly. Absorbing sustained grey-zone pressure: 166 military ' +
        'aircraft and 309 vessels logged in the Strait in October alone.',
      onContestLoss: { note: 'a government more accommodating to Beijing' }
    },
    SA: {
      type: 'absolute-monarchy',
      office: 'Crown Prince as effective ruler',
      tenureQ: 40, termLimited: false, quartersLeft: 60,
      nextContest: 40, contestType: 'dynastic succession', pContinuity: 0.90,
      legitimacy: 'dynastic',
      situation: 'An oil price near $100 is funding the diversification programme. Hedging ' +
        'between a US security relationship, OPEC+ coordination with Moscow, and capital ' +
        'ties to Beijing.',
      onContestLoss: { note: 'intra-family succession' }
    },
    KP: {
      type: 'hereditary-totalitarian',
      office: 'Supreme Leader',
      tenureQ: 60, termLimited: false, quartersLeft: 80,
      nextContest: 80, contestType: 'dynastic succession', pContinuity: 0.85,
      legitimacy: 'dynastic',
      situation: 'Munitions and manpower exchanged for Russian technology have removed the ' +
        'last effective sanctions leverage. Effectively invulnerable to economic coercion ' +
        'and uninterested in settlement.',
      onContestLoss: { note: 'dynastic continuity' }
    },
    PK: {
      type: 'competitive-authoritarian',
      office: 'Civilian government under decisive military influence',
      tenureQ: 10, termLimited: false, quartersLeft: 8,
      nextContest: 8, contestType: 'general election', pContinuity: 0.50,
      legitimacy: 'security',
      situation: 'Mediated the US-Iran ceasefire in April, which bought diplomatic standing ' +
        'that the balance of payments did not. Chronic external financing need alongside a ' +
        'nuclear arsenal and an unresolved eastern border.',
      onContestLoss: { note: 'civil-military rebalancing' }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Behavioural mechanisms                                              */
  /* ------------------------------------------------------------------ */

  /* Prospect theory. Returns the shift in escalation tolerance implied by the
     leader's current frame. Losses make leaders bolder; gains make them
     cautious. The reference point is the position they believe they hold. */
  function frameShift(S, id) {
    const p = S.powers[id];
    const L = S.leaders[id];
    if (!L) return 0;
    /* domain of losses: economy below reference, approval falling, position in
       the theatres they care about deteriorating */
    let loss = 0;
    loss += (100 - p.econ) / 100 * 0.9;
    loss += (L.refApproval - p.approval) / 100 * 1.3;
    loss += (L.refStanding - standing(S, id)) / 100 * 1.1;
    /* a consolidating leader after an irregular transition behaves as if in a
       loss frame regardless of the numbers */
    if (L.consolidating) loss += 0.35;
    const t = MP.clamp(loss, -1, 1);
    /* risk acceptance rises steeply in losses, falls gently in gains */
    return t > 0 ? t * 0.30 : t * 0.12;
  }

  /* Weighted position across the theatres this power is actually in. */
  function standing(S, id) {
    let w = 0, acc = 0;
    MP.theaterList.forEach(t => {
      const T = MP.THEATERS[t], side = MP.sideOf(T, id);
      if (!side) return;
      const weight = (T.sideA === id || T.sideB === id) ? 2 : 1;
      acc += (side === 'A' ? S.theaters[t].control : 100 - S.theaters[t].control) * weight;
      w += weight;
    });
    return w ? acc / w : 50;
  }

  /* Electoral-cycle effects: constraint rises as a contest approaches, and a
     newly-mandated government has a window of unusual freedom. */
  function cycleConstraint(L) {
    if (!L || L.nextContest === null) return 0;
    if (L.nextContest <= 1) return 0.22;     /* immediate: maximum caution */
    if (L.nextContest <= 3) return 0.12;
    if (L.nextContest >= 12) return -0.06;   /* distant: freer hand */
    return 0;
  }

  /* Diversionary incentive: unpopular leaders whose legitimacy rests on
     nationalism or security have some incentive to seek an external win. The
     empirical literature finds this effect real but modest, so it is modelled
     as modest. */
  function diversionary(S, id) {
    const p = S.powers[id], L = S.leaders[id];
    if (!L) return 0;
    if (L.legitimacy !== 'nationalist' && L.legitimacy !== 'security' && L.legitimacy !== 'revolutionary') return 0;
    const unpopular = MP.clamp((45 - p.approval) / 45, 0, 1);
    return unpopular * 0.10;
  }

  MP.LEADER_TYPES = TYPES;
  MP.LEADERSHIP = LEADERSHIP;
  MP.leaders = { frameShift, cycleConstraint, diversionary, standing };
})(typeof self !== 'undefined' ? (self.MP = self.MP || {}) : (this.MP = this.MP || {}));
