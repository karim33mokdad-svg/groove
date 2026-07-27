/* MULTIPOLAR — engine/sim.js
 * The outcome simulator.
 *
 * The game gives you one draw from the distribution. This runs the board
 * forward hundreds of times and shows you the distribution itself: where the
 * escalation ladder ends up, what the oil price does, how often the campaign
 * ends badly — and, when you are testing a decision, how the world differs
 * with and without it.
 *
 * Two things make the comparison meaningful rather than decorative:
 *
 *   1. Common random numbers. Both branches are re-seeded to the same value
 *      after the decision is applied, so the treated and untreated worlds face
 *      the same sequence of draws. What differs between them is the decision,
 *      not the dice. Results are reported as PAIRED differences.
 *
 *   2. An AI search budget. Exhaustive option search costs ~2,700 forecast
 *      evaluations per quarter, which no phone will do 600 times. Under a
 *      budget each capital scores a random subset; the sampled choice tracks
 *      the exhaustive one closely because the score distribution is heavily
 *      top-weighted. This is an approximation and the UI says so.
 *
 * Runs in chunks off the event loop so the interface stays responsive.
 */
(function (MP) {
  'use strict';

  const clamp = MP.clamp;

  function lean(S) {
    /* the log is the biggest thing in the state and no dynamics read it */
    const copy = {};
    Object.keys(S).forEach(k => {
      if (k === 'log' || k === 'feed' || k === 'history' || k === 'quarterOf') return;
      copy[k] = S[k];
    });
    const c = JSON.parse(JSON.stringify(copy));
    c.log = []; c.feed = []; c.history = [];
    c.quarterOf = S.quarterOf;
    return c;
  }

  function stats(a) {
    if (!a.length) return { p10: 0, p50: 0, p90: 0, mean: 0, min: 0, max: 0 };
    const s = a.slice().sort((x, y) => x - y);
    const q = p => s[clamp(Math.floor(p * (s.length - 1)), 0, s.length - 1)];
    return {
      p10: q(0.1), p50: q(0.5), p90: q(0.9), min: s[0], max: s[s.length - 1],
      mean: a.reduce((x, y) => x + y, 0) / a.length
    };
  }

  /* One trial: apply the decision (if any), re-seed, run the horizon. */
  function trial(base, seed, decision, horizon, budget) {
    MP.srand(seed);
    const S = lean(base);
    S.__aiBudget = budget;
    S.maxTurns = Math.max(S.maxTurns, S.turn + horizon);
    let applied = true;
    if (decision) {
      const r = MP.execute(S, S.player, decision.a, decision);
      applied = !r.error;
    }
    /* common random numbers: the horizon sees the same stream either way */
    MP.srand(seed);
    for (let q = 0; q < horizon && !S.over; q++) MP.endTurn(S);
    return { S, applied };
  }

  function measure(S, base) {
    const ps = S.powers[S.player];
    const m = {
      score: MP.scoreCampaign(S).score,
      oil: S.g.oil, trade: S.g.trade, nuclearRisk: S.g.nuclearRisk,
      econ: ps.econ, approval: ps.approval, cohesion: ps.cohesion,
      legit: ps.legit, pressure: ps.pressure,
      nuclearUsed: S.ending === 'nuclear' ? 1 : 0,
      govFell: S.ending === 'collapse' ? 1 : 0,
      majorWar: 0,
      th: {}
    };
    MP.theaterList.forEach(t => {
      const T = MP.THEATERS[t], st = S.theaters[t], side = MP.sideOf(T, S.player);
      const standing = side === 'B' ? 100 - st.control : st.control;
      m.th[t] = {
        rung: st.rung, tension: st.tension, standing,
        up: st.rung > base.theaters[t].rung ? 1 : 0,
        down: st.rung < base.theaters[t].rung ? 1 : 0,
        war: st.rung >= 7 ? 1 : 0
      };
      if (st.rung >= 7) m.majorWar = 1;
    });
    return m;
  }

  const NUMERIC = ['score', 'oil', 'trade', 'nuclearRisk', 'econ', 'approval', 'cohesion', 'legit', 'pressure'];
  const RATES = ['nuclearUsed', 'govFell', 'majorWar'];

  function summarise(runs) {
    const out = { n: runs.length, dist: {}, rate: {}, th: {} };
    NUMERIC.forEach(k => { out.dist[k] = stats(runs.map(r => r[k])); });
    RATES.forEach(k => { out.rate[k] = runs.reduce((s, r) => s + r[k], 0) / runs.length; });
    MP.theaterList.forEach(t => {
      out.th[t] = {
        rung: stats(runs.map(r => r.th[t].rung)),
        tension: stats(runs.map(r => r.th[t].tension)),
        standing: stats(runs.map(r => r.th[t].standing)),
        pUp: runs.reduce((s, r) => s + r.th[t].up, 0) / runs.length,
        pDown: runs.reduce((s, r) => s + r.th[t].down, 0) / runs.length,
        pWar: runs.reduce((s, r) => s + r.th[t].war, 0) / runs.length
      };
    });
    return out;
  }

  /* Paired comparison. Because both branches ran on the same seeds, the
     difference can be taken trial by trial — which is far more informative
     than comparing two medians drawn from independent noise. */
  const LABELS = {
    score: ['Campaign score', 1], oil: ['Oil price', -1], trade: ['Global trade', 1],
    nuclearRisk: ['Nuclear risk', -1], econ: ['Your economy', 1], approval: ['Your approval', 1],
    cohesion: ['Alliance cohesion', 1], legit: ['Your legitimacy', 1], pressure: ['Pressure on you', -1]
  };

  /* Only a substantial net exporter actually wants a higher oil price. A
     marginal one (the US at +0.04) pays for it politically at the pump. */
  const wantsHighOil = id => MP.POWERS[id].oilBeta > 0.2;

  function compare(treated, control, playerId) {
    const rows = [];
    const oilUp = wantsHighOil(playerId);
    NUMERIC.forEach(k => {
      const diffs = treated.map((t, i) => t[k] - control[i][k]);
      const st = stats(diffs);
      const dir = k === 'oil' ? (oilUp ? 1 : -1) : LABELS[k][1];
      const better = diffs.filter(d => dir * d > 0).length;
      const same = diffs.filter(d => Math.abs(d) < 0.05).length;
      rows.push({
        key: k, label: LABELS[k][0],
        median: st.p50, p10: st.p10, p90: st.p90,
        pBetter: (better + same * 0.5) / diffs.length,
        goodIfUp: dir > 0
      });
    });
    const rateRows = RATES.map(k => ({
      key: k,
      label: { nuclearUsed: 'Nuclear use', govFell: 'Your government falls', majorWar: 'A theatre reaches major war' }[k],
      treated: treated.reduce((s, r) => s + r[k], 0) / treated.length,
      control: control.reduce((s, r) => s + r[k], 0) / control.length
    }));
    const thRows = MP.theaterList.map(t => {
      const d = treated.map((x, i) => x.th[t].rung - control[i].th[t].rung);
      const s = treated.map((x, i) => x.th[t].standing - control[i].th[t].standing);
      return {
        id: t, name: MP.THEATERS[t].name,
        rungDelta: stats(d).p50, rungMean: stats(d).mean,
        standingDelta: stats(s).p50,
        pWorse: d.filter(x => x > 0).length / d.length,
        pBetter: d.filter(x => x < 0).length / d.length
      };
    }).filter(r => Math.abs(r.rungMean) > 0.02 || Math.abs(r.standingDelta) > 0.3);
    return { rows, rateRows, thRows };
  }

  /* Public entry point. Chunked so a 300-trial run does not freeze a phone. */
  function project(S, opts, onProgress, onDone) {
    opts = opts || {};
    const trials = opts.trials || 120;
    const horizon = opts.horizon || 4;
    const budget = opts.budget || 30;
    const decision = opts.decision || null;
    const seed0 = opts.seed || ((Date.now() & 0x7fffffff) >>> 0);
    const base = lean(S);

    const control = [], treated = [];
    let i = 0, unavailable = 0;
    const chunk = decision ? 4 : 8;

    function step() {
      const until = Math.min(i + chunk, trials);
      for (; i < until; i++) {
        const seed = (seed0 + i * 2654435761) >>> 0;
        control.push(measure(trial(base, seed, null, horizon, budget).S, base));
        if (decision) {
          const t = trial(base, seed, decision, horizon, budget);
          if (!t.applied) unavailable++;
          treated.push(measure(t.S, base));
        }
      }
      if (onProgress) onProgress(i / trials);
      if (i < trials) { setTimeout(step, 0); return; }

      const result = {
        trials, horizon, budget, seed: seed0, unavailable,
        control: summarise(control),
        treated: decision ? summarise(treated) : null,
        compare: decision ? compare(treated, control, S.player) : null,
        baseline: {
          rungs: MP.theaterList.reduce((o, t) => (o[t] = S.theaters[t].rung, o), {}),
          oil: S.g.oil, trade: S.g.trade, nuclearRisk: S.g.nuclearRisk,
          score: MP.scoreCampaign(S).score,
          econ: S.powers[S.player].econ, approval: S.powers[S.player].approval
        }
      };
      /* restore an unpredictable stream for normal play */
      MP.srand((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
      onDone(result);
    }
    setTimeout(step, 0);
  }

  MP.sim = { project, stats, lean };
})(typeof self !== 'undefined' ? (self.MP = self.MP || {}) : (this.MP = this.MP || {}));
