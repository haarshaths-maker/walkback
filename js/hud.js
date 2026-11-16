// AI-assisted: written with Claude Code (Opus 5.5), reviewed by the team.
//
// hud.js is the helmet HUD: a full-screen visor view with six readouts at the
// edges (the centre stays clear so the crew can see the ground), a north-up
// mini-map, and a walk simulator that moves the crew along the route.
// Build step T14. Loaded last. It waits for plan.js ("walkback:plan-ready").
//
// It shares the crew position with the storm drill in conditions.js:
//   WALKBACK.crewIndex    index into WALKBACK.profile.samples
//   "walkback:crew-moved" fired whenever crewIndex changes (detail.source says who moved it)
//   WALKBACK.stormActive  and the "walkback:storm" event: show or hide the ALERT banner

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

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

  function loadJson(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) { throw new Error("Could not load " + path + " (HTTP " + r.status + ")"); }
      return r.json();
    });
  }

  // Minutes as h:mm, for example 83.4 -> "1:23".
  function hmm(minutes) {
    var total = Math.floor(minutes);
    var h = Math.floor(total / 60);
    var m = total - h * 60;
    return h + ":" + (m < 10 ? "0" : "") + m;
  }

  // Compass bearing (degrees clockwise from north, 0 = north) from point a to
  // point b, computed on a sphere from longitude and latitude in degrees.
  function bearingDeg(lonA, latA, lonB, latB) {
    var toRad = Math.PI / 180;
    var lat1 = latA * toRad, lat2 = latB * toRad, dLon = (lonB - lonA) * toRad;
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) / toRad + 360) % 360;
  }

  // 16-point compass letters for a bearing.
  var COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  function compassLetters(deg) {
    return COMPASS[Math.round(deg / 22.5) % 16];
  }

  // Slope word and SPEC section 9 colour. The word always appears, so colour is never the only signal.
  function slopeClass(deg) {
    var a = Math.abs(deg);
    if (a < 5) { return { word: "EASY", color: "transparent" };  }  // under 5 deg: no colour in SPEC
    if (a < 10) { return { word: "EASY", color: "#abd9e9" }; }
    if (a < 15) { return { word: "CAUTION", color: "#ffffbf" }; }
    if (a <= 20) { return { word: "STEEP", color: "#fdae61" }; }
    return { word: "NO-GO", color: "#d7191c" };
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  var samples, stops, stepM, config;
  var legEnd = {};          // leg number -> index of the last sample of that leg
  var images = null;        // data/images.json (loaded by stops.js, or here if needed)
  var ui = null;            // HUD elements, built the first time the HUD opens
  var isOpen = false;
  var playing = false;
  var pauseUntil = 0;       // time (ms) when a science-stop pause ends
  var simMin = 0;           // simulated walking minutes while playing
  var lastFrame = 0;
  var returnFocus = null;
  var shownPhotoStop = null;

  // ------------------------------------------------------------------
  // Position maths
  // ------------------------------------------------------------------

  function crewIndex() {
    return typeof WALKBACK.crewIndex === "number" ? WALKBACK.crewIndex : 0;
  }

  // Move the crew. conditions.js provides WALKBACK.setCrewIndex; if it is not
  // there, do the same thing here: store the index and fire the event.
  function moveCrew(index) {
    var i = Math.max(0, Math.min(samples.length - 1, Math.round(index)));
    if (typeof WALKBACK.setCrewIndex === "function") {
      WALKBACK.setCrewIndex(i, "hud");
    } else {
      WALKBACK.crewIndex = i;
      document.dispatchEvent(new CustomEvent("walkback:crew-moved", { detail: { index: i, source: "hud" } }));
    }
  }

  // The stop at the end of a leg. Leg 1 ends at stops[1] (S1) ... the last leg ends at HAVEN (stops[0]).
  function stopAtLegEnd(leg) {
    return leg < stops.length ? stops[leg] : stops[0];
  }

  // Science minutes already spent when the crew is at sample i:
  // every science stop whose leg has been completed (the crew is on a later leg).
  function scienceDone(i) {
    var leg = samples[i].leg, total = 0;
    for (var k = 1; k < leg && k < stops.length; k++) { total += stops[k].science_min; }
    return total;
  }

  function readouts(i) {
    var s = samples[i];
    var last = samples.length - 1;
    var r = {};

    // NEXT: the stop at the end of this leg, and metres left along the route.
    var next = stopAtLegEnd(s.leg);
    r.next = next;
    r.nextName = next.name;
    r.toGo = Math.max(0, samples[legEnd[s.leg]].d_m - s.d_m);
    r.home = i === last;

    // BEARING toward the route point about 20 m ahead.
    var ahead = Math.round(20 / stepM);
    var j = Math.min(i + ahead, last);
    // At the very end (back at the haven) there is no route ahead, so no bearing.
    r.bearing = j > i ? bearingDeg(s.lon, s.lat, samples[j].lon, samples[j].lat) : null;

    // EVA CLOCK: walking time so far + science time already spent. Dose so far.
    r.elapsed = s.t_walk_min + scienceDone(i);
    r.dose = r.elapsed / 60 * config.limits.gcr_msv_per_h;

    // SLOPE AHEAD: the steepest along-track slope over the next 10 m.
    var n = Math.round(10 / stepM), worst = s.slope_deg;
    for (var k = i + 1; k <= Math.min(i + n, last); k++) {
      if (Math.abs(samples[k].slope_deg) > Math.abs(worst)) { worst = samples[k].slope_deg; }
    }
    r.slope = worst;

    // SHELTER: minutes back to the haven from here.
    r.shelter = s.t_home_min;
    return r;
  }

  // ------------------------------------------------------------------
  // Building the HUD
  // ------------------------------------------------------------------

  function readoutBox(cls, label) {
    var value = el("div", { class: "hud-value" });
    var sub = el("div", { class: "hud-sub" });
    var box = el("div", { class: "hud-readout " + cls }, [el("div", { class: "hud-label", text: label }), value, sub]);
    return { box: box, value: value, sub: sub };
  }

  function buildHud() {
    var bgImg = el("img", { class: "hud-bg", alt: "" });
    bgImg.addEventListener("error", function () { bgImg.hidden = true; });

    var alert = el("div", { class: "hud-alert", role: "alert", hidden: "" }, [
      WALKBACK.icon("alert"),
      "ALERT: SOLAR STORM DRILL. Stop science, walk to the haven."
    ]);

    var next = readoutBox("hud-tl", "NEXT");
    var bearing = readoutBox("hud-tc", "BEARING");
    var clock = readoutBox("hud-tr", "EVA CLOCK");
    var slope = readoutBox("hud-bl", "SLOPE AHEAD");
    var shelter = readoutBox("hud-br hud-shelter", "SHELTER");

    var swatch = el("span", { class: "hud-swatch", "aria-hidden": "true" });
    slope.value.parentNode.insertBefore(swatch, slope.value);

    var science = el("div", { class: "hud-science", "aria-live": "polite", hidden: "" });

    // Mini-map (inline SVG), north up.
    var mini = buildMiniMap();

    var slider = el("input", { type: "range", class: "hud-slider", min: "0", max: String(samples.length - 1), step: "1",
      "aria-label": "Crew position along the route" });
    var playBtn = el("button", { class: "hud-btn", type: "button", text: "Play" });
    var closeBtn = el("button", { class: "hud-btn hud-close", type: "button", "aria-label": "Close HUD and return to the map", text: "Close" });

    var root = el("div", { class: "hud", role: "dialog", "aria-modal": "true", "aria-label": "Helmet HUD", hidden: "" }, [
      bgImg,
      el("div", { class: "hud-visor", "aria-hidden": "true" }),
      alert,
      next.box, bearing.box, clock.box,
      science,
      slope.box, shelter.box,
      mini.wrap,
      el("div", { class: "hud-controls" }, [playBtn, slider, closeBtn]),
      el("div", { class: "hud-caption", text: "Rover photo near the next stop. Not a live view." })
    ]);
    document.body.appendChild(root);

    playBtn.addEventListener("click", togglePlay);
    closeBtn.addEventListener("click", closeHud);
    slider.addEventListener("input", function () { stopPlaying(); moveCrew(Number(slider.value)); });

    return {
      root: root, bgImg: bgImg, alert: alert, next: next, bearing: bearing, clock: clock, slope: slope,
      swatch: swatch, shelter: shelter, science: science, mini: mini, slider: slider, playBtn: playBtn, closeBtn: closeBtn
    };
  }

  // A small circular north-up map: route, crew dot and next stop.
  function buildMiniMap() {
    var ns = "http://www.w3.org/2000/svg";
    var size = 220, pad = 22;
    var lons = samples.map(function (s) { return s.lon; }), lats = samples.map(function (s) { return s.lat; });
    var minLon = Math.min.apply(null, lons), maxLon = Math.max.apply(null, lons);
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var cx = (minLon + maxLon) / 2, cy = (minLat + maxLat) / 2;
    // Same scale in both directions (SPEC section 2: one degree is the same distance both ways).
    // The route's bounding box must fit inside the circle, so scale by its diagonal.
    var diagonal = Math.sqrt(Math.pow(maxLon - minLon, 2) + Math.pow(maxLat - minLat, 2));
    var k = (size - 2 * pad) / diagonal;
    function px(lon) { return size / 2 + (lon - cx) * k; }
    function py(lat) { return size / 2 - (lat - cy) * k; }

    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("class", "hud-mini");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Mini-map, north up: the route, the crew position and the next stop");

    function add(tag, attrs) {
      var n = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach(function (a) { n.setAttribute(a, attrs[a]); });
      svg.appendChild(n);
      return n;
    }
    add("circle", { cx: size / 2, cy: size / 2, r: size / 2 - 2, fill: "rgba(5,7,10,0.85)", stroke: "#e6edf3", "stroke-width": "2" });
    var d = samples.map(function (s, i) { return (i ? "L" : "M") + px(s.lon).toFixed(1) + "," + py(s.lat).toFixed(1); }).join(" ");
    add("path", { d: d, fill: "none", stroke: "#ffffff", "stroke-width": "3", "stroke-linejoin": "round" });
    var nextRing = add("circle", { r: 9, fill: "none", stroke: "#ffb000", "stroke-width": "4" });
    var crew = add("circle", { r: 7, fill: "#ffffff", stroke: "#0b0f14", "stroke-width": "3" });
    var north = add("text", { x: size / 2, y: 30, "text-anchor": "middle", class: "hud-mini-n" });
    north.textContent = "N";

    return {
      wrap: el("div", { class: "hud-mini-wrap" }, [svg]),
      update: function (s, nextStop) {
        crew.setAttribute("cx", px(s.lon)); crew.setAttribute("cy", py(s.lat));
        nextRing.setAttribute("cx", px(nextStop.lon)); nextRing.setAttribute("cy", py(nextStop.lat));
      }
    };
  }

  // ------------------------------------------------------------------
  // Drawing the readouts
  // ------------------------------------------------------------------

  // Fill a readout's small line. "key" is always shown. "more" is extra
  // explanation hidden on small screens (CSS class hud-more); "short" replaces
  // it on small screens (CSS class hud-short) when something must stay, such as
  // an ASSUMPTION label.
  function setSub(box, key, more, short) {
    box.sub.textContent = "";
    if (key) { box.sub.appendChild(el("span", { class: "hud-key", text: key })); }
    if (more) { box.sub.appendChild(el("span", { class: "hud-more", text: more })); }
    if (short) { box.sub.appendChild(el("span", { class: "hud-short", text: short })); }
  }

  function render() {
    if (!ui) { return; }
    var i = crewIndex();
    var r = readouts(i);

    if (r.home) {
      ui.next.value.textContent = "Haven";
      setSub(ui.next, "back at the rover");
    } else {
      ui.next.value.textContent = r.nextName;
      setSub(ui.next, Math.round(r.toGo) + " m to go");
    }

    if (r.bearing === null) {
      ui.bearing.value.textContent = "--";
      setSub(ui.bearing, "", "end of the route");
    } else {
      ui.bearing.value.textContent = Math.round(r.bearing) % 360 + "° " + compassLetters(r.bearing);
      setSub(ui.bearing, "", "to the route 20 m ahead");
    }

    ui.clock.value.textContent = hmm(r.elapsed);
    setSub(ui.clock, "dose so far " + r.dose.toFixed(3) + " mSv",
      " (ASSUMPTION: " + config.limits.gcr_msv_per_h + " mSv/h)", " (ASSUMPTION)");

    var cls = slopeClass(r.slope);
    ui.slope.value.textContent = Math.abs(r.slope).toFixed(1) + "° " + cls.word;
    setSub(ui.slope, r.slope >= 0 ? "uphill" : "downhill", ", steepest in next 10 m");
    ui.swatch.style.background = cls.color;

    // The number is the biggest text on screen; the unit sits beside it in smaller type.
    ui.shelter.value.textContent = r.shelter.toFixed(1);
    ui.shelter.value.appendChild(el("span", { class: "hud-unit", text: " min" }));
    setSub(ui.shelter, "", "walk to the haven");

    ui.slider.value = String(i);
    ui.mini.update(samples[i], r.next);
    showPhoto(r.next);
  }

  // Background: the first photo of the next stop, darkened.
  function showPhoto(stop) {
    if (!ui || shownPhotoStop === stop.id || !images) { return; }
    shownPhotoStop = stop.id;
    var id = (stop.images || [])[0];
    var image = images.filter(function (im) { return im.id === id; })[0];
    var src = image ? (image.remote_url || image.file) : null;
    if (!src) { ui.bgImg.hidden = true; return; }
    ui.bgImg.hidden = false;
    ui.bgImg.src = src;
  }

  function showAlert() {
    if (ui) { ui.alert.hidden = !WALKBACK.stormActive; }
  }

  // ------------------------------------------------------------------
  // Walk simulator: 60x walking speed, 2 s pause at each science stop
  // ------------------------------------------------------------------

  function togglePlay() {
    if (playing) { stopPlaying(); } else { startPlaying(); }
  }

  function startPlaying() {
    if (crewIndex() >= samples.length - 1) { moveCrew(0); }   // at the end: start again
    playing = true;
    simMin = samples[crewIndex()].t_walk_min;
    lastFrame = performance.now();
    pauseUntil = 0;
    ui.playBtn.textContent = "Pause";
    requestAnimationFrame(frame);
  }

  function stopPlaying() {
    playing = false;
    if (ui) {
      ui.playBtn.textContent = "Play";
      ui.science.hidden = true;
    }
  }

  function frame(now) {
    if (!playing || !isOpen) { return; }
    var dt = (now - lastFrame) / 1000;   // real seconds since the last frame
    lastFrame = now;

    if (now < pauseUntil) { requestAnimationFrame(frame); return; }
    ui.science.hidden = true;

    // 60x: one real second = 60 simulated seconds = 1 walking minute.
    simMin += dt * 60 / 60;

    var i = crewIndex(), last = samples.length - 1, target = i;
    while (target < last && samples[target + 1].t_walk_min <= simMin) { target += 1; }

    // Did we reach the end of a leg that finishes at a science stop?
    for (var k = i + 1; k <= target; k++) {
      var leg = samples[k].leg;
      if (k === legEnd[leg] && leg < stops.length) {
        var stop = stops[leg];
        moveCrew(k);
        simMin = samples[k].t_walk_min;
        pauseUntil = now + 2000;
        ui.science.textContent = "SCIENCE STOP: " + stop.name + ", " + stop.science_min + " min planned";
        ui.science.hidden = false;
        requestAnimationFrame(frame);
        return;
      }
    }

    if (target !== i) { moveCrew(target); }
    if (target >= last) { stopPlaying(); return; }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------
  // Opening, closing and the keyboard
  // ------------------------------------------------------------------

  function openHud() {
    if (!ui) { ui = buildHud(); }
    isOpen = true;
    returnFocus = document.activeElement;
    ui.root.hidden = false;
    document.body.classList.add("hud-is-open");
    shownPhotoStop = null;
    showAlert();
    render();
    // Start at the top (small screens can scroll the HUD) and do not let the
    // focus jump scroll the alert out of view.
    ui.root.scrollTop = 0;
    ui.playBtn.focus({ preventScroll: true });
  }

  function closeHud() {
    stopPlaying();
    isOpen = false;
    ui.root.hidden = true;
    document.body.classList.remove("hud-is-open");
    if (returnFocus && returnFocus.focus) { returnFocus.focus(); }
  }

  function onKeyDown(e) {
    if (!isOpen) { return; }
    var step = Math.round(10 / stepM);   // 10 m
    if (e.key === "Escape") { e.preventDefault(); closeHud(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stopPlaying(); moveCrew(crewIndex() - step); }
    else if (e.key === "ArrowRight") { e.preventDefault(); stopPlaying(); moveCrew(crewIndex() + step); }
    else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); togglePlay(); }
  }
  // Stop a space press from also "clicking" whichever button has focus.
  function onKeyUp(e) {
    if (isOpen && (e.key === " " || e.key === "Spacebar")) { e.preventDefault(); }
  }

  // ------------------------------------------------------------------
  // Start once plan.js has loaded the route data
  // ------------------------------------------------------------------

  document.addEventListener("walkback:plan-ready", function () {
    samples = WALKBACK.profile.samples;
    stepM = WALKBACK.profile.step_m;
    stops = WALKBACK.stops;
    config = WALKBACK.config;
    samples.forEach(function (s, i) { legEnd[s.leg] = i; });   // later samples overwrite earlier ones

    // Photos: stops.js loads images.json; load it here too in case it has not finished.
    loadJson("data/images.json").then(function (list) {
      images = list;
      if (isOpen) { render(); }
    }).catch(function (err) { console.warn("WALKBACK: HUD photos unavailable. " + err.message); });

    var button = document.getElementById("hud-open");
    if (button) {
      button.disabled = false;
      button.addEventListener("click", openHud);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("walkback:crew-moved", function () { if (isOpen) { render(); } });
    document.addEventListener("walkback:storm", showAlert);
  });

})();
