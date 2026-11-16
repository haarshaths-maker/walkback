# AI use

We used AI coding assistants (Claude, by Anthropic) to help write code and documentation and to capture the screen recording used in our demo. The team directed the project, checked the data against NASA sources and made the demo video. No AI-generated images, video or audio are used.

## Log

- 2026-11-14: AI assistants helped find and check the NASA and USGS data sources and write the data pipeline (notebooks/) and the computed files in /data.
- 2026-11-14 to 2026-11-15: AI assistants helped write the website code (index.html, css/, js/) and the documentation.
- 2026-11-16: Claude Code helped polish the interface and fix layout bugs.
- 2026-11-16: Claude Code helped find a Curiosity Navcam photo taken at each stop that lacked one (Rover Park, Altadena, First ridge, Ridge overlook) in NASA's raw image archive, matched by sol to NASA's waypoint file, and added them to data/images.json, data/stops.json, docs/SPEC.md and CREDITS.md.
- 2026-11-16: Claude Code captured a silent 30-second screen recording of the site (a scripted browser session, not generated imagery) and a subtitle file for the team's demo video; the team made the final video.
- 2026-11-16: Claude Code updated docs/PROJECT_PAGE_DRAFT.md for submission (team name, a submit checklist, the AI-use paragraph now covering the demo screen recording, and removed an inaccurate mention of NASA AEGIS as traverse-planning prior work).
- 2026-11-16: GPT (Codex, OpenAI), run through OpenRig, wrote a fix in js/app.js so the map fits the site when the page first loads while the map is hidden, instead of opening fully zoomed in; Claude Code reviewed it in a browser and committed it.
- 2026-11-15: Claude helped fill in the Space Apps project page, re-encoded the demo video to 720p and uploaded it to YouTube as Unlisted (https://youtu.be/mG5vUx7IZhw). The video content itself was made by the team; no AI-generated imagery was added.
