/** Numeric mesh/pose budgets only. Art quality is judged with actual WebGL images. */
import assert from 'node:assert/strict';
import{createTorsoGeometry,createLimbGeometry,createPlayerDetailGeometry}from'../public/play-moment-3d/geometry.js';
import{prepareJerseys,drawAthlete,advanceMotion}from'../public/play-moment-3d/athlete.js';
const meshes={torso:createTorsoGeometry(),limb:createLimbGeometry(),...createPlayerDetailGeometry()};
let triangles=0;
for(const[name,g]of Object.entries(meshes)){
 assert.ok(g.v.length%8===0&&g.v.length/8<65536,name);
 assert.ok(g.v.every(Number.isFinite)&&g.ix.every(i=>Number.isInteger(i)&&i>=0&&i<g.v.length/8),name);
 for(let i=0;i<g.v.length;i+=8)assert.ok(Math.abs(Math.hypot(...g.v.slice(i+3,i+6))-1)<1e-6,name);
 triangles+=g.ix.length/3;
}
assert.ok(triangles<=11000,`Unique mesh triangle budget ${triangles}`);
const oldDocument=globalThis.document;
try{
 globalThis.document={createElement(){return{width:0,height:0,getContext(){return new Proxy({}, {get(){return()=>{};}});}};}};
 const r={shapes:{},textures:new Map(),actorPass:false,uploads:0,submissions:0,keys:new Set(),texture(key){this.textures.set(key,true);this.uploads++;},
 add(shape,matrix,color,texture='',unlit=false,shine=0,material=0){
  assert.ok(matrix.length===16&&[...matrix,...color,shine,material].every(Number.isFinite),shape);
  this.keys.add([shape,texture,unlit,this.actorPass,material].join('|'));this.submissions++;
 }};
 const roles=['QB','RB','WR','TE','OL','DL','LB','DB'];
 const actors=roles.flatMap((role,index)=>[0,1].map(team=>({index:index*2+team,role,team,number:index+11,x:index,z:35,heading:0,hasBall:role==='QB'})));
 prepareJerseys(r,actors);const uploads=r.uploads,face=r.shapes.playerFace;
 prepareJerseys(r,actors);assert.equal(r.uploads,uploads);assert.equal(r.shapes.playerFace,face);
 let poseSamples=0;
 for(const p of actors)for(const action of['idle','pre','run','block','throw','catch']){
  delete p.motion;p.engaged=action==='block';p.catchT=action==='catch'?.3:0;p.throwT=action==='throw'?.1:0;
  const phase=action==='pre'?'pre':action==='throw'?'pass':'run';advanceMotion(p,0,phase);
  for(let i=0;i<20;i++){if(action==='run')p.z+=7.2/60;advanceMotion(p,1/60,phase);}
  const before=structuredClone(p);drawAthlete(r,p,0,phase);assert.deepEqual(p,before);assert.equal(r.actorPass,false);poseSamples++;
 }
 assert.equal(r.uploads,uploads,'Frame-time texture creation');
 assert.equal(r.shapes.playerFace,face,'Frame-time geometry replacement');
 assert.ok(!r.keys.has('undefined'), 'Missing geometry');
 console.log(JSON.stringify({status:'PASS',uniqueMeshTriangles:triangles,poseSamples,jerseyTextures:uploads,perFrameAllocations:'No geometry or texture creation',scope:'geometry/pose unit test, not art-quality certification'}));
}finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
