# How AI was used in this project

This is a running log. Every AI tool that produces something adds a dated line here.

## Log

- 2026-11-14: Claude (Fable 5.2, Anthropic) researched data sources and wrote the project plan with the team. It verified URLs, layer IDs, coordinates and numbers against NASA and USGS pages; items it could not verify are marked UNVERIFIED in docs/SPEC.md.
- 2026-11-14: Claude (Fable 5.2) wrote the seed files in this repo: CLAUDE.md, docs/SPEC.md, data/config.json, data/stops.json, data/images.json, data/spe_scenario.json, the placeholder index.html, CREDITS.md and this file.
- 2026-11-14: Claude (Fable 5.2) wrote the short Google Colab snippet used to cut the elevation crop (data/raw/gale_dem_crop.tif) from the USGS Gale DEM.

- 2026-11-14: Claude (Fable 5.2) wrote the base map (task T3): index.html, css/style.css, js/config.js and js/app.js. Leaflet map on the Mars Trek tile grid with five NASA base layers, stop markers, scale bar, north arrow, lat/lon readout and the empty four-tab panel.

## What the humans do

The team chose the challenge, the site and the science stops, runs the data pipeline, checks numbers against their NASA sources, chooses the photographs and records the demo.

## Images, video, audio

No AI-generated images, video or audio are used. All images are NASA photographs or maps drawn from NASA data.
