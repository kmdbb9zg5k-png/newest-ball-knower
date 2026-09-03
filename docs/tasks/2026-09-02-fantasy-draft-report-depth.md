# Fantasy draft report depth pass

## Goal
Make the post-draft report feel like a serious fantasy analyst reviewed every manager's draft. Every completed standard-fantasy roster must receive a deterministic A+ through F grade, a projected regular-season W-L record, and specific evidence explaining the result.

This is an enhancement of the existing `fantasyDraftReport.ts` engine and completed-draft UI. Do not replace the current fantasy-only grading architecture and do not use Madden OVR or salary/cap efficiency.

## Preserve
- Existing `buildFantasyDraftReports` entry point if practical.
- Existing grade scale and league-relative projected W-L balancing unless a clearly better deterministic implementation is required.
- 2026 fantasy projections/rankings as the principal input.
- Current all-team completed-draft cards in `LeagueLiveDraftRoom.tsx`.
- Current projected record clearly labeled as preseason estimate, not a guarantee.
- Current mobile density and black/gold UI.

## Required analytical output per team
Extend `FantasyDraftReport` with enough structured data to render and test all of the following:

1. Overall grade and numeric score.
2. Projected W-L record and projection rank.
3. Projection score.
4. Roster-construction score.
5. Draft-value score.
6. Bench/depth score and human-readable bench-quality tier.
7. Explicit positional strengths, preferably 1-3 concise strings.
8. Explicit positional weaknesses/risks, preferably 1-3 concise strings.
9. Best value/steal player when evidence supports one, with pick number and ranking/value delta.
10. Biggest reach player when evidence supports one, with pick number and ranking/value delta.
11. Best projected starter or strongest position group where useful.
12. Projection coverage/confidence note when data is incomplete.
13. A concise overall explanation that references the most important evidence rather than generic filler.

## Grading rules
- Standard fantasy starting structure: QB, RB, RB, WR, WR, TE, FLEX, K, D/ST.
- FLEX may use RB/WR/TE (FB can map to RB if present in source data).
- Value must compare pick slot against current 2026 fantasy rank/ADP-style rank input, not Madden OVR.
- Projection strength must emphasize starters while giving meaningful but smaller weight to usable bench depth.
- Penalize unrealistic bench construction such as excessive backup QB/TE/K/DST at the expense of RB/WR depth.
- Do not punish a normal fantasy roster for lacking NFL salary efficiency.
- Do not let one extreme steal/reach dominate the entire grade.
- A roster missing required starting positions must take a substantial construction penalty.
- Bench quality should reward playable RB/WR/TE depth and reasonable QB/TE insurance; K/DST hoarding should not inflate it.
- If rankings/projections are missing for a material portion of a roster, lower confidence rather than fabricating values.
- Projected league wins must remain coherent: for a no-tie preseason estimate, total projected wins across the league should approximately equal half of total team-games, as the current implementation does.

## Positional analysis
For QB/RB/WR/TE/FLEX-depth/K/DST, derive league-relative or roster-relative quality from available projections. Produce useful language such as:
- `RB room projects top 3 in the league.`
- `WR starters are strong, but bench depth is thin.`
- `TE projects below league average.`
- `Only one playable RB remains behind the starters.`

Do not claim exact rank unless the engine actually calculates it.

## Pick analysis
For each ranked pick calculate a bounded value delta:
- positive = selected later than 2026 rank (value/steal)
- negative = selected earlier than 2026 rank (reach)

Expose the strongest positive and strongest negative examples only when the magnitude is meaningful (for example >= 5 slots, with sensible scaling by round/league context if implemented).

Example rendered copy:
- `Best value: DeVonta Smith at Pick 61, 17 spots after his Ball Knower rank.`
- `Biggest reach: Player X at Pick 34, 21 spots ahead of rank.`

## Completed-draft UI
In `LeagueLiveDraftRoom.tsx`, every manager card must show without requiring hidden developer data:
- Grade / score
- Projected W-L
- Projection rank
- Main explanation
- Strengths
- Risks/weaknesses
- Best value and biggest reach when present
- Bench/depth quality

Keep the card compact. Use progressive disclosure if necessary (for example a small details section), but the grade and W-L must remain immediately visible.

The current user's summary at the top should also include the richer explanation, not a different grading system.

## Edge cases
Cover:
- 6, 8, 10, 12, 14, 16-team leagues
- 15-20 player rosters
- incomplete projection coverage
- tied projected team strength
- all players drafted near rank
- a team with multiple steals
- a team with multiple reaches
- extra QB/TE/K/DST
- weak RB/WR depth
- complete legal roster with balanced depth

## Tests
Extend the existing fantasy UI/draft report regression coverage or add a focused test. At minimum prove:
1. Every input team receives exactly one report.
2. Stronger projected starter roster ranks above a materially weaker one.
3. W-L totals remain league-coherent.
4. A balanced roster scores better construction than one hoarding QB/K/DST while thin at RB/WR.
5. Strong RB/WR bench depth raises bench score.
6. Best-value player is correctly identified.
7. Biggest-reach player is correctly identified.
8. Missing projection coverage produces a confidence warning instead of invented numbers.
9. No draft report logic references `ovr`, salary, cap, or cap efficiency.
10. All completed-draft manager cards render grade and projected W-L.
11. Rich report fields are rendered without mobile horizontal overflow.

## Gates
Run and pass:
- `npm run lint`
- `npm run check:fantasy-ui`
- `npm run check:draft-reliability`
- `npm run check:yahoo-parity`
- `npm run check:hardening`
- `npm run build`
- `npm run check:root-bundle` after build
- mobile browser regression if the completed-draft card markup is changed in a way covered by the suite.

## Release standard
Do not report this complete merely because a grade exists; one already exists. Completion means the grade now answers **why**, identifies roster strengths and risks, evaluates bench quality, identifies meaningful reach/steal context, and still provides a coherent projected W-L record for every team.
