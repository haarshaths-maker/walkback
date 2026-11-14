// AI-assisted: written with Claude (Fable 5.2), reviewed by the team.
//
// app.js builds the map and the side panel.
// Build step T3: base map, Mars Trek layers, stop markers, map furniture, tabs.
// Later steps add the route, overlays, stop cards, conditions and HUD.

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // 1. Small helpers
  // ------------------------------------------------------------------

  // Load a JSON file from the site's own data folder.
  function loadJson(path) {
    return fetch(path).then(function (response) {
      if (!response.ok) {
        throw new Error("Could not load " + path + " (HTTP " + response.status + ")");
      }
      return response.json();
    });
  }

  // Format a position like "4.80801 S, 137.38100 E" (5 decimal places).
  function formatLatLon(lat, lon) {
    var latText = Math.abs(lat).toFixed(5) + (lat < 0 ? " S" : " N");
    var lonText = Math.abs(lon).toFixed(5) + (lon < 0 ? " W" : " E");
    return latText + ", " + lonText;
  }

  // Show a message box over the map (used only when something fails).
  function showMapMessage(text) {
    var box = document.getElementById("map-message");
    box.textContent = text;
    box.hidden = false;
  }

  // ------------------------------------------------------------------
  // 2. Tabs in the side panel
  // ------------------------------------------------------------------

  function setUpTabs() {
    var buttons = document.querySelectorAll(".tab");
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var wanted = button.getAttribute("data-tab");
        buttons.forEach(function (other) {
          var isThis = other === button;
          other.classList.toggle("is-active", isThis);
          other.setAttribute("aria-selected", isThis ? "true" : "false");
        });
        document.querySelectorAll(".tab-body").forEach(function (body) {
          var isThis = body.id === "tab-" + wanted;
          body.classList.toggle("is-active", isThis);
          body.hidden = !isThis;
        });
      });
    });

    // Placeholder text until later build steps fill the tabs in.
    // (plan.js replaces the Plan tab text once the route data loads.)
    var notes = {
      "tab-plan": "Loading the route...",
      "tab-stops": "A card for each science stop, with rover photos, appears here.",
      "tab-conditions": "Weather measured by Curiosity, radiation dose and the solar storm drill appear here.",
      "tab-sources": "Data credits, the sources of every limit, and the limitations of this tool appear here."
    };
    Object.keys(notes).forEach(function (id) {
      var p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = notes[id];
      document.getElementById(id).appendChild(p);
    });
  }

  // ------------------------------------------------------------------
  // 3. The map
  // ------------------------------------------------------------------

  function buildMap(config, stops) {

    // Coordinate system.
    // Mars Trek serves tiles on a plain longitude/latitude grid whose top
    // zoom level (zoom 0) is 2 tiles wide and 1 tile tall. Leaflet's built-in
    // EPSG4326 system uses exactly the same grid, so the tiles line up with
    // no extra maths. We copy it and replace Earth's radius with the radius
    // of Mars, so that distances and the scale bar are in Mars metres.
    var marsCRS = L.extend({}, L.CRS.EPSG4326, { R: config.body_radius_m });

    var b = config.bounds;
    var siteBounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);

    var map = L.map("map", {
      crs: marsCRS,
      minZoom: WALKBACK.minZoom,
      maxZoom: WALKBACK.maxZoom,
      zoomSnap: 0.25,
      zoomControl: true,
      worldCopyJump: false
    });
    map.fitBounds(siteBounds, { padding: [20, 20] });

    // ---- Base layers from Mars Trek (radio buttons in the layer switcher) ----
    var baseLayers = {};
    var defaultLayer = null;
    WALKBACK.baseLayers.forEach(function (spec) {
      var options = {
        tileSize: 256,
        noWrap: true,
        minZoom: WALKBACK.minZoom,
        maxNativeZoom: spec.maxNativeZoom,
        maxZoom: WALKBACK.maxZoom,
        attribution: spec.attribution,
        errorTileUrl: WALKBACK.transparentTile
      };
      if (spec.bounds) {
        options.bounds = L.latLngBounds(spec.bounds[0], spec.bounds[1]);
      }
      var layer = L.tileLayer(WALKBACK.trekUrl(spec.id, spec.ext), options);
      baseLayers[spec.label] = layer;
      if (spec.isDefault) { defaultLayer = layer; }
    });
    (defaultLayer || baseLayers[Object.keys(baseLayers)[0]]).addTo(map);

    // ---- Site outline: thin dashed amber rectangle ----
    L.rectangle(siteBounds, {
      color: "#ffb000",
      weight: 1.5,
      dashArray: "6 6",
      fill: false,
      interactive: false
    }).addTo(map);

    // ---- Stop markers ----
    // HAVEN is a square amber marker with a shelter symbol; science stops are
    // round and numbered in visiting order. Shape differs as well as colour.
    var stopLayer = L.layerGroup();
    var scienceNumber = 0;
    stops.forEach(function (stop) {
      var isHaven = stop.role === "haven";
      var html;
      if (isHaven) {
        html = '<div class="stop-marker is-haven" aria-hidden="true">' +
               '<svg viewBox="0 0 16 16" width="16" height="16">' +
               '<path d="M8 1.5 1.5 7.5h2V14h3.5v-4h2v4h3.5V7.5h2z" fill="#0b0f14"/></svg></div>';
      } else {
        scienceNumber += 1;
        html = '<div class="stop-marker" aria-hidden="true">' + scienceNumber + "</div>";
      }
      var size = isHaven ? 32 : 28;
      var marker = L.marker([stop.lat, stop.lon], {
        icon: L.divIcon({
          className: "",                     // no default Leaflet icon styling
          html: html,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        }),
        title: stop.name,
        alt: stop.name,
        keyboard: true
      });
      marker.bindTooltip(
        (isHaven ? "" : scienceNumber + ". ") + stop.name,
        { direction: "top", offset: [0, -size / 2] }
      );
      marker.addTo(stopLayer);
    });
    stopLayer.addTo(map);

    // ---- Controls ----
    // Layer switcher, top right. Base maps are radio buttons; overlays are tick boxes.
    // Later scripts (plan.js) add their own overlays to this same switcher.
    WALKBACK.layerControl = L.control.layers(baseLayers, { "Stops": stopLayer }, {
      position: "topright",
      collapsed: window.innerWidth < 800
    }).addTo(map);
    WALKBACK.stopLayer = stopLayer;

    // Scale bar in metres only, bottom left. It uses the Mars radius set above.
    L.control.scale({ position: "bottomleft", metric: true, imperial: false, maxWidth: 160 }).addTo(map);

    // Move the zoom buttons below the north arrow.
    map.zoomControl.setPosition("bottomright");

    // Latitude / longitude readout that follows the pointer.
    var readout = document.getElementById("coord-readout");
    map.on("mousemove", function (event) {
      readout.textContent = formatLatLon(event.latlng.lat, event.latlng.lng);
    });
    map.on("mouseout", function () {
      readout.textContent = "Move the pointer over the map";
    });
    // On touch screens there is no pointer, so show the tapped position.
    map.on("click", function (event) {
      readout.textContent = formatLatLon(event.latlng.lat, event.latlng.lng);
    });

    // Keep the map filling its box when the window changes size.
    window.addEventListener("resize", function () { map.invalidateSize(); });

    return map;
  }

  // ------------------------------------------------------------------
  // 4. Start
  // ------------------------------------------------------------------

  setUpTabs();

  Promise.all([
    loadJson(WALKBACK.dataPaths.config),
    loadJson(WALKBACK.dataPaths.stops)
  ]).then(function (results) {
    var config = results[0];
    var stops = results[1];

    document.getElementById("brand-name").textContent = config.project;
    document.getElementById("brand-tagline").textContent = config.tagline;

    // Keep these reachable for later build steps (route, HUD and so on).
    WALKBACK.config = config;
    WALKBACK.stops = stops;
    WALKBACK.map = buildMap(config, stops);

    // Tell the other scripts (plan.js and later) that the map is ready.
    document.dispatchEvent(new CustomEvent("walkback:ready"));
  }).catch(function (error) {
    console.error(error);
    showMapMessage(
      "The map could not load its data files. If you opened index.html by double-clicking it, " +
      "start a local web server instead (see README). Details: " + error.message
    );
  });

})();
