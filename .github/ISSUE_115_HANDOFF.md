# Issue 115 implementation handoff

Branch: `fix/fantasy-roster-trade-flow`

Scope implemented on this branch:

- Completed live drafts now enter a dedicated, simplified post-draft fantasy hub.
- Team rows open full mobile roster drawers.
- Opponent roster players expose direct `Trade for` actions that preselect the opponent and requested player.
- Flexible 1–3 player packages are supported with human roster-cut selection when required.
- CPU opponents make immediate server-side trade decisions using fantasy value and auto-cut low-value depth when necessary.
- Lineup changes use a mobile swap sheet rather than clipped native selects.
- Post-draft fantasy UI removes NFL salary-cap and OVR-first presentation.
- All-BK is restricted to standard fantasy positions and uses projection/value.
- Awards are separated from trade tools and remain empty until games exist.
- Completed-draft admin/invite/reopen-roster clutter is bypassed by the simplified post-draft hub.
- Mobile league selector uses the league code instead of clipping the league name and routes completed leagues back into League HQ.

See `FANTASY_POSTDRAFT_QA.md` for the acceptance checklist.
