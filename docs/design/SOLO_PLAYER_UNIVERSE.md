# Solo Player Universe: reference-fidelity program

Status: development draft, not release approved. Do not merge or describe every Solo screen as complete on the strength of a generated concept image or passing unit tests.

## Approved target and scope

Elijah approved the realistic Blake Hartwell player-profile concept in the September 12, 2026 conversation and requested the same visual standard throughout Cap Challenge, Solo Fantasy Draft, Franchise Command, My Player, Agent Mode and Owner Office. The target is a cohesive fictional football universe, not isolated photo decorations on the old UI.

Preserve all existing saves, drafts, roster rules, progression, contracts, trades, staff economics, simulation, authentication, cloud security and iOS release configuration. Real-fantasy portraits and data remain separate.

## Initial implementation

The new shared presentation modules define stable ID-based appearance settings, small reusable portraits, on-demand full-body 2D compositing, all existing fictional team palettes, home/away/alternate kits, a shared player profile with actual attributes, supplied season game logs and development, and an appearance editor with save failure and unsaved-change handling. Missing statistics remain unavailable, not fabricated zeroes.

The type-aware integration script connects Player-typed names in existing Solo components. Existing selection actions remain intact and gain separate profile buttons rather than nested buttons. It registers current Cap and Franchise season records, replaces the Cap portrait fallback and the staff/creator placeholder faces, and scopes the new presentation to SoloMode. It must be applied and the resulting source must be inspected, type-checked and exercised in the actual application.

## Artwork is a prototype, not finished production art

The initial atlas contains NINE source face presets cropped from generated concept artwork. It is not a delivered 32-face production library. The full-body prototype uses one source body with three width treatments; these are not three independently authored anatomical models. No real athlete photograph or user profile photo is included in this art pack.

Before fidelity approval, expand and clean the high-resolution fictional art library, improve face-to-neck joins and body proportions, verify every uniform number and color, and remove any incidental manufacturer/league-like markings. The generated overview concept is not a screenshot of a functioning build.

## Open release gates

- Actual mobile screenshot comparison against the approved player profile, plus explicit review of all six mode flows and their interior screens.
- Complete the My Player body-creator integration while preserving custom selfies, saved renders, body sliders and view controls. The initial pass updates preset portraits, not the full existing creator renderer.
- Prove one identity is maintained across My Player creation, its roster, upgrades, editor and subsequent seasons. Expand links for historical summaries that lack stable Player IDs without matching people by name alone.
- Approve a sufficiently varied, clean production art library. Nine low-resolution prototype faces are not the final visual-fidelity target.
- Test old saves, newly generated rookies, trades, retirement, renamed players, jersey zero, missing art, cache loss, interrupted loads, blocked storage and failed saves.
- Exercise every new control, screen-reader names, focus, keyboard navigation, safe areas, fixed navigation and scroll restoration.
- Run all existing release regressions, production build and bundle budget, plus isolated Chromium and WebKit browser tests. Record exact outcomes; do not infer a pass from a workflow being queued.
- Measure cold and warm asset transfer, memory and repeated profile opening on a physical iPhone. Browser emulation is not physical-device verification.

## Data and operating-cost constraints

The runtime does not request AI-generated art, stream video, start a 3D engine or render continuously. The avatar atlas is shared. The full-body compositor is imported when needed. Persist compact appearance choices, not raster images, in a separate local-storage namespace. Existing career keys are untouched. Appearance overrides in this initial implementation are device-local, not cloud synchronized.

Enforce an 80 KB cap for the initial three-file prototype art pack and a separate measured budget for the final art library. Keep versioned immutable asset paths. Any future external generation service, remote storage or pricing change needs its own explicit design and authorization; none is introduced here.
