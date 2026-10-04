# Native Combine athlete

Source: the user's `gangster-male-character-rigged-animated-game-ready.zip`, supplied October 3, 2026. Outfit and source textures are preserved. This replaces the Combine runner only.

`combine-native-athlete-v1.glb` contains the supplied 50,000-triangle mesh, 52-bone rig and its own Fast Run, Walking and Breathing Idle clips. It uses a 2048px base color, 1024px roughness and 512px normal map. These are the source resolutions, not newly created high-resolution detail.

The export normalizes skin weights after the web loader's four-influence limit, indexes duplicate vertices, scales the athlete to 1.85 m, and removes linear horizontal clip translation. Original cycle travel distances are retained in asset metadata. Runtime samples run/walk by distance traveled, blends their phases through deceleration, and transitions to breathing idle. The existing three-point start is solved on the new skeleton and blended into its native running pose; the previous cross-rig launch retarget is not used.

Skin, fabric and rubber remain nonmetallic. The supplied roughness map controls highlights; normal strength is reduced to avoid harsh surface noise. No face, tattoos, clothing or shoes were regenerated.

To rebuild, extract the source ZIP and nested animation/texture ZIPs to a temporary directory, flatten the filenames, then run:

```
BROWSER_PATH=/path/to/chromium node scripts/build-combine-native-athlete.mjs /path/to/extracted/files
```

Check `node scripts/check-combine-native.mjs`, `node scripts/check-combine.mjs`, `npm run build`, and a complete mobile Combine attempt. The native check samples launch, a sustained run, deceleration, walk, idle and retry, checks loop seams and finite joint positions, and renders transition frames for visual review. Source texture resolution still limits facial closeups; distance matching is not a claim of perfect foot locking during every blend.
