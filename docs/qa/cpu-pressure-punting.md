# CPU offense and playable punts

Replaces the fixed CPU throw timer with position-based reads: awareness/difficulty reaction time, receiver separation, defenders in throwing lanes, closing pressure, short outlets, escape paths and outside-pocket throwaways. Recognized blitzes give the RB/TE short routes. Throws still have a windup and can be disrupted. Late trailing teams pass more; teams protecting a lead favor runs unless distance calls for a pass.

Live and simulated CPU possessions share fourth-down choices using distance, field position, score, clock, opposing timeouts, kicker rating/range and the existing equal-possession overtime rules. Examples: punt deep in own territory, consider short-yardage attempts near midfield, take a plausible tying/winning field goal, keep possession when a late touchdown is necessary. These are game heuristics, not an NFL analytics model.

Punt button now starts a live unit: long snap, punting animation, directional/power controls, flight, coverage and returns. CPU punts enter the same unit with user return control and fair-catch choice. Touchbacks use the 20. Observed return spots feed possession directly; no second random simulation. Return touchdowns, coverage recoveries, safety outcomes, clocks and duplicate-result protection are handled. Punts remain disabled in the existing overtime format.

Validation:
- TypeScript lint and production build passed.
- CPU decision tests cover field position, fourth-and-short/long, deficits/leads, timeouts, kicker range and overtime; QB reaction under pressure; punt possession/clock/return TD/recovery/safety.
- Full-game rules and 90 seeded games passed.
- Live-unit browser suite passed including the new user-punt/CPU-punt/fair-catch/touchback cases and existing conversion/defense/kickoff flows.
- Focused browser checks passed for a live pressure-triggered quick release and an animated outside-pocket throwaway.
- Inspected punt formation/camera screenshot and tightened framing to keep the punter visible.

Production verification uses deployed bytes via a Node fetch relay because the browser in this environment cannot directly reach the public domain. No migration or manual setup is needed.
