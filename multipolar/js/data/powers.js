/* MULTIPOLAR — data/powers.js
 * Actor definitions.
 *
 * All figures are ROUNDED OPEN-SOURCE APPROXIMATIONS for a ~2025/26 baseline
 * (orders of magnitude consistent with IMF/World Bank GDP, SIPRI/IISS defence
 * spending and manpower, FAS warhead estimates). They are tuned for playability
 * and are not authoritative. See README for the modelling notes.
 *
 * Field guide
 *   gdp        trillions USD, nominal
 *   milUSD     billions USD, annual defence outlay
 *   troops     active-duty personnel
 *   warheads   estimated total nuclear stockpile (0 = non-nuclear)
 *   power      { land, air, sea, cyber, space } 0-100 relative capability
 *   veto       permanent UNSC seat
 *   oilBeta    econ sensitivity to a +1% oil move (exporters positive)
 *   resilience 0-1, ability to absorb economic coercion (substitution, autarky)
 *   escTol     0-1, doctrinal tolerance for escalation risk
 *   domConstr  0-1, how tightly public opinion binds leadership
 *   softPower  0-100, ability to assemble coalitions / set agendas
 *   bias       action-class preference weights {DIP, INFO, MIL, ECON}
 *   interests  weights over outcome dimensions, used by the AI
 *   redlines   declared thresholds; crossing them triggers counter-escalation
 */
(function (MP) {
  'use strict';

  const POWERS = {
    /* ------------------------------------------------------------------ */
    US: {
      id: 'US', name: 'United States', short: 'USA', flag: '🇺🇸',
      color: '#4aa8ff', playable: true,
      gdp: 30.0, milUSD: 895, troops: 1_320_000, warheads: 3700,
      power: { land: 88, air: 100, sea: 100, cyber: 96, space: 100 },
      veto: true, bloc: 'NATO',
      oilBeta: 0.04, resilience: 0.86, escTol: 0.42, domConstr: 0.72, softPower: 82,
      bias: { DIP: 1.0, INFO: 1.0, MIL: 1.05, ECON: 1.15 },
      tradeWeight: { CN: 0.11, EU: 0.15, IN: 0.03, JP: 0.06, RU: 0.002, IR: 0.0, TR: 0.03, IL: 0.20, SA: 0.10, UA: 0.02, TW: 0.22, KP: 0.0, PK: 0.10 },
      interests: { deterPeerWar: 1.0, allianceCohesion: 0.9, seaLanes: 0.8, energyPrice: 0.5, nonprolif: 0.7, homeEcon: 0.9, primacy: 0.8 },
      redlines: [
        'Direct attack on NATO territory (Article 5)',
        'Chinese amphibious assault on Taiwan',
        'Nuclear use by any state',
        'Attack on US forces causing mass casualties'
      ],
      doctrine: 'Extended deterrence through forward-deployed forces and treaty alliances; ' +
        'economic statecraft (sanctions, export controls) as the first-resort instrument; ' +
        'strong domestic constraint on ground-force commitments.',
      brief: 'The largest economy and only global-reach military, but stretched across three ' +
        'simultaneous theatres (Europe, Indo-Pacific, Middle East) with a domestic politics ' +
        'increasingly sceptical of open-ended commitments.',
      objectives: [
        { id: 'nopeerwar', text: 'No peer war — hold Taiwan and Ukraine at rung 4 or below', w: 1.3 },
        { id: 'cohesion', text: 'Alliance cohesion — 76 for full credit, nothing below 62', w: 1.1 },
        { id: 'oil', text: 'Oil under $68 for full credit, nothing above $80', w: 0.8 },
        { id: 'approval', text: 'Domestic approval — 60 for full credit, nothing below 46', w: 0.9 },
        { id: 'econ', text: 'Economic index — 104 for full credit, nothing below 96', w: 1.0 }
      ]
    },

    CN: {
      id: 'CN', name: 'China', short: 'CHN', flag: '🇨🇳',
      color: '#ff5a5a', playable: true,
      gdp: 19.2, milUSD: 300, troops: 2_035_000, warheads: 600,
      power: { land: 90, air: 82, sea: 86, cyber: 90, space: 84 },
      veto: true, bloc: 'None',
      oilBeta: -0.22, resilience: 0.74, escTol: 0.38, domConstr: 0.28, softPower: 55,
      bias: { DIP: 1.05, INFO: 1.1, MIL: 0.85, ECON: 1.2 },
      tradeWeight: { US: 0.13, EU: 0.14, RU: 0.32, IN: 0.12, JP: 0.20, IR: 0.30, TR: 0.09, IL: 0.10, SA: 0.20, TW: 0.35, KP: 0.90, PK: 0.28, UA: 0.05 },
      interests: { reunification: 1.0, homeEcon: 1.2, seaLanes: 0.9, techAccess: 1.1, energyPrice: 0.7, splitUSAlliances: 0.8, stability: 0.6 },
      redlines: [
        'Formal declaration of Taiwanese independence',
        'Foreign troops permanently stationed on Taiwan',
        'Blockade of Chinese energy imports',
        'Strikes on the Chinese mainland'
      ],
      doctrine: 'Gray-zone and economic instruments preferred over kinetic force; ' +
        'anti-access/area-denial to raise the cost of US intervention; ' +
        'patience — time is assumed to favour Beijing absent external shocks.',
      brief: 'The manufacturing core of the world economy, dependent on imported energy through ' +
        'chokepoints it does not control, and on semiconductor supply chains subject to ' +
        'export controls. Demographics and property-sector debt constrain the long game.',
      objectives: [
        { id: 'taiwan', text: 'Strait balance — 58 for full credit, nothing below 42', w: 1.3 },
        { id: 'nowar', text: 'Achieve it without taking the Strait past rung 5', w: 1.2 },
        { id: 'econ', text: 'Economic index — 105 for full credit, nothing below 97', w: 1.1 },
        { id: 'splitalliance', text: 'Split the alliance — US cohesion down to 64', w: 0.9 },
        { id: 'tech', text: 'Technology access — 70 for full credit, nothing below 52', w: 0.9 }
      ]
    },

    RU: {
      id: 'RU', name: 'Russia', short: 'RUS', flag: '🇷🇺',
      color: '#c98cff', playable: true,
      gdp: 2.2, milUSD: 145, troops: 1_320_000, warheads: 4300,
      power: { land: 78, air: 66, sea: 55, cyber: 84, space: 62 },
      veto: true, bloc: 'CSTO',
      oilBeta: 0.34, resilience: 0.62, escTol: 0.74, domConstr: 0.22, softPower: 28,
      bias: { DIP: 0.85, INFO: 1.25, MIL: 1.2, ECON: 0.8 },
      tradeWeight: { CN: 0.06, EU: 0.04, IN: 0.05, US: 0.001, IR: 0.12, TR: 0.10, UA: 0.02, KP: 0.30, SA: 0.02 },
      interests: { sanctionsRelief: 1.1, territorial: 1.2, splitNATO: 1.0, energyPrice: 1.0, regimeStability: 1.2, sphereOfInfluence: 0.9 },
      redlines: [
        'NATO combat troops deployed inside Ukraine',
        'Strikes on strategic early-warning or nuclear C2',
        'Attack threatening the survival of the state',
        'Seizure of Kaliningrad access corridors'
      ],
      doctrine: 'Escalate-to-de-escalate signalling backed by the largest warhead stockpile; ' +
        'attrition and manpower substitution on the ground; energy and information ' +
        'instruments aimed at coalition cohesion rather than battlefield outcomes.',
      brief: 'A war economy running at high defence spending with a shrinking civilian sector, ' +
        'reoriented trade toward Asia at a discount, and a nuclear arsenal that substitutes ' +
        'for conventional and economic weakness.',
      objectives: [
        { id: 'hold', text: 'Front-line control — 58 for full credit, nothing below 40', w: 1.3 },
        { id: 'sanctions', text: 'Sanctions pressure down to 18, nothing above 36', w: 1.1 },
        { id: 'natosplit', text: 'Push US alliance cohesion down to 62', w: 1.0 },
        { id: 'approval', text: 'Regime approval — 60 for full credit, nothing below 34', w: 1.0 },
        { id: 'oil', text: 'Oil at $86 for full credit, nothing below $68', w: 0.9 }
      ]
    },

    EU: {
      id: 'EU', name: 'European Union', short: 'EU', flag: '🇪🇺',
      color: '#ffd45a', playable: true,
      gdp: 19.4, milUSD: 390, troops: 1_300_000, warheads: 290,
      power: { land: 62, air: 66, sea: 60, cyber: 70, space: 66 },
      veto: true, bloc: 'NATO', vetoNote: 'via France',
      oilBeta: -0.30, resilience: 0.66, escTol: 0.24, domConstr: 0.85, softPower: 78,
      bias: { DIP: 1.3, INFO: 0.9, MIL: 0.7, ECON: 1.2 },
      tradeWeight: { US: 0.16, CN: 0.14, RU: 0.03, TR: 0.41, UA: 0.40, IN: 0.11, IL: 0.28, SA: 0.16, IR: 0.05 },
      interests: { energyPrice: 1.2, ukraineSurvival: 1.1, cohesion: 1.2, homeEcon: 1.1, migration: 0.9, ruleOfLaw: 0.8, strategicAutonomy: 0.7 },
      redlines: [
        'Attack on any member state',
        'Nuclear detonation anywhere in Europe',
        'Deliberate strike on EU-flagged shipping or critical infrastructure'
      ],
      doctrine: 'Regulatory and market power as the primary lever; consensus decision-making ' +
        'makes escalation slow and reversal slower; defence rearmament under way but ' +
        'capability gaps in strategic enablers persist.',
      brief: 'The largest single market and Ukraine\'s main financial backer, structurally ' +
        'dependent on imported energy and on US strategic enablers. Every decision requires ' +
        'twenty-seven capitals to agree — cohesion is both the resource and the constraint.',
      objectives: [
        { id: 'ukraine', text: 'Prevent Ukrainian collapse — economy and front line both hold', w: 1.3 },
        { id: 'energy', text: 'Energy costs — oil under $68, nothing above $80', w: 1.0 },
        { id: 'cohesion', text: 'Bloc cohesion — 80 for full credit, nothing below 64', w: 1.2 },
        { id: 'noeurowar', text: 'No European theatre above rung 5', w: 1.2 },
        { id: 'econ', text: 'Economic index — 104 for full credit, nothing below 96', w: 1.0 }
      ]
    },

    IN: {
      id: 'IN', name: 'India', short: 'IND', flag: '🇮🇳',
      color: '#68d391', playable: true,
      gdp: 4.3, milUSD: 86, troops: 1_460_000, warheads: 180,
      power: { land: 76, air: 62, sea: 58, cyber: 60, space: 66 },
      veto: false, bloc: 'Non-aligned',
      oilBeta: -0.32, resilience: 0.70, escTol: 0.40, domConstr: 0.55, softPower: 62,
      bias: { DIP: 1.25, INFO: 0.9, MIL: 0.95, ECON: 1.05 },
      tradeWeight: { US: 0.18, CN: 0.11, RU: 0.06, EU: 0.11, SA: 0.10, IR: 0.06, PK: 0.02 },
      interests: { strategicAutonomy: 1.3, homeEcon: 1.2, energyPrice: 1.1, chinaBalance: 1.0, regionalPrimacy: 0.9, techAccess: 0.8 },
      redlines: [
        'Cross-border mass-casualty terrorism',
        'Chinese incursion across the Line of Actual Control',
        'Pakistani nuclear signalling during a crisis'
      ],
      doctrine: 'Multi-alignment: buys Russian oil and American aircraft in the same quarter. ' +
        'Cold Start-style rapid conventional retaliation below the nuclear threshold; ' +
        'no-first-use declaratory policy.',
      brief: 'The fastest-growing large economy, hedging between blocs by design. Discounted ' +
        'Russian crude underwrites the growth story; a two-front problem (China, Pakistan) ' +
        'underwrites the defence budget.',
      objectives: [
        { id: 'autonomy', text: 'Strategic autonomy — working relations with BOTH Washington and Moscow', w: 1.3 },
        { id: 'econ', text: 'Growth story intact — economic index 105', w: 1.2 },
        { id: 'oil', text: 'Oil under $70, nothing above $82', w: 1.0 },
        { id: 'kashmir', text: 'Kashmir tension down to 30, nothing above 44', w: 1.0 },
        { id: 'lac', text: 'Himalayan frontier at rung 2 or below', w: 0.9 }
      ]
    },

    IR: {
      id: 'IR', name: 'Iran', short: 'IRN', flag: '🇮🇷',
      color: '#4fd1c5', playable: true,
      gdp: 0.44, milUSD: 16, troops: 610_000, warheads: 0, threshold: true,
      power: { land: 55, air: 28, sea: 34, cyber: 62, space: 30 },
      veto: false, bloc: 'Axis of Resistance',
      oilBeta: 0.40, resilience: 0.58, escTol: 0.60, domConstr: 0.35, softPower: 24,
      bias: { DIP: 0.9, INFO: 1.1, MIL: 1.15, ECON: 0.7 },
      tradeWeight: { CN: 0.05, RU: 0.03, TR: 0.04, IN: 0.02, EU: 0.01, IL: 0.0 },
      interests: { regimeStability: 1.4, sanctionsRelief: 1.2, deterrence: 1.1, proxyNetwork: 0.9, energyPrice: 1.0, nuclearLatency: 0.9 },
      redlines: [
        'Strikes on nuclear enrichment facilities',
        'Decapitation attempts on senior leadership',
        'Total blockade of oil exports',
        'Ground invasion'
      ],
      doctrine: 'Forward defence through partner militias, missile and drone mass as the ' +
        'principal deterrent, and calibrated retaliation designed to be visible but ' +
        'below the threshold that would justify regime-threatening response.',
      brief: 'An economy squeezed by a decade of sanctions and selling discounted crude to a ' +
        'single major buyer, offset by an asymmetric arsenal and a partner network that has ' +
        'absorbed heavy attrition.',
      objectives: [
        { id: 'regime', text: 'Regime stability — approval 44, nothing below 14', w: 1.4 },
        { id: 'sanctions', text: 'Sanctions pressure down to 35, nothing above 60', w: 1.2 },
        { id: 'nuclear', text: 'Preserve nuclear latency — programme at 75, nothing below 45', w: 1.1 },
        { id: 'axis', text: 'Partner network holds ground in the Levant', w: 1.0 },
        { id: 'nowar', text: 'Avoid a war above rung 5 in the Levant', w: 1.2 }
      ]
    },

    IL: {
      id: 'IL', name: 'Israel', short: 'ISR', flag: '🇮🇱',
      color: '#7fb3ff', playable: true,
      gdp: 0.55, milUSD: 33, troops: 170_000, warheads: 90, undeclared: true,
      power: { land: 62, air: 78, sea: 46, cyber: 88, space: 58 },
      veto: false, bloc: 'US-aligned',
      oilBeta: -0.12, resilience: 0.55, escTol: 0.68, domConstr: 0.62, softPower: 30,
      bias: { DIP: 0.85, INFO: 1.2, MIL: 1.3, ECON: 0.7 },
      tradeWeight: { US: 0.02, EU: 0.03, IN: 0.02, TR: 0.02, SA: 0.0 },
      interests: { iranNuclear: 1.4, deterrence: 1.2, usSupport: 1.1, homeEcon: 0.8, normalisation: 0.7, legitimacy: 0.6 },
      redlines: [
        'Iranian weapons-grade enrichment',
        'Strategic weapons transfers to hostile forces on the border',
        'Mass-casualty attack on Israeli cities'
      ],
      doctrine: 'The Begin Doctrine — pre-emptive denial of adversary nuclear capability; ' +
        'escalation dominance through air superiority and intelligence penetration; ' +
        'campaign-between-the-wars strikes to degrade capability without triggering total war.',
      brief: 'Qualitative military edge and deep intelligence reach against a ring of ' +
        'adversaries, but a small population base, munition-stock dependence on Washington, ' +
        'and an eroding international legitimacy position.',
      objectives: [
        { id: 'irannuke', text: 'Iranian programme suppressed to 55, nothing above 88', w: 1.4 },
        { id: 'multifront', text: 'Avoid a Levant war above rung 6', w: 1.2 },
        { id: 'ussupport', text: 'Retain US support — relationship 0.9, nothing below 0.6', w: 1.2 },
        { id: 'legit', text: 'International legitimacy — 34, nothing below 18', w: 0.9 },
        { id: 'econ', text: 'Economic index — 102 for full credit, nothing below 92', w: 0.9 }
      ]
    },

    TR: {
      id: 'TR', name: 'Türkiye', short: 'TUR', flag: '🇹🇷',
      color: '#f6ad55', playable: true,
      gdp: 1.35, milUSD: 26, troops: 355_000, warheads: 0,
      power: { land: 70, air: 58, sea: 52, cyber: 55, space: 40 },
      veto: false, bloc: 'NATO',
      oilBeta: -0.24, resilience: 0.60, escTol: 0.52, domConstr: 0.48, softPower: 44,
      bias: { DIP: 1.2, INFO: 1.0, MIL: 1.05, ECON: 0.95 },
      tradeWeight: { EU: 0.05, RU: 0.05, US: 0.02, IR: 0.03, SA: 0.03, UA: 0.05 },
      interests: { balancing: 1.3, homeEcon: 1.2, regionalInfluence: 1.1, energyHub: 1.0, kurdishIssue: 1.0, natoLeverage: 0.9 },
      redlines: [
        'Kurdish statelet on the southern border',
        'Hostile closure of the Turkish Straits regime',
        'Attack on Turkish forces in Syria or Iraq'
      ],
      doctrine: 'Transactional balancing inside NATO — buys Russian air defence and sells ' +
        'drones to Russia\'s adversaries; Montreux Convention control of the Straits as ' +
        'permanent leverage; forward posture in Syria, Iraq, Libya and the Caucasus.',
      brief: 'The alliance member that talks to everyone. Controls the Bosphorus, hosts ' +
        'millions of refugees, runs a drone-export industry, and manages chronic ' +
        'currency and inflation stress.',
      objectives: [
        { id: 'balance', text: 'Leverage with NATO and Moscow at the same time', w: 1.3 },
        { id: 'econ', text: 'Currency stable — economic index 104, nothing below 97', w: 1.3 },
        { id: 'influence', text: 'Cool two of the Levant, Ukraine, Sahel or Arctic by a quarter', w: 1.0 },
        { id: 'approval', text: 'Domestic approval — 60 for full credit, nothing below 46', w: 1.0 },
        { id: 'nowar', text: 'No theatre you are party to above rung 6', w: 1.1 }
      ]
    },

    /* ---------------------- AI-only regional actors --------------------- */
    JP: {
      id: 'JP', name: 'Japan', short: 'JPN', flag: '🇯🇵', color: '#e2e8f0', playable: false,
      gdp: 4.2, milUSD: 57, troops: 247_000, warheads: 0,
      power: { land: 48, air: 68, sea: 74, cyber: 58, space: 62 },
      veto: false, bloc: 'US-aligned',
      oilBeta: -0.36, resilience: 0.64, escTol: 0.26, domConstr: 0.78, softPower: 70,
      bias: { DIP: 1.2, INFO: 0.8, MIL: 0.8, ECON: 1.1 },
      tradeWeight: { CN: 0.20, US: 0.06, TW: 0.15 },
      interests: { seaLanes: 1.2, chinaBalance: 1.1, homeEcon: 1.1, usAlliance: 1.2, energyPrice: 1.1 },
      redlines: ['Attack on Japanese territory or the Senkakus', 'Blockade of Japanese sea lanes'],
      doctrine: 'Counter-strike capability under a defensive-defence posture; rearming toward ' +
        '2% of GDP while remaining dependent on the US nuclear umbrella.',
      brief: 'Rearming after seventy years of restraint, with the world\'s most exposed ' +
        'energy import dependency and the front-row seat to the Taiwan contingency.'
    },

    UA: {
      id: 'UA', name: 'Ukraine', short: 'UKR', flag: '🇺🇦', color: '#ffe066', playable: false,
      gdp: 0.19, milUSD: 64, troops: 880_000, warheads: 0,
      power: { land: 64, air: 30, sea: 22, cyber: 66, space: 12 },
      veto: false, bloc: 'EU-aligned',
      oilBeta: -0.18, resilience: 0.40, escTol: 0.72, domConstr: 0.50, softPower: 52,
      bias: { DIP: 1.1, INFO: 1.2, MIL: 1.2, ECON: 0.6 },
      tradeWeight: { EU: 0.60, US: 0.05 },
      interests: { survival: 1.5, territorial: 1.2, westernAid: 1.4, euAccession: 0.9 },
      redlines: ['Loss of Odesa / sea access', 'Termination of Western military assistance'],
      doctrine: 'Deep-strike drone and missile campaign against logistics and energy ' +
        'infrastructure; defence in depth traded for time and external supply.',
      brief: 'Fighting a war of national survival on external financing, with manpower ' +
        'and air-defence interceptors as the binding constraints.'
    },

    TW: {
      id: 'TW', name: 'Taiwan', short: 'TWN', flag: '🇹🇼', color: '#9ae6b4', playable: false,
      gdp: 0.80, milUSD: 20, troops: 170_000, warheads: 0,
      power: { land: 42, air: 52, sea: 44, cyber: 64, space: 30 },
      veto: false, bloc: 'US-aligned',
      oilBeta: -0.30, resilience: 0.48, escTol: 0.30, domConstr: 0.80, softPower: 46,
      bias: { DIP: 1.1, INFO: 1.0, MIL: 1.0, ECON: 1.1 },
      tradeWeight: { CN: 0.22, US: 0.05, JP: 0.08 },
      interests: { survival: 1.5, usSupport: 1.3, ambiguity: 1.0, homeEcon: 1.1, chipLeverage: 1.2 },
      redlines: ['Blockade or quarantine of the island', 'Amphibious or airborne assault'],
      doctrine: 'Porcupine strategy — asymmetric, dispersed, survivable systems designed to ' +
        'make an amphibious assault unaffordable rather than to win a symmetric fight.',
      brief: 'Produces the majority of the world\'s advanced logic chips — the "silicon ' +
        'shield" that is simultaneously its protection and the reason it is contested.'
    },

    SA: {
      id: 'SA', name: 'Saudi Arabia', short: 'KSA', flag: '🇸🇦', color: '#48bb78', playable: false,
      gdp: 1.10, milUSD: 76, troops: 257_000, warheads: 0,
      power: { land: 52, air: 60, sea: 38, cyber: 40, space: 26 },
      veto: false, bloc: 'Gulf',
      oilBeta: 0.52, resilience: 0.66, escTol: 0.30, domConstr: 0.20, softPower: 44,
      bias: { DIP: 1.3, INFO: 0.9, MIL: 0.8, ECON: 1.2 },
      tradeWeight: { CN: 0.06, US: 0.03, IN: 0.05, EU: 0.04 },
      interests: { oilRevenue: 1.4, regimeStability: 1.3, iranBalance: 1.0, diversification: 1.1, usSecurity: 0.9 },
      redlines: ['Attack on oil export infrastructure', 'Iranian nuclear breakout'],
      doctrine: 'Hedging: security guarantees sought from Washington, oil-market coordination ' +
        'with Moscow, de-escalation channels with Tehran, capital ties with Beijing.',
      brief: 'The swing producer. A quota decision in Riyadh moves every economy on this board.'
    },

    KP: {
      id: 'KP', name: 'North Korea', short: 'PRK', flag: '🇰🇵', color: '#a0aec0', playable: false,
      gdp: 0.03, milUSD: 4, troops: 1_280_000, warheads: 50,
      power: { land: 58, air: 20, sea: 22, cyber: 70, space: 24 },
      veto: false, bloc: 'None',
      oilBeta: -0.05, resilience: 0.90, escTol: 0.80, domConstr: 0.05, softPower: 6,
      bias: { DIP: 0.7, INFO: 1.0, MIL: 1.4, ECON: 0.5 },
      tradeWeight: { CN: 0.02, RU: 0.02 },
      interests: { regimeSurvival: 1.6, sanctionsRelief: 1.0, recognition: 0.9, russiaTies: 1.0 },
      redlines: ['Decapitation strike planning', 'Full maritime interdiction'],
      doctrine: 'Nuclear forces as absolute regime insurance, with declaratory pre-emptive-use ' +
        'language and artillery mass held at risk against Seoul.',
      brief: 'Effectively sanction-proof, now monetising munitions and manpower in exchange ' +
        'for Russian technology and food.'
    },

    PK: {
      id: 'PK', name: 'Pakistan', short: 'PAK', flag: '🇵🇰', color: '#81e6d9', playable: false,
      gdp: 0.37, milUSD: 11, troops: 654_000, warheads: 170,
      power: { land: 62, air: 48, sea: 30, cyber: 44, space: 22 },
      veto: false, bloc: 'China-aligned',
      oilBeta: -0.26, resilience: 0.42, escTol: 0.58, domConstr: 0.40, softPower: 22,
      bias: { DIP: 1.0, INFO: 1.1, MIL: 1.1, ECON: 0.8 },
      tradeWeight: { CN: 0.03, US: 0.02, SA: 0.03 },
      interests: { indiaBalance: 1.3, regimeStability: 1.2, imfSupport: 1.2, kashmir: 1.0 },
      redlines: ['Indian ground incursion', 'Disruption of the Indus water treaty'],
      doctrine: 'Full-spectrum deterrence including tactical warheads to offset Indian ' +
        'conventional superiority; explicit rejection of no-first-use.',
      brief: 'A chronic balance-of-payments patient with a nuclear arsenal and a conventional ' +
        'gap it closes with declaratory policy.'
    }
  };

  /* Alliance / bloc affinity: -1 hostile … +1 allied. Used for coalition maths,
     escalation entanglement and diplomatic reachability. Symmetric by default. */
  const AFFINITY = {
    'US-EU': 0.85, 'US-JP': 0.9, 'US-IL': 0.8, 'US-TW': 0.6, 'US-UA': 0.65, 'US-SA': 0.4,
    'US-IN': 0.35, 'US-TR': 0.25, 'US-PK': 0.05, 'US-CN': -0.45, 'US-RU': -0.75, 'US-IR': -0.8, 'US-KP': -0.85,
    'CN-RU': 0.6, 'CN-IR': 0.45, 'CN-KP': 0.45, 'CN-PK': 0.7, 'CN-SA': 0.3, 'CN-EU': -0.15,
    'CN-IN': -0.35, 'CN-JP': -0.4, 'CN-TW': -0.7, 'CN-TR': 0.1, 'CN-UA': 0.0, 'CN-IL': 0.0,
    'RU-IR': 0.5, 'RU-KP': 0.55, 'RU-IN': 0.45, 'RU-TR': 0.2, 'RU-EU': -0.7, 'RU-UA': -0.95,
    'RU-JP': -0.4, 'RU-SA': 0.25, 'RU-IL': -0.1, 'RU-TW': 0.0, 'RU-PK': 0.1,
    'EU-UA': 0.8, 'EU-TR': 0.3, 'EU-IN': 0.35, 'EU-JP': 0.6, 'EU-IL': 0.2, 'EU-IR': -0.4,
    'EU-SA': 0.25, 'EU-TW': 0.2, 'EU-KP': -0.7, 'EU-PK': 0.1,
    'IR-IL': -0.95, 'IR-SA': -0.2, 'IR-TR': 0.15, 'IR-IN': 0.2, 'IR-PK': 0.15, 'IR-UA': -0.3,
    'IL-SA': 0.15, 'IL-TR': -0.3, 'IL-IN': 0.4, 'IL-JP': 0.2, 'IL-PK': -0.4, 'IL-TW': 0.1, 'IL-KP': -0.5,
    'IN-PK': -0.75, 'IN-JP': 0.6, 'IN-SA': 0.4, 'IN-TR': 0.0, 'IN-UA': 0.1, 'IN-TW': 0.2, 'IN-KP': -0.2,
    'TR-SA': 0.2, 'TR-UA': 0.5, 'TR-JP': 0.2, 'TR-IL': -0.3, 'TR-TW': 0.0, 'TR-PK': 0.4, 'TR-KP': -0.3,
    'JP-TW': 0.55, 'JP-KP': -0.8, 'JP-SA': 0.3, 'JP-UA': 0.4, 'JP-IN': 0.6, 'JP-PK': 0.1,
    'SA-PK': 0.5, 'SA-UA': 0.1, 'SA-TW': 0.0, 'SA-KP': -0.2,
    'UA-KP': -0.6, 'UA-TW': 0.2, 'UA-PK': 0.0, 'UA-IL': 0.1,
    'TW-KP': -0.5, 'TW-PK': 0.0, 'KP-PK': 0.1
  };

  function affinity(a, b) {
    if (a === b) return 1;
    return AFFINITY[a + '-' + b] !== undefined ? AFFINITY[a + '-' + b]
      : (AFFINITY[b + '-' + a] !== undefined ? AFFINITY[b + '-' + a] : 0);
  }

  /* Share of B's external trade exposed to A — the core coercion-leverage term. */
  function tradeLeverage(a, b) {
    const p = POWERS[a];
    if (!p || !p.tradeWeight) return 0.01;
    return p.tradeWeight[b] !== undefined ? p.tradeWeight[b] : 0.02;
  }

  MP.POWERS = POWERS;
  MP.affinity = affinity;
  MP.tradeLeverage = tradeLeverage;
  MP.powerList = Object.keys(POWERS);
  MP.playableList = Object.keys(POWERS).filter(k => POWERS[k].playable);
})(typeof self !== 'undefined' ? (self.MP = self.MP || {}) : (this.MP = this.MP || {}));
