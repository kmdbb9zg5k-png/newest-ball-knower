const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
// Sculpt the existing skinned mesh in bind space. Leave skin, boots and the
// open face cage alone so the animation and equipment still fit the same rig.
export function shapeReferenceFootballPlayer(source, regions, bodyVertices) {
 const positions=new Float32Array(source);
 for(let i=0;i<positions.length/3;i++){
  const at=i*3,x=source[at],y=source[at+1],z=source[at+2];
  if(i<bodyVertices){
   const atRegion=i*4,jersey=regions[atRegion],pants=regions[atRegion+1],side=Math.abs(x);
   // Give the covered pad its own broad top and tapered underside.
   const shoulder=jersey*smooth(.095,.19,side)*(1-smooth(.250,.317,side))*
     smooth(1.205,1.33,y)*(1-smooth(1.405,1.465,y));
   const chest=jersey*(1-smooth(.14,.25,side))*smooth(1.04,1.17,y)*(1-smooth(1.32,1.43,y));
   const waist=jersey*smooth(.86,.98,y)*(1-smooth(1.02,1.16,y))*(1-smooth(.15,.235,side));
   const thigh=pants*smooth(.055,.095,side)*(1-smooth(.19,.245,side))*
     smooth(.46,.57,y)*(1-smooth(.69,.83,y))*smooth(.008,.065,z);
   positions[at]+=Math.sign(x)*(shoulder*.068-waist*.019);
   positions[at+1]+=shoulder*.052;
   positions[at+2]+=z*(shoulder*.25+chest*.24-waist*.11)+thigh*.024;
   continue;
  }
  if(z>.10&&y<1.65)continue;
  const back=1-smooth(.016,.067,z);
  const shell=back*smooth(1.50,1.57,y)+(1-back)*smooth(1.602,1.66,y);
  if(shell===0)continue;
  const center=[0,1.594,-.011],radii=[.127,.132,.130];
  const radius=Math.hypot(x/radii[0],(y-center[1])/radii[1],(z-center[2])/radii[2]);
  const blend=shell*smooth(.78,.93,radius)*.82;
  if(blend===0)continue;
  // Bound radial movement to preserve clearance around the original head.
  const scale=Math.min(1.13,Math.max(.89,1/radius));
  positions[at]=x*(1+(scale-1)*blend);
  positions[at+1]=y+(y-center[1])*(scale-1)*blend;
  positions[at+2]=z+(z-center[2])*(scale-1)*blend;
 }
 return positions;
}

// Restore continuous shading across split UV vertices without changing rig topology.
export function refineAthleteSurface(sourcePositions,sourceNormals,sourceTangents,indices,{regularizeHelmet=true,softBody=null}={}){
 const positions=new Float32Array(sourcePositions),normals=new Float32Array(sourceNormals),tangents=new Float32Array(sourceTangents);
 const count=positions.length/3,groups=new Map(),groupFor=new Array(count);
 for(let i=0;i<count;i++){
  const at=i*3,x=positions[at],y=positions[at+1],z=positions[at+2];
  // Only the crown/rear shell is regularized. Keep the opening, cage, neck,
  // hands and foot contact vertices exactly where the source artist placed them.
  const rear=1-smooth(.015,.065,z),shell=smooth(1.505,1.565,y)*rear+smooth(1.605,1.645,y)*(1-rear);
  if(regularizeHelmet&&shell>0){
   const center=[0,1.574,-.005],radius=[.113,.127,.125],p=[x,y,z],d=p.map((v,k)=>(v-center[k])/radius[k]),length=Math.hypot(...d);
   if(length>.78)for(let k=0;k<3;k++)positions[at+k]+=(center[k]+d[k]/length*radius[k]-p[k])*shell*.82;
  }
  const key=[0,1,2].map(k=>Math.round(positions[at+k]*100000)).join(',');
  let group=groups.get(key);if(!group){group={sum:[0,0,0],neighbors:new Set(),p:[positions[at],positions[at+1],positions[at+2]],softness:1};groups.set(key,group)}groupFor[i]=group;if(softBody)group.softness=Math.min(group.softness,softBody[i]);
 }
 if(softBody){
  for(let at=0;at<indices.length;at+=3){
   const a=groupFor[indices[at]],b=groupFor[indices[at+1]],c=groupFor[indices[at+2]];
   a.neighbors.add(b).add(c);b.neighbors.add(c).add(a);c.neighbors.add(a).add(b);
  }
  const active=[...groups.values()].filter(group=>group.softness>0&&group.neighbors.size>0);
  const source=active.map(group=>group.p);
  // Alternating relaxation rounds small lumps without shrinking the limbs.
  // The mask fixes helmet, hands, footwear and unselected boundaries.
  for(const strength of [.55,-.51,.55,-.51,.55]){
   for(const group of active){
    const average=[0,0,0];
    for(const neighbor of group.neighbors)for(let k=0;k<3;k++)average[k]+=neighbor.p[k];
    group.next=group.p.map((v,k)=>v+(average[k]/group.neighbors.size-v)*group.softness*strength);
   }
   for(const group of active)group.p=group.next;
  }
  for(const [i,group] of active.entries()){
   const shift=group.p.map((value,k)=>value-source[i][k]),distance=Math.hypot(...shift);
   const ratio=Math.min(1,.007*group.softness/(distance||1));
   group.p=source[i].map((value,k)=>value+shift[k]*ratio);
  }
  for(let i=0;i<count;i++)if(groupFor[i].softness>0)positions.set(groupFor[i].p,i*3);
 }
 for(let at=0;at<indices.length;at+=3){
  const ids=[indices[at],indices[at+1],indices[at+2]],p=ids.map(i=>groupFor[i].p);
  const a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]);
  const face=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  // Area weighting avoids thin slivers dominating a smooth surface normal.
  for(const i of ids){for(let k=0;k<3;k++)groupFor[i].sum[k]+=face[k];if(!softBody)for(const j of ids)if(i!==j)groupFor[i].neighbors.add(groupFor[j])}
 }
 const unit=v=>{const len=Math.hypot(...v)||1;return v.map(n=>n/len)};
 for(const group of groups.values())group.sum=unit(group.sum);
 // Suppress the generated mesh's tiny lighting dents without flattening the
 // geometry, silhouette, fabric folds or the hard bends of the face cage.
 for(let pass=0;pass<2;pass++){
  for(const group of groups.values()){
   const sum=group.sum.map(n=>n*3);let total=3;
   for(const neighbor of group.neighbors){const alignment=group.sum.reduce((n,v,k)=>n+v*neighbor.sum[k],0);if(alignment<.35)continue;for(let k=0;k<3;k++)sum[k]+=neighbor.sum[k];total++}
   group.next=unit(sum.map(n=>n/total));
  }
  for(const group of groups.values())group.sum=group.next;
 }
 for(const group of groups.values()){
  const [x,y,z]=group.p,rear=1-smooth(.015,.065,z),shell=smooth(1.505,1.565,y)*rear+smooth(1.605,1.645,y)*(1-rear);
  if(regularizeHelmet&&shell>0){const analytic=unit([x/(.113*.113),(y-1.574)/(.127*.127),(z+.005)/(.125*.125)]);group.sum=unit(group.sum.map((v,k)=>v*(1-shell*.94)+analytic[k]*shell*.94))}
 }
 for(let i=0;i<count;i++){
  const at=i*3,sum=groupFor[i].sum,length=Math.hypot(...sum);if(length<1e-10)continue;
  const sign=sum.reduce((n,v,k)=>n+v*sourceNormals[at+k],0)<0?-1:1;
  for(let k=0;k<3;k++)normals[at+k]=sum[k]/length*sign;
  const dot=[0,1,2].reduce((n,k)=>n+normals[at+k]*tangents[i*4+k],0),t=[0,1,2].map(k=>tangents[i*4+k]-normals[at+k]*dot),tl=Math.hypot(...t);
  if(tl>1e-8)for(let k=0;k<3;k++)tangents[i*4+k]=t[k]/tl;
 }
 return{positions,normals,tangents,weldedVertices:groups.size};
}
