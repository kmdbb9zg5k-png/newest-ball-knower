# Existing photo registry: source metadata verification

Checked 2026-09-07 02:23:07 UTC using the Wikimedia Commons imageinfo API. All 21 exact file pages resolved with image URLs, creator fields, SHA-1 identities and reuse-license metadata. This verifies the pages' declared metadata, not a guarantee of uploader ownership, athlete publicity rights, trademark clearance or App Review approval.

The original response and source/output evidence are in Actions run 34076025079, artifact `independent-source-verification` (artifact ID 10002086443, archive SHA-256 `856c3d13d833c252728ce8300259017f309a6640699c65b869406ec299643a3c`). The collection script is `scripts/collect-photo-evidence.py`; pass an output directory. Archive the downloaded response with the release records before the Actions artifact expires.

| Exact Commons file | Creator reported by Commons | Declared license |
| --- | --- | --- |
| Jalen Hurts.png | Don't Tell | CC BY 3.0 |
| Josh Allen.jpg | Erik Drost | CC BY 2.0 |
| Patrick Mahomes TTU.JPG | Wordbuilder | CC BY 3.0 |
| Joe Burrow Bengals.jpg | AlexanderJonesi | CC BY-SA 2.0 |
| Lamar Jackson 2021.jpg | All-Pro Reels from District of Columbia, USA | CC BY-SA 2.0 |
| Saquon Barkley.jpg | Chris Spon | CC BY-SA 4.0 |
| Derrick Henry.jpg | Tennessee Titans | CC BY 3.0 |
| Christian McCaffrey.jpg | All-Pro Reels | CC BY-SA 2.0 |
| BreeceHall2019.jpg | Daniel Hartwig | CC BY 2.0 |
| Jonathan Taylor.jpg | Brady Klain | CC BY-SA 2.0 |
| JahmyrGibbs.jpg | Ck18102006 | CC0 |
| Ja'Marr Chase.jpg | All-Pro Reels | CC BY-SA 2.0 |
| Justin Jefferson Commanders vs Vikings NOV2022.jpg | All-Pro Reels | CC BY-SA 2.0 |
| Ceedee.jpg | Addadadsadsaf123 | CC0 |
| AJ Brown.jpg | Tennessee Titans | CC BY 3.0 |
| Amon-Ra St. Brown.jpg | Steve Cheng, Bruin Report | CC BY-SA 2.0 |
| Drake London.jpg | Atlanta Falcons | CC BY 3.0 |
| Malik Nabers Giants week 1 2025.jpg | All-Pro Reels | CC BY-SA 4.0 |
| Brock Bowers.jpg | BullDawg2021 | CC BY-SA 4.0 |
| 2024 FanDuel Interview Trey McBride (cropped).png | FanDuel | CC BY 3.0 |
| George Kittle (cropped).jpg | AlexanderJonesi | CC BY-SA 2.0 |

File source links and license links remain in `licensedPlayerPortraits.ts` and the in-app/public credits. Verify pseudonym/real-name attribution equivalence and any creator-specific requests before final clearance. Retain modification and applicable ShareAlike notices for adapted images.

The Drake London page explicitly reports a `personality` restriction. Absence of that warning on another page does not waive personality rights. Several files are self-published uploads rather than independently reviewed licenses. Some are game-action photographs containing multiple people, not studio headshots; framing and actual identity should be checked visually. No claim that all 21 photographs are identical to the earlier generated UI mockup is warranted.

Nothing in this check grants NFL/team artwork rights or settles the separate real-athlete simulation-use question.
