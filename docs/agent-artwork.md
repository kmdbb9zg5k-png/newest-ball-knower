# Agent Mode situation photography

Ten original cinematic images, generated with the built-in image generator on 2026-11-07. Files live in `public/agent-scenes/*-v1.webp`; exported to 1280px WebP at quality 82. Total 744,946 bytes. Images are decorative scene illustrations, not replacements for persistent player portraits. Community keeps its own artwork.

Shared prompt direction: single photorealistic editorial 16:9 scene for an American football agency game; fictional people, charcoal and warm gold palette, realistic hands and faces, no logos, captions, watermarks, soccer, or collages.

| Asset | Situation / scene prompt |
| --- | --- |
| headquarters-v1.webp | Female agent and colleague reviewing a prospect dossier at a walnut desk, stadium through office glass, American football and helmet on shelves. |
| recruiting-v1.webp | Agent interviewing an adult prospect beside a practice field at golden hour, scouting folder and football equipment. |
| contract-v1.webp | Agent, general manager and athlete negotiating in a team boardroom, contract folder on the table. |
| role-v1.webp | Coach, agent and player discussing playing time and tactical diagrams in a film room. |
| injury-v1.webp | Athlete with knee brace consulting a physiotherapist and agent in a sports rehabilitation room. |
| trade-v1.webp | Agent making a confidential phone call in a stadium tunnel while an athlete with duffel bag waits. |
| family-v1.webp | Athlete, partner and daughter speaking with their agent in a comfortable home. |
| brand-v1.webp | Athlete at a commercial photo shoot while agent and photographer review images. |
| growth-v1.webp | Four agency staff collaborating on scouting folders and laptops around a conference table. |
| media-v1.webp | Composed agent answering reporters in a stadium media corridor. |

`AgentArtwork` owns the scene paths; `AGENT_EVENT_SCENES` exhaustively maps all six client event kinds. The weekly story uses role, agency war room and media scenes. Meetings and negotiations keep their close controls above the photography. All images have reserved dimensions, lazy loading and asynchronous decoding.

Visual check: run `BK_QA_ART=1` with `scripts/agent-season-browser.mjs`. `BK_QA_LAYOUT_ONLY=1` stops after entry, recruiting and contract layout checks; omit it for full season and event screenshots. API/account traffic is isolated by the harness.
