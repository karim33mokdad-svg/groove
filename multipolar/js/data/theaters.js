/* MULTIPOLAR — data/theaters.js
 * Active theatres on the board, with a starting position for the model baseline.
 *
 * control  0-100 on the axis sideA <-> sideB. 50 = stalemate/status quo.
 *          Higher = sideA advantage.
 * tension  0-100 crisis temperature; drives event probability.
 * rung     position on the shared escalation ladder (see engine/escalation.js)
 * pinned   drivers that make the theatre resistant to change
 */
(function (MP) {
  'use strict';

  const THEATERS = {
    UKR: {
      id: 'UKR', name: 'Ukraine', region: 'Eastern Europe',
      lat: 48.4, lon: 33.0,
      sideA: 'RU', sideB: 'UA', sideALabel: 'Russia', sideBLabel: 'Ukraine',
      backers: { RU: ['KP', 'IR', 'CN'], UA: ['EU', 'US', 'TR'] },
      control: 58, tension: 82, rung: 6, hot: true,
      axisLabel: 'Front-line momentum',
      brief: 'Attritional ground war along a long static front, with both sides running deep-strike ' +
        'campaigns against energy and logistics. The binding constraints are manpower and ' +
        'air-defence interceptors on one side, and munitions throughput and casualty ' +
        'tolerance on the other.',
      drivers: [
        'Western financing and interceptor supply set Ukraine\'s ceiling',
        'Russian advance rates are measured in metres per week at high cost',
        'Both economies are running war-mobilised fiscal policy',
        'Any NATO force presence inside Ukraine is a declared Russian red line'
      ],
      rungFloor: 4,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 9,
      nuclearDyad: true,
      oilImpact: 0.18, tradeImpact: 0.10
    },

    TWN: {
      id: 'TWN', name: 'Taiwan Strait', region: 'Indo-Pacific',
      lat: 24.5, lon: 120.5,
      sideA: 'CN', sideB: 'TW', sideALabel: 'Beijing', sideBLabel: 'Taipei + partners',
      backers: { CN: ['RU', 'KP'], TW: ['US', 'JP', 'EU'] },
      control: 46, tension: 54, rung: 3, hot: false,
      axisLabel: 'Strait balance of coercion',
      brief: 'Sustained gray-zone pressure — median-line crossings, ADIZ incursions, coast-guard ' +
        'boarding drills, undersea cable interference — designed to normalise coercion below ' +
        'the threshold that triggers an American response.',
      drivers: [
        'Advanced semiconductor concentration makes the island a systemic economic node',
        'Amphibious assault remains the hardest operation in modern warfare',
        'US policy is deliberately ambiguous about direct intervention',
        'Blockade/quarantine is the lower-cost coercive option and the likeliest flashpoint'
      ],
      rungFloor: 2,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 9,
      nuclearDyad: true,
      oilImpact: 0.12, tradeImpact: 0.55
    },

    SCS: {
      id: 'SCS', name: 'South China Sea', region: 'Indo-Pacific',
      lat: 13.0, lon: 115.0,
      sideA: 'CN', sideB: 'US', sideALabel: 'Beijing', sideBLabel: 'Claimants + USN',
      backers: { CN: [], US: ['JP', 'EU'] },
      control: 60, tension: 48, rung: 3, hot: false,
      axisLabel: 'Effective control of features',
      brief: 'Militarised features, water-cannon and ramming incidents against claimant resupply ' +
        'missions, and freedom-of-navigation operations answered by shadowing. Attrition of ' +
        'legal norms rather than of forces.',
      drivers: [
        'A third of global trade transits these waters',
        'Arbitral rulings are unenforced; possession is the operative fact',
        'Coast guard and maritime militia keep incidents below "armed attack"',
        'A defence-treaty claimant makes miscalculation escalatory'
      ],
      rungFloor: 2,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 7,
      nuclearDyad: false,
      oilImpact: 0.10, tradeImpact: 0.35
    },

    LEV: {
      id: 'LEV', name: 'Israel–Iran & the Levant', region: 'Middle East',
      lat: 32.5, lon: 36.0,
      sideA: 'IL', sideB: 'IR', sideALabel: 'Israel', sideBLabel: 'Iran + partners',
      backers: { IL: ['US'], IR: ['RU'] },
      control: 62, tension: 76, rung: 5, hot: true,
      axisLabel: 'Regional military balance',
      brief: 'Direct state-on-state exchanges have replaced the old proxy-only pattern: standoff ' +
        'missile and drone salvos, strikes on nuclear and missile infrastructure, and ' +
        'degraded but surviving partner militias across four countries.',
      drivers: [
        'Air superiority and intelligence penetration favour one side decisively',
        'Missile mass and dispersal favour the other in a long exchange',
        'Interceptor stocks are the real constraint on both sides',
        'Nuclear-programme strikes are the single most escalatory available action'
      ],
      rungFloor: 3,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 8,
      nuclearDyad: false,
      oilImpact: 0.45, tradeImpact: 0.15
    },

    RED: {
      id: 'RED', name: 'Red Sea & Bab al-Mandab', region: 'Middle East',
      lat: 13.5, lon: 43.0,
      sideA: 'US', sideB: 'IR', sideALabel: 'Coalition escorts', sideBLabel: 'Yemen-based forces',
      backers: { US: ['EU', 'IL'], IR: [] },
      control: 44, tension: 64, rung: 4, hot: true,
      axisLabel: 'Freedom of commercial navigation',
      brief: 'Anti-ship missile and one-way-drone attacks on commercial traffic, answered by naval ' +
        'escort and strike operations. Cost exchange strongly favours the attacker: cheap ' +
        'drones against million-dollar interceptors.',
      drivers: [
        'Rerouting around the Cape adds ~10-14 days and reshapes global freight rates',
        'Attacks track the Gaza/Levant escalation cycle',
        'Strikes on launch sites have not restored deterrence',
        'Insurance premiums, not military outcomes, decide when traffic returns'
      ],
      rungFloor: 2,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 6,
      nuclearDyad: false,
      oilImpact: 0.22, tradeImpact: 0.30
    },

    KOR: {
      id: 'KOR', name: 'Korean Peninsula', region: 'Indo-Pacific',
      lat: 38.0, lon: 127.5,
      sideA: 'KP', sideB: 'US', sideALabel: 'Pyongyang', sideBLabel: 'ROK–US alliance',
      backers: { KP: ['RU', 'CN'], US: ['JP'] },
      control: 42, tension: 46, rung: 3, hot: false,
      axisLabel: 'Deterrence stability',
      brief: 'Missile testing cycles, abandoned unification framing, artillery and border incidents, ' +
        'and a deepening munitions-and-manpower-for-technology relationship with Moscow that ' +
        'has removed the last sanctions leverage.',
      drivers: [
        'Seoul is within conventional artillery range — that fact governs everything',
        'Russian technology transfer is eroding the missile-defence problem',
        'Sanctions enforcement has effectively collapsed',
        'Warhead count is small but survivable enough for deterrence'
      ],
      rungFloor: 2,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 9,
      nuclearDyad: true,
      oilImpact: 0.05, tradeImpact: 0.20
    },

    HIM: {
      id: 'HIM', name: 'Himalayan Frontier', region: 'South Asia',
      lat: 34.0, lon: 78.5,
      sideA: 'CN', sideB: 'IN', sideALabel: 'China', sideBLabel: 'India',
      backers: { CN: ['PK'], IN: ['US', 'JP'] },
      control: 52, tension: 40, rung: 2, hot: false,
      axisLabel: 'Line of Actual Control',
      brief: 'A disengaged but unresolved border with hardened infrastructure on both sides, ' +
        'managed by protocol (no firearms at the friction points) that has held since the ' +
        'last fatal clashes — and a cautious partial thaw in trade and flights.',
      drivers: [
        'Terrain and altitude make offensives extremely costly',
        'Both sides have built roads, rail and airfields right up to the line',
        'Two nuclear powers with no hotline culture of the Cold War kind',
        'Trade normalisation runs in parallel with military hardening'
      ],
      rungFloor: 1,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 7,
      nuclearDyad: true,
      oilImpact: 0.03, tradeImpact: 0.08
    },

    KAS: {
      id: 'KAS', name: 'Kashmir & the LoC', region: 'South Asia',
      lat: 33.8, lon: 74.5,
      sideA: 'IN', sideB: 'PK', sideALabel: 'India', sideBLabel: 'Pakistan',
      backers: { IN: ['US', 'IL'], PK: ['CN', 'SA'] },
      control: 56, tension: 58, rung: 3, hot: false,
      axisLabel: 'Line of Control stability',
      brief: 'A crisis-prone dyad with a demonstrated ladder: mass-casualty attack, cross-border ' +
        'air or missile retaliation within days, tit-for-tat exchange, then external mediation ' +
        'and a ceasefire — all compressed into under a week.',
      drivers: [
        'Retaliation is now near-automatic and politically mandatory',
        'Escalation windows are days, not months',
        'Both arsenals include short-range systems that blur the nuclear threshold',
        'Water-sharing arrangements have become an additional coercive lever'
      ],
      rungFloor: 2,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 8,
      nuclearDyad: true,
      oilImpact: 0.04, tradeImpact: 0.06
    },

    SAH: {
      id: 'SAH', name: 'Sahel & West Africa', region: 'Africa',
      lat: 15.0, lon: 2.0,
      sideA: 'RU', sideB: 'EU', sideALabel: 'Moscow-aligned juntas', sideBLabel: 'Western partners',
      backers: { RU: ['CN'], EU: ['US', 'TR'] },
      control: 64, tension: 56, rung: 3, hot: true,
      axisLabel: 'Alignment of the juntas',
      brief: 'Western forces expelled, replaced by Russian security contractors trading protection ' +
        'for mining concessions, while insurgencies expand toward the Gulf of Guinea coast and ' +
        'regional blocs fracture.',
      drivers: [
        'Security-for-resources deals are cheap for Moscow and hard to reverse',
        'Insurgent control is expanding regardless of who provides the security',
        'Migration pressure transmits the conflict directly into European politics',
        'Uranium, gold and cobalt supply chains are downstream of these regimes'
      ],
      rungFloor: 2,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 5,
      nuclearDyad: false,
      oilImpact: 0.06, tradeImpact: 0.05
    },

    ARC: {
      id: 'ARC', name: 'Arctic & High North', region: 'Arctic',
      lat: 76.0, lon: 25.0,
      sideA: 'RU', sideB: 'EU', sideALabel: 'Russia', sideBLabel: 'NATO north',
      backers: { RU: ['CN'], EU: ['US'] },
      control: 54, tension: 38, rung: 2, hot: false,
      axisLabel: 'Northern flank posture',
      brief: 'Alliance enlargement has turned the Baltic into an interior sea and doubled NATO\'s ' +
        'land border with Russia. Undersea cable and pipeline damage, GPS jamming and shadow-fleet ' +
        'tanker traffic are the daily currency.',
      drivers: [
        'Sea-ice retreat is opening a northern route Beijing wants a stake in',
        'Bastion defence of the sea-based deterrent drives Russian posture',
        'Attribution for undersea sabotage is slow and usually inconclusive',
        'Critical infrastructure is civilian, unguarded, and everywhere'
      ],
      rungFloor: 1,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 7,
      nuclearDyad: true,
      oilImpact: 0.07, tradeImpact: 0.10
    }
  };

  MP.THEATERS = THEATERS;
  MP.theaterList = Object.keys(THEATERS);
})(typeof self !== 'undefined' ? (self.MP = self.MP || {}) : (this.MP = this.MP || {}));
