import assert from 'node:assert/strict';
import {touchdownCameraFraming,touchdownCameraTravel} from '../public/play-moment-3d/game.js';

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

// Switching from the chase view to a face-on score shot must not cross the body.
let eye=[.35,4.15,104.5],target=[0,.65,115.2];
const shot=touchdownCameraFraming({x:0,z:112,team:0});
for(let frame=0;frame<240;frame++){
 const next=touchdownCameraTravel(eye,target,shot.eye,shot.target,1/60);
 assert.ok(Math.hypot(next.eye[0],next.eye[2]-112)>=4.5);
 assert.ok(Math.hypot(...next.eye.map((v,i)=>v-eye[i]))<.4);
 const before=Math.atan2(eye[0],eye[2]-112),after=Math.atan2(next.eye[0],next.eye[2]-112);
 assert.ok(Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)))<=1/60+.00001,'Scoring camera turns faster than one radian per second');
 eye=next.eye;target=next.target;
}
assert.ok(Math.hypot(...eye.map((v,i)=>v-shot.eye[i]))<.01);
console.log('Scoring camera orbit stays outside the player with bounded travel.');
