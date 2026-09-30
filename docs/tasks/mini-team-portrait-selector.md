# Mini Games portrait team picker

The approved black-and-gold team-selection concept is an interactive carousel in the existing Mini Games dialog. Difficulty stays first. Confirming a home team opens the opponent carousel; it excludes the home team. The setup remembers confirmed teams, while arrow/search/swipe browsing only previews a team. Fresh setup remains team 16 (Oklahoma City Bison).

Every team displays three photographic fictional-player portraits, real roster names/positions/OVR, team OVR/OFF/DEF, and an original gold mascot mark behind the heading. Each portrait has a fixed player-ID filename. Jersey City uses the approved preview portraits. Where a selected player already had approved local Solo artwork, that existing face is retained. Newly illustrated faces are scoped to this selector; the shared Solo artwork API and 3D models are unchanged.

The top three come from the full 53-player base Solo roster, including special teams, rather than merely the 22-player gameplay lineup. Tied ratings prefer the existing gameplay lineup order. These are base-roster ratings, not a user's franchise upgrades or trades.

Assets: `public/mini-team-selection/`, 96 portraits and 32 mascot marks, WebP (about 2.2 MB total). The selector bundles Barlow Condensed ExtraBold as a local WOFF with its OFL license, so names fit even when Google Fonts is unavailable. Source: https://github.com/google/fonts/tree/main/ofl/barlowcondensed. They are static app assets; browsing never generates art or calls a paid service. Hidden dialogs do not mount the carousel; only neighboring portraits preload during browsing. Existing Mini Games artwork, playable drill, coming-soon modes, level persistence, and launch parameters are retained.

Art was generated with the built-in image tool as eight 3-column by 4-row fictional football portrait atlases, cinematic studio/stadium lighting, team-color jerseys, visible faces, plus a 4-column by 8-row gold mascot atlas. The three Knights portraits were extracted from the user-approved team-selector concept. Atlas cells were cropped and optimized for the phone layout. Names and ratings are accessible live UI text rather than baked into images.

After base roster updates, run `node --import tsx scripts/build-mini-selector.ts`. It refuses to assign an existing face to a new player: a newly promoted top-three player requires a new keyed portrait first. Run `node --import tsx scripts/check-mini-selector.ts` and the menu/carousel browser checks. Preserve fixed portrait IDs and don't regenerate established faces merely to change uniforms.

Verification covers 320, 390, and 1280 pixel widths, all 32 team images/logos, matching full-roster top-three ratings, arrow/keyboard wrapping, the 31-team opponent exclusion, confirmation, persistence, launch URLs, and existing Solo navigation. Physical iPhone hardware is not available in this environment.
