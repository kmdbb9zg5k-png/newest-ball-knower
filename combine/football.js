import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Keep the existing grip-space dimensions so passes and handoffs stay aligned.
export function createDrillFootball(name) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#808080';ctx.fillRect(0,0,128,128);
  let seed=91;
  for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const shade=140+seed%65;ctx.fillStyle=`rgb(${shade},${shade},${shade})`;
    ctx.beginPath();ctx.arc(x+(y%8?2:0),y,1.35,0,Math.PI*2);ctx.fill();
  }
  const grain=new T.CanvasTexture(canvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3,2);
  const leather=new T.MeshStandardMaterial({color:'#804320',roughness:.86,bumpMap:grain,bumpScale:.0007});
  const ball=new T.Mesh(new T.SphereGeometry(.115,32,20),leather);
  ball.name=name;ball.scale.set(.72,.72,1.65);ball.castShadow=true;
  const pieces=[];
  const tube=(points,radius)=>new T.TubeGeometry(new T.CatmullRomCurve3(points),16,radius,5,false);
  // Raised cross stitches follow the curved leather instead of floating above it.
  for(let i=0;i<8;i++){
    const z=(i-3.5)*.013;
    pieces.push(tube([-.023,-.012,0,.012,.023].map(x=>new T.Vector3(x,Math.sqrt(.115**2-z*z-x*x)+.002,z)),.0028));
  }
  for(const x of [-.009,.009])pieces.push(tube(Array.from({length:9},(_,i)=>{const z=(i-4)*.014;return new T.Vector3(x,Math.sqrt(.115**2-z*z-x*x)+.001,z);}),.002));
  const laces=new T.Mesh(mergeGeometries(pieces),new T.MeshStandardMaterial({color:'#e8dfc8',roughness:.9}));
  pieces.forEach(g=>g.dispose());laces.name='football-stitches';ball.add(laces);
  const seams=[];
  for(let n=0;n<4;n++){
    const angle=Math.PI/4+n*Math.PI/2;
    seams.push(tube(Array.from({length:25},(_,i)=>{const t=.05+(Math.PI-.1)*i/24;return new T.Vector3(Math.sin(t)*Math.cos(angle)*.1153,Math.sin(t)*Math.sin(angle)*.1153,Math.cos(t)*.1153);}),.0008));
  }
  ball.add(new T.Mesh(mergeGeometries(seams),new T.MeshStandardMaterial({color:'#492919',roughness:1})));
  seams.forEach(g=>g.dispose());
  return ball;
}
