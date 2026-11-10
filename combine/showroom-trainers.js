import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Cross-sections in the athlete's rest coordinates, from heel to toe.
// Each row describes depth, center, half-width, collar height and bottom.
const shoeProfile=[
  [-8,8.4,.12,2.7,1.35],[-7.4,8.55,1.85,5.8,.95],
  [-6.1,8.7,2.65,9.3,.65],[-4.2,8.8,2.85,9.8,.47],
  [-2.2,8.9,2.78,9.8,.3],[-.25,9.3,2.78,9.6,.19],
  [1.8,9.85,3.05,8.0,.15],[3.7,10.35,3.43,6.45,.15],
  [5.6,10.65,3.5,4.95,.22],[7.3,10.85,3.1,4.12,.39],
  [8.6,10.95,2.08,3.63,.72],[9.35,10.96,.12,2.35,1.27],
];

function profileAt(z){
  const next=shoeProfile.findIndex(row=>row[0]>=z);
  if(next<=0)return next===0?shoeProfile[0]:shoeProfile.at(-1);
  const a=shoeProfile[next-1],b=shoeProfile[next];
  const t=(z-a[0])/(b[0]-a[0]);
  const before=shoeProfile[Math.max(0,next-2)],after=shoeProfile[Math.min(shoeProfile.length-1,next+1)];
  const span=b[0]-a[0];
  return a.map((value,i)=>{
    if(i===0)return z;
    const start=(b[i]-before[i])*span/(b[0]-before[0]),end=(after[i]-value)*span/(after[0]-a[0]);
    const t2=t*t,t3=t2*t;
    return value*(2*t3-3*t2+1)+start*(t3-2*t2+t)+b[i]*(-2*t3+3*t2)+end*(t3-t2);
  });
}

function fromFaces(positions,indices){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

function trainerUpper(sign){
  const positions=[],indices=[],columns=33,rows=64;
  for(let row=0;row<=rows;row++){
    const z=T.MathUtils.lerp(-7.96,9.25,row/rows);
    const [,center,width,crown,bottom]=profileAt(z);
    for(let col=0;col<columns;col++){
      const angle=(col/(columns-1)-.5)*Math.PI;
      const x=center*sign+Math.sin(angle)*width*.94;
      const y=bottom+1.54+Math.pow(Math.cos(angle),.78)*Math.max(.07,crown-bottom-1.54);
      positions.push(x,y,z);
      if(row<rows&&col<columns-1){
        const a=row*columns+col;
        indices.push(a,a+columns,a+1,a+1,a+columns,a+columns+1);
      }
    }
  }
  return fromFaces(positions,indices);
}

// Extrude the perimeter through the rubber layers. A common profile at their
// seam keeps the toe wrap continuous and gives the heel a rounded bevel.
function trainerSole(sign,layers){
  const positions=[],indices=[],samples=48;
  const outline=[];
  for(const side of [-1,1])for(let i=0;i<=samples;i++){
    const t=side===-1?i/samples:1-i/samples;
    const z=T.MathUtils.lerp(-8,9.35,t);
    const [,center,width,,bottom]=profileAt(z);
    outline.push([center*sign,side*width,z,bottom]);
  }
  const count=outline.length;
  layers.forEach(([height,bevel],layer)=>{
    for(let i=0;i<count;i++){
      const [center,offset,z,bottom]=outline[i];
      positions.push(center+offset*bevel,bottom+height,(z-.675)*bevel+.675);
      if(layer===layers.length-1)continue;
      const a=layer*count+i,b=layer*count+(i+1)%count;
      indices.push(a,b,a+count,b,b+count,a+count);
    }
  });
  const last=(layers.length-1)*count;
  for(let i=1;i<count-1;i++)indices.push(0,i+1,i,last,last+i,last+i+1);
  return fromFaces(positions,indices);
}

function cord(points,radius){
  return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point))),12,radius,6,false);
}

function shoeParts(sign){
  const upper=trainerUpper(sign);
  const midsole=trainerSole(sign,[[.53,1],[.73,1.015],[1.42,1.004],[1.73,.95]]);
  const outsole=trainerSole(sign,[[.04,.95],[.18,1.012],[.41,1.013],[.53,1]]);
  const laces=[],eyelets=[],trim=[];
  const laceRows=[.38,1.5,2.63,3.78,4.9].map(z=>{
    const [,center,,crown]=profileAt(z);
    return {z,x:center*sign,y:crown-.12};
  });
  for(const row of laceRows){
    for(const side of [-1,1]){
      const eyelet=new T.TorusGeometry(.23,.055,6,12);
      eyelet.rotateX(-Math.PI/2);eyelet.translate(row.x+side*1.03,row.y,row.z);
      eyelets.push(eyelet);
    }
  }
  for(let i=1;i<laceRows.length;i++){
    const a=laceRows[i-1],b=laceRows[i];
    for(const side of [-1,1]){
      laces.push(cord([[a.x+side*1.03,a.y+.04,a.z],[(a.x+b.x)/2,(a.y+b.y)/2+.21,(a.z+b.z)/2],[b.x-side*1.03,b.y+.04,b.z]],.12));
    }
  }
  const top=laceRows[0];
  laces.push(cord([[top.x-.85,top.y+.16,top.z],[top.x-1.24,top.y+.25,top.z-.72],[top.x+.06,top.y+.24,top.z-.28],[top.x+1.23,top.y+.25,top.z-.73],[top.x+.83,top.y+.16,top.z]],.115));
  trim.push(cord([[8.55*sign,7.8,-7.15],[8.48*sign,9.55,-7],[8.55*sign,9.85,-6.48],[8.55*sign,8.95,-6.07]],.22));
  for(const side of [-1,1]){
    trim.push(cord([[-4.8,3.4],[-1.1,4.5],[1.5,3.62],[5.3,3.03]].map(([z,y])=>{
      const [,center,width]=profileAt(z);return [center*sign+side*width*.96,y,z];
    }),.125));
  }
  return [[upper],[midsole],[outsole],laces,eyelets,trim];
}

export function createShowroomTrainer(source,side,color){
  const sign=side==='Left'?1:-1;
  const joint=source.skeleton.bones.findIndex(bone=>bone.name.endsWith(side+'Foot'));
  if(joint<0)return null;
  const parts=shoeParts(sign);
  const panels=parts.map((geometries,index)=>{
    // Keep the same indexed representation before batching every material.
    const normalized=geometries.map(geometry=>geometry.index?geometry.toNonIndexed():geometry);
    const merged=mergeGeometries(normalized.map(geometry=>{geometry.deleteAttribute('uv');return geometry;}));
    for(const geometry of new Set([...geometries,...normalized]))geometry.dispose();
    const count=merged.attributes.position.count;
    const joints=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){joints[i*4]=joint;weights[i*4]=1;}
    merged.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
    merged.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    return merged;
  });
  const geometry=mergeGeometries(panels,true);
  for(const panel of panels)panel.dispose();
  const materials=[new T.Color(color).multiplyScalar(.68),'#ddd9cd','#22262b','#c6c8c3','#555b5d','#8e7953'].map((tone,index)=>
    new T.MeshStandardMaterial({color:tone,roughness:index===4?.37:.86,metalness:index===4?.28:0,side:T.DoubleSide}));
  materials[0].onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 trainerPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntrainerPoint=position;');
    shader.fragmentShader='varying vec3 trainerPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=trainerPoint;
      vec3 lattice=p*vec3(16.,22.,15.);
      vec3 grain=sin(lattice)*(1.-smoothstep(vec3(.55),vec3(2.1),fwidth(lattice)));
      float knit=(grain.x*grain.z+grain.y*grain.z)*.073;
      float overlay=max(1.-smoothstep(-6.6,-4.8,p.z),smoothstep(6.65,8.3,p.z));
      diffuseColor.rgb*=1.+knit*(1.-overlay)-overlay*.24;
    `);
  };
  materials[0].customProgramCacheKey=()=> 'showroom-trainer-knit';
  const mesh=new T.SkinnedMesh(geometry,materials);
  mesh.name='Showroom trainer '+side;
  mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);
  mesh.bindMode=source.bindMode;mesh.bind(source.skeleton,source.bindMatrix);
  mesh.castShadow=true;mesh.frustumCulled=false;
  return mesh;
}
