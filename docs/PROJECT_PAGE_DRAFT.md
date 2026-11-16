# WALKBACK: project page draft (Space Apps 2026)

Ready to paste into the Space Apps project page. Every number below is copied from `data/stats.json` (generated 2026-11-14T22:35:30Z) or `docs/SPEC.md`. If the data is regenerated, re-check every number against `data/stats.json` before submitting.

Items marked **TEAM** need a human decision before pasting.

## Before you press Submit

1. Log in at https://www.spaceappschallenge.org, open team **Astrophoenix**, and create or edit the project.
2. Copy each section below into the box with the same name. If the form has a box that is not here, ask for the text.
3. Upload the demo video to YouTube as **Unlisted**, add `WALKBACK_subtitles.srt` under Subtitles (English subtitles are required), and paste the link into **Link to Project Demo**. Check it plays in a private browser window.
4. Fill every **TEAM** item, then save as a draft and read the whole page once before submitting.
5. After submitting: create a GitHub release named `v1`, and do not change the live site after the deadline.

---

## Team

Astrophoenix

## Project Name

WALKBACK

## High-Level Project Summary

The first astronauts on Mars will be 4 to 24 minutes from help by radio, on ground no one has walked. Existing Mars maps show regions; a crew needs the next 30 metres. WALKBACK plans one real Marswalk at the Mount Sharp boxwork ridges, where NASA's Curiosity rover drilled in 2025. It layers six kinds of NASA data on a 1 km site, computes the fastest safe walking route through five science stops, and checks it against NASA's published spacesuit limits. Its signature layer shows, for every point on the map, how many minutes the crew is from shelter. The plan is 1.80 km and 3 h 26 min long, never steeper than 19.3°, and never more than 34.1 minutes from the rover. On Mars the map has to carry the judgment that Mission Control carried on the Moon.

## Link to Project Demo

**TEAM:** paste the unlisted YouTube link once the video is uploaded (one link only).

## Link to Final Project

https://haarshaths-maker.github.io/walkback/ (code: https://github.com/haarshaths-maker/walkback)

## Detailed Project Description

**What it does.** WALKBACK is a web map for planning and carrying out a surface excursion at one place on Mars: the boxwork ridges on Mount Sharp in Gale Crater. A crew parks a pressurised rover at the edge of the ridge field, walks a loop through five science stops, and returns. The tool shows the route, the terrain, the conditions, and a pass or fail result for each safety limit.

**How it works.** We cut a 1.07 × 1.36 km window from the USGS 1-metre elevation model of Gale Crater and computed the slope of every square metre. Cells steeper than 20°, the walking limit NASA publishes for its exploration spacesuit, are closed. Walking speed on open ground follows Tobler's hiking function scaled to NASA's 2 km/h planning rate; this is an assumption and is labelled as one. A least-cost path solver finds the fastest safe line between stops. Running the same solver outward from the rover gives our key layer: minutes to shelter from every point.

**The data, layered.** Optical images from HiRISE and CTX; elevation and slope; THEMIS thermal images for context; radiation dose rates measured by Curiosity's RAD in Gale Crater; daily temperature, pressure, UV and sunrise times from Curiosity's REMS on the sols it spent here; and the minerals Curiosity's drill found, clay in a ridge and carbonate in a hollow, pinned to the stops with NASA rover photographs.

**How a crew uses it.** In the habitat: the Plan view, with distance (1.80 km), time (3 h 26 min, including 140 min of science), climb (80.5 m), dose (0.089 mSv) and five checks, all passing. On the walk: a helmet view with six numbers, the largest being minutes to shelter. If a solar storm is called, the storm drill, which replays the event Curiosity measured on 20 May 2024, shows the way back and the time it takes. A one-page cuff card prints for the suit sleeve.

**Checks against reality.** We laid Curiosity's actual path across the site over our slope map: 93.5% of it lies on ground under 20°, with a median slope of 11.6°. The few readings above 20° (the steepest is 51.9°) occur where the mapped rover path passes within about a metre of a ridge wall; rover positions and the elevation model are each accurate to roughly a metre. We also re-downloaded NASA's source files and confirmed that every stop position matches Curiosity's waypoint file exactly, that the rover was parked at our three drill stops on the days it drilled, and that all 318 sols of our weather replay match the REMS feed; the app lists these checks in its Sources tab.

**Benefits.** The method follows the steps NASA's Artemis teams use to plan Moonwalks, applied to Mars with data from the site itself. To our knowledge it is the first public tool to map minutes-to-shelter on a metre-scale Mars elevation model at a rover-verified site; least-cost traverse planning itself builds on earlier work such as MIT's SEXTANT. The same engine works for any place with an elevation model, including search-and-rescue and wildfire routes on Earth.

**Limits.** See the Assumptions and Limitations paragraph below; they are also listed inside the app.

**Tools.** Python (rasterio, NumPy, SciPy, scikit-image, Matplotlib, Pillow) and Google Colab for data; HTML, CSS, JavaScript and Leaflet for the site; GitHub Pages for hosting.

## NASA Data

- Mars Reconnaissance Orbiter HiRISE and CTX mosaics of Gale Crater, served by JPL's Mars Trek: base imagery.
- USGS/NASA PDS Annex "MSL Gale Merged DEM, 1 m" (Calef and Parker, 2016): slope, route and minutes-to-shelter.
- Mars Odyssey THEMIS day and night infrared mosaics (Mars Trek): thermal context.
- Curiosity RAD (Hassler et al., 2014; NASA/JPL 2024 solar storm report): dose rate and storm scenario.
- Curiosity REMS weather feed: temperature, pressure, UV, sunrise and sunset for sols 4534–4860.
- Curiosity traverse and waypoint files (JPL MMGIS): stop positions and the ground-truth check.
- NASA rover image releases, Curiosity's raw image archive and the mission blog: a photo taken at every stop, and the drill results.
- NASA Technical Reports on the xEVA suit and Artemis EVA planning: the limits our checks enforce.

## Space Agency Partner & Other Data

- ESA Mars Express HRSC (ESA/DLR/FU Berlin): part of the global colour hillshade layer.
- REMS was contributed to Curiosity by Spain's Centro de Astrobiología (CSIC-INTA).
- Tobler's hiking function (Tobler, 1993) for walking speed.
- Open-source software: Leaflet, rasterio, GDAL, NumPy, SciPy, scikit-image, Matplotlib, Pillow.
- **TEAM:** add the music track and its source here if the video uses one.

## Use of Artificial Intelligence

We used AI coding assistants (Claude and Claude Code, by Anthropic) to help write the code and documentation, to help find and check data sources, and to capture the silent screen recording of our real site used in the demo video. The team directed the project, ran the data notebook, tested every feature, checked the numbers against their NASA sources, and recorded the voiceover. No AI-generated images, video or audio are used: every picture is a NASA photograph, a NASA map tile or a screen capture of our site. No NASA logos or mission emblems are used.

**TEAM:** if you use ChatGPT (or any other AI) to shorten this page, add one sentence naming it and what it did. Edit the "team" sentence if any part of it is not true.

## Assumptions and Limitations

WALKBACK is a planning aid built in one weekend, not flight software. Walking speed comes from an Earth hiking model scaled to a NASA planning rate and has not been validated for a suited person in Mars gravity. The 20° slope and 2 km range limits come from NASA's lunar spacesuit documents; we apply them to Mars as the best published values. Our elevation data has 1-metre pixels, so rocks smaller than about 1–2 metres and patches of loose sand are invisible to it. Stop positions are where the rover parked, within about 2 metres of each target. The radiation figure is an average from 2012–13 and real dose rates change with the solar cycle. Weather is a replay of what Curiosity measured here, not a forecast. Thermal images are 100 metres per pixel and serve as context only. Time spent at each stop is our own estimate.

## Future Work

Next we would test the speed model against suited walking data in simulated Mars gravity and add a metabolic cost model with suit mass. We would connect a live space-weather feed and a Mars-side radiation monitor so the storm drill becomes a real alert. We would add rock-abundance maps and rover-derived terrain classes so the route avoids hazards the elevation model cannot see, and add lighting and line-of-sight to the rover. The helmet view could move to real augmented-reality hardware. Because the site is defined by a few configuration and data files, the same tool can be pointed at Jezero, at a lunar south-pole site, or at a mountain on Earth.

## References

1. Calef III, F.J. and Parker, T. (2016). MSL Gale Merged DEM 1 m v3. PDS Annex, USGS. https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m
2. Calef III, F.J. and Parker, T. (2016). MSL Gale Merged Orthophoto Mosaic. PDS Annex, USGS. https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm
3. NASA/JPL-Caltech. Mars Trek and WMTS layer services. https://trek.nasa.gov/mars/
4. NASA/JPL-Caltech. MSL waypoints and traverse (MMGIS). https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json
5. NASA/JPL-Caltech/CAB (CSIC-INTA). Curiosity REMS weather feed. https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json
6. Hassler, D.M. et al. (2014). Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover. Science 343, 1244797. https://doi.org/10.1126/science.1244797
7. NASA/JPL (10 June 2024). NASA Watches Mars Light Up During Epic Solar Storm. https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm
8. NASA (23 Feb 2026). NASA's Curiosity Rover Sees Martian "Spiderwebs" Up Close. https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/NASAs-curiosity-rover-sees-martian-spiderwebs-up-close/
9. NASA/JPL (June 2025). NASA's Curiosity Mars Rover Starts Unpacking Boxwork Formations. https://www.nasa.gov/?p=879744
10. NASA Science. Curiosity Blog, Sols 4689–4694; 4709–4715; 4716–4722; 4804–4811. Links in CREDITS.md.
11. Coan, D. NASA Exploration EVA Integrated HITL Testing and Analogs. NTRS 20210000827. https://ntrs.nasa.gov/citations/20210000827
12. NASA. Exploration EVA System Concept of Operations Summary, EVA-EXP-0075. https://www.nasa.gov/wp-content/uploads/2020/01/topic_1-_eva_lunar_surface_concept_of_operations.pdf
13. Scoville et al. Artemis III EVA study slides. NTRS 20210026296. https://ntrs.nasa.gov/api/citations/20210026296/downloads/Scoville%20Final%20presentation%20-%20compressed.pptx.pdf
14. Vos, J.R., Gernhardt, M.L. and Lee, L. (2007). The Walkback Test. ICES 2007-01-3133. https://core.ac.uk/works/15254764
15. NASA. Planning Lunar EVAs. NTRS 20250006988. https://ntrs.nasa.gov/api/citations/20250006988/downloads/ASCEND%20presentation%20-%20Planning%20Lunar%20EVAs.pdf
16. Bussey, B. and Hoffman, S. Human Mars Landing Site and Impacts on Mars Surface Operations. NTRS 20150019636. https://ntrs.nasa.gov/citations/20150019636
17. NASA. Space Communications: 7 Things You Need to Know. https://www.nasa.gov/solar-system/space-communications-7-things-you-need-to-know/
18. Johnson, A. et al. (2010). An Integrated Traverse Planner and Analysis Tool for Planetary Exploration (SEXTANT). https://dspace.mit.edu/handle/1721.1/81322?show=full
19. Tobler, W. (1993). Three Presentations on Geographical Analysis and Modeling. NCGIA Technical Report 93-1.
20. Images: the NASA images listed in CREDITS.md, each with its credit line (NASA/JPL-Caltech; NASA/JPL-Caltech/MSSS).
21. Software: Leaflet 1.9.4; rasterio; GDAL; NumPy; SciPy; scikit-image; Matplotlib; Pillow; requests; Google Colab; GitHub Pages.
22. AI tools: Claude and Claude Code (Anthropic). **TEAM:** add ChatGPT (OpenAI) if used.

The titles of items 13 and 16 were taken from search results and slide text; open each link once and correct the title if it differs.

---

## Numbers used above, and where they come from

| Number on the page | Value | Field in data/stats.json |
| --- | --- | --- |
| Route length | 1.80 km | total_distance_m = 1798.2 |
| EVA time | 3 h 26 min | eva_time_min = 206.3 |
| Science time | 140 min | science_time_min = 140 |
| Steepest slope on the route | 19.3° | max_slope_on_route_deg = 19.3 |
| Longest walk back to shelter | 34.1 min | max_time_to_haven_min = 34.1 |
| Climb | 80.5 m | ascent_m = 80.5 |
| Cosmic-ray dose for the EVA | 0.089 mSv | gcr_dose_msv = 0.089 |
| Rover path under 20° | 93.5% | rover_check.pct_rover_path_under_20deg = 93.5 |
| Rover path median slope | 11.6° | rover_check.median_slope_on_rover_path_deg = 11.6 |
| Rover path steepest reading | 51.9° | rover_check.max_slope_on_rover_path_deg = 51.9 |
| Checks passing | 5 of 5 | checks[].pass |
