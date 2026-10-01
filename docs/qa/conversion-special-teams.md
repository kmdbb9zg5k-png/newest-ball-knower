# Conversion playbook

After a user touchdown, the offensive playbook opens to Special Teams with Field Goal, Fake Field Goal Pass and Fake Field Goal Run. Field Goal starts the existing manual extra-point kick. The holder takes the long snap on both fakes; passing and running use the existing offensive controls. A fake is a two-point try from the kick formation at the 15. Other formations remain selectable for a standard try from the 2.

The conversion freezes the game clock, saves and restores the touchdown drive, and resolves through the existing conversion rules. Failed fakes score zero; successful fakes score two. Normal play selection and CPU pass selection exclude these conversion-only plays.

Validation:
- TypeScript lint and production build passed.
- Five-minute rules, paired overtime, scoring and 90 seeded complete games passed.
- Mini-game clock and outcome checks passed.
- Live-unit browser suite passed: automatic three-card menu, 667x375 containment and touch targets, actual kick/scoring, holder snap and pass release, manual holder movement, successful/failed fake scoring, frozen clock, standard offensive two-point selection, and existing defense/kickoff/return flows.
- Browser screenshots reviewed at small landscape size.

The browser tests inject scenario setup only into the local test server; that setup is not shipped. Production smoke loads deployed bytes using a Node fetch relay because this environment's Chromium cannot directly reach the public origin.
