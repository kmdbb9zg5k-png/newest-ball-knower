# Owner situation artwork

Owner Office has 20 original scene illustrations, mapped explicitly to all 67 authored decisions in `ownerArtwork.ts`. Related situations share a relevant scene category; this is not 67 separate photographs. Adaptive legacy decisions fall back to the owner suite. Community and Agent artwork are not reused.

## Art direction and delivery

Generated with the built-in image generator on November 7, 2026. Each scene was generated individually: fictional adult characters, premium photorealistic American football, charcoal/black/gold palette, natural anatomy, full faces within the frame, no branding, watermarks, or required readable text. These are decorative scene illustrations, not replacements for saved player/owner identities. Trade stories retain the actual player portrait and player-detail link separately.

Assets: `/public/owner-scenes/{scene}-v1.webp`, 1280×720, WebP quality 82, total 2,112,628 bytes. Lazy loading, fixed dimensions, a maximum width of 640px, and full-frame rendering limit download cost and prevent face cropping on desktop.

## Scene briefs

| Scene | Composition |
| --- | --- |
| suite | Owner and executive overlooking the football stadium |
| stadium | Ownership and architects reviewing a stadium model |
| league | League ownership meeting and vote |
| draft | Scouts and executives reviewing prospects in the draft room |
| medical | Player, owner, and physician reviewing an injury scan |
| press | Player answering questions at a press conference |
| podium | Owner addressing the media at a podium |
| fans | Owner listening to supporters at a town hall |
| community | Ownership visiting a youth flag-football program |
| business | Executives reviewing financial and sponsorship proposals |
| legal | Ownership and legal counsel reviewing a confidential report |
| locker | Coach, owner, and team leaders in a locker-room discussion |
| staff | Front-office coaching interview |
| practice | Ownership and coaching staff mediating a practice dispute |
| equipment | Equipment manager inspecting a football helmet |
| travel | Team and executives facing a charter travel disruption |
| security | Stadium security and systems review |
| media | Broadcast control-room and rights discussion |
| weather | Stadium operations reviewing storm radar |
| heritage | Retired player and owner beside a team heritage display |

## Layout behavior

Weekly career decisions now live within Owner's Decision tab, after its primary ownership situation. They no longer precede the mode header or show during setup and unrelated tabs. Setup steps, section changes, and season/week/stage transitions reset scrolling after React commits the new screen. This avoids interrupted smooth scrolling leaving a new situation partway down the page.

## Validation

- `node --import tsx scripts/owner-artwork-check.ts`: all story IDs mapped, valid WebP headers, individual and total asset budgets.
- `npm run lint`; `npm run build`.
- Owner postseason, Agent career/calendar, Solo back-navigation and career-universe checks.
- Solo fictional universe, Fantasy franchise, and franchise interaction regressions cover roster/cap rules, 17 games, playoffs, persistence, and offseason.
- `scripts/owner-season-browser.mjs`: visible setup, staff hiring, all four tabs, complete season and postseason, next-year persistence after reload, image decoding, scroll position, horizontal overflow, and page errors at 390, 320, and 1280px. Isolated anonymous-auth/cloud mocks; deterministic match randomness exercises the championship path. It does not certify live server-authoritative outcomes or physical iPhone performance.

## Story-to-scene mapping

| Story | Scene |
| --- | --- |
| star-trade-demand | press |
| stadium-partnership | stadium |
| rule-change-vote | league |
| coach-lost-room | locker |
| ticket-price-surge | fans |
| draft-quarterback | draft |
| gm-board-leak | draft |
| medical-protocol | medical |
| international-home-game | league |
| stadium-naming-rights | business |
| legend-public-feud | heritage |
| practice-facility-land | stadium |
| analytics-department | draft |
| coordinator-poached | staff |
| concession-boycott | fans |
| union-grievance | legal |
| scout-misconduct | legal |
| cap-restructure | business |
| tampering-accusation | legal |
| throwback-uniform | equipment |
| field-surface | stadium |
| weather-roof | weather |
| community-land | fans |
| charity-audit | legal |
| local-broadcast | media |
| player-social-post | locker |
| backup-quarterback | practice |
| playoff-injury | medical |
| scouts-vs-model | draft |
| draft-clock-trade | draft |
| suite-sponsor | suite |
| minority-investment | business |
| cybersecurity-breach | security |
| betting-sponsor | business |
| international-pathway | draft |
| flag-football | community |
| alumni-health-fund | medical |
| camp-holdout | locker |
| rookie-hazing | locker |
| stadium-workers | legal |
| coach-extension | staff |
| gm-firing-rumor | staff |
| fan-equity | fans |
| memorial-patch | heritage |
| streaming-rights | media |
| schedule-flex | league |
| evacuation-site | weather |
| equipment-failure | equipment |
| player-conduct | legal |
| team-plane | travel |
| practice-fight | practice |
| concussion-review | medical |
| retired-number | heritage |
| rivalry-marketing | media |
| executive-promotion | staff |
| suite-renovation | stadium |
| youth-academy | community |
| green-stadium | stadium |
| rookie-contract-error | business |
| veteran-retirement | heritage |
| assistant-strike | staff |
| mascot-injury | medical |
| owner-access | security |
| trade-physical | medical |
| playoff-hosting | stadium |
| captain-vote | locker |
| owner-apology | podium |
