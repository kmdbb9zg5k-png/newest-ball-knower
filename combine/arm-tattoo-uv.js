// The native athlete's detailed ink is painted on its right arm (negative X
// in bind space). Reuse that artwork on the mirrored arm instead of sampling
// its clean-skin UV island. Do this once at load, never in the animation loop.
export function armTattooUV(geometry,armMask){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
 const result=new Float32Array(uv.array),cells=new Map(),size=2;
 const cell=(x,y,z)=>`${x},${y},${z}`;
 for(let i=0;i<p.count;i++)if(armMask[i]>.1&&p.getX(i)<0){
  const key=cell(Math.floor(p.getX(i)/size),Math.floor(p.getY(i)/size),Math.floor(p.getZ(i)/size));
  if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
 }
 for(let i=0;i<p.count;i++)if(armMask[i]>.1&&p.getX(i)>0){
  const x=-p.getX(i),y=p.getY(i),z=p.getZ(i),cx=Math.floor(x/size),cy=Math.floor(y/size),cz=Math.floor(z/size);
  let best=-1,distance=Infinity;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of cells.get(cell(cx+dx,cy+dy,cz+dz))||[]){
   // Prefer the same surface side at UV seams.
   const normalDot=-n.getX(i)*n.getX(j)+n.getY(i)*n.getY(j)+n.getZ(i)*n.getZ(j);
   const d=(p.getX(j)-x)**2+(p.getY(j)-y)**2+(p.getZ(j)-z)**2+Math.max(0,1-normalDot)*.05;
   if(d<distance){distance=d;best=j;}
  }
  if(best>=0){result[i*2]=uv.getX(best);result[i*2+1]=uv.getY(best);}
 }
 return result;
}
