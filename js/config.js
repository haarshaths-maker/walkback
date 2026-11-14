// AI-assisted: written with Claude (Fable 5.2), reviewed by the team.
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
  transparentTile: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
};
