/** Executes the actual camera/marker functions with numeric projections.
 * No renderer mocks are counted as rendered or device tests; see the .py suite.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/play-moment-3d/game.js',import.meta.url),'utf8');
function between(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing function boundary ${a}`);return source.slice(i,j);}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const helpers=between('export function layoutReceiverMarkers','const RUNS=');
const layout=Function('clamp',helpers.replace('export ','')+';return layoutReceiverMarkers;')(clamp);
const cameraSource=between(' function camera(dt)',' function scene(dt');
const specs=Function('return '+between(' const specs=',';\n const receiverIndices=').split('const specs=')[1])();
const routes=Function(between('const PASSES=','export function start()')+';return {PASSES,travel};')();
const norm=v=>{const l=Math.hypot(...v)||1;return v.map(n=>n/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function fixture(phase,actors,width,height,carrier=actors[5]){
 const r={width,height,camera(eye,target){this.eye=[...eye];this.target=[...target];},project(p){
  const z=norm(this.eye.map((v,i)=>v-this.target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);
  const v=p.map((n,i)=>n-this.eye[i]),depth=-dot(z,v),f=1/Math.tan(25*Math.PI/180);
  return{x:(dot(x,v)*f/(width/height)/depth*.5+.5)*width,y:(.5-dot(y,v)*f/depth*.5)*height,visible:depth>0};
 }};
 const before=JSON.stringify(actors);
 Function('r','phase','actors','carrier','clamp',`let camEye=[0,0,0],camTarget=[0,0,0];const snapZ=95,receiverIndices=[7,8,9],flight=null;${cameraSource};camera(1);`)(r,phase,actors,carrier,clamp);
 assert.equal(JSON.stringify(actors),before,'Camera changed player state');return r;
}
let samples=0;
const reports=[];
for(const[width,height]of[[667,290],[844,334],[932,430],[1440,810]]){
 const actors=specs.map(([role,x,z],index)=>({role,x,z:95+z,team:index>=11?1:0}));
 const r=fixture('pre',actors,width,height);
 for(const p of actors.filter(p=>!p.team)){
  const h=r.project([p.x,2.1,p.z]),f=r.project([p.x,0,p.z]);
  assert.ok(h.visible&&h.x>24&&h.x<width-24&&h.y>65&&f.y<height-85,JSON.stringify({width,height,role:p.role,h,f}));
 }
 const qb=actors[5],qbPixels=r.project([qb.x,0,qb.z]).y-r.project([qb.x,2.1,qb.z]).y;
 assert.ok(qbPixels/height>.09,'Pocket is too distant');
 for(const pass of routes.PASSES)for(const seconds of[0,.5,1.3,2.5,4.5]){
  const a=structuredClone(actors);[7,8,9].forEach((idx,i)=>{const d=routes.travel(pass.routes[i],seconds*(6.3+i*.2));a[idx].x=clamp(a[idx].x+d[0],-26.3,26.3);a[idx].z+=d[1];});a[5].z-=Math.min(seconds*.4,1.2);
  const cam=fixture('pass',a,width,height);
  const points=[7,8,9].map(id=>({id,...cam.project([a[id].x,2.1,a[id].z])}));
  const m=layout(points,width,height);assert.equal(m.length,3);assert.ok(m.every(p=>p.visible));
  for(const p of m)assert.ok(p.x>=28&&p.x<=width-28&&p.y>=96&&p.y<=height-30);
  for(let i=0;i<3;i++)for(let j=0;j<i;j++)assert.ok(Math.abs(m[i].x-m[j].x)>=48||Math.abs(m[i].y-m[j].y)>=48,JSON.stringify(m));
  assert.ok(cam.project([a[5].x,0,a[5].z]).y<height-10,'QB below viewport');samples++;
 }
 const run=fixture('run',actors,width,height,actors[6]),rb=actors[6];
 assert.ok(run.project([rb.x,0,rb.z]).y<height-90,'Runner under controls');
 reports.push({viewport:[width,height],qbPixels:+qbPixels.toFixed(2)});
}
let seed=723;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let n=0;n<2000;n++){
 const width=667,height=290,edge=n%2?width-15:15;
 const points=Array.from({length:3},(_,id)=>({id,x:n%3?edge:rand()*width,y:n%5?140:rand()*height,visible:true}));
 const before=JSON.stringify(points),out=layout(points,width,height,{left:65,right:width-38,top:92});
 assert.equal(JSON.stringify(points),before);
 assert.deepEqual(out,layout(points,width,height,{left:65,right:width-38,top:92}));
 for(const p of out)assert.ok(p.x>=65&&p.x<=width-38&&p.y>=92&&p.y<=height-30);
 for(let i=0;i<3;i++)for(let j=0;j<i;j++)assert.ok(Math.abs(out[i].x-out[j].x)>=48||Math.abs(out[i].y-out[j].y)>=48,'Clustered hit areas overlap');
}
assert.equal(layout([{x:NaN,y:0,visible:true}],667,290)[0].visible,false);
console.log(JSON.stringify({status:'PASS',cameraSamples:samples,clusteredMarkerSamples:2000,reports},null,2));
