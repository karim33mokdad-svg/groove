# MULTIPOLAR

A turn-based geopolitical strategy game for mobile. You take a seat at a real
capital, work the real instruments of statecraft across ten live theatres, and
every action shows you a **modelled forecast with its assumptions on screen**
before you commit to it.

No install, no build step, no network. Open `index.html` on a phone (or add it
to the home screen — it is a PWA and runs offline).

---

## What it is

Most "geopolitics games" are either wargames with no politics, or clicker games
with a map. This one models the thing that actually decides outcomes: **the
coupling between instruments.** Sanctions move oil, oil moves domestic approval,
approval moves the political capital that lets you act at all, and every
military option carries a red-line risk you can read before you take it.

**Eight playable capitals** — United States, China, Russia, European Union,
India, Iran, Israel, Türkiye — plus six AI-only regional actors (Japan, Ukraine,
Taiwan, Saudi Arabia, North Korea, Pakistan).

**Ten theatres** — Ukraine, Taiwan Strait, South China Sea, Israel–Iran and the
Levant, Red Sea, Korean Peninsula, Himalayan frontier, Kashmir, the Sahel, and
the High North.

**Thirty instruments** across DIME — diplomatic, informational, military,
economic. Direct talks, UNSC resolutions, ceasefire mediation, coalition
building, security guarantees, cyber operations, influence campaigns,
intelligence sharing, declassification, arms transfers, deployments, exercises,
freedom-of-navigation operations, air defence, convoy escort, limited strikes,
covert action, mobilisation, nuclear signalling, sanctions, secondary sanctions,
export controls, tariffs, energy leverage, aid, investment, swap lines, sanctions
relief — and holding your fire.

**Twelve quarters** (three years). Then you are scored against objectives
specific to your seat.

---

## The forecast is the point

Every action opens a panel with three parts:

1. **Projected effect this quarter** — each delta with an uncertainty band.
2. **Why the model says so** — the actual inputs. Your share of the target's
   trade. Coalition breadth and who joins. Target adaptation from previous
   rounds. Force projection. Interceptor quality. Red-line exposure as a
   percentage. Diminishing returns if you have used this instrument before.
3. **Precedent** — how this class of action has historically performed, including
   when it has not worked.

Then the risks (with probabilities), and only then the commit button. If you
disagree with a forecast, the inputs that produced it are on screen and you can
argue with them. That is deliberate: an opaque forecast teaches nothing.

---

## The outcome simulator

The game gives you one draw from the distribution. The simulator runs the board
forward hundreds of times and shows you the distribution itself.

**Outcome projection** (button on the board) — pick a horizon (1 quarter to 2
years) and a number of runs, and it reports:

- tail risks: probability of nuclear use, of your government falling, of any
  theatre reaching major war
- where the indices land: campaign score, oil, trade, your economy, approval and
  nuclear risk, each as a p10–p90 range with the median and today's value marked
- escalation by theatre: median projected rung with its range, and the
  probability that each theatre climbs, falls, or reaches rung 7+

**Decision simulator** (button on any action's forecast) — runs the same world
twice, once with the decision and once without, and reports the **paired**
difference: "ends ahead in 62% of 120 paired runs, median campaign score +3.1".

Two design decisions make that comparison mean something:

1. **Common random numbers.** The engine never calls `Math.random`; every draw
   goes through a seeded xorshift generator. Both branches are re-seeded to the
   same value *after* the decision is applied, so the treated and untreated
   worlds face the same sequence of draws. The difference between them is the
   decision, not the dice — which is why results are reported as paired
   differences and win rates rather than as two medians pulled from independent
   noise.

2. **A disclosed approximation.** Exhaustive AI option search costs ~2,700
   forecast evaluations per quarter; no phone will do that 600 times. Under a
   search budget each capital scores a random subset of its options. Validated
   against exhaustive search over 60 campaigns, the medians track closely (oil
   $76.6 vs $75.2, campaign score 32 vs 34, identical median rungs), and the UI
   states the approximation with every result.

A 120-run projection takes ~1.9s and a 120-pair comparison ~3.1s on a desktop;
both run chunked off the event loop with a progress bar, so the interface stays
responsive on a phone.

`node test/mc.js` checks that the same seed reproduces the identical
distribution, that a different seed does not, that quantiles are ordered and
in-range, that the comparison detects effects it should (nuclear signalling
raises modelled nuclear risk and costs legitimacy; aid improves the position you
back) and stays quiet on a null decision.

---

## Modelling choices

These are the assumptions the model actually encodes. They are contestable —
they are meant to be.

| Mechanic | Behaviour |
|---|---|
| **Sanctions** | Bite ∝ your share of the target's trade × coalition breadth × (1 − resilience) × (1 − adaptation). Adaptation compounds every quarter under pressure, so the fourth package lands on an economy that has already re-routed. Blowback is symmetric and modelled. |
| **Attrition** | A material edge converts into territory at a heavily sub-linear rate. Defence is favoured. Wars are decided by manpower, budget support and munitions throughput, not by single battles. |
| **Escalation** | A shared 0–10 ladder. Climbed fast, descended slowly. Below rung 6 tension can drift upward on its own; **above rung 6 the ladder moves only by deliberate decision or by crossing a declared red line.** War exhaustion pulls it back down. Every theatre has a structural floor — these disputes do not evaporate. |
| **Red lines** | Every power publishes them. Actions carry an explicit probability of crossing one, shown before you commit. Crossing produces counter-escalation you do not control. |
| **Nuclear risk** | An index driven by rungs in nuclear dyads and by alert signalling; above 55 it becomes a per-quarter hazard roll. Use ends the campaign for everyone and caps the score at 12 — the taboo is modelled as a cliff, not a slope. |
| **Diminishing returns** | Every instrument decays with repeated use in the same place. The second identical security guarantee is worth almost nothing. Memory fades between quarters. |
| **Relationship gravity** | Warmth bought with summits and capital decays back toward structural interests. You cannot summit your way into a permanent alliance. |
| **Domestic politics** | Approval responds to the economy, to war stress and to legitimacy — and approval generates the political capital that funds every action. Foreign policy is downstream of domestic politics. Below 12 approval your government falls and the campaign ends. |
| **Markets** | Oil is a risk premium summed over theatres, weighted by each theatre's exposure and its rung. Trade is a drag term over chokepoint theatres. Both feed back into every economy via its own oil beta. |
| **Randomness** | A seeded xorshift generator, never `Math.random`. Campaigns are reproducible from a seed, and the simulator can run counterfactuals on identical draws. |
| **The AI** | Not scripted. Each capital enumerates its legal moves, scores them against its own interests, doctrinal bias, escalation tolerance and red-line exposure, and picks. It answers aggression, avoids repeating itself, and gambles more when it is losing. |

### Calibration

The objectives are calibrated against a measured baseline. A player who takes no
initiative for twelve quarters scores **36–65 depending on the seat** — the
middle of the range. Reckless play scores below that. A one-ply
objective-aware player scores well above it. Difficulty is a property of the
seat, not a setting: Russia is the hardest position on the board, the United
States has the most instruments and the most commitments to defend.

---

## Running it

```bash
# any static server
python3 -m http.server 8000
# then open http://localhost:8000/ on a phone on the same network
```

The engine has no DOM dependencies, so it can be exercised headlessly:

```bash
node test/sim.js 25   # engine: full campaigns for every seat, bounds and coverage
node test/mc.js       # simulator: reproducibility, calibration, effect detection
```

`sim.js` plays full campaigns for every seat, asserts no state leaves its bounds,
no forecast throws and every action stays reachable, then prints the score
distribution. `mc.js` exercises the Monte Carlo layer.

---

## Layout

```
index.html              screens + script order
css/app.css             all styling
js/data/powers.js       14 actors: capability, doctrine, red lines, objectives
js/data/theaters.js     10 theatres: position, drivers, ceilings, floors
js/data/actions.js      30 instruments, each with its own forecast model
js/data/events.js       state-weighted world events
js/engine/core.js       state, escalation ladder, red-line probability, nuclear risk
js/engine/resolve.js    forecast → variance → apply, diminishing returns
js/engine/ai.js         per-capital utility maximiser
js/engine/turn.js       attrition, markets, domestic politics, events, scoring
js/ui/map.js            dot-grid situation board
js/ui/ui.js             every screen
js/main.js              save/resume, service worker
sw.js                   offline cache
test/sim.js             headless engine harness
test/mc.js              outcome-simulator harness
```

---

## Honest limits

**This is a simulation, not a prediction.** It cannot tell you what will happen.
It can show you how the pieces are coupled, and — through the simulator — what
this model's assumptions imply about the spread of outcomes and the marginal
effect of a decision. Those are statements about the model, not about the world.
A probability it prints is the frequency of an outcome across runs of these
equations; it is not a forecast, and it inherits every judgement in the
parameters.

Figures — GDP, defence outlays, manpower, warhead counts — are rounded
open-source approximations for a 2025/26 baseline, of the kind published by the
IMF, SIPRI, IISS and FAS. They are tuned for playability and should not be
cited. Theatre descriptions summarise widely-reported public facts as of the
model baseline. Relationship values and capability indices are the author's
judgement expressed as numbers so that they can be argued with.

The model takes no side. Its parameters are symmetric: every power has red
lines, every power's coercion decays, every power's public is modelled the same
way. Where it appears to favour someone, that is the arithmetic of the position,
not an editorial line.

Real conflicts kill real people. This game abstracts a human cost it cannot
represent honestly, and it should not be mistaken for the thing it abstracts.

Not affiliated with, endorsed by, or representing any government or organisation.
