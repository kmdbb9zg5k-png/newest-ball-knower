# 3D practice — phone screenshot camera/target pass

Scope: continue draft PR #301 from ec0b380. Preview only; no production merge.

## Evidence and goal

The owner supplied three landscape iPhone screenshots: pre-snap, passing and
catch-and-run. They confirm the preview renders on that phone, not hardware
performance or full-game correctness. The field/bowl occupies much of the view,
while the player models are small and the 44px receiver circles overlap players.

Before editing, checked current PR/head, AGENTS.md, review comments, Vercel preview
and successful night workflow 34951418502. Downloaded artifact 10389507014 and
inspected the real pre-snap render and both upright OWN THE MOMENT sign views.
The stadium report records the expected one extra draw batch/texture and no errors.

## Changes

- Center the pre-snap/passing pocket and use a closer, lower baseline camera.
  Preserve the receiver-fit guard and existing long-flight presentation.
- Bring the ball-carrier camera closer after possession, retaining contact hold.
- Receiver labels are visibly 28px, with the existing 44px transparent hit area.
  Position them above helmet projections, keep clustered hit areas separated,
  and use non-interactive tethers to preserve receiver association when displaced.
- Preserve X/Y/Z and accessible names, existing target IDs, open-state colors,
  throw handlers, manual/assisted running and camera-relative juke controls.
- Give Pause/portrait return links 44px minimum touch size (review follow-up).

Only game.js and the isolated preview HTML change runtime. No player geometry,
material/shadow tiers, stadium, physics, routes, scoring, storage, account, fantasy,
backend, native release, dependencies or paid services change.

## Validation at initial push

Local PASS: exact baseline Git blob matches, JavaScript syntax, Python compilation,
80 actual-camera numeric samples across four sizes/all passing concepts, 2,000
clustered-marker cases, bounds/determinism and unchanged player coordinates.
These are numeric tests, not rendered or real-device results.

Local WebGL2 is unavailable in the installed browser; no environment policy was
changed. Extended the read-only, preview-only night workflow to run the actual
WebGL camera/marker/target-tap suite and upload before/after screenshots and a
measured report. Render/build results remain pending until recorded in the PR.
The before camera/HUD uses HEAD^ with the same current art/renderer.

Commands:

```
node scripts/check-play-moment-framing.mjs
python scripts/check-play-moment-framing.py --baseline-ref HEAD^ --output artifacts/framing
```

The browser suite checks 844x334, 932x430 and 1440x810, all 22 players, pre-snap
framing, non-overlapping target hit areas, badge/head separation, taps in transparent
hit padding, running, exit touch size, portrait layout, draw-call budget, WebGL
errors, and no external HTTP requests. Existing playable night and stadium suites
also run. Real iPhone/Safari FPS, thermals and hardware multitouch remain unverified.
