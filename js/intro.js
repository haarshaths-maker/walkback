// AI-assisted: written with Claude Code (Opus 5.5), reviewed by the team.
//
// intro.js shows a welcome screen the first time the page opens: the one
// problem WALKBACK solves, what the site is (one pre-planned walk, not a
// route finder), and how to read it. "Open the plan" (or Esc) closes it;
// "Helmet view" closes it and opens the HUD; the "About" button in the top
// bar opens it again.
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

  // Three one-line keys to reading the site: [what you see, what it means].
  var POINTS = [
    ["Map colours", "walking minutes back to the rover, from every point of the site."],
    ["Plan", "the route and five safety checks, each pass or fail, with its NASA source."],
    ["Helmet view", "walk the route as the crew would see it through the visor."]
  ];

  var box = null;
  var returnFocus = null;

  function build() {
    var bg = el("img", { class: "intro-bg", alt: "", src: "img/spiderwebs_orbit_pia26306.jpg" });
    bg.addEventListener("error", function () { bg.remove(); });
    var credit = el("div", { class: "intro-credit",
      text: "Background: boxwork ridges seen from orbit by HiRISE. NASA/JPL-Caltech/Univ. of Arizona." });

    var start = el("button", { type: "button", class: "btn btn-primary intro-start", text: "Open the plan" });
    start.addEventListener("click", close);

    var helmet = el("button", { type: "button", class: "btn intro-helmet", text: "Helmet view" });
    helmet.addEventListener("click", function () {
      close();
      var hud = document.getElementById("hud-open");
      if (hud && !hud.disabled) { hud.click(); }
    });

    var list = el("ul", { class: "intro-points" });
    POINTS.forEach(function (p) {
      list.appendChild(el("li", {}, [el("strong", { text: p[0] + ": " }), p[1]]));
    });

    var card = el("div", { class: "intro-card", tabindex: "-1" }, [
      el("div", { class: "intro-eyebrow", text: "NASA Space Apps Challenge 2026 · Interplanetary Survival Guide: Martian Map" }),
      el("h1", { class: "intro-title", id: "intro-title", text: "WALKBACK" }),
      el("p", { class: "intro-tagline", text: "Plan the walk out. Know the walk back." }),
      el("p", { class: "intro-lead",
        text: "On Mars, help is 4 to 24 minutes away by radio. So the crew's map has to answer one question at every step: how many minutes am I from shelter?" }),
      el("p", { class: "intro-lead intro-lead-2",
        text: "This is one pre-planned Marswalk at the boxwork ridges of Mount Sharp in Gale Crater. The crew leaves a parked pressurised rover, visits five sites where NASA's Curiosity rover drilled and took pictures, and walks back. There is no destination to choose: the route is computed from NASA data, and you inspect it." }),
      list,
      el("div", { class: "intro-actions" }, [start, helmet]),
      el("p", { class: "intro-fine", text: "Student project. Not affiliated with or endorsed by NASA. A planning aid, not flight software." })
    ]);

    box = el("div", { class: "intro", role: "dialog", "aria-modal": "true", "aria-labelledby": "intro-title" }, [
      bg,
      el("div", { class: "intro-shade", "aria-hidden": "true" }),
      card,
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
    box.scrollTop = 0;
    document.body.classList.add("intro-is-open");
    // Focus the card itself (not a button) so screen readers start at the
    // top and no focus ring sits on the button before anyone uses the keyboard.
    box.querySelector(".intro-card").focus({ preventScroll: true });
  }

  function close() {
    if (!box) { return; }
    box.hidden = true;
    document.body.classList.remove("intro-is-open");
    // The map may have been sized while hidden behind the dialog.
    if (window.WALKBACK && WALKBACK.map) { WALKBACK.map.invalidateSize(); }
    if (returnFocus && returnFocus.focus && returnFocus !== document.body) { returnFocus.focus(); }
  }

  var aboutBtn = document.getElementById("intro-open");
  if (aboutBtn) { aboutBtn.addEventListener("click", open); }
  open();

})();
