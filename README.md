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

Data comes from the [Open-Meteo](https://open-meteo.com/) forecast, marine
and ERA5 archive APIs. The watch list and the cached climate normals are
stored in the browser only.
