/** Original athlete surfaces. Shared indexed meshes, built once per renderer.
 * Mesh coordinates affect appearance only; the existing pose solver owns joints.
 */
const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const gauss=v=>Math.exp(-v*v);

/** Smooth indexed surface, with averaged seam normals and bounded 16-bit indices. */
function surface(rows,columns,position,{flip=false,closed=true}={}){
 const v=[],ix=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const p=position(j/rows,i/columns);
  v.push(...p,0,0,0,i/columns,j/rows);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
  const a=j*(columns+1)+i,b=a+columns+1;
  if(flip)ix.push(a,a+1,b,b,a+1,b+1);else ix.push(a,b,a+1,b,b+1,a+1);
 }
 for(let i=0;i<ix.length;i+=3){
  const [a,b,c]=ix.slice(i,i+3).map(k=>k*8);
  const ab=[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]],ac=[v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]],n=cross(ab,ac);
  for(const k of[a,b,c])for(let q=0;q<3;q++)v[k+3+q]+=n[q];
 }
 if(closed)for(let j=0;j<=rows;j++){
  const a=j*(columns+1)*8,b=(j*(columns+1)+columns)*8;
  for(let q=0;q<3;q++){const s=v[a+3+q]+v[b+3+q];v[a+3+q]=s;v[b+3+q]=s;}
 }
 for(let i=0;i<v.length;i+=8){let n=norm(v.slice(i+3,i+6));if(Math.hypot(...n)<.9)n=norm([v[i],.01,v[i+2]]);v.splice(i+3,3,...n);}
 return{v,ix};
}

/** Interpolate measured silhouette rings without overshooting cuff/neck boundaries. */
function ringAt(rings,y){
 let k=1;while(k<rings.length-1&&y>rings[k][0])k++;
 const a=rings[k-1],b=rings[k],t=clamp((y-a[0])/(b[0]-a[0]),0,1);
 return a.map((v,i)=>i===0?y:mix(v,b[i],t));
}

/** Sloped padded shoulders, fitted waist and small cloth folds, not a box torso. */
export function createTorsoGeometry(){
 const rings=[[-.5,.70,.82],[-.40,.72,.82],[-.25,.77,.86],[-.05,.85,.91],[.14,.98,.99],[.28,1.04,1],[.36,1,.97],[.43,.82,.85],[.49,.38,.55],[.5,.32,.49]];
 return surface(32,40,(t,u)=>{
  const y=t-.5,[,w,d]=ringAt(rings,y),a=u*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  const waist=gauss((y+.29)/.16),side=Math.abs(c)**4;
  const fold=1+.014*waist*Math.sin(y*82+side*3)+.008*side*Math.sin(y*54+a*3);
  return[Math.sign(c)*Math.abs(c)**.77*w*fold,y,Math.sign(s)*Math.abs(s)**.83*d*fold];
 });
}

/** Continuous tapered muscle envelope. Ends overlap joints instead of pinching to tips. */
export function createLimbGeometry(){
 const rings=[[-.53,.58],[-.46,.82],[-.29,1],[-.08,.97],[.16,.82],[.36,.64],[.50,.49],[.53,.36]];
 return surface(12,12,(t,u)=>{
  const y=mix(-.53,.53,t),[,r]=ringAt(rings,y),a=u*Math.PI*2;
  return[Math.cos(a)*r,y,Math.sin(a)*r*.91];
 });
}

/** Equipment and face meshes retain the same head/ankle transforms as the existing rig. */
export function createPlayerDetailGeometry(){
 const helmet=surface(22,48,(t,u)=>{
  const a=u*Math.PI*2,s=Math.sin(a),c=Math.cos(a),front=clamp((s-.34)/.47,0,1),f=front*front*(3-2*front);
  const maxTheta=mix(Math.PI*(.73+.04*clamp((s+.75)/.50,0,1)),Math.PI*.38,f),theta=mix(.009,maxTheta,t);
  const ridge=1-.011*Math.cos(a*10)**8*gauss((theta-.83)/.36);
  return[c*Math.sin(theta)*ridge,Math.cos(theta)*(1-.025*Math.sin(theta)**2),s*Math.sin(theta)*1.025];
 },{flip:true});
 const faceRings=[[-1,.21,.40],[-.9,.46,.63],[-.72,.69,.77],[-.45,.85,.91],[-.14,.92,.96],[.15,.91,.94],[.44,.87,.88],[.72,.76,.76],[.94,.40,.40],[1,.04,.04]];
 const face=surface(38,48,(t,u)=>{
  const y=mix(-1,1,t),[,w,d]=ringAt(faceRings,y),a=u*Math.PI*2,c=Math.cos(a),s=Math.sin(a),x=c*w;
  const front=Math.max(0,s)**10;
  const nose=.22*(gauss(x/.17)*gauss((y+.06)/.25));
  const brow=.048*(gauss((Math.abs(x)-.34)/.18)*gauss((y-.22)/.10));
  const sockets=-.043*(gauss((Math.abs(x)-.36)/.15)*gauss((y-.10)/.12));
  const lips=.055*(gauss(x/.37)*gauss((y+.52)/.12));
  return[x,y,s*d+front*(nose+brow+sockets+lips)];
 });
 const visor=surface(4,28,(t,u)=>{
  const a=(u-.5)*1.80;
  return[Math.sin(a)*.184,(t-.5)*.079+.018,.177+Math.cos(a)*.058];
 },{closed:false});
 const shoeRings=[[0,.87,.97,.08],[.10,1,1,.08],[.26,.98,.98,.065],[.48,.87,.86,.015],[.74,.65,.59,-.15],[.93,.47,.38,-.33],[1,.37,.29,-.36]];
 const cleat=surface(18,32,(t,u)=>{
  const[,w,d,z]=ringAt(shoeRings,t),a=u*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  return[Math.sign(c)*Math.abs(c)**.75*w,t,Math.sign(s)*Math.abs(s)**.74*d+z];
 });
 return{helmet,playerFace:face,playerVisor:visor,playerCleat:cleat};
}
