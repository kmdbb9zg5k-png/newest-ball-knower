# Fantasy League Hardening / Platform Expansion

Current branch adds a full online Fantasy League operations stack on top of the existing Ball Knower cap draft.

## Command Center
- Commissioner pause/resume, roster locks, invite controls, cap and season settings.
- Pre-simulation roster/cap readiness gate.
- Persistent activity, notifications, roster revisions and season archives.
- Atomic commissioner force-ready/reopen validation in Supabase.

## Season Universe
- 17-game weekly hub, playoffs, team pages, trades, waivers/free agency, injuries/IR, chat/receipts and legacy history.
- Accepted trades and waiver awards execute transactionally in Supabase.
- Trade/waiver actions are server-authorized and protected against duplicate awards or stale offers.

## Ball Knower Intelligence
- League news/storylines generated from actual league data.
- Weekly power rankings.
- Draft grades and value analysis.
- MVP/OPOY/DPOY/ROY plus weekly Player of the Week and All-Ball-Knower Team.
- Owner Ball Knower Rating, career wins/titles and achievements with idempotent season rollups.
- Rivalry tracker and league records book.
- Trade Lab with fairness, cap impact and roster OVR impact.
- Commissioner opt-in spectator mode with sanitized public broadcast links.
- Public spectator payloads intentionally exclude roster contents and authentication identifiers.

## Mobile architecture
Season Universe and Intelligence are lazy-loaded from League HQ so large league systems do not inflate the initial mobile route. Public spectator links route before normal app bootstrap and do not create league membership.

## Validation
Use `npm run check:hardening` (TypeScript + player/roster integrity). GitHub Actions runs the same check on pull requests.
