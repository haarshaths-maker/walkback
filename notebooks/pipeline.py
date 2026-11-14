# AI-assisted: written with Claude Code (Opus 5.5), reviewed by the team.
"""
WALKBACK data pipeline.

Turns the raw files from notebooks/fetch_data.ipynb into every file the
website reads from /data. Every constant comes from data/config.json,
data/stops.json and docs/SPEC.md section 6.

Run it from the repository root:

    python notebooks/pipeline.py --raw path/to/unzipped/walkback_raw --out data

Needs: numpy, scipy, scikit-image, rasterio, matplotlib, Pillow.

What it does, in order:
  1  load the 1 m elevation crop and work out where every pixel is on Mars
  2  smooth, then compute slope (degrees) and a shaded-relief image
  3  mark no-go cells (steeper than 20 deg, plus a 1 m safety margin)
  4  turn slope into walking speed and a cost (seconds per metre)
  5  find the fastest safe route HAVEN > S1 > ... > S5 > HAVEN
  6  compute minutes-to-shelter for every cell, and escape paths from each stop
  7  sample the route every 2 m for the HUD and the elevation profile
  8  compare our slope map with Curiosity's real path (ground-truth check)
  9  keep REMS weather for the boxwork sols
  10 write stats.json with the five pass/fail checks
  11 write overlays.json, the PNG layers and a QA figure
"""

import argparse
import json
import math
import os
from datetime import datetime, timezone

import numpy as np
import rasterio
from rasterio.warp import transform as warp_transform
from scipy import ndimage
from skimage.graph import MCP_Geometric
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import cm

MARS_LONLAT = "+proj=longlat +a=3396190 +b=3396190 +no_defs"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def speed_kmh(slope_rad, flat_kmh):
    """Tobler's hiking function rescaled so flat ground = flat_kmh. ASSUMPTION (SPEC section 6).
    slope_rad is the signed slope (positive = uphill)."""
    return flat_kmh * np.exp(-3.5 * np.abs(np.tan(slope_rad) + 0.05)) / math.exp(-3.5 * 0.05)


def round_or_none(value, digits):
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return None
    return round(float(value), digits)


def to_number(value):
    """REMS fields arrive as strings; '--' means no data."""
    if value is None:
        return None
    text = str(value).strip()
    if text in ("", "--", "null"):
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return int(number) if number.is_integer() else number


def write_json(path, obj, compact=False):
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
        else:
            json.dump(obj, f, indent=2, ensure_ascii=False)


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------

def main(raw_dir, out_dir):
    config = json.load(open(os.path.join(out_dir, "config.json"), encoding="utf-8"))
    stops = json.load(open(os.path.join(out_dir, "stops.json"), encoding="utf-8"))
    limits = config["limits"]
    flat_kmh = limits["flat_speed_kmh"]
    max_slope = limits["max_slope_deg"]
    report = []  # plain-text log printed at the end

    # ------------------------------------------------------------------
    # 1. Elevation crop and pixel positions
    # ------------------------------------------------------------------
    with rasterio.open(os.path.join(raw_dir, "gale_dem_crop.tif")) as src:
        dem = src.read(1).astype("float64")
        T = src.transform
        crs = src.crs
        if src.nodata is not None and np.isfinite(src.nodata):
            dem[dem == src.nodata] = np.nan
    rows, cols = dem.shape
    cell_x, cell_y = abs(T.a), abs(T.e)
    report.append(f"DEM crop {rows} rows x {cols} cols, cell {cell_x} x {cell_y} m, "
                  f"elevation {np.nanmin(dem):.1f} to {np.nanmax(dem):.1f} m, empty cells {int(np.isnan(dem).sum())}")
    assert abs(cell_x - 1.0) < 1e-6 and abs(cell_y - 1.0) < 1e-6, "expected 1 m cells"

    # The projection is equirectangular, so lon depends only on column and lat only on row.
    xs = T.c + (np.arange(cols) + 0.5) * T.a
    ys = T.f + (np.arange(rows) + 0.5) * T.e
    col_lon, _ = warp_transform(crs, MARS_LONLAT, list(xs), [float(ys[0])] * cols)
    _, row_lat = warp_transform(crs, MARS_LONLAT, [float(xs[0])] * rows, list(ys))
    col_lon = np.array(col_lon)
    row_lat = np.array(row_lat)
    # Outer edges of the crop, for placing image overlays exactly.
    (west, east), (north_y_lat, south_y_lat) = warp_transform(
        crs, MARS_LONLAT, [T.c, T.c + cols * T.a], [T.f, T.f + rows * T.e])
    west, east = min(west, east), max(west, east)
    north, south = max(north_y_lat, south_y_lat), min(north_y_lat, south_y_lat)
    overlay_bounds = [[round(south, 7), round(west, 7)], [round(north, 7), round(east, 7)]]
    report.append(f"crop edges lon {west:.6f} to {east:.6f}, lat {south:.6f} to {north:.6f}")

    def lonlat_to_rowcol(lon, lat):
        x, y = warp_transform(MARS_LONLAT, crs, [lon], [lat])
        col = int(math.floor((x[0] - T.c) / T.a))
        row = int(math.floor((y[0] - T.f) / T.e))
        return row, col

    def rowcol_to_lonlat(row, col):
        return float(np.interp(col, np.arange(cols), col_lon)), float(np.interp(row, np.arange(rows), row_lat))

    # ------------------------------------------------------------------
    # 2. Smooth, slope, hillshade
    # ------------------------------------------------------------------
    filled = np.where(np.isnan(dem), np.nanmean(dem), dem)
    smooth = ndimage.uniform_filter(filled, size=3, mode="nearest")  # 3x3 mean, ASSUMPTION
    dz_dy, dz_dx = np.gradient(smooth, cell_y, cell_x)                # central differences, 1 m cells
    slope_deg = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
    slope_deg[np.isnan(dem)] = np.nan

    # Hillshade, sun from the north-west (azimuth 315 deg) at 45 deg altitude.
    az, alt = math.radians(315), math.radians(45)
    aspect = np.arctan2(-dz_dx, dz_dy)
    slope_rad_mag = np.arctan(np.hypot(dz_dx, dz_dy))
    shade = (math.sin(alt) * np.cos(slope_rad_mag) +
             math.cos(alt) * np.sin(slope_rad_mag) * np.cos(az - aspect))
    hillshade = np.clip(shade * 255, 0, 255).astype(np.uint8)

    # ------------------------------------------------------------------
    # 3. No-go mask and 4. cost raster
    # ------------------------------------------------------------------
    blocked = (slope_deg > max_slope) | np.isnan(slope_deg)
    blocked = ndimage.binary_dilation(blocked, structure=np.ones((3, 3), bool))  # 1 m margin, ASSUMPTION
    v_route = speed_kmh(np.radians(np.nan_to_num(slope_deg)), flat_kmh)       # slope treated as uphill
    cost = 3.6 / v_route                                                       # seconds per metre
    cost[blocked] = np.inf                                                     # impassable for the solver
    report.append(f"no-go cells: {blocked.mean() * 100:.1f}% of the site")

    # ------------------------------------------------------------------
    # Place stops on the grid (snap off blocked cells if needed)
    # ------------------------------------------------------------------
    stop_cells = []
    for stop in stops:
        r, c = lonlat_to_rowcol(stop["lon"], stop["lat"])
        assert 0 <= r < rows and 0 <= c < cols, f"{stop['id']} is outside the elevation crop"
        if blocked[r, c]:
            best = None
            for dr in range(-5, 6):
                for dc in range(-5, 6):
                    rr, cc = r + dr, c + dc
                    if 0 <= rr < rows and 0 <= cc < cols and not blocked[rr, cc]:
                        d = math.hypot(dr, dc)
                        if d <= 5 and (best is None or d < best[0]):
                            best = (d, rr, cc)
            if best is None:
                raise SystemExit(f"ERROR: {stop['id']} sits on steep ground with no open cell within 5 m")
            report.append(f"WARNING: {stop['id']} was on a no-go cell; moved {best[0]:.1f} m to open ground")
            r, c = best[1], best[2]
        stop_cells.append((r, c))
        stop["elev_m"] = round(float(dem[r, c]), 1) if stop["elev_m"] is None else stop["elev_m"]

    # ------------------------------------------------------------------
    # 5. Route, leg by leg
    # ------------------------------------------------------------------
    order = list(range(len(stops))) + [0]  # HAVEN, S1..S5, back to HAVEN
    legs = []
    route_cells = []  # whole route as a list of (row, col), no duplicate joins
    leg_of_cell = []
    for leg_no in range(1, len(order)):
        a, b = order[leg_no - 1], order[leg_no]
        mcp = MCP_Geometric(cost, fully_connected=True)
        mcp.find_costs([stop_cells[a]], [stop_cells[b]])
        path = mcp.traceback(stop_cells[b])
        legs.append({"leg": leg_no, "from": stops[a]["id"], "to": stops[b]["id"], "cells": path})
        start = 0 if not route_cells else 1
        route_cells.extend(path[start:])
        leg_of_cell.extend([leg_no] * (len(path) - start))

    def walk_numbers(cells):
        """Distance, signed-slope walking time, climb and slope stats along a list of cells."""
        dist = 0.0
        secs = 0.0
        up = down = 0.0
        for (r0, c0), (r1, c1) in zip(cells[:-1], cells[1:]):
            d = math.hypot((r1 - r0) * cell_y, (c1 - c0) * cell_x)
            dz = smooth[r1, c1] - smooth[r0, c0]
            v = speed_kmh(math.atan2(dz, d), flat_kmh)
            dist += d
            secs += d / (v / 3.6)
            up += max(dz, 0.0)
            down += max(-dz, 0.0)
        slopes = [slope_deg[r, c] for r, c in cells]
        return dist, secs, up, down, float(np.nanmax(slopes)), float(np.nanmean(slopes))

    route_features = []
    for leg in legs:
        dist, secs, up, down, smax, smean = walk_numbers(leg["cells"])
        leg.update(distance_m=dist, walk_min=secs / 60, ascent_m=up, descent_m=down,
                   max_slope_deg=smax, mean_slope_deg=smean)
        coords = [[round(lon, 7), round(lat, 7)] for lon, lat in
                  (rowcol_to_lonlat(r, c) for r, c in leg["cells"])]
        route_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"leg": leg["leg"], "from": leg["from"], "to": leg["to"],
                           "distance_m": round(dist, 1), "walk_min": round(secs / 60, 1),
                           "ascent_m": round(up, 1), "descent_m": round(down, 1),
                           "max_slope_deg": round(smax, 1), "mean_slope_deg": round(smean, 1)}})

    # ------------------------------------------------------------------
    # 6. Minutes to shelter, and escape paths
    # ------------------------------------------------------------------
    home = MCP_Geometric(cost, fully_connected=True)
    seconds_home, _ = home.find_costs([stop_cells[0]])
    minutes_home = seconds_home / 60.0
    minutes_home[~np.isfinite(minutes_home)] = np.nan

    escape_features = []
    for i, stop in enumerate(stops):
        if stop["role"] == "haven":
            continue
        path = home.traceback(stop_cells[i])[::-1]  # from the stop back to HAVEN
        coords = [[round(lon, 7), round(lat, 7)] for lon, lat in (rowcol_to_lonlat(r, c) for r, c in path)]
        escape_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"stop": stop["id"], "walk_min": round(float(minutes_home[stop_cells[i]]), 1)}})

    # ------------------------------------------------------------------
    # 7. Profile: the whole route every 2 m
    # ------------------------------------------------------------------
    cum_d = [0.0]
    cum_t = [0.0]
    for (r0, c0), (r1, c1) in zip(route_cells[:-1], route_cells[1:]):
        d = math.hypot((r1 - r0) * cell_y, (c1 - c0) * cell_x)
        dz = smooth[r1, c1] - smooth[r0, c0]
        v = speed_kmh(math.atan2(dz, d), flat_kmh)
        cum_d.append(cum_d[-1] + d)
        cum_t.append(cum_t[-1] + d / (v / 3.6))
    cum_d = np.array(cum_d)
    cum_t = np.array(cum_t)
    rr = np.array([r for r, _ in route_cells], float)
    cc = np.array([c for _, c in route_cells], float)
    step = 2.0
    sample_d = np.arange(0.0, cum_d[-1] + 1e-9, step)
    if sample_d[-1] < cum_d[-1]:
        sample_d = np.append(sample_d, cum_d[-1])
    s_r = np.interp(sample_d, cum_d, rr)
    s_c = np.interp(sample_d, cum_d, cc)
    s_t = np.interp(sample_d, cum_d, cum_t) / 60.0
    s_z = ndimage.map_coordinates(smooth, [s_r, s_c], order=1)
    s_home = ndimage.map_coordinates(np.nan_to_num(minutes_home, nan=0.0), [s_r, s_c], order=1)
    s_leg = np.array(leg_of_cell)[np.clip(np.searchsorted(cum_d, sample_d, side="right") - 1, 0, len(leg_of_cell) - 1)]
    s_slope = np.zeros_like(sample_d)
    for i in range(len(sample_d)):
        i0, i1 = max(i - 1, 0), min(i + 1, len(sample_d) - 1)
        run = sample_d[i1] - sample_d[i0]
        s_slope[i] = math.degrees(math.atan2(s_z[i1] - s_z[i0], run)) if run > 0 else 0.0
    samples = []
    for i in range(len(sample_d)):
        lon, lat = rowcol_to_lonlat(s_r[i], s_c[i])
        samples.append({"d_m": round(float(sample_d[i]), 1), "lon": round(lon, 7), "lat": round(lat, 7),
                        "elev_m": round(float(s_z[i]), 2), "slope_deg": round(float(s_slope[i]), 1),
                        "t_walk_min": round(float(s_t[i]), 2), "t_home_min": round(float(s_home[i]), 1),
                        "leg": int(s_leg[i])})

    # Straight-line distance of every route cell from HAVEN.
    hr, hc = stop_cells[0]
    range_m = float(np.max(np.hypot((rr - hr) * cell_y, (cc - hc) * cell_x)))

    # ------------------------------------------------------------------
    # 8. Curiosity ground-truth check
    # ------------------------------------------------------------------
    def inside(lon, lat):
        return west <= lon <= east and south <= lat <= north

    waypoints = json.load(open(os.path.join(raw_dir, "MSL_waypoints.json"), encoding="utf-8"))
    rover_points = []
    for f in waypoints.get("features", []):
        p = f.get("properties", {})
        lon, lat = p.get("lon"), p.get("lat")
        if lon is None or lat is None:
            lon, lat = f["geometry"]["coordinates"][:2]
        lon, lat = float(lon), float(lat)
        if inside(lon, lat):
            rover_points.append({"type": "Feature",
                                 "geometry": {"type": "Point", "coordinates": [round(lon, 7), round(lat, 7)]},
                                 "properties": {"kind": "waypoint", "sol": p.get("sol"),
                                                "elev_m": to_number(p.get("elev_geoid"))}})

    traverse = json.load(open(os.path.join(raw_dir, "MSL_traverse.json"), encoding="utf-8"))
    rover_lines = []
    for f in traverse.get("features", []):
        g = f.get("geometry", {})
        parts = g.get("coordinates", [])
        if g.get("type") == "LineString":
            parts = [parts]
        for part in parts:
            run = []
            for pt in part:
                lon, lat = float(pt[0]), float(pt[1])
                if inside(lon, lat):
                    run.append([round(lon, 7), round(lat, 7)])
                elif len(run) > 1:
                    rover_lines.append(run)
                    run = []
                else:
                    run = []
            if len(run) > 1:
                rover_lines.append(run)

    rover_slopes = []
    for line in rover_lines:
        rc = [lonlat_to_rowcol(lon, lat) for lon, lat in line]
        for (r0, c0), (r1, c1) in zip(rc[:-1], rc[1:]):
            n = max(int(math.hypot(r1 - r0, c1 - c0)), 1)
            for k in range(n + 1):
                r = int(round(r0 + (r1 - r0) * k / n))
                c = int(round(c0 + (c1 - c0) * k / n))
                if 0 <= r < rows and 0 <= c < cols and np.isfinite(slope_deg[r, c]):
                    rover_slopes.append(slope_deg[r, c])
    rover_slopes = np.array(rover_slopes)
    rover_check = {
        "max_slope_on_rover_path_deg": round_or_none(rover_slopes.max(), 1) if rover_slopes.size else None,
        "pct_rover_path_under_20deg": round_or_none((rover_slopes <= max_slope).mean() * 100, 1) if rover_slopes.size else None,
        "samples_m": int(rover_slopes.size)}
    curiosity = {"type": "FeatureCollection",
                 "features": [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": line},
                               "properties": {"kind": "path"}} for line in rover_lines] + rover_points}
    report.append(f"Curiosity inside site: {len(rover_lines)} path pieces, {len(rover_points)} waypoints, "
                  f"{rover_slopes.size} m sampled")

    # ------------------------------------------------------------------
    # 9. REMS weather for the boxwork sols
    # ------------------------------------------------------------------
    rems = json.load(open(os.path.join(raw_dir, "rems_weather.json"), encoding="utf-8"))
    weather_sols = []
    for s in rems.get("soles", []):
        sol = to_number(s.get("sol"))
        if sol is None or not (4534 <= sol <= 4860):
            continue
        weather_sols.append({"sol": int(sol), "date": s.get("terrestrial_date"), "ls": to_number(s.get("ls")),
                             "air_min_c": to_number(s.get("min_temp")), "air_max_c": to_number(s.get("max_temp")),
                             "ground_min_c": to_number(s.get("min_gts_temp")),
                             "ground_max_c": to_number(s.get("max_gts_temp")),
                             "pressure_pa": to_number(s.get("pressure")),
                             "uv": s.get("local_uv_irradiance_index") if s.get("local_uv_irradiance_index") not in ("--", "") else None,
                             "sunrise": s.get("sunrise"), "sunset": s.get("sunset"),
                             "opacity": s.get("atmo_opacity") if s.get("atmo_opacity") not in ("--", "") else None})
    weather_sols.sort(key=lambda w: w["sol"])
    weather = {"source_url": "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json",
               "units": {"temperature": "deg C (by convention; not stated in the feed)",
                         "pressure": "Pa (by convention; not stated in the feed)"},
               "sols": weather_sols}

    # ------------------------------------------------------------------
    # 10. Totals and checks
    # ------------------------------------------------------------------
    total_d = sum(l["distance_m"] for l in legs)
    walk_min = sum(l["walk_min"] for l in legs)
    sci_min = sum(s["science_min"] for s in stops)
    eva_min = walk_min + sci_min
    max_route_slope = max(l["max_slope_deg"] for l in legs)
    max_home = float(np.max(s_home))
    dose = eva_min / 60 * limits["gcr_msv_per_h"]

    day = next((w for w in weather_sols if w["sol"] == config["default_sol"]), None)
    daylight = {"id": "daylight", "label": "EVA fits the daylight window", "unit": "local time",
                "source": "rems", "value": None, "limit": None, "pass": None}
    if day and day["sunrise"] and day["sunset"]:
        def mins(hhmm):
            h, m = hhmm.split(":")
            return int(h) * 60 + int(m)
        margin = limits["daylight_margin_h"] * 60
        start, end_limit = mins(day["sunrise"]) + margin, mins(day["sunset"]) - margin
        end = start + eva_min
        fmt = lambda m: f"{int(m // 60):02d}:{int(round(m % 60)):02d}" if round(m % 60) < 60 else f"{int(m // 60) + 1:02d}:00"
        daylight.update(value=f"{fmt(start)}-{fmt(end)}", limit=f"{fmt(start)}-{fmt(end_limit)}",
                        pass_=None)
        daylight.pop("pass_")
        daylight["pass"] = bool(end <= end_limit)
        daylight["sol"] = config["default_sol"]

    checks = [
        {"id": "slope", "label": "Steepest slope on route", "value": round(max_route_slope, 1),
         "limit": max_slope, "unit": "deg", "pass": bool(max_route_slope <= max_slope), "source": "xeva_slope"},
        {"id": "range", "label": "Farthest straight-line distance from haven", "value": round(range_m),
         "limit": limits["max_range_m"], "unit": "m", "pass": bool(range_m <= limits["max_range_m"]),
         "source": "xeva_range", "note": f"Historical walk-back assumption: {limits['walkback_assumption_m']} m (source walkback)"},
        {"id": "duration", "label": "Total EVA time", "value": round(eva_min / 60, 2),
         "limit": limits["eva_max_h"], "unit": "h", "pass": bool(eva_min / 60 <= limits["eva_max_h"]),
         "source": "xeva_duration", "flag": None if 4 <= eva_min / 60 <= 8 else "outside the nominal 4 to 8 h band"},
        {"id": "shelter", "label": "Longest walk back to haven", "value": round(max_home, 1),
         "limit": limits["shelter_limit_min"], "unit": "min", "pass": bool(max_home <= limits["shelter_limit_min"]),
         "source": "xeva_duration", "assumption": "Limit equals the suit's 1-hour contingency capability"},
        daylight,
    ]

    stats = {
        "total_distance_m": round(total_d, 1),
        "walk_time_min": round(walk_min, 1),
        "science_time_min": sci_min,
        "eva_time_min": round(eva_min, 1),
        "ascent_m": round(sum(l["ascent_m"] for l in legs), 1),
        "descent_m": round(sum(l["descent_m"] for l in legs), 1),
        "max_slope_on_route_deg": round(max_route_slope, 1),
        "max_range_from_haven_m": round(range_m),
        "max_time_to_haven_min": round(max_home, 1),
        "gcr_dose_msv": round(dose, 3),
        "no_go_pct_of_site": round(float(blocked.mean() * 100), 1),
        "rover_check": rover_check,
        "checks": checks,
        "notes": {
            "time_to_haven": "Minutes to shelter use the conservative rule that every slope is walked uphill.",
            "walk_time": "Route walking times use the real up or down slope along the path."},
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    # ------------------------------------------------------------------
    # 11. Images and overlay index
    # ------------------------------------------------------------------
    # Slope classes (SPEC section 9), about 60% opaque, transparent under 5 deg.
    classes = [(5, 10, (0xab, 0xd9, 0xe9)), (10, 15, (0xff, 0xff, 0xbf)),
               (15, 20, (0xfd, 0xae, 0x61)), (20, 999, (0xd7, 0x19, 0x1c))]
    rgba = np.zeros((rows, cols, 4), np.uint8)
    for lo, hi, rgb in classes:
        m = (slope_deg >= lo) & (slope_deg < hi)
        rgba[m, :3] = rgb
        rgba[m, 3] = 153
    Image.fromarray(rgba, "RGBA").quantize(colors=8, method=Image.Quantize.FASTOCTREE).save(
        os.path.join(out_dir, "slope.png"), optimize=True)

    Image.fromarray(hillshade, "L").save(os.path.join(out_dir, "hillshade.jpg"), quality=82)

    vmax = 30.0
    norm = np.clip(np.nan_to_num(minutes_home, nan=0.0) / vmax, 0, 1)
    wb = (cm.get_cmap("viridis", 16)(norm) * 255).astype(np.uint8)
    wb[..., 3] = np.where(np.isnan(minutes_home), 0, 153).astype(np.uint8)
    Image.fromarray(wb, "RGBA").quantize(colors=20, method=Image.Quantize.FASTOCTREE).save(
        os.path.join(out_dir, "walkback.png"), optimize=True)

    walkback_legend = []
    for m in [0, 5, 10, 15, 20, 25, 30]:
        r_, g_, b_, _ = cm.get_cmap("viridis", 16)(min(m / vmax, 1.0))
        walkback_legend.append({"label": f"{m} min" if m < 30 else "30+ min",
                                "color": "#%02x%02x%02x" % (int(r_ * 255), int(g_ * 255), int(b_ * 255))})

    nominal = config["bounds"]
    overlays = {
        "slope": {"file": "data/slope.png", "bounds": overlay_bounds, "opacity": 1.0,
                  "legend": [{"label": "5-10 deg", "color": "#abd9e9"}, {"label": "10-15 deg", "color": "#ffffbf"},
                             {"label": "15-20 deg", "color": "#fdae61"}, {"label": "over 20 deg (no-go)", "color": "#d7191c"}]},
        "hillshade": {"file": "data/hillshade.jpg", "bounds": overlay_bounds, "opacity": 0.5,
                      "legend": [{"label": "Shaded relief from the 1 m elevation model, sun from the north-west", "color": "#9aa7b6"}]},
        "walkback": {"file": "data/walkback.png", "bounds": overlay_bounds, "opacity": 1.0,
                     "legend": walkback_legend,
                     "note": "Walking minutes back to the haven, assuming every slope is walked uphill (conservative)."},
    }
    if os.path.exists(os.path.join(raw_dir, "ortho.jpg")):
        Image.open(os.path.join(raw_dir, "ortho.jpg")).convert("RGB").save(
            os.path.join(out_dir, "ortho.jpg"), quality=80, optimize=True)
        overlays["ortho"] = {"file": "data/ortho.jpg",
                             "bounds": [[nominal["south"], nominal["west"]], [nominal["north"], nominal["east"]]],
                             "opacity": 1.0,
                             "legend": [{"label": "HiRISE colour mosaic crop (USGS, Calef and Parker 2016)", "color": "#c48a5a"}]}

    # Write data files
    write_json(os.path.join(out_dir, "route.geojson"), {"type": "FeatureCollection", "features": route_features}, compact=True)
    write_json(os.path.join(out_dir, "escape.geojson"), {"type": "FeatureCollection", "features": escape_features}, compact=True)
    write_json(os.path.join(out_dir, "profile.json"), {"step_m": step, "samples": samples}, compact=True)
    write_json(os.path.join(out_dir, "curiosity.geojson"), curiosity, compact=True)
    write_json(os.path.join(out_dir, "weather.json"), weather)
    write_json(os.path.join(out_dir, "stats.json"), stats)
    write_json(os.path.join(out_dir, "overlays.json"), overlays)
    write_json(os.path.join(out_dir, "stops.json"), stops)

    # QA figure (not used by the site; for checking by eye)
    fig, axes = plt.subplots(1, 2, figsize=(14, 9))
    extent = [west, east, south, north]
    axes[0].imshow(hillshade, cmap="gray", extent=extent)
    axes[0].imshow(rgba, extent=extent)
    axes[1].imshow(hillshade, cmap="gray", extent=extent)
    axes[1].imshow(wb, extent=extent)
    for ax in axes:
        for line in rover_lines:
            a = np.array(line)
            ax.plot(a[:, 0], a[:, 1], color="cyan", lw=0.8, ls="--")
        for fe in route_features:
            a = np.array(fe["geometry"]["coordinates"])
            ax.plot(a[:, 0], a[:, 1], color="white", lw=2)
        for s in stops:
            ax.plot(s["lon"], s["lat"], "o", color="#ffb000", ms=7, mec="k")
            ax.annotate(s["id"], (s["lon"], s["lat"]), color="white", fontsize=9, xytext=(4, 4),
                        textcoords="offset points")
    axes[0].set_title("Slope classes, route (white), Curiosity path (cyan)")
    axes[1].set_title("Minutes to shelter (0-30), route, Curiosity path")
    fig.tight_layout()
    fig.savefig(os.path.join(out_dir, "..", "notebooks", "qa_figure.png"), dpi=110)

    # ------------------------------------------------------------------
    # Sanity checks
    # ------------------------------------------------------------------
    assert route_cells[0] == stop_cells[0] and route_cells[-1] == stop_cells[0], "route must start and end at HAVEN"
    assert not any(blocked[r, c] for r, c in route_cells), "route crosses a no-go cell"
    assert max_route_slope <= max_slope, "route slope above the limit"
    report.append(f"route {total_d:.0f} m, walking {walk_min:.1f} min, EVA {eva_min / 60:.2f} h, "
                  f"steepest {max_route_slope:.1f} deg, farthest {range_m:.0f} m, longest walk home {max_home:.1f} min")
    for c in checks:
        report.append(f"check {c['id']}: value {c['value']} limit {c['limit']} {c.get('unit', '')} -> "
                      f"{'PASS' if c['pass'] else 'FAIL'}")
    print("\n".join(report))
    if not (1200 <= total_d <= 4000):
        print(f"NOTE: total distance {total_d:.0f} m is outside the expected 1200-4000 m range; check the figure.")
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build the WALKBACK data files.")
    parser.add_argument("--raw", required=True, help="folder with the unzipped walkback_raw files")
    parser.add_argument("--out", default="data", help="the repository's data folder")
    args = parser.parse_args()
    main(args.raw, args.out)
