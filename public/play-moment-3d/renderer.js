/* WebGL2 renderer. Project-owned, same-origin assets; no external runtime services.
   Instanced geometry; one bounded actor-only shadow map; material-aware lights. */
export const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
export function translate(x=0,y=0,z=0){const m=identity();m[12]=x;m[13]=y;m[14]=z;return m}
export function scale(x=1,y=x,z=x){const m=identity();m[0]=x;m[5]=y;m[10]=z;return m}
export function rx(a){const m=identity(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m}
export function ry(a){const m=identity(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m}
export function rz(a){const m=identity(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m}
export function pose(x,y,z,sx=1,sy=sx,sz=sx){const m=scale(sx,sy,sz);m[12]=x;m[13]=y;m[14]=z;return m}
export const point=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
function norm(v){const l=Math.hypot(...v)||1;return v.map(n=>n/l)}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a.reduce((s,v,i)=>s+v*b[i],0)}
export function view(eye,target){const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
export function projection(aspect,fov=50){const f=1/Math.tan(fov*Math.PI/360),near=.1,far=250;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0])}
export function segment(a,b,r){const y=norm(b.map((v,i)=>v-a[i])),x=norm(cross(Math.abs(y[1])>.96?[0,0,1]:[0,1,0],y)),z=cross(x,y),len=Math.hypot(...b.map((v,i)=>v-a[i]));return new Float32Array([x[0]*r,x[1]*r,x[2]*r,0,y[0]*len,y[1]*len,y[2]*len,0,z[0]*r,z[1]*r,z[2]*r,0,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1])}
export function hex(s){return[parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255,1]}
function orthographic(size,near=.1,far=140){return new Float32Array([1/size,0,0,0,0,1/size,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1])}
function sphere(n=16,rows=10,helmet=false){const v=[],ix=[];for(let j=0;j<=rows;j++){const th=j/rows*Math.PI;for(let i=0;i<=n;i++){const ph=i/n*Math.PI*2,x=Math.sin(th)*Math.cos(ph),y=Math.cos(th),z=Math.sin(th)*Math.sin(ph);v.push(x,y,z,x,y,z,i/n,j/rows)}}for(let j=0;j<rows;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;const ph=(i+.5)/n*Math.PI*2,th=(j+.5)/rows*Math.PI;if(helmet&&Math.sin(ph)>.40&&th>Math.PI*.36&&th<Math.PI*.83)continue;ix.push(a,b,a+1,b,b+1,a+1)}return{v,ix}}
function cube(){const v=[],ix=[],faces=[[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,1,0],[0,0,-1]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];for(const [n,u,w] of faces){const off=v.length/8;for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])v.push(...n.map((x,i)=>(x+u[i]*a+w[i]*b)*.5),...n,(a+1)/2,(b+1)/2);ix.push(off,off+1,off+2,off,off+2,off+3)}return{v,ix}}
function cylinder(n=12){const v=[],ix=[];for(let j=0;j<=1;j++)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,x=Math.cos(a),z=Math.sin(a);v.push(x,j-.5,z,x,0,z,i/n,j)}for(let i=0;i<n;i++)ix.push(i,i+n+1,i+1,i+1,i+n+1,i+n+2);return{v,ix}}
/** Pointed leather shell, aligned with segment()'s local Y axis. */
export function footballGeometry(){
 const v=[],ix=[],rings=18,sides=24;
 for(let j=0;j<=rings;j++){
  const theta=j/rings*Math.PI,y=.5*Math.cos(theta),radius=Math.pow(Math.sin(theta),1.18);
  for(let i=0;i<=sides;i++){
   const phi=i/sides*Math.PI*2,c=Math.cos(phi),s=Math.sin(phi);
   const dy=-.5*Math.sin(theta),dr=1.18*Math.pow(Math.max(.00001,Math.sin(theta)),.18)*Math.cos(theta),normal=norm([-dy*c,dr,-dy*s]);
   v.push(radius*c,y,radius*s,...normal,i/sides,j/rings);
  }
 }
 for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;ix.push(a,b,a+1,a+1,b,b+1)}
 return{v,ix};
}
function spectatorBody(){
 const v=[],ix=[],rings=[[-.5,.65],[-.20,.82],[.30,1],[.5,.62]],n=8;
 for(const [y,r]of rings)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;v.push(Math.cos(a)*r,y,Math.sin(a)*r*.65,...norm([Math.cos(a),.10,Math.sin(a)]),i/n,y+.5)}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;ix.push(a,b,a+1,a+1,b,b+1)}
 return{v,ix};
}
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 p;layout(location=1) in vec3 n;layout(location=2) in vec2 uv;
layout(location=3) in mat4 model;layout(location=7) in vec4 color;layout(location=8) in float shine;
uniform mat4 vp;uniform mat4 lightVP;uniform vec3 eye;uniform highp int material;uniform float sceneTime;
out vec3 world;out vec3 normal;out vec3 local;out vec2 tex;out vec4 tint;out float gloss;out vec4 lightSpace;
void main(){vec4 w=model*vec4(p,1.);
 if(material==6){vec3 forward=normalize(vec3(eye.x-model[3].x,0.,eye.z-model[3].z)),right=vec3(forward.z,0.,-forward.x);w=vec4(model[3].xyz+right*p.x*length(model[0].xyz)+vec3(0.,p.y*length(model[1].xyz),0.),1.);}
 if(material==6){float seed=dot(model[3].xz,vec2(1.71,3.19));w.x+=sin(sceneTime*1.15+seed)*.025*p.y*p.y;w.y+=sin(sceneTime*1.7+seed*2.)*.012*p.y;}
 world=w.xyz;local=p;
 vec3 sq=vec3(dot(model[0].xyz,model[0].xyz),dot(model[1].xyz,model[1].xyz),dot(model[2].xyz,model[2].xyz));
 normal=normalize(mat3(model)*(n/max(sq,vec3(.00001))));tex=uv;tint=color;gloss=shine;lightSpace=lightVP*w;gl_Position=vp*w;}`;
const fragment=`#version 300 es
precision highp float;
in vec3 world;in vec3 normal;in vec3 local;in vec2 tex;in vec4 tint;in float gloss;in vec4 lightSpace;
uniform vec3 eye;uniform sampler2D image;uniform sampler2D shadowMap;uniform sampler2D turfDetail;uniform int hasTurfDetail;
uniform int textured;uniform int unlit;uniform highp int material;uniform int useShadow;uniform float shadowTexel;
out vec4 outputColor;
const vec3 KEY=vec3(-.48,.82,-.31);
float visibility(vec3 N){
 if(useShadow==0)return 1.;vec3 q=lightSpace.xyz/lightSpace.w*.5+.5;
 if(q.x<.002||q.x>.998||q.y<.002||q.y>.998||q.z<0.||q.z>1.)return 1.;
 float bias=max(.00030,.00085*(1.-max(dot(N,normalize(KEY)),0.)));float sum=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  float depth=texture(shadowMap,q.xy+vec2(float(x),float(y))*shadowTexel).r;
  sum+=q.z-bias<=depth?1.:0.;
 }return sum/9.;
}
float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
vec3 film(vec3 v){return clamp((v*(2.51*v+.03))/(v*(2.43*v+.59)+.14),0.,1.);}
void main(){
 vec4 base=tint;
 if(material==6){
  vec2 cell=vec2(mod(floor(gloss+.5),4.),floor(gloss/4.));
  vec2 crowdUV=vec2(fract(gloss)>.1?1.-tex.x:tex.x,tex.y);
  vec2 atlasUV=(cell+clamp(crowdUV,vec2(.006),vec2(.994)))*.25;
  base*=texture(image,atlasUV);if(base.a<.48)discard;
  float falloff=mix(.91,.64,smoothstep(25.,145.,distance(eye,world)));
  vec3 crowd=base.rgb*falloff;crowd=mix(crowd,vec3(.035,.048,.063),smoothstep(55.,170.,distance(eye,world))*.35);
  outputColor=vec4(crowd,1.);return;
 }
 if(textured==1)base*=texture(image,tex);if(base.a<.012)discard;
 if(unlit==1){outputColor=base;return;}
 vec3 albedo=pow(max(base.rgb,vec3(0.)),vec3(2.2));vec3 N=normalize(normal),V=normalize(eye-world);
 // Cloth and skin stay matte; helmet/visor clearcoat responds to the light banks.
 float g=clamp(gloss,0.,1.);float rough=mix(.85,.18,g);
 if(material==2){
  float frequency=90.;float aa=1.-smoothstep(.08,.6,max(fwidth(tex.x),fwidth(tex.y))*frequency);
  float weave=sin(tex.x*frequency*6.283)*sin(tex.y*frequency*6.283);
  albedo*=1.+.045*weave*aa;
 }
 if(material==5){
  // Four stitched leather panels and an eight-crossbar lace, built into the shell.
  vec2 grainUV=tex*vec2(190.,95.);float detail=1.-smoothstep(.35,1.3,max(fwidth(grainUV.x),fwidth(grainUV.y)));
  vec2 pebble=fract(grainUV)-.5;float grain=1.-smoothstep(.13,.45,length(pebble));
  float seam=1.-smoothstep(.008,.018,abs(fract(tex.x*4.+.5)-.5));
  float laceU=abs(tex.x-.25),span=step(.34,tex.y)*step(tex.y,.66);
  float crosses=span*(1.-smoothstep(.007,.014,abs(fract((tex.y-.34)*25.)-.5)/25.))*(1.-smoothstep(.058,.070,laceU));
  float spine=span*(1.-smoothstep(.007,.015,laceU)),lace=max(crosses,spine);
  albedo=pow(vec3(.34,.125,.052)*(1.+grain*.14*detail)*(1.-seam*.42),vec3(2.2));
  albedo=mix(albedo,vec3(.76,.72,.59),lace);
  N=normalize(N+vec3(pebble.x,0.,pebble.y)*.075*detail*(1.-lace));rough=.82;g=.08;
 }
 if(material==4&&hasTurfDetail==1){
  vec2 grassUV=world.xz*.38;
  vec3 grass=texture(turfDetail,grassUV).rgb;
  grass=mix(grass,vec3(.30,.43,.24),.23);
  float grassMask=(1.-smoothstep(.80,.96,base.r/max(base.g,.001)))*smoothstep(.16,.23,base.g);
  float variation=.92+.08*smoothstep(-.2,.2,sin(world.z*3.14159*.2));
  grass=mix(grass,vec3(dot(grass,vec3(.2126,.7152,.0722))),.30);
  vec3 turf=pow(grass*vec3(.78,.83,.79),vec3(2.2))*variation;
  albedo=mix(albedo,turf,grassMask*.94);
  float fiber=dot(grass,vec3(.3,.6,.1));
  albedo*=mix(.96,1.04,clamp(fiber*2.,0.,1.));
  float rawFiber=dot(texture(turfDetail,grassUV).rgb,vec3(.3,.6,.1));
  float dx=dot(texture(turfDetail,grassUV+vec2(.001,0.)).rgb,vec3(.3,.6,.1))-rawFiber;
  float dz=dot(texture(turfDetail,grassUV+vec2(0.,.001)).rgb,vec3(.3,.6,.1))-rawFiber;
  N=normalize(N+vec3(-dx,0.,-dz)*1.4);
 }
 if(material==4){
  vec2 grid=world.xz*36.;float aa=1.-smoothstep(.6,2.3,max(fwidth(grid.x),fwidth(grid.y)));
  float grain=hash(floor(grid)),crossGrain=hash(floor(world.zx*67.+19.));
  float blades=sin(world.z*290.+grain*3.)*sin(world.x*137.+crossGrain*2.);
  albedo*=1.+(grain-.5)*.075*aa+(crossGrain-.5)*.025*aa;
  float paintFiber=smoothstep(.65,.90,base.r/max(base.g,.001));
  albedo*=1.-paintFiber*smoothstep(.82,.99,grain)*.12*aa;
  float traffic=(1.-smoothstep(5.,17.,abs(world.x)))*smoothstep(10.,22.,world.z)*(1.-smoothstep(98.,110.,world.z));
  float patches=sin(world.x*.72+sin(world.z*.43))*sin(world.z*1.19);
  albedo=mix(albedo,albedo*vec3(1.13,.98,.84),traffic*smoothstep(.25,.86,patches)*.15*(1.-paintFiber));
  N=normalize(N+vec3((grain-.5)*.06,0.,blades*.045)*aa);
 }
 float lit=visibility(N);vec3 L0=normalize(KEY),L1=normalize(vec3(.62,.69,.38)),L2=normalize(vec3(-.20,.72,.65));
 float d0=max(dot(N,L0),0.),d1=max(dot(N,L1),0.),d2=max(dot(N,L2),0.);
 vec3 ambient=mix(vec3(.052,.066,.078),vec3(.145,.185,.255),N.y*.5+.5);
 // Four real stadium banks add localized highlights instead of a uniform wash.
 vec3 toA=vec3(-35.,23.,8.)-world,toB=vec3(35.,23.,111.)-world,toC=vec3(35.,23.,8.)-world,toD=vec3(-35.,23.,111.)-world;
 float bankA=max(dot(N,normalize(toA)),0.)/(1.+dot(toA,toA)*.0011);
 float bankB=max(dot(N,normalize(toB)),0.)/(1.+dot(toB,toB)*.0011);
 float bankC=max(dot(N,normalize(toC)),0.)/(1.+dot(toC,toC)*.0015);
 float bankD=max(dot(N,normalize(toD)),0.)/(1.+dot(toD,toD)*.0015);
 vec3 diffuse=ambient+vec3(1.63,1.54,1.34)*d0*mix(.22,1.,lit)+vec3(.46,.59,.84)*d1+vec3(.22,.27,.36)*d2+vec3(1.12,1.10,1.02)*(bankA+bankB)*2.55+vec3(.82,1.02,1.30)*(bankC+bankD)*1.25;
 // Slight wrap on skin keeps faces readable without making uniforms luminous.
 if(material==3)diffuse+=vec3(.17,.10,.075)*max(0.,dot(N,L0)+.35);
 // The field is floodlit; the surrounding bowl remains a night environment.
 float exposure=material==4?.48:material==0?.48:1.;
 vec3 rgb=albedo*diffuse*exposure;
 float nv=max(dot(N,V),0.);vec3 F0=mix(vec3(.025),albedo*.55+vec3(.12),g*.5);
 vec3 fresnel=F0+(1.-F0)*pow(1.-nv,5.);
 float exponent=mix(12.,100.,1.-rough);
 float sp0=pow(max(dot(N,normalize(L0+V)),0.),exponent);
 float sp1=pow(max(dot(N,normalize(L1+V)),0.),exponent*.8);
 float strength=.04+g*2.4;
 rgb+=fresnel*strength*(vec3(1.8,1.7,1.5)*sp0*mix(.35,1.,lit)+vec3(.9,1.15,1.55)*sp1);
 if(g>.3){
  vec3 R=reflect(-V,N);float crown=pow(max(dot(R,normalize(vec3(.10,.96,.15))),0.),18.);
  rgb+=fresnel*g*crown*.7;
 }
 if(material==4){
  float mowing=.96+.04*sin(world.z*3.14159*.2);rgb*=mowing*mix(.68,1.,lit);
  float paint=smoothstep(.20,.45,albedo.r);rgb=mix(rgb,rgb*1.08,paint);
  float grazing=pow(1.-max(dot(N,V),0.),3.);float dew=pow(max(dot(N,normalize(L1+V)),0.),30.);
  float blade=hash(floor(world.xz*92.));float grassSheen=(1.-smoothstep(.80,.96,base.r/max(base.g,.001)))*smoothstep(.16,.23,base.g);
  rgb+=vec3(.022,.045,.026)*(grazing*(.42+blade*.20)+dew*.30)*grassSheen;
 }
 float groundFill=smoothstep(0.,.72,world.y);if(material>0&&material!=4)rgb*=mix(.68,1.,groundFill);
 // Grounded ambient occlusion gives feet, equipment and stadium seams weight.
 float contactAO=1.-(1.-smoothstep(.02,.52,world.y))*(1.-abs(N.y))*.22;rgb*=contactAO;
 float fog=smoothstep(50.,190.,distance(eye,world));rgb=mix(rgb,vec3(.016,.026,.046),fog*.70);
 outputColor=vec4(pow(film(rgb*1.12),vec3(1./2.2)),base.a);
}`;
const skyVertex=`#version 300 es
precision highp float;out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const skyFragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 outputColor;
float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){float y=clamp(uv.y,0.,1.),horizon=pow(1.-y,3.2);vec3 sky=mix(vec3(.020,.032,.058),vec3(.068,.096,.145),horizon);sky+=vec3(.050,.071,.095)*exp(-pow((y-.12)*5.1,2.));vec2 cells=floor(uv*vec2(340.,190.));float star=step(.9970,skyHash(cells))*smoothstep(.46,.05,length(fract(uv*vec2(340.,190.))-.5))*smoothstep(.18,.44,y);sky+=vec3(.61,.70,.82)*star;float cloud=(sin(uv.x*18.+uv.y*7.)+sin(uv.x*31.-uv.y*11.)+sin(uv.x*9.-uv.y*4.))*.36;sky+=vec3(.021,.030,.046)*smoothstep(.48,1.,cloud)*smoothstep(.18,.65,y);vec2 moonP=(uv-vec2(.78,.73))*vec2(1.78,1.);float moon=1.-smoothstep(.027,.035,length(moonP));float moonHalo=exp(-length(moonP)*24.);sky+=vec3(.70,.77,.82)*(moon*.78+moonHalo*.055);float stadiumGlow=exp(-pow((y-.055)*10.,2.));sky+=vec3(.035,.060,.086)*stadiumGlow;vec2 p=uv*2.-1.;sky*=1.-clamp(dot(p,p)*.105,0.,.30);outputColor=vec4(sky,1.);}`;
const depthVertex=`#version 300 es
precision highp float;layout(location=0)in vec3 p;layout(location=3)in mat4 model;uniform mat4 lightVP;
void main(){gl_Position=lightVP*model*vec4(p,1.);}`;
const depthFragment=`#version 300 es
precision highp float;void main(){}`;
export const GRAPHICS_TIERS=Object.freeze({
 eco:{dpr:1,shadow:0},balanced:{dpr:1.5,shadow:1024},high:{dpr:2,shadow:2048}
});
function program(gl,vs,fs){
 const out=gl.createProgram(),shaders=[];
 try{for(const [type,source]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
  const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));gl.attachShader(out,shader);
 }gl.linkProgram(out);if(!gl.getProgramParameter(out,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(out));return out;
 }catch(error){gl.deleteProgram(out);throw error;}finally{for(const shader of shaders)gl.deleteShader(shader);}
}
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
  if(!gl)throw new Error('WebGL2 unavailable');this.gl=gl;this.batches=new Map();this.geometry=new Map();this.actorPass=false;
  this.eye=[0,18,0];this.target=[0,0,40];this.vp=identity();this.lightVP=identity();this.drawCalls=0;this.shadowDrawCalls=0;this.lost=false;
  this.shadowTexture=null;this.shadowBuffer=null;this.shadowAvailable=false;this.shadowSize=0;this.quality='high';this.overflows=0;this.shadowCasters=[];
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;const box=document.getElementById('error'),text=document.getElementById('errorText');if(box)box.hidden=false;if(text)text.textContent='Graphics paused. Reload this practice page to restart. Your career is unchanged.'});
  this.program=program(gl,vertex,fragment);this.depthProgram=program(gl,depthVertex,depthFragment);
  this.skyProgram=program(gl,skyVertex,skyFragment);this.skyVao=gl.createVertexArray();
  this.uniforms=Object.fromEntries(['vp','eye','image','textured','unlit','lightVP','shadowMap','useShadow','shadowTexel','material','turfDetail','hasTurfDetail','sceneTime'].map(k=>[k,gl.getUniformLocation(this.program,k)]));
  this.reducedCrowdMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  this.depthUniform=gl.getUniformLocation(this.depthProgram,'lightVP');
  this.shapes={crowdSprite:{v:[-.5,0,0,0,0,1,0,1,.5,0,0,0,0,1,1,1,.5,1,0,0,0,1,1,0,-.5,1,0,0,0,1,0,0],ix:[0,1,2,0,2,3]},crowd:spectatorBody(),crowdEnd:spectatorBody(),crowdHead:sphere(6,4),football:footballGeometry(),sphere:sphere(),helmet:sphere(28,18,true),cube:cube(),cylinder:cylinder(),plane:{v:[-.5,0,-.5,0,1,0,0,0,.5,0,-.5,0,1,0,1,0,.5,0,.5,0,1,0,1,1,-.5,0,.5,0,1,0,0,1],ix:[0,2,1,0,3,2]}};
  this.textures=new Map();this.anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.009,.016,.029,1);
  // Always bind a complete sampler, including the low-power/failure paths.
  this.neutralShadow=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.neutralShadow);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  // The practice experience always launches at full fidelity. Lower tiers remain
  // internal only so automated fallback checks can still exercise weak hardware.
  this.setQuality('high');
  if(new URLSearchParams(location.search).has('qa')){window.bkSetGraphicsQualityForQA=tier=>this.setQuality(tier);window.bkGraphicsDiagnostics=()=>({quality:this.quality,shadowAvailable:this.shadowAvailable,shadowSize:this.shadowSize,shadowDrawCalls:this.shadowDrawCalls,drawCalls:this.drawCalls,textureCount:this.textures.size,instanceBytes:[...this.batches.values()].reduce((n,b)=>n+b.data.byteLength,0),geometryCount:this.geometry.size,overflows:this.overflows,eye:this.eye,target:this.target,canvas:[canvas.width,canvas.height]})}
 }
 texture(name,canvas,repeat=false){
  const gl=this.gl;const previous=this.textures.get(name);if(previous)gl.deleteTexture(previous);
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);
  const ext=this.anisotropy;if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));this.textures.set(name,t);
 }
 setQuality(tier){
  if(!Object.prototype.hasOwnProperty.call(GRAPHICS_TIERS,tier))return;this.quality=tier;this.setupShadow(GRAPHICS_TIERS[tier].shadow);this.resize();
  document.querySelectorAll('[data-bk-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bkQuality===tier)));
 }
 setupShadow(requested){
  const gl=this.gl;if(this.shadowBuffer)gl.deleteFramebuffer(this.shadowBuffer);if(this.shadowTexture)gl.deleteTexture(this.shadowTexture);
  this.shadowBuffer=null;this.shadowTexture=null;this.shadowAvailable=false;this.shadowSize=0;
  if(!requested)return;
  const size=Math.min(requested,gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  const texture=gl.createTexture(),buffer=gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
  for(const p of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
  for(const p of[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);
  gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
  const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(!ok){gl.deleteFramebuffer(buffer);gl.deleteTexture(texture);console.warn('Using contact shadows: depth framebuffer unavailable.');return;}
  this.shadowBuffer=buffer;this.shadowTexture=texture;this.shadowSize=size;this.shadowAvailable=true;
 }
 resize(){const r=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,GRAPHICS_TIERS[this.quality].dpr);this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const w=Math.max(1,Math.round(this.width*d)),h=Math.max(1,Math.round(this.height*d));if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;this.gl.viewport(0,0,this.canvas.width,this.canvas.height)}
 camera(eye,target){this.eye=eye;this.target=target;this.vp=mul(projection(this.width/this.height,this.fov||50),view(eye,target))}
 project(p){const m=this.vp,x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return{x:(x/w*.5+.5)*this.width,y:(.5-y/w*.5)*this.height,visible:w>0}}
 begin(){for(const b of this.batches.values())b.count=0;this.actorPass=false;this.overflows=0;this.shadowCasters.length=0;}
 lateBegin(){for(const b of this.batches.values())b.count=0;this.actorPass=false;this.overflows=0;}
 queueShadowCaster(draw){if(typeof draw==='function')this.shadowCasters.push(draw)}
 add(shape,matrix,color=[1,1,1,1],texture='',unlit=false,shine=0,material=0){
  const actor=Boolean(this.actorPass),blend=texture==='shadow'||texture==='lamp-glow'||texture==='player-glow'||texture==='turf-fx'||texture==='impact-glow'||texture==='stadium-pool';
  if(texture==='turf')material=4;
  const key=[shape,texture,unlit,actor,material].join('|');let b=this.batches.get(key);
  if(!b){const gl=this.gl,g=this.shapes[shape];if(!g)throw new Error('Unknown geometry: '+shape);
   b={count:0,capacity:32,data:new Float32Array(21*32),shape,texture,unlit,actor,material,blend,vao:gl.createVertexArray(),instances:gl.createBuffer(),indices:g.ix.length};
   gl.bindVertexArray(b.vao);let geometry=this.geometry.get(shape);
   if(!geometry){geometry={vertices:gl.createBuffer(),indices:gl.createBuffer()};gl.bindBuffer(gl.ARRAY_BUFFER,geometry.vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.v),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,geometry.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(g.ix),gl.STATIC_DRAW);this.geometry.set(shape,geometry)}
   gl.bindBuffer(gl.ARRAY_BUFFER,geometry.vertices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,geometry.indices);
   for(const [i,size,offset]of[[0,3,0],[1,3,12],[2,2,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,32,offset)}
   gl.bindBuffer(gl.ARRAY_BUFFER,b.instances);gl.bufferData(gl.ARRAY_BUFFER,b.data.byteLength,gl.DYNAMIC_DRAW);
   for(let i=0;i<4;i++){gl.enableVertexAttribArray(3+i);gl.vertexAttribPointer(3+i,4,gl.FLOAT,false,84,i*16);gl.vertexAttribDivisor(3+i,1)}
   gl.enableVertexAttribArray(7);gl.vertexAttribPointer(7,4,gl.FLOAT,false,84,64);gl.vertexAttribDivisor(7,1);
   gl.enableVertexAttribArray(8);gl.vertexAttribPointer(8,1,gl.FLOAT,false,84,80);gl.vertexAttribDivisor(8,1);this.batches.set(key,b);
  }
  if(b.count>=8192){this.overflows++;return;}
  if(b.count>=b.capacity){b.capacity=Math.min(8192,b.capacity*2);const data=new Float32Array(21*b.capacity);data.set(b.data);b.data=data;this.gl.bindBuffer(this.gl.ARRAY_BUFFER,b.instances);this.gl.bufferData(this.gl.ARRAY_BUFFER,b.data.byteLength,this.gl.DYNAMIC_DRAW)}
  const i=b.count++*21;b.data.set(matrix,i);b.data.set(color,i+16);b.data[i+20]=shine;
 }
 glow(position,size,color=[.7,.84,1,.2]){
  const forward=norm(this.eye.map((v,i)=>v-position[i])),right=norm(cross([0,1,0],forward)),up=cross(forward,right);
  const m=new Float32Array([right[0]*size,right[1]*size,right[2]*size,0,forward[0],forward[1],forward[2],0,up[0]*size,up[1]*size,up[2]*size,0,...position,1]);
  this.add('plane',m,color,'lamp-glow',true);
 }
 draw(){
  if(this.lost)return;const gl=this.gl,active=[...this.batches.values()].filter(b=>b.count);
  for(const b of active){gl.bindBuffer(gl.ARRAY_BUFFER,b.instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,b.data.subarray(0,b.count*21));}
  this.shadowDrawCalls=0;
  if(this.shadowAvailable){
   const focus=[Math.round(this.target[0]*2)/2,0,Math.round(this.target[2]*2)/2],L=norm([-.48,.82,-.31]);
   this.lightVP=mul(orthographic(33),view(focus.map((v,i)=>v+L[i]*65),focus));
   gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowBuffer);gl.viewport(0,0,this.shadowSize,this.shadowSize);gl.disable(gl.BLEND);gl.depthMask(true);gl.clear(gl.DEPTH_BUFFER_BIT);
   gl.useProgram(this.depthProgram);gl.uniformMatrix4fv(this.depthUniform,false,this.lightVP);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.1,1.2);
   // Only articulated solid athlete geometry casts; number panels/crowd never do.
   for(const b of active){if(!b.actor||b.shape==='plane'||b.unlit||b.blend)continue;gl.bindVertexArray(b.vao);gl.drawElementsInstanced(gl.TRIANGLES,b.indices,gl.UNSIGNED_SHORT,0,b.count);this.shadowDrawCalls++;}
   for(const draw of this.shadowCasters)this.shadowDrawCalls+=Math.max(0,Number(draw(this.lightVP))||0);
   gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(false);gl.useProgram(this.skyProgram);gl.bindVertexArray(this.skyVao);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
  gl.useProgram(this.program);gl.uniform1f(this.uniforms.sceneTime,this.reducedCrowdMotion?0:(this.sceneTime||0));gl.uniformMatrix4fv(this.uniforms.vp,false,this.vp);gl.uniformMatrix4fv(this.uniforms.lightVP,false,this.lightVP);gl.uniform3fv(this.uniforms.eye,this.eye);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadowAvailable?this.shadowTexture:this.neutralShadow);gl.uniform1i(this.uniforms.shadowMap,1);gl.uniform1i(this.uniforms.useShadow,this.shadowAvailable?1:0);gl.uniform1f(this.uniforms.shadowTexel,this.shadowSize?1/this.shadowSize:1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.textures.get('turf-detail')||this.neutralShadow);gl.uniform1i(this.uniforms.turfDetail,2);gl.uniform1i(this.uniforms.hasTurfDetail,this.textures.has('turf-detail')?1:0);
  this.drawCalls=1;
  // Transparent contact shadows and light halos must draw after every opaque batch.
  active.sort((a,b)=>Number(a.blend)-Number(b.blend));
  for(const b of active){
   if(b.blend){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,b.texture.endsWith('-glow')?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false)}else{gl.disable(gl.BLEND);gl.depthMask(true)}
   gl.bindVertexArray(b.vao);gl.uniform1i(this.uniforms.textured,b.texture?1:0);gl.uniform1i(this.uniforms.unlit,b.unlit?1:0);gl.uniform1i(this.uniforms.material,b.material);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,b.texture?this.textures.get(b.texture):this.neutralShadow);gl.uniform1i(this.uniforms.image,0);
   gl.drawElementsInstanced(gl.TRIANGLES,b.indices,gl.UNSIGNED_SHORT,0,b.count);this.drawCalls++;
  }
  gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);
 }
 drawLate(){
  if(this.lost)return;const gl=this.gl,active=[...this.batches.values()].filter(b=>b.count);if(!active.length)return;
  for(const b of active){gl.bindBuffer(gl.ARRAY_BUFFER,b.instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,b.data.subarray(0,b.count*21));}
  gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.uniform1f(this.uniforms.sceneTime,this.reducedCrowdMotion?0:(this.sceneTime||0));gl.uniformMatrix4fv(this.uniforms.vp,false,this.vp);gl.uniformMatrix4fv(this.uniforms.lightVP,false,this.lightVP);gl.uniform3fv(this.uniforms.eye,this.eye);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadowAvailable?this.shadowTexture:this.neutralShadow);gl.uniform1i(this.uniforms.shadowMap,1);gl.uniform1i(this.uniforms.useShadow,this.shadowAvailable?1:0);gl.uniform1f(this.uniforms.shadowTexel,this.shadowSize?1/this.shadowSize:1);
  active.sort((a,b)=>Number(a.blend)-Number(b.blend));for(const b of active){if(b.blend){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,b.texture.endsWith('-glow')?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false)}else{gl.disable(gl.BLEND);gl.depthMask(true)}gl.bindVertexArray(b.vao);gl.uniform1i(this.uniforms.textured,b.texture?1:0);gl.uniform1i(this.uniforms.unlit,b.unlit?1:0);gl.uniform1i(this.uniforms.material,b.material);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,b.texture?this.textures.get(b.texture):this.neutralShadow);gl.uniform1i(this.uniforms.image,0);gl.drawElementsInstanced(gl.TRIANGLES,b.indices,gl.UNSIGNED_SHORT,0,b.count);this.drawCalls++;}
  gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);
 }
}
