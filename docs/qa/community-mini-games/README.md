# Community mini game challenges

Community → Mini games lets signed-in players choose one of ten existing games,
post an open challenge or invite an accepted friend, and compare their results.
Guests can browse the game picker without signing in.

Both players use the same fictional Combine athlete (speed/acceleration 85) or
Jersey City versus Brooklyn on Pro. WR, DB and RB sessions share a challenge seed.
Full football games retain their normal gameplay randomness. One completed dash,
jump, shuttle or bench attempt is submitted automatically; route/1-on-1 modes
submit the average after the entire session (8 receiver routes, 5 1-on-1 reps).

The server validates stat types/ranges and completed rep counts, owns acceptance,
attempt tokens, expiry and score comparisons, and locks the first submitted result.
Open challenges can be claimed by one opponent. Invitations and games expire after
24 hours. Equal scores tie; football compares points, then yards, then fewer
turnovers. Submissions retry safely without replacing a result. Blocks,
suspensions, participant authorization and account-change checks apply.

These are explicitly **casual, device-reported results**, not authoritative replay
validation or simultaneous online football. They do not change trivia H2H rating.
Closing an unfinished game permits reopening it before expiry; the server locks
one submitted result, not one launch. Public browsability covers the catalog;
participants' personal challenges require sign-in.

## Validation

- `npm run lint` and `npm run build`.
- `node --import tsx scripts/mini-challenges-check.ts`: fixed launch settings,
  score precision, seeded 1-on-1 scenarios, standalone isolation, aggregation,
  one-time results, scoped parent messages and exits.
- `scripts/mini-challenges-integration.sql`: transactional, rolled-back tests
  against Supabase as the authenticated role. All ten game winners, ties,
  anonymous-account rejection, friendship, invite theft, duplicate acceptance,
  missing/incorrect attempt tokens, locked result retries, invalid/null stats,
  incomplete rep counts, open acceptance, expiry, blocking and private-table access.
- `node scripts/mini-challenges-browser.mjs`: isolated Vite fixture rendering the
  actual component; 320/390/1280px layouts, guest gate, friend challenge, real 3D
  dash completion, failed-save retry, result locking and stat comparison. Backend
  requests are fixture responses. Other game integrations are covered by existing
  simulation regressions and reporting checks, not ten complete browser sessions.
- Existing Community arena/state, Combine, mini-game logic and integrity checks.
- `npm run check:community-browser`: built app guest navigation, now including
  the Mini games catalog; private RPCs remain inaccessible to guest browsing.

The database migration is additive and already applied. Private tables deny direct
client access; the public RPC is SECURITY INVOKER and delegates to an authenticated,
checked private function. Database advisors showed only expected private-table
RLS/no-policy informational entries for the new objects, with no exposed definer
warning for the new public RPC. Existing project advisories remain outside scope.

Browser screenshots use software rendering; they do not certify physical iPhone
frame rate. `mobile-lobby.webp` and `locked-result.webp` show the tested UI.
