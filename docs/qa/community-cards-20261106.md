# Community rankings and circle cards

Implements the owner's approved November 6 mockup on top of the live BK Arena redesign from PR #562. Starting `main` and production commit: `a3af28d103b47d99f455202827252facfe59a624`.

## Changes

- `CommunityHub.tsx`: cinematic trophy/helmet rankings card, existing service-backed leader name/rank/rating, full leaderboard action, sideline teammates card, friend discovery, working public-app invitation, and compact solo trivia tile.
- `communityArena.css`: responsive image treatments, typography, narrow-screen wrapping, readable score/name row, focus states and 46px friend/invitation buttons. Cards stack below 900px and sit side by side above it.
- Four `public/community/arena-{rankings,circle}[-mobile]-v1.webp` assets: original AI-generated, text-free artwork derived from the owner's approved mockup. No real player likeness, team logo or fake community user is embedded in the artwork. Live copy and scores remain React elements.
- `scripts/community-arena-browser.mjs`: extends the existing isolated real-app regression at 320/390/430/1280px with card destinations, actual response-backed leader data, empty rankings, long names, zero ratings, native share, share cancellation, clipboard and copyable-link fallback.

Sharing opens the platform's share UI when available. Otherwise it copies `https://ballknowerofficial.com/`; denied/unavailable clipboard access reveals a selectable read-only link. Share cancellation stays quiet. Guests can share the public app; friend requests and messaging retain account requirements.

## Validation

- TypeScript, production Vite build and root bundle budget passed locally. Entry: 251.29 kB raw / 79.03 kB gzip.
- Community arena/state and session-recovery checks passed.
- Cloud-browser visual review of the actual Community components with explicit local fixtures: 320px and 390px phone frames, plus 1354px desktop with two 504px columns. No horizontal overflow; leaderboard and friend-card destinations verified.
- Full-resolution WebPs total 150,840 bytes. Mobile variants total 65,418 bytes; all four files total 216,258 bytes. Both cards use responsive sources, lazy loading, intrinsic image dimensions and async decoding.
- Temporary fixture routes were removed before the production build; no test users or fixture data are included in the release.

GitHub browser checks and production verification are recorded on the pull request. Native iPhone share-sheet behavior still requires a physical-device check; automated browser tests stub the platform APIs and make no external transmissions.
