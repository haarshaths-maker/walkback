// AI-assisted: written with Claude Code (Opus 5.5), reviewed by the team.
//
// cuff.js makes the printable cuff card: one black-on-white page with the
// legs, stops, safety checks and the shelter headline, small enough to wear
// on a suit sleeve. Build step T15.
//
// It adds a "Print cuff card" button to the Plan tab. The card itself lives in
// a hidden <section id="cuff-card">; the print rules at the end of
// css/style.css hide everything else and show only that section on paper.

(function () {
  "use strict";

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

  // Minutes after EVA start as h:mm, for example 83.4 -> "1:23".
  function hmm(minutes) {
    var total = Math.round(minutes);
    var h = Math.floor(total / 60);
    var m = total - h * 60;
    return h + ":" + (m < 10 ? "0" : "") + m;
  }

  // A table with a header row and body rows (each row is a list of cell texts).
  function table(headers, rows) {
    var thead = el("thead", {}, [el("tr", {}, headers.map(function (h) { return el("th", { text: h }); }))]);
    var tbody = el("tbody", {}, rows.map(function (r) {
      return el("tr", {}, r.map(function (c) { return el("td", { text: c }); }));
    }));
    return el("table", {}, [thead, tbody]);
  }

  // Arrival time of each stop in minutes after EVA start (same rule as the
  // Stops tab): walking time to the end of its leg in profile.json, plus the
  // science minutes of the stops before it.
  function arrivalTimes(stops, profile) {
    var ends = {};
    profile.samples.forEach(function (s) {
      if (ends[s.leg] === undefined || s.t_walk_min > ends[s.leg]) { ends[s.leg] = s.t_walk_min; }
    });
    var result = {}, science = 0;
    stops.forEach(function (stop, i) {
      if (i === 0) { return; }
      result[stop.id] = ends[i] + science;
      science += stop.science_min;
    });
    result.__return = ends[stops.length] + science;
    return result;
  }

  // Fill the hidden cuff card with the current plan.
  function buildCard() {
    var stats = WALKBACK.stats, stops = WALKBACK.stops, route = WALKBACK.route;
    var card = document.getElementById("cuff-card");
    if (!card) {
      card = el("section", { id: "cuff-card", "aria-hidden": "true" });
      document.body.appendChild(card);
    }
    card.innerHTML = "";

    card.appendChild(el("h1", { text: WALKBACK.config.project + " cuff card: Mount Sharp boxwork, Gale Crater" }));
    card.appendChild(el("p", { class: "cuff-headline",
      text: "Longest walk back to shelter: " + stats.max_time_to_haven_min.toFixed(1) + " min" }));

    // Legs
    card.appendChild(el("h2", { text: "Legs" }));
    card.appendChild(table(["Leg", "From", "To", "Distance", "Walk", "Steepest"],
      route.features.map(function (f) {
        var p = f.properties;
        return [String(p.leg), p.from, p.to, Math.round(p.distance_m) + " m", p.walk_min.toFixed(1) + " min", p.max_slope_deg.toFixed(1) + " deg"];
      })));

    // Stops
    var arrivals = arrivalTimes(stops, WALKBACK.profile);
    card.appendChild(el("h2", { text: "Stops" }));
    var stopRows = stops.map(function (s, i) {
      if (i === 0) { return [s.id, s.name, "-", "start 0:00"]; }
      return [s.id, s.name, s.science_min + " min", hmm(arrivals[s.id])];
    });
    stopRows.push([stops[0].id, stops[0].name, "-", "back " + hmm(arrivals.__return)]);
    card.appendChild(table(["Id", "Stop", "Planned science", "Arrival (h:mm after start)"], stopRows));

    // Checks
    card.appendChild(el("h2", { text: "Checks" }));
    card.appendChild(table(["Check", "Plan", "Limit", "Result"],
      stats.checks.map(function (c) {
        var value = typeof c.value === "number" ? c.value + " " + c.unit : String(c.value);
        var limit = typeof c.limit === "number" ? "max " + c.limit + " " + c.unit : String(c.limit);
        var result = c.pass === true ? "PASS" : c.pass === false ? "FAIL" : "NO DATA";
        return [c.label, value, limit, result];
      })));

    card.appendChild(el("p", { class: "cuff-note", text: "Planning aid. ASSUMPTIONS apply. See Sources." }));
  }

  // Add the button to the top of the Plan tab once the plan exists.
  document.addEventListener("walkback:plan-ready", function () {
    var tab = document.getElementById("tab-plan");
    var button = el("button", { class: "btn cuff-btn", type: "button" }, [WALKBACK.icon("print"), "Print cuff card"]);
    button.addEventListener("click", function () {
      buildCard();
      window.print();
    });
    // plan.js makes an actions row under the key numbers; fall back to the top of the tab.
    var slot = document.getElementById("plan-actions");
    if (slot) { slot.appendChild(button); }
    else { tab.insertBefore(el("div", { class: "cuff-row" }, [button]), tab.firstChild); }
    // Also fill the card if someone prints with Ctrl+P / Cmd+P.
    window.addEventListener("beforeprint", buildCard);
  });

})();
