/* MULTIPOLAR — engine/ai.js
 * Other capitals are not scripted. Each one enumerates what it could do,
 * scores every option against its own interests and doctrine, and picks.
 * That is why the board pushes back differently every campaign.
 */
(function (MP) {
  'use strict';

  const clamp = MP.clamp;

  /* How much a given theatre matters to a given power. */
  function theaterWeight(S, id, tId) {
    const T = MP.THEATERS[tId], P = MP.POWERS[id];
    let w = 0.25;
    const side = MP.sideOf(T, id);
    if (T.sideA === id || T.sideB === id) w = 1.6;
    else if (side) w = 0.9;
    /* everyone cares about the theatres that move the oil price and trade */
    w += T.oilImpact * Math.abs(P.oilBeta) * 2.2;
    w += T.tradeImpact * 0.5;
    /* and about the ones that are already burning */
    w *= 0.7 + S.theaters[tId].tension / 150;
    return w;
  }

  /* Utility of a state-change for a specific power. */
  function utility(S, id, fx, thId, targetId) {
    const P = MP.POWERS[id];
    let u = 0;
    const self = fx.self || {};
    u += (self.econ || 0) * 3.0;
    u += (self.approval || 0) * 1.35;
    u += (self.cohesion || 0) * 1.0;
    u += (self.legit || 0) * 0.7;
    u += (self.readiness || 0) * 0.3;
    u += (self.nuclearProgress || 0) * 2.2;
    u += (self.tech || 0) * 1.1;
    u -= (self.pressure || 0) * 1.2;
    u -= (self.warStress || 0) * 0.6;

    if (targetId && fx.tgt) {
      const aff = MP.getAff(S, id, targetId);
      const hostility = clamp(-aff, -1, 1);
      /* Rivalry is relative: a competitor's weakness has some value even when
         relations are formally neutral. Only genuine allies are exempt. */
      const gain = clamp(0.3 + 0.7 * Math.max(0, -aff) - Math.max(0, aff) * 0.75, 0, 1);
      const harm = -((fx.tgt.econ || 0) * 3.0 + (fx.tgt.approval || 0) * 1.2 +
        (fx.tgt.readiness || 0) * 0.8 + (fx.tgt.cohesion || 0) * 0.8) +
        (fx.tgt.pressure || 0) * 1.0;
      u += harm * gain * 1.15;
      /* an adversary moving toward a weapon is priced separately and heavily */
      u -= (fx.tgt.nuclearProgress || 0) * 2.4 * gain;
      /* denying a rival the technological base is a first-order objective */
      u -= (fx.tgt.tech || 0) * 1.8 * gain;
      /* helping a friend is worth something too */
      if (hostility < 0) u += ((fx.tgt.econ || 0) * 2.0) * (-hostility);
    }

    if (thId && fx.th) {
      const T = MP.THEATERS[thId];
      const side = MP.sideOf(T, id);
      const w = theaterWeight(S, id, thId);
      if (side && typeof fx.th.control === 'number') {
        /* position in a theatre is the currency the whole game is played in —
           it has to outweigh the readiness and approval it costs to buy */
        u += (side === 'A' ? fx.th.control : -fx.th.control) * 5.5 * w;
      }
      u += (fx.th.deterrence || 0) * 0.3 * w;
      u += (fx.th.defence || 0) * 0.35 * w;
      /* escalation aversion scales inversely with doctrinal risk tolerance.
         Note the asymmetry: nobody wants the rung they are on, everybody wants
         the position it would buy. That tension is the whole game. */
      const escAv = (1 - P.escTol);
      const st = S.theaters[thId];
      u -= (fx.th.tension || 0) * 1.1 * escAv * w;
      u -= Math.max(0, fx.th.rung || 0) * 24 * escAv * w;
      u += Math.min(0, fx.th.rung || 0) * -14 * w;          /* de-escalation is worth paying for */
      /* climbing gets more dangerous the higher you already are */
      u -= Math.max(0, fx.th.rung || 0) * st.rung * 4.5 * escAv;
      /* but a principal that is losing badly gets more willing to gamble */
      if (side && (MP.THEATERS[thId].sideA === id || MP.THEATERS[thId].sideB === id)) {
        const standing = side === 'A' ? st.control : 100 - st.control;
        if (standing < 42) u += Math.max(0, fx.th.rung || 0) * 7 * (1 - standing / 42);
      }
    }

    if (fx.g) {
      u -= (fx.g.nuclearRisk || 0) * (2.6 + S.g.nuclearRisk / 12) * (1 - P.escTol);
      u += (fx.g.trade || 0) * 0.7 * clamp(P.gdp / 12, 0.2, 1.5);
      u += (fx.g.oil || 0) * P.oilBeta * 2.4;
    }
    return u;
  }

  function candidates(S, id) {
    const out = [];
    const ps = S.powers[id];
    const theaters = MP.theaterList
      .map(t => ({ t, w: theaterWeight(S, id, t) }))
      .sort((a, b) => b.w - a.w).slice(0, 5).map(x => x.t);
    const targets = MP.powerList.filter(x => x !== id).map(x => ({
      x, rel: MP.getAff(S, id, x)
    })).sort((a, b) => a.rel - b.rel);
    const hostile = targets.slice(0, 4).map(t => t.x);
    const friends = targets.slice(-3).map(t => t.x);
    const pool = hostile.concat(friends);

    MP.ACTIONS.forEach(A => {
      if (A.pc > ps.pc) return;
      if (A.scope === 'theater') {
        theaters.forEach(t => out.push({ a: A.id, theater: t }));
      } else if (A.scope === 'power') {
        pool.forEach(t => out.push({ a: A.id, target: t }));
        theaters.slice(0, 2).forEach(t => {
          const opp = MP.opponentOf(MP.THEATERS[t], id);
          if (opp) out.push({ a: A.id, target: opp, theater: t });
        });
      } else {
        out.push({ a: A.id });
      }
    });
    return out;
  }

  function chooseAction(S, id, mood) {
    const P = MP.POWERS[id], ps = S.powers[id];
    const scored = [];
    candidates(S, id).forEach(cand => {
      let f;
      try { f = MP.forecast(S, id, cand.a, cand); } catch (e) { return; }
      if (!f || f.cost > ps.pc) return;
      let score = utility(S, id, f.fx, cand.theater, f.ctx.target);
      /* capitals do read each other's declared thresholds before acting */
      if (f.redlineRisk) {
        const w = cand.theater ? theaterWeight(S, id, cand.theater) : 1;
        score -= f.redlineRisk * 34 * (1 - P.escTol) * w;
      }
      score *= (P.bias[f.action.cat] || 1);
      score -= f.cost * 1.4;
      /* retaliation pressure: answer whoever hit you last turn */
      if (mood.aggressors[f.ctx.target]) score += mood.aggressors[f.ctx.target] * 9;
      /* variety: capitals rarely repeat the identical move twice running */
      const recent = ps.lastActions.filter(x => x === cand.a).length;
      if (recent) score -= 9 * recent;
      scored.push({ score, cand, f });
    });
    if (!scored.length) return null;

    /* Capitals are not identical optimisers. Sample from the best few rather
       than always taking the argmax, so the board does not converge on one
       move every quarter and campaigns diverge from each other. */
    scored.sort((x, y) => y.score - x.score);
    const pool = scored.slice(0, 7);
    const top = pool[0].score, temp = 7;
    const w = pool.map(x => Math.exp((x.score - top) / temp));
    const total = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[0];
  }

  /* Everyone else's turn. */
  function runAI(S, playerId) {
    const reports = [];
    /* who acted against whom last turn */
    const mood = { aggressors: {} };
    S.log.filter(e => e.turn === S.turn - 0).forEach(e => {
      if (e.target) mood.aggressors[e.actor] = (mood.aggressors[e.actor] || 0) + (e.cat === 'MIL' ? 1.2 : 0.6);
    });

    MP.powerList.forEach(id => {
      if (id === playerId) return;
      const ps = S.powers[id];
      const acts = ps.pc >= 9 ? 2 : 1;
      for (let i = 0; i < acts; i++) {
        const pick = chooseAction(S, id, mood);
        if (!pick || pick.score < 1.5) break;
        const res = MP.execute(S, id, pick.cand.a, pick.cand);
        if (res.ok) {
          reports.push({
            actor: id, name: pick.f.action.name, cat: pick.f.action.cat,
            theater: pick.cand.theater || null, target: res.entry.target,
            narrative: pick.f.narrative, redline: res.redline, fired: res.fired
          });
        }
      }
    });
    return reports;
  }

  MP.ai = { runAI, utility, theaterWeight, chooseAction };
})(window.MP = window.MP || {});
