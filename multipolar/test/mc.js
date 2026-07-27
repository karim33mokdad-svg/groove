/* Outcome-simulator harness.
 *   node test/mc.js
 * Checks reproducibility, that the counterfactual comparison detects effects
 * it should detect and stays quiet on effects it should not, and reports
 * timing so the phone budget stays honest.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const FILES = ['js/data/powers.js', 'js/data/theaters.js', 'js/data/actions.js', 'js/data/events.js',
  'js/engine/core.js', 'js/engine/resolve.js', 'js/engine/ai.js', 'js/engine/turn.js', 'js/engine/sim.js'];
const sandbox = { self: {}, console, Math, Date, JSON, setTimeout };
vm.createContext(sandbox);
FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f }));
const MP = sandbox.self.MP;

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; };
const run = (S, opts) => new Promise(res => MP.sim.project(S, opts, null, res));

(async () => {
  const S = MP.newState('US', 12);

  /* ---- reproducibility ---- */
  const a = await run(S, { trials: 30, horizon: 3, seed: 777 });
  const b = await run(S, { trials: 30, horizon: 3, seed: 777 });
  ok(JSON.stringify(a.control.dist) === JSON.stringify(b.control.dist),
    'same seed reproduces the identical distribution');
  const c = await run(S, { trials: 30, horizon: 3, seed: 778 });
  ok(JSON.stringify(a.control.dist) !== JSON.stringify(c.control.dist),
    'a different seed produces a different distribution');

  /* ---- distributions are sane ---- */
  const d = a.control.dist;
  ok(d.oil.p10 <= d.oil.p50 && d.oil.p50 <= d.oil.p90, 'oil quantiles are ordered');
  ok(d.oil.p10 > 20 && d.oil.p90 < 300, 'oil stays in a plausible band: $' +
    d.oil.p10.toFixed(0) + '–' + d.oil.p90.toFixed(0));
  ok(d.score.p10 >= 0 && d.score.p90 <= 100, 'campaign score stays in range');
  ok(a.control.rate.nuclearUsed >= 0 && a.control.rate.nuclearUsed <= 1, 'nuclear rate is a probability');
  const spread = d.oil.p90 - d.oil.p10;
  ok(spread > 0.5, 'the projection has real spread ($' + spread.toFixed(1) + ') — it is a distribution, not a point');

  /* ---- the counterfactual detects a real effect ---- */
  const t0 = Date.now();
  const sanctions = await run(S, {
    trials: 60, horizon: 4, seed: 9001,
    decision: { a: 'eco_sanctions', target: 'RU' }
  });
  const ms = Date.now() - t0;
  const press = sanctions.compare.rows.find(r => r.key === 'pressure');
  ok(!!sanctions.compare, 'a decision produces a paired comparison');
  const nuclearSignal = await run(S, {
    trials: 60, horizon: 4, seed: 9002,
    decision: { a: 'mil_nuclear_signal', theater: 'UKR' }
  });
  const nr = nuclearSignal.compare.rows.find(r => r.key === 'nuclearRisk');
  ok(nr.median > 0, 'nuclear signalling raises modelled nuclear risk (median +' + nr.median.toFixed(1) + ')');
  const legit = nuclearSignal.compare.rows.find(r => r.key === 'legit');
  ok(legit.median < 0, 'nuclear signalling costs legitimacy (median ' + legit.median.toFixed(1) + ')');

  const aid = await run(S, {
    trials: 60, horizon: 4, seed: 9003,
    decision: { a: 'eco_aid', theater: 'UKR' }
  });
  const ukr = aid.compare.thRows.find(r => r.id === 'UKR');
  ok(!!ukr && ukr.standingDelta > 0, 'aid to Ukraine improves the position you back (median +' +
    (ukr ? ukr.standingDelta.toFixed(2) : 'n/a') + ')');

  /* ---- the counterfactual stays quiet where it should ---- */
  const hold = await run(S, { trials: 60, horizon: 4, seed: 9004, decision: { a: 'act_hold' } });
  const noise = hold.compare.rows.filter(r => Math.abs(r.median) > 2 && r.key !== 'score');
  ok(noise.length === 0, 'holding produces no large spurious differences' +
    (noise.length ? ' (saw ' + noise.map(x => x.label).join(', ') + ')' : ''));

  /* ---- timing ---- */
  console.log('\n  60 paired trials × 4 quarters: ' + ms + 'ms on this machine' +
    ' (~' + (ms * 3 / 1000).toFixed(1) + 's on a slow phone)');

  console.log(fails ? '\n' + fails + ' FAILURE(S)' : '\nAll simulator checks passed.');
  process.exit(fails ? 1 : 0);
})();
