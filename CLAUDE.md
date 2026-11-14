# Standing rules for this repo

- WALKBACK is a static website: HTML, CSS, plain JavaScript and Leaflet 1.9.4 from the unpkg CDN. No build step, no frameworks, no backend, no API keys.
- docs/SPEC.md is the single source of truth for every URL, layer ID, coordinate, number and schema. Never invent, round or "improve" any of them. If something you need is missing, stop and ask.
- Always write complete files, never fragments. Comment the code for beginners.
- Every number shown to the user comes from a data file or SPEC and carries its unit. Every modelling choice is labelled ASSUMPTION in the interface.
- No NASA logos, insignia or mission patches. No AI-generated images.
- Relative paths only; the site is served from /walkback/ on GitHub Pages.
- First line of every code file: a comment "AI-assisted: written with <the AI tool and model you are>, reviewed by the team."
- After each task: say how to test it in a browser; append a dated line to AI_USE.md describing what you generated and which AI tool did it; commit with a clear message and push to main.
- Do not add features that were not asked for.
