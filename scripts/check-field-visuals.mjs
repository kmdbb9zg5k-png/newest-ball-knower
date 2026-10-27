import assert from 'node:assert/strict';
import * as T from 'three';
import {playerPresence} from '../public/play-moment-3d/player-presence.js';
import {addFacilityPresentation} from '../combine/facility-presentation.js';
const zero={breath:0,scan:0,nod:0};
for(const phase of ['snap','run','pass','flight','contact'])assert.deepEqual(playerPresence({role:'QB'},phase,3),zero);
for(const player of [{fallen:true},{engaged:true},{vx:1},{vz:1}])assert.deepEqual(playerPresence(player,'pre',3),zero);
for(let t=0;t<40;t+=.17){const p=playerPresence({role:'QB',index:6},'pre',t);assert(Math.abs(p.breath)<=.012&&Math.abs(p.scan)<=.085&&Math.abs(p.nod)<=.009);}
for(const field of [false,true]){const s=new T.Scene(),result=addFacilityPresentation(s,field);assert.equal(s.children.length,2);assert.equal(result.drawCalls,2);assert(result.staticInstances<120);for(const mesh of s.children){assert(mesh.isInstancedMesh);assert.equal(mesh.castShadow,false);const matrix=new T.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));const p=new T.Vector3().setFromMatrixPosition(matrix);assert(p.z>60||p.y>10||Math.abs(p.x)> (field?24.5:3),'Scenery must stay outside playable lanes');}}}
console.log('PASS idle motion is bounded and inactive during play/contact; facility uses two bounded static batches outside playable lanes.');
