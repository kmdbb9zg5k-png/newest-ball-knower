# Mini Games: sequential team selection

Approved three-screen concept implemented: Pick Your Team → Pick Opponent → View Matchup. Removed the two compact summary cards. Both team confirmations are required before Start Game appears. The review uses existing mascot art, team names/OVR, and a side-by-side offense/defense/special-teams table. Change-team, change-opponent, back, close, Escape, difficulty persistence, and saved teams remain supported. Step changes reset scroll and focus the heading.

All 32 photographic team selections remain available, with team 16 as the fresh default. Opponents exclude the chosen team; choosing the previous opponent as your team swaps the prior home team into the opponent slot. Stable player artwork and top-three player identities are unchanged.

Offense/defense/overall retain existing starting-lineup values. Special teams is the rounded average of the base Solo roster's kicker and punter overall ratings, generated into miniSelectorArt.ts without importing the full roster into the UI. It is a comparison value, not a new simulation modifier. Generator and check enforce both specialists for every team. No shared roster or 3D gameplay changes.

Two-Minute Drill remains the playable mode. Five-Minute Game and Combine remain listed under Game modes as coming soon.

Verification: TypeScript, production build, 32-team data/asset checks, and browser flows at 320/390/1280. Browser checks cover team exclusions, team swapping, all carousel assets, matchup rows, focus/scroll transitions, launch URL, difficulty and team persistence, close/Escape, and Solo navigation. Production kickoff verification is recorded on the PR. Mobile verification uses Chromium emulation, not a physical iPhone.
