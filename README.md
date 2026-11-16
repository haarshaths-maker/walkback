# WALKBACK

**Plan the walk out. Know the walk back.**

WALKBACK is a web map that plans one real Marswalk (EVA) at the Mount Sharp boxwork ridges in Gale Crater, Mars, where NASA's Curiosity rover drilled in 2025. WALKBACK layers NASA optical, elevation, thermal, radiation, weather and drill-result data over a 1.07 x 1.36 km site; it automatically computes the fastest safe walking route through five science stops from a parked pressurised rover (the "safe haven"), and checks the plan against published NASA spacesuit limits. Its signature layer shows, for every point on the map, how many minutes the crew is from shelter. We also built a helmet HUD that can simulate a solar storm happening as a drill. Specifically the 20 May 2024 event.

- **Live site:** https://haarshaths-maker.github.io/walkback/
- **Demo video (30 s):** https://youtu.be/mG5vUx7IZhw
- **Challenge:** 2026 NASA Space Apps Challenge, "Interplanetary Survival Guide: Martian Map"
- **Team:** Astrophoenix

Student project. Not affiliated with or endorsed by NASA.

## What is in the app

- **Plan:** the route, minutes to shelter, totals (distance, time, climb, dose), five pass/fail safety checks with sources, a ground-truth check against Curiosity's real path, the legs, an elevation profile, and a printable one-page cuff card.
- **Stops:** one card per stop with a NASA rover photo taken at that stop, the objective, what Curiosity found there, planned science time and arrival time.
- **Conditions:** weather Curiosity measured here (a replay, not a forecast), the EVA daylight window, radiation, and the solar storm drill.
- **Sources:** where every limit comes from, data credits, how we checked the data against NASA's own files, earlier work we built on, and limitations.
- **Welcome screen:** what the project is and how to explore it (reopen it with **About**).
- **Helmet view (HUD):** a full-screen helmet view with six readouts and a walk simulator.

## Run it on your own computer

The site is plain HTML, CSS and JavaScript (Leaflet 1.9.4 from the unpkg CDN). There is no build step. Browsers block data files when you double-click `index.html`, so start a small local web server in the repository folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ in a browser. The map tiles come from NASA's Mars Trek service, so you need an internet connection.

## Rebuild the data

Everything in `/data` was computed once, ahead of time; the website only draws it.

1. Open `notebooks/fetch_data.ipynb` in Google Colab and choose **Runtime > Run all**. It cuts our site out of the USGS 1 m Gale elevation model and downloads Curiosity's waypoints, traverse and REMS weather, then saves them as `walkback_raw.zip`.
2. Unzip it, then run the pipeline from the repository root (needs numpy, scipy, scikit-image, rasterio, matplotlib and Pillow):

   ```bash
   python notebooks/pipeline.py --raw path/to/unzipped/walkback_raw --out data
   ```

3. Check `notebooks/qa_figure.jpg`, then commit the new files in `/data`.

## The model in brief

All values come from `docs/SPEC.md`, the project's single source of truth.

- **Slope:** 3 x 3 smoothing of the 1 m elevation model (ASSUMPTION), then slope in degrees.
- **No-go ground:** slopes over 20 deg (NASA xEVA suit limit), plus a 1 m safety margin (ASSUMPTION).
- **Walking speed:** Tobler's hiking function scaled to NASA's 2 km/h planning rate (ASSUMPTION: not validated for suited walking in Mars gravity).
- **Route:** the least-time path on an 8-connected grid, leg by leg: HAVEN, S1 to S5, back to HAVEN.
- **Minutes to shelter:** least-time walk from every cell back to the haven, treating every slope as uphill (ASSUMPTION, cautious).
- **EVA time:** walking time plus planned science minutes per stop (ASSUMPTION).
- **Dose:** EVA hours x 0.026 mSv/h, from 0.64 mSv per sol at Gale (ASSUMPTION: the 2012-13 average).
- **Daylight window:** sunrise + 2 h to sunset - 2 h (ASSUMPTION).
- **Checks:** steepest slope <= 20 deg; farthest point <= 2 km from the haven; EVA <= 8 h; longest walk back <= 60 min (ASSUMPTION: the suit's 1-hour contingency); EVA fits the daylight window.

## Limitations

- Walking speed is an Earth hiking model scaled to a NASA planning rate; not validated for suited walking in Mars gravity.
- The 20 deg and 2 km limits come from lunar xEVA documents and are applied to Mars as the best published values.
- The elevation model is 1 m per pixel: rocks under about 1 to 2 m and loose sand are not visible. Slope is a proxy for obstacles.
- Stop positions are rover parking positions, within about 2 m of the targets.
- Radiation uses the 2012-13 average dose rate; real rates vary with the solar cycle, season and terrain.
- Weather is a replay of sols Curiosity measured here in 2025-26, not a forecast.
- Thermal imagery is 100 m per pixel: context only.
- Science time per stop is an assumption.
- Student project built in one weekend. Not flight software.

## Credits, AI use and licence

- Data, images, papers and software: [CREDITS.md](CREDITS.md)
- How AI tools were used: [AI_USE.md](AI_USE.md)
- Licence: MIT, see [LICENSE](LICENSE). NASA data and images keep their own credits as listed.
