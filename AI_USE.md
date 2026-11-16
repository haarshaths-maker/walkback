# AI use

We used AI coding assistants (Claude and Claude Code, by Anthropic) to help write the code and documentation and to help find and check data sources. The team directed the project, ran the data notebook, tested every feature, checked the numbers against their NASA sources, and made the final decisions.

No AI-generated images, video or audio are used. Every picture is a NASA photograph or a map drawn from NASA data. No NASA logos or mission emblems are used.

Each code file starts with a one-line comment noting that it was AI-assisted.

## Log

- 2026-11-14: AI assistants helped find and check the NASA and USGS data sources and write the data pipeline (notebooks/) and the computed files in /data.
- 2026-11-14 to 2026-11-15: AI assistants helped write the website code (index.html, css/, js/) and the documentation.
- 2026-11-16: Claude Code helped polish the interface and fix layout bugs.
- 2026-11-16: Claude Code helped find a Curiosity Navcam photo taken at each stop that lacked one (Rover Park, Altadena, First ridge, Ridge overlook) in NASA's raw image archive, matched by sol to NASA's waypoint file, and added them to data/images.json, data/stops.json, docs/SPEC.md and CREDITS.md.
