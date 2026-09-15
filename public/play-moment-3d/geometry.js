const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
// Lofted, tapered pad/jersey silhouette instead of stacked torso spheres.
export function createTorsoGeometry(){
 const rings=[[-.5,.69,.71],[-.34,.73,.77],[-.05,.88,.88],[.23,1,.98],[.38,.98,1],[.5,.83,.80]];
 const n=24,v=[],ix=[];
 for(const [y,w,d] of rings)for(let i=0;i<=n;i++){
  const a=i/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  v.push(Math.sign(c)*Math.pow(Math.abs(c),.66)*w,y,Math.sign(s)*Math.pow(Math.abs(s),.66)*d,0,0,0,i/n,y+.5);
 }
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;ix.push(a,b,a+1,b,b+1,a+1)}
 for(let i=0;i<ix.length;i+=3){
  const ids=ix.slice(i,i+3).map(k=>k*8),a=ids[0],b=ids[1],c=ids[2];
  const ab=[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]],ac=[v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]],normal=cross(ab,ac);
  // Correct winding so illumination points out of the padded body.
  const mid=[(v[a]+v[b]+v[c])/3,0,(v[a+2]+v[b+2]+v[c+2])/3];
  const sign=dot(normal,mid)<0?-1:1;
  for(const index of ids)for(let k=0;k<3;k++)v[index+3+k]+=normal[k]*sign;
 }
 for(let i=0;i<v.length;i+=8){const no=norm(v.slice(i+3,i+6));v.splice(i+3,3,...no)}
 return{v,ix};
}
