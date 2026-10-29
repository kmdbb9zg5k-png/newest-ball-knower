import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
const hairline=p=>3.7+4.15*smooth(-2,5.8,p.z)+.35*smooth(2.8,4.5,Math.abs(p.x));

// Each style has its own silhouette. All roots are projected onto the actual
// head, and longer hair bends down outside the skull instead of growing spikes.
export function buildAthleteHair({style,triangles,add,material,surfaceGeometry,seed=1}){
  if(style==='bald')return;
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const parts=[];
  const tube=(points,radius,segments=24,sides=6)=>parts.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),segments,radius,sides,false));
  const project=(x,z)=>{
    const ray=new T.Ray(new T.Vector3(x,25,z),new T.Vector3(0,-1,0));let top=null;
    for(const tri of triangles){const hit=ray.intersectTriangle(tri[0].p,tri[1].p,tri[2].p,false,new T.Vector3());if(hit&&hit.y>hairline(hit)&&(!top||hit.y>top.y))top=hit;}
    return top;
  };
  const fade=style==='high fade'?8.1:style==='low fade'?5.0:null;
  const curls=/curl|afro/.test(style),hanging=/braids|locs|twists/.test(style);
  const capField=p=>p.y-(fade===null?hairline(p):Math.max(hairline(p),fade));
  if(!hanging&&style!=='cornrows'){
    let capMaterial=material;
    if(style==='shaved'){
      capMaterial=material.clone();capMaterial.transparent=true;capMaterial.opacity=.28;capMaterial.depthWrite=false;
    }
    add(surfaceGeometry(triangles,capField,p=>{
      const top=smooth(7.8,10.5,p.y);
      if(style==='shaved')return .018;
      if(style==='waves')return .07+.085*Math.pow(.5+.5*Math.cos(Math.hypot(p.x,p.z+1)*9),4);
      if(style==='crew cut')return .06+top*.60;
      if(style==='textured crop')return .12+top*(.85+.22*Math.sin(p.x*3+p.z*2));
      if(curls)return .10+top*(style==='short curls'?.32:.65);
      return .04+smooth(fade,10.2,p.y)*.38;
    }),'Scalp '+style,capMaterial);
  }
  if(style==='waves'){
    // Concentric ridges remain readable at phone size without a helmet silhouette.
    for(let ring=1;ring<=14;ring++){
      const r=ring*.43,points=[];
      for(let i=0;i<=100;i++){const angle=i/100*Math.PI*2,p=project(Math.sin(angle)*r,Math.cos(angle)*r-1);if(p)points.push(p.add(new T.Vector3(0,.12,0)));else if(points.length>1){tube(points.splice(0),.035,36,4);}}
      if(points.length>1)tube(points,.035,36,4);
    }
  }
  if(style==='cornrows'){
    for(let x=-3.6;x<=3.61;x+=.9){const points=[];
      for(let i=0;i<=50;i++){const p=project(x,5.8-i/50*10.7);if(p)points.push(p.add(new T.Vector3(0,.15,0)));}
      if(points.length<2)continue;
      const end=points.at(-1);points.push(new T.Vector3(end.x,end.y-1.4,end.z-.35));
      weave(points,.18,3,16);
    }
  }
  function weave(points,radius,strands,turns){
    const curve=new T.CatmullRomCurve3(points),frames=curve.computeFrenetFrames(64,false);
    for(let strand=0;strand<strands;strand++){
      const woven=[];for(let i=0;i<=64;i++){const phase=i/64*Math.PI*2*turns+strand*Math.PI*2/strands;woven.push(curve.getPoint(i/64).addScaledVector(frames.normals[i],Math.cos(phase)*radius*.50).addScaledVector(frames.binormals[i],Math.sin(phase)*radius*.50));}
      tube(woven,radius*(strands===3?.56:.66),64,5);
    }
  }
  if(hanging){
    const braid=style==='braids',twist=style.includes('twists');
    const long=braid||style==='medium locs'||style==='long twists';
    const spacing=braid?1.28:twist?1.05:1.12;
    for(let z=-4.6;z<=5.0;z+=spacing)for(let x=-3.9;x<=3.91;x+=spacing){
      const root=project(x+(random()-.5)*.16,z+(random()-.5)*.16);if(!root)continue;
      // Front roots sweep towards the temples; back roots fall behind the neck.
      const side=Math.sign(root.x)||1,back=root.z<.5;
      const outward=back?new T.Vector3(root.x*.10,0,-1):new T.Vector3(side,0,-.25);
      outward.normalize();
      const length=long?8.0+random()*2:style==='short locs'?3.0+random()*1.4:1.6+random()*.9;
      const bend=root.clone().addScaledVector(outward,long?2.1:1.0).add(new T.Vector3(0,.65,0));
      const end=root.clone().addScaledVector(outward,long?2.6:1.5);end.y=Math.max(-3.0,root.y-length);
      if(long){if(back)end.z=Math.min(-5.1,end.z);else end.x=side*Math.max(5.0,Math.abs(end.x));}
      const mid=bend.clone().lerp(end,.55);mid.addScaledVector(outward,.35);
      const points=[root.clone().add(new T.Vector3(0,.10,0)),bend,mid,end];
      if(braid||twist)weave(points,braid?.23:.18,braid?3:2,long?13:7);
      else{
        // Rounded, irregular cylinders, with gravity-curved ends rather than cones.
        tube(points,.22+random()*.065,28,7);
        const tip=new T.SphereGeometry(.23,7,5);tip.translate(end.x,end.y,end.z);parts.push(tip);
      }
    }
  }
  if(curls||style==='textured crop'){
    const count=curls?1000:240,geometry=new T.IcosahedronGeometry(1,1),dummy=new T.Object3D();
    geometry.setAttribute('bkCoverage',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(1),1));
    const mesh=new T.InstancedMesh(geometry,material,count);
    const candidates=triangles.filter(tri=>tri.every(v=>v.p.y>hairline(v.p)+.15));
    if(candidates.length){for(let i=0;i<count;i++){
      const tri=candidates[Math.floor(random()*candidates.length)];let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}
      const p=tri[0].p.clone().multiplyScalar(1-u-v).addScaledVector(tri[1].p,u).addScaledVector(tri[2].p,v),n=tri[0].n.clone().add(tri[1].n).add(tri[2].n).normalize();
      const top=smooth(hairline(p),11,p.y),radius=style==='short curls'?.18+top*.18:style==='textured crop'?.14+top*.16:.22+top*.33;
      const lift=style==='tapered afro'?top*2.0:style==='medium curls'?top*1.0:top*.4;
      dummy.position.copy(p).addScaledVector(n,radius*.5+lift);dummy.rotation.set(random()*3,random()*3,random()*3);dummy.scale.set(radius,radius*.8,radius);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }mesh.name='Hair curls '+style;mesh.castShadow=true;add(mesh,null);}
    else geometry.dispose();
  }
  if(parts.length){const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());add(geometry,'Styled strands '+style);}
}
