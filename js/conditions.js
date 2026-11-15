// AI-assisted: written with Claude Code (Opus 5.5), reviewed by the team.
//
// conditions.js fills the Conditions tab: weather Curiosity measured here,
// the EVA daylight window, radiation, and the solar storm drill.
// Build step T13. It waits for plan.js to finish ("walkback:plan-ready").
//
// Shared with the HUD (hud.js):
//   WALKBACK.crewIndex    the crew's position, as an index into WALKBACK.profile.samples
//   "walkback:crew-moved" event fired whenever crewIndex changes
//                         (event.detail = { index: number, source: "conditions" or "hud" })
//   WALKBACK.stormActive  true while the storm drill is running
//   "walkback:storm"      event fired when the drill starts or stands down
//                         (event.detail = { active: true or false })

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

  function link(url, text) {
    return el("a", { href: url, target: "_blank", rel: "noopener", text: text });
  }

  // A number with its unit, or "no data" when the feed had no value.
  function withUnit(value, unit) {
    if (value === null || value === undefined || value === "") { return "no data"; }
    return value + " " + unit;
  }

  // "05:22" -> 322 minutes after local midnight. Returns null if missing.
  function clockToMin(text) {
    if (!text || !/^\d{1,2}:\d{2}$/.test(text)) { return null; }
    var parts = text.split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  // 322 -> "05:22"
  function minToClock(min) {
    var m = Math.round(min);
    var h = Math.floor(m / 60);
    var r = m - h * 60;
    return (h < 10 ? "0" : "") + h + ":" + (r < 10 ? "0" : "") + r;
  }

  // 206.3 -> "3 h 26 min"
  function duration(min) {
    var m = Math.round(min);
    var h = Math.floor(m / 60);
    return (h ? h + " h " : "") + (m - h * 60) + " min";
  }

  // PASS / FAIL as a word plus an icon (never colour alone).
  function resultBadge(pass) {
    var unknown = pass === null || pass === undefined;
    return el("span", { class: "result " + (unknown ? "unknown" : pass ? "pass" : "fail") }, [
      WALKBACK.icon(unknown ? "info" : pass ? "check" : "cross"),
      unknown ? "NO DATA" : pass ? "PASS" : "FAIL"
    ]);
  }

  // ------------------------------------------------------------------
  // Shared crew position (also used by the HUD)
  // ------------------------------------------------------------------

  function setCrewIndex(index, source) {
    var samples = WALKBACK.profile.samples;
    var i = Math.max(0, Math.min(samples.length - 1, Math.round(index)));
    WALKBACK.crewIndex = i;
    document.dispatchEvent(new CustomEvent("walkback:crew-moved", { detail: { index: i, source: source } }));
  }

  // ------------------------------------------------------------------
  // State for this tab
  // ------------------------------------------------------------------

  var weather, escape, spe, stats, sources, config, map;
  var stopsById = {};
  var crewDot = null;          // the crew's dot on the main map
  var escapeLayer = null;      // the highlighted escape path
  var banner = null;           // the red alert banner over the map
  var drill = {};              // elements of the drill panel

  // ------------------------------------------------------------------
  // 1-2. Sol picker and weather card
  // ------------------------------------------------------------------

  function buildWeatherSection(tab) {
    tab.appendChild(el("p", { class: "replay-label", text: "Replay of conditions Curiosity measured here, not a forecast" }));

    // Sol picker (oldest first) with the Earth date beside it.
    var select = el("select", { id: "sol-picker", class: "sol-picker" });
    var sols = weather.sols.slice().sort(function (a, b) { return a.sol - b.sol; });
    sols.forEach(function (s) {
      var opt = el("option", { value: String(s.sol), text: "Sol " + s.sol });
      select.appendChild(opt);
    });
    var wanted = config.default_sol;
    var hasDefault = sols.some(function (s) { return s.sol === wanted; });
    select.value = String(hasDefault ? wanted : sols[sols.length - 1].sol);

    var dateText = el("span", { class: "sol-date" });
    tab.appendChild(el("div", { class: "sol-row" }, [
      el("label", { for: "sol-picker", text: "Sol" , class: "visually-hidden" }),
      select,
      dateText
    ]));

    var weatherCard = el("div", { class: "cond-card" });
    var windowCard = el("div", { class: "cond-card" });
    tab.appendChild(el("h3", { text: "Weather on this sol" }));
    tab.appendChild(weatherCard);
    tab.appendChild(el("h3", { text: "EVA daylight window" }));
    tab.appendChild(windowCard);

    function render() {
      var sol = Number(select.value);
      var day = sols.filter(function (s) { return s.sol === sol; })[0];
      dateText.textContent = "Earth date " + (day.date || "no data");
      renderWeather(weatherCard, day);
      renderWindow(windowCard, day);
    }
    select.addEventListener("change", render);
    render();
  }

  function renderWeather(card, day) {
    card.innerHTML = "";
    var rows = [
      ["Air temperature, min / max", withUnit(day.air_min_c, "deg C") + " / " + withUnit(day.air_max_c, "deg C")],
      ["Ground temperature, min / max", withUnit(day.ground_min_c, "deg C") + " / " + withUnit(day.ground_max_c, "deg C")],
      ["Air pressure", withUnit(day.pressure_pa, "Pa")],
      ["UV index", day.uv || "no data"],
      ["Sky", day.opacity || "no data"],
      ["Sunrise", day.sunrise ? day.sunrise + " local time" : "no data"],
      ["Sunset", day.sunset ? day.sunset + " local time" : "no data"]
    ];
    var dl = el("dl", { class: "totals" });
    rows.forEach(function (r) {
      dl.appendChild(el("dt", { text: r[0] }));
      dl.appendChild(el("dd", { text: r[1] }));
    });
    card.appendChild(dl);
    card.appendChild(el("p", { class: "small-note",
      text: "The feed does not state units; deg C and Pa are the convention." }));
    var rems = sources.rems;
    if (rems) {
      card.appendChild(el("p", { class: "small-note" }, ["Data: " + rems.citation + " ", link(rems.url, "source")]));
    }
  }

  // ------------------------------------------------------------------
  // 3. EVA window card with a 24-hour bar
  // ------------------------------------------------------------------

  function renderWindow(card, day) {
    card.innerHTML = "";
    var rise = clockToMin(day.sunrise), set = clockToMin(day.sunset);
    var marginMin = config.limits.daylight_margin_h * 60;
    var evaMin = stats.eva_time_min;

    if (rise === null || set === null) {
      card.appendChild(el("p", {}, ["No sunrise or sunset recorded for this sol, so the window cannot be checked. ", resultBadge(null)]));
      return;
    }

    var winStart = rise + marginMin, winEnd = set - marginMin;
    var evaEnd = winStart + evaMin;
    var pass = evaEnd <= winEnd;

    card.appendChild(buildDayBar(rise, set, winStart, winEnd, winStart, evaEnd));

    var dl = el("dl", { class: "totals" });
    [["Window", minToClock(winStart) + " to " + minToClock(winEnd)],
     ["Planned EVA", minToClock(winStart) + " to " + minToClock(evaEnd)],
     ["EVA length", duration(evaMin)]].forEach(function (r) {
      dl.appendChild(el("dt", { text: r[0] }));
      dl.appendChild(el("dd", { text: r[1] }));
    });
    card.appendChild(dl);
    card.appendChild(el("p", { class: "check-line" }, [el("strong", { text: "EVA fits the window: " }), resultBadge(pass)]));
    card.appendChild(el("div", { class: "assumption",
      text: "ASSUMPTION: the window runs from " + config.limits.daylight_margin_h + " h after sunrise to " +
            config.limits.daylight_margin_h + " h before sunset, and the EVA starts when the window opens." }));
    card.appendChild(el("div", { class: "assumption",
      text: "ASSUMPTION: EVA minutes are placed on the local-time clock as if one local hour were 60 minutes. A sol is 24.66 h, so a local hour is slightly longer and this is a cautious fit." }));
  }

  // A 24-hour bar drawn as inline SVG: night, margins, window and the planned EVA.
  function buildDayBar(rise, set, winStart, winEnd, evaStart, evaEnd) {
    var ns = "http://www.w3.org/2000/svg";
    var W = 328, H = 78, L0 = 4, R0 = 4, trackY = 10, trackH = 20, evaY = 36, evaH = 12;
    function x(min) { return L0 + Math.max(0, Math.min(1440, min)) / 1440 * (W - L0 - R0); }

    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "daybar");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label",
      "24-hour bar. Night until " + minToClock(rise) + " and after " + minToClock(set) +
      ". Safety margins until " + minToClock(winStart) + " and after " + minToClock(winEnd) +
      ". Planned EVA " + minToClock(evaStart) + " to " + minToClock(evaEnd) + ".");

    function rect(x1, x2, y, h, attrs) {
      var r = document.createElementNS(ns, "rect");
      r.setAttribute("x", x(x1)); r.setAttribute("width", Math.max(0, x(x2) - x(x1)));
      r.setAttribute("y", y); r.setAttribute("height", h);
      Object.keys(attrs).forEach(function (k) { r.setAttribute(k, attrs[k]); });
      svg.appendChild(r);
    }
    function text(xm, y, t, anchor) {
      var n = document.createElementNS(ns, "text");
      n.setAttribute("x", x(xm)); n.setAttribute("y", y);
      n.setAttribute("class", "axis");
      n.setAttribute("text-anchor", anchor || "middle");
      n.textContent = t;
      svg.appendChild(n);
    }

    // Hatching for the margins, so they differ from the window by pattern, not only colour.
    var defs = document.createElementNS(ns, "defs");
    defs.innerHTML = '<pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
                     '<rect width="5" height="5" fill="#2a3446"/><line x1="0" y1="0" x2="0" y2="5" stroke="#9aa7b6" stroke-width="1.5"/></pattern>';
    svg.appendChild(defs);

    rect(0, rise, trackY, trackH, { fill: "#05070a", stroke: "#263142" });          // night
    rect(set, 1440, trackY, trackH, { fill: "#05070a", stroke: "#263142" });        // night
    rect(rise, winStart, trackY, trackH, { fill: "url(#hatch)" });                 // margin
    rect(winEnd, set, trackY, trackH, { fill: "url(#hatch)" });                    // margin
    rect(winStart, winEnd, trackY, trackH, { fill: "#1d3b33", stroke: "#3ddc97" }); // window
    rect(evaStart, evaEnd, evaY, evaH, { fill: "#ffb000" });                        // planned EVA

    text(rise / 2, trackY + 14, "night");
    text((set + 1440) / 2, trackY + 14, "night");
    text((winStart + winEnd) / 2, trackY + 14, "window");
    [0, 360, 720, 1080, 1440].forEach(function (m, i) {
      text(m, H - 4, minToClock(m), i === 0 ? "start" : i === 4 ? "end" : "middle");
    });
    text(evaEnd + 4 > 1300 ? evaStart : evaEnd, evaY + 10, "  EVA", evaEnd + 4 > 1300 ? "end" : "start");

    var wrap = el("div", { class: "daybar-wrap" });
    wrap.appendChild(svg);
    wrap.appendChild(el("div", { class: "daybar-key" }, [
      el("span", { class: "key key-night", "aria-hidden": "true" }), "night ",
      el("span", { class: "key key-margin", "aria-hidden": "true" }), "margin ",
      el("span", { class: "key key-window", "aria-hidden": "true" }), "window ",
      el("span", { class: "key key-eva", "aria-hidden": "true" }), "planned EVA"
    ]));
    return wrap;
  }

  // ------------------------------------------------------------------
  // 4. Radiation card
  // ------------------------------------------------------------------

  function buildRadiationSection(tab) {
    tab.appendChild(el("h3", { text: "Radiation" }));
    var card = el("div", { class: "cond-card" });
    var dl = el("dl", { class: "totals" });
    dl.appendChild(el("dt", { text: "Surface dose at Gale (dose equivalent)" }));
    var dd1 = el("dd", { text: "0.64 mSv per day " });
    if (sources.rad) { dd1.appendChild(link(sources.rad.url, "source")); }
    dl.appendChild(dd1);
    dl.appendChild(el("dt", { text: "This EVA (cosmic rays)" }));
    var dd2 = el("dd", { text: stats.gcr_dose_msv + " mSv" });
    dd2.appendChild(el("div", { class: "assumption",
      text: "ASSUMPTION: EVA hours x " + config.limits.gcr_msv_per_h + " mSv/h (0.64 mSv per sol spread over 24.66 h)" }));
    dl.appendChild(dd2);
    card.appendChild(dl);
    card.appendChild(el("p", { class: "small-note",
      text: "Cosmic-ray dose builds up indoors and outdoors alike; what an EVA changes is exposure during a solar storm." }));
    tab.appendChild(card);
  }

  // ------------------------------------------------------------------
  // 5. Solar storm drill
  // ------------------------------------------------------------------

  function buildDrillSection(tab) {
    tab.appendChild(el("h3", { text: "Solar storm drill" }));
    var card = el("div", { class: "cond-card drill-card" });

    var startBtn = el("button", { class: "drill-btn", type: "button", text: "Run storm drill (20 May 2024 replay)" });
    card.appendChild(startBtn);
    card.appendChild(el("div", { class: "assumption",
      text: "ASSUMPTION: on alert, stop science and take the fastest safe path to the haven." }));

    // Controls shown only while the drill runs.
    var active = el("div", { class: "drill-active", hidden: "" });
    var samples = WALKBACK.profile.samples;
    var slider = el("input", { type: "range", id: "crew-slider", min: "0", max: String(samples.length - 1), step: "1", value: "0",
      "aria-label": "Crew position along the route" });
    var position = el("div", { class: "drill-position" });
    var shelter = el("div", { class: "drill-shelter", "aria-live": "polite" });
    var escapeText = el("div", { class: "small-note" });
    var standDown = el("button", { class: "stop-fly", type: "button", text: "Stand down" });

    active.appendChild(el("label", { for: "crew-slider", class: "drill-label", text: "Crew position along the route" }));
    active.appendChild(slider);
    active.appendChild(position);
    active.appendChild(shelter);
    active.appendChild(el("div", { class: "assumption",
      text: "ASSUMPTION: minutes to shelter treat every slope as uphill (cautious)." }));
    active.appendChild(escapeText);
    active.appendChild(standDown);
    card.appendChild(active);
    tab.appendChild(card);

    drill = { startBtn: startBtn, active: active, slider: slider, position: position, shelter: shelter, escapeText: escapeText };

    startBtn.addEventListener("click", startDrill);
    standDown.addEventListener("click", standDownDrill);
    slider.addEventListener("input", function () { setCrewIndex(Number(slider.value), "conditions"); });
  }

  function buildBanner() {
    var box = el("div", { class: "storm-banner", role: "alert", hidden: "" }, [
      el("div", { class: "storm-title" }, [
        WALKBACK.icon("alert"),
        "ALERT: " + spe.name + " (drill)"
      ]),
      el("div", { text: spe.note }),
      el("div", { text: "Dose measured by Curiosity RAD at the surface: " + spe.dose_ugy + " microgray (µGy)." }),
      el("div", { class: "storm-rule", text: "ASSUMPTION: stop science and take the fastest safe path to the haven." }),
      el("div", {}, [link(spe.source_url, "Source: NASA/JPL")])
    ]);
    document.querySelector(".map-wrap").appendChild(box);
    return box;
  }

  function startDrill() {
    WALKBACK.stormActive = true;
    banner.hidden = false;
    drill.active.hidden = false;
    drill.startBtn.disabled = true;
    document.dispatchEvent(new CustomEvent("walkback:storm", { detail: { active: true } }));
    // Start from the crew's current position (0 = at the haven if nobody has moved it).
    setCrewIndex(typeof WALKBACK.crewIndex === "number" ? WALKBACK.crewIndex : 0, "conditions");
  }

  function standDownDrill() {
    WALKBACK.stormActive = false;
    banner.hidden = true;
    drill.active.hidden = true;
    drill.startBtn.disabled = false;
    if (escapeLayer) { map.removeLayer(escapeLayer); escapeLayer = null; }
    if (crewDot) { map.removeLayer(crewDot); }
    document.dispatchEvent(new CustomEvent("walkback:storm", { detail: { active: false } }));
    drill.startBtn.focus();
  }

  // Which science stop is nearest the crew (straight line, in Mars metres)?
  function nearestEscape(sample) {
    var here = L.latLng(sample.lat, sample.lon);
    var best = null, bestD = Infinity;
    escape.features.forEach(function (f) {
      var stop = stopsById[f.properties.stop];
      if (!stop) { return; }
      var d = map.distance(here, L.latLng(stop.lat, stop.lon));
      if (d < bestD) { bestD = d; best = f; }
    });
    return best;
  }

  // Called whenever the crew moves (from the slider here or from the HUD).
  function onCrewMoved(e) {
    var samples = WALKBACK.profile.samples;
    var i = e.detail.index;
    var s = samples[i];

    // The crew dot on the main map.
    if (!crewDot) {
      crewDot = L.circleMarker([s.lat, s.lon], {
        radius: 8, color: "#0b0f14", weight: 3, fillColor: "#ffffff", fillOpacity: 1, interactive: true
      }).bindTooltip("Crew");
    }
    crewDot.setLatLng([s.lat, s.lon]);
    if (!map.hasLayer(crewDot)) { crewDot.addTo(map); }

    if (e.detail.source !== "conditions") { drill.slider.value = String(i); }

    var legFeature = WALKBACK.route.features.filter(function (f) { return f.properties.leg === s.leg; })[0];
    var legText = legFeature ? " (leg " + s.leg + ": " + legFeature.properties.from + " to " + legFeature.properties.to + ")" : "";
    drill.position.textContent = Math.round(s.d_m) + " m along the route" + legText;
    drill.shelter.textContent = "Shelter in " + s.t_home_min.toFixed(1) + " min";

    if (!WALKBACK.stormActive) { return; }

    // Highlight the escape path of the nearest stop in red.
    var f = nearestEscape(s);
    if (escapeLayer) { map.removeLayer(escapeLayer); escapeLayer = null; }
    if (f) {
      escapeLayer = L.layerGroup([
        L.geoJSON(f, { style: { color: "#0b0f14", weight: 9, opacity: 0.9 }, interactive: false }),
        L.geoJSON(f, { style: { color: "#ff5c5c", weight: 5, opacity: 1, dashArray: "10 6" }, interactive: false })
      ]).addTo(map);
      crewDot.bringToFront();
      var stop = stopsById[f.properties.stop];
      drill.escapeText.textContent = "Red dashed line: fastest safe path to the haven from the nearest stop, " +
        stop.name + " (" + Number(f.properties.walk_min).toFixed(1) + " min walk).";
    }
  }

  // ------------------------------------------------------------------
  // Start once plan.js has loaded the route data
  // ------------------------------------------------------------------

  document.addEventListener("walkback:plan-ready", function () {
    map = WALKBACK.map;
    stats = WALKBACK.stats;
    sources = WALKBACK.sources;
    config = WALKBACK.config;
    WALKBACK.stops.forEach(function (s) { stopsById[s.id] = s; });
    WALKBACK.stormActive = false;
    if (typeof WALKBACK.crewIndex !== "number") { WALKBACK.crewIndex = 0; }

    Promise.all([
      loadJson("data/weather.json"),
      loadJson("data/escape.geojson"),
      loadJson("data/spe_scenario.json")
    ]).then(function (r) {
      weather = r[0]; escape = r[1]; spe = r[2];
      var tab = document.getElementById("tab-conditions");
      tab.innerHTML = "";
      buildWeatherSection(tab);
      buildRadiationSection(tab);
      buildDrillSection(tab);
      banner = buildBanner();

      // 6. Live space weather near Earth (a link only; no API calls).
      tab.appendChild(el("p", { class: "small-note donki" }, [
        "Live solar events near Earth are listed by ",
        link("https://ccmc.gsfc.nasa.gov/tools/DONKI", "NASA DONKI")
      ]));

      document.addEventListener("walkback:crew-moved", onCrewMoved);
      WALKBACK.setCrewIndex = setCrewIndex;   // the HUD may use this helper
    }).catch(function (err) {
      console.error(err);
      var tab = document.getElementById("tab-conditions");
      tab.innerHTML = "";
      tab.appendChild(el("p", { class: "placeholder", text: "The conditions data could not load. Details: " + err.message }));
    });
  });

})();
