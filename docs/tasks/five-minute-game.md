# Five-Minute Game

Adds a complete arcade game to Mini Games, selectable before the existing three-step team setup. Saved mode/difficulty/teams carry to the launch URL. Existing two-minute drill and practice remain supported. Combine remains coming soon.

## Rules and behavior

- One continuous five-minute game clock, starting at the first snap (or first kick), 0–0 score, player ball at own 25. Three timeouts per team for regulation. This is game-clock time, not a five-minute wall-time promise.
- Play every home offensive snap using existing 3D movement, plays, teams, uniforms and ratings. In-bounds clock, incompletions, out-of-bounds stops, spikes, delay penalties and downs remain in force.
- CPU possessions simulate one snap at a time. Visible feed includes player names, gain/loss, clock, down/distance, field position and outcomes. Auto advances every 2.8 seconds; users can turn it off and step manually. Possession changes require a Continue button so the result cannot disappear before review. Pause and app background/rotation stop progression.
- CPU outcomes account for offense versus defense and selected difficulty. Late-game decisions consider deficit/time. Defensive user timeouts suppress runoff on the next CPU snap; CPU has its own three timeouts for hurry-up possessions.
- Punts and field goals are simulated from the playbook using roster punter/kicker ratings. FG button displays distance and success probability; attempts beyond 65 yards are disabled. Missed FG possession uses the kick spot (or 20); touchback punts go to 20. Kickoffs are automatic touchbacks to 25. Safety free kicks place the next offense at 35. TDs award 6 plus an automatic successful extra point. No user-controlled kicking or two-point conversion in this version.
- Interceptions, turnover on downs and safeties change possession. Final live plays can score after the clock reaches zero.
- Tied regulation enters untimed alternating possessions from opponent 25. Both teams get a possession each round, first possession alternates by round, and tied rounds repeat. One offensive timeout per round, 40-second play clock, no punts in OT. These are explicit arcade rules, not NFL overtime rules.
- Final screen includes score, team stats, individual offensive/kicking stats, winning-team MVP, full chronological recap, rematch and pick-new-teams controls. Rematch resets game state/timeouts/stats. No career/league results or saves are modified. In-progress games do not persist through a page reload.

## Implementation

`five-minute.js` owns pure game rules and stats. `five-minute-ui.js` owns simulation and final presentation. The existing engine calls these at possession boundaries; it retains normal 3D offense. Generated mini team data adds true base-roster K/P identities without changing lineup ratings or the source Solo universe.

## Validation

TypeScript/build and whitespace checks; 32 teams/800 identities including specialists; pure rules cases plus 90 seeded games across difficulties; actual browser tests cover live snap, possession changes, CPU play feed/timeout/pause, kicks, downs, safeties, overtime, final/rematch and a complete game with no injected clock/score. Mobile landscape sizes 844×390 and 667×375, portrait rotation. Home menu at 320/390/1280 checks saved mode, matchup URL and Solo navigation. Two-minute/practice regression suite retained. Physical iPhone not tested; browser checks use mobile Chromium emulation.

Production deployment and live verification are recorded on the PR.
