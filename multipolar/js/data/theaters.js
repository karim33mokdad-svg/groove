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
      control: 58, tension: 76, rung: 5, hot: true, negotiating: true,
      axisLabel: 'Front-line momentum',
      brief: 'Attritional ground war along a largely static front, now running in parallel with a ' +
        'live negotiation track: localised ceasefires — Oleshky in Kherson took effect on 27 ' +
        'October 2026 — and technical talks involving Ukraine, Russia and the United States ' +
        'convening in Abu Dhabi in early November. Strikes continue elsewhere. Territory and ' +
        'security guarantees are the unresolved core.',
      drivers: [
        'Western financing and interceptor supply set Ukraine\'s ceiling',
        'Russian advance rates are measured in metres per week at high cost',
        'Both economies are running war-mobilised fiscal policy',
        'Any NATO force presence inside Ukraine is a declared Russian red line',
        'Local humanitarian pauses have a poor record of generalising to the wider war',
        'A ceasefire starts an electoral clock in Kyiv that martial law has suspended'
      ],
      crisisRate: 0.05,   /* quarterly hazard of an unplanned incident */
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
      control: 46, tension: 58, rung: 3, hot: false,
      axisLabel: 'Strait balance of coercion',
      brief: 'Sustained gray-zone pressure — median-line crossings, ADIZ incursions, coast-guard ' +
        'boarding drills, undersea cable interference — designed to normalise coercion below ' +
        'the threshold that triggers an American response.',
      drivers: [
        'Advanced semiconductor concentration makes the island a systemic economic node',
        'Amphibious assault remains the hardest operation in modern warfare',
        'US policy is deliberately ambiguous about direct intervention',
        'Blockade/quarantine is the lower-cost coercive option and the likeliest flashpoint',
        'October 2026 alone: 166 military aircraft and 309 vessels logged in the Strait',
        'Coast-guard harassment and cable interference are now routine rather than exceptional'
      ],
      crisisRate: 0.05,   /* quarterly hazard of an unplanned incident */
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
      crisisRate: 0.055,   /* quarterly hazard of an unplanned incident */
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
      control: 74, tension: 78, rung: 4, hot: true, negotiating: true,
      axisLabel: 'Regional military balance',
      brief: 'A fragile ceasefire after the war that began on 28 February 2026, mediated by ' +
        'Pakistan in April and underwritten by a June memorandum in which Iran undertook not ' +
        'to acquire nuclear weapons. Both sides have since traded strikes over alleged ' +
        'violations. Iran\'s nuclear infrastructure was heavily damaged and inspectors have ' +
        'had no access since; roughly 440 kg of enriched uranium is unaccounted for. The core ' +
        'disputes — the nuclear programme, the Strait of Hormuz, sanctions relief — are all ' +
        'still open.',
      drivers: [
        'Air superiority and intelligence penetration favour one side decisively',
        'Missile mass and dispersal favour the other in a long exchange',
        'Interceptor stocks are the real constraint on both sides',
        'Nuclear-programme strikes are the single most escalatory available action',
        'Iran is governed by a three-quarter-old leadership installed after a decapitation strike',
        'Unaccounted fissile material means capability is uncertain, not demonstrably ended'
      ],
      crisisRate: 0.06,   /* quarterly hazard of an unplanned incident */
      rungFloor: 3,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 8,
      nuclearDyad: false,
      oilImpact: 0.45, tradeImpact: 0.15
    },

    LBN: {
      id: 'LBN', name: 'Lebanon', region: 'Middle East',
      lat: 33.8, lon: 35.6,
      sideA: 'IL', sideB: 'IR', sideALabel: 'Israel', sideBLabel: 'Hezbollah + Iran',
      backers: { IL: ['US'], IR: [] },
      control: 70, tension: 72, rung: 4, hot: true, negotiating: true,
      axisLabel: 'Control of the south and the disarmament question',
      brief: 'Hezbollah opened fire on 2 March 2026 as the wider Iran war began; Israeli ground ' +
        'operations followed on 16 March. A de jure ceasefire has held since 16 April amid ' +
        'continuing airstrikes, after more than 4,000 deaths and over a million displaced. A ' +
        'June trilateral framework set three goals with no timetable attached: Hezbollah ' +
        'disarms, the Lebanese Armed Forces deploy south, Israeli forces withdraw. Hezbollah ' +
        'is not party to the talks, and the Lebanese state does not control it.',
      drivers: [
        'Hezbollah is badly degraded but intact, and says it will not return to the pre-March position',
        'Disarmament is the pivot of the framework and the one thing no party can deliver',
        'The Lebanese state lacks the capacity to occupy what Hezbollah would vacate',
        'The file is hostage to the wider Iran track: it settles there or not at all'
      ],
      crisisRate: 0.05,   /* quarterly hazard of an unplanned incident */
      rungFloor: 2,
      escalationCeiling: 7,
      nuclearDyad: false,
      oilImpact: 0.06, tradeImpact: 0.03
    },

    RED: {
      id: 'RED', name: 'Red Sea & Bab al-Mandab', region: 'Middle East',
      lat: 13.5, lon: 43.0,
      sideA: 'US', sideB: 'IR', sideALabel: 'Coalition escorts', sideBLabel: 'Yemen-based forces',
      backers: { US: ['EU', 'IL'], IR: [] },
      control: 46, tension: 58, rung: 3, hot: true,
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
      crisisRate: 0.055,   /* quarterly hazard of an unplanned incident */
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
      crisisRate: 0.04,   /* quarterly hazard of an unplanned incident */
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
      crisisRate: 0.025,   /* quarterly hazard of an unplanned incident */
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
      crisisRate: 0.055,   /* quarterly hazard of an unplanned incident */
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
      crisisRate: 0.04,   /* quarterly hazard of an unplanned incident */
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
      crisisRate: 0.035,   /* quarterly hazard of an unplanned incident */
      rungFloor: 1,   /* the structural minimum: this dispute does not disappear */
      escalationCeiling: 7,
      nuclearDyad: true,
      oilImpact: 0.07, tradeImpact: 0.10
    }
  };

  MP.THEATERS = THEATERS;
  MP.theaterList = Object.keys(THEATERS);
})(typeof self !== 'undefined' ? (self.MP = self.MP || {}) : (this.MP = this.MP || {}));
