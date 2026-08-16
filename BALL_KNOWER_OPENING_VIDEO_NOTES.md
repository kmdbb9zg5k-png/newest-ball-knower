# Opening Video Fix
- Bundled the user-provided MP4 directly in `public/assets/ball-knower-opening.mp4`.
- Replaced the generated canvas intro with the real uploaded video.
- Intro autoplays when the app opens and closes automatically when the video ends.
- Added mute/unmute, replay, and skip controls.
- Added browser-autoplay fallback: if sound autoplay is blocked, the video retries muted and can be unmuted by the user.
- No external URL is required, so the video ships inside the deployed app.
