# Ball Knower 2026 — Full Upgrade Pass

## Implemented
- Official 2026 NFL gameplay cap: $301.2M.
- 20-man roster includes K and P.
- Separate K and P draft filters; corrected OL and DL/EDGE requirements.
- Smart GM engine with six personalities: balanced, star hunter, value hunter, trenches, defense first, air raid.
- AI valuation considers OVR, positional value, scarcity, need, verified cap hit, value per dollar and cap-completion safety.
- Draft grading engine (0–100 + letter grade + strengths/weaknesses).
- Data-quality audit for duplicates, invalid ratings/cap hits, missing positions and verified-vs-estimated salary counts.
- Special teams now contribute a small amount to team strength without overpowering offense/defense.

## Data authority
- Salary cap: NFL Football Operations — 2026 cap is $301.2M.
- Ratings target: EA SPORTS Madden NFL 27.
- Cap-hit field is season-specific. Never substitute AAV silently.
- Any legacy salary without a verified source remains marked/treated as estimated.

## Still requires live-data maintenance
A complete player-by-player 2026 cap-hit table cannot be truthfully fabricated from the legacy project. The app now supports verified cap-hit metadata and flags estimates. Continue replacing estimates with verified 2026 cap hits as authoritative data is imported.
