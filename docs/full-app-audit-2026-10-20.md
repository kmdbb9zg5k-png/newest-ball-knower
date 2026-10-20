# Ball Knower audit — October 20, 2026

Baseline: main and Vercel production both at `2fcbd467f62675e57cfeb9e446d3cd307349fcc0` (RB drill PR #473). Historical audit #151 is closed/completed. Older graphics PR #389 is open and was not included.

## Findings and actions

1. **Critical availability:** production returned HTTP 402 with `x-vercel-error: DEPLOYMENT_DISABLED`. Resumed the existing Vercel project through its supported API; the production homepage then returned HTTP 200. The reason it became disabled was not exposed by the project metadata; no billing changes or new services were purchased.
2. **High privacy:** browser and server diagnostic filters failed to remove standalone bearer tokens and credentials in quoted JSON, including passwords with spaces. Corrected both filters; preserved query delimiters and added escaped-quote coverage. The server also now applies the browser's standalone JWT filter. This is defense in depth for common credential shapes, not a guarantee that arbitrary free-text personal information is removed.
3. **Medium recovery:** issue-report requests had no client deadline and could leave the UI stuck sending. Added a 12-second abort deadline so the existing email fallback can run.
4. **Performance follow-up:** build emits warnings for large chunks, including Mermaid (~1.73 MB minified). These warnings alone do not establish initial-load impact; measure route loading before restructuring dependencies.

## Verification

- Existing `npm run check:hardening` passed, including TypeScript, draft matrices, transactions, live-scoring contracts, league security contracts, notifications, history, lineups, account identity, Solo fictional/fantasy, Agent/Owner progression, native release contracts, intro lifecycle, waivers, and production origin checks.
- Production build passed; large-chunk warnings remain.
- RB simulation: 336 reps across 15/60/120 Hz.
- DB simulation: 120 reps across routes and frame rates.
- WR/man coverage: 135 reps including randomized routes and wrong/no input.
- New privacy test invokes the real issue-report handler with a mocked mail provider; no email is sent. Tests bearer, authorization, JSON strings including escaped quotes, query parameters, JWT-shaped values, readable nonsecret text and length limits.
- Added privacy gate to the hardening suite.

## Limits and next priorities

This is a broad automated baseline plus targeted source review, not a claim that every line and every user journey has been manually reviewed. Local mobile browser tests could not launch: the required Chromium executable was missing and the browser download was invalid/truncated. Physical iPhone performance, native audio and push, authenticated two-device drafts, account conversion/restore, and live database authorization still need end-to-end checks. Static security contracts do not prove production database policy behavior. No new paid integrations or speculative gameplay redesigns were introduced.
