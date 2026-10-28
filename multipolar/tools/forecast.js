/* MULTIPOLAR — tools/forecast.js
 *
 * The ensemble forecaster. Runs the whole board forward many times with every
 * capital acting under its own leadership, and reports the distribution of
 * worlds that come out.
 *
 *   node tools/forecast.js [runs] [quarters] [seed]
 *   node tools/forecast.js 400 40 20261028
 *
 * Writes dist/forecast.json and prints a readable summary.
 *
 * Nobody holds a seat in these runs. There is no player, so nothing in the
 * output is advice about what anyone should do — it is the model's own account
 * of where its assumptions lead when every actor pursues its own interests.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const FILES = ['js/data/powers.js', 'js/data/theaters.js', 'js/data/actions.js', 'js/data/events.js',
  'js/data/leaders.js', 'js/data/macro.js',
  'js/engine/core.js', 'js/engine/resolve.js', 'js/engine/ai.js', 'js/engine/turn.js', 'js/engine/sim.js'];
const sandbox = { self: {}, console, Math, Date, JSON, setTimeout };
vm.createContext(sandbox);
FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f }));
const MP = sandbox.self.MP;

const RUNS = parseInt(process.argv[2] || '400', 10);
const QUARTERS = parseInt(process.argv[3] || '40', 10);
const SEED = parseInt(process.argv[4] || '20261028', 10);
const BUDGET = 40;

/* quarter index -> calendar label, baseline Q4 2026 */
const label = q => 'Q' + (((q + 3) % 4) + 1) + ' ' + (2026 + Math.floor((q + 3) / 4));

const q = (arr, p) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.max(0, Math.min(s.length - 1, Math.floor(p * (s.length - 1))))];
};
const stat = a => ({ p10: q(a, 0.1), p25: q(a, 0.25), p50: q(a, 0.5), p75: q(a, 0.75), p90: q(a, 0.9),
  mean: a.reduce((x, y) => x + y, 0) / (a.length || 1) });
const rate = a => a.reduce((s, x) => s + (x ? 1 : 0), 0) / (a.length || 1);

/* checkpoints: one year, three years, five, ten */
const MARKS = [4, 12, 20, QUARTERS].filter((v, i, s) => v <= QUARTERS && s.indexOf(v) === i);

const runs = [];
const t0 = Date.now();

for (let r = 0; r < RUNS; r++) {
  MP.srand((SEED + r * 2654435761) >>> 0);
  const S = MP.newState(null, QUARTERS + 1);
  S.player = null;
  S.__aiBudget = BUDGET;

  const rec = {
    marks: {}, transitions: {}, irregular: {}, unrest: 0,
    maxRung: {}, warQuarters: {}, settled: {}, nuclear: false, nuclearWhere: null,
    oilPath: [], inflPath: []
  };
  MP.powerList.forEach(id => { rec.transitions[id] = 0; rec.irregular[id] = 0; });
  MP.theaterList.forEach(t => { rec.maxRung[t] = S.theaters[t].rung; rec.warQuarters[t] = 0; });

  for (let qi = 1; qi <= QUARTERS && !S.over; qi++) {
    const out = MP.endTurn(S);

    out.notes.concat(out.events || []).forEach(n => {
      if (n.tag === 'UNREST') rec.unrest++;
      if (n.tag === 'CATASTROPHE') { rec.nuclear = true; rec.nuclearWhere = n.headline; }
    });
    MP.powerList.forEach(id => {
      const L = S.leaders[id];
      if (L && L.lastTransition && L.lastTransition.turn === S.turn - 1) {
        rec.transitions[id]++;
        if (L.lastTransition.kind === 'irregular') rec.irregular[id]++;
      }
    });
    MP.theaterList.forEach(t => {
      const st = S.theaters[t];
      if (st.rung > rec.maxRung[t]) rec.maxRung[t] = st.rung;
      if (st.rung >= 6) rec.warQuarters[t]++;
    });
    rec.oilPath.push(S.g.oil);
    rec.inflPath.push(S.g.inflation);

    if (MARKS.indexOf(qi) >= 0) rec.marks[qi] = snapshot(S);
  }
  if (!rec.marks[QUARTERS]) rec.marks[QUARTERS] = snapshot(S);

  MP.theaterList.forEach(t => {
    rec.settled[t] = S.theaters[t].rung <= (MP.THEATERS[t].rungFloor || 0);
  });
  rec.end = snapshot(S);
  runs.push(rec);
}

function snapshot(S) {
  const pol = MP.macro.polarity(S);
  const o = {
    polarity: pol.type, leader: pol.leader, poles: pol.poles, ratio: pol.ratio,
    share: {}, index: {},
    oil: S.g.oil, trade: S.g.trade, inflation: S.g.inflation, nuclearRisk: S.g.nuclearRisk,
    integration: MP.macro.integration(S),
    blocs: MP.macro.blocs(S).filter(b => b.length > 1).map(b => b.slice().sort()),
    econ: {}, discontent: {}, trust: {}, approval: {}, legit: {}, cohesion: {},
    rung: {}, control: {}, tension: {},
    iranNuclear: S.powers.IR.nuclearProgress,
    aff: {}
  };
  pol.share.forEach(x => { o.share[x.id] = x.share; o.index[x.id] = x.v; });
  o.parts = {};
  MP.powerList.forEach(id => {
    const pi = MP.macro.powerIndex(S, id);
    o.parts[id] = { economic: pi.parts.economic, military: pi.parts.military,
      technology: pi.parts.technology, alliance: pi.parts.alliance,
      usable: pi.usable, actorness: pi.actorness };
  });
  MP.powerList.forEach(id => {
    const p = S.powers[id];
    o.econ[id] = p.econ; o.discontent[id] = p.discontent; o.trust[id] = p.trust;
    o.approval[id] = p.approval; o.legit[id] = p.legit; o.cohesion[id] = p.cohesion;
  });
  MP.theaterList.forEach(t => {
    o.rung[t] = S.theaters[t].rung; o.control[t] = S.theaters[t].control;
    o.tension[t] = S.theaters[t].tension;
  });
  [['US', 'CN'], ['US', 'EU'], ['US', 'IN'], ['CN', 'RU'], ['RU', 'EU'], ['CN', 'IN'],
   ['US', 'IL'], ['IR', 'IL'], ['US', 'TR'], ['CN', 'EU'], ['IN', 'RU'], ['US', 'RU']]
    .forEach(([a, b]) => { o.aff[a + '-' + b] = MP.getAff(S, a, b); });
  return o;
}

/* ------------------------------------------------------------------ */
/* aggregate                                                           */
/* ------------------------------------------------------------------ */
const ends = runs.map(r => r.end);

function distribution(key, extract) {
  const counts = {};
  ends.forEach(e => { const k = extract(e); counts[k] = (counts[k] || 0) + 1; });
  return Object.keys(counts).map(k => ({ k, p: counts[k] / ends.length }))
    .sort((a, b) => b.p - a.p);
}

const report = {
  meta: {
    generated: new Date().toISOString(),
    baseline: '2026-10-28',
    runs: RUNS, quarters: QUARTERS, horizon: label(QUARTERS), seed: SEED, aiBudget: BUDGET,
    note: 'Model output, not a prediction. Probabilities are frequencies across runs of ' +
      'this model\'s equations under its own assumptions.'
  },
  polarity: distribution('polarity', e => e.polarity),
  primacy: distribution('leader', e => e.leader),
  poleCount: distribution('poles', e => e.poles.length),
  byMark: {},
  powers: {},
  theatres: {},
  system: {
    oil: stat(ends.map(e => e.oil)),
    trade: stat(ends.map(e => e.trade)),
    inflation: stat(ends.map(e => e.inflation)),
    nuclearRisk: stat(ends.map(e => e.nuclearRisk)),
    integration: stat(ends.map(e => e.integration)),
    nuclearUse: rate(runs.map(r => r.nuclear)),
    oilPeak: stat(runs.map(r => Math.max.apply(null, r.oilPath))),
    unrestEvents: stat(runs.map(r => r.unrest))
  },
  relationships: {},
  proliferation: {
    iranProgress: stat(ends.map(e => e.iranNuclear)),
    pWeaponsThreshold: rate(ends.map(e => e.iranNuclear >= 75)),
    pSuppressed: rate(ends.map(e => e.iranNuclear < 40))
  },
  branches: {},
  components: {},
  patterns: MP.PATTERNS.map(p => ({ id: p.id, name: p.name, confidence: p.confidence, claim: p.claim, caveat: p.caveat }))
};

MARKS.forEach(m => {
  const at = runs.map(r => r.marks[m]).filter(Boolean);
  if (!at.length) return;
  const counts = {};
  at.forEach(e => { counts[e.polarity] = (counts[e.polarity] || 0) + 1; });
  const lead = {};
  at.forEach(e => { lead[e.leader] = (lead[e.leader] || 0) + 1; });
  report.byMark[m] = {
    label: label(m),
    polarity: Object.keys(counts).map(k => ({ k, p: counts[k] / at.length })).sort((a, b) => b.p - a.p),
    primacy: Object.keys(lead).map(k => ({ k, p: lead[k] / at.length })).sort((a, b) => b.p - a.p),
    oil: stat(at.map(e => e.oil)),
    inflation: stat(at.map(e => e.inflation)),
    share: MP.powerList.reduce((o, id) => (o[id] = stat(at.map(e => e.share[id] || 0)), o), {})
  };
});

MP.powerList.forEach(id => {
  report.powers[id] = {
    name: MP.POWERS[id].name,
    leadership: MP.LEADERSHIP[id] ? MP.LEADER_TYPES[MP.LEADERSHIP[id].type].label : null,
    share: stat(ends.map(e => e.share[id] || 0)),
    index: stat(ends.map(e => e.index[id] || 0)),
    econ: stat(ends.map(e => e.econ[id])),
    discontent: stat(ends.map(e => e.discontent[id])),
    trust: stat(ends.map(e => e.trust[id])),
    approval: stat(ends.map(e => e.approval[id])),
    legit: stat(ends.map(e => e.legit[id])),
    transitions: stat(runs.map(r => r.transitions[id])),
    pIrregular: rate(runs.map(r => r.irregular[id] > 0)),
    pAnyTransition: rate(runs.map(r => r.transitions[id] > 0)),
    pPrimacy: rate(ends.map(e => e.leader === id)),
    pPole: rate(ends.map(e => e.poles.indexOf(id) >= 0))
  };
});

MP.theaterList.forEach(t => {
  const T = MP.THEATERS[t];
  report.theatres[t] = {
    name: T.name, region: T.region, startRung: T.rung, floor: T.rungFloor || 0,
    endRung: stat(ends.map(e => e.rung[t])),
    maxRung: stat(runs.map(r => r.maxRung[t])),
    pEscalates: rate(runs.map(r => r.maxRung[t] > T.rung)),
    pMajorWar: rate(runs.map(r => r.maxRung[t] >= 7)),
    pSettles: rate(runs.map(r => r.settled[t])),
    warQuarters: stat(runs.map(r => r.warQuarters[t])),
    control: stat(ends.map(e => e.control[t])),
    sideA: T.sideALabel, sideB: T.sideBLabel
  };
});

Object.keys(ends[0].aff).forEach(k => {
  report.relationships[k] = {
    end: stat(ends.map(e => e.aff[k])),
    start: null
  };
});
{
  MP.srand(SEED);
  const S0 = MP.newState(null, 4);
  Object.keys(report.relationships).forEach(k => {
    const [a, b] = k.split('-');
    report.relationships[k].start = MP.getAff(S0, a, b);
  });
}

/* bloc configurations that actually recur */
const blocCounts = {};
ends.forEach(e => e.blocs.forEach(b => {
  if (b.length < 2) return;
  const k = b.join('+');
  blocCounts[k] = (blocCounts[k] || 0) + 1;
}));
report.blocs = Object.keys(blocCounts).map(k => ({ bloc: k, p: blocCounts[k] / ends.length }))
  .filter(x => x.p > 0.08).sort((a, b) => b.p - a.p).slice(0, 14);

/* component breakdown of the composite index */
MP.powerList.forEach(id => {
  report.components[id] = {
    economic: stat(ends.map(e => e.parts[id].economic)),
    military: stat(ends.map(e => e.parts[id].military)),
    technology: stat(ends.map(e => e.parts[id].technology)),
    alliance: stat(ends.map(e => e.parts[id].alliance)),
    usable: stat(ends.map(e => e.parts[id].usable)),
    actorness: ends[0].parts[id].actorness
  };
});

/* Conditional branches: the forecast is far more useful split on the handful
   of things that actually fork the decade than averaged over all of them. */
function branch(name, test, describe) {
  const yes = runs.filter(test), no = runs.filter(r => !test(r));
  if (yes.length < 8 || no.length < 8) return;
  const side = set => ({
    n: set.length,
    oil: stat(set.map(r => r.end.oil)),
    inflation: stat(set.map(r => r.end.inflation)),
    usShare: stat(set.map(r => r.end.share.US || 0)),
    cnShare: stat(set.map(r => r.end.share.CN || 0)),
    integration: stat(set.map(r => r.end.integration)),
    pNuclear: rate(set.map(r => r.nuclear)),
    pUSLeads: rate(set.map(r => r.end.leader === 'US')),
    polarity: (() => { const c = {}; set.forEach(r => c[r.end.polarity] = (c[r.end.polarity] || 0) + 1);
      return Object.keys(c).map(k => ({ k, p: c[k] / set.length })).sort((a, b) => b.p - a.p); })(),
    euDiscontent: stat(set.map(r => r.end.discontent.EU)),
    usDiscontent: stat(set.map(r => r.end.discontent.US))
  });
  report.branches[name] = { describe, p: yes.length / runs.length, yes: side(yes), no: side(no) };
}
branch('ukraineSettles', r => r.settled.UKR,
  'Runs where the Ukraine war comes to rest at or below its structural floor, against those where it does not.');
branch('taiwanWar', r => r.maxRung.TWN >= 7,
  'Runs where the Taiwan Strait reaches great-power war, against those where coercion stays below that line.');
branch('iranThreshold', r => r.end.iranNuclear >= 60,
  'Runs where the Iranian programme recovers toward threshold capability, against those where it stays suppressed.');
branch('usIrregular', r => r.irregular.US > 0 || r.end.discontent.US > 70,
  'Runs where the United States suffers an internal political rupture or severe social strain, against those where it does not.');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/forecast.json'), JSON.stringify(report, null, 2));

/* ------------------------------------------------------------------ */
/* console summary                                                     */
/* ------------------------------------------------------------------ */
const pct = v => (v * 100).toFixed(0) + '%';
const f1 = v => v.toFixed(1);
console.log('\n' + '='.repeat(68));
console.log('MULTIPOLAR ENSEMBLE FORECAST');
console.log('baseline 28 Oct 2026 · horizon ' + label(QUARTERS) + ' · ' + RUNS + ' runs × ' + QUARTERS + ' quarters');
console.log('='.repeat(68));

console.log('\nSYSTEM STRUCTURE at ' + label(QUARTERS));
report.polarity.forEach(x => console.log('  ' + x.k.padEnd(12) + pct(x.p)));
console.log('\nWHO LEADS THE SYSTEM');
report.primacy.slice(0, 5).forEach(x =>
  console.log('  ' + MP.POWERS[x.k].name.padEnd(16) + pct(x.p)));

console.log('\nPOWER SHARE (p10 / median / p90)');
MP.powerList.map(id => ({ id, s: report.powers[id].share }))
  .sort((a, b) => b.s.p50 - a.s.p50).slice(0, 8)
  .forEach(x => console.log('  ' + MP.POWERS[x.id].name.padEnd(16) +
    (x.s.p10 * 100).toFixed(1) + '  ' + (x.s.p50 * 100).toFixed(1) + '  ' + (x.s.p90 * 100).toFixed(1)));

console.log('\nTHEATRES — P(escalates) / P(major war) / P(settles)');
Object.keys(report.theatres).map(t => ({ t, d: report.theatres[t] }))
  .sort((a, b) => b.d.pMajorWar - a.d.pMajorWar)
  .forEach(x => console.log('  ' + x.d.name.padEnd(26) +
    pct(x.d.pEscalates).padStart(5) + pct(x.d.pMajorWar).padStart(7) + pct(x.d.pSettles).padStart(7) +
    '   rung ' + x.d.startRung + ' -> ' + f1(x.d.endRung.p50)));

console.log('\nLEADERSHIP — P(any change) / P(irregular) / mean changes');
MP.powerList.map(id => ({ id, d: report.powers[id] }))
  .sort((a, b) => b.d.pIrregular - a.d.pIrregular).slice(0, 10)
  .forEach(x => console.log('  ' + MP.POWERS[x.id].name.padEnd(16) +
    pct(x.d.pAnyTransition).padStart(5) + pct(x.d.pIrregular).padStart(7) +
    '   ' + x.d.transitions.mean.toFixed(2)));

console.log('\nSYSTEM INDICES (p10 / median / p90)');
const si = report.system;
console.log('  oil $            ' + f1(si.oil.p10) + '  ' + f1(si.oil.p50) + '  ' + f1(si.oil.p90) +
  '   (peak median $' + f1(si.oilPeak.p50) + ')');
console.log('  inflation %      ' + f1(si.inflation.p10) + '  ' + f1(si.inflation.p50) + '  ' + f1(si.inflation.p90));
console.log('  trade index      ' + f1(si.trade.p10) + '  ' + f1(si.trade.p50) + '  ' + f1(si.trade.p90));
console.log('  integration      ' + f1(si.integration.p10) + '  ' + f1(si.integration.p50) + '  ' + f1(si.integration.p90));
console.log('  nuclear risk     ' + f1(si.nuclearRisk.p10) + '  ' + f1(si.nuclearRisk.p50) + '  ' + f1(si.nuclearRisk.p90));
console.log('  P(nuclear use)   ' + pct(si.nuclearUse));

console.log('\nRELATIONSHIPS (start -> median end)');
Object.keys(report.relationships).forEach(k => {
  const r = report.relationships[k];
  const d = r.end.p50 - r.start;
  console.log('  ' + k.padEnd(10) + f1(r.start).padStart(6) + ' -> ' + f1(r.end.p50).padStart(6) +
    '   ' + (d >= 0 ? '+' : '') + f1(d));
});

console.log('\nRECURRING BLOCS');
report.blocs.slice(0, 8).forEach(b => console.log('  ' + pct(b.p).padStart(5) + '  ' + b.bloc));

console.log('\nIRAN NUCLEAR PROGRAMME');
console.log('  progress index   ' + f1(report.proliferation.iranProgress.p10) + '  ' +
  f1(report.proliferation.iranProgress.p50) + '  ' + f1(report.proliferation.iranProgress.p90));
console.log('  P(threshold)     ' + pct(report.proliferation.pWeaponsThreshold));
console.log('  P(suppressed)    ' + pct(report.proliferation.pSuppressed));

console.log('\n' + ((Date.now() - t0) / 1000).toFixed(1) + 's · dist/forecast.json written\n');
