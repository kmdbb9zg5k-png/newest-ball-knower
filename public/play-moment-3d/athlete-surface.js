// Restore continuous shading across the generated mesh's split UV vertices.
// Run once during asset loading; topology, UVs, weights and animation stay intact.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
export function refineAthleteSurface(sourcePositions,sourceNormals,sourceTangents,indices,{regularizeHelmet=true}={}){
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
  let group=groups.get(key);if(!group){group={sum:[0,0,0],neighbors:new Set(),p:[positions[at],positions[at+1],positions[at+2]]};groups.set(key,group)}groupFor[i]=group;
 }
 for(let at=0;at<indices.length;at+=3){
  const ids=[indices[at],indices[at+1],indices[at+2]],p=ids.map(i=>[positions[i*3],positions[i*3+1],positions[i*3+2]]);
  const a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]);
  const face=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  // Area weighting avoids thin slivers dominating a smooth surface normal.
  for(const i of ids){for(let k=0;k<3;k++)groupFor[i].sum[k]+=face[k];for(const j of ids)if(i!==j)groupFor[i].neighbors.add(groupFor[j])}
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
