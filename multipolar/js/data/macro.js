/* MULTIPOLAR — data/macro.js
 * Historical macro patterns, encoded as mechanisms rather than flavour text.
 *
 * Each entry below is a regularity with a real empirical literature behind it.
 * Several are contested; where they are, the model deliberately uses the
 * conservative end of the estimated effect, because a forecast built on the
 * strongest claimed version of every disputed finding is a forecast built to
 * be wrong. The `confidence` field records how much weight the evidence
 * actually supports, and the report surfaces it.
 *
 * Nothing here is a free parameter tuned to make the simulation pleasing. Each
 * one is a claim about how international politics has behaved, and each is
 * therefore something a reader can disagree with specifically.
 */
(function (MP) {
  'use strict';

  /* defined locally: this module loads before the engine that exports clamp */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const PATTERNS = [
    {
      id: 'power-transition',
      name: 'Power transition',
      confidence: 'moderate',
      claim: 'Major war risk peaks not when a hegemon is dominant but when a dissatisfied ' +
        'challenger approaches parity with it. Preponderance is stabilising; the crossing is not.',
      caveat: 'The pattern is drawn from a small number of historical transitions and the ' +
        'coding of "dissatisfaction" is contested. Treat as a tendency, not a law.'
    },
    {
      id: 'war-duration-hazard',
      name: 'Declining hazard of war termination',
      confidence: 'strong',
      claim: 'Wars that survive their first year become progressively harder to end. Short wars ' +
        'end quickly or not at all; the longer a war runs, the longer its expected remaining ' +
        'duration, because the cheap settlements have already been refused.',
      caveat: 'Selection effect: wars that last are those where both sides believed they could win.'
    },
    {
      id: 'sanctions-base-rate',
      name: 'Sanctions base rate',
      confidence: 'strong',
      claim: 'Economic sanctions achieve some part of their stated objective in roughly a third ' +
        'of cases, and major policy change in far fewer. Success correlates with coalition ' +
        'breadth, modest demands and prior friendly relations — not with severity.',
      caveat: 'The canonical dataset\'s success coding has been challenged as too generous.'
    },
    {
      id: 'stability-instability',
      name: 'Stability–instability paradox',
      confidence: 'moderate',
      claim: 'Nuclear dyads experience fewer full-scale wars and more sub-war violence. Mutual ' +
        'deterrence at the top of the ladder makes the lower rungs safer to use.',
      caveat: 'Observed in a handful of dyads over a short historical window.'
    },
    {
      id: 'prospect-framing',
      name: 'Loss framing and risk acceptance',
      confidence: 'strong',
      claim: 'Leaders who perceive themselves to be losing accept risks they would refuse when ' +
        'ahead. A state facing loss is more dangerous than the same state facing gain.',
      caveat: 'Robust in experiment; harder to measure in historical cases.'
    },
    {
      id: 'rally-decay',
      name: 'Rally-round-the-flag, and its decay',
      confidence: 'strong',
      claim: 'An external attack produces an immediate surge in support for the leadership that ' +
        'decays within two to four quarters, leaving approval below where it started if the ' +
        'underlying situation has not improved.',
      caveat: 'Size varies enormously with media environment and elite consensus.'
    },
    {
      id: 'commodity-incumbent',
      name: 'Energy prices and incumbent survival',
      confidence: 'strong',
      claim: 'Sustained energy-price increases transmit to inflation and from there to incumbent ' +
        'vote loss, in every electoral system. Energy exporters see the mirror image.',
      caveat: 'Attribution of price moves to incumbents is itself political.'
    },
    {
      id: 'alliance-reliability',
      name: 'Alliance reliability',
      confidence: 'moderate',
      claim: 'Formal defence commitments have been honoured in roughly two-thirds to three-quarters ' +
        'of cases historically. Informal assurances perform far worse. Deterrence rests on the ' +
        'adversary\'s estimate of that probability, not on the text.',
      caveat: 'Base rates come from a period with few tested commitments.'
    },
    {
      id: 'imperial-overstretch',
      name: 'Fiscal-military overstretch',
      confidence: 'moderate',
      claim: 'Great powers that sustain military burdens well above their economic growth rate ' +
        'decline relatively over decades. When debt service begins to crowd out defence ' +
        'spending, the decline has already started.',
      caveat: 'A long-run tendency measured in decades, visible only weakly over a ten-year run.'
    },
    {
      id: 'demographic-drag',
      name: 'Demography as destiny, slowly',
      confidence: 'strong',
      claim: 'Trend growth tracks working-age population growth plus productivity. Ageing societies ' +
        'face a compounding drag that no short-run policy offsets.',
      caveat: 'Productivity shocks — currently, automation and AI — can mask it for a decade.'
    },
    {
      id: 'interdependence-damping',
      name: 'Trade interdependence damping',
      confidence: 'weak',
      claim: 'Deep trade interdependence modestly reduces the probability of war between partners. ' +
        'It does not prevent it, and the 1914 case is the standing refutation of the strong form.',
      caveat: 'Weak and heavily contested; modelled at the low end deliberately.'
    },
    {
      id: 'new-leader-risk',
      name: 'New-leader consolidation risk',
      confidence: 'moderate',
      claim: 'Leaders installed by irregular transition show elevated conflict propensity while ' +
        'establishing standing, both to deter opportunism and to secure domestic position.',
      caveat: 'Confounded with the crises that produced the transition in the first place.'
    },
    {
      id: 'ceasefire-fragility',
      name: 'Ceasefire fragility',
      confidence: 'strong',
      claim: 'Ceasefires without third-party enforcement or a political settlement fail at high ' +
        'rates, and most failures occur early. Local or humanitarian pauses rarely generalise ' +
        'to the wider conflict.',
      caveat: 'Failure definitions vary across datasets.'
    },
    {
      id: 'nuclear-latency',
      name: 'Counter-proliferation delays, rarely reverses',
      confidence: 'moderate',
      claim: 'Strikes on nuclear infrastructure set programmes back by years without ending them, ' +
        'and strengthen the domestic argument for a deterrent. Negotiated constraint has the ' +
        'better record; it is also the more fragile to domestic political change on either side.',
      caveat: 'Very few cases; each is idiosyncratic.'
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Structural trends: the slow variables.                              */
  /* Working-age population growth and debt service set a drift on each   */
  /* economy that no quarter's decisions can overcome — the part of the   */
  /* forecast that is nearly determined.                                  */
  /* ------------------------------------------------------------------ */
  const STRUCTURE = {
    /* trendGrowth   annual % — demographics + productivity, pre-shock
       debtService   % of revenue absorbed by interest, as a drag proxy
       workingAge    annual % change in the working-age population
       techDrift     per-quarter drift in the technology index */
    US: { trendGrowth: 2.0, debtService: 0.22, workingAge: 0.1, techDrift: 0.45 },
    CN: { trendGrowth: 4.0, debtService: 0.12, workingAge: -0.6, techDrift: 0.70 },
    RU: { trendGrowth: 0.8, debtService: 0.08, workingAge: -0.7, techDrift: -0.15 },
    EU: { trendGrowth: 1.2, debtService: 0.14, workingAge: -0.4, techDrift: 0.30 },
    IN: { trendGrowth: 6.3, debtService: 0.26, workingAge: 1.0, techDrift: 0.45 },
    IR: { trendGrowth: 0.4, debtService: 0.10, workingAge: 0.3, techDrift: -0.20 },
    IL: { trendGrowth: 2.8, debtService: 0.09, workingAge: 0.9, techDrift: 0.40 },
    TR: { trendGrowth: 2.8, debtService: 0.18, workingAge: 0.5, techDrift: 0.15 },
    JP: { trendGrowth: 0.8, debtService: 0.20, workingAge: -0.8, techDrift: 0.35 },
    UA: { trendGrowth: 1.5, debtService: 0.15, workingAge: -2.2, techDrift: 0.05 },
    TW: { trendGrowth: 2.6, debtService: 0.06, workingAge: -0.7, techDrift: 0.55 },
    SA: { trendGrowth: 3.2, debtService: 0.05, workingAge: 1.2, techDrift: 0.20 },
    KP: { trendGrowth: 1.0, debtService: 0.02, workingAge: 0.1, techDrift: 0.05 },
    PK: { trendGrowth: 3.0, debtService: 0.45, workingAge: 1.6, techDrift: 0.05 }
  };

  /* ------------------------------------------------------------------ */
  /* Composite power and system polarity                                 */
  /*                                                                     */
  /* A CINC-style index: economic mass, military capability, technology   */
  /* and the ability to act through others. Polarity is then read off the */
  /* distribution of that index — which is how "who is the superpower" is */
  /* answered as an output of the model rather than an assumption of it.  */
  /* ------------------------------------------------------------------ */
  function powerIndex(S, id) {
    const P = MP.POWERS[id], p = S.powers[id];
    const econ = P.gdp * (p.econ / 100);
    const mil = (P.milUSD / 100) * (p.readiness / 100) *
      (1 + (P.power.air + P.power.sea + P.power.space) / 300);
    const tech = (p.tech / 100) * (P.gdp / 10);

    /* Capability you can actually use. Two discounts matter, and leaving either
       out is how models end up declaring entities great powers that cannot
       take a decision:
         usable   — coercive weight needs cohesion and standing to be spent
         actorness— a polity that requires unanimity among many governments
                    converts mass into action at a heavy discount. The EU is
                    the explicit case: real economic weight, genuine regulatory
                    power, and a foreign policy that moves at the speed of its
                    most reluctant member. */
    const usable = (0.45 + 0.55 * (p.cohesion / 100)) * (0.55 + 0.45 * (p.legit / 100));
    const veto = (MP.LEADER_TYPES && MP.LEADERSHIP && MP.LEADERSHIP[id])
      ? MP.LEADER_TYPES[MP.LEADERSHIP[id].type].vetoPoints : 0.4;
    const actorness = 1 - veto * 0.42;

    /* Alliance mass: partners' economies, discounted by how reliable the tie
       is. Weighted lightly — allies add reach, but counting a partner's GDP
       toward your own power twice over is how double-counting creates
       phantom superpowers. */
    let allied = 0;
    MP.powerList.forEach(o => {
      if (o === id) return;
      const a = MP.getAff(S, id, o);
      if (a > 0.3) allied += MP.POWERS[o].gdp * (a - 0.3) / 0.7 * 0.30 * (S.powers[o].cohesion / 100);
    });
    /* a survivable second strike buys standing that GDP does not */
    const nuke = P.warheads > 0 ? 1 + Math.min(0.34, Math.log10(P.warheads + 1) * 0.11) : 1;
    const parts = {
      economic: econ * 0.40, military: mil * 0.32, technology: tech * 0.14, alliance: allied * 0.14
    };
    const raw = parts.economic + parts.military + parts.technology + parts.alliance;
    const total = raw * usable * actorness * nuke;
    return { total, parts, usable, actorness, nuke, raw };
  }

  /* Any single number for "power" is contestable — the weights are a judgement,
     and a different defensible set of weights reorders the middle of the table.
     The components are therefore reported alongside the composite so the
     weighting can be argued with rather than taken on trust. */
  function powerTotal(S, id) { return powerIndex(S, id).total; }

  /* Classify the system from the distribution of power. */
  function polarity(S) {
    const idx = MP.powerList.map(id => ({ id, v: powerTotal(S, id) }))
      .sort((a, b) => b.v - a.v);
    const total = idx.reduce((s, x) => s + x.v, 0) || 1;
    const share = idx.map(x => ({ id: x.id, v: x.v, share: x.v / total }));
    const a = share[0], b = share[1], c = share[2];

    /* A pole is a power within reach of the leader; the question is how many
       there are and how far clear the first one is. */
    const ratio = b.v > 0 ? a.v / b.v : 99;
    const ratio3 = c.v > 0 ? b.v / c.v : 99;
    let type, poles;
    if (ratio >= 1.75) { type = 'unipolar'; poles = [a.id]; }
    else if (ratio < 1.75 && ratio3 >= 1.5) { type = 'bipolar'; poles = [a.id, b.id]; }
    else if (a.share < 0.26) { type = 'diffuse'; poles = share.slice(0, 4).map(x => x.id); }
    else { type = 'multipolar'; poles = share.slice(0, 3).map(x => x.id); }
    return { type, poles, leader: a.id, ratio, share };
  }

  /* Alliance structure: who is clustered with whom, read off live affinity.
     Returns blocs as arrays of ids, largest first. */
  function blocs(S) {
    const seen = {}, out = [];
    MP.powerList.forEach(id => {
      if (seen[id]) return;
      const group = [id]; seen[id] = true;
      MP.powerList.forEach(o => {
        if (seen[o]) return;
        if (MP.getAff(S, id, o) > 0.45) { group.push(o); seen[o] = true; }
      });
      out.push(group);
    });
    return out.sort((x, y) =>
      y.reduce((s, i) => s + MP.POWERS[i].gdp, 0) - x.reduce((s, i) => s + MP.POWERS[i].gdp, 0));
  }

  /* Cross-bloc economic exposure: how decoupled the system has become. 100 =
     fully interdependent as at baseline, 0 = fully separated blocs. */
  function integration(S) {
    let cross = 0, n = 0;
    MP.powerList.forEach(a => MP.powerList.forEach(b => {
      if (a >= b) return;
      const aff = MP.getAff(S, a, b);
      const w = MP.tradeLeverage(a, b) + MP.tradeLeverage(b, a);
      cross += w * (aff + 1) / 2; n += w;
    }));
    return n ? clamp(cross / n * 140, 0, 130) : 100;
  }

  MP.PATTERNS = PATTERNS;
  MP.STRUCTURE = STRUCTURE;
  MP.macro = { powerIndex, powerTotal, polarity, blocs, integration };
})(typeof self !== 'undefined' ? (self.MP = self.MP || {}) : (this.MP = this.MP || {}));
