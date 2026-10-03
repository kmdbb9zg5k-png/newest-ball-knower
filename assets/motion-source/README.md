# Combine captured-motion evaluation (not production-ready)

Source: Carnegie Mellon Graphics Lab trial 09_01, converted to BVH by Bruce Hahne (2010). Downloaded from https://github.com/una-dinosauria/cmu-mocap/tree/master/data/009 . Source usage terms are preserved in CMU-READMEFIRST.txt.

The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

Run `node scripts/bake-combine-capture.mjs` from the repository root to regenerate the target-rig pose experiment. This output is deliberately not imported by the game.

Visual evaluation rejected this candidate for the full-speed Combine sprint: it reads as a jog, the initial rotation-only transfer twisted the shoulders, and corrected segment directions still leave posture/wrist work. The 0.23–0.93 second segment is exploratory and has not been made into a verified seamless loop. No animation-quality or contact pass is claimed.

Other inspected CMU trials: 09_02, 09_03, 09_10, 09_11, 16_55, 127_03, 127_06, 102_05 and 78_05. Root-motion speed checks indicate ordinary running rather than a maximal sprint. A suitable sprint FBX/BVH with a reference pose is needed before replacing production. A captured start/run/stop set is preferable.

Pending: select true sprint source, map rig, fit contact/cadence, build start and stop transitions, side/rear motion review, game/browser regression and deployment. Finish-banner repositioning is also pending in that integration.
