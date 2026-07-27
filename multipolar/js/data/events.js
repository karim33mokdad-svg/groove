/* MULTIPOLAR — data/events.js
 * The world acts on its own. Events are drawn each turn with weights that depend
 * on the current state, so the board generates its own crises rather than
 * sprinkling random noise.
 *
 * weight(S) -> relative likelihood (0 = impossible this turn)
 * apply(S)  -> { headline, detail, fx }
 */
(function (MP) {
  'use strict';

  const c = (v, a, b) => Math.max(a, Math.min(b, v));

  const EVENTS = [
    {
      id: 'opec_cut', tag: 'ENERGY',
      weight: S => S.g.oil < 72 ? 3 : 0.6,
      apply: S => ({
        headline: 'Producer group announces supply cut',
        detail: 'Quota discipline holds long enough to matter. Importers absorb the cost; exporters ' +
          'bank the revenue and the political leverage that comes with it.',
        fx: { g: { oil: 8 } }
      })
    },
    {
      id: 'opec_surge', tag: 'ENERGY',
      weight: S => S.g.oil > 105 ? 3 : 0.5,
      apply: S => ({
        headline: 'Spare capacity released as prices bite',
        detail: 'High prices trigger both political pressure and market-share defence. Additional ' +
          'barrels reach the market within weeks.',
        fx: { g: { oil: -9 } }
      })
    },
    {
      id: 'cable_cut', tag: 'GREY-ZONE',
      weight: S => (S.theaters.ARC.tension + S.theaters.UKR.tension) / 90,
      apply: S => ({
        headline: 'Undersea cable and pipeline damage in northern waters',
        detail: 'A vessel drags its anchor across critical infrastructure. Attribution will take months ' +
          'and will not be conclusive. This is the design.',
        fx: { g: { trade: -1.5 }, th: { ARC: { tension: 8 } }, blocEcon: { EU: -0.4 } }
      })
    },
    {
      id: 'drone_incident', tag: 'INCIDENT',
      weight: S => Object.values(S.theaters).reduce((m, t) => Math.max(m, t.tension), 0) / 45,
      apply: S => {
        const hot = Object.values(S.theaters).sort((a, b) => b.tension - a.tension)[0];
        return {
          headline: 'Drone incursion over ' + MP.THEATERS[hot.id].name,
          detail: 'Air defences engage an unidentified system. Whether it was reconnaissance, a stray, ' +
            'or a deliberate probe will be argued about long after the political damage is done.',
          fx: { th: { [hot.id]: { tension: 7 } }, g: { nuclearRisk: 1 } }
        };
      }
    },
    {
      id: 'election_shock', tag: 'DOMESTIC',
      weight: S => 1.4,
      apply: S => {
        const ids = MP.powerList.filter(id => MP.POWERS[id].domConstr > 0.5);
        const id = ids[Math.floor(Math.random() * ids.length)];
        const swing = Math.random() < 0.5 ? -1 : 1;
        return {
          headline: (swing > 0 ? 'Governing coalition strengthened in ' : 'Electoral setback for the government of ') + MP.POWERS[id].name,
          detail: swing > 0
            ? 'A mandate to continue the current line. Foreign policy continuity is purchased for one more cycle.'
            : 'Voters reprice the government\'s foreign commitments. Every external promise is now provisional.',
          fx: { power: { [id]: { approval: swing * 7, cohesion: swing * 4 } } }
        };
      }
    },
    {
      id: 'refugee_surge', tag: 'HUMANITARIAN',
      weight: S => (S.theaters.SAH.tension + S.theaters.LEV.tension + S.theaters.UKR.tension) / 130,
      apply: S => ({
        headline: 'Displacement surge strains receiving states',
        detail: 'Conflict pushes another wave of people toward the nearest stable borders. The receiving ' +
          'politics are immediate; the conflict that caused it is not.',
        fx: { power: { EU: { cohesion: -4, approval: -3 }, TR: { approval: -3, econ: -0.3 } } }
      })
    },
    {
      id: 'iaea_report', tag: 'PROLIFERATION',
      weight: S => S.powers.IR.nuclearProgress > 30 ? 2.2 : 0.8,
      apply: S => ({
        headline: 'Inspectors report reduced access to declared sites',
        detail: 'Monitoring continuity degrades. The gap between what is known and what is assumed is ' +
          'where every proliferation crisis has begun.',
        fx: { power: { IR: { legit: -3 } }, th: { LEV: { tension: 6 } }, g: { nuclearRisk: 2 } }
      })
    },
    {
      id: 'chip_ruling', tag: 'TECH',
      weight: S => 1.2,
      apply: S => ({
        headline: 'New export-licence restrictions announced',
        detail: 'Another node of the semiconductor supply chain is brought inside the export-control ' +
          'perimeter. Firms in three countries redesign product lines.',
        fx: { power: { CN: { tech: -4 } }, g: { trade: -0.8 } }
      })
    },
    {
      id: 'shipping_rates', tag: 'ECONOMY',
      weight: S => S.theaters.RED.tension > 55 ? 2.4 : 0.4,
      apply: S => ({
        headline: 'Freight rates spike as carriers reroute',
        detail: 'Major lines commit to the long way round. Two extra weeks of steaming propagates into ' +
          'every inventory calculation on the planet.',
        fx: { g: { trade: -2.5, oil: 2 } }
      })
    },
    {
      id: 'ceasefire_window', tag: 'DIPLOMACY',
      weight: S => {
        const hot = Object.values(S.theaters).filter(t => t.rung >= 5);
        return hot.length ? hot.length * 0.8 : 0;
      },
      apply: S => {
        const hot = Object.values(S.theaters).filter(t => t.rung >= 5).sort((a, b) => b.tension - a.tension)[0];
        return {
          headline: 'Third-party mediators float a framework for ' + MP.THEATERS[hot.id].name,
          detail: 'A neutral capital tables terms. Neither belligerent rejects it outright, which is as ' +
            'close to progress as these things get.',
          fx: { th: { [hot.id]: { tension: -6 } } }
        };
      }
    },
    {
      id: 'assassination', tag: 'SHOCK',
      weight: S => Object.values(S.theaters).reduce((m, t) => Math.max(m, t.rung), 0) >= 5 ? 0.7 : 0.2,
      apply: S => {
        const hot = Object.values(S.theaters).sort((a, b) => b.rung - a.rung)[0];
        return {
          headline: 'Senior commander killed in ' + MP.THEATERS[hot.id].name,
          detail: 'A decapitation strike removes an experienced operator and creates an obligation to ' +
            'respond. Successors are usually less cautious, not more.',
          fx: { th: { [hot.id]: { tension: 12, rung: 0 } }, g: { nuclearRisk: 2 } }
        };
      }
    },
    {
      id: 'grain_deal', tag: 'ECONOMY',
      weight: S => S.theaters.UKR.tension > 60 ? 1.4 : 0.5,
      apply: S => ({
        headline: 'Black Sea export corridor arrangements renegotiated',
        detail: 'Food-importing states across three continents recalculate their budgets on the basis of ' +
          'a corridor whose security guarantees are informal at best.',
        fx: { g: { trade: 1.2 }, power: { UA: { econ: 1.2 } } }
      })
    },
    {
      id: 'currency_crisis', tag: 'ECONOMY',
      weight: S => {
        const weak = MP.powerList.filter(id => S.powers[id].econ < 94);
        return weak.length * 0.6;
      },
      apply: S => {
        const weak = MP.powerList.filter(id => S.powers[id].econ < 94)
          .sort((a, b) => S.powers[a].econ - S.powers[b].econ)[0] || 'TR';
        return {
          headline: 'Currency pressure forces emergency measures in ' + MP.POWERS[weak].name,
          detail: 'Reserves are burned defending the exchange rate. The foreign-policy budget is the first ' +
            'line item to be cut, and the last to be restored.',
          fx: { power: { [weak]: { econ: -1.2, approval: -4 } } }
        };
      }
    },
    {
      id: 'alliance_friction', tag: 'ALLIANCE',
      weight: S => (100 - S.powers.US.cohesion) / 40,
      apply: S => ({
        headline: 'Burden-sharing dispute goes public between allies',
        detail: 'A dispute over who pays and who commits leaks into the open. Adversaries do not need to ' +
          'manufacture alliance friction; they only need to amplify it.',
        fx: { power: { US: { cohesion: -4 }, EU: { cohesion: -3 } } }
      })
    },
    {
      id: 'blockade_drill', tag: 'GREY-ZONE',
      weight: S => S.theaters.TWN.tension > 55 ? 2.2 : 0.7,
      apply: S => ({
        headline: 'Large-scale encirclement exercise around Taiwan',
        detail: 'Coast guard boarding drills and live-fire zones ring the island for seventy-two hours. ' +
          'Insurers, not admirals, register the change first.',
        fx: { th: { TWN: { tension: 9 } }, g: { trade: -1.5 } }
      })
    },
    {
      id: 'tech_breakthrough', tag: 'TECH',
      weight: S => 1.0,
      apply: S => {
        const id = ['CN', 'US', 'EU', 'IN'][Math.floor(Math.random() * 4)];
        return {
          headline: 'Domestic substitution milestone announced in ' + MP.POWERS[id].name,
          detail: 'A capability previously available only through import is demonstrated domestically. ' +
            'The announcement precedes production at scale by years, as it always does.',
          fx: { power: { [id]: { tech: 5, econ: 0.4 } } }
        };
      }
    },
    {
      id: 'proxy_attrition', tag: 'CONFLICT',
      weight: S => S.theaters.LEV.tension > 60 ? 2.0 : 0.6,
      apply: S => ({
        headline: 'Exchange of strikes across the Levant',
        detail: 'Another round of standoff fire in both directions. Interceptor stocks fall on one side, ' +
          'launcher inventories on the other. Neither is publicly reported.',
        fx: { th: { LEV: { tension: 5 } }, g: { oil: 3 } }
      })
    },
    {
      id: 'sanctions_evasion', tag: 'ECONOMY',
      weight: S => {
        const pressured = MP.powerList.filter(id => S.powers[id].pressure > 40);
        return pressured.length * 0.9;
      },
      apply: S => {
        const id = MP.powerList.filter(x => S.powers[x].pressure > 40)
          .sort((a, b) => S.powers[b].pressure - S.powers[a].pressure)[0] || 'RU';
        return {
          headline: 'Shadow-fleet and intermediary networks expand around ' + MP.POWERS[id].name,
          detail: 'Ageing tankers, opaque ownership and third-country re-invoicing. Enforcement is a ' +
            'game of whack-a-mole played across a dozen jurisdictions.',
          fx: { power: { [id]: { pressure: -6, adaptation: 0.08, econ: 0.5 } } }
        };
      }
    }
  ];

  function drawEvent(S) {
    const pool = EVENTS.map(e => ({ e, w: Math.max(0, e.weight(S)) })).filter(x => x.w > 0);
    const total = pool.reduce((s, x) => s + x.w, 0);
    if (!total) return null;
    let r = Math.random() * total;
    for (const x of pool) { r -= x.w; if (r <= 0) return Object.assign({ id: x.e.id, tag: x.e.tag }, x.e.apply(S)); }
    return null;
  }

  MP.EVENTS = EVENTS;
  MP.drawEvent = drawEvent;
})(window.MP = window.MP || {});
