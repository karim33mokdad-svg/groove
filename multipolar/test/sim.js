/* Headless engine harness: runs full campaigns for every playable power with
 * randomly chosen legal actions, and asserts the model stays inside its bounds.
 *   node test/sim.js [campaignsPerPower]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const FILES = [
  'js/data/powers.js', 'js/data/theaters.js', 'js/data/actions.js', 'js/data/events.js',
  'js/engine/core.js', 'js/engine/resolve.js', 'js/engine/ai.js', 'js/engine/turn.js'
];

const sandbox = { window: {}, console, Math, Date, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
FILES.forEach(f => {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  try { vm.runInContext(src, sandbox, { filename: f }); }
  catch (e) { console.error('LOAD FAIL', f, e.message); process.exit(1); }
});
const MP = sandbox.window.MP;

const N = parseInt(process.argv[2] || '25', 10);
let issues = [];
const flag = (msg) => { if (issues.indexOf(msg) < 0) issues.push(msg); };

function checkBounds(S, where) {
  MP.powerList.forEach(id => {
    const p = S.powers[id];
    ['econ', 'approval', 'cohesion', 'legit', 'readiness', 'pressure', 'tech', 'pc'].forEach(k => {
      if (typeof p[k] !== 'number' || !isFinite(p[k])) flag(`${where}: ${id}.${k} is ${p[k]}`);
    });
    if (p.approval < -0.001 || p.approval > 100.001) flag(`${where}: ${id}.approval out of range ${p.approval}`);
    if (p.econ < 39 || p.econ > 171) flag(`${where}: ${id}.econ out of range ${p.econ}`);
  });
  MP.theaterList.forEach(id => {
    const t = S.theaters[id];
    if (!isFinite(t.control) || t.control < 0 || t.control > 100) flag(`${where}: ${id}.control ${t.control}`);
    if (!isFinite(t.tension) || t.tension < 0 || t.tension > 100) flag(`${where}: ${id}.tension ${t.tension}`);
    if (!Number.isInteger(t.rung) || t.rung < 0 || t.rung > 10) flag(`${where}: ${id}.rung ${t.rung}`);
  });
  if (!isFinite(S.g.oil) || S.g.oil <= 0) flag(`${where}: oil ${S.g.oil}`);
  if (!isFinite(S.g.trade)) flag(`${where}: trade ${S.g.trade}`);
  if (!isFinite(S.g.nuclearRisk)) flag(`${where}: nuclearRisk ${S.g.nuclearRisk}`);
}

const stats = {};
let totalActions = 0, unavailable = 0, endings = {};

MP.playableList.forEach(pid => {
  const scores = [];
  for (let run = 0; run < N; run++) {
    const S = MP.newState(pid, 12);
    let guard = 0;
    while (!S.over && guard++ < 40) {
      // player takes 1-3 random legal actions
      const acts = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < acts; i++) {
        const opts = [];
        MP.ACTIONS.forEach(A => {
          if (A.pc > S.powers[pid].pc) return;
          if (A.scope === 'theater') MP.theaterList.forEach(t => opts.push({ a: A.id, theater: t }));
          else if (A.scope === 'power') MP.powerList.filter(x => x !== pid).forEach(t => opts.push({ a: A.id, target: t }));
          else opts.push({ a: A.id });
        });
        const legal = opts.filter(o => { try { return !!MP.forecast(S, pid, o.a, o); } catch (e) { flag('forecast threw: ' + o.a + ' / ' + e.message); return false; } });
        if (!legal.length) { unavailable++; break; }
        const pick = legal[Math.floor(Math.random() * legal.length)];
        const f = MP.forecast(S, pid, pick.a, pick);
        if (!f.factors || !f.factors.length) flag('no factors for ' + pick.a);
        if (!f.narrative) flag('no narrative for ' + pick.a);
        const res = MP.execute(S, pid, pick.a, pick);
        if (res.error) flag('execute error ' + pick.a + ': ' + res.error);
        totalActions++;
        checkBounds(S, pid + '/act/' + pick.a);
      }
      const r = MP.endTurn(S);
      if (!r || !Array.isArray(r.aiReports)) flag('endTurn returned junk');
      checkBounds(S, pid + '/turn' + S.turn);
    }
    const sc = MP.scoreCampaign(S);
    if (!isFinite(sc.score) || sc.score < 0 || sc.score > 100) flag(pid + ': bad score ' + sc.score);
    sc.rows.forEach(r => { if (!isFinite(r.value)) flag(pid + ': objective ' + r.id + ' NaN'); });
    scores.push(sc.score);
    endings[S.ending] = (endings[S.ending] || 0) + 1;
  }
  scores.sort((a, b) => a - b);
  stats[pid] = {
    min: scores[0], median: scores[Math.floor(scores.length / 2)], max: scores[scores.length - 1],
    mean: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  };
});

console.log('\n=== campaign score distribution (random play, ' + N + ' runs each) ===');
Object.keys(stats).forEach(k => {
  const s = stats[k];
  console.log(`  ${k.padEnd(3)} min ${String(s.min).padStart(3)}  median ${String(s.median).padStart(3)}  mean ${String(s.mean).padStart(3)}  max ${String(s.max).padStart(3)}`);
});
console.log('\nendings:', endings);
console.log('actions executed:', totalActions, '| turns with no legal action:', unavailable);

// coverage: make sure every action is reachable by someone
const reach = {};
MP.ACTIONS.forEach(A => { reach[A.id] = false; });
MP.playableList.forEach(pid => {
  const S = MP.newState(pid, 12);
  S.powers[pid].pc = 12;
  MP.ACTIONS.forEach(A => {
    const tries = [{}].concat(MP.theaterList.map(t => ({ theater: t })))
      .concat(MP.powerList.filter(x => x !== pid).map(t => ({ target: t })));
    tries.forEach(o => { try { if (MP.forecast(S, pid, A.id, o)) reach[A.id] = true; } catch (e) { flag('reach throw ' + A.id + ': ' + e.message); } });
  });
});
const unreachable = Object.keys(reach).filter(k => !reach[k]);
if (unreachable.length) flag('unreachable actions: ' + unreachable.join(', '));

if (issues.length) {
  console.log('\n!!! ' + issues.length + ' issue(s):');
  issues.slice(0, 40).forEach(i => console.log('  - ' + i));
  process.exit(1);
}
console.log('\nOK — no bound violations, all ' + MP.ACTIONS.length + ' actions reachable.');
