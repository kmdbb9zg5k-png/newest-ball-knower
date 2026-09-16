import{identity,mul,translate,scale,rx,ry,rz}from'./renderer.js';

const ASSET='/play-moment-3d/assets/meshy-gridiron-gold.glb';
const MAX_BONES=32;
const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const CTORS={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const BYTES={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Meshy exports generic UUIDs for custom motions. Their stable export order is
// kept here beside the asset so gameplay states remain explicit and reviewable.
export const MESHY_CLIPS=Object.freeze({
 run:0,walk:1,sprint:2,tackle:3,block:4,idle:5,idleAlt:6,throw:7,catch:8,celebrate:9,rest:10,
});

// Keep pre-snap feet planted. The generated idle clips contain a large leg
// flourish later in their loops, so each position uses a reviewed football
// frame instead of marching through the same full-body loop in sync.
export const PRE_SNAP_ROLE_POSES=Object.freeze({
 QB:Object.freeze({clip:MESHY_CLIPS.idle,time:.04}),
 RB:Object.freeze({clip:MESHY_CLIPS.idle,time:.18}),
 WR:Object.freeze({clip:MESHY_CLIPS.idleAlt,time:.06}),
 TE:Object.freeze({clip:MESHY_CLIPS.idleAlt,time:.20}),
 OL:Object.freeze({clip:MESHY_CLIPS.block,time:.04}),
 DL:Object.freeze({clip:MESHY_CLIPS.block,time:.22}),
 LB:Object.freeze({clip:MESHY_CLIPS.idleAlt,time:.32}),
 DB:Object.freeze({clip:MESHY_CLIPS.idleAlt,time:.44}),
});
export function preSnapPoseForRole(role,index=0){const pose=PRE_SNAP_ROLE_POSES[role]||PRE_SNAP_ROLE_POSES.LB;return{clip:pose.clip,time:pose.time+(index%3)*.012}}
export function meshyPlaybackSeed(index=0,team=0){return{rate:.91+((index*5+(team ? 3 : 0))%7)*.027,offset:(index*.437+(team ? .271 : 0))%1}}

function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message)}return shader}
function makeProgram(gl,vs,fs){const program=gl.createProgram(),vert=compile(gl,gl.VERTEX_SHADER,vs),frag=compile(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);gl.deleteShader(vert);gl.deleteShader(frag);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error(message)}return program}

function quatMatrix(q){
 const[x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
 return new Float32Array([1-(yy+zz),xy+wz,xz-wy,0,xy-wz,1-(xx+zz),yz+wx,0,xz+wy,yz-wx,1-(xx+yy),0,0,0,0,1]);
}
function quatMul(a,b){return[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]}
function axisQuat(x,y,z,angle){const h=angle*.5,s=Math.sin(h);return[x*s,y*s,z*s,Math.cos(h)]}
function compose(t,q,s){const m=quatMatrix(q);m[0]*=s[0];m[1]*=s[0];m[2]*=s[0];m[4]*=s[1];m[5]*=s[1];m[6]*=s[1];m[8]*=s[2];m[9]*=s[2];m[10]*=s[2];m[12]=t[0];m[13]=t[1];m[14]=t[2];return m}
function slerp(a,b,t){let cos=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3],bb=b;if(cos<0){cos=-cos;bb=b.map(v=>-v)}if(cos>.9995){const out=a.map((v,i)=>v+(bb[i]-v)*t),l=Math.hypot(...out)||1;return out.map(v=>v/l)}const angle=Math.acos(clamp(cos,-1,1)),sin=Math.sin(angle),u=Math.sin((1-t)*angle)/sin,v=Math.sin(t*angle)/sin;return a.map((n,i)=>n*u+bb[i]*v)}
function lerpArray(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t)}

function parseGLB(buffer){
 const view=new DataView(buffer);if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw new Error('Unsupported Meshy GLB');
 let offset=12,json=null,bin=null;
 while(offset<buffer.byteLength){const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true),start=offset+8;if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,start,length)).replace(/\0+$/,''));if(type===0x004e4942)bin=buffer.slice(start,start+length);offset=start+length}
 if(!json||!bin)throw new Error('Meshy GLB is missing JSON or binary data');
 const accessor=index=>{
  const a=json.accessors[index],v=json.bufferViews[a.bufferView],Ctor=CTORS[a.componentType],components=COMPONENTS[a.type],elementBytes=components*BYTES[a.componentType],stride=v.byteStride||elementBytes,start=(v.byteOffset||0)+(a.byteOffset||0);
  if(!Ctor||!components)throw new Error('Unsupported GLB accessor');
  if(stride===elementBytes&&start%BYTES[a.componentType]===0)return new Ctor(bin,start,a.count*components);
  const out=new Ctor(a.count*components),data=new DataView(bin),read={5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a.componentType];
  for(let i=0;i<a.count;i++)for(let c=0;c<components;c++)out[i*components+c]=data[read](start+i*stride+c*BYTES[a.componentType],true);return out;
 };
 return{json,bin,accessor};
}

async function bitmapFor(model,textureIndex){const texture=model.json.textures[textureIndex],image=model.json.images[texture.source],view=model.json.bufferViews[image.bufferView],bytes=new Uint8Array(model.bin,view.byteOffset||0,view.byteLength),blob=new Blob([bytes],{type:image.mimeType||'image/jpeg'});return createImageBitmap(blob)}
function uploadTexture(gl,image,srgb=false){const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_2D);return texture}

const vertex=`#version 300 es
precision highp float;precision highp int;
layout(location=0)in vec3 position;layout(location=1)in vec3 normalIn;layout(location=2)in vec2 uvIn;
layout(location=3)in uvec4 joints;layout(location=4)in vec4 weights;layout(location=5)in vec4 tangentIn;
uniform mat4 vp;uniform mat4 model;uniform mat4 bones[${MAX_BONES}];
out vec3 world;out vec3 normal;out vec3 tangent;out float handedness;out vec2 uv;out vec3 bindPosition;
void main(){mat4 skin=weights.x*bones[joints.x]+weights.y*bones[joints.y]+weights.z*bones[joints.z]+weights.w*bones[joints.w];vec4 local=skin*vec4(position,1.);vec4 w=model*local;mat3 basis=mat3(model)*mat3(skin);world=w.xyz;normal=normalize(basis*normalIn);tangent=normalize(basis*tangentIn.xyz);handedness=tangentIn.w;uv=uvIn;bindPosition=position;gl_Position=vp*w;}`;
const fragment=`#version 300 es
precision highp float;
in vec3 world;in vec3 normal;in vec3 tangent;in float handedness;in vec2 uv;in vec3 bindPosition;
uniform vec3 eye;uniform sampler2D baseMap;uniform sampler2D normalMap;uniform sampler2D ormMap;uniform float rival;
out vec4 color;
vec3 film(vec3 v){return clamp((v*(2.51*v+.03))/(v*(2.43*v+.59)+.14),0.,1.);}
void main(){vec4 sampleColor=texture(baseMap,uv);if(sampleColor.a<.04)discard;vec3 albedo=pow(sampleColor.rgb,vec3(2.2));
 float navy=smoothstep(.025,.14,sampleColor.b-sampleColor.r)*smoothstep(.02,.12,sampleColor.b-sampleColor.g);
 vec3 away=mix(vec3(.74,.78,.79),vec3(.97,.98,.95),clamp(dot(sampleColor.rgb,vec3(.333)),0.,1.));albedo=mix(albedo,pow(away,vec3(2.2)),navy*rival*.94);
 vec3 N=normalize(normal),T=normalize(tangent-N*dot(N,tangent)),B=normalize(cross(N,T))*handedness;vec3 mapped=texture(normalMap,uv).xyz*2.-1.;N=normalize(mat3(T,B,N)*mapped);
 vec3 V=normalize(eye-world),L0=normalize(vec3(-.48,.82,-.31)),L1=normalize(vec3(.62,.69,.38)),L2=normalize(vec3(-.20,.72,.65));float d0=max(dot(N,L0),0.),d1=max(dot(N,L1),0.),d2=max(dot(N,L2),0.);vec3 ambient=mix(vec3(.075,.09,.105),vec3(.20,.25,.34),N.y*.5+.5);vec3 lit=ambient+vec3(1.52,1.43,1.24)*d0+vec3(.38,.50,.72)*d1+vec3(.20,.24,.33)*d2;
 vec3 orm=texture(ormMap,uv).rgb;float rough=clamp(orm.g,.18,.96),metal=orm.b;vec3 H=normalize(L0+V),F0=mix(vec3(.028),albedo,metal),fresnel=F0+(1.-F0)*pow(1.-max(dot(N,V),0.),5.);float spec=pow(max(dot(N,H),0.),mix(90.,10.,rough));vec3 rgb=albedo*lit+fresnel*spec*(.35+1.35*(1.-rough));float fog=smoothstep(55.,190.,distance(eye,world));rgb=mix(rgb,vec3(.016,.026,.046),fog*.68);color=vec4(pow(film(rgb*1.08),vec3(1./2.2)),1.);}`;

export class MeshyAthletes{
 constructor(renderer){this.renderer=renderer;this.gl=renderer.gl;this.ready=false;this.error='';this.triangles=0;this.clipNames=[];this.loadPromise=this.load()}
 async load(){
  try{
   const url=globalThis.BK_MESHY_GLTF_URL||ASSET,response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw new Error('Meshy player '+response.status);
   const parsed=parseGLB(await response.arrayBuffer()),{json,accessor}=parsed,gl=this.gl,primitive=json.meshes[0].primitives[0];this.parsed=parsed;
   this.program=makeProgram(gl,vertex,fragment);this.uniforms=Object.fromEntries(['vp','model','bones','eye','baseMap','normalMap','ormMap','rival'].map(name=>[name,gl.getUniformLocation(this.program,name==='bones'?'bones[0]':name)]));
   this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
   const attribute=(location,name,size,integer=false)=>{const index=primitive.attributes[name],a=json.accessors[index],data=accessor(index),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);if(integer)gl.vertexAttribIPointer(location,size,a.componentType,0,0);else gl.vertexAttribPointer(location,size,a.componentType,Boolean(a.normalized),0,0)};
   attribute(0,'POSITION',3);attribute(1,'NORMAL',3);attribute(2,'TEXCOORD_0',2);attribute(3,'JOINTS_0',4,true);attribute(4,'WEIGHTS_0',4);attribute(5,'TANGENT',4);
   const indexAccessor=json.accessors[primitive.indices],indices=accessor(primitive.indices);this.indexType=indexAccessor.componentType;this.indexCount=indexAccessor.count;this.triangles=this.indexCount/3;this.indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);
   const material=json.materials[primitive.material].pbrMetallicRoughness,normalIndex=json.materials[primitive.material].normalTexture.index,[baseImage,normalImage,ormImage]=await Promise.all([bitmapFor(parsed,material.baseColorTexture.index),bitmapFor(parsed,normalIndex),bitmapFor(parsed,material.metallicRoughnessTexture.index)]);this.textures=[uploadTexture(gl,baseImage),uploadTexture(gl,normalImage),uploadTexture(gl,ormImage)];for(const image of[baseImage,normalImage,ormImage])image.close?.();
   this.parents=new Int16Array(json.nodes.length).fill(-1);json.nodes.forEach((node,index)=>(node.children||[]).forEach(child=>{this.parents[child]=index}));this.namedNodes=Object.fromEntries(json.nodes.map((node,index)=>[node.name,index]));
   this.base=json.nodes.map(node=>({t:[...(node.translation||[0,0,0])],r:[...(node.rotation||[0,0,0,1])],s:[...(node.scale||[1,1,1])]}));
   const skin=json.skins[json.nodes.find(node=>Number.isInteger(node.skin)).skin];this.joints=skin.joints;this.inverseBind=accessor(skin.inverseBindMatrices);if(this.joints.length>MAX_BONES)throw new Error('Meshy rig exceeds GPU bone budget');
   this.clips=json.animations.map(animation=>{let duration=0;const channels=animation.channels.map(channel=>{const sampler=animation.samplers[channel.sampler],times=accessor(sampler.input),values=accessor(sampler.output);duration=Math.max(duration,times[times.length-1]||0);return{node:channel.target.node,path:channel.target.path,times,values,size:channel.target.path==='rotation'?4:3}});return{name:animation.name,duration,channels}});this.clipNames=this.clips.map(clip=>clip.name);this.ready=true;
  }catch(error){this.error=String(error?.message||error);console.warn('Detailed Meshy athletes unavailable; using built-in players.',this.error)}
 }
 sampleChannel(channel,time){const{times,values,size}=channel;if(times.length===1)return Array.from(values.subarray(0,size));let low=0,high=times.length-1;while(low+1<high){const mid=(low+high)>>1;if(times[mid]<=time)low=mid;else high=mid}const a=low,b=Math.min(times.length-1,low+1),span=times[b]-times[a],t=span?clamp((time-times[a])/span,0,1):0,left=Array.from(values.subarray(a*size,a*size+size)),right=Array.from(values.subarray(b*size,b*size+size));return channel.path==='rotation'?slerp(left,right,t):lerpArray(left,right,t)}
 choose(p,phase,time){
  if(p.action==='tackle')return[MESHY_CLIPS.tackle,clamp(p.actionT||0,0,1)*this.clips[MESHY_CLIPS.tackle].duration];
  if(p.action==='celebrate')return[MESHY_CLIPS.celebrate,time%this.clips[MESHY_CLIPS.celebrate].duration];
  if(p.throwT>0&&p.role==='QB')return[MESHY_CLIPS.throw,clamp(p.throwT,0,1)*this.clips[MESHY_CLIPS.throw].duration];
  if(p.catchT>0)return[MESHY_CLIPS.catch,clamp(1-p.catchT/.35,0,1)*this.clips[MESHY_CLIPS.catch].duration];
  const seed=meshyPlaybackSeed(p.index,p.team);
  if(p.engaged)return[MESHY_CLIPS.block,(time*seed.rate+seed.offset*this.clips[MESHY_CLIPS.block].duration)%this.clips[MESHY_CLIPS.block].duration];
  if(phase==='pre'){const pose=preSnapPoseForRole(p.role,p.index);return[pose.clip,Math.min(pose.time,this.clips[pose.clip].duration-.001)]}
  const speed=Math.hypot(p.vx||0,p.vz||0),phaseTime=(clip,rate=1)=>(time*seed.rate*rate+seed.offset*this.clips[clip].duration)%this.clips[clip].duration;
  if(phase==='pass'&&p.role==='QB'&&speed>.2)return[MESHY_CLIPS.walk,phaseTime(MESHY_CLIPS.walk,.72)];
  if(phase==='pass'&&p.team&&p.role==='DL'&&speed>.2)return[MESHY_CLIPS.sprint,phaseTime(MESHY_CLIPS.sprint,1.08)];
  if(speed>7.7)return[MESHY_CLIPS.sprint,phaseTime(MESHY_CLIPS.sprint,1.2)];if(speed>2.4)return[MESHY_CLIPS.run,phaseTime(MESHY_CLIPS.run,1.05)];if(speed>.2)return[MESHY_CLIPS.walk,phaseTime(MESHY_CLIPS.walk,.55)];const idle=p.index%2?MESHY_CLIPS.idle:MESHY_CLIPS.idleAlt;return[idle,phaseTime(idle,.72)];
 }
 bonesFor(p,phase,time){
  const[clipIndex,clipTime]=this.choose(p,phase,time),clip=this.clips[clipIndex],locals=this.base.map(node=>({t:[...node.t],r:[...node.r],s:[...node.s]}));
  for(const channel of clip.channels){const value=this.sampleChannel(channel,clipTime);if(channel.path==='translation')locals[channel.node].t=value;else if(channel.path==='rotation')locals[channel.node].r=value;else locals[channel.node].s=value}
  if(phase==='pre'){
   const seed=meshyPlaybackSeed(p.index,p.team),breath=Math.sin(time*(1.25+seed.rate*.22)+seed.offset*Math.PI*2),scan=Math.sin(time*(.38+seed.rate*.08)+seed.offset*Math.PI*2);
   const spine=this.namedNodes['mixamorig:Spine2'],head=this.namedNodes['mixamorig:Head'];
   if(Number.isInteger(spine))locals[spine].r=quatMul(locals[spine].r,axisQuat(1,0,0,breath*.012));
   if(Number.isInteger(head))locals[head].r=quatMul(locals[head].r,axisQuat(0,1,0,scan*((p.role==='QB'||p.role==='LB') ? .09 : .045)));
  }
  // Gameplay owns world locomotion. Keep only the vertical bounce in root motion.
  const hips=this.joints[0];locals[hips].t[0]=this.base[hips].t[0];locals[hips].t[2]=this.base[hips].t[2];
  const world=new Array(locals.length),resolve=index=>world[index]||(world[index]=this.parents[index]<0?compose(locals[index].t,locals[index].r,locals[index].s):mul(resolve(this.parents[index]),compose(locals[index].t,locals[index].r,locals[index].s)));
  const bones=new Float32Array(this.joints.length*16);this.joints.forEach((joint,i)=>bones.set(mul(resolve(joint),this.inverseBind.subarray(i*16,i*16+16)),i*16));return bones;
 }
 modelFor(p){
  const widths={OL:1.12,DL:1.10,QB:.98,RB:1.03,WR:.95,TE:1.05,LB:1.06,DB:.94},width=widths[p.role]||1;
  let lift=0,lean=0,yaw=0;if(p.action==='hurdle')lift=Math.sin((p.actionT||0)*Math.PI)*.46;if(p.action==='truck')lean=.20*Math.sin((p.actionT||0)*Math.PI);if(p.action==='juke')lean=-(p.actionSide||0)*.13*Math.sin((p.actionT||0)*Math.PI);if(p.action==='spin')yaw=(p.actionSide||1)*(p.actionT||0)*Math.PI*2;
  const fall=p.fallen?1.24:0;return mul(translate(p.x,lift+.02,p.z),mul(ry((p.heading||0)+yaw),mul(rx(fall+lean),mul(rz(lean),scale(1.17*width,1.17,1.17)))));
 }
 draw(actors,phase,time){if(!this.ready)return false;const gl=this.gl;gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.uniformMatrix4fv(this.uniforms.vp,false,this.renderer.vp);gl.uniform3fv(this.uniforms.eye,this.renderer.eye);for(let i=0;i<3;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i])}gl.uniform1i(this.uniforms.baseMap,0);gl.uniform1i(this.uniforms.normalMap,1);gl.uniform1i(this.uniforms.ormMap,2);gl.disable(gl.BLEND);gl.depthMask(true);
  for(const p of actors){gl.uniformMatrix4fv(this.uniforms.model,false,this.modelFor(p));gl.uniformMatrix4fv(this.uniforms.bones,false,this.bonesFor(p,phase,time));gl.uniform1f(this.uniforms.rival,p.team?1:0);gl.drawElements(gl.TRIANGLES,this.indexCount,this.indexType,0);this.renderer.drawCalls++}
  gl.bindVertexArray(null);return true;
 }
 diagnostics(){return{ready:this.ready,error:this.error,triangles:this.triangles,clips:this.clipNames.length,bones:this.joints?.length||0,asset:ASSET}}
}

export function createMeshyAthletes(renderer){return new MeshyAthletes(renderer)}
