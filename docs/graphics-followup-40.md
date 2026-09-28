# Five graphics fixes after PR #379

Addresses the owner's IMG_8948/8949/8950 review recorded on PR #379.

1. Increase torso, shoulder-pad and limb volume by position while retaining the approved Sentinel model, faces, maps and rig. Linemen remain broader than receivers; height is unchanged.
2. Lower engaged blocking hips, widen the planted base and add torso lean. Correct the reach-block style lookup and increase paired pad spacing slightly. Preserve assignments, hold times and ratings.
3. Use four spatial light-bank contributions with warm/cool weighting and reduced uniform ambient fill. Vary crowd width, seated height and subtle per-instance color without additional texture downloads or draw calls.
4. Choose a touchdown camera sightline that penalizes foreground players and prefers the scorer's front. Hold the selected camera offset through the celebration; never reposition players for a shot.
5. Replace stale down-and-distance with `TOUCHDOWN · +6 POINTS`, including the result dialog. Place messages below the enlarged score strip at 430px landscape height.

Validation: controller, camera/receiver marker and scoring-sightline tests; TypeScript and Vite build; GitHub WebGL graphics workflow comparing PR #379, GPU surface grounding, contact/catch/scoring frames, 20 mobile formation cases and missing-art fallback. Actual outcomes are recorded in the PR; configured checks are not claimed as passed until complete.

Limits: no new authored crowd assets or contact-physics system. Physical iPhone performance must still be checked on device. The standard Chromium download failed; a packaged Chromium runtime enabled local visual checks as well as GitHub Actions. The older GPU fixture had a stale 2 MB instance-buffer cap: measured PR #379 and this pass both use 2,889,600 bytes, so the gate now forbids growth above that measured baseline. Fantasy features and career saves are outside this change.
