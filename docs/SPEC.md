# WALKBACK SPEC (values verified 14 Nov 2026 unless marked UNVERIFIED)

## 1. Product

WALKBACK is a hyperlocal Marswalk (EVA) planner for the Mount Sharp boxwork unit in Gale Crater, Mars. It layers NASA optical, topographic, thermal, radiation, atmospheric and chemical data over a 1.07 x 1.36 km site, draws a computed least-time walking route through five science stops that starts and ends at a safe haven, and reports distance, time, slope, radiation dose and minutes-to-shelter with pass/fail checks. Views: Plan, Stops, Conditions, Sources, and a helmet HUD.

Tagline: Plan the walk out. Know the walk back.

Users: a two-person crew and their planner in the habitat. Earth is 4 to 24 minutes away by radio, one way.

Built for the 2026 NASA Space Apps Challenge, challenge "Interplanetary Survival Guide: Martian Map". Student project. Not affiliated with or endorsed by NASA.

## 2. Site

Body: Mars. Sphere radius R = 3396190 m. One degree = 59274.7 m (used for both latitude and longitude; true east-west ground distance is 0.35% shorter here; stated as a limitation).

Site bounds in decimal degrees (east-positive longitude): west 137.3740, east 137.3920, south -4.8170, north -4.7940.

## 3. Stops (visiting order; positions are Curiosity rover positions from NASA MSL_waypoints.json)

id | name | role | lon | lat | elev_m | rover_sol | science_min | objective | finding | source_url
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
HAVEN | Rover Park (safe haven) | haven | 137.3864361 | -4.79761763 | null | 4534 | 0 | Pressurised rover parked at the edge of the boxwork unit. Start and end of the EVA. | Curiosity crossed into the boxwork unit on sol 4534 (7 May 2025). | https://gsameetings.secure-platform.com/connects25/solicitations/103002/sessiongallery/schedule/items/95386/application/10634
S1 | Altadena | science | 137.3835414 | -4.79984723 | -3647.2 | 4560 | 20 | Sample bedrock at the edge of the unit as a baseline. | Curiosity drilled "Altadena" at the edge of the boxwork on 8 June 2025. | https://www.nasa.gov/?p=879744
S2 | First ridge | science | 137.3795572 | -4.80443344 | -3631.5 | 4605 | 25 | Examine a ridge crest and its central fracture. | Curiosity confirmed the dark lines along ridge tops are fractures. Pea-size nodules sit on ridge walls and in hollows, not near the central fractures. | https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/NASAs-curiosity-rover-sees-martian-spiderwebs-up-close/
S3 | Monte Grande hollow | science | 137.3810353 | -4.80783916 | -3610.4 | 4687 | 40 | Sample bedrock on a hollow floor. | Curiosity drilled "Valle de la Luna" here in October 2025. X-ray analysis found carbonate minerals. | https://science.nasa.gov/blog/curiosity-blog-sols-4689-4694-drill-in-the-boxwork-unit-is-go/
S4 | Nevado Sajama ridge | science | 137.3810041 | -4.80800755 | -3607.7 | 4711 | 40 | Sample the ridge top about 10 m away and 2 m higher than the hollow. | Curiosity drilled "Nevado Sajama" on sol 4718 (13 Nov 2025). X-ray analysis found clay minerals. | https://science.nasa.gov/blog/curiosity-blog-sols-4709-4715-drilling-high-and-low-in-the-boxwork-unit
S5 | Ridge overlook | science | 137.38194 | -4.80752572 | -3615.2 | 4816 | 15 | Panorama and scouting of ridges and hollows to the east. | Curiosity drove north-east along this wide ridge in February 2026 for a view of targets to the east. | https://science.nasa.gov/blog/curiosity-blog-sols-4804-4811-kicking-off-the-final-phase-of-boxwork-exploration

science_min values are ASSUMPTIONS. Stop positions are within about 2 m of the drill targets.

## 4. Map tiles (JPL Mars Trek WMTS, no API key)

URL template: `https://trek.nasa.gov/tiles/Mars/EQ/{LAYER}/1.0.0/default/default028mm/{z}/{y}/{x}.{ext}`

Grid: geographic lon/lat (EPSG:104905), 256 px tiles, zoom 0 = 2 columns x 1 row, origin top-left (-180, 90). In Leaflet use a copy of L.CRS.EPSG4326 with R = 3396190.

Note: the capabilities XML writes the template with a double slash after 1.0.0; NASA's documented examples use a single slash. Try single first.

Test tile (should show grey terrain; UNVERIFIED, indices computed but not opened): `https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/16/34518/115554.png`

label | LAYER | ext | maxNativeZoom | bbox west,south,east,north | attribution
--- | --- | --- | --- | --- | ---
HiRISE optical (0.64 m) | curiosity_hirise_mosaic | png | 16 | 137.1224669,-4.9254743,137.7298129,-4.2489588 | NASA/JPL-Caltech/Univ. of Arizona via Mars Trek
CTX optical context | curiosity_ctx_mosaic | png | 10 | 136.2768326,-7.2137273,139.3864225,-3.5804738 | NASA/JPL-Caltech/MSSS via Mars Trek
THEMIS day infrared (100 m) | THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018 | png | 9 | global to +/-65 lat | NASA/JPL-Caltech/Arizona State Univ. via Mars Trek
THEMIS night infrared (100 m) | THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018 | png | 9 | global to +/-65 lat | NASA/JPL-Caltech/Arizona State Univ. via Mars Trek
MOLA+HRSC colour hillshade | Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw | jpg | 8 | global | NASA/JPL/GSFC, ESA/DLR/FU Berlin via Mars Trek

Thermal layers are 100 m per pixel: context only, say so in the legend.

## 5. Pipeline inputs

DEM crop: `data/raw/gale_dem_crop.tif`, float32 metres, 1 m per pixel, about 1067 columns x 1363 rows, row 0 = north. Pixel (row r, col c) centre: lon = west + (c+0.5)/ncols*(east-west); lat = north - (r+0.5)/nrows*(north-south), using the site bounds in section 2.

Cut from the USGS "Mars MSL Gale Merged DEM 1m v3" (https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m), file https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif (3.6 GB, 32980 columns x 57440 rows, lon 137.124167 to 137.680559, lat -5.098652 to -4.129605, equirectangular, R = 3396190).

Colour image (optional, cloud-optimised GeoTIFF, about 1 GB, CRS and band count UNVERIFIED): https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif

Rover waypoints (GeoJSON points; fields RMC, site, drive, sol, elev_geoid, lon, lat, dist_total_m, drive_type; geometry [lon, lat, elev]): https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json

Rover traverse (GeoJSON lines; property Length; coordinates [lon, lat, elev]): https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json

REMS weather feed (JSON; key "soles" = array, newest first; fields sol, terrestrial_date, ls, season, min_temp, max_temp, min_gts_temp, max_gts_temp, pressure, atmo_opacity, local_uv_irradiance_index, sunrise, sunset; temperatures in deg C and pressure in Pa by convention, units not stated in the feed): https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json

Keep sols 4534 to 4860 (the boxwork campaign). Default display sol: 4718.

## 6. Model and limits

Slope: 3x3 mean filter on the DEM (ASSUMPTION), then central differences with 1.0 m cells; slope_deg = atan(sqrt(p^2+q^2)).

No-go: slope_deg > 20 or no data; grow the no-go mask by 1 cell (ASSUMPTION: 1 m clearance).

Speed km/h: v = 2.0 * exp(-3.5*abs(tan(slope)+0.05)) / exp(-3.5*0.05). Check values: 0 deg 2.00; 10 deg uphill 1.08; 20 deg uphill 0.56. For route finding use the cell's slope magnitude as uphill. For reporting use the signed along-track slope. ASSUMPTION: Tobler (1993) hiking function scaled to NASA's 2 km/h planning rate; not validated for suited walking in Mars gravity.

Cost: seconds per metre = 3.6 / v. Route = least total seconds on an 8-connected grid, leg by leg in stop order, returning to HAVEN.

Minutes to shelter: least-cost time from HAVEN to every cell.

EVA time = walking time + sum of science_min. Dose mSv = EVA hours * 0.026 (0.64 mSv per sol / 24.66 h).

Checks:

id | label | limit | unit | source id
--- | --- | --- | --- | ---
slope | Steepest slope on route | <= 20 | deg | xeva_slope
range | Farthest straight-line distance from haven | <= 2000 | m | xeva_range (also show the 10000 m historical walk-back assumption, source walkback)
duration | Total EVA time | <= 8 | h | xeva_duration (flag if outside 4 to 8 h)
shelter | Longest walk back to haven | <= 60 | min | xeva_duration (ASSUMPTION: equals the suit's 1-hour contingency capability)
daylight | EVA fits the daylight window | sunrise + 2 h to sunset - 2 h | local time | rems (ASSUMPTION)

Radiation facts: 0.64 mSv/day dose equivalent and 0.21 mGy/day absorbed at Gale (source rad). Largest surface event measured by RAD: 20 May 2024, 8100 microgray, "30 chest X-rays" (source spe). Galactic cosmic ray dose accrues indoors and outdoors; the EVA matters mainly for solar particle events.

Communications delay Earth-Mars: 4 to 24 minutes one way (source latency).

## 7. Schemas

```text
config.json
{ "project": "WALKBACK", "body_radius_m": 3396190,
  "bounds": {"west":137.3740, "east":137.3920, "south":-4.8170, "north":-4.7940},
  "limits": {"max_slope_deg":20, "max_range_m":2000, "walkback_assumption_m":10000,
             "eva_nominal_h":6, "eva_max_h":8, "shelter_limit_min":60,
             "flat_speed_kmh":2.0, "gcr_msv_per_h":0.026, "daylight_margin_h":2} }

stops.json  (array, in visiting order; first item is the haven)
{ "id":"S4", "name":"Nevado Sajama ridge", "role":"science",      // or "haven"
  "lon":137.3810041, "lat":-4.80800755, "elev_m":-3607.7, "rover_sol":4711,
  "science_min":40, "objective":"...", "finding":"...",
  "source_url":"https://...", "images":["img1","img2"] }

route.geojson  (FeatureCollection; one LineString per leg; coordinates [lon, lat])
properties: { "leg":3, "from":"S2", "to":"S3", "distance_m":241.0, "walk_min":8.9,
              "ascent_m":22.4, "descent_m":1.3, "max_slope_deg":14.2, "mean_slope_deg":5.1 }

escape.geojson  (FeatureCollection; one LineString per science stop: the fastest safe path straight back to HAVEN)
properties: { "stop":"S3", "walk_min":21.4 }

profile.json
{ "step_m":2, "samples":[ { "d_m":0, "lon":137.38644, "lat":-4.79762, "elev_m":-3657.2,
    "slope_deg":2.1, "t_walk_min":0.0, "t_home_min":0.0, "leg":1 }, ... ] }

stats.json
{ "total_distance_m":0, "walk_time_min":0, "science_time_min":0, "eva_time_min":0,
  "ascent_m":0, "descent_m":0, "max_slope_on_route_deg":0,
  "max_range_from_haven_m":0, "max_time_to_haven_min":0, "gcr_dose_msv":0,
  "rover_check": { "max_slope_on_rover_path_deg":0, "pct_rover_path_under_20deg":0 },
  "checks":[ { "id":"slope", "label":"Steepest slope on route", "value":0, "limit":20,
               "unit":"deg", "pass":true, "source":"xeva_slope" }, ... ],
  "generated_utc":"2026-11-14T22:00:00Z" }

overlays.json
{ "slope":    { "file":"data/slope.png",    "bounds":[[-4.8170,137.3740],[-4.7940,137.3920]],
                "legend":[ {"label":"5-10 deg","color":"#abd9e9"}, ... ] },
  "hillshade":{...}, "walkback":{...}, "ortho":{...} }

weather.json
{ "source_url":"https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json",
  "sols":[ { "sol":4718, "date":"2025-11-13", "ls":170, "air_min_c":-74, "air_max_c":-5,
             "ground_min_c":-77, "ground_max_c":8, "pressure_pa":695, "uv":"Moderate",
             "sunrise":"05:22", "sunset":"17:20", "opacity":"Sunny" }, ... ] }

images.json
[ { "id":"img1", "file":"img/nevado_sajama_workspace_sol4709.jpg", "stop":"S4", "exact_location":true,
    "title":"...", "camera":"Left Navcam", "sol":4709, "date":"2025-11-04",
    "credit":"NASA/JPL-Caltech", "source_url":"https://..." }, ... ]

spe_scenario.json
{ "name":"Solar storm replay: 20 May 2024", "dose_ugy":8100,
  "note":"Largest surface event measured by Curiosity RAD",
  "source_url":"https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm" }
```

## 8. Images (download into img/; credit exactly as given; exact_location says whether the photo was taken at the stop)

id | file | stop | exact_location | title | camera | sol or date | credit | download_url | source_page
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
img1 | img/nevado_sajama_workspace_sol4709.jpg | S4 | true | Nevado Sajama drill workspace on the ridge, hollow behind | Left Navcam | sol 4709, 4 Nov 2025 | NASA/JPL-Caltech | https://assets.science.nasa.gov/content/dam/science/missions/msl/2025/curiosity-rover-updates/november/https___mars.nasa.gov_msl-raw-images_proj_msl_redops_ods_surface_sol_04709_opgs_edr_ncam_NLB_815536970EDR_F1200000NCAM00261M_.jpg | https://science.nasa.gov/blog/curiosity-blog-sols-4709-4715-drilling-high-and-low-in-the-boxwork-unit
img2 | img/nevado_sajama_drillhole_sol4718.jpg | S4 | true | Nevado Sajama drill hole | Left Navcam | sol 4718, 13 Nov 2025 | NASA/JPL-Caltech | https://assets.science.nasa.gov/content/dam/science/missions/msl/2025/curiosity-rover-updates/november/https___mars.nasa.gov_msl-raw-images_proj_msl-red-vol2_redops_ods_surface_sol_04718_opgs_edr_ncam_NLB_816331121EDR_F1200082NCAM00309M_.jpg | https://science.nasa.gov/solar-system/curiosity-blog-sols-4716-4722-drilling-success-at-nevado-sajama
img3 | img/valle_de_la_luna_sol4687.jpg | S3 | true | Valle de la Luna block in the Monte Grande hollow | Front Hazcam | sol 4687, 12 Oct 2025 | NASA/JPL-Caltech | https://assets.science.nasa.gov/content/dam/science/missions/msl/2025/curiosity-rover-updates/october/https___mars.nasa.gov_msl-raw-images_proj_msl_redops_ods_surface_sol_04687_opgs_edr_fcam_FLB_813578617EDR_F1191722FHAZ00302M_.jpg | https://science.nasa.gov/blog/curiosity-blog-sols-4689-4694-drill-in-the-boxwork-unit-is-go/
img4 | img/boxwork_panorama_pia26693.jpg | S5 | false | Panorama of boxwork ridges and hollows | Mastcam | 26 Sep 2025 | NASA/JPL-Caltech/MSSS | https://www.nasa.gov/wp-content/uploads/2026/02/1-pia26693-curiosity-surveys-the-boxwork-region-web.jpg | https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/NASAs-curiosity-rover-sees-martian-spiderwebs-up-close/
img5 | img/nodules_pia26697.jpg | S2 | false | Pea-size nodules on the boxwork | (not stated) | 21 Aug 2025 | NASA/JPL-Caltech/MSSS | https://www.nasa.gov/wp-content/uploads/2026/02/e1-pj-only-pia26697-curiosity-studies-nodules-on-mount-sharps-boxwork-formations.jpg | https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/NASAs-curiosity-rover-sees-martian-spiderwebs-up-close/
img6 | img/ridge_closeup_pia26558.png | S1 | false | Low fractured boxwork ridge | (not stated) | 16 May 2025 | NASA/JPL-Caltech/MSSS | https://www.nasa.gov/wp-content/uploads/2025/06/e2-pia26558-curiosity-views-a-fractured-boxwork-ridge-up-close.png | https://www.nasa.gov/?p=879744
img7 | img/boxwork_distance_pia26560.jpg | HAVEN | false | Boxwork region seen from a distance | (not stated) | 2025 | NASA/JPL-Caltech/MSSS | https://www.nasa.gov/wp-content/uploads/2025/06/pia26560-curiosity-views-boxwork-at-a-distance.jpg | https://www.nasa.gov/?p=879744
img8 | img/spiderwebs_orbit_pia26306.jpg | (intro) | false | Boxwork "spiderweb" pattern from orbit | HiRISE | (not stated) | NASA/JPL-Caltech/Univ. of Arizona | download from the source page | https://images.nasa.gov/details/PIA26306
img9 | img/rover_park_navcam_sol4534.jpg | HAVEN | true | View from the Rover Park parking spot, with part of the rover in front | Left Navcam | sol 4534, 8 May 2025 | NASA/JPL-Caltech | https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/04534/opgs/edr/ncam/NLB_800007980EDR_F1160000NCAM00280M_.JPG | https://mars.nasa.gov/raw_images/1464398/
img10 | img/altadena_navcam_sol4560.jpg | S1 | true | Ground around the Altadena parking spot | Left Navcam | sol 4560, 4 Jun 2025 | NASA/JPL-Caltech | https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/04560/opgs/edr/ncam/NLB_802308448EDR_F1161944NCAM00265M_.JPG | https://mars.nasa.gov/raw_images/1474400/
img11 | img/first_ridge_navcam_sol4605.jpg | S2 | true | View from the First ridge parking spot | Left Navcam | sol 4605, 20 Jul 2025 | NASA/JPL-Caltech | https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/04605/opgs/edr/ncam/NLB_806306207EDR_F1172538NCAM00264M_.JPG | https://mars.nasa.gov/raw_images/1491691/
img12 | img/ridge_overlook_navcam_sol4816.jpg | S5 | true | Pale boxwork ridge and rover tracks at the Ridge overlook parking spot | Left Navcam | sol 4816, 22 Feb 2026 | NASA/JPL-Caltech | https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/04816/opgs/edr/ncam/NLB_825029235EDR_F1201546NCAM00292M_.JPG | https://mars.nasa.gov/raw_images/1553668/

## 9. Interface tokens

Background #0b0f14; panel #121821; text #e6edf3; accent #ffb000; pass #3ddc97; fail #ff5c5c.

Route: white 4 px line with dark outline. Rover path: thin cyan dashed line.

Slope classes: under 5 deg transparent; 5-10 #abd9e9; 10-15 #ffffbf; 15-20 #fdae61; over 20 #d7191c (about 60% opacity).

Minutes-to-shelter: viridis colour ramp, 0 to 30+ minutes, about 60% opacity.

Never use colour alone: pass/fail also shows a word and an icon. Body text at least 15 px. HUD contrast at least 7:1.

## 10. Sources

id | citation | url
--- | --- | ---
xeva_slope | Coan, D., NASA Exploration EVA Integrated HITL Testing and Analogs, NTRS 20210000827 (xEVA suit: walking up/down/across slopes up to 20 deg) | https://ntrs.nasa.gov/citations/20210000827
xeva_range | NASA, Exploration EVA System Concept of Operations Summary, EVA-EXP-0075 (traverses up to 2 km from the lander) | https://www.nasa.gov/wp-content/uploads/2020/01/topic_1-_eva_lunar_surface_concept_of_operations.pdf
xeva_duration | Scoville et al., Artemis III EVA study slides, NTRS 20210026296 (suit minimum 8 h EVA; nominal 6 +/- 2 h; 1 h contingency; walking rate 2 km/h) | https://ntrs.nasa.gov/api/citations/20210026296/downloads/Scoville%20Final%20presentation%20-%20compressed.pptx.pdf
walkback | Vos, Gernhardt and Lee (2007), The Walkback Test, ICES 2007-01-3133 (10 km assumed maximum excursion from Apollo experience) | https://core.ac.uk/works/15254764
planning | NASA, Planning Lunar EVAs, NTRS 20250006988 (Artemis EVA planning constraints; AEGIS) | https://ntrs.nasa.gov/api/citations/20250006988/downloads/ASCEND%20presentation%20-%20Planning%20Lunar%20EVAs.pdf
rad | Hassler et al. (2014), Mars' Surface Radiation Environment Measured with the MSL Curiosity Rover, Science 343, 1244797 | https://doi.org/10.1126/science.1244797
spe | NASA/JPL (10 June 2024), NASA Watches Mars Light Up During Epic Solar Storm | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm
rems | NASA/JPL-Caltech/CAB (CSIC-INTA), Curiosity REMS weather feed | https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json
dem | Calef III, F.J. and Parker, T. (2016), MSL Gale Merged DEM 1 m v3, PDS Annex, USGS | https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m
rover | NASA/JPL-Caltech, MSL waypoints and traverse (MMGIS) | https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json
trek | NASA/JPL-Caltech, Mars Trek WMTS | https://trek.nasa.gov/mars/
science | NASA (23 Feb 2026), NASA's Curiosity Rover Sees Martian "Spiderwebs" Up Close | https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/NASAs-curiosity-rover-sees-martian-spiderwebs-up-close/
latency | NASA, Space Communications: 7 Things You Need to Know | https://www.nasa.gov/solar-system/space-communications-7-things-you-need-to-know/
ez | Bussey and Hoffman, Human Mars Landing Site and Impacts on Mars Surface Operations, NTRS 20150019636 | https://ntrs.nasa.gov/citations/20150019636
tobler | Tobler, W. (1993), Three Presentations on Geographical Analysis and Modeling, NCGIA Technical Report 93-1 | (no link)
sextant | Johnson et al. (2010), An Integrated Traverse Planner and Analysis Tool for Planetary Exploration (MIT SEXTANT) | https://dspace.mit.edu/handle/1721.1/81322?show=full

## 11. Limitations (show these in the Sources tab)

- Walking speed is an Earth hiking model scaled to a NASA planning rate; not validated for suited walking in Mars gravity.
- The 20 deg and 2 km limits come from lunar xEVA documents and are applied to Mars as the best published values.
- The elevation model is 1 m per pixel: rocks under about 1 to 2 m and loose sand are not visible. Slope is a proxy for obstacles.
- Stop positions are rover parking positions, within about 2 m of the targets.
- Radiation uses the 2012-13 average dose rate; real rates vary with the solar cycle, season and terrain.
- Weather is a replay of sols Curiosity measured here in 2025-26, not a forecast.
- Thermal imagery is 100 m per pixel: context only.
- Science time per stop is an assumption.
- Student project built in one weekend. Not flight software.
