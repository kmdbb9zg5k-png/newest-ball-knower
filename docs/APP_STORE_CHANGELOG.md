# App Store Release-Prep Changelog

## iOS packaging
- Hardened Codemagic signed IPA workflow.
- Added deterministic 1.0.0 versioning and icon generation.
- Added camera/photo-library permission descriptions and native auth URL scheme.

## Native runtime
- Added production API routing for bundled iOS builds through CapacitorHttp.
- Added native OAuth/email callback handling for warm and cold app launches.

## App Review compliance
- Replaced email-only deletion request with real in-app account deletion.
- Added commissioner-safe transactional database cleanup.
- Added public Privacy, Support, and Terms URLs.
- Added privacy data map, metadata draft, review notes, screenshot plan, and device gate.

## Safety
- Kept automatic TestFlight/App Store submission disabled until real-device validation.
- Added release gates and PostgreSQL regression coverage.
