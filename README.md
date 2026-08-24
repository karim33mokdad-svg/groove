groove

## El Niño Watch

`el-nino-watch/index.html` — a live ENSO and weather-impact dashboard.

Open the file in a browser (or serve the folder over HTTP). It is a single
self-contained page: no build step, no dependencies, no API keys, no server.

**Spotlight locations:** Dubai (UAE), Bali (Indonesia), Bangkok (Thailand),
Beirut (Lebanon), Istanbul (Türkiye) and London (UK) — each with the rest of
its country alongside. Any other city can be added to the watch list via
search.

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
  Indonesia and Thailand carry strong signals; Lebanon, Türkiye and the UK
  are labelled weak, because they are.
- A live watch strip: heat, heavy rain, damaging wind and large anomalies
  across everything being tracked.

**Four tabs**

- **Overview** — the ENSO state, spotlight cards and per-location detail.
- **Crisis watch** — observed fires, floods, storms and droughts from NASA
  EONET and ReliefWeb, split into events near your locations (within
  1,200 km) and the wider ENSO-sensitive world. These are observed events,
  not attributions: ENSO shifts the seasonal odds of these event types, it
  does not cause any individual one, and neither feed claims otherwise.
- **Synthesis** — each city summed up in plain language first: what is
  happening, what to watch, and whether it is getting better or worse. The
  0–100 drought, flood, heat, fire and disruption indices and every
  contributing term are still there under *Show the numbers*, so the
  reasoning can be checked rather than taken on trust. The ENSO term is
  scaled by each region's teleconnection strength *and* its confidence, so
  weak-signal regions get a near-zero ENSO push by construction rather than
  by disclaimer.

**Momentum and measured accuracy**

Momentum comes from the last three weeks of *observed* weather, refetched on
every load — so a city added a minute ago has real momentum immediately,
rather than waiting for this browser to accumulate a record.

Accuracy is measured, not asserted. Every forecast is written down, and once
the day passes it is scored against what actually happened: temperature error,
whether the wet/dry call was right, and a running signed bias. A fresh browser
honestly reports "no track record yet" instead of inventing a number. Once
there are at least eight verified days, the learned warm/cool bias is
subtracted from the model's temperature input and the correction is stated on
screen.

Any city can be searched and promoted to a main city — it is calibrated
against its own 2010–2024 normals and observed history on the spot, so it is
valid immediately rather than showing placeholders.
- **News & alerts** — two panes. *Your alerts* are raised from the dashboard's
  own data (thresholds crossed, momentum shifts, criteria firing, events near
  a tracked city) and carry an unread state that persists per device, with an
  unread count on the tab. Optional desktop notifications for high-severity
  items while the page is open — a static page cannot wake a closed device,
  and the toggle says so rather than implying otherwise. *Weather news* pulls
  headlines from GDELT (three queries: El Niño, your cities plus a hazard
  term, and general climate hazards) and ReliefWeb situation reports, deduped
  by URL and filterable. Listed as published — not verified here, and a
  headline is not a forecast.
- **Map** — a Pacific-centred world map of the variables that actually drive
  El Niño: live sea-surface temperature sampled across the tropical Indian and
  Pacific oceans, the 28 °C warm pool outlined (its eastward reach along the
  equator is the classic signature of a warm event), the Niño 3.4 box, your
  cities coloured by risk, and live fire and flood events plotted where they
  are happening. Tap any ocean cell for its temperature, any event for its
  name, any city to open it. The coastline is a simplified Natural Earth
  outline baked into the page, so the map needs no tile server and no library.
- **What if?** — pick a scenario (today's real conditions, strong El Niño,
  strong La Niña, neutral) or move a single El Niño strength dial, and get a
  plain-language answer: which city would be hardest hit, what the problem
  would be, and which of your alerts would fire. The individual condition
  sliders are still there under *Adjust the individual conditions* for anyone
  who wants them. Alerts are evaluated against both the scenario and live
  conditions right now, and persist in the browser.

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

JARVIS is a grounded rules engine, not a language model. It can only say
things it derives from the live data or from explanations written into the
page on purpose — so it will not bluff, and it will not improvise beyond that.
Within those limits it can:

- **Explain** any term or number: `what is the drought index`, `what does ONI
  mean`, `how does the risk model work`.
- **Reason** from the real computed values: `why is disruption high in
  Bangkok` decomposes the actual model terms in order of contribution, naming
  the underlying figures. Asking why about a composite index recurses into
  whichever hazard is really driving it.
- **Remember context.** Ask "how bad is Bali?", then just "why?", then "what
  about Beirut?", then "what should I do there?" — the subject carries across
  turns and switches when you name a new one. A fragment it does not
  understand is *not* silently treated as a follow-up about the last place.
- **Compare**: `compare Bali and Thailand`, including reporting honestly when
  two places are effectively level rather than inventing a winner.
- **Advise**: `what should I do` — the top live hazard plus that region's
  written playbook and confidence level.
- **Navigate**: naming a place selects it, switches to the right tab, scrolls
  it into view and flashes the section.

The reactor also detaches: scroll past the hero and a floating orb follows you,
opening a console with the full transcript, the mic toggle and a command line.

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
