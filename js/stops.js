// AI-assisted: written with Claude Code (Opus 5.5), reviewed by the team.
//
// stops.js fills the Stops tab (one card per stop, with NASA photos and a
// photo viewer) and the Sources tab (where every limit comes from, data
// credits, limitations, AI use).
// Build step T10. It waits for plan.js to finish ("walkback:plan-ready"),
// because the arrival times need profile.json and the Sources tab needs
// stats.json and sources.json, which plan.js has already loaded.

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Helpers (same small helpers as plan.js, repeated so this file stands alone)
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

  // A link that opens in a new tab.
  function link(url, text) {
    return el("a", { href: url, target: "_blank", rel: "noopener", text: text });
  }

  // Minutes after EVA start written as h:mm, for example 83.4 -> "1:23".
  function hmm(minutes) {
    var total = Math.round(minutes);
    var h = Math.floor(total / 60);
    var m = total - h * 60;
    return h + ":" + (m < 10 ? "0" : "") + m;
  }

  // Switch the side panel to a tab by "clicking" its tab button (app.js owns the tabs).
  function showTab(name) {
    var button = document.getElementById("tabbtn-" + name);
    if (button) { button.click(); }
  }

  // ------------------------------------------------------------------
  // SPEC section 11, word for word. Shown in the Sources tab.
  // (Copied here rather than read from docs/SPEC.md, because GitHub Pages
  // may turn .md files into web pages instead of serving the raw text.)
  // ------------------------------------------------------------------

  var LIMITATIONS = [
    "Walking speed is an Earth hiking model scaled to a NASA planning rate; not validated for suited walking in Mars gravity.",
    "The 20 deg and 2 km limits come from lunar xEVA documents and are applied to Mars as the best published values.",
    "The elevation model is 1 m per pixel: rocks under about 1 to 2 m and loose sand are not visible. Slope is a proxy for obstacles.",
    "Stop positions are rover parking positions, within about 2 m of the targets.",
    "Radiation uses the 2012-13 average dose rate; real rates vary with the solar cycle, season and terrain.",
    "Weather is a replay of sols Curiosity measured here in 2025-26, not a forecast.",
    "Thermal imagery is 100 m per pixel: context only.",
    "Science time per stop is an assumption.",
    "Student project built in one weekend. Not flight software."
  ];

  // The repository that holds AI_USE.md (this project's own GitHub repo).
  var AI_USE_URL = "https://github.com/haarshaths-maker/walkback/blob/main/AI_USE.md";

  // ------------------------------------------------------------------
  // Photos
  // ------------------------------------------------------------------

  // Where to load a photo from. If the team could not download a photo into
  // /img, images.json carries a "remote_url" (the NASA download link from
  // SPEC section 8) and we show it from there. The other address is kept
  // as a second try in case the first one fails.
  function photoSources(image) {
    var list = [];
    if (image.remote_url) { list.push(image.remote_url); }
    if (image.file) { list.push(image.file); }
    return list;
  }

  // Put a photo into an <img>. If every address fails, call onMissing so the
  // card can drop the photo. A broken-image icon is never shown.
  function loadPhoto(img, image, onMissing) {
    var sources = photoSources(image);
    var i = 0;
    function tryNext() {
      if (i >= sources.length) {
        console.warn("WALKBACK: photo " + image.id + " could not be loaded; the card is shown without it.");
        onMissing();
        return;
      }
      img.src = sources[i];
      i += 1;
    }
    img.addEventListener("error", tryNext);
    tryNext();
  }

  // The small grey tag on each photo.
  function photoTag(image) {
    return image.exact_location ? "Taken at this stop" : "Taken in the boxwork unit";
  }

  // ------------------------------------------------------------------
  // Photo viewer (click a photo to enlarge it)
  // ------------------------------------------------------------------

  var viewer = null;      // the viewer's elements, built once
  var viewerList = [];    // photos of the stop being viewed
  var viewerIndex = 0;    // which of those photos is showing
  var viewerReturnFocus = null;

  function buildViewer() {
    var img = el("img", { class: "viewer-img", alt: "" });
    var caption = el("div", { class: "viewer-caption" });
    var counter = el("div", { class: "viewer-counter" });
    var closeBtn = el("button", { class: "viewer-btn viewer-close", type: "button", "aria-label": "Close photo viewer", text: "Close ✕" });
    var prevBtn = el("button", { class: "viewer-btn viewer-prev", type: "button", "aria-label": "Previous photo of this stop", text: "‹ Previous" });
    var nextBtn = el("button", { class: "viewer-btn viewer-next", type: "button", "aria-label": "Next photo of this stop", text: "Next ›" });
    var box = el("div", { class: "viewer", role: "dialog", "aria-modal": "true", "aria-label": "Photo viewer", hidden: "" }, [
      el("div", { class: "viewer-inner" }, [
        el("div", { class: "viewer-top" }, [counter, closeBtn]),
        img,
        caption,
        el("div", { class: "viewer-nav" }, [prevBtn, nextBtn])
      ])
    ]);
    document.body.appendChild(box);

    closeBtn.addEventListener("click", closeViewer);
    prevBtn.addEventListener("click", function () { stepViewer(-1); });
    nextBtn.addEventListener("click", function () { stepViewer(1); });
    // Clicking the dark area around the photo also closes the viewer.
    box.addEventListener("click", function (e) { if (e.target === box) { closeViewer(); } });

    // Keyboard: Esc closes, left and right arrows step between photos.
    document.addEventListener("keydown", function (e) {
      if (box.hidden) { return; }
      if (e.key === "Escape") { e.preventDefault(); closeViewer(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepViewer(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); stepViewer(1); }
    });

    img.addEventListener("error", function () {
      // The card already hides photos that fail, so this is rare. Show text instead.
      img.hidden = true;
      console.warn("WALKBACK: photo could not be shown in the viewer.");
    });

    return { box: box, img: img, caption: caption, counter: counter, closeBtn: closeBtn, prevBtn: prevBtn, nextBtn: nextBtn };
  }

  function openViewer(list, index, returnFocus) {
    if (!viewer) { viewer = buildViewer(); }
    viewerList = list;
    viewerIndex = index;
    viewerReturnFocus = returnFocus || null;
    viewer.box.hidden = false;
    showViewerPhoto();
    viewer.closeBtn.focus();
  }

  function closeViewer() {
    if (!viewer) { return; }
    viewer.box.hidden = true;
    viewer.img.removeAttribute("src");
    if (viewerReturnFocus) { viewerReturnFocus.focus(); }
  }

  function stepViewer(step) {
    if (viewerList.length < 2) { return; }
    viewerIndex = (viewerIndex + step + viewerList.length) % viewerList.length;
    showViewerPhoto();
  }

  function showViewerPhoto() {
    var item = viewerList[viewerIndex];
    viewer.img.hidden = false;
    viewer.img.src = item.src;
    viewer.img.alt = item.image.title;
    viewer.caption.innerHTML = "";
    viewer.caption.appendChild(el("div", { class: "viewer-title", text: item.image.title }));
    var details = [photoTag(item.image)];
    if (item.image.camera) { details.push(item.image.camera); }
    if (item.image.sol) { details.push("sol " + item.image.sol); }
    if (item.image.date) { details.push(item.image.date); }
    viewer.caption.appendChild(el("div", { class: "viewer-meta", text: details.join(" · ") }));
    viewer.caption.appendChild(el("div", { class: "viewer-meta" }, [
      "Credit: " + item.image.credit + " · ",
      link(item.image.source_url, "source")
    ]));
    viewer.counter.textContent = "Photo " + (viewerIndex + 1) + " of " + viewerList.length;
    var several = viewerList.length > 1;
    viewer.prevBtn.hidden = !several;
    viewer.nextBtn.hidden = !several;
  }

  // ------------------------------------------------------------------
  // Arrival times on the EVA clock
  // ------------------------------------------------------------------

  // Walking minutes at the moment each leg ends, read from profile.json.
  // Leg 1 ends at stop 1 (S1), leg 2 at S2, ... and the last leg ends back at HAVEN.
  function walkMinutesAtLegEnds(profile) {
    var ends = {};
    profile.samples.forEach(function (s) {
      if (ends[s.leg] === undefined || s.t_walk_min > ends[s.leg]) { ends[s.leg] = s.t_walk_min; }
    });
    return ends;
  }

  // Arrival time of each stop in minutes after EVA start:
  // walking time to the end of its leg + science minutes of the stops before it.
  function arrivalTimes(stops, profile) {
    var ends = walkMinutesAtLegEnds(profile);
    var result = {};
    var scienceSoFar = 0;
    stops.forEach(function (stop, i) {
      if (i === 0) { return; }            // HAVEN is handled below
      result[stop.id] = ends[i] + scienceSoFar;
      scienceSoFar += stop.science_min;
    });
    var lastLeg = stops.length;            // the leg that returns to HAVEN
    result.__return = ends[lastLeg] + scienceSoFar;
    return result;
  }

  // ------------------------------------------------------------------
  // Stops tab
  // ------------------------------------------------------------------

  var cardsById = {};

  function buildStopsTab(stops, images, profile, map) {
    var tab = document.getElementById("tab-stops");
    tab.innerHTML = "";

    var imagesById = {};
    images.forEach(function (im) { imagesById[im.id] = im; });
    var arrivals = arrivalTimes(stops, profile);

    tab.appendChild(el("p", { class: "small-note",
      text: "Stops in visiting order. Click a card to fly the map to it. Positions are where Curiosity parked, within about 2 m of each target." }));

    var scienceNumber = 0;
    stops.forEach(function (stop) {
      var isHaven = stop.role === "haven";
      if (!isHaven) { scienceNumber += 1; }

      var card = el("article", { class: "stop-card", id: "stop-card-" + stop.id, "aria-label": stop.name });

      // ---- Photo (first photo of the stop) ----
      var stopImages = (stop.images || [])
        .map(function (id) { return imagesById[id]; })
        .filter(function (im) { return im && (im.remote_url || im.file); });
      var viewerItems = [];   // photos that actually loaded, for the viewer
      if (stopImages.length) {
        var first = stopImages[0];
        var img = el("img", { class: "stop-photo-img", alt: first.title, loading: "lazy" });
        var photoBtn = el("button", { class: "stop-photo-btn", type: "button",
          "aria-label": "Enlarge photo: " + first.title }, [img]);
        var figure = el("figure", { class: "stop-photo" }, [
          photoBtn,
          el("span", { class: "photo-tag", text: photoTag(first) }),
          el("figcaption", { class: "photo-credit", text: "Credit: " + first.credit })
        ]);
        card.appendChild(figure);
        loadPhoto(img, first, function () { figure.remove(); });

        // Work out the address of every photo of this stop for the viewer.
        stopImages.forEach(function (im) {
          viewerItems.push({ image: im, src: photoSources(im)[0] });
        });
        img.addEventListener("load", function () { viewerItems[0].src = img.currentSrc || img.src; });

        photoBtn.addEventListener("click", function (e) {
          e.stopPropagation();          // do not also fly the map
          openViewer(viewerItems, 0, photoBtn);
        });
        if (stopImages.length > 1) {
          figure.appendChild(el("span", { class: "photo-count", text: stopImages.length + " photos" }));
        }
      }

      // ---- Text ----
      var badge = isHaven ? "Safe haven" : "Stop " + scienceNumber;
      card.appendChild(el("div", { class: "stop-head" }, [
        el("span", { class: "stop-badge" + (isHaven ? " is-haven" : ""), text: badge }),
        el("h4", { class: "stop-name", text: stop.name })
      ]));
      card.appendChild(el("p", { class: "stop-objective", text: stop.objective }));

      card.appendChild(el("div", { class: "stop-label", text: "What Curiosity found" }));
      card.appendChild(el("p", { class: "stop-finding", text: stop.finding }));

      var facts = el("dl", { class: "stop-facts" });
      if (isHaven) {
        facts.appendChild(el("dt", { text: "EVA start" }));
        facts.appendChild(el("dd", { text: "0:00" }));
        facts.appendChild(el("dt", { text: "Back at the haven" }));
        facts.appendChild(el("dd", { text: hmm(arrivals.__return) + " after EVA start" }));
      } else {
        facts.appendChild(el("dt", { text: "Planned science" }));
        var sci = el("dd", { text: stop.science_min + " min" });
        sci.appendChild(el("div", { class: "assumption", text: "ASSUMPTION: planned minutes" }));
        facts.appendChild(sci);
        facts.appendChild(el("dt", { text: "Arrival" }));
        var arr = el("dd", { text: hmm(arrivals[stop.id]) + " after EVA start" });
        arr.appendChild(el("div", { class: "assumption", text: "ASSUMPTION: modelled walking speed" }));
        facts.appendChild(arr);
      }
      card.appendChild(facts);

      var actions = el("div", { class: "stop-actions" });
      var flyBtn = el("button", { class: "stop-fly", type: "button", text: "Show on map" });
      actions.appendChild(flyBtn);
      actions.appendChild(link(stop.source_url, "NASA source"));
      card.appendChild(actions);

      // Clicking anywhere on the card (except links and buttons) flies the map to the stop.
      function flyTo() {
        map.flyTo([stop.lat, stop.lon], Math.max(map.getZoom(), 18));
        highlightCard(stop.id, false);
      }
      card.addEventListener("click", function (e) {
        if (e.target.closest("a, button")) { return; }
        flyTo();
      });
      flyBtn.addEventListener("click", flyTo);

      cardsById[stop.id] = card;
      tab.appendChild(card);
    });
  }

  // Mark one card as selected and, if asked, scroll it into view.
  function highlightCard(stopId, scroll) {
    Object.keys(cardsById).forEach(function (id) {
      cardsById[id].classList.toggle("is-highlighted", id === stopId);
    });
    if (scroll && cardsById[stopId]) {
      cardsById[stopId].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Clicking a stop marker on the map opens the Stops tab at that stop's card.
  function connectMarkers(stops) {
    if (!WALKBACK.stopLayer) { return; }
    WALKBACK.stopLayer.eachLayer(function (marker) {
      var pos = marker.getLatLng();
      var stop = stops.filter(function (s) { return s.lat === pos.lat && s.lon === pos.lng; })[0];
      if (!stop) { return; }
      marker.on("click", function () {
        showTab("stops");
        highlightCard(stop.id, true);
      });
    });
  }

  // ------------------------------------------------------------------
  // Sources tab
  // ------------------------------------------------------------------

  function sourceLine(sources, id) {
    var s = sources[id];
    if (!s) { return null; }
    var li = el("li", {}, [s.citation + " "]);
    if (s.url) { li.appendChild(link(s.url, "link")); }
    return li;
  }

  function buildSourcesTab(stats, sources) {
    var tab = document.getElementById("tab-sources");
    tab.innerHTML = "";

    // (a) Where our limits come from
    tab.appendChild(el("h3", { text: "Where our limits come from" }));
    var limits = el("ul", { class: "source-list" });
    stats.checks.forEach(function (c) {
      var limitText = typeof c.limit === "number" ? "limit " + c.limit + " " + c.unit : "limit " + c.limit + " (" + c.unit + ")";
      var li = el("li", {}, [el("strong", { text: c.label }), " (" + limitText + "). "]);
      var s = sources[c.source];
      if (s) {
        li.appendChild(document.createTextNode(s.citation + " "));
        if (s.url) { li.appendChild(link(s.url, "link")); }
      }
      if (c.assumption) { li.appendChild(el("div", { class: "assumption", text: "ASSUMPTION: " + c.assumption })); }
      if (c.id === "daylight") {
        li.appendChild(el("div", { class: "assumption", text: "ASSUMPTION: start 2 h after sunrise, back 2 h before sunset." }));
      }
      // The range check also cites the historical 10 km walk-back assumption (SPEC section 6).
      if (c.id === "range" && sources.walkback) {
        var wb = el("div", { class: "source-sub" }, [c.note + ". " + sources.walkback.citation + " "]);
        if (sources.walkback.url) { wb.appendChild(link(sources.walkback.url, "link")); }
        li.appendChild(wb);
      }
      limits.appendChild(li);
    });
    tab.appendChild(limits);

    // (b) Data
    tab.appendChild(el("h3", { text: "Data" }));
    var data = el("ul", { class: "source-list" });
    ["dem", "ortho", "trek", "rover", "rems", "rad", "spe"].forEach(function (id) {
      var li = sourceLine(sources, id);
      if (li) { data.appendChild(li); }
    });
    tab.appendChild(data);
    tab.appendChild(el("p", { class: "small-note",
      text: "Photos: NASA images, each credited on its stop card and in the photo viewer." }));

    // (c) Limitations (SPEC section 11, word for word)
    tab.appendChild(el("h3", { text: "Limitations" }));
    var lim = el("ul", { class: "source-list" });
    LIMITATIONS.forEach(function (text) { lim.appendChild(el("li", { text: text })); });
    tab.appendChild(lim);

    // (d) How AI was used
    tab.appendChild(el("h3", { text: "How AI was used" }));
    tab.appendChild(el("p", {}, [
      "AI tools (Anthropic's Claude) helped us research the data and wrote the code from our specification; we checked every number against its NASA source. ",
      "The full, dated log of what each AI tool produced is in ",
      link(AI_USE_URL, "AI_USE.md"),
      " in our repository."
    ]));

    // (e) Disclaimer
    tab.appendChild(el("p", { class: "disclaimer", text: "Student project. Not affiliated with or endorsed by NASA." }));
  }

  // ------------------------------------------------------------------
  // Start once plan.js has loaded the route data
  // ------------------------------------------------------------------

  document.addEventListener("walkback:plan-ready", function () {
    loadJson("data/images.json").then(function (images) {
      WALKBACK.images = images;
      buildStopsTab(WALKBACK.stops, images, WALKBACK.profile, WALKBACK.map);
      connectMarkers(WALKBACK.stops);
    }).catch(function (err) {
      console.error(err);
      var tab = document.getElementById("tab-stops");
      tab.innerHTML = "";
      tab.appendChild(el("p", { class: "placeholder", text: "The stop list could not load. Details: " + err.message }));
    });
    buildSourcesTab(WALKBACK.stats, WALKBACK.sources);
  });

})();
