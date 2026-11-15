// AI-assisted: written with Claude Code (Opus 5.5), reviewed by the team.
//
// intro.js shows a welcome screen the first time the page opens: what
// WALKBACK is, why it matters, and how to explore it. "Start planning" (or
// Esc) closes it; the "About" button in the top bar opens it again.
// The background is NASA's HiRISE image of boxwork ridges (img8 in
// data/images.json), credited on screen.
// Whether it was closed is kept in a variable only, so a fresh visit always
// shows it again (no browser storage).

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

  // The four places to go, matching the tabs and the HUD button.
  var STEPS = [
    ["Plan", "The computed route, its five safety checks and the minutes back to shelter.", "plan"],
    ["Stops", "What Curiosity found at each of the five science stops, with its photos.", "stops"],
    ["Conditions", "Weather Curiosity measured here, and a solar-storm drill.", "conditions"],
    ["Helmet view", "Walk the route through a visor display with six numbers.", "hud"]
  ];

  var box = null;
  var returnFocus = null;

  function build() {
    var bg = el("img", { class: "intro-bg", alt: "", src: "img/spiderwebs_orbit_pia26306.jpg" });
    bg.addEventListener("error", function () { bg.remove(); });
    var credit = el("div", { class: "intro-credit",
      text: "Background: boxwork ridges seen from orbit by HiRISE. NASA/JPL-Caltech/Univ. of Arizona." });

    var start = el("button", { type: "button", class: "btn btn-primary intro-start", text: "Start planning" });
    start.addEventListener("click", close);

    var list = el("ol", { class: "intro-steps" });
    STEPS.forEach(function (s, i) {
      var b = el("button", { type: "button", class: "intro-step" }, [
        el("span", { class: "intro-step-n", text: String(i + 1) }),
        el("span", {}, [el("strong", { text: s[0] }), el("span", { class: "intro-step-text", text: s[1] })])
      ]);
      b.addEventListener("click", function () {
        close();
        if (s[2] === "hud") {
          var hud = document.getElementById("hud-open");
          if (hud && !hud.disabled) { hud.click(); }
        } else {
          var tab = document.getElementById("tabbtn-" + s[2]);
          if (tab) { tab.click(); }
        }
      });
      list.appendChild(el("li", {}, [b]));
    });

    box = el("div", { class: "intro", role: "dialog", "aria-modal": "true", "aria-labelledby": "intro-title" }, [
      bg,
      el("div", { class: "intro-shade", "aria-hidden": "true" }),
      el("div", { class: "intro-card" }, [
        el("div", { class: "intro-eyebrow", text: "NASA Space Apps Challenge 2026 · Interplanetary Survival Guide: Martian Map" }),
        el("h1", { class: "intro-title", id: "intro-title", text: "WALKBACK" }),
        el("p", { class: "intro-tagline", text: "Plan the walk out. Know the walk back." }),
        el("p", { class: "intro-lead",
          text: "The first crews on Mars will be 4 to 24 minutes from Earth by radio, on ground nobody has walked. Their map has to answer one question at every step: how far am I from shelter?" }),
        el("p", { class: "intro-lead",
          text: "WALKBACK plans one real Marswalk across the boxwork ridges of Mount Sharp in Gale Crater, through five places where NASA's Curiosity rover drilled and took pictures, using NASA elevation, imagery, weather and radiation data." }),
        el("div", { class: "intro-how", text: "How to explore" }),
        list,
        el("div", { class: "intro-actions" }, [start]),
        el("p", { class: "intro-fine", text: "Student project. Not affiliated with or endorsed by NASA. A planning aid, not flight software." })
      ]),
      credit
    ]);
    document.body.appendChild(box);

    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    });
  }

  function open() {
    if (!box) { build(); }
    returnFocus = document.activeElement;
    box.hidden = false;
    document.body.classList.add("intro-is-open");
    box.querySelector(".intro-start").focus();
  }

  function close() {
    if (!box) { return; }
    box.hidden = true;
    document.body.classList.remove("intro-is-open");
    if (returnFocus && returnFocus.focus && returnFocus !== document.body) { returnFocus.focus(); }
  }

  var aboutBtn = document.getElementById("intro-open");
  if (aboutBtn) { aboutBtn.addEventListener("click", open); }
  open();

})();
