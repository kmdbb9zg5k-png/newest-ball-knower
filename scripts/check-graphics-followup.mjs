import assert from 'node:assert/strict';
import {touchdownCameraFraming} from '../public/play-moment-3d/game.js';

// A foreground pursuer must not determine the celebration's visual focus.
for (const x of [-24, 0, 24]) {
  const scorer = {x, z:112, team:0};
  const defender = {x:x-1.8, z:114.4, team:1};
  const players = [scorer, defender];
  const snapshot = JSON.stringify(players);
  const shot = touchdownCameraFraming(scorer, players);
  const [dx,,dz] = shot.offset;
  const relative = [defender.x-shot.eye[0], defender.z-shot.eye[2]];
  const gap = Math.abs(relative[0]*dz-relative[1]*dx)/Math.hypot(dx,dz);
  assert.ok(gap>1.35,'Foreground defender obscures selected scoring shot');
  assert.equal(JSON.stringify(players), snapshot, 'Camera altered game state');
  assert.deepEqual(shot,touchdownCameraFraming(scorer,players));
}
console.log('Scoring shot: clear sightlines at both sidelines and midfield; deterministic; game state unchanged.');
