/* MULTIPOLAR — data/actions.js
 * The instruments of statecraft (DIME: Diplomatic, Informational, Military, Economic).
 *
 * Every action exposes a model() that returns an EXPECTED-VALUE forecast plus the
 * factors that produced it. The UI shows those factors before you commit, so the
 * forecast is auditable rather than a black box.
 *
 * ctx = {
 *   S,            full game state
 *   actor,        acting power id
 *   P,            acting power static data
 *   ps,           acting power runtime state
 *   th,           theatre state (or null)
 *   tdef,         theatre static definition (or null)
 *   target,       target power id (or null)
 *   side,         'A' | 'B' | null  — which side of the theatre the actor is on
 *   opp           opposing side's principal power id (or null)
 * }
 *
 * A model returns:
 *   { fx, factors, variance, narrative, precedent, risks }
 *
 * fx keys — all are DELTAS:
 *   self:{econ,approval,cohesion,legit,readiness,pressure}
 *   tgt:{econ,approval,cohesion,legit,readiness,pressure}
 *   th:{tension,control,rung}   control is signed TOWARD SIDE A
 *   g:{oil,trade,nuclearRisk}
 *   aff:[[a,b,delta], …]
 */
(function (MP) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = v => Math.round(v * 10) / 10;

  /* Signed conversion: a gain "for the actor" expressed on the A<->B axis. */
  function towardActor(side, v) { return side === 'B' ? -v : v; }

  /* How much military weight the actor can bring to a theatre — distance,
     basing and force structure all folded into one 0-1 term. */
  function projection(P, tdef) {
    const base = (P.power.air * 0.35 + P.power.sea * 0.35 + P.power.land * 0.3) / 100;
    const home = tdef ? homeAdvantage(P.id, tdef) : 0;
    return clamp(base * (0.55 + 0.45 * home), 0.03, 1);
  }
  function homeAdvantage(id, tdef) {
    if (tdef.sideA === id || tdef.sideB === id) return 1;
    const near = { US: 0.75, CN: 0.5, RU: 0.55, EU: 0.5, IN: 0.4, IR: 0.45, IL: 0.4, TR: 0.45, JP: 0.35 };
    return near[id] !== undefined ? near[id] : 0.3;
  }

  /* Coalition breadth: how many aligned powers would plausibly join, weighted
     by their economic mass. Drives the effectiveness of economic coercion. */
  function coalitionWeight(S, actor, target) {
    let mass = MP.POWERS[actor].gdp, joined = [];
    MP.powerList.forEach(id => {
      if (id === actor || id === target) return;
      const withUs = MP.getAff(S, actor, id), vsThem = MP.getAff(S, id, target);
      if (withUs > 0.3 && vsThem < 0.1) {
        const willingness = clamp((withUs - vsThem) / 2, 0, 1) * (S.powers[id].cohesion / 100);
        if (willingness > 0.35) { mass += MP.POWERS[id].gdp * willingness; joined.push(id); }
      }
    });
    return { mass, share: clamp(mass / 78, 0, 1), joined };
  }

  const CATS = {
    DIP: { name: 'Diplomatic', icon: '🕊', color: '#7fd1ff' },
    INFO: { name: 'Informational', icon: '📡', color: '#c08cff' },
    MIL: { name: 'Military', icon: '⚔️', color: '#ff7a7a' },
    ECON: { name: 'Economic', icon: '💰', color: '#ffd45a' }
  };

  const ACTIONS = [
    /* ==================== DIPLOMATIC ==================== */
    {
      id: 'dip_summit', cat: 'DIP', name: 'Direct Talks', scope: 'power', pc: 2, dr: 0.55,
      blurb: 'Open a bilateral channel with another capital. Cheap, slow, and the only ' +
        'instrument that reliably lowers temperature.',
      avail: ctx => !!ctx.target && ctx.target !== ctx.actor,
      model: ctx => {
        const aff = MP.getAff(ctx.S, ctx.actor, ctx.target);
        const hostility = clamp((-aff + 1) / 2, 0, 1);
        const reach = clamp(0.35 + ctx.P.softPower / 200 + aff * 0.3, 0.1, 1);
        const tensionDrop = -(3 + 9 * reach) * (ctx.th ? 1 : 0.5);
        const legitGain = 1.5 + 2.5 * hostility * reach;
        const domesticCost = hostility > 0.6 ? -2.2 * ctx.P.domConstr * 3 : 0;
        return {
          fx: {
            self: { legit: legitGain, approval: domesticCost, pc: 0 },
            tgt: { legit: 0.8 },
            th: ctx.th ? { tension: tensionDrop, rung: 0 } : null,
            g: { nuclearRisk: -1.2 * reach },
            aff: [[ctx.actor, ctx.target, 0.05 + 0.07 * reach]]
          },
          factors: [
            { label: 'Existing affinity', value: r1(aff), note: aff < -0.5 ? 'deeply adversarial — talks are a concession in themselves' : 'workable channel' },
            { label: 'Diplomatic reach', value: Math.round(reach * 100) + '%', note: 'soft power ' + ctx.P.softPower + ' + affinity' },
            { label: 'Domestic exposure', value: Math.round(ctx.P.domConstr * 100) + '%', note: 'talking to an adversary costs approval at home' }
          ],
          variance: 0.35,
          narrative: 'Working-level contacts are established. Nothing is signed, but the channel exists — ' +
            'which is what matters when the shooting starts.',
          precedent: 'Crisis hotlines and back-channels have historically reduced miscalculation risk far ' +
            'more than they have produced settlements.',
          risks: [{ p: 0.18, text: 'Talks leak before they are ready; hardliners at home attack the initiative.', fx: { self: { approval: -3, legit: -1 } } }]
        };
      }
    },
    {
      id: 'dip_unsc', cat: 'DIP', name: 'UNSC Resolution', scope: 'theater', pc: 2, dr: 0.7,
      blurb: 'Table a resolution. If an adversary holds a veto, expect it to be used — the ' +
        'value is the vote record, not the text.',
      avail: ctx => !!ctx.th,
      model: ctx => {
        const opp = ctx.opp;
        const vetoed = opp && (MP.POWERS[opp].veto || (MP.THEATERS[ctx.th.id].backers[MP.THEATERS[ctx.th.id][ctx.side === 'A' ? 'sideB' : 'sideA']] || []).some(b => MP.POWERS[b].veto && MP.getAff(ctx.S, b, ctx.actor) < 0));
        const coal = coalitionWeight(ctx.S, ctx.actor, opp || 'RU');
        return {
          fx: {
            self: { legit: vetoed ? 2.5 : 5.5, cohesion: 1.5 * coal.share },
            tgt: { legit: vetoed ? -1.5 : -4.5 },
            th: { tension: vetoed ? -1 : -5, control: towardActor(ctx.side, vetoed ? 0.4 : 1.6) },
            g: {}
          },
          factors: [
            { label: 'Veto risk', value: vetoed ? 'CERTAIN' : 'low', note: vetoed ? 'a permanent member on the other side will block it' : 'no blocking veto identified' },
            { label: 'Coalition mass', value: '$' + Math.round(coal.mass) + 'tn', note: coal.joined.length + ' capitals expected to co-sponsor' },
            { label: 'Enforcement', value: 'none', note: 'the Council has no independent means of enforcement' }
          ],
          variance: 0.25,
          narrative: vetoed
            ? 'The resolution is vetoed as expected. The vote record becomes the deliverable: isolation on paper, unchanged on the ground.'
            : 'The resolution passes. Legal cover now exists for measures that were previously unilateral.',
          precedent: 'Great-power conflicts are structurally unresolvable at the Council; resolutions function as ' +
            'legitimacy instruments, not enforcement ones.',
          risks: []
        };
      }
    },
    {
      id: 'dip_mediate', cat: 'DIP', name: 'Broker a Ceasefire', scope: 'theater', pc: 4, dr: 0.5,
      blurb: 'Put yourself between the combatants. Requires credibility with both sides — ' +
        'which almost nobody has.',
      avail: ctx => !!ctx.th && ctx.th.rung >= 4,
      model: ctx => {
        const t = MP.THEATERS[ctx.th.id];
        const a = MP.getAff(ctx.S, ctx.actor, t.sideA), b = MP.getAff(ctx.S, ctx.actor, t.sideB);
        const credibility = clamp((1 - Math.abs(a - b) / 2) * (0.4 + ctx.P.softPower / 160), 0, 1);
        const warExhaustion = clamp((ctx.S.powers[t.sideA].warStress + ctx.S.powers[t.sideB].warStress) / 160, 0, 1);
        const chance = clamp(credibility * 0.55 + warExhaustion * 0.45 - ctx.th.rung * 0.04, 0.02, 0.9);
        return {
          fx: {
            self: { legit: 3 + 6 * credibility, pc: 0 },
            th: { tension: -10 * chance - 3, rung: 0 },
            g: { oil: -2 * chance * (t.oilImpact * 4), nuclearRisk: -3 * chance },
            aff: [[ctx.actor, t.sideA, 0.03], [ctx.actor, t.sideB, 0.03]]
          },
          factors: [
            { label: 'Even-handedness', value: Math.round(credibility * 100) + '%', note: 'affinity gap ' + r1(a) + ' vs ' + r1(b) + ' — mediators must be trusted by both' },
            { label: 'War exhaustion', value: Math.round(warExhaustion * 100) + '%', note: 'ceasefires stick when both sides are already spent' },
            { label: 'Probability of a pause', value: Math.round(chance * 100) + '%', note: 'the higher the escalation rung, the harder it is to stop' }
          ],
          variance: 0.5,
          narrative: 'Shuttle diplomacy begins. Ceasefires hold when both belligerents privately want one; ' +
            'the mediator supplies the ladder to climb down, not the decision.',
          precedent: 'Successful mediations (Oslo, Dayton, the Gulf-state channels) all followed military ' +
            'stalemate. Mediation offered before exhaustion is read as weakness.',
          risks: [{ p: 0.22, text: 'One side uses the pause to reconstitute; the ceasefire collapses at a worse position.', fx: { th: { tension: 8, rung: 1 } } }],
          boons: [{ p: chance, text: 'A pause holds. Fighting drops a rung on the ladder.', fx: { th: { tension: -9, rung: -1 }, self: { legit: 4 }, g: { nuclearRisk: -3 } } }]
        };
      }
    },
    {
      id: 'dip_coalition', cat: 'DIP', name: 'Assemble a Coalition', scope: 'power', pc: 3, dr: 0.8,
      blurb: 'Spend capital lining up partners behind a common position. Multiplies every ' +
        'economic instrument you use afterwards.',
      avail: ctx => !!ctx.target && ctx.target !== ctx.actor,
      model: ctx => {
        const coal = coalitionWeight(ctx.S, ctx.actor, ctx.target);
        return {
          fx: {
            self: { cohesion: 4 + 8 * coal.share, legit: 2 + 3 * coal.share, coalitionBonus: 0.25 },
            tgt: { legit: -2 - 3 * coal.share },
            g: {},
            aff: coal.joined.map(id => [ctx.actor, id, 0.05])
          },
          factors: [
            { label: 'Partners aligning', value: coal.joined.length ? coal.joined.join(', ') : 'none', note: 'willingness = affinity with you minus affinity with the target' },
            { label: 'Economic mass', value: '$' + Math.round(coal.mass) + 'tn', note: Math.round(coal.share * 100) + '% of the modelled great-power economy' },
            { label: 'Durability', value: coal.share > 0.5 ? 'high' : 'fragile', note: 'coalitions decay as the costs land unevenly' }
          ],
          variance: 0.3,
          narrative: 'A joint statement is issued. The real product is the private agreement on what each ' +
            'partner will do when the next incident occurs.',
          precedent: 'The breadth of a sanctions coalition predicts its economic bite far better than the ' +
            'severity of any single measure.',
          risks: []
        };
      }
    },
    {
      id: 'dip_pact', cat: 'DIP', name: 'Security Guarantee', scope: 'theater', pc: 5, dr: 1.6,
      blurb: 'Extend a formal commitment to a partner. Deters the adversary — and hands the ' +
        'partner the ability to drag you into their war.',
      avail: ctx => !!ctx.th && !!ctx.side,
      model: ctx => {
        const proj = projection(ctx.P, MP.THEATERS[ctx.th.id]);
        const credible = clamp(proj * 0.6 + ctx.ps.cohesion / 250 + (ctx.P.warheads > 0 ? 0.2 : 0), 0.05, 1);
        return {
          fx: {
            self: { cohesion: 3, legit: 1, readiness: -3, entangle: 0.3 },
            th: { tension: 6 - 3 * credible, control: towardActor(ctx.side, 2.1 * credible), deterrence: credible * 7 },
            g: { nuclearRisk: ctx.P.warheads > 0 ? 1.5 : 0 },
            aff: [[ctx.actor, ctx.side === 'A' ? MP.THEATERS[ctx.th.id].sideA : MP.THEATERS[ctx.th.id].sideB, 0.15]]
          },
          factors: [
            { label: 'Guarantee credibility', value: Math.round(credible * 100) + '%', note: 'deterrence is a function of capability × visible will, not of the text' },
            { label: 'Force projection', value: Math.round(proj * 100) + '%', note: 'can you actually get there in time' },
            { label: 'Entanglement', value: 'increased', note: 'your partner\'s risk tolerance is now your problem' }
          ],
          variance: 0.3,
          narrative: 'The commitment is announced. The adversary now has to price in your intervention — ' +
            'and your partner now has less reason to be cautious.',
          precedent: 'Alliance guarantees deter when they are backed by forward-deployed forces. Paper ' +
            'guarantees (Budapest 1994) have historically deterred nothing.',
          risks: [{ p: 0.25, text: 'Emboldened partner takes a provocative step you did not authorise.', fx: { th: { tension: 7 } } }]
        };
      }
    },
    {
      id: 'dip_downgrade', cat: 'DIP', name: 'Downgrade Relations', scope: 'power', pc: 2, dr: 1.2,
      blurb: 'Expel diplomats, recall your ambassador, cut the channel. A pure signal — and ' +
        'it removes your own ability to talk in the next crisis.',
      avail: ctx => !!ctx.target && MP.getAff(ctx.S, ctx.actor, ctx.target) < 0.5,
      model: ctx => ({
        fx: {
          self: { approval: 3 * ctx.P.domConstr * 2, legit: -0.5 },
          tgt: { legit: -2 },
          th: ctx.th ? { tension: 5 } : null,
          g: { nuclearRisk: 0.8 },
          aff: [[ctx.actor, ctx.target, -0.18]]
        },
        factors: [
          { label: 'Signal strength', value: 'high', note: 'unambiguous, immediate, and cheap' },
          { label: 'Channel loss', value: 'permanent-ish', note: 'restoring relations takes years; crises take days' },
          { label: 'Domestic payoff', value: '+' + Math.round(3 * ctx.P.domConstr * 2) + ' approval', note: 'punishing an adversary polls well everywhere' }
        ],
        variance: 0.2,
        narrative: 'The embassy empties. Both sides now depend on third parties to pass messages, which ' +
          'is exactly the condition under which misreadings occur.',
        precedent: 'Mass diplomatic expulsions after attribution events are near-automatic and have never ' +
          'measurably changed adversary behaviour.',
        risks: []
      })
    },

    /* ==================== INFORMATIONAL ==================== */
    {
      id: 'info_cyber', cat: 'INFO', name: 'Offensive Cyber Operation', scope: 'power', pc: 2, dr: 0.4,
      blurb: 'Degrade an adversary network. Deniable until it isn\'t — and attribution ' +
        'has become fast.',
      avail: ctx => !!ctx.target && ctx.target !== ctx.actor,
      model: ctx => {
        const gap = (ctx.P.power.cyber - MP.POWERS[ctx.target].power.cyber) / 100;
        const success = clamp(0.45 + gap * 0.8, 0.1, 0.92);
        const detect = clamp(0.35 + MP.POWERS[ctx.target].power.cyber / 220, 0.15, 0.85);
        return {
          fx: {
            self: { legit: -1.5 * detect },
            tgt: { econ: -1.1 * success, readiness: -4.5 * success, approval: -1.8 * success },
            th: ctx.th ? { tension: 4 * detect } : null,
            g: { nuclearRisk: 0.4 }
          },
          factors: [
            { label: 'Capability gap', value: (gap > 0 ? '+' : '') + Math.round(gap * 100), note: 'your cyber index ' + ctx.P.power.cyber + ' vs theirs ' + MP.POWERS[ctx.target].power.cyber },
            { label: 'Probability of effect', value: Math.round(success * 100) + '%', note: 'access is the hard part; effects are usually temporary' },
            { label: 'Attribution risk', value: Math.round(detect * 100) + '%', note: 'forensics plus intelligence usually names the actor within weeks' }
          ],
          variance: 0.55,
          narrative: 'Systems degrade. Cyber effects are reversible by nature — the target restores service ' +
            'and hardens, so the window of advantage is measured in weeks.',
          precedent: 'No cyber operation to date has produced a decisive strategic outcome on its own; ' +
            'their value has been shaping, espionage and cost imposition.',
          risks: [
            { p: 0.3, text: 'Operation is attributed publicly; retaliation in kind against your own infrastructure.', fx: { self: { econ: -0.8, legit: -2 } } },
            { p: 0.12, text: 'Effects spill beyond the target into third-country networks.', fx: { self: { legit: -3 }, g: { trade: -1 } } }
          ]
        };
      }
    },
    {
      id: 'info_campaign', cat: 'INFO', name: 'Influence Campaign', scope: 'power', pc: 2, dr: 0.4,
      blurb: 'Amplify existing divisions inside the adversary\'s decision-making system. ' +
        'Cannot create fractures — only widen them.',
      avail: ctx => !!ctx.target && ctx.target !== ctx.actor,
      model: ctx => {
        const openness = MP.POWERS[ctx.target].domConstr;
        const effect = openness * clamp(ctx.P.power.cyber / 100, 0.2, 1);
        return {
          fx: {
            self: { legit: -0.8 },
            tgt: { approval: -4.5 * effect, cohesion: -4 * effect },
            g: {},
            aff: [[ctx.actor, ctx.target, -0.04]]
          },
          factors: [
            { label: 'Target openness', value: Math.round(openness * 100) + '%', note: 'open societies are permeable; closed ones are hard targets' },
            { label: 'Expected cohesion effect', value: '-' + r1(4 * effect), note: 'works on pre-existing cleavages only' },
            { label: 'Durability', value: 'low', note: 'attention decays; the underlying divisions do not' }
          ],
          variance: 0.6,
          narrative: 'Existing arguments inside the target get louder. Measurable effects on elite decisions ' +
            'are rare; effects on the cost of building consensus are real.',
          precedent: 'Documented influence operations have shifted salience and turnout at the margins. ' +
            'Claims of decisive effect generally do not survive scrutiny.',
          risks: [{ p: 0.28, text: 'Campaign is exposed and becomes the story, hardening the target against you.', fx: { self: { legit: -3 }, tgt: { cohesion: 4 } } }]
        };
      }
    },
    {
      id: 'info_intel', cat: 'INFO', name: 'Intelligence Sharing', scope: 'theater', pc: 2, dr: 0.5,
      blurb: 'Pass targeting and warning data to a partner. Enormous force multiplier, ' +
        'invisible until someone talks.',
      avail: ctx => !!ctx.th && !!ctx.side,
      model: ctx => {
        const quality = (ctx.P.power.space * 0.5 + ctx.P.power.cyber * 0.5) / 100;
        return {
          fx: {
            self: { legit: 0, readiness: -1 },
            th: { control: towardActor(ctx.side, 1.5 * quality), tension: 1.5 },
            g: {}
          },
          factors: [
            { label: 'ISR quality', value: Math.round(quality * 100) + '%', note: 'space index ' + ctx.P.power.space + ', cyber ' + ctx.P.power.cyber },
            { label: 'Battlefield effect', value: '+' + r1(1.5 * quality) + ' control', note: 'warning time and targeting are the highest-leverage inputs in modern war' },
            { label: 'Deniability', value: 'moderate', note: 'the adversary will infer it from strike accuracy' }
          ],
          variance: 0.3,
          narrative: 'Partner strike accuracy and survivability improve immediately. This is the cheapest ' +
            'meaningful military contribution available.',
          precedent: 'Intelligence-sharing arrangements have repeatedly produced disproportionate ' +
            'battlefield effects relative to their political cost.',
          risks: [{ p: 0.15, text: 'Sharing is revealed; the adversary treats you as a co-belligerent.', fx: { th: { tension: 8, rung: 0 } } }]
        };
      }
    },
    {
      id: 'info_expose', cat: 'INFO', name: 'Declassify & Expose', scope: 'power', pc: 2, dr: 0.6,
      blurb: 'Burn an intelligence source to pre-empt an adversary operation in public. ' +
        'Trades future collection for present legitimacy.',
      avail: ctx => !!ctx.target && MP.getAff(ctx.S, ctx.actor, ctx.target) < 0.2,
      model: ctx => ({
        fx: {
          self: { legit: 4, cohesion: 2 },
          tgt: { legit: -5, approval: -1 },
          th: ctx.th ? { tension: 2 } : null,
          g: {}
        },
        factors: [
          { label: 'Pre-emptive value', value: 'high', note: 'removes the adversary\'s pretext before it is used' },
          { label: 'Source cost', value: 'permanent', note: 'the collection channel closes the moment you publish' },
          { label: 'Credibility requirement', value: Math.round(ctx.ps.legit) + '/100', note: 'exposure only works if you are already believed' }
        ],
        variance: 0.35,
        narrative: 'The intelligence is published. The planned operation is postponed or reshaped, and the ' +
          'adversary begins hunting for the leak.',
        precedent: 'Pre-emptive declassification in 2022 measurably complicated Russian false-flag framing ' +
          'and is now a standard Western practice.',
        risks: [{ p: 0.2, text: 'Disclosure is disputed and read as manipulation, cutting both ways.', fx: { self: { legit: -3 } } }]
      })
    },

    /* ==================== MILITARY ==================== */
    {
      id: 'mil_arms', cat: 'MIL', name: 'Arms Transfer', scope: 'theater', pc: 3, dr: 0.3,
      blurb: 'Supply a belligerent. The single most effective way to change a battlefield ' +
        'without putting your own people in it.',
      avail: ctx => !!ctx.th && !!ctx.side && ctx.tdef.hot,
      model: ctx => {
        const capacity = clamp(ctx.P.milUSD / 400 + ctx.P.power.land / 300, 0.05, 1.1);
        const recipientAbsorb = clamp(ctx.S.powers[ctx.side === 'A' ? ctx.tdef.sideA : ctx.tdef.sideB].readiness / 100, 0.2, 1);
        const gain = 4.2 * capacity * recipientAbsorb;
        return {
          fx: {
            self: { readiness: -4.5 * capacity, econ: -0.35, approval: -1.2 * ctx.P.domConstr * 2 },
            th: { control: towardActor(ctx.side, gain), tension: 5, rung: 0 },
            g: { nuclearRisk: 0.6 },
            aff: [[ctx.actor, ctx.opp || 'RU', -0.06]]
          },
          factors: [
            { label: 'Industrial capacity', value: Math.round(capacity * 100) + '%', note: 'defence outlay $' + ctx.P.milUSD + 'bn — stockpiles, not intentions, set the ceiling' },
            { label: 'Recipient absorption', value: Math.round(recipientAbsorb * 100) + '%', note: 'crews, training and maintenance limit what can actually be fielded' },
            { label: 'Own readiness cost', value: '-' + r1(4.5 * capacity), note: 'every system transferred comes out of your own inventory' },
            { label: 'Escalation weight', value: 'moderate', note: 'universally treated as short of direct participation' }
          ],
          variance: 0.35,
          narrative: 'Deliveries begin. Effects appear at the front in weeks to months, not days — arms ' +
            'transfers move the line slowly and change the war\'s arithmetic permanently.',
          precedent: 'Sustained transfers have repeatedly prevented battlefield collapse without triggering ' +
            'direct great-power confrontation. Lend-Lease is the template; it took two years to tell.',
          risks: [
            { p: 0.2, text: 'Adversary strikes the logistics corridor inside a third country.', fx: { th: { tension: 7, rung: 0 } } },
            { p: 0.1, text: 'Transferred systems appear on the grey market.', fx: { self: { legit: -2 } } }
          ]
        };
      }
    },
    {
      id: 'mil_deploy', cat: 'MIL', name: 'Deploy Forces', scope: 'theater', pc: 4, dr: 0.9,
      blurb: 'Move combat power into the theatre. Deterrence you can photograph — and a ' +
        'tripwire you cannot easily withdraw.',
      avail: ctx => !!ctx.th,
      model: ctx => {
        const proj = projection(ctx.P, ctx.tdef);
        const deter = proj * 12;
        return {
          fx: {
            self: { readiness: -9, econ: -0.5, approval: -2 * ctx.P.domConstr * 2, cohesion: 1 },
            th: { tension: 8 - deter * 0.35, control: towardActor(ctx.side, 2.5 * proj), rung: ctx.th.rung < 3 ? 1 : 0, deterrence: deter },
            g: { nuclearRisk: 1.0 }
          },
          factors: [
            { label: 'Force projection', value: Math.round(proj * 100) + '%', note: 'basing access and lift, not order of battle' },
            { label: 'Deterrent value', value: '+' + Math.round(deter), note: 'forces in place deter; forces at home do not' },
            { label: 'Provocation', value: '+8 tension', note: 'the adversary reads deployment as preparation, not reassurance' },
            { label: 'Reversibility', value: 'low', note: 'withdrawing later reads as capitulation' }
          ],
          variance: 0.3,
          narrative: 'Forces arrive. The deterrent signal and the provocation are the same act — which is the ' +
            'central dilemma of every deployment decision ever taken.',
          precedent: 'The security dilemma: defensive deployments are indistinguishable from offensive ' +
            'preparation to the side watching them arrive.',
          risks: [{ p: 0.18, text: 'Close-quarters incident between deployed forces and adversary units.', fx: { th: { tension: 10, rung: 1 }, g: { nuclearRisk: 2 } } }]
        };
      }
    },
    {
      id: 'mil_exercise', cat: 'MIL', name: 'Joint Exercise', scope: 'theater', pc: 2, dr: 0.5,
      blurb: 'Large-scale drills with partners. Builds interoperability and cohesion at ' +
        'modest escalation cost.',
      avail: ctx => !!ctx.th,
      model: ctx => ({
        fx: {
          self: { cohesion: 4, readiness: 3, econ: -0.15 },
          th: { tension: 4, deterrence: 5 * projection(ctx.P, ctx.tdef) },
          g: {}
        },
        factors: [
          { label: 'Interoperability', value: '+readiness', note: 'the rehearsal is the deliverable' },
          { label: 'Signalling', value: 'calibrated', note: 'scheduled exercises are the least escalatory way to show capability' },
          { label: 'Adversary reading', value: 'rehearsal for war', note: 'they run the mirror image and reach the same conclusion' }
        ],
        variance: 0.25,
        narrative: 'The exercise runs. Partners learn to fight together, which matters far more than any ' +
          'single platform in the inventory.',
        precedent: 'Annual alliance exercises are simultaneously the strongest routine deterrent signal and ' +
          'a recurring driver of adversary threat perception.',
        risks: [{ p: 0.1, text: 'Adversary mirrors with a snap exercise on your border.', fx: { th: { tension: 5 } } }]
      })
    },
    {
      id: 'mil_fonop', cat: 'MIL', name: 'Freedom of Navigation Op', scope: 'theater', pc: 2, dr: 0.5,
      blurb: 'Sail or fly through contested space to deny a legal claim. Low cost, ' +
        'non-trivial collision risk.',
      avail: ctx => !!ctx.th && ['SCS', 'TWN', 'RED', 'ARC'].indexOf(ctx.th.id) >= 0,
      model: ctx => ({
        fx: {
          self: { legit: 2, readiness: -1 },
          th: { tension: 5, control: towardActor(ctx.side, 1.2) },
          g: { trade: 0.4 }
        },
        factors: [
          { label: 'Legal effect', value: 'preserves claim', note: 'unchallenged claims harden into accepted fact over time' },
          { label: 'Physical risk', value: 'unsafe intercepts', note: 'shadowing at close range is where accidents happen' },
          { label: 'Cost', value: 'minimal', note: 'the ship was already deployed' }
        ],
        variance: 0.3,
        narrative: 'The transit is completed and protested. Nothing changes on the water; everything changes ' +
          'in the legal record if you stop doing it.',
        precedent: 'Routine transits have kept contested-waters claims legally live for decades without ' +
          'once producing a shooting incident — so far.',
        risks: [{ p: 0.14, text: 'Unsafe intercept results in a collision.', fx: { th: { tension: 12, rung: 1 } } }]
      })
    },
    {
      id: 'mil_airdef', cat: 'MIL', name: 'Air & Missile Defence', scope: 'theater', pc: 3, dr: 0.5,
      blurb: 'Deploy interceptors. The only military action on this board that lowers ' +
        'tension while increasing capability.',
      avail: ctx => !!ctx.th && !!ctx.side,
      model: ctx => {
        const tech = (ctx.P.power.air * 0.5 + ctx.P.power.space * 0.5) / 100;
        return {
          fx: {
            self: { readiness: -5, econ: -0.4 },
            th: { tension: -3, control: towardActor(ctx.side, 0.8 * tech), defence: 10 * tech },
            g: { nuclearRisk: -0.5 }
          },
          factors: [
            { label: 'Interceptor quality', value: Math.round(tech * 100) + '%', note: 'layered defence needs sensors as much as missiles' },
            { label: 'Cost exchange', value: 'unfavourable', note: 'interceptors cost 10-100× the drones they stop — magazine depth is the war' },
            { label: 'Stability effect', value: 'positive', note: 'defensive systems reduce the value of a first strike' }
          ],
          variance: 0.25,
          narrative: 'Batteries go operational. Defence buys decision time, which is the scarcest commodity ' +
            'in any crisis — but the magazine is finite and the adversary knows the number.',
          precedent: 'Layered defence has intercepted the large majority of incoming salvos in recent ' +
            'exchanges; the constraint has consistently been interceptor stock, not hit probability.',
          risks: [{ p: 0.12, text: 'Adversary responds by expanding salvo size to saturate the defence.', fx: { th: { tension: 5 } } }]
        };
      }
    },
    {
      id: 'mil_escort', cat: 'MIL', name: 'Convoy Escort', scope: 'theater', pc: 3, dr: 0.45,
      blurb: 'Protect commercial shipping through a chokepoint. Restores trade flow; ' +
        'puts your warships in range of cheap weapons.',
      avail: ctx => !!ctx.th && ['RED', 'SCS', 'ARC', 'TWN'].indexOf(ctx.th.id) >= 0,
      model: ctx => {
        const naval = ctx.P.power.sea / 100;
        return {
          fx: {
            self: { readiness: -6, econ: -0.3, legit: 2 },
            th: { tension: 2, control: towardActor(ctx.side, 2.5 * naval) },
            g: { trade: 3.5 * naval, oil: -1.5 * naval }
          },
          factors: [
            { label: 'Naval capacity', value: Math.round(naval * 100) + '%', note: 'sustained escort needs hulls in rotation, not a single deployment' },
            { label: 'Trade restoration', value: '+' + r1(3.5 * naval) + ' index', note: 'insurance rates fall before traffic returns' },
            { label: 'Cost exchange', value: 'poor', note: 'you are spending interceptors against drones' }
          ],
          variance: 0.3,
          narrative: 'Escorted convoys resume. Underwriters, not admirals, decide when the route is ' +
            'genuinely reopened.',
          precedent: 'Escort operations have historically restored partial traffic while never fully ' +
            'suppressing the threat, because the attacker\'s cost per shot stays trivially low.',
          risks: [{ p: 0.16, text: 'A warship takes a hit; domestic pressure for strikes ashore.', fx: { self: { approval: -4 }, th: { tension: 9, rung: 1 } } }]
        };
      }
    },
    {
      id: 'mil_strike', cat: 'MIL', name: 'Limited Strike', scope: 'theater', pc: 5, dr: 0.35,
      blurb: 'Precision strikes on a discrete target set. Militarily satisfying, ' +
        'politically irreversible, historically poor at restoring deterrence.',
      avail: ctx => !!ctx.th && !!ctx.opp,
      model: ctx => {
        const proj = projection(ctx.P, ctx.tdef);
        const opp = ctx.opp;
        const defence = (MP.POWERS[opp].power.air + (ctx.th.defence || 0)) / 130;
        const effect = clamp(proj * (1 - defence * 0.5), 0.05, 1);
        const redlineHit = (MP.POWERS[opp].redlines || []).length > 0 && ctx.th.rung >= 5;
        return {
          fx: {
            self: { readiness: -8, legit: -4, approval: 2 * ctx.P.domConstr, econ: -0.3 },
            tgt: {
              readiness: -9 * effect, econ: -0.8 * effect, approval: 3,
              /* strikes on a weapons programme delay it; they do not end it */
              nuclearProgress: opp === 'IR' ? -11 * effect : 0
            },
            th: { tension: 16, control: towardActor(ctx.side, 4 * effect), rung: 1 },
            g: { oil: ctx.tdef.oilImpact * 14, nuclearRisk: ctx.tdef.nuclearDyad ? 4 : 1.5 }
          },
          factors: [
            { label: 'Strike effectiveness', value: Math.round(effect * 100) + '%', note: 'target air defence index ' + MP.POWERS[opp].power.air },
            { label: 'Retaliation certainty', value: 'high', note: 'the target\'s domestic politics require an answer — theirs rise ' + '+3 approval' },
            { label: 'Rally effect', value: 'both sides', note: 'strikes consolidate the adversary population behind its leadership' },
            { label: 'Escalation', value: '+1 rung', note: redlineHit ? 'AT OR NEAR A DECLARED RED LINE' : 'below declared thresholds' }
          ],
          variance: 0.45,
          narrative: 'Targets are serviced. Capability is degraded and reconstituted over months; the ' +
            'political effect is permanent and rarely the one intended.',
          precedent: 'Punitive strikes have a weak record of restoring deterrence. They reliably degrade ' +
            'capability and reliably produce a requirement for the other side to respond.',
          risks: [
            { p: 0.45, text: 'Proportionate retaliation against your forces or territory.', fx: { self: { readiness: -5, approval: -3 }, th: { tension: 8 } } },
            { p: 0.15, text: 'Civilian casualties dominate coverage; coalition partners distance themselves.', fx: { self: { legit: -6, cohesion: -5 } } }
          ]
        };
      }
    },
    {
      id: 'mil_covert', cat: 'MIL', name: 'Covert Action', scope: 'power', pc: 4, dr: 0.5,
      blurb: 'Sabotage, assassination or unattributed effects. Deniability is the whole ' +
        'product — and it degrades every year.',
      avail: ctx => !!ctx.target && MP.getAff(ctx.S, ctx.actor, ctx.target) < 0.1,
      model: ctx => {
        const skill = (ctx.P.power.cyber * 0.4 + ctx.P.softPower * 0.1 + ctx.P.power.space * 0.2) / 70;
        const exposure = clamp(0.3 + MP.POWERS[ctx.target].power.cyber / 250, 0.15, 0.8);
        return {
          fx: {
            self: { legit: -1 },
            tgt: {
              readiness: -6 * skill, econ: -0.6 * skill, cohesion: -2,
              nuclearProgress: ctx.target === 'IR' ? -6 * skill : 0
            },
            th: ctx.th ? { tension: 3, control: towardActor(ctx.side, 1.5 * skill) } : null,
            g: { nuclearRisk: 0.8 }
          },
          factors: [
            { label: 'Operational capability', value: Math.round(skill * 100) + '%', note: 'penetration takes years to build and one operation to lose' },
            { label: 'Exposure risk', value: Math.round(exposure * 100) + '%', note: 'ubiquitous surveillance has made deniability much harder' },
            { label: 'Escalation profile', value: 'deniable-until-exposed', note: 'the adversary usually knows immediately; the public does not' }
          ],
          variance: 0.6,
          narrative: 'The operation runs. Success is invisible by design; failure is a diplomatic crisis with ' +
            'your fingerprints on it.',
          precedent: 'Sabotage of strategic programmes has repeatedly delayed rather than stopped them, ' +
            'while hardening the target\'s security and resolve.',
          risks: [{ p: 0.3, text: 'Operation is exposed and attributed to you.', fx: { self: { legit: -6 }, th: { tension: 10, rung: 1 } } }]
        };
      }
    },
    {
      id: 'mil_mobilize', cat: 'MIL', name: 'Mobilise Reserves', scope: 'power', pc: 4, dr: 0.7,
      blurb: 'Expand the force. Buys mass at the cost of the civilian economy and the ' +
        'patience of the population.',
      avail: () => true,
      model: ctx => ({
        fx: {
          self: { readiness: 14, econ: -1.4, approval: -6 * ctx.P.domConstr * 1.5, warStress: 8 },
          g: { nuclearRisk: 0.5 }
        },
        factors: [
          { label: 'Readiness gain', value: '+14', note: 'trained mass takes 3-6 months to become combat effective' },
          { label: 'Economic drag', value: '-1.4 index', note: 'mobilised workers leave the labour force' },
          { label: 'Political cost', value: '-' + Math.round(6 * ctx.P.domConstr * 1.5) + ' approval', note: 'mobilisation is where wars become real to the public' }
        ],
        variance: 0.3,
        narrative: 'Call-up notices go out. Mobilisation is the point at which a foreign policy becomes a ' +
          'domestic one — and the point at which regimes have historically fallen.',
        precedent: 'Partial mobilisations have produced capital flight and emigration alongside the ' +
          'intended manpower, in every recent case.',
        risks: [{ p: 0.2, text: 'Emigration and draft avoidance blunt the manpower gain.', fx: { self: { readiness: -5, econ: -0.6 } } }]
      })
    },
    {
      id: 'mil_nuclear_signal', cat: 'MIL', name: 'Nuclear Signalling', scope: 'theater', pc: 5, dr: 1.1,
      blurb: 'Exercise, disperse or announce. The loudest signal available — and it ' +
        'cannot be taken back.',
      avail: ctx => ctx.P.warheads > 0,
      model: ctx => ({
        fx: {
          self: { legit: -8, cohesion: -4 },
          th: ctx.th ? { tension: 14, deterrence: 18, rung: ctx.th.rung >= 7 ? 1 : 0 } : null,
          g: { nuclearRisk: 12, oil: 6, trade: -3 }
        },
        factors: [
          { label: 'Deterrent effect', value: '+18', note: 'adversaries do discount for bluff — but never fully' },
          { label: 'Nuclear risk', value: '+12', note: 'the global risk index drives the catastrophic-outcome roll each turn' },
          { label: 'Legitimacy cost', value: '-8', note: 'non-aligned states punish nuclear coercion hardest' },
          { label: 'Reversibility', value: 'none', note: 'you cannot un-brandish; the next signal must be bigger' }
        ],
        variance: 0.4,
        narrative: 'Delivery systems are exercised in view of national technical means. The signal lands — ' +
          'along with the requirement to escalate again if it is ignored.',
        precedent: 'Nuclear signalling has produced caution in adversary planning while also producing ' +
          'permanent reputational cost and accelerated proliferation pressure among the watching states.',
        risks: [
          { p: 0.25, text: 'Signal read as preparation rather than warning; adversary raises its own alert state.', fx: { g: { nuclearRisk: 8 } } },
          { p: 0.2, text: 'Non-aligned states publicly break with you.', fx: { self: { legit: -5, cohesion: -4 } } }
        ]
      })
    },

    /* ==================== ECONOMIC ==================== */
    {
      id: 'eco_sanctions', cat: 'ECON', name: 'Sanctions Package', scope: 'power', pc: 3, dr: 0.45,
      blurb: 'Financial and trade restrictions. Effect depends almost entirely on how ' +
        'many others join and how much the target can substitute.',
      avail: ctx => !!ctx.target && ctx.target !== ctx.actor,
      model: ctx => {
        const T = MP.POWERS[ctx.target], ts = ctx.S.powers[ctx.target];
        const lev = MP.tradeLeverage(ctx.actor, ctx.target);
        const coal = coalitionWeight(ctx.S, ctx.actor, ctx.target);
        const adapt = ts.adaptation;
        const bite = lev * (0.35 + 0.65 * coal.share) * (1 - T.resilience) * (1 - adapt) * 22;
        const blowback = MP.tradeLeverage(ctx.target, ctx.actor) * 6 + (T.oilBeta > 0 ? 0.5 : 0);
        return {
          fx: {
            self: { econ: -blowback, legit: 0.5, coalitionBonus: 0 },
            tgt: { econ: -bite, pressure: 6 + 10 * coal.share, approval: -1.5 * (1 - T.domConstr < 0.5 ? 1 : 0.4), adaptation: 0.07 },
            g: { trade: -0.8, oil: T.oilBeta > 0.2 ? 3 : 0 },
            aff: [[ctx.actor, ctx.target, -0.08]]
          },
          factors: [
            { label: 'Your trade leverage', value: (lev < 0.01 ? '<1' : Math.round(lev * 100)) + '% of their trade', note: lev < 0.05 ? 'far too small to bite on its own — you need partners' : 'material exposure' },
            { label: 'Coalition breadth', value: Math.round(coal.share * 100) + '%', note: coal.joined.length ? 'joined by ' + coal.joined.join(', ') : 'unilateral — expect substitution' },
            { label: 'Target adaptation', value: Math.round(adapt * 100) + '%', note: 'each successive package bites less as re-routing matures' },
            { label: 'Blowback on you', value: '-' + r1(blowback) + ' econ', note: 'sanctions are a mutual cost; the question is the ratio' }
          ],
          variance: 0.4,
          narrative: 'Designations are published. The first-order shock is financial and immediate; the ' +
            'real-economy effect arrives over 2-4 quarters as trade re-routes.',
          precedent: 'Comprehensive sanctions have imposed severe long-run costs while rarely changing the ' +
            'targeted policy. Import substitution, grey fleets and third-country intermediaries ' +
            'reliably emerge within a year.',
          risks: [{ p: 0.25, text: 'Third countries expand intermediation; measured effect halves.', fx: { tgt: { econ: 1.5, adaptation: 0.1 } } }]
        };
      }
    },
    {
      id: 'eco_secondary', cat: 'ECON', name: 'Secondary Sanctions', scope: 'power', pc: 4, dr: 0.6,
      blurb: 'Punish third parties for trading with the target. The only way to make ' +
        'unilateral sanctions bite — at the cost of your own relationships.',
      avail: ctx => !!ctx.target && ctx.P.gdp > 3,
      model: ctx => {
        const T = MP.POWERS[ctx.target], ts = ctx.S.powers[ctx.target];
        const dollarReach = clamp(ctx.P.gdp / 30 * (ctx.actor === 'US' ? 1.6 : 0.7), 0.05, 1);
        const bite = dollarReach * (1 - T.resilience) * (1 - ts.adaptation * 0.5) * 16;
        const thirdParties = MP.powerList.filter(id => id !== ctx.actor && id !== ctx.target && MP.tradeLeverage(id, ctx.target) > 0.05);
        return {
          fx: {
            self: { econ: -0.4, legit: -2.5 },
            tgt: { econ: -bite, pressure: 10, adaptation: 0.05 },
            g: { trade: -2.2 },
            aff: thirdParties.map(id => [ctx.actor, id, -0.09])
          },
          factors: [
            { label: 'Financial-system reach', value: Math.round(dollarReach * 100) + '%', note: 'secondary measures work only if banks fear losing access to YOUR system' },
            { label: 'Third parties hit', value: thirdParties.join(', ') || 'none identified', note: 'each one has a reason to build an alternative payment rail' },
            { label: 'De-dollarisation push', value: '+', note: 'the long-run cost is the incentive you create to route around you' }
          ],
          variance: 0.4,
          narrative: 'Foreign banks begin over-complying weeks before enforcement, which is where most of ' +
            'the effect actually comes from.',
          precedent: 'Secondary sanctions have proven the most effective single coercive tool available to a ' +
            'reserve-currency issuer, and the most effective long-run driver of efforts to escape it.',
          risks: [{ p: 0.3, text: 'Major partner formalises an alternative settlement channel.', fx: { self: { econ: -0.8 }, g: { trade: -1 } } }]
        };
      }
    },
    {
      id: 'eco_exportctrl', cat: 'ECON', name: 'Technology Export Controls', scope: 'power', pc: 3, dr: 0.5,
      blurb: 'Deny advanced semiconductors and tooling. Slow-acting, hard to reverse, ' +
        'and it funds your rival\'s domestic substitute.',
      avail: ctx => !!ctx.target && ctx.P.power.cyber > 55,
      model: ctx => {
        const chokehold = clamp((ctx.P.power.cyber + ctx.P.power.space) / 220 * (ctx.actor === 'US' ? 1.5 : 0.8), 0.05, 1);
        const ts = ctx.S.powers[ctx.target];
        return {
          fx: {
            self: { econ: -0.5, legit: -0.5 },
            tgt: { econ: -1.2 * chokehold, tech: -9 * chokehold, adaptation: 0.06 },
            g: { trade: -1.2 },
            aff: [[ctx.actor, ctx.target, -0.07]]
          },
          factors: [
            { label: 'Chokepoint control', value: Math.round(chokehold * 100) + '%', note: 'controls only work where supply is genuinely concentrated' },
            { label: 'Substitution timeline', value: '3-7 years', note: 'target indigenisation is slower than claimed and faster than hoped' },
            { label: 'Revenue loss to you', value: '-0.5 econ', note: 'your firms lose the market they were denied' },
            { label: 'Current target tech index', value: Math.round(ts.tech), note: 'below 40 begins to constrain military modernisation' }
          ],
          variance: 0.3,
          narrative: 'Licence denials take effect. Nothing visible happens this quarter; the effect compounds ' +
            'across the target\'s next capability generation.',
          precedent: 'Advanced-node export controls have measurably slowed the target\'s leading edge while ' +
            'triggering very large state-funded substitution programmes.',
          risks: [{ p: 0.22, text: 'Target retaliates with critical-minerals restrictions.', fx: { self: { econ: -1.0 }, g: { trade: -1 } } }]
        };
      }
    },
    {
      id: 'eco_tariff', cat: 'ECON', name: 'Tariffs', scope: 'power', pc: 2, dr: 0.5,
      blurb: 'Tax imports from a rival. Politically popular, economically self-taxing, ' +
        'and invites symmetric retaliation.',
      avail: ctx => !!ctx.target && ctx.target !== ctx.actor,
      model: ctx => {
        const exposure = MP.tradeLeverage(ctx.actor, ctx.target);
        const own = MP.tradeLeverage(ctx.target, ctx.actor);
        return {
          fx: {
            self: { econ: -own * 8 - 0.3, approval: 2.5 * ctx.P.domConstr },
            tgt: { econ: -exposure * 9, approval: -1 },
            g: { trade: -1.8 },
            aff: [[ctx.actor, ctx.target, -0.06]]
          },
          factors: [
            { label: 'Their exposure to you', value: Math.round(exposure * 100) + '%', note: 'the share of their trade you can actually tax' },
            { label: 'Your exposure to them', value: Math.round(own * 100) + '%', note: 'tariffs are paid by your importers first' },
            { label: 'Retaliation', value: 'near-certain', note: 'and usually aimed at your politically sensitive sectors' },
            { label: 'Domestic politics', value: '+' + r1(2.5 * ctx.P.domConstr), note: 'protection polls well in the affected districts' }
          ],
          variance: 0.3,
          narrative: 'Duties take effect. Trade re-routes through third countries within two quarters, ' +
            'preserving the flow at a higher cost to everyone in the chain.',
          precedent: 'Tariff rounds have consistently reduced bilateral trade while leaving overall deficits ' +
            'roughly unchanged, as flows re-route rather than disappear.',
          risks: [{ p: 0.4, text: 'Targeted retaliation on your export-dependent sectors.', fx: { self: { econ: -0.7, approval: -2 } } }]
        };
      }
    },
    {
      id: 'eco_energy', cat: 'ECON', name: 'Energy Leverage', scope: 'power', pc: 3, dr: 0.6,
      blurb: 'Cut supply, cap prices, or open the taps. The fastest-acting economic ' +
        'instrument on the board — and the one that hits everyone.',
      avail: ctx => true,
      model: ctx => {
        const isExporter = ctx.P.oilBeta > 0.1;
        const swing = isExporter ? clamp(ctx.P.gdp * 0.05 + ctx.P.oilBeta, 0.2, 1.2) : 0.5;
        const oilMove = isExporter ? 9 * swing : -4 * swing;
        return {
          fx: {
            self: { econ: isExporter ? 0.6 : -0.5, legit: isExporter ? -2 : 0.5 },
            tgt: ctx.target ? { econ: -Math.abs(oilMove) * (MP.POWERS[ctx.target].oilBeta < 0 ? 0.09 : -0.06) } : null,
            g: { oil: oilMove, trade: -0.5 }
          },
          factors: [
            { label: 'Your market position', value: isExporter ? 'net exporter' : 'net importer', note: isExporter ? 'you can move price by withholding' : 'you can only move it by releasing reserves or capping' },
            { label: 'Expected oil move', value: (oilMove > 0 ? '+' : '') + r1(oilMove) + '%', note: 'spot markets price supply risk before any barrel moves' },
            { label: 'Universality', value: 'hits all importers', note: 'including your own partners — energy coercion has no precision setting' }
          ],
          variance: 0.45,
          narrative: 'The market reprices within hours. Energy is the one lever whose effects reach every ' +
            'actor on the board simultaneously, including you.',
          precedent: 'Supply weaponisation has produced sharp short-run price spikes followed by demand ' +
            'destruction, substitution and permanent loss of market share for the coercer.',
          risks: [{ p: 0.25, text: 'Other producers backfill the volume, collapsing the price effect.', fx: { g: { oil: -5 } } }]
        };
      }
    },
    {
      id: 'eco_aid', cat: 'ECON', name: 'Financial Aid Package', scope: 'theater', pc: 3, dr: 0.35,
      blurb: 'Underwrite a partner\'s budget or reconstruction. Buys influence that ' +
        'survives changes of government.',
      avail: ctx => !!ctx.th && !!ctx.side,
      model: ctx => {
        const capacity = clamp(ctx.P.gdp / 22, 0.03, 1);
        const recipient = ctx.side === 'A' ? ctx.tdef.sideA : ctx.tdef.sideB;
        return {
          fx: {
            self: { econ: -0.5 * capacity, approval: -1.5 * ctx.P.domConstr, legit: 3 },
            th: { control: towardActor(ctx.side, 1.8 * capacity), tension: -1 },
            g: {},
            aff: [[ctx.actor, recipient, 0.12]],
            recipientEcon: { id: recipient, econ: 2.5 * capacity }
          },
          factors: [
            { label: 'Fiscal capacity', value: Math.round(capacity * 100) + '%', note: '$' + ctx.P.gdp + 'tn economy' },
            { label: 'Recipient stabilisation', value: '+' + r1(2.5 * capacity) + ' econ', note: 'budget support prevents the collapse that no weapon can reverse' },
            { label: 'Influence purchased', value: '+0.12 affinity', note: 'creditors get listened to' },
            { label: 'Domestic cost', value: '-' + r1(1.5 * ctx.P.domConstr), note: '"why are we paying for their war" is the universal counter-argument' }
          ],
          variance: 0.2,
          narrative: 'Disbursement begins. In attritional wars, budget support decides outcomes at least as ' +
            'often as ammunition does — states collapse fiscally before they collapse militarily.',
          precedent: 'External budget support has repeatedly prevented state collapse under wartime ' +
            'conditions where military aid alone would not have.',
          risks: [{ p: 0.15, text: 'Diversion and corruption reporting undermines domestic support for the programme.', fx: { self: { approval: -3, legit: -2 } } }]
        };
      }
    },
    {
      id: 'eco_invest', cat: 'ECON', name: 'Infrastructure & Investment', scope: 'power', pc: 3, dr: 0.45,
      blurb: 'Ports, rail, grids, mines. The slowest instrument here and the one that ' +
        'compounds for decades.',
      avail: ctx => !!ctx.target && ctx.target !== ctx.actor,
      model: ctx => {
        const capacity = clamp(ctx.P.gdp / 25, 0.03, 1);
        return {
          fx: {
            self: { econ: -0.35 * capacity, legit: 2 },
            tgt: { econ: 1.4 * capacity, adaptation: 0.04 },
            g: { trade: 0.8 },
            aff: [[ctx.actor, ctx.target, 0.14 * capacity + 0.04]]
          },
          factors: [
            { label: 'Capital deployed', value: Math.round(capacity * 100) + '%', note: 'concessional finance buys alignment cheaply' },
            { label: 'Time to effect', value: '5-15 years', note: 'infrastructure changes trade geography permanently' },
            { label: 'Dependency created', value: '+affinity', note: 'and a debt-servicing relationship you control' }
          ],
          variance: 0.25,
          narrative: 'Agreements are signed. Nothing in this quarter\'s numbers changes; the map of who ' +
            'trades with whom changes for a generation.',
          precedent: 'Large infrastructure-finance programmes have durably shifted alignment in recipient ' +
            'states, alongside recurring debt-sustainability disputes.',
          risks: [{ p: 0.18, text: 'Project stalls; debt-trap criticism damages your standing regionally.', fx: { self: { legit: -3 } } }]
        };
      }
    },
    {
      id: 'eco_swap', cat: 'ECON', name: 'Currency Swap & Settlement Line', scope: 'power', pc: 3, dr: 0.6,
      blurb: 'Offer trade settlement outside the dominant currency. Erodes the ' +
        'sanctioning power of whoever issues it.',
      avail: ctx => !!ctx.target && ctx.target !== ctx.actor && ctx.P.gdp > 1,
      model: ctx => {
        const weight = clamp(ctx.P.gdp / 20, 0.03, 1);
        const ts = ctx.S.powers[ctx.target];
        return {
          fx: {
            self: { econ: 0.3 * weight, legit: 0.5 },
            tgt: { econ: 0.7 * weight, adaptation: 0.12, pressure: -6 * weight },
            g: { trade: 0.5 },
            aff: [[ctx.actor, ctx.target, 0.1]]
          },
          factors: [
            { label: 'Your currency\'s weight', value: Math.round(weight * 100) + '%', note: 'settlement lines need depth, convertibility and trust' },
            { label: 'Sanctions relief', value: '-' + r1(6 * weight) + ' pressure', note: 'reduces the target\'s exposure to third-party financial coercion' },
            { label: 'Adaptation', value: '+12%', note: 'permanently raises the target\'s resistance to future measures' }
          ],
          variance: 0.25,
          narrative: 'Bilateral settlement volumes rise. Each such arrangement is small; together they are ' +
            'the mechanism by which financial coercion loses its edge.',
          precedent: 'Non-dollar settlement has grown fastest precisely among states that have been ' +
            'sanctioned — coercion generates its own workaround.',
          risks: [{ p: 0.2, text: 'Secondary-sanctions exposure deters your own banks from using the line.', fx: { tgt: { pressure: 4 } } }]
        };
      }
    },
    {
      id: 'eco_relief', cat: 'ECON', name: 'Sanctions Relief', scope: 'power', pc: 3, dr: 0.7,
      blurb: 'Lift measures in exchange for behaviour. The only economic instrument that ' +
        'can actually buy a change of policy.',
      avail: ctx => !!ctx.target && ctx.S.powers[ctx.target].pressure > 12,
      model: ctx => {
        const ts = ctx.S.powers[ctx.target];
        const leverage = clamp(ts.pressure / 100, 0, 1);
        return {
          fx: {
            self: { approval: -3 * ctx.P.domConstr * 1.6, legit: 1.5 },
            tgt: { econ: 2.2 * leverage, pressure: -18 * leverage, approval: 3 },
            th: ctx.th ? { tension: -6 * leverage } : null,
            g: { trade: 1.2, nuclearRisk: -1.5 },
            aff: [[ctx.actor, ctx.target, 0.14]]
          },
          factors: [
            { label: 'Accumulated pressure', value: Math.round(ts.pressure) + '/100', note: 'relief is only valuable in proportion to the pain being relieved' },
            { label: 'Reciprocity', value: 'not guaranteed', note: 'nothing in the model forces the target to reciprocate' },
            { label: 'Domestic cost', value: '-' + r1(3 * ctx.P.domConstr * 1.6), note: 'lifting sanctions is always attacked as rewarding aggression' }
          ],
          variance: 0.4,
          narrative: 'Designations are suspended. The target\'s economy responds within a quarter — which is ' +
            'exactly why relief is the strongest inducement available.',
          precedent: 'The negotiated agreements that have actually constrained adversary programmes were ' +
            'all built on phased relief, and all proved fragile to domestic political change on ' +
            'either side.',
          risks: [{ p: 0.3, text: 'Target pockets the relief without reciprocating; you take the political damage.', fx: { self: { approval: -4, legit: -2 } } }]
        };
      }
    },
    {
      id: 'act_hold', cat: 'DIP', name: 'Hold & Consolidate', scope: 'global', pc: 0, dr: 0.0,
      blurb: 'Take no new initiative. Recover political capital, let tensions cool, and ' +
        'let the other side make the next mistake.',
      avail: () => true,
      model: ctx => ({
        fx: {
          self: { pc: 2, approval: 1, readiness: 4, econ: 0.25 },
          g: { nuclearRisk: -1 }
        },
        factors: [
          { label: 'Capital recovered', value: '+2 PC', note: 'restraint is a resource-generating move' },
          { label: 'Readiness', value: '+4', note: 'forces reconstitute, stocks rebuild' },
          { label: 'Opportunity cost', value: 'the board moves without you', note: 'other capitals act whether or not you do' }
        ],
        variance: 0.15,
        narrative: 'No new initiative this quarter. Sometimes the correct move is to let the adversary\'s ' +
          'costs accumulate.',
        precedent: 'Strategic patience is undervalued in democracies with short electoral cycles and ' +
          'overvalued in autocracies with no exit ramp.',
        risks: []
      })
    }
  ];

  const BY_ID = {};
  ACTIONS.forEach(a => { BY_ID[a.id] = a; });

  MP.ACTIONS = ACTIONS;
  MP.ACTION_BY_ID = BY_ID;
  MP.CATS = CATS;
  MP.helpers = { projection, coalitionWeight, towardActor, clamp, homeAdvantage };
})(window.MP = window.MP || {});
