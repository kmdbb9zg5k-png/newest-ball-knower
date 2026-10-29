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
  const fade=style==='high fade'?8.1:style==='low fade'?5.0:style==='textured crop'?7.0:style==='crew cut'?6.0:null;
  const curls=/curl|afro/.test(style),hanging=/braids|locs|twists/.test(style);
  // Subdivide before displacement so short hair detail follows the skull instead
  // of merely moving the corners of the source model's large triangles.
  const midpoint=(a,b)=>({p:a.p.clone().lerp(b.p,.5),n:a.n.clone().lerp(b.n,.5).normalize()});
  let scalpTriangles=triangles.filter(tri=>tri.some(v=>v.p.y>hairline(v.p)-.5));
  for(let level=0;level<(style==='waves'?2:1);level++)scalpTriangles=scalpTriangles.flatMap(([a,b,c])=>{const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];});
  const capField=p=>(p.y-(fade===null?hairline(p):Math.max(hairline(p),fade)))/(fade===null?1:3);
  if(!hanging&&style!=='cornrows'){
    let capMaterial=material;
    if(fade!==null){
      capMaterial=material.clone();capMaterial.transparent=true;capMaterial.depthWrite=false;
      capMaterial.onBeforeCompile=shader=>{material.onBeforeCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= smoothstep(0.02, 0.95, bkHairCoverage);\n#include <alphatest_fragment>');};
      capMaterial.customProgramCacheKey=()=> 'athlete-scalp-fade-v1';
    }
    if(style==='shaved'){
      capMaterial=material.clone();capMaterial.transparent=true;capMaterial.opacity=.28;capMaterial.depthWrite=false;
    }
    if(style==='waves'){
      capMaterial=material.clone();capMaterial.roughness=.8;
      capMaterial.onBeforeCompile=shader=>{material.onBeforeCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`float ripple=.5+.5*cos(bkHairPosition.y*8.0+sin(atan(bkHairPosition.x,bkHairPosition.z)*3.0)*.6);diffuseColor.rgb*=mix(.55,1.35,pow(ripple,3.0));\n#include <alphatest_fragment>`);};
      capMaterial.customProgramCacheKey=()=> 'athlete-waves-v1';
    }
    const cap=surfaceGeometry(scalpTriangles,capField,p=>{
      const top=smooth(7.8,10.5,p.y);
      if(style==='shaved')return .018;
      if(style==='waves')return .045+.10*Math.pow(.5+.5*Math.cos(p.y*8+Math.sin(Math.atan2(p.x,p.z)*3)*.6),4);
      if(style==='crew cut')return .06+top*.60;
      if(style==='textured crop')return .06+top*.32;
      if(curls)return .10+top*(style==='short curls'?.32:.65);
      return .04+smooth(fade,10.2,p.y)*.38;
    });
    if(style==='waves')cap.computeVertexNormals();
    add(cap,'Scalp '+style,capMaterial);
  }
  if(hanging||style==='cornrows'){
    const spacing=style==='braids'?1.28:style.includes('twists')?1.05:1.12;
    const roots=material.clone();roots.transparent=true;roots.depthWrite=false;
    roots.onBeforeCompile=shader=>{material.onBeforeCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`
      vec2 part=abs(fract((bkHairPosition.xz+vec2(3.9,4.6))/${spacing.toFixed(2)})-.5)*${spacing.toFixed(2)};
      float separation=${style==='cornrows'?'abs(fract((bkHairPosition.x+3.6)/.9)-.5)*.9':'min(part.x,part.y)'};
      diffuseColor.a *= mix(1.0,smoothstep(.025,.075,separation),smoothstep(7.0,9.0,bkHairPosition.y))*smoothstep(0.02,.95,bkHairCoverage);
      #include <alphatest_fragment>`);};
    roots.customProgramCacheKey=()=> 'athlete-parted-roots-'+style;
    add(surfaceGeometry(scalpTriangles,p=>(p.y-hairline(p))/2,()=>.025),'Parted roots '+style,roots);
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
      if(long){
        end.y=-2.1-random()*.9;
        if(back){bend.z=Math.min(-5.7,bend.z);end.z=Math.min(-5.5,end.z);}
        else{bend.x=side*Math.max(5.2,Math.abs(bend.x));end.x=side*Math.max(5.0,Math.abs(end.x));}
      }
      const mid=bend.clone().lerp(end,.55);mid.addScaledVector(outward,.35);
      let points=[root.clone().add(new T.Vector3(0,.10,0)),bend,mid,end];
      if(long){
        // Drape along the skull before falling; a single raised control point
        // makes the roots arch up like handles and leaves a gap above the scalp.
        points=[];
        for(let step=0;step<=12;step++){
          const t=step/12,p=project(T.MathUtils.lerp(root.x,bend.x,t),T.MathUtils.lerp(root.z,bend.z,t));
          if(p)points.push(p.add(new T.Vector3(0,.22,0)));
        }
        const last=points.at(-1)||root;
        if(back)end.x+=(random()-.5)*.6;else end.z+=(random()-.5)*.6;
        const shoulder=end.clone();shoulder.y=last.y-.8;
        points.push(shoulder,end.clone().lerp(shoulder,.25),end);
      }
      if(braid||twist)weave(points,braid?.23:.18,braid?3:2,long?13:7);
      else{
        // Rounded, irregular cylinders, with gravity-curved ends rather than cones.
        tube(points,.22+random()*.065,28,7);
        const tip=new T.SphereGeometry(.23,7,5);tip.translate(end.x,end.y,end.z);parts.push(tip);
      }
    }
  }
  if(curls||style==='textured crop'){
    const count=curls?1000:1100,geometry=curls?new T.SphereGeometry(1,8,6):new T.IcosahedronGeometry(1,0),dummy=new T.Object3D();
    geometry.setAttribute('bkCoverage',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(1),1));
    const mesh=new T.InstancedMesh(geometry,material,count);
    const candidates=scalpTriangles.filter(tri=>tri.every(v=>v.p.y>Math.max(hairline(v.p)+.15,style==='textured crop'?8.0:-100)));
    if(candidates.length){for(let i=0;i<count;i++){
      const tri=candidates[Math.floor(random()*candidates.length)];let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}
      const p=tri[0].p.clone().multiplyScalar(1-u-v).addScaledVector(tri[1].p,u).addScaledVector(tri[2].p,v),n=tri[0].n.clone().add(tri[1].n).add(tri[2].n).normalize();
      const top=smooth(hairline(p),11,p.y),radius=style==='short curls'?.18+top*.18:style==='textured crop'?.14+top*.16:.22+top*.33;
      const lift=style==='tapered afro'?top*2.0:style==='medium curls'?top*1.0:top*.4;
      dummy.position.copy(p).addScaledVector(n,radius*.5+lift);dummy.rotation.set(random()*.4,random()*.6,random()*.4);dummy.scale.set(radius,radius*.8,radius);if(style==='textured crop'){dummy.scale.set(.10,.16,.42+random()*.18);dummy.position.z+=.20;}dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }mesh.name='Hair curls '+style;mesh.castShadow=true;add(mesh,null);}
    else geometry.dispose();
  }
  if(parts.length){const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());add(geometry,'Styled strands '+style);}
}
