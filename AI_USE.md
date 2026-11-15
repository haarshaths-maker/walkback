# How AI was used in this project

This is a running log. Every AI tool that produces something adds a dated line here.

## Log

- 2026-11-14: Claude (Fable 5.2, Anthropic) researched data sources and wrote the project plan with the team. It verified URLs, layer IDs, coordinates and numbers against NASA and USGS pages; items it could not verify are marked UNVERIFIED in docs/SPEC.md.
- 2026-11-14: Claude (Fable 5.2) wrote the seed files in this repo: CLAUDE.md, docs/SPEC.md, data/config.json, data/stops.json, data/images.json, data/spe_scenario.json, the placeholder index.html, CREDITS.md and this file.
- 2026-11-14: Claude (Fable 5.2) wrote the short Google Colab snippet used to cut the elevation crop (data/raw/gale_dem_crop.tif) from the USGS Gale DEM.

- 2026-11-14: Claude (Fable 5.2) wrote the base map (task T3): index.html, css/style.css, js/config.js and js/app.js. Leaflet map on the Mars Trek tile grid with five NASA base layers, stop markers, scale bar, north arrow, lat/lon readout and the empty four-tab panel.

- 2026-11-14: Claude Code (Opus 5.5) wrote notebooks/fetch_data.ipynb, which cuts the elevation and colour-image crops and downloads Curiosity's waypoint, traverse and weather files.

- 2026-11-14: Claude Code (Opus 5.5) wrote notebooks/pipeline.py (slope, no-go mask, least-time route, minutes-to-shelter, profile, rover ground-truth check, weather filter, stats and checks), js/plan.js (overlays, legend, route, Curiosity path, Plan tab, elevation profile) and data/sources.json.

- 2026-11-14: Claude Code (Opus 5.5) ran notebooks/pipeline.py on the raw crop the team fetched in Colab and generated every file in /data (route, overlays, profile, stats, weather, Curiosity path). The team supplied the raw data.

- 2026-11-14: Claude Code (Opus 5.5) wrote js/stops.js (Stops tab with stop cards, arrival times, photo viewer, marker-to-card links; Sources tab with limit citations, data credits, limitations and AI note), added the T10 styles to css/style.css, added remote_url photo links to data/images.json, and made Curiosity's path a solid cyan line in js/plan.js.

- 2026-11-14: Claude Code (Opus 5.5) wrote js/conditions.js (Conditions tab: REMS weather replay with sol picker, EVA daylight window with a 24-hour bar, radiation card, solar storm drill with alert banner, crew-position slider, minutes to shelter and the nearest stop's escape path, DONKI link) and added the T13 styles to css/style.css.

- 2026-11-14: Claude Code (Opus 5.5) wrote js/hud.js (helmet HUD: full-screen visor view with six readouts, north-up mini-map, and a walk simulator at 60x walking speed with science-stop pauses, sharing the crew position with the storm drill), added the HUD button to index.html and the T14 styles to css/style.css.

- 2026-11-15: Claude Code (Opus 5.5) did task T15: phone layout (map on top, panel as a bottom sheet with a bottom tab bar, 44 px tap targets, HUD grid for portrait and landscape), accessibility (focus rings, legend and north-arrow labels, reduced-motion support in js/app.js and js/stops.js), and the printable cuff card (js/cuff.js plus print rules in css/style.css).

## What the humans do

The team chose the challenge, the site and the science stops, runs the data pipeline, checks numbers against their NASA sources, chooses the photographs and records the demo.

## Images, video, audio

No AI-generated images, video or audio are used. All images are NASA photographs or maps drawn from NASA data.
