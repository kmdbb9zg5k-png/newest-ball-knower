import assert from 'node:assert/strict';
import {newRouteCamera,stepRouteCamera} from '../combine/route-camera.js';
const route={points:[[0,0],[0,26]]},anchor=newRouteCamera(route,true),s={phase:'running',x:0,z:0};
for(const x of [-1,1,0,2,-2,0]){s.x=x;stepRouteCamera(anchor,s,.1);assert.deepEqual(anchor,{x:0,z:0},'Small joystick movement must not drag the camera');}
for(const phase of ['running','flight','settle']){s.phase=phase;s.x=0;s.z=0;stepRouteCamera(anchor,s,.1);assert.deepEqual(anchor,{x:0,z:0},'Throw/catch must not reframe the camera');}
s.phase='running';let previous=0;
for(let i=0;i<300;i++){s.x+=4.8/60;s.z+=4.8/60;stepRouteCamera(anchor,s,1/60);assert(anchor.x>=previous);assert(anchor.x-previous<.081);previous=anchor.x;assert(Math.abs(s.x-anchor.x)<3.3);assert(Math.abs(s.z-anchor.z)<4.6);}
assert(anchor.x>10);console.log('PASS stable camera within dead zone, no throw/catch panning and smooth position-only follow outside it');
