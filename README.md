groove

## El Niño Watch

`el-nino-watch/index.html` — a live ENSO and weather-impact dashboard.

Open the file in a browser (or serve the folder over HTTP). It is a single
self-contained page: no build step, no dependencies, no API keys, no server.

**Spotlight locations:** Dubai (UAE), Bali (Indonesia), Bangkok (Thailand),
Beirut (Lebanon) and Istanbul (Türkiye) — each with the rest of its country
alongside. Any other city can be added to the watch list via search.

**What it shows**

- Current ENSO phase from a live Niño 3.4 sea-surface temperature estimate,
  with a 60-day anomaly trend. The official NOAA CPC ONI can be pinned
  manually and takes precedence over the estimate when set.
- Live conditions and a 7-day forecast per location.
- How far each location is from its own 2010–2024 normal, for both
  temperature and rainfall — this is what makes "abnormal" quantitative
  rather than a feeling.
- An El Niño lens per region: what the current phase typically means there,
  with an explicit confidence level, plus the operational implications.
  Indonesia and Thailand carry strong signals; Lebanon and Türkiye are
  labelled weak, because they are.
- A live watch strip: heat, heavy rain, damaging wind and large anomalies
  across everything being tracked.

**Four tabs**

- **Overview** — the ENSO state, spotlight cards and per-location detail.
- **Crisis watch** — observed fires, floods, storms and droughts from NASA
  EONET and ReliefWeb, split into events near your locations (within
  1,200 km) and the wider ENSO-sensitive world. These are observed events,
  not attributions: ENSO shifts the seasonal odds of these event types, it
  does not cause any individual one, and neither feed claims otherwise.
- **Synthesis** — live variables combined into 0–100 drought, flood, heat,
  fire and disruption indices, plus a 7-day disruption trajectory. Every
  contributing term is printed with its value, so the number can be argued
  with. The ENSO term is scaled by each region's teleconnection strength
  *and* its confidence, so weak-signal regions get a near-zero ENSO push by
  construction rather than by disclaimer.
- **Simulator** — set ONI, rainfall, temperature anomaly, humidity, wind,
  peak rain and horizon, and see the indices recompute for every region.
  Define criteria ("ONI at or above 1.0 AND rainfall at or below 70% of
  normal") and each is evaluated against both the simulated values and live
  conditions right now. Criteria persist in the browser.

The risk model is a transparent heuristic, not a validated forecast model.
It is built for comparing scenarios, not for predicting outcomes.

**JARVIS voice interface**

The dashboard is skinned as a Stark-style HUD — cyan on black, corner-bracketed
panels, monospace technical type — with an arc reactor at the top that is a
working voice command interface, not decoration.

Tap the core to grant mic access. The ring is driven by a real Web Audio
analyser on the live microphone signal, so it reacts to your actual voice; with
no mic it idles on a slow standing wave instead of faking activity.

Speech recognition uses the Web Speech API (Chrome, Edge and Safari — Firefox
does not ship it). Every command also works from the typed command line, which
is the fallback whenever the mic is blocked or recognition is unavailable, and
the HUD says which of those happened rather than silently doing nothing.

Commands include: `status`, `alerts`, `crisis`, `help`; `show Bali`,
`risk in Thailand`, `weather in Dubai`; `open synthesis` / `simulator` /
`overview`; `simulate strong El Niño`, `set El Niño to 2.5`,
`rainfall to 40 percent`; `celsius` / `fahrenheit`; `refresh`; `mute`;
`stop listening`. Spoken replies come from the browser's speech synthesis and
can be muted. Every reply is generated from the live computed data — the
briefings read out real anomalies, indices and criteria states.

Data comes from the [Open-Meteo](https://open-meteo.com/) forecast, marine
and ERA5 archive APIs. The watch list and the cached climate normals are
stored in the browser only.
