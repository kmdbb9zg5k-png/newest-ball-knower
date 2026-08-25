# Fantasy post-draft QA

This branch is not complete until these mobile-first checks pass together:

1. Completed live draft opens the simplified post-draft fantasy hub, not the old stacked command/admin experience.
2. League > Teams & Standings > any opponent opens a full roster drawer.
3. Every opponent player has a `Trade for` action that opens Activity > Trades with the opponent and requested player preselected.
4. Trade builder supports 1–3 players on either side, including 2-for-1 and 1-for-2 packages, and asks the human owner for required roster cuts only when their side would exceed 20 players.
5. CPU trade targets decide immediately server-side using fantasy projection/value and automatically choose a low-value roster cut when needed.
6. Human recipients can accept, reject or counter from the same trade area; unequal counter packages are supported.
7. My Team uses a mobile swap sheet instead of clipped native player-name selectors.
8. Fantasy projection/rank/value is the primary player context; generic OVR and NFL salary/cap are not shown in the post-draft fantasy UI.
9. Standard-fantasy All-BK Team contains only QB/RB/WR/TE/FLEX/K/DST and never OL/DL/EDGE/LB/CB/S/P.
10. Weekly awards remain empty until games exist; Trade tools are separated from Awards/Intel.
11. CPU labels are compact badges and display names no longer look like `Tyler CPU` test fixtures in the post-draft UI.
12. Completed-draft League HQ no longer exposes giant owner-admin/reopen-roster/invite/salary-cap panels or debug implementation copy.
13. Global mobile league selector shows a stable league code instead of a clipped partial league name and routes completed leagues back to League HQ rather than straight to results.
14. Start-season CTA remains available and works from the simplified post-draft hub.
15. Typecheck, integrity check, production build, and GitHub review checks pass before merge.
