// AI-assisted: written with Claude (Fable 5.2) and Claude Code (Opus 5.5), reviewed by the team.
//
// config.js holds the settings that do not change while the page runs.
// Every value here comes from docs/SPEC.md. Do not edit numbers or IDs here
// without changing SPEC first.

const WALKBACK = {

  // Where the site's own data files live (relative paths, so the site works
  // at https://<user>.github.io/walkback/ and on a local test server).
  dataPaths: {
    config: "data/config.json",
    stops: "data/stops.json"
  },

  // Mars Trek tile URL pattern (SPEC section 4). {z}/{y}/{x} are filled in by
  // Leaflet: zoom level, tile row, tile column.
  trekUrl: function (layerId, ext) {
    return "https://trek.nasa.gov/tiles/Mars/EQ/" + layerId +
           "/1.0.0/default/default028mm/{z}/{y}/{x}." + ext;
  },

  // Base map layers (SPEC section 4). "bounds" is [[south, west], [north, east]]
  // and stops Leaflet asking for tiles outside the area a layer covers.
  baseLayers: [
    {
      label: "HiRISE optical (0.64 m)",
      id: "curiosity_hirise_mosaic",
      ext: "png",
      maxNativeZoom: 16,
      bounds: [[-4.9254743, 137.1224669], [-4.2489588, 137.7298129]],
      attribution: "HiRISE: NASA/JPL-Caltech/Univ. of Arizona via Mars Trek",
      isDefault: true
    },
    {
      label: "CTX optical (context)",
      id: "curiosity_ctx_mosaic",
      ext: "png",
      maxNativeZoom: 10,
      bounds: [[-7.2137273, 136.2768326], [-3.5804738, 139.3864225]],
      attribution: "CTX: NASA/JPL-Caltech/MSSS via Mars Trek"
    },
    {
      label: "THEMIS day infrared (100 m, context only)",
      id: "THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018",
      ext: "png",
      maxNativeZoom: 9,
      bounds: null,
      attribution: "THEMIS: NASA/JPL-Caltech/Arizona State Univ. via Mars Trek"
    },
    {
      label: "THEMIS night infrared (100 m, context only)",
      id: "THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018",
      ext: "png",
      maxNativeZoom: 9,
      bounds: null,
      attribution: "THEMIS: NASA/JPL-Caltech/Arizona State Univ. via Mars Trek"
    },
    {
      label: "MOLA + HRSC colour hillshade (global)",
      id: "Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw",
      ext: "jpg",
      maxNativeZoom: 8,
      bounds: null,
      attribution: "MOLA/HRSC: NASA/JPL/GSFC, ESA/DLR/FU Berlin via Mars Trek"
    }
  ],

  // Map zoom limits. Zoom 16 is the sharpest HiRISE tile level (about 0.64 m
  // per pixel); beyond that Leaflet enlarges the same tiles.
  minZoom: 8,
  maxZoom: 20,

  // A 1x1 transparent image. Used when a tile fails to load, so the map
  // shows nothing instead of a broken-image icon.
  transparentTile: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",

  // Small line icons drawn as inline SVG (no image files, no icon font).
  // They use the current text colour, so CSS decides their colour.
  iconSvg: {
    check: '<path d="M3.5 8.5l3 3 6-7" />',
    cross: '<path d="M4 4l8 8M12 4l-8 8" />',
    alert: '<path d="M8 2.2L14.5 13.5h-13z" /><path d="M8 6.5v3.2M8 11.6v.2" />',
    info: '<circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 4.9v.2" />',
    close: '<path d="M4 4l8 8M12 4l-8 8" />',
    print: '<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" />',
    helmet: '<path d="M2.5 9.5a5.5 5.5 0 0 1 11 0v2.5h-11z" /><path d="M5 9.5h6" />'
  },

  // Make an icon element: WALKBACK.icon("check")
  icon: function (name) {
    var span = document.createElement("span");
    span.className = "icon icon-" + name;
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (this.iconSvg[name] || "") + "</svg>";
    return span;
  }
};

// ------------------------------------------------------------------
// ASSUMPTION labels
// ------------------------------------------------------------------
// Every modelling choice in the interface is written as "ASSUMPTION: ...".
// This turns that prefix into a small "ASSUMPTION" tag followed by the
// explanation, wherever such a line appears (now or later), so the labels stay
// visible but read calmly. The words themselves are not changed.
(function () {
  "use strict";
  var SELECTOR = ".assumption, .legend-note, .storm-rule";

  function decorate(node) {
    if (node.getAttribute("data-assumption") === "done") { return; }
    var text = node.textContent;
    var match = /^\s*ASSUMPTION:?\s*/.exec(text);
    if (!match || node.children.length) { return; }   // only plain text lines starting with ASSUMPTION
    node.setAttribute("data-assumption", "done");
    node.textContent = "";
    var tag = document.createElement("span");
    tag.className = "assume-tag";
    tag.textContent = "ASSUMPTION";
    node.appendChild(tag);
    node.appendChild(document.createTextNode(" " + text.slice(match[0].length)));
  }

  function scan(root) {
    if (root.nodeType !== 1) { return; }
    if (root.matches(SELECTOR)) { decorate(root); }
    root.querySelectorAll(SELECTOR).forEach(decorate);
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) { m.addedNodes.forEach(scan); });
  }).observe(document.body, { childList: true, subtree: true });
})();
