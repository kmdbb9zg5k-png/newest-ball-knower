# Ball Knower Fantasy UI System

This document is the implementation brief for the fantasy redesign reference in `fantasy-ui-system-reference.jpg`.

![Fantasy UI system reference](./fantasy-ui-system-reference.jpg)

## Goal

Use the reference as the visual language for the entire Ball Knower fantasy experience. Preserve Ball Knower's dark/black + gold identity while making the fantasy product feel cohesive, information-dense, mobile-native, and at least Yahoo-level in clarity.

Do not blindly copy text/numbers from the mockup. Existing production data and authoritative fantasy logic remain the source of truth. The image is a layout/interaction target.

## Core design rules

- Fixed top app header and fixed bottom primary navigation must respect iOS safe areas.
- Page content must never render underneath either fixed bar.
- The intro/loading state is a full-screen takeover: show only the intro video. Do not render the header or bottom tabs until loading completes.
- Use consistent card radius, border treatment, spacing, typography, gold actions, muted metadata, and player headshot treatment across all fantasy screens.
- Use weekly opponent + weekly projection as the primary decision context on lineup/matchup surfaces. Season projection/rank is secondary.
- Never label missing opponent metadata as a Bye.
- Every actionable player row/card should adapt to ownership state.

## Ownership-aware player actions

- User's own player: roster actions such as Start/Bench/Swap, Player Card, Drop, IR where legal, Trade where appropriate.
- True free agent: `ADD`.
- Waiver player: `CLAIM`.
- Opponent-owned player: `TRADE FOR`.
- Opponent Player Card should expose a prominent/sticky `TRADE FOR <PLAYER>` CTA that opens Trade Center with the player and trade partner preselected.

## 1. My Team / Lineup

Reference: top-left screen.

Required behavior:
- Label lineup state accurately. `LINEUP VALID` means legal; do not call it `LINEUP READY` unless optimization logic actually recommends the starters.
- Add `Optimize Lineup` / suggested-moves behavior using authoritative weekly projections and lineup legality.
- Replace oversized repeated SWAP buttons with compact row actions; the whole row may be tappable.
- Player rows should show: slot, headshot, name, team/position, opponent, kickoff, weekly projected points, status, compact action.
- Bench rows must be equally tappable and actionable.
- Save controls should appear/stick above the bottom nav when the lineup is dirty. Prefer `Save Changes (N)`; do not permanently consume large vertical space when nothing changed.
- Surface injury, bye, locked/started-player, and invalid-lineup warnings clearly.

## 2. Matchup

Reference: top second screen.

Required behavior:
- Head-to-head layout with both managers/teams, score/projection, win/advantage indicator, and aligned positional rows.
- Keep all content below the fixed header and above the fixed bottom nav.
- FLEX/WRT and other long slot labels must never overlap projections or player text.
- `All Matchups` should allow every league matchup and every valid week to be selected.
- Player taps open the shared Player Card.

## 3. Add Players

Reference: top third screen.

Rename the vague fantasy subtab from `Players` to `Add Players`.

Inside use clear filters/tabs such as:
- Free Agents
- Waivers
- IR / relevant availability view

Required behavior:
- Free agents show `ADD`, not `CLAIM`.
- Waiver players show `CLAIM`.
- Add position filters: All, QB, RB, WR, TE, K, DEF/DST.
- Add useful sorting/filtering: weekly projection, season rank, position rank, rostered/availability metadata where authoritative.
- Search by player, team, or position.

## 4. Player Card

Reference: top fourth screen.

Required behavior:
- Consistent player identity header, team, position, roster owner, status, rank, 2026 projection, 2025 points.
- Tabs: Overview, Game Log, Stats, News where data exists.
- 2026 schedule/game log should cover Weeks 1-18 with correct opponent, home/away, kickoff and verified Bye handling.
- 2025 game logs should render whenever authoritative identity mapping exists.
- Opponent-owned players get `TRADE FOR` CTA.
- Free agents get Add/Claim based on waiver state.
- User-owned players get roster actions.

## 5. Trade Center

Reference: top fifth screen.

Required behavior:
- Selecting `TRADE FOR` from a Player Card should open this screen with opponent and requested player already selected.
- Support multiple players and picks when the league format allows it.
- Show both sides clearly: You Get / They Get.
- Enforce roster-size, position/lineup, ownership, deadline, started-player, and any commissioner/review rules before submission.
- Preserve existing trade messaging/voting/review logic.

## 6. League Standings

Reference: bottom-left screen.

Required behavior:
- Standings table optimized for mobile: record, PF, PA, streak, playoff context.
- Tabs can include Standings / Schedule / Playoffs.
- Keep dense data readable without horizontal page overflow.

## 7. All Matchups

Reference: bottom second screen.

Required behavior:
- Dedicated league-wide weekly matchup view.
- Week picker with clear previous/next controls.
- Every matchup is tappable to open full head-to-head view.
- Distinguish scheduled/live/final states.

## 8. Waiver Wire

Reference: bottom middle screen.

Required behavior:
- Separate waivers from true free agents.
- Show waiver processing time/date, claim action, weekly projection and useful rostered/availability context.
- Expose user's waiver order / FAAB context where relevant.

## 9. Power Rankings

Reference: bottom fourth screen.

Required behavior:
- Rankings should be fantasy-specific, not Madden OVR driven.
- Inputs should include roster strength, weekly/season projections, record, points scored, matchup performance, injuries/availability, and other existing fantasy metrics.
- Show trend movement where meaningful.

## 10. Draft Room

Reference: bottom-right screen.

Required behavior:
- Keep the same visual system as post-draft fantasy.
- On-the-clock state, round/pick, prior picks, roster needs, player search/filtering, queue/favorites/DND, pre-ranks, ADP, team roster and chat should remain available.
- Preserve existing draft recovery/autopick/reconnect logic.

## Navigation

Preferred fantasy sub-navigation:
- My Team
- Matchup
- Add Players
- League

Secondary league tools should live inside League instead of forcing an overcrowded horizontal tab strip. If more top-level tabs remain, make the strip intentionally horizontally scrollable with an obvious affordance; never leave a mystery half-clipped tab.

Primary app bottom navigation remains:
- Home
- Fantasy
- Picks
- Trivia
- Profile

## Mobile requirements

Must be manually verified on physical iPhone in portrait and landscape after implementation:
- safe-area top/notch handling
- fixed header
- fixed bottom nav
- no content hidden under navigation
- no horizontal page overflow
- tap targets
- modal/player-card scroll behavior
- keyboard/search behavior
- rotation

## Current user-reported issues this redesign must resolve

1. Loading screen currently shows app header/bottom bars; intro should be video only.
2. Matchup content can slide under the top header and bottom nav.
3. FLEX/WRT label can overlap projection values.
4. Opponent player cards are missing a `TRADE FOR` action.
5. `Players` is too vague for the Add Players/free-agent workflow.
6. True free agents incorrectly use `CLAIM` instead of `ADD`.
7. Current lineup UI overuses large SWAP buttons.
8. `LINEUP READY` is misleading when it only means lineup legality.
9. Lineup pages should prioritize weekly projections/opponents instead of season-only projection context.
10. Save Lineup should become a dirty-state `Save Changes` action rather than a permanently huge divider.
11. Fantasy sub-navigation is cramped/partially clipped on iPhone.

## Implementation instruction for Work mode

Treat this image + document as the approved design direction, not as a request to replace working fantasy logic. Refactor incrementally, reuse shared components where possible, preserve production behavior, and keep the current hardening/integration suite green. Add/extend UI regression checks for ownership-aware actions, Add vs Claim, safe-area spacing, lineup dirty state, and matchup row layout. Do not merge the redesign until authenticated production-preview testing passes on mobile.