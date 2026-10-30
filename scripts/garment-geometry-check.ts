import assert from 'node:assert/strict';
import * as T from 'three';
import {clipGarment,trouserGeometry,topGeometry} from '../combine/garment-geometry.js';
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,1,0,0,0,2,0],3));g.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,0,0,0,1,0,0,0,0,1,0,0],4));g.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,1,0,0,0,.5,.5,0,0],4));
const clipped=clipGarment(g,[p=>1-p.y]);assert(clipped.attributes.position.count>3);let onHem=0;
for(let i=0;i<clipped.attributes.position.count;i++){const y=clipped.attributes.position.getY(i);assert(y<=1);if(y===1)onHem++;}assert(onHem>=2);
for(const geometry of [clipped,trouserGeometry(),topGeometry()])for(let i=0;i<geometry.attributes.position.count;i++){let sum=0;for(let k=0;k<4;k++)sum+=geometry.attributes.skinWeight.getComponent(i,k);assert(Math.abs(sum-1)<.0001);for(let k=0;k<3;k++)assert(Number.isFinite(geometry.attributes.position.getComponent(i,k)));}
console.log('PASS clean interpolated hems, finite trouser vertices, normalized rig weights including joint zero.');

const trousers=trouserGeometry().attributes.position;for(let i=0;i<trousers.count;i++)if(trousers.getY(i)>55.5)assert(Math.abs(trousers.getX(i))<10.1,'Waist must taper under the shirt, not continue the leg cylinders');
