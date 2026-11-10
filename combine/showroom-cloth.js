import * as T from 'three';

const hipOutline=[12.49,12.53,12.66,12.74,12.83,12.97,13.33,13.55,13.79,14.04,13.03,12.18,12.11,11.98,11.81,11.6,11.3,11.04,10.8,10.25,10,9.73];

export function showroomJoggerPosition(x,y,z){
  const lower=T.MathUtils.clamp((y-10)/29,0,1);
  const legCenter=Math.sign(x)*(8.6-2.3*lower);
  const legX=T.MathUtils.lerp(x,legCenter,.2);
  const legZ=T.MathUtils.lerp(z,-2.3+2.3*lower,.21);
  const i=T.MathUtils.clamp(y-35,0,hipOutline.length-1),row=Math.min(Math.floor(i),hipOutline.length-2);
  const outline=T.MathUtils.lerp(hipOutline[row],hipOutline[row+1],i-row);
  const fit=T.MathUtils.clamp((y-44)/12,0,1);
  const hipWidth=12.35-2.55*fit;
  const waist=T.MathUtils.smoothstep(y,34,42);
  return [T.MathUtils.lerp(legX,x*hipWidth/outline,waist),y,T.MathUtils.lerp(legZ,z*.87,waist)];
}

export function smoothShowroomHips(geometry){
  const p=geometry.attributes.position,tri=geometry.index;
  const neighbors=Array.from({length:p.count},()=>new Set());
  for(let i=0;i<tri.count;i+=3){
    const a=tri.getX(i),b=tri.getX(i+1),c=tri.getX(i+2);
    neighbors[a].add(b).add(c);neighbors[b].add(a).add(c);neighbors[c].add(a).add(b);
  }
  for(let pass=0;pass<3;pass++){
    const previous=p.array.slice();
    for(let i=0;i<p.count;i++){
      const y=previous[i*3+1];
      const blend=.46*T.MathUtils.smoothstep(y,35,40)*(1-T.MathUtils.smoothstep(y,46,53));
      if(!blend||!neighbors[i].size)continue;
      let x=0,nextY=0,z=0;
      for(const j of neighbors[i]){x+=previous[j*3];nextY+=previous[j*3+1];z+=previous[j*3+2];}
      const n=neighbors[i].size;
      p.setXYZ(i,T.MathUtils.lerp(previous[i*3],x/n,blend),T.MathUtils.lerp(y,nextY/n,blend),T.MathUtils.lerp(previous[i*3+2],z/n,blend));
    }
  }
}

// The hood starts at the collar, rolls over its opening and falls into the
// back panel. Reversing the roll into the opening gives it a fabric lining.
export function showroomHoodGeometry(){
  const profile=[
    [3.8,1.5,79.1,-2.2,.82],
    [5.2,2.0,79.0,-4.35,1.35],
    [5.7,2.34,78.2,-6.1,1.72],
    [5.63,2.5,76.5,-7.75,1.8],
    [4.8,2.32,74.6,-8.1,1.64],
    [3.5,1.78,72.9,-7.95,1.3],
    [1.85,1.1,71.65,-7.55,.73],
    [.3,.27,71.1,-7.1,.15],
  ];
  const width=48,rows=26,positions=[],indices=[];
  const curve=new T.CatmullRomCurve3(profile.map(([x,y,cy])=>new T.Vector3(x,y,cy)));
  const depth=new T.CatmullRomCurve3(profile.map(([, , ,z,slope])=>new T.Vector3(z,slope,0)));
  for(let i=0;i<=rows;i++){
    const size=curve.getPoint(i/rows),back=depth.getPoint(i/rows);
    for(let j=0;j<width;j++){
      const angle=j/width*Math.PI*2;
      const ripple=1+.065*Math.cos(angle*3+i*.19)+.035*Math.sin(angle*5);
      positions.push(size.x*Math.cos(angle)*ripple,size.z+size.y*Math.sin(angle)*ripple,back.x+back.y*Math.sin(angle)*ripple);
      if(i===rows)continue;
      const a=i*width+j,b=i*width+(j+1)%width;
      indices.push(a,b,a+width,b,b+width,a+width);
    }
  }
  // Close the folded tip so oblique camera angles cannot see through it.
  const last=rows*width;
  for(let j=1;j<width-1;j++)indices.push(last,last+j+1,last+j);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
