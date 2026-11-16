// AI-assisted: written with Claude Code (Opus 5.5), reviewed by the team.
//
// plan.js draws the computed data on the map and fills the Plan tab.
// It waits for app.js to finish building the map ("walkback:ready"),
// then loads the files that notebooks/pipeline.py wrote.
//
// The Plan tab reads top to bottom like a briefing:
//   1. the verdict (do all safety checks pass?)
//   2. four key numbers, led by minutes to shelter
//   3. foldable details: checks, elevation profile, legs, time and dose, ground truth
// Above the map, a row of buttons switches between the main map views.

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  function loadJson(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) { throw new Error("Could not load " + path + " (HTTP " + r.status + ")"); }
      return r.json();
    });
  }

  // Build an HTML element: el("div", {class: "x"}, ["text", childNode, ...])
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") { node.className = attrs[k]; }
      else if (k === "text") { node.textContent = attrs[k]; }
      else { node.setAttribute(k, attrs[k]); }
    });
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function fmtNumber(value, digits) {
    if (value === null || value === undefined || isNaN(value)) { return "no data"; }
    return Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function fmtMinutes(min) {
    var h = Math.floor(min / 60);
    var m = Math.round(min - h * 60);
    if (m === 60) { h += 1; m = 0; }
    return (h > 0 ? h + " h " : "") + m + " min";
  }

  // Compass bearing (degrees clockwise from north) from point a to point b on a sphere.
  function bearingDeg(a, b) {
    var toRad = Math.PI / 180;
    var lat1 = a[1] * toRad, lat2 = b[1] * toRad, dLon = (b[0] - a[0]) * toRad;
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) / toRad + 360) % 360;
  }

  function sourceLink(sources, id) {
    var s = sources[id];
    if (!s) { return document.createTextNode(""); }
    if (!s.url) { return el("span", { class: "source", title: s.citation, text: "source" }); }
    return el("a", { class: "source", href: s.url, target: "_blank", rel: "noopener", title: s.citation, text: "source" });
  }

  // PASS / FAIL as a word plus an icon (never colour alone).
  function resultBadge(pass) {
    var unknown = pass === null || pass === undefined;
    var badge = el("span", { class: "result " + (unknown ? "unknown" : pass ? "pass" : "fail") });
    badge.appendChild(WALKBACK.icon(unknown ? "info" : pass ? "check" : "cross"));
    badge.appendChild(document.createTextNode(unknown ? "NO DATA" : pass ? "PASS" : "FAIL"));
    return badge;
  }

  // A foldable section: <details><summary>title</summary> ...content</details>
  function section(title, open, children) {
    var d = el("details", { class: "fold" }, [el("summary", { text: title })]);
    if (open) { d.open = true; }
    var body = el("div", { class: "fold-body" }, children);
    d.appendChild(body);
    return d;
  }

  // ------------------------------------------------------------------
  // Map layers
  // ------------------------------------------------------------------

  var LAYER_NAMES = {
    ortho: "Colour image of the site (HiRISE, USGS)",
    hillshade: "Terrain shading (1 m elevation model)",
    slope: "Slope",
    walkback: "Minutes to shelter"
  };

  function addOverlays(map, overlays) {
    var layers = {};
    ["ortho", "hillshade", "slope", "walkback"].forEach(function (key) {
      var o = overlays[key];
      if (!o) { return; }
      var layer = L.imageOverlay(o.file, o.bounds, {
        opacity: o.opacity,
        interactive: false,
        className: "overlay-" + key
      });
      layer.walkbackKey = key;
      layers[key] = layer;
      WALKBACK.layerControl.addOverlay(layer, LAYER_NAMES[key]);
    });
    return layers;
  }

  // A legend box that shows the key for whichever overlays are switched on.
  function addLegend(map, overlays, layers) {
    // On phones the bottom of the small map is busy with the route, so the
    // legend goes to the top-left corner, under the view buttons.
    var isSmall = window.matchMedia && window.matchMedia("(max-width: 800px)").matches;
    var LegendControl = L.Control.extend({
      options: { position: isSmall ? "topleft" : "bottomleft" },
      onAdd: function () {
        this._div = L.DomUtil.create("div", "legend");
        this._div.setAttribute("role", "region");
        this._div.setAttribute("aria-label", "Map legend");
        L.DomEvent.disableClickPropagation(this._div);
        return this._div;
      },
      update: function () {
        var div = this._div;
        div.innerHTML = "";
        var any = false;
        [["slope", "Slope"], ["walkback", "Walking minutes back to the rover"], ["hillshade", "Terrain shading"], ["ortho", "Colour image"]]
          .forEach(function (pair) {
            var key = pair[0];
            if (!layers[key] || !map.hasLayer(layers[key])) { return; }
            any = true;
            var block = el("div", { class: "legend-block" }, [el("div", { class: "legend-title", text: pair[1] })]);
            var items = overlays[key].legend || [];
            if (key === "walkback" && items.length > 1) {
              // The minutes ramp is continuous, so draw it as one colour bar
              // with the first, middle and last labels underneath.
              var stopsCss = items.map(function (it, i) {
                return it.color + " " + (i / (items.length - 1) * 100).toFixed(0) + "%";
              }).join(", ");
              block.appendChild(el("div", { class: "legend-ramp", style: "background: linear-gradient(90deg, " + stopsCss + ")", "aria-hidden": "true" }));
              var mid = items[Math.floor(items.length / 2)];
              block.appendChild(el("div", { class: "legend-ramp-labels" }, [
                el("span", { text: items[0].label }),
                el("span", { text: mid.label }),
                el("span", { text: items[items.length - 1].label })
              ]));
            } else {
              items.forEach(function (item) {
                block.appendChild(el("div", { class: "legend-row" }, [
                  el("span", { class: "legend-swatch", style: "background:" + item.color, "aria-hidden": "true" }),
                  el("span", { text: item.label })
                ]));
              });
            }
            if (overlays[key].note) {
              block.appendChild(el("div", { class: "legend-note", text: "ASSUMPTION: " + overlays[key].note }));
            }
            div.appendChild(block);
          });
        div.style.display = any ? "" : "none";
      }
    });
    var legend = new LegendControl();
    legend.addTo(map);
    legend.update();
    map.on("overlayadd overlayremove", function () { legend.update(); });
    return legend;
  }

  function addCuriosity(map, curiosity) {
    var group = L.layerGroup();
    curiosity.features.forEach(function (f) {
      if (f.geometry.type === "LineString") {
        L.polyline(f.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), {
          color: "#38d6ff", weight: 2, opacity: 0.75, interactive: false   // thin solid cyan: visible, but the route stays on top
        }).addTo(group);
      } else if (f.geometry.type === "Point") {
        var c = f.geometry.coordinates;
        L.circleMarker([c[1], c[0]], {
          radius: 2.5, color: "#38d6ff", weight: 1, fillColor: "#0b0f14", fillOpacity: 1
        }).bindTooltip("Curiosity stopped here, sol " + f.properties.sol).addTo(group);
      }
    });
    WALKBACK.layerControl.addOverlay(group, "Curiosity's real path");
    group.addTo(map);
    return group;
  }

  function addRoute(map, route) {
    var group = L.layerGroup();
    route.features.forEach(function (f) {
      var latlngs = f.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
      var p = f.properties;
      // Dark outline underneath, white line on top.
      L.polyline(latlngs, { color: "#0b0f14", weight: 8, opacity: 0.9, interactive: false }).addTo(group);
      var line = L.polyline(latlngs, { color: "#ffffff", weight: 4, opacity: 1 }).addTo(group);
      line.bindTooltip(
        "<strong>Leg " + p.leg + ": " + p.from + " to " + p.to + "</strong><br>" +
        fmtNumber(p.distance_m, 0) + " m, " + fmtNumber(p.walk_min, 1) + " min walking<br>" +
        "climb " + fmtNumber(p.ascent_m, 1) + " m, descent " + fmtNumber(p.descent_m, 1) + " m<br>" +
        "steepest " + fmtNumber(p.max_slope_deg, 1) + " deg",
        { sticky: true }
      );
      line.on("mouseover", function () { line.setStyle({ color: "#ffb000", weight: 6 }); });
      line.on("mouseout", function () { line.setStyle({ color: "#ffffff", weight: 4 }); });

      // One direction arrow at the middle of each leg.
      var coords = f.geometry.coordinates;
      if (coords.length > 2) {
        var mid = Math.floor(coords.length / 2);
        var a = coords[Math.max(mid - 2, 0)], b = coords[Math.min(mid + 2, coords.length - 1)];
        var angle = bearingDeg(a, b);
        L.marker([coords[mid][1], coords[mid][0]], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "",
            html: '<div class="route-arrow" style="transform: rotate(' + angle.toFixed(0) + 'deg)">' +
                  '<svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true">' +
                  '<path d="M6 0 L12 12 L6 8.5 L0 12 Z" fill="#ffb000" stroke="#0b0f14" stroke-width="1"/></svg></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        }).addTo(group);
      }
    });
    WALKBACK.layerControl.addOverlay(group, "Planned route");
    group.addTo(map);
    // Keep stops drawn above the route.
    if (WALKBACK.stopLayer) { WALKBACK.stopLayer.eachLayer(function (m) { m.setZIndexOffset(1000); }); }
    return group;
  }

  // ------------------------------------------------------------------
  // Map view buttons (above the map)
  // ------------------------------------------------------------------
  // One data layer at a time keeps the map readable. The layer switcher
  // (top right) still allows any combination.

  var VIEWS = [
    { id: "walkback", label: "Minutes to shelter", short: "Shelter", layer: "walkback", hint: "Walking minutes back to the rover from any point" },
    { id: "slope", label: "Slope", layer: "slope", hint: "How steep every square metre is; red is too steep to walk" },
    { id: "ortho", label: "Photo", layer: "ortho", hint: "HiRISE colour image of the site" },
    { id: "route", label: "Route only", short: "Route", layer: null, hint: "Satellite image with the planned route" }
  ];

  function addViewButtons(map, layers) {
    var bar = el("div", { class: "view-bar", role: "group", "aria-label": "Map view" });
    var buttons = {};
    VIEWS.forEach(function (v) {
      if (v.layer && !layers[v.layer]) { return; }
      // A shorter label is shown on phones (CSS hides one of the two).
      var b = el("button", { type: "button", class: "view-btn", "aria-pressed": "false", title: v.hint, "aria-label": v.label }, [
        el("span", { class: "lbl-full", text: v.label }),
        el("span", { class: "lbl-short", text: v.short || v.label })
      ]);
      b.addEventListener("click", function () { setView(v.id); });
      buttons[v.id] = b;
      bar.appendChild(b);
    });
    document.querySelector(".map-wrap").appendChild(bar);

    // Show exactly one data layer (or none for "route").
    function setView(id) {
      VIEWS.forEach(function (v) {
        if (!v.layer || !layers[v.layer]) { return; }
        var want = v.id === id;
        if (want && !map.hasLayer(layers[v.layer])) { map.addLayer(layers[v.layer]); }
        if (!want && map.hasLayer(layers[v.layer])) { map.removeLayer(layers[v.layer]); }
      });
      // Leaflet only fires overlayadd/overlayremove from its own switcher, so tell the legend.
      map.fire("overlayadd");
      syncButtons();
    }

    // Keep the buttons in step if someone uses the layer switcher instead.
    function syncButtons() {
      var active = "route";
      VIEWS.forEach(function (v) { if (v.layer && layers[v.layer] && map.hasLayer(layers[v.layer])) { active = v.id; } });
      Object.keys(buttons).forEach(function (id) {
        buttons[id].setAttribute("aria-pressed", id === active ? "true" : "false");
        buttons[id].classList.toggle("is-active", id === active);
      });
    }
    map.on("overlayadd overlayremove", syncButtons);

    WALKBACK.setMapView = setView;
    setView("walkback");   // start on the signature view: minutes back to shelter from every point
  }

  // Zoom the map so the planned route fills it (the whole site box leaves
  // the route small on phones). Extra room at the top keeps the route clear
  // of the view buttons. If the window changes size before anyone has moved
  // the map, fit again.
  function fitToRoute(map, route) {
    var bounds = L.latLngBounds([]);
    route.features.forEach(function (f) {
      f.geometry.coordinates.forEach(function (c) { bounds.extend([c[1], c[0]]); });
    });
    if (!bounds.isValid()) { return; }
    var userMoved = false;   // becomes true once a person pans or zooms
    var fitting = false;     // true while we move the map ourselves
    function fit() {
      map.fitBounds(bounds, { paddingTopLeft: [24, 72], paddingBottomRight: [24, 24], animate: false });
    }
    fit();
    // Only count moves made by a person (drag, wheel, buttons), not our own fit.
    map.on("dragstart zoomstart", function () { if (!fitting) { userMoved = true; } });
    window.addEventListener("resize", function () {
      if (userMoved) { return; }
      fitting = true; fit(); fitting = false;
    });
  }

  // ------------------------------------------------------------------
  // Plan tab
  // ------------------------------------------------------------------

  function buildPlanTab(stats, route, profile, sources, map) {
    var tab = document.getElementById("tab-plan");
    tab.innerHTML = "";

    // (1) Verdict
    var total = stats.checks.length;
    var passed = stats.checks.filter(function (c) { return c.pass === true; }).length;
    var allPass = passed === total;
    var verdict = el("div", { class: "verdict " + (allPass ? "is-pass" : "is-fail") });
    verdict.appendChild(WALKBACK.icon(allPass ? "check" : "alert"));
    verdict.appendChild(el("div", {}, [
      el("div", { class: "verdict-title", text: allPass ? "EVA plan: GO · " + passed + " of " + total + " safety checks pass" : "EVA plan: NO-GO · " + (total - passed) + " of " + total + " safety checks fail" }),
      el("div", { class: "verdict-sub", text: "One pre-planned loop: from the parked rover (the shelter) through five of Curiosity's drill and imaging sites, and back. There is no destination to pick; inspect the plan." })
    ]));
    tab.appendChild(verdict);

    // (2) Key numbers
    var shelterTile = el("div", { class: "kpi kpi-hero" }, [
      el("div", { class: "kpi-label", text: "Longest walk back to shelter" }),
      el("div", { class: "kpi-value" }, [fmtNumber(stats.max_time_to_haven_min, 1), el("span", { class: "kpi-unit", text: " min" })]),
      el("div", { class: "kpi-note", text: "From the farthest point of the route back to the pressurised rover. Limit 60 min." }),
      el("div", { class: "assumption", text: "ASSUMPTION: every slope is walked as if uphill, so this is a cautious figure." })
    ]);
    var kpis = el("div", { class: "kpis" }, [
      shelterTile,
      el("div", { class: "kpi" }, [el("div", { class: "kpi-label", text: "Route" }),
        el("div", { class: "kpi-value" }, [fmtNumber(stats.total_distance_m / 1000, 2), el("span", { class: "kpi-unit", text: " km" })])]),
      el("div", { class: "kpi" }, [el("div", { class: "kpi-label", text: "EVA time" }),
        el("div", { class: "kpi-value", text: fmtMinutes(stats.eva_time_min) })]),
      el("div", { class: "kpi" }, [el("div", { class: "kpi-label", text: "Max slope" }),
        el("div", { class: "kpi-value" }, [fmtNumber(stats.max_slope_on_route_deg, 1), el("span", { class: "kpi-unit", text: " deg" })])])
    ]);
    tab.appendChild(kpis);

    // Actions: cuff.js adds the "Print cuff card" button here.
    var actions = el("div", { class: "plan-actions", id: "plan-actions" });
    tab.appendChild(actions);

    // (3) Safety checks
    var table = el("table", { class: "checks" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Check" }), el("th", { text: "Plan" }), el("th", { text: "Limit" }), el("th", { text: "Result" })
      ])])
    ]);
    var tbody = el("tbody");
    stats.checks.forEach(function (c) {
      var value = typeof c.value === "number" ? fmtNumber(c.value, c.unit === "m" ? 0 : (c.unit === "h" ? 2 : 1)) + " " + c.unit : (c.value || "no data");
      var limit = typeof c.limit === "number" ? "max " + fmtNumber(c.limit, 0) + " " + c.unit : (c.limit || "");
      var labelCell = el("td", {}, [c.label + " ", sourceLink(sources, c.source)]);
      if (c.assumption) { labelCell.appendChild(el("div", { class: "assumption", text: "ASSUMPTION: " + c.assumption })); }
      if (c.note) { labelCell.appendChild(el("div", { class: "cell-note", text: c.note })); }
      if (c.flag) { labelCell.appendChild(el("div", { class: "cell-note", text: "Note: " + c.flag })); }
      if (c.id === "daylight") {
        labelCell.appendChild(el("div", { class: "assumption",
          text: "ASSUMPTION: start 2 h after sunrise, back 2 h before sunset, on sol " + c.sol + "." }));
      }
      tbody.appendChild(el("tr", {}, [labelCell, el("td", { class: "num", text: value }), el("td", { class: "num", text: limit }), el("td", {}, [resultBadge(c.pass)])]));
    });
    table.appendChild(tbody);
    tab.appendChild(section("Safety checks", true, [table]));

    // (4) Elevation profile
    tab.appendChild(section("Elevation profile", true, [buildProfile(profile, map)]));

    // (5) Legs
    var ol = el("ol", { class: "legs" });
    route.features.forEach(function (f) {
      var p = f.properties;
      ol.appendChild(el("li", {}, [
        el("strong", { text: p.from + " → " + p.to }),
        el("span", { text: " " + fmtNumber(p.distance_m, 0) + " m, " + fmtNumber(p.walk_min, 1) + " min, steepest " + fmtNumber(p.max_slope_deg, 1) + " deg" })
      ]));
    });
    tab.appendChild(section("Route legs", false, [ol]));

    // (6) Time, climb and dose
    var totals = [
      ["Walking time", fmtMinutes(stats.walk_time_min), "ASSUMPTION: Tobler hiking speed scaled to 2 km/h on flat ground"],
      ["Science time", fmtMinutes(stats.science_time_min), "ASSUMPTION: planned minutes per stop"],
      ["Total EVA time", fmtMinutes(stats.eva_time_min)],
      ["Climb / descent", fmtNumber(stats.ascent_m, 1) + " m / " + fmtNumber(stats.descent_m, 1) + " m"],
      ["Farthest from shelter", fmtNumber(stats.max_range_from_haven_m, 0) + " m in a straight line"],
      ["Radiation dose (cosmic rays)", fmtNumber(stats.gcr_dose_msv, 3) + " mSv", "ASSUMPTION: 0.64 mSv per sol spread evenly over the day"]
    ];
    var dl = el("dl", { class: "totals" });
    totals.forEach(function (t) {
      dl.appendChild(el("dt", { text: t[0] }));
      var dd = el("dd", {}, [t[1]]);
      if (t[2]) { dd.appendChild(el("div", { class: "assumption", text: t[2] })); }
      dl.appendChild(dd);
    });
    tab.appendChild(section("Time, climb and dose", false, [
      dl,
      el("p", { class: "small-note",
        text: "Cosmic-ray dose builds up indoors and outdoors alike, so one walk adds little. What the walk changes is exposure during a solar storm, which is why the headline is minutes to shelter." })
    ]));

    // (7) Ground truth
    var rc = stats.rover_check || {};
    if (rc.max_slope_on_rover_path_deg !== null && rc.max_slope_on_rover_path_deg !== undefined) {
      var gt = [el("p", {}, [
        "Curiosity's real path across this site, laid over our slope map: " +
        fmtNumber(rc.pct_rover_path_under_20deg, 1) + "% of it lies on ground under 20 deg. Median slope " +
        fmtNumber(rc.median_slope_on_rover_path_deg, 1) + " deg, 95th percentile " +
        fmtNumber(rc.p95_slope_on_rover_path_deg, 1) + " deg, steepest single reading " +
        fmtNumber(rc.max_slope_on_rover_path_deg, 1) + " deg. ",
        sourceLink(sources, "rover")
      ])];
      if (rc.note) { gt.push(el("p", { class: "small-note", text: rc.note })); }
      tab.appendChild(section("Ground-truth check against Curiosity", false, gt));
    }
  }

  // Elevation profile drawn as inline SVG (no chart library).
  function buildProfile(profile, map) {
    var s = profile.samples;
    var W = 328, H = 150, padL = 38, padR = 8, padT = 10, padB = 26;
    var maxD = s[s.length - 1].d_m;
    var zs = s.map(function (p) { return p.elev_m; });
    var zMin = Math.floor(Math.min.apply(null, zs)), zMax = Math.ceil(Math.max.apply(null, zs));
    if (zMax - zMin < 10) { zMax = zMin + 10; }
    function x(d) { return padL + (d / maxD) * (W - padL - padR); }
    function y(z) { return padT + (1 - (z - zMin) / (zMax - zMin)) * (H - padT - padB); }

    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "profile");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Elevation along the route, from " + zMin + " m to " + zMax + " m over " + Math.round(maxD) + " m of walking");

    function add(tag, attrs, text) {
      var n = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (text) { n.textContent = text; }
      svg.appendChild(n);
      return n;
    }

    // Area and line
    var d = s.map(function (p, i) { return (i ? "L" : "M") + x(p.d_m).toFixed(1) + "," + y(p.elev_m).toFixed(1); }).join(" ");
    add("path", { d: d + " L" + x(maxD).toFixed(1) + "," + (H - padB) + " L" + padL + "," + (H - padB) + " Z", fill: "rgba(255,176,0,0.12)" });
    add("path", { d: d, fill: "none", stroke: "#ffb000", "stroke-width": "1.6" });

    // Axes labels
    add("text", { x: 2, y: y(zMax) + 4, class: "axis" }, zMax + " m");
    add("text", { x: 2, y: y(zMin) + 4, class: "axis" }, zMin + " m");
    add("line", { x1: padL, x2: W - padR, y1: H - padB, y2: H - padB, stroke: "#263142" });
    add("text", { x: padL, y: H - 8, class: "axis" }, "0");
    add("text", { x: W - padR, y: H - 8, class: "axis", "text-anchor": "end" }, (maxD / 1000).toFixed(2) + " km");

    // Stop markers where the leg number changes
    var stops = WALKBACK.stops;
    var lastLeg = s[0].leg;
    var marks = [{ d: 0, label: "H" }];
    s.forEach(function (p) {
      if (p.leg !== lastLeg) {
        var idx = p.leg - 1; // leg n ends at stop n (stop 0 = HAVEN)
        marks.push({ d: p.d_m, label: idx < stops.length ? String(idx) : "H" });
        lastLeg = p.leg;
      }
    });
    marks.push({ d: maxD, label: "H" });
    marks.forEach(function (m) {
      add("line", { x1: x(m.d), x2: x(m.d), y1: padT, y2: H - padB, stroke: "#9aa7b6", "stroke-dasharray": "2 3", "stroke-width": "0.8" });
      add("text", { x: x(m.d), y: padT + 8, class: "axis", "text-anchor": "middle" }, m.label);
    });

    // Hover: a dot on the profile and on the map
    var dot = add("circle", { r: 3.5, fill: "#ffffff", stroke: "#0b0f14", cx: -10, cy: -10 });
    var mapDot = L.circleMarker([0, 0], { radius: 6, color: "#0b0f14", weight: 2, fillColor: "#ffffff", fillOpacity: 1, interactive: false });
    var readout = el("div", { class: "profile-readout", text: "H = rover (haven), 1-5 = stops. Move along the profile to follow the route on the map." });

    function onMove(evt) {
      var rect = svg.getBoundingClientRect();
      var clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      var px = (clientX - rect.left) / rect.width * W;
      var dm = Math.max(0, Math.min(maxD, (px - padL) / (W - padL - padR) * maxD));
      var i = Math.min(s.length - 1, Math.round(dm / profile.step_m));
      var p = s[i];
      dot.setAttribute("cx", x(p.d_m));
      dot.setAttribute("cy", y(p.elev_m));
      mapDot.setLatLng([p.lat, p.lon]);
      if (!map.hasLayer(mapDot)) { mapDot.addTo(map); }
      readout.textContent = fmtNumber(p.d_m, 0) + " m along, elevation " + fmtNumber(p.elev_m, 1) + " m, slope " +
        fmtNumber(p.slope_deg, 1) + " deg, " + fmtNumber(p.t_home_min, 1) + " min from shelter";
    }
    svg.addEventListener("mousemove", onMove);
    svg.addEventListener("touchmove", onMove, { passive: true });
    svg.addEventListener("mouseleave", function () { map.removeLayer(mapDot); });

    var wrap = el("div", { class: "profile-wrap" });
    wrap.appendChild(svg);
    wrap.appendChild(readout);
    return wrap;
  }

  // ------------------------------------------------------------------
  // Click on the map: position and straight-line distance to the haven
  // ------------------------------------------------------------------

  function addClickPopup(map) {
    var haven = WALKBACK.stops.filter(function (s) { return s.role === "haven"; })[0];
    map.on("click", function (e) {
      var d = map.distance(e.latlng, L.latLng(haven.lat, haven.lon)); // uses the Mars radius
      var lat = e.latlng.lat, lon = e.latlng.lng;
      L.popup()
        .setLatLng(e.latlng)
        .setContent(
          Math.abs(lat).toFixed(5) + (lat < 0 ? " S" : " N") + ", " + Math.abs(lon).toFixed(5) + (lon < 0 ? " W" : " E") +
          "<br>" + fmtNumber(d, 0) + " m in a straight line to the haven")
        .openOn(map);
    });
  }

  // ------------------------------------------------------------------
  // Start once the map exists
  // ------------------------------------------------------------------

  document.addEventListener("walkback:ready", function () {
    var map = WALKBACK.map;
    Promise.all([
      loadJson("data/overlays.json"),
      loadJson("data/route.geojson"),
      loadJson("data/profile.json"),
      loadJson("data/stats.json"),
      loadJson("data/curiosity.geojson"),
      loadJson("data/sources.json")
    ]).then(function (r) {
      var overlays = r[0], route = r[1], profile = r[2], stats = r[3], curiosity = r[4], sources = r[5];
      WALKBACK.route = route;
      WALKBACK.profile = profile;
      WALKBACK.stats = stats;
      WALKBACK.sources = sources;
      var layers = addOverlays(map, overlays);
      WALKBACK.overlayLayers = layers;
      addLegend(map, overlays, layers);
      addCuriosity(map, curiosity);
      addRoute(map, route);
      addViewButtons(map, layers);
      fitToRoute(map, route);
      buildPlanTab(stats, route, profile, sources, map);
      addClickPopup(map);
      document.dispatchEvent(new CustomEvent("walkback:plan-ready"));
    }).catch(function (err) {
      console.error(err);
      var tab = document.getElementById("tab-plan");
      tab.innerHTML = "";
      tab.appendChild(el("p", { class: "placeholder",
        text: "The route data has not been generated yet. Run notebooks/pipeline.py (see README). Details: " + err.message }));
    });
  });

})();
