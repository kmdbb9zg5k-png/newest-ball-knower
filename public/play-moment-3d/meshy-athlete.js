import{identity,mul,translate,scale,rx,ry,rz}from'./renderer.js';

const ASSET='/play-moment-3d/assets/ball-knower-gridiron-pro-v3.glb?v=clean-rig-1';
const MAX_BONES=32;
const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const CTORS={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const BYTES={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};

// The production GLB keeps these clips in a stable, validated export order.
export const MESHY_CLIPS=Object.freeze({
 run:0,walk:1,juke:2,stiffArm:3,tackle:4,block:4,catch:5,throw:5,celebrate:5,sprint:6,idle:7,idleAlt:7,rest:7,
});

/** Advance locomotion by ground covered so a stopped player cannot run in place. */
export function locomotionClipTime(distance,duration,clip,seed=0){
 const cycle=clip===MESHY_CLIPS.walk?2.15:clip===MESHY_CLIPS.sprint?5.4:4.25;
 return ((Math.max(0,distance||0)/cycle+seed)%1)*duration;
}

export function usesGroundedStride(state){return /^(run|sprint|walk|carry-run|carry-sprint|carry-cut|route-release|route-stem|route-cut|qb-scramble|qb-drop|qb-climb|qb-rollout|coverage|coverage-pedal|coverage-break|rush|edge-rush|break-tackle|stumble)$/.test(state)}
/** Same distance phase across run/sprint, with a linear planted half-step. */
export function groundedStride(distance,side=0){
 const cycle=2.45,phase=((Math.max(0,distance||0)/cycle+side)%1+1)%1,stance=.53,reach=cycle*stance/(2*1.17);
 if(phase<stance)return{z:reach*(1-2*phase/stance),lift:0,planted:true};
 const t=(phase-stance)/(1-stance);return{z:reach*(-1+2*smooth(t)),lift:Math.sin(t*Math.PI)*.30,planted:false};
}
// The source GLB contains eight full-body clips. These recipes turn that
// compact mobile asset into a football motion graph by layering low-weight
// secondary clips over the most appropriate base clip. Gameplay coordinates
// still own movement; these layers only change the rendered skeleton.
const motion=(base,overlay=null,overlayWeight=0,rate=1)=>Object.freeze({base,overlay,overlayWeight,rate});
// First motion-authenticity pilot. These states intentionally receive a
// football-authored lower/upper-body pass below instead of relying on a
// differently timed copy of the generic full-body source motion.
export const AUTHENTICITY_PILOT_STATES=Object.freeze(['pass-set','drive-block','edge-rush','carry-cut','wrap-tackle']);
export const FOOTBALL_MOTION_FAMILIES=Object.freeze({
 quarterback:Object.freeze(['qb-pocket','qb-drop','qb-climb','qb-rollout','qb-scramble','throw-bullet','throw-touch','throw-lob','throw-away']),
 ballCarrier:Object.freeze(['carry-run','carry-sprint','carry-cut','carry-juke','carry-spin','carry-truck','carry-stiff-arm','carry-hurdle','qb-slide']),
 receiver:Object.freeze(['route-release','route-stem','route-cut','catch-rac','catch-secure','catch-aggressive']),
 trenches:Object.freeze(['pass-set','pass-anchor','drive-block','reach-block','climb-block','stalk-block','rush-engaged','bull-rush','rush-rip','rush-swim','shed']),
 contact:Object.freeze(['wrap-tackle','gang-tackle','dive-tackle','big-hit','break-tackle','miss','stumble']),
});
export const FOOTBALL_MOTION_RECIPES=Object.freeze({
 'qb-pocket':motion(MESHY_CLIPS.idle,MESHY_CLIPS.throw,.08,.64),
 'qb-drop':motion(MESHY_CLIPS.walk,MESHY_CLIPS.throw,.10,.68),
 'qb-climb':motion(MESHY_CLIPS.run,MESHY_CLIPS.throw,.12,.78),
 'qb-rollout':motion(MESHY_CLIPS.run,MESHY_CLIPS.throw,.14,.94),
 'qb-scramble':motion(MESHY_CLIPS.run,MESHY_CLIPS.throw,.08,1.02),
 'throw-bullet':motion(MESHY_CLIPS.throw,MESHY_CLIPS.run,.04,1.20),
 'throw-touch':motion(MESHY_CLIPS.throw,MESHY_CLIPS.idleAlt,.08,.96),
 'throw-lob':motion(MESHY_CLIPS.throw,MESHY_CLIPS.catch,.10,.82),
 'throw-away':motion(MESHY_CLIPS.throw,MESHY_CLIPS.sprint,.08,1.08),
 handoff:motion(MESHY_CLIPS.idle,MESHY_CLIPS.catch,.22,.92),
 'receive-handoff':motion(MESHY_CLIPS.run,MESHY_CLIPS.catch,.18,.78),
 'route-release':motion(MESHY_CLIPS.sprint,MESHY_CLIPS.run,.16,1.05),
 'route-stem':motion(MESHY_CLIPS.run,MESHY_CLIPS.sprint,.10,1.02),
 'route-cut':motion(MESHY_CLIPS.run,MESHY_CLIPS.block,.08,.92),
 'carry-run':motion(MESHY_CLIPS.run,MESHY_CLIPS.block,.12,1.02),
 'carry-sprint':motion(MESHY_CLIPS.sprint,null,0,1.12),
 'carry-cut':motion(MESHY_CLIPS.juke,MESHY_CLIPS.run,.10,.92),
 'carry-juke':motion(MESHY_CLIPS.juke,MESHY_CLIPS.run,.08,.88),
 'carry-spin':motion(MESHY_CLIPS.run,MESHY_CLIPS.idleAlt,.18,1.18),
 'carry-truck':motion(MESHY_CLIPS.block,MESHY_CLIPS.sprint,.18,1.04),
 'carry-stiff-arm':motion(MESHY_CLIPS.stiffArm,MESHY_CLIPS.run,.08,.98),
 'carry-hurdle':motion(MESHY_CLIPS.sprint,MESHY_CLIPS.tackle,.10,.92),
 'qb-slide':motion(MESHY_CLIPS.tackle,MESHY_CLIPS.run,.12,.72),
 'pass-set':motion(MESHY_CLIPS.block,MESHY_CLIPS.walk,.12,.90),
 'pass-anchor':motion(MESHY_CLIPS.block,MESHY_CLIPS.idle,.16,.82),
 'drive-block':motion(MESHY_CLIPS.block,MESHY_CLIPS.run,.18,1.08),
 'reach-block':motion(MESHY_CLIPS.block,MESHY_CLIPS.run,.22,.96),
 'climb-block':motion(MESHY_CLIPS.run,MESHY_CLIPS.block,.24,.92),
 'stalk-block':motion(MESHY_CLIPS.block,MESHY_CLIPS.walk,.18,.80),
 'rush-engaged':motion(MESHY_CLIPS.block,MESHY_CLIPS.tackle,.13,1.04),
 shed:motion(MESHY_CLIPS.block,MESHY_CLIPS.tackle,.18,1.08),
 'bull-rush':motion(MESHY_CLIPS.block,MESHY_CLIPS.sprint,.14,1.06),
 'edge-rush':motion(MESHY_CLIPS.sprint,MESHY_CLIPS.tackle,.11,1.16),
 'rush-rip':motion(MESHY_CLIPS.sprint,MESHY_CLIPS.block,.17,1.12),
 'rush-swim':motion(MESHY_CLIPS.sprint,MESHY_CLIPS.tackle,.15,1.08),
 rush:motion(MESHY_CLIPS.sprint,MESHY_CLIPS.tackle,.07,1.12),
 coverage:motion(MESHY_CLIPS.walk,MESHY_CLIPS.idleAlt,.16,.82),
 'coverage-pedal':motion(MESHY_CLIPS.walk,MESHY_CLIPS.block,.10,.70),
 'coverage-break':motion(MESHY_CLIPS.run,MESHY_CLIPS.tackle,.08,.94),
 stumble:motion(MESHY_CLIPS.walk,MESHY_CLIPS.tackle,.16,.68),
});
export function motionRecipeForState(state){return FOOTBALL_MOTION_RECIPES[state]||null}

// The source clips are shared, but each position gets its own cadence and root
// restraint. This avoids eleven players marching through the same leg cycle
// while keeping the single mobile-friendly rig and texture set.
export const ROLE_MOTION_PROFILES=Object.freeze({
 QB:Object.freeze({cadence:.96,root:.34,lean:.035,arm:.045}),
 RB:Object.freeze({cadence:1.06,root:.72,lean:.105,arm:.080}),
 WR:Object.freeze({cadence:1.09,root:.80,lean:.12,arm:.095}),
 TE:Object.freeze({cadence:.99,root:.58,lean:.10,arm:.065}),
 OL:Object.freeze({cadence:.90,root:.20,lean:.16,arm:.035}),
 DL:Object.freeze({cadence:.95,root:.26,lean:.18,arm:.050}),
 LB:Object.freeze({cadence:1.01,root:.52,lean:.13,arm:.070}),
 DB:Object.freeze({cadence:1.08,root:.74,lean:.115,arm:.088}),
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
// Small additive rotations turn the reviewed Meshy frames into recognizable
// football stances while preserving planted feet. Values are intentionally
// restrained because the source clips already contain natural joint motion.
export const ROLE_STANCE_PROFILES=Object.freeze({
 QB:Object.freeze({crouch:.055,lean:.035,knees:.10,elbows:.12,stagger:0}),
 RB:Object.freeze({crouch:.115,lean:.11,knees:.17,elbows:.22,stagger:.04}),
 WR:Object.freeze({crouch:.075,lean:.12,knees:.12,elbows:.13,stagger:.09}),
 TE:Object.freeze({crouch:.095,lean:.13,knees:.14,elbows:.17,stagger:.06}),
 OL:Object.freeze({crouch:.205,lean:.38,knees:.25,elbows:.31,stagger:.02}),
 DL:Object.freeze({crouch:.225,lean:.44,knees:.27,elbows:.34,stagger:.12}),
 LB:Object.freeze({crouch:.13,lean:.15,knees:.18,elbows:.18,stagger:.07}),
 DB:Object.freeze({crouch:.10,lean:.13,knees:.15,elbows:.12,stagger:.10}),
});
export function preSnapPoseForRole(role,index=0){const pose=PRE_SNAP_ROLE_POSES[role]||PRE_SNAP_ROLE_POSES.LB;return{clip:pose.clip,time:pose.time+(index%3)*.012}}
export function meshyPlaybackSeed(index=0,team=0){return{rate:.91+((index*5+(team ? 3 : 0))%7)*.027,offset:(index*.437+(team ? .271 : 0))%1}}
export function meshyAnimationState(p,phase){
 if(p.action==='snap')return'snap';
 if(p.action==='receive-snap')return'receive-snap';
 if(p.action==='celebrate')return'celebrate';
 if(p.action==='handoff')return'handoff';
 if(p.action==='receive-handoff')return'receive-handoff';
 if(p.action==='cut')return'carry-cut';
 if(p.action==='juke')return'carry-juke';
 if(p.action==='spin')return'carry-spin';
 if(p.action==='truck')return'carry-truck';
 if(p.action==='stiff-arm')return'carry-stiff-arm';
 if(p.action==='hurdle')return'carry-hurdle';
 if(p.action==='slide')return'qb-slide';
 if(p.action==='dive')return'dive-tackle';
 if(p.action==='big-hit')return'big-hit';
 if(p.action==='gang')return'gang-tackle';
 if(p.action==='wrap')return'wrap-tackle';
 if(p.action==='tackle')return'tackle';
 if(p.action==='break-tackle')return'break-tackle';
 if(p.action==='miss')return'miss';
 if(p.action==='stumble')return'stumble';
 if(p.action==='pancake')return'pancake';
 if(p.action==='get-up')return'get-up';
 if(p.fallen)return'tackle';
 if(p.throwT>0&&p.role==='QB')return'throw-'+(p.throwStyle||'bullet');
 if(p.catchT>0)return'catch-'+(p.catchStyle||'rac');
 if(p.engaged){
  const runPhase=phase==='handoff'||phase==='run';
  if(!runPhase)return p.team?(p.blockStyle==='rush-rip'?'rush-rip':p.blockStyle==='rush-swim'?'rush-swim':p.blockStyle==='bull-rush'?'bull-rush':'rush-engaged'):(p.blockStyle==='pass-anchor'?'pass-anchor':'pass-set');
  if(p.team)return'shed';
  if(p.blockStyle==='stalk')return'stalk-block';
  if(p.blockStyle==='reach')return'reach-block';
  if(p.blockStyle==='climb')return'climb-block';
  return'drive-block';
 }
 if(phase==='pre')return'pre';
 // Once a play is dead, residual settling velocity must not keep upright
 // players in a walk cycle or return them to the source clip's T-pose.
 if(phase==='dead'&&!p.action&&!p.fallen)return Math.hypot(p.vx||0,p.vz||0)>.3?'walk':'idle';
 const speed=Math.hypot(p.vx||0,p.vz||0);
 if(phase==='pass'&&p.role==='QB'){
  if(speed<=.2)return'qb-pocket';
  if((p.vz||0)>Math.abs(p.vx||0)*.72)return'qb-climb';
  if(Math.abs(p.x||0)>5.5||Math.abs(p.vx||0)>Math.abs(p.vz||0)*.72)return'qb-rollout';
  return'qb-drop';
 }
 if((phase==='pass'||phase==='flight')&&!p.team&&['WR','TE','RB'].includes(p.role)&&speed>.2)return p.routeStyle==='release'?'route-release':p.routeStyle==='cut'||Math.abs(p.motion?.turn||0)>1.05?'route-cut':'route-stem';
 if((phase==='pass'||phase==='flight')&&p.team&&['LB','DB'].includes(p.role)&&speed>.2&&speed<7.7)return p.coverageStyle==='pedal'?'coverage-pedal':p.coverageStyle==='break'?'coverage-break':'coverage';
 if((phase==='pass'||phase==='flight')&&p.team&&p.role==='DL'&&speed>.2)return Math.abs(p.x||0)>4?'edge-rush':'rush';
 if(phase==='run'&&p.hasBall&&p.role==='QB'&&speed>.2)return'qb-scramble';
 if(phase==='run'&&p.hasBall&&Math.abs(p.motion?.turn||0)>1.12)return'carry-cut';
 if(phase==='run'&&p.hasBall&&p.sprinting)return'carry-sprint';
 if(phase==='run'&&p.hasBall&&speed>.2)return'carry-run';
 if(speed>7.7)return'sprint';if(speed>2.4)return'run';if(speed>.2)return'walk';return'idle';
}

export function meshyTransitionRate(fromState,toState){
 if(!fromState||fromState===toState)return 15;
 if(/tackle|hit|miss|break|slide|dive/.test(toState))return 30;
 if(/juke|spin|truck|stiff|hurdle/.test(toState))return 27;
 if(/catch|throw|handoff/.test(toState))return 23;
 if(/rush/.test(toState)&&/block|shed|rush-swim|rush-rip|bull-rush/.test(fromState))return 26;
 if(/block|set|shed|rush/.test(toState))return 17;
 return 11;
}

export function authenticityPilotPhase(state,p,time){
 const seed=meshyPlaybackSeed(p.index,p.team),gait=Number.isFinite(p.motion?.gait)?p.motion.gait:time*5.4;
 if(state==='wrap-tackle')return clamp(p.actionT||0,0,1);
 if(state==='carry-cut')return clamp(Math.abs(p.motion?.turn||0)/4,0,1);
 if(state==='pass-set')return((time*(2.75+seed.rate*.28)+seed.offset*Math.PI*2)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
 if(state==='drive-block')return((time*(5.9+seed.rate*.55)+seed.offset*Math.PI*2)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
 if(state==='edge-rush')return((gait+seed.offset*Math.PI*2)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
 return 0;
}

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
function pointFromMatrix(matrix,point=[0,0,0]){const[x,y,z]=point;return[matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]]}

export function athleteSupportVertices(positions,joints,weights){
 const extremes=new Map();
 for(let i=0;i<positions.length/3;i++){
  const js=Array.from(joints.subarray(i*4,i*4+4)),ws=Array.from(weights.subarray(i*4,i*4+4)),joint=js[ws.indexOf(Math.max(...ws))],p=Array.from(positions.subarray(i*3,i*3+3));
  for(let axis=0;axis<3;axis++)for(const sign of[-1,1]){const key=joint+':'+axis+':'+sign,old=extremes.get(key);if(!old||p[axis]*sign>old.p[axis]*sign)extremes.set(key,{index:i,p,j:js,w:ws})}
 }
 return[...new Map([...extremes.values()].map(v=>[v.index,v])).values()];
}
export function skinSupportVertices(vertices,bones){return vertices.map(v=>{const out=[0,0,0];for(let c=0;c<4;c++){if(!v.w[c])continue;const o=v.j[c]*16;for(let axis=0;axis<3;axis++)out[axis]+=(bones[o+axis]*v.p[0]+bones[o+4+axis]*v.p[1]+bones[o+8+axis]*v.p[2]+bones[o+12+axis])*v.w[c]}return out})}

function directionQuat(from,to){
 const a=from.map(v=>v/(Math.hypot(...from)||1)),b=to.map(v=>v/(Math.hypot(...to)||1)),dot=clamp(a.reduce((sum,v,i)=>sum+v*b[i],0),-1,1);
 if(dot<-.9999){const axis=Math.abs(a[0])<.9?[0,a[2],-a[1]]:[-a[2],0,a[0]],length=Math.hypot(...axis)||1;return axisQuat(...axis.map(v=>v/length),Math.PI)}
 const q=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0],1+dot],length=Math.hypot(...q)||1;return q.map(v=>v/length);
}
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);

export function parseGLB(buffer){
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
out vec3 world;out vec3 normal;out vec3 tangent;out float handedness;out vec2 uv;out vec3 bindPosition;out vec3 bindNormal;
void main(){mat4 skin=weights.x*bones[joints.x]+weights.y*bones[joints.y]+weights.z*bones[joints.z]+weights.w*bones[joints.w];vec4 local=skin*vec4(position,1.);vec4 w=model*local;mat3 basis=mat3(model)*mat3(skin);world=w.xyz;normal=normalize(basis*normalIn);tangent=normalize(basis*tangentIn.xyz);handedness=tangentIn.w;uv=uvIn;bindPosition=position;bindNormal=normalIn;gl_Position=vp*w;}`;
const fragment=`#version 300 es
precision highp float;
in vec3 world;in vec3 normal;in vec3 tangent;in float handedness;in vec2 uv;in vec3 bindPosition;in vec3 bindNormal;
uniform vec3 eye;uniform sampler2D baseMap;uniform sampler2D normalMap;uniform sampler2D ormMap;uniform sampler2D numberMap;uniform float rival;uniform float controlled;uniform float playerSeed;
out vec4 color;
vec3 film(vec3 v){return clamp((v*(2.51*v+.03))/(v*(2.43*v+.59)+.14),0.,1.);}
void main(){vec4 sampleColor=texture(baseMap,uv);if(sampleColor.a<.04)discard;vec3 albedo=pow(sampleColor.rgb,vec3(2.2));
 float navy=smoothstep(.025,.14,sampleColor.b-sampleColor.r)*smoothstep(.02,.12,sampleColor.b-sampleColor.g);
 float gold=smoothstep(.03,.18,sampleColor.r-sampleColor.b)*smoothstep(.015,.10,sampleColor.g-sampleColor.b)*(1.-smoothstep(.12,.28,sampleColor.r-sampleColor.g));vec3 away=mix(vec3(.72,.76,.77),vec3(.98,.985,.96),clamp(dot(sampleColor.rgb,vec3(.333)),0.,1.));albedo=mix(albedo,pow(away,vec3(2.2)),navy*rival*.94);albedo=mix(albedo,pow(vec3(.48,.075,.055),vec3(2.2)),gold*rival*.82);albedo*=mix(.955,1.045,playerSeed);
 // Give the away helmet a painted shell rather than the skin-like copper tint.
 float shell=smoothstep(1.47,1.55,bindPosition.y)*(1.-smoothstep(.12,.22,bindPosition.z))*rival;
 albedo=mix(albedo,pow(vec3(.34,.035,.045),vec3(2.2)),shell*.92);
 // Meshy may bake arbitrary lettering into generated uniforms. Preserve the
 // high-resolution weave/normal response but own the torso and pants colors in
 // shader so the only visible roster number is Ball Knower's live print.
 float torso=smoothstep(.63,.78,bindPosition.y)*(1.-smoothstep(1.34,1.49,bindPosition.y))*(1.-smoothstep(.31,.46,abs(bindPosition.x)));
 float pants=smoothstep(.25,.38,bindPosition.y)*(1.-smoothstep(.76,.93,bindPosition.y))*(1.-smoothstep(.42,.58,abs(bindPosition.x)));
 float uniformZone=clamp(max(torso,pants),0.,1.);float clothValue=mix(.82,1.08,clamp(dot(sampleColor.rgb,vec3(.333)),0.,1.));
 vec3 jerseyColor=mix(vec3(.045,.105,.17),vec3(.83,.85,.84),rival),pantsColor=mix(vec3(.023,.040,.064),vec3(.64,.69,.72),rival);
 vec3 cleanUniform=mix(jerseyColor,pantsColor,pants*(1.-torso))*clothValue;
 albedo=mix(albedo,pow(cleanUniform,vec3(2.2)),uniformZone*.97);albedo*=mix(.955,1.045,playerSeed);
 // Project the ink onto the bind-pose jersey, before skeletal deformation.
 // Front/back get readable orientation; sidewalls, sleeves and pants are masked.
 float face=bindNormal.z>=0.?1.:-1.;
 vec2 numberUV=vec2(bindPosition.x*face/.34+.5,(1.22-bindPosition.y)/.36+.5);
 float printMask=step(0.,numberUV.x)*step(numberUV.x,1.)*step(0.,numberUV.y)*step(numberUV.y,1.)*smoothstep(.35,.65,abs(bindNormal.z))*torso;
 vec4 ink=texture(numberMap,clamp(numberUV,0.,1.));
 albedo=mix(albedo,pow(ink.rgb,vec3(2.2)),ink.a*printMask);

 vec3 N=normalize(normal),T=normalize(tangent-N*dot(N,tangent)),B=normalize(cross(N,T))*handedness;vec3 mapped=texture(normalMap,uv).xyz*2.-1.;mapped.xy*=mix(1.,.68,uniformZone);N=normalize(mat3(T,B,N)*mapped);
 vec3 V=normalize(eye-world),L0=normalize(vec3(-.48,.82,-.31)),L1=normalize(vec3(.62,.69,.38)),L2=normalize(vec3(-.20,.72,.65));float d0=max(dot(N,L0),0.),d1=max(dot(N,L1),0.),d2=max(dot(N,L2),0.);vec3 ambient=mix(vec3(.075,.09,.105),vec3(.20,.25,.34),N.y*.5+.5);vec3 lit=ambient+vec3(1.52,1.43,1.24)*d0+vec3(.38,.50,.72)*d1+vec3(.20,.24,.33)*d2;
 vec3 orm=texture(ormMap,uv).rgb;float rough=clamp(orm.g,.18,.96),metal=orm.b*(1.-uniformZone);rough=mix(rough,max(rough,.82),uniformZone);vec3 H=normalize(L0+V),F0=mix(vec3(.028),albedo,metal),fresnel=F0+(1.-F0)*pow(1.-max(dot(N,V),0.),5.);float spec=pow(max(dot(N,H),0.),mix(90.,10.,rough)),rim=pow(1.-max(dot(N,V),0.),2.6);vec3 rimColor=mix(vec3(.22,.31,.42),vec3(.42,.18,.14),rival);vec3 rgb=albedo*lit+fresnel*spec*(.35+1.35*(1.-rough))+rimColor*rim*(.105+controlled*.11);float heroRim=pow(1.-max(dot(N,V),0.),4.2)*controlled;rgb+=vec3(.46,.31,.09)*heroRim;float fog=smoothstep(55.,190.,distance(eye,world));rgb=mix(rgb,vec3(.016,.026,.046),fog*.68);color=vec4(pow(film(rgb*1.08),vec3(1./2.2)),1.);}`;

const depthVertex=`#version 300 es
precision highp float;precision highp int;
layout(location=0)in vec3 position;layout(location=3)in uvec4 joints;layout(location=4)in vec4 weights;
uniform mat4 lightVP;uniform mat4 model;uniform mat4 bones[${MAX_BONES}];
void main(){mat4 skin=weights.x*bones[joints.x]+weights.y*bones[joints.y]+weights.z*bones[joints.z]+weights.w*bones[joints.w];gl_Position=lightVP*model*skin*vec4(position,1.);}`;
const depthFragment=`#version 300 es
precision highp float;void main(){}`;

export class MeshyAthletes{
 constructor(renderer){this.renderer=renderer;this.gl=renderer.gl;this.ready=false;this.error='';this.triangles=0;this.clipNames=[];this.lastStates=[];this.poseStates=new Map();this.handTransforms=new Map();this.supportPoints=new Map();this.frameBones=null;this.loadPromise=this.load()}
 async load(){
  try{
   const url=globalThis.BK_MESHY_GLTF_URL||ASSET,response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw new Error('Detailed player '+response.status);
   const parsed=parseGLB(await response.arrayBuffer()),{json,accessor}=parsed,gl=this.gl,primitive=json.meshes[0].primitives[0];
   this.program=makeProgram(gl,vertex,fragment);this.depthProgram=makeProgram(gl,depthVertex,depthFragment);this.uniforms=Object.fromEntries(['vp','model','bones','eye','baseMap','normalMap','ormMap','numberMap','rival','controlled','playerSeed'].map(name=>[name,gl.getUniformLocation(this.program,name==='bones'?'bones[0]':name)]));this.depthUniforms=Object.fromEntries(['lightVP','model','bones'].map(name=>[name,gl.getUniformLocation(this.depthProgram,name==='bones'?'bones[0]':name)]));
   this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
   const attribute=(location,name,size,integer=false)=>{const index=primitive.attributes[name],a=json.accessors[index],data=accessor(index),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);if(integer)gl.vertexAttribIPointer(location,size,a.componentType,0,0);else gl.vertexAttribPointer(location,size,a.componentType,Boolean(a.normalized),0,0)};
   attribute(0,'POSITION',3);attribute(1,'NORMAL',3);attribute(2,'TEXCOORD_0',2);attribute(3,'JOINTS_0',4,true);attribute(4,'WEIGHTS_0',4);attribute(5,'TANGENT',4);
   this.supportVertices=athleteSupportVertices(accessor(primitive.attributes.POSITION),accessor(primitive.attributes.JOINTS_0),accessor(primitive.attributes.WEIGHTS_0));
   const indexAccessor=json.accessors[primitive.indices],indices=accessor(primitive.indices);this.indexType=indexAccessor.componentType;this.indexCount=indexAccessor.count;this.triangles=this.indexCount/3;this.indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);
   const material=json.materials[primitive.material].pbrMetallicRoughness,normalIndex=json.materials[primitive.material].normalTexture.index;this.textures=[];
   // Decode/upload/close one 2K map at a time to bound mobile startup memory.
   for(const index of[material.baseColorTexture.index,normalIndex,material.metallicRoughnessTexture.index]){const bitmap=await bitmapFor(parsed,index);try{this.textures.push(uploadTexture(gl,bitmap))}finally{bitmap.close?.()}}
   this.parents=new Int16Array(json.nodes.length).fill(-1);json.nodes.forEach((node,index)=>(node.children||[]).forEach(child=>{this.parents[child]=index}));this.namedNodes=Object.fromEntries(json.nodes.map((node,index)=>[node.name,index]));
   this.base=json.nodes.map(node=>({t:[...(node.translation||[0,0,0])],r:[...(node.rotation||[0,0,0,1])],s:[...(node.scale||[1,1,1])]}));
   const skin=json.skins[json.nodes.find(node=>Number.isInteger(node.skin)).skin];this.joints=skin.joints;this.inverseBind=accessor(skin.inverseBindMatrices);if(this.joints.length>MAX_BONES)throw new Error('Meshy rig exceeds GPU bone budget');
   this.clips=json.animations.map(animation=>{let duration=0;const channels=animation.channels.map(channel=>{const sampler=animation.samplers[channel.sampler],times=accessor(sampler.input),values=accessor(sampler.output);duration=Math.max(duration,times[times.length-1]||0);return{node:channel.target.node,path:channel.target.path,times,values,size:channel.target.path==='rotation'?4:3}});return{name:animation.name,duration,channels}});this.clipNames=this.clips.map(clip=>clip.name);this.ready=true;
  }catch(error){this.error=String(error?.message||error);console.warn('Detailed athletes unavailable; using built-in players.',this.error)}
 }
 sampleChannel(channel,time){const{times,values,size}=channel;if(times.length===1)return Array.from(values.subarray(0,size));let low=0,high=times.length-1;while(low+1<high){const mid=(low+high)>>1;if(times[mid]<=time)low=mid;else high=mid}const a=low,b=Math.min(times.length-1,low+1),span=times[b]-times[a],t=span?clamp((time-times[a])/span,0,1):0,left=Array.from(values.subarray(a*size,a*size+size)),right=Array.from(values.subarray(b*size,b*size+size));return channel.path==='rotation'?slerp(left,right,t):lerpArray(left,right,t)}
 choose(p,phase,time){
  const state=meshyAnimationState(p,phase),seed=meshyPlaybackSeed(p.index,p.team),profile=ROLE_MOTION_PROFILES[p.role]||ROLE_MOTION_PROFILES.LB,roleRate=profile.cadence,phaseTime=(clip,rate=1)=>Number.isFinite(p.distance)&&!p.engaged&&[MESHY_CLIPS.run,MESHY_CLIPS.walk,MESHY_CLIPS.sprint].includes(clip)?locomotionClipTime(p.distance,this.clips[clip].duration,clip,seed.offset):(time*seed.rate*roleRate*rate+seed.offset*this.clips[clip].duration)%this.clips[clip].duration;
  const result=(base,baseTime,overlay=null,overlayWeight=0,overlayTime=0)=>({state,base,baseTime,overlay,overlayWeight,overlayTime});
  const actionTime=clamp(p.actionT||0,0,1),tackleTime=actionTime*this.clips[MESHY_CLIPS.tackle].duration;
  if(state==='get-up')return result(MESHY_CLIPS.idle,0);
  if(state==='tackle')return result(MESHY_CLIPS.tackle,tackleTime);
  if(state==='wrap-tackle')return result(MESHY_CLIPS.tackle,tackleTime,MESHY_CLIPS.block,.10,actionTime*this.clips[MESHY_CLIPS.block].duration);
  if(state==='gang-tackle')return result(MESHY_CLIPS.tackle,tackleTime,MESHY_CLIPS.block,.26,phaseTime(MESHY_CLIPS.block,1.16));
  if(state==='big-hit')return result(MESHY_CLIPS.tackle,tackleTime,MESHY_CLIPS.sprint,.16,phaseTime(MESHY_CLIPS.sprint,1.25));
  if(state==='qb-slide')return result(MESHY_CLIPS.tackle,tackleTime*.58,MESHY_CLIPS.run,.12,phaseTime(MESHY_CLIPS.run,.72));
  if(state==='dive-tackle')return result(MESHY_CLIPS.tackle,tackleTime,MESHY_CLIPS.sprint,.14,phaseTime(MESHY_CLIPS.sprint,1.12));
  if(state==='celebrate')return result(MESHY_CLIPS.celebrate,phaseTime(MESHY_CLIPS.celebrate));
  if(state.startsWith('throw-')){const recipe=motionRecipeForState(state)||FOOTBALL_MOTION_RECIPES['throw-bullet'];return result(recipe.base,clamp(p.throwT,0,1)*this.clips[recipe.base].duration,recipe.overlay,recipe.overlayWeight,phaseTime(recipe.overlay,recipe.rate))}
  if(state.startsWith('catch-')){const style=state.slice(6),overlay=style==='secure'?MESHY_CLIPS.block:style==='aggressive'?MESHY_CLIPS.sprint:MESHY_CLIPS.run,weight=style==='secure'?.18:style==='aggressive'?.12:.08;return result(MESHY_CLIPS.catch,clamp(1-p.catchT/.45,0,1)*this.clips[MESHY_CLIPS.catch].duration,overlay,weight,phaseTime(overlay,.82))}
  if(state==='break-tackle')return result(MESHY_CLIPS.block,phaseTime(MESHY_CLIPS.block,1.18),MESHY_CLIPS.run,.16,phaseTime(MESHY_CLIPS.run,.74));
  if(state==='miss')return result(MESHY_CLIPS.tackle,tackleTime*.72,MESHY_CLIPS.idleAlt,.10,phaseTime(MESHY_CLIPS.idleAlt));
  if(state==='stumble')return result(MESHY_CLIPS.walk,phaseTime(MESHY_CLIPS.walk,.62),MESHY_CLIPS.tackle,.18,tackleTime*.58);
  if(state==='pancake')return result(MESHY_CLIPS.tackle,tackleTime,MESHY_CLIPS.block,.12,phaseTime(MESHY_CLIPS.block,.72));
  if(state==='pre'){const pose=preSnapPoseForRole(p.role,p.index);return result(pose.clip,Math.min(pose.time,this.clips[pose.clip].duration-.001))}
  const recipe=motionRecipeForState(state);if(recipe){
   // Lock engaged pass/run bases to a reviewed contact frame. The procedural
   // pilot below owns the footwork, so the three-second generated flourish
   // cannot make every lineman kick in unison.
   const locked=p.engaged||state==='pass-set'||state==='drive-block';
   const baseTime=locked?Math.min(this.clips[recipe.base].duration-.001,state==='pass-set'?.16:.24):phaseTime(recipe.base,recipe.rate);
   return result(recipe.base,baseTime,recipe.overlay,locked?Math.min(recipe.overlayWeight,.06):recipe.overlayWeight,recipe.overlay===null?0:locked?Math.min(this.clips[recipe.overlay].duration-.001,.12):phaseTime(recipe.overlay,recipe.rate*.93));
  }
  if(state==='sprint')return result(MESHY_CLIPS.sprint,phaseTime(MESHY_CLIPS.sprint,1.2));if(state==='run')return result(MESHY_CLIPS.run,phaseTime(MESHY_CLIPS.run,1.05));if(state==='walk')return result(MESHY_CLIPS.walk,phaseTime(MESHY_CLIPS.walk,.55));const idle=p.index%2?MESHY_CLIPS.idle:MESHY_CLIPS.idleAlt;return result(idle,phaseTime(idle,.72));
 }
 poseLocals(clipIndex,clipTime){
  const clip=this.clips[clipIndex],locals=this.base.map(node=>({t:[...node.t],r:[...node.r],s:[...node.s]}));
  for(const channel of clip.channels){const value=this.sampleChannel(channel,clipTime);if(channel.path==='translation')locals[channel.node].t=value;else if(channel.path==='rotation')locals[channel.node].r=value;else locals[channel.node].s=value}return locals;
 }
 mixLocals(base,overlay,weight){return base.map((node,index)=>({t:lerpArray(node.t,overlay[index].t,weight),r:slerp(node.r,overlay[index].r,weight),s:lerpArray(node.s,overlay[index].s,weight)}))}
 rotate(locals,name,x,y,z,angle){const index=this.namedNodes[name];if(Number.isInteger(index))locals[index].r=quatMul(locals[index].r,axisQuat(x,y,z,angle))}
 jointWorld(locals,index){
  const n=locals[index],parent=this.parents[index],local=compose(n.t,n.r,n.s);
  if(parent<0)return{m:local,q:n.r};const w=this.jointWorld(locals,parent);return{m:mul(w.m,local),q:quatMul(w.q,n.r)};
 }
 aimJoint(locals,index,child,target){
  const parent=this.parents[index],pw=parent<0?{q:[0,0,0,1]}:this.jointWorld(locals,parent),origin=pointFromMatrix(this.jointWorld(locals,index).m),inverse=[-pw.q[0],-pw.q[1],-pw.q[2],pw.q[3]],desired=pointFromMatrix(quatMatrix(inverse),subtract(target,origin)),current=pointFromMatrix(quatMatrix(locals[index].r),locals[child].t);
  locals[index].r=quatMul(directionQuat(current,desired),locals[index].r);
 }
 solveLimb(locals,names,target,pole,keepEndRotation=false){
  const [a,b,c]=names.map(name=>this.namedNodes['mixamorig:'+name]);if(![a,b,c].every(Number.isInteger))return;
  const origin=pointFromMatrix(this.jointWorld(locals,a).m),endRotation=this.jointWorld(locals,c).q,upper=Math.hypot(...locals[b].t),lower=Math.hypot(...locals[c].t),delta=subtract(target,origin),raw=Math.hypot(...delta)||.001,d=clamp(raw,Math.abs(upper-lower)+.001,upper+lower-.001),axis=delta.map(v=>v/raw),poleDelta=subtract(pole,origin),dot=poleDelta.reduce((sum,v,i)=>sum+v*axis[i],0),bend=poleDelta.map((v,i)=>v-dot*axis[i]),bl=Math.hypot(...bend)||1,along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along)),joint=origin.map((v,i)=>v+axis[i]*along+bend[i]/bl*height),end=origin.map((v,i)=>v+axis[i]*d);
  this.aimJoint(locals,a,b,joint);this.aimJoint(locals,b,c,end);
  if(keepEndRotation){const parent=this.jointWorld(locals,b).q;locals[c].r=quatMul([-parent[0],-parent[1],-parent[2],parent[3]],endRotation)}
 }
 readyPose(locals,p){
  const trench=p.role==='OL'||p.role==='DL',qb=p.role==='QB',receiver=p.role==='WR'||p.role==='TE',width=trench?.21:.145;
  for(const [side,sign]of[['Left',1],['Right',-1]]){
   const foot=this.namedNodes['mixamorig:'+side+'Foot'],ankle=pointFromMatrix(this.jointWorld(this.base,foot).m),stagger=receiver?.10:trench?.045:.025;
   this.solveLimb(locals,[side+'UpLeg',side+'Leg',side+'Foot'],[sign*width,ankle[1],ankle[2]+sign*stagger],[sign*width,.45,.75],true);
  }
  const chest=pointFromMatrix(this.jointWorld(locals,this.namedNodes['mixamorig:Spine2']).m);
  for(const [side,sign]of[['Left',1],['Right',-1]]){
   const target=qb?[sign*.11,chest[1]-.10,chest[2]+.27]:trench?[sign*.24,chest[1]-.23,chest[2]+.32]:[sign*.23,chest[1]-.28,chest[2]+(receiver?.12:.20)];
   this.solveLimb(locals,[side+'Arm',side+'ForeArm',side+'Hand'],target,[sign*.62,chest[1]-.40,chest[2]-.06]);
  }
 }
 groundedLocomotion(locals,p,state){
  const hips=this.joints[0],speed=Math.hypot(p.vx||0,p.vz||0),sprint=state.includes('sprint')||speed>7.7,distance=(p.distance||0)+(p.index%7)*.21;
  // The generated sprint root pitches almost 70 degrees. Keep an authored
  // upright torso and let speed determine lean, not the source clip's dive.
  locals[hips].r=[...this.base[hips].r];locals[hips].t=[...this.base[hips].t];locals[hips].t[1]-=.075+.018*Math.cos(distance/2.45*Math.PI*4);
  for(const name of['Spine','Spine1','Spine2','Neck','Head']){const i=this.namedNodes['mixamorig:'+name];if(Number.isInteger(i))locals[i].r=[...this.base[i].r]}
  const lean=sprint?.24:speed<2?.04:.13;this.rotate(locals,'mixamorig:Spine',1,0,0,lean);this.rotate(locals,'mixamorig:Head',1,0,0,-lean*.45);this.rotate(locals,'mixamorig:Spine2',0,1,0,Math.sin(distance/2.45*Math.PI*2)*.075);
  const direction=Math.atan2(p.vx||0,p.vz||0)-(p.heading||0),sideways=Math.sin(direction),forward=Math.cos(direction),width=p.role==='OL'||p.role==='DL'?.15:.105;
  for(const [side,sign,offset]of[['Left',1,0],['Right',-1,.5]]){
   const step=groundedStride(distance,offset),foot=this.namedNodes['mixamorig:'+side+'Foot'],ankle=pointFromMatrix(this.jointWorld(this.base,foot).m),z=step.z;
   // Reset the ankle orientation before IK so planted soles stay level.
   for(const name of[side+'UpLeg',side+'Leg',side+'Foot']){const i=this.namedNodes['mixamorig:'+name];locals[i].r=[...this.base[i].r]}
   this.solveLimb(locals,[side+'UpLeg',side+'Leg',side+'Foot'],[sign*width+z*sideways,ankle[1]+step.lift,ankle[2]+z*forward],[sign*width+sideways*.25,.42,.65*forward],true);
   const chest=pointFromMatrix(this.jointWorld(locals,this.namedNodes['mixamorig:Spine2']).m),swing=Math.sin(distance/2.45*Math.PI*2+offset*Math.PI*2);
   const walking=state==='walk',handY=walking?-.40:-.24,armSwing=walking?.09:sprint?.23:.17;
   this.solveLimb(locals,[side+'Arm',side+'ForeArm',side+'Hand'],[sign*.17,chest[1]+handY+swing*(walking?.035:.10),chest[2]+.12-swing*armSwing],[sign*.25,chest[1]-.43,chest[2]-.13]);
  }
 }
 standingPose(locals,p,crouch=.06,lean=.06){
  for(let i=0;i<locals.length;i++){locals[i].r=[...this.base[i].r];locals[i].t=[...this.base[i].t]}
  locals[this.joints[0]].t[1]-=crouch;this.rotate(locals,'mixamorig:Spine',1,0,0,lean);this.rotate(locals,'mixamorig:Head',1,0,0,-lean*.45);this.readyPose(locals,p);
 }
 quarterbackPose(locals,p,state){
  const chest=pointFromMatrix(this.jointWorld(locals,this.namedNodes['mixamorig:Spine2']).m),throwing=state.startsWith('throw-'),t=clamp(p.throwT||0,0,1);
  for(const [side,sign]of[['Left',1],['Right',-1]]){
   let target=[sign*.09,chest[1]-.10,chest[2]+.26];
   if(throwing&&side==='Right'){const load=smooth(t/.35),release=smooth((t-.35)/.35),follow=smooth((t-.7)/.3);target=[-.28+.35*follow,chest[1]-.10+.34*load-.44*follow,chest[2]+.26-.45*load+.85*release-.20*follow]}
   this.solveLimb(locals,[side+'Arm',side+'ForeArm',side+'Hand'],target,[sign*.35,chest[1]-.28,chest[2]-.07]);
  }
 }
 contactPose(locals,p){
  const t=clamp(p.actionT||0,0,1),wrap=smooth(t/.22),land=smooth((t-.32)/.62);
  this.standingPose(locals,p,.09+.17*wrap*(1-land),.16*wrap*(1-land));
  const chest=pointFromMatrix(this.jointWorld(locals,this.namedNodes['mixamorig:Spine2']).m);
  for(const [side,sign]of[['Left',1],['Right',-1]]){
   const hand=[sign*(.28-.07*land),chest[1]-(.20-.06*land),chest[2]+.32*(1-land)-.015*land];
   this.solveLimb(locals,[side+'Arm',side+'ForeArm',side+'Hand'],hand,[sign*.43,chest[1]-.26,chest[2]+.02]);
   const foot=this.namedNodes['mixamorig:'+side+'Foot'],ankle=pointFromMatrix(this.jointWorld(this.base,foot).m);
   this.solveLimb(locals,[side+'UpLeg',side+'Leg',side+'Foot'],[sign*.13,ankle[1]+land*(sign>0?.14:.06),ankle[2]+(sign>0?-.13:.10)*(1-land)-land*.11],[sign*.15,.38,.60],true);
  }
  if(p.hasBall)this.carryPose(locals,p);
 }
 worldHandTargets(locals,p,model){
  const other=this.actorMap?.get(p.contactWith??p.engagedWith),otherHands=other&&this.handTransforms.get(other.index),targetModel=other&&otherHands?this.modelFor(other):null;
  if(!p.ballTarget&&!targetModel)return false;
  if(!p.ballTarget&&p.engaged&&Math.hypot(p.x-other.x,p.z-other.z)>1.45)return false;
  const inversePoint=world=>{const v=world.map((n,i)=>n-model[12+i]);return[0,1,2].map(col=>{const j=col*4;return(v[0]*model[j]+v[1]*model[j+1]+v[2]*model[j+2])/(model[j]*model[j]+model[j+1]*model[j+1]+model[j+2]*model[j+2])})};
  const chest=pointFromMatrix(this.jointWorld(locals,this.namedNodes['mixamorig:Spine2']).m);
  let changed=false;
  for(const [side,sign]of[['Left',1],['Right',-1]]){
   let target,weight=1;
   if(p.ballTarget){const h=p.heading||0;target=inversePoint([p.ballTarget[0]+Math.cos(h)*sign*.055,p.ballTarget[1]+(p.role==='RB'?sign*.045:0),p.ballTarget[2]-Math.sin(h)*sign*.055])}
   else if(p.engaged){target=inversePoint(pointFromMatrix(mul(targetModel,otherHands.chest),[-sign*.18,-.05,.13]))}
   else if(p.contactRole==='tackler'&&p.action!=='get-up'){
    weight=smooth((p.actionT||0)/.10)*(1-smooth(((p.actionT||0)-.84)/.15));
    target=inversePoint(pointFromMatrix(mul(targetModel,otherHands.chest),[sign*.24,-.19,-.01]));
   }
   if(!target||weight<=0)continue;
   const current=pointFromMatrix(this.jointWorld(locals,this.namedNodes['mixamorig:'+side+'Hand']).m);
   this.solveLimb(locals,[side+'Arm',side+'ForeArm',side+'Hand'],lerpArray(current,target,weight),[sign*.44,chest[1]-.28,chest[2]+.09]);changed=true;
  }
  return changed;
 }
 getUpPose(locals,p){
  const hips=this.joints[0],t=smooth(p.actionT||0);locals[hips].r=[...this.base[hips].r];locals[hips].t=[...this.base[hips].t];locals[hips].t[1]-=.22*(1-t)+.06;
  for(const name of['Spine','Spine1','Spine2']){const i=this.namedNodes['mixamorig:'+name];locals[i].r=[...this.base[i].r]}
  this.rotate(locals,'mixamorig:Spine',1,0,0,.22*(1-t));this.readyPose(locals,p);
 }
 blockPose(locals,p,time){
  this.standingPose(locals,p,.15,.22);
  // Short alternating steps with hands meeting the opponent's shoulder pads.
  const chest=pointFromMatrix(this.jointWorld(locals,this.namedNodes['mixamorig:Spine2']).m),beat=(p.distance||0)*10+p.index*.83;
  for(const [side,sign]of[['Left',1],['Right',-1]]){
   const ankle=pointFromMatrix(this.jointWorld(this.base,this.namedNodes['mixamorig:'+side+'Foot']).m),step=Math.sin(beat+(sign>0?0:Math.PI));
   this.solveLimb(locals,[side+'UpLeg',side+'Leg',side+'Foot'],[sign*.20,ankle[1]+Math.max(0,step)*.045,ankle[2]+step*.075],[sign*.22,.45,.65],true);
   this.solveLimb(locals,[side+'Arm',side+'ForeArm',side+'Hand'],[sign*.21,chest[1]-.06,chest[2]+.38],[sign*.46,chest[1]-.26,chest[2]+.08]);
  }
 }
 carryPose(locals,p){
  const side=(p.index+p.team)%2?'Right':'Left',sign=side==='Left'?1:-1,chest=pointFromMatrix(this.jointWorld(locals,this.namedNodes['mixamorig:Spine2']).m);
  this.solveLimb(locals,[side+'Arm',side+'ForeArm',side+'Hand'],[sign*.16,chest[1]-.20,chest[2]+.20],[sign*.48,chest[1]-.40,chest[2]-.06]);
 }
 applyFootballPose(locals,p,phase,time,state){
  const pulse=Math.sin(clamp(p.actionT||0,0,1)*Math.PI),side=p.actionSide||0,mirror=(p.index+p.team)%2?1:-1,hips=this.joints[0],beat=Math.sin(time*(6.4+(p.index%4)*.31)+p.index*.83),profile=ROLE_MOTION_PROFILES[p.role]||ROLE_MOTION_PROFILES.LB,speed=clamp(Math.hypot(p.vx||0,p.vz||0)/9,0,1),pilotPhase=authenticityPilotPhase(state,p,time);
  if(phase==='pre'){
   const profile=ROLE_STANCE_PROFILES[p.role]||ROLE_STANCE_PROFILES.LB;locals[hips].t[1]-=profile.crouch;
   this.rotate(locals,'mixamorig:Spine',1,0,0,profile.lean);
   this.rotate(locals,'mixamorig:LeftUpLeg',1,0,0,-profile.knees-profile.stagger*mirror);
   this.rotate(locals,'mixamorig:RightUpLeg',1,0,0,-profile.knees+profile.stagger*mirror);
   this.rotate(locals,'mixamorig:LeftLeg',1,0,0,profile.knees*.72);
   this.rotate(locals,'mixamorig:RightLeg',1,0,0,profile.knees*.72);
   // The generated rest clip has both upper arms spread almost horizontally.
   // Its local shoulder Z axes are mirrored: negative on the left and positive
   // on the right bring the elbows down beside the jersey. The block clip used
   // by linemen already has lowered arms and needs only a small adjustment.
   const trench=p.role==='OL'||p.role==='DL',drop=trench?.12:1.04;
   this.rotate(locals,'mixamorig:LeftArm',0,0,1,-drop);
   this.rotate(locals,'mixamorig:RightArm',0,0,1,drop);
   this.rotate(locals,'mixamorig:LeftForeArm',1,0,0,-profile.elbows);
   this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-profile.elbows);
   if(trench){
    this.rotate(locals,'mixamorig:LeftArm',1,0,0,.08);
    this.rotate(locals,'mixamorig:RightArm',1,0,0,.08);
   }
  }
  if(state==='idle'){
   this.rotate(locals,'mixamorig:LeftArm',0,0,1,-1.04);
   this.rotate(locals,'mixamorig:RightArm',0,0,1,1.04);
   this.rotate(locals,'mixamorig:LeftForeArm',1,0,0,-.16);
   this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-.16);
  }
  if(phase!=='pre'&&!p.engaged&&!/tackle|hit|miss|break|slide|stumble|dive/.test(state)){
   this.rotate(locals,'mixamorig:Spine',1,0,0,profile.lean*speed);
   this.rotate(locals,'mixamorig:LeftArm',1,0,0,-profile.arm*beat*speed);
   this.rotate(locals,'mixamorig:RightArm',1,0,0,profile.arm*beat*speed);
  }
  if(state==='qb-pocket'||state==='qb-drop'||state==='qb-climb'||state==='qb-rollout'){
   const climb=state==='qb-climb',rollout=state==='qb-rollout',drop=state==='qb-drop';
   locals[hips].t[1]-=.035;this.rotate(locals,'mixamorig:Spine',1,0,0,.055);this.rotate(locals,'mixamorig:LeftArm',0,0,1,-.17);this.rotate(locals,'mixamorig:RightArm',0,0,1,.17);this.rotate(locals,'mixamorig:LeftForeArm',1,0,0,-.22);this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-.22);
   if(climb){this.rotate(locals,'mixamorig:Spine',1,0,0,.08);this.rotate(locals,'mixamorig:LeftUpLeg',1,0,0,-.12);this.rotate(locals,'mixamorig:RightUpLeg',1,0,0,-.12)}
   if(rollout){this.rotate(locals,'mixamorig:Spine2',0,0,1,-Math.sign(p.vx||1)*.13);this.rotate(locals,'mixamorig:Head',0,1,0,Math.sign(p.vx||1)*.12)}
   if(drop)this.rotate(locals,'mixamorig:Spine',1,0,0,-.035);
  }else if(state==='qb-scramble'){
   this.rotate(locals,'mixamorig:Spine',1,0,0,.14);this.rotate(locals,'mixamorig:Head',1,0,0,-.08);this.rotate(locals,'mixamorig:RightArm',0,0,1,.18);this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-.48);
  }else if(state==='handoff'||state==='receive-handoff'){
   const exchange=state==='handoff'?1:-1;this.rotate(locals,'mixamorig:Spine',1,0,0,.10*pulse);this.rotate(locals,'mixamorig:LeftArm',1,0,0,-.24*pulse);this.rotate(locals,'mixamorig:RightArm',1,0,0,-.24*pulse);this.rotate(locals,'mixamorig:LeftForeArm',0,1,0,.24*exchange*pulse);this.rotate(locals,'mixamorig:RightForeArm',0,1,0,-.24*exchange*pulse);
  }else if(state==='pass-set'||state==='pass-anchor'){
   const setBeat=state==='pass-set'?Math.sin(pilotPhase):beat,reset=Math.cos(pilotPhase),left=setBeat*mirror;
   locals[hips].t[1]-=.105+Math.abs(setBeat)*.018;this.rotate(locals,'mixamorig:Spine',1,0,0,.18);this.rotate(locals,'mixamorig:LeftUpLeg',1,0,0,-.15-left*.045);this.rotate(locals,'mixamorig:RightUpLeg',1,0,0,-.15+left*.045);this.rotate(locals,'mixamorig:LeftLeg',1,0,0,.13+left*.035);this.rotate(locals,'mixamorig:RightLeg',1,0,0,.13-left*.035);this.rotate(locals,'mixamorig:LeftUpLeg',0,0,1,-.115);this.rotate(locals,'mixamorig:RightUpLeg',0,0,1,.115);this.rotate(locals,'mixamorig:LeftArm',1,0,0,-.30-reset*.055);this.rotate(locals,'mixamorig:RightArm',1,0,0,-.30+reset*.055);this.rotate(locals,'mixamorig:LeftForeArm',1,0,0,-.18);this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-.18);
   if(state==='pass-anchor'){locals[hips].t[1]-=.045;this.rotate(locals,'mixamorig:Spine2',1,0,0,.08);}
  }else if(state==='drive-block'||state==='reach-block'||state==='climb-block'||state==='stalk-block'){
   const driveBeat=state==='drive-block'?Math.sin(pilotPhase):beat,leg=driveBeat*mirror;
   locals[hips].t[1]-=.09+Math.abs(driveBeat)*.022;this.rotate(locals,'mixamorig:Spine',1,0,0,state==='drive-block'?.31:.24);this.rotate(locals,'mixamorig:Spine2',0,0,1,mirror*driveBeat*.045);this.rotate(locals,'mixamorig:LeftUpLeg',1,0,0,-.13-leg*.085);this.rotate(locals,'mixamorig:RightUpLeg',1,0,0,-.13+leg*.085);this.rotate(locals,'mixamorig:LeftLeg',1,0,0,.12+leg*.065);this.rotate(locals,'mixamorig:RightLeg',1,0,0,.12-leg*.065);this.rotate(locals,'mixamorig:LeftShoulder',1,0,0,-.24-driveBeat*.045);this.rotate(locals,'mixamorig:RightShoulder',1,0,0,-.24+driveBeat*.045);this.rotate(locals,'mixamorig:LeftForeArm',1,0,0,-.16);this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-.16);
   if(state==='reach-block')this.rotate(locals,'mixamorig:Spine2',0,0,1,(side||mirror)*.17);
   if(state==='climb-block'){this.rotate(locals,'mixamorig:Spine',1,0,0,.10);this.rotate(locals,'mixamorig:LeftArm',0,1,0,.16);this.rotate(locals,'mixamorig:RightArm',0,1,0,-.16);}
   if(state==='stalk-block'){locals[hips].t[1]+=.035;this.rotate(locals,'mixamorig:Spine',1,0,0,-.09);}
  }else if(state==='rush-engaged'||state==='shed'||state==='bull-rush'||state==='rush-rip'||state==='rush-swim'){
   this.rotate(locals,'mixamorig:Spine',1,0,0,.20);this.rotate(locals,'mixamorig:Spine2',0,0,1,mirror*.12);this.rotate(locals,mirror>0?'mixamorig:RightArm':'mixamorig:LeftArm',0,1,0,mirror*.34);this.rotate(locals,mirror>0?'mixamorig:RightForeArm':'mixamorig:LeftForeArm',1,0,0,-.22);
   if(state==='bull-rush'){locals[hips].t[1]-=.06;this.rotate(locals,'mixamorig:LeftShoulder',1,0,0,-.18);this.rotate(locals,'mixamorig:RightShoulder',1,0,0,-.18);}
   if(state==='rush-rip'){this.rotate(locals,mirror>0?'mixamorig:RightArm':'mixamorig:LeftArm',1,0,0,-.58);this.rotate(locals,'mixamorig:Spine2',0,0,1,mirror*.20)}
   if(state==='rush-swim'){this.rotate(locals,mirror>0?'mixamorig:LeftArm':'mixamorig:RightArm',1,0,0,-.92);this.rotate(locals,mirror>0?'mixamorig:LeftForeArm':'mixamorig:RightForeArm',1,0,0,-.34);this.rotate(locals,'mixamorig:Spine2',0,1,0,mirror*.18)}
  }else if(state==='rush'||state==='edge-rush'){
   const stride=Math.sin(pilotPhase),rip=Math.max(0,Math.sin(pilotPhase+.55)),edgeSide=side||mirror;
   this.rotate(locals,'mixamorig:Spine',1,0,0,state==='edge-rush'?.245:.16);this.rotate(locals,'mixamorig:Spine2',0,1,0,mirror*.055);
   if(state==='edge-rush'){locals[hips].t[1]-=.035;this.rotate(locals,'mixamorig:Spine2',0,0,1,edgeSide*(.18+.055*stride));this.rotate(locals,edgeSide>0?'mixamorig:RightArm':'mixamorig:LeftArm',1,0,0,-.48*rip);this.rotate(locals,edgeSide>0?'mixamorig:RightForeArm':'mixamorig:LeftForeArm',1,0,0,-.34*rip);this.rotate(locals,'mixamorig:LeftUpLeg',1,0,0,-stride*.10);this.rotate(locals,'mixamorig:RightUpLeg',1,0,0,stride*.10);}
  }else if(state==='coverage'||state==='coverage-pedal'||state==='coverage-break'){
   locals[hips].t[1]-=.065;this.rotate(locals,'mixamorig:Spine',1,0,0,.10);this.rotate(locals,'mixamorig:LeftArm',0,0,1,-.11);this.rotate(locals,'mixamorig:RightArm',0,0,1,.11);
   if(state==='coverage-pedal'){this.rotate(locals,'mixamorig:Spine',1,0,0,-.08);this.rotate(locals,'mixamorig:LeftUpLeg',0,0,1,-.08);this.rotate(locals,'mixamorig:RightUpLeg',0,0,1,.08);}
   if(state==='coverage-break')this.rotate(locals,'mixamorig:Spine2',0,0,1,clamp(-(p.motion?.turn||0)*.10,-.22,.22));
  }else if(state==='carry-run'){
   locals[hips].t[1]-=.025;this.rotate(locals,'mixamorig:Spine',1,0,0,.105);this.rotate(locals,'mixamorig:Spine2',1,0,0,.035);this.rotate(locals,'mixamorig:Head',1,0,0,-.045);
  }else if(state==='carry-sprint'){
   locals[hips].t[1]-=.045;this.rotate(locals,'mixamorig:Spine',1,0,0,.245);this.rotate(locals,'mixamorig:Spine2',1,0,0,.075);this.rotate(locals,'mixamorig:Head',1,0,0,-.095);this.rotate(locals,mirror>0?'mixamorig:LeftArm':'mixamorig:RightArm',1,0,0,-beat*.18);
  }else if(state==='route-cut'||state==='carry-cut'){
   const cut=clamp(-(p.motion?.turn||0)*.12,-.34,.34),plant=cut>=0?1:-1,plantWeight=state==='carry-cut'?pilotPhase:1;locals[hips].t[1]-=.085*plantWeight;this.rotate(locals,'mixamorig:Spine2',0,0,1,cut);this.rotate(locals,plant>0?'mixamorig:RightUpLeg':'mixamorig:LeftUpLeg',1,0,0,-Math.abs(cut)*1.15);this.rotate(locals,plant>0?'mixamorig:RightLeg':'mixamorig:LeftLeg',1,0,0,Math.abs(cut)*.78);this.rotate(locals,plant>0?'mixamorig:RightUpLeg':'mixamorig:LeftUpLeg',0,0,1,-plant*Math.abs(cut)*.42);this.rotate(locals,'mixamorig:Spine',1,0,0,.12*plantWeight);
  }
  if(state==='carry-run'||state==='carry-sprint'||state.startsWith('carry-')){
   const right=mirror>0,arm=right?'mixamorig:RightArm':'mixamorig:LeftArm',forearm=right?'mixamorig:RightForeArm':'mixamorig:LeftForeArm';this.rotate(locals,arm,0,0,1,right?.29:-.29);this.rotate(locals,arm,1,0,0,-.10);this.rotate(locals,forearm,1,0,0,-.78);this.rotate(locals,forearm,0,1,0,right?-.22:.22);this.rotate(locals,right?'mixamorig:LeftArm':'mixamorig:RightArm',1,0,0,-beat*(state==='carry-sprint'?.13:.09));
  }
  if(p.engaged){
   this.rotate(locals,'mixamorig:Spine',1,0,0,.08);
   this.rotate(locals,'mixamorig:LeftArm',1,0,0,-.14);
   this.rotate(locals,'mixamorig:RightArm',1,0,0,-.14);
  }
  if(state.startsWith('throw-')){
   const release=clamp(p.throwT||0,0,1),coil=Math.sin(Math.min(1,release/.58)*Math.PI),follow=smooth(clamp((release-.48)/.52,0,1)),lob=state==='throw-lob',touch=state==='throw-touch',away=state==='throw-away';
   this.rotate(locals,'mixamorig:Spine2',0,1,0,-.22*coil+.18*follow);this.rotate(locals,'mixamorig:RightArm',1,0,0,-(.48+(lob?.28:touch?.12:0))*coil);this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-.48*coil+.30*follow);this.rotate(locals,'mixamorig:LeftArm',0,0,1,-.16*coil);if(away){this.rotate(locals,'mixamorig:Spine2',0,0,1,(side||mirror)*.22*coil);this.rotate(locals,'mixamorig:RightArm',0,1,0,-.20*coil)}
  }else if(p.action==='juke'){
   this.rotate(locals,'mixamorig:Spine',0,0,1,-side*.24*pulse);
   this.rotate(locals,side>0?'mixamorig:RightUpLeg':'mixamorig:LeftUpLeg',1,0,0,-.42*pulse);this.rotate(locals,side>0?'mixamorig:RightLeg':'mixamorig:LeftLeg',1,0,0,.34*pulse);locals[hips].t[1]-=.12*pulse;
  }else if(p.action==='spin'){
   this.rotate(locals,'mixamorig:Spine',1,0,0,.14*pulse);this.rotate(locals,'mixamorig:LeftArm',0,0,1,-.24*pulse);this.rotate(locals,'mixamorig:RightArm',0,0,1,.24*pulse);this.rotate(locals,'mixamorig:LeftForeArm',1,0,0,-.42*pulse);this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-.42*pulse);
  }else if(p.action==='truck'){
   this.rotate(locals,'mixamorig:Spine2',1,0,0,.24*pulse);
   this.rotate(locals,side>0?'mixamorig:RightShoulder':'mixamorig:LeftShoulder',1,0,0,-.30*pulse);
  }else if(p.action==='stiff-arm'){
   this.rotate(locals,'mixamorig:Spine2',0,0,1,-side*.16*pulse);this.rotate(locals,side>0?'mixamorig:RightArm':'mixamorig:LeftArm',1,0,0,-.82*pulse);this.rotate(locals,side>0?'mixamorig:RightForeArm':'mixamorig:LeftForeArm',1,0,0,.32*pulse);this.rotate(locals,side>0?'mixamorig:RightShoulder':'mixamorig:LeftShoulder',0,1,0,side*.24*pulse);
  }else if(p.action==='hurdle'){
   this.rotate(locals,'mixamorig:LeftUpLeg',1,0,0,-.72*pulse);
   this.rotate(locals,'mixamorig:RightUpLeg',1,0,0,-.72*pulse);
   this.rotate(locals,'mixamorig:LeftLeg',1,0,0,1.02*pulse);
   this.rotate(locals,'mixamorig:RightLeg',1,0,0,1.02*pulse);
  }else if(p.action==='break-tackle'){
   this.rotate(locals,'mixamorig:Spine2',0,0,1,(side||1)*.28*pulse);
   this.rotate(locals,'mixamorig:LeftShoulder',1,0,0,-.24*pulse);
   this.rotate(locals,'mixamorig:RightShoulder',1,0,0,-.24*pulse);
  }else if(p.action==='miss'){
   this.rotate(locals,'mixamorig:Spine',1,0,0,.34*pulse);
   this.rotate(locals,'mixamorig:Spine2',0,0,1,(side||1)*.30*pulse);
  }else if(p.action==='stumble'){
   locals[hips].t[1]-=.10*pulse;this.rotate(locals,'mixamorig:Spine',1,0,0,.30*pulse);this.rotate(locals,'mixamorig:Spine2',0,0,1,(side||1)*.18*pulse);
  }else if(p.action==='wrap'||p.action==='gang'){
   const contact=pilotPhase,reach=smooth(clamp(contact/.42,0,1)),clasp=smooth(clamp((contact-.22)/.42,0,1)),finish=smooth(clamp((contact-.56)/.44,0,1)),low=p.action==='gang'?.16:.10;locals[hips].t[1]-=low*reach+.06*finish;this.rotate(locals,'mixamorig:Spine',1,0,0,.30*reach-.08*finish);this.rotate(locals,'mixamorig:LeftArm',0,1,0,.56*reach-.22*clasp);this.rotate(locals,'mixamorig:RightArm',0,1,0,-.56*reach+.22*clasp);this.rotate(locals,'mixamorig:LeftArm',1,0,0,-.34*reach);this.rotate(locals,'mixamorig:RightArm',1,0,0,-.34*reach);this.rotate(locals,'mixamorig:LeftForeArm',1,0,0,-.52*clasp);this.rotate(locals,'mixamorig:RightForeArm',1,0,0,-.52*clasp);this.rotate(locals,'mixamorig:LeftUpLeg',1,0,0,-.14*reach);this.rotate(locals,'mixamorig:RightUpLeg',1,0,0,-.14*reach);
  }else if(p.action==='dive'){
   const launch=smooth(clamp((p.actionT||0)/.48,0,1)),finish=smooth(clamp(((p.actionT||0)-.48)/.52,0,1));this.rotate(locals,'mixamorig:Spine',1,0,0,.42*launch-.18*finish);this.rotate(locals,'mixamorig:LeftArm',1,0,0,-.62*launch);this.rotate(locals,'mixamorig:RightArm',1,0,0,-.62*launch);this.rotate(locals,'mixamorig:LeftUpLeg',1,0,0,.24*launch);this.rotate(locals,'mixamorig:RightUpLeg',1,0,0,-.28*launch);locals[hips].t[1]+=.12*launch-.18*finish;
  }else if(p.action==='big-hit'){
   this.rotate(locals,'mixamorig:Spine',1,0,0,.34*pulse);this.rotate(locals,side>=0?'mixamorig:RightShoulder':'mixamorig:LeftShoulder',1,0,0,-.42*pulse);this.rotate(locals,'mixamorig:Head',1,0,0,-.10*pulse);
  }else if(p.action==='slide'){
   locals[hips].t[1]-=.28*pulse;this.rotate(locals,'mixamorig:Spine',1,0,0,-.20*pulse);this.rotate(locals,'mixamorig:LeftLeg',1,0,0,.34*pulse);this.rotate(locals,'mixamorig:RightLeg',1,0,0,.34*pulse);
  }
  if(p.catchT>0){
   const catchPulse=Math.sin(clamp(1-p.catchT/.45,0,1)*Math.PI),style=p.catchStyle||'rac';
   if(style==='aggressive'){
    this.rotate(locals,'mixamorig:LeftArm',1,0,0,-.78*catchPulse);this.rotate(locals,'mixamorig:RightArm',1,0,0,-.78*catchPulse);
    const hips=this.joints[0];locals[hips].t[1]+=.18*catchPulse;
   }else if(style==='secure'){
    this.rotate(locals,'mixamorig:LeftForeArm',0,1,0,.32*catchPulse);this.rotate(locals,'mixamorig:RightForeArm',0,1,0,-.32*catchPulse);
    this.rotate(locals,'mixamorig:Spine',1,0,0,.13*catchPulse);
   }else this.rotate(locals,'mixamorig:Spine2',1,0,0,-.12*catchPulse);
  }
  if(p.reactionT>0){
   const reaction=Math.sin(clamp(p.reactionT,0,1)*Math.PI);
   this.rotate(locals,'mixamorig:Spine2',0,0,1,(p.reactionSide||1)*.24*reaction);
   this.rotate(locals,'mixamorig:Head',0,1,0,-(p.reactionSide||1)*.15*reaction);
  }
 }
 blendLocals(p,locals,time,state){
  const previous=this.poseStates.get(p.index),fresh=!previous||previous.actor!==p||time<previous.time||time-previous.time>.3;
  if(fresh){this.poseStates.set(p.index,{actor:p,time,state,fromState:state,locals,fromLocals:locals,stateStarted:time,transitioning:false});return locals}
  let entry=previous;if(previous.state!==state)entry={actor:p,time,state,fromState:previous.state,locals:previous.locals,fromLocals:previous.locals,stateStarted:time,transitioning:true};
  if(!entry.transitioning){this.poseStates.set(p.index,{...entry,time,locals});return locals}
  const rate=meshyTransitionRate(entry.fromState,state),progress=smooth(clamp((time-entry.stateStarted)*rate/2.4,0,1)),blended=locals.map((node,index)=>({t:lerpArray(entry.fromLocals[index].t,node.t,progress),r:slerp(entry.fromLocals[index].r,node.r,progress),s:lerpArray(entry.fromLocals[index].s,node.s,progress)})),transitioning=progress<1;
  this.poseStates.set(p.index,{...entry,actor:p,time,state,locals:blended,transitioning});return blended;
 }
 bonesFor(p,phase,time){
  const choice=this.choose(p,phase,time);let locals=this.poseLocals(choice.base,choice.baseTime);if(choice.overlay!==null)locals=this.mixLocals(locals,this.poseLocals(choice.overlay,choice.overlayTime),choice.overlayWeight);
  // Remove excessive source-root bob before adding intentional football
  // crouches, catches and skills. This keeps feet believable on mobile.
  const hips=this.joints[0],baseY=this.base[hips].t[1],profile=ROLE_MOTION_PROFILES[p.role]||ROLE_MOTION_PROFILES.LB;locals[hips].t[1]=baseY+clamp(locals[hips].t[1]-baseY,-.10,.14)*profile.root;
  this.applyFootballPose(locals,p,phase,time,choice.state);
  if(!p.fallen&&!p.engaged&&usesGroundedStride(choice.state))this.groundedLocomotion(locals,p,choice.state);
  if(!p.fallen&&p.contactRole==='tackler'){if(Math.hypot(p.vx||0,p.vz||0)>.3)this.groundedLocomotion(locals,p,'run');else this.standingPose(locals,p,.12,.18)}
  if(choice.state==='break-tackle'||choice.state==='stumble')this.rotate(locals,'mixamorig:Spine2',0,0,1,(p.actionSide||1)*.13*Math.sin((p.actionT||0)*Math.PI));
  if(choice.state==='idle'||choice.state==='qb-pocket'||choice.state==='receive-snap')this.standingPose(locals,p);
  if(choice.state==='handoff'||choice.state==='receive-handoff'){if(Math.hypot(p.vx||0,p.vz||0)>.3)this.groundedLocomotion(locals,p,'run');else this.standingPose(locals,p)}
  if(p.role==='QB'&&(/qb-pocket|qb-drop|qb-climb|qb-rollout|receive-snap/.test(choice.state)||choice.state.startsWith('throw-')))this.quarterbackPose(locals,p,choice.state);
  if((phase==='pre'&&p.index===2)||choice.state==='snap')this.standingPose(locals,p,.32,.66);
  if(choice.state==='get-up')this.getUpPose(locals,p);
  if(phase==='pre')this.readyPose(locals,p);
  else if(p.engaged&&!p.fallen)this.blockPose(locals,p,time);
  else if(p.hasBall&&(/^carry-|^qb-scramble|break-tackle|stumble/.test(choice.state)||p.fallen))this.carryPose(locals,p);
  if(p.fallen&&/wrap|gang|tackle|hit|pancake/.test(choice.state))this.contactPose(locals,p);
  if(phase==='pre'){
   const seed=meshyPlaybackSeed(p.index,p.team),breath=Math.sin(time*(1.25+seed.rate*.22)+seed.offset*Math.PI*2),scan=Math.sin(time*(.38+seed.rate*.08)+seed.offset*Math.PI*2);
   const spine=this.namedNodes['mixamorig:Spine2'],head=this.namedNodes['mixamorig:Head'];
   if(Number.isInteger(spine))locals[spine].r=quatMul(locals[spine].r,axisQuat(1,0,0,breath*.012));
   if(Number.isInteger(head))locals[head].r=quatMul(locals[head].r,axisQuat(0,1,0,scan*((p.role==='QB'||p.role==='LB') ? .09 : .045)));
  }
  locals=this.blendLocals(p,locals,time,choice.state);
  // Gameplay owns world locomotion. Keep only the vertical bounce in root motion.
  locals[hips].t[0]=this.base[hips].t[0];locals[hips].t[2]=this.base[hips].t[2];
  let world=new Array(locals.length);const resolve=index=>world[index]||(world[index]=this.parents[index]<0?compose(locals[index].t,locals[index].r,locals[index].s):mul(resolve(this.parents[index]),compose(locals[index].t,locals[index].r,locals[index].s)));
  const capture=()=>{
   const transforms={};for(const [key,name]of Object.entries({left:'LeftHand',right:'RightHand',leftForearm:'LeftForeArm',rightForearm:'RightForeArm',chest:'Spine2'})){const i=this.namedNodes['mixamorig:'+name];transforms[key]=Number.isInteger(i)?resolve(i):null}this.handTransforms.set(p.index,transforms);
   const bones=new Float32Array(this.joints.length*16);this.joints.forEach((joint,i)=>bones.set(mul(resolve(joint),this.inverseBind.subarray(i*16,i*16+16)),i*16));this.supportPoints.set(p.index,skinSupportVertices(this.supportVertices,bones));return bones;
  };
  let bones=capture();
  if(this.worldHandTargets(locals,p,this.modelFor(p))){world=new Array(locals.length);bones=capture()}
  return bones;
 }

 modelFor(p){
  const builds={OL:[1.14,1.025,1.09],DL:[1.12,1.035,1.10],QB:[.98,1.02,.98],RB:[1.04,.985,1.02],WR:[.94,1.015,.94],TE:[1.07,1.045,1.05],LB:[1.075,1.025,1.06],DB:[.93,1,.94]},build=builds[p.role]||[1,1,1],variation=1+((p.index%5)-2)*.006;
  let lift=0,pitch=0,roll=0,yaw=0;if(p.action==='hurdle')lift=Math.sin((p.actionT||0)*Math.PI)*.68;if(p.action==='truck')pitch=.29*Math.sin((p.actionT||0)*Math.PI);if(p.action==='juke')roll=-(p.actionSide||0)*.22*Math.sin((p.actionT||0)*Math.PI);if(p.action==='spin')yaw=(p.actionSide||1)*(p.actionT||0)*Math.PI*2;
  if(!p.fallen&&!p.engaged&&Math.hypot(p.vx||0,p.vz||0)>1){const direction=Math.atan2(p.vx||0,p.vz||0),turn=Math.atan2(Math.sin(direction-(p.heading||0)),Math.cos(direction-(p.heading||0)));roll+=clamp(-turn*.24,-.16,.16)}
  if(p.action==='break-tackle')roll+=(p.actionSide||1)*.18*Math.sin((p.actionT||0)*Math.PI);if(p.action==='miss')pitch+=.34*Math.sin((p.actionT||0)*Math.PI);if(p.engaged)pitch+=.11;if(p.reactionT>0)roll+=(p.reactionSide||1)*.12*Math.sin(clamp(p.reactionT,0,1)*Math.PI);
  const contactFall=p.fallen&&/tackle|hit|gang|wrap|slide|dive|pancake|miss/.test(p.action||''),fallProgress=p.action==='get-up'?1-smooth(p.actionT||0):contactFall?smooth(((p.actionT||0)-.20)/.78):p.fallen?1:0;
  const fall=fallProgress*(p.action==='slide'?1.30:p.action==='dive'?1.53:1.48),fallRoll=fallProgress*(p.actionSide||1)*(p.hasBall?-.68:.38);
  const heading=(p.heading||0)+yaw,fallHeading=Number.isFinite(p.fallHeading)?p.fallHeading:heading;
  // Both bodies fall with the impact, even when the defender faces the runner.
  const fallBasis=mul(ry(fallHeading),mul(rx(fall),ry(heading-fallHeading)));
  const basis=mul(fallBasis,mul(rx(pitch),mul(rz(roll+fallRoll),scale(1.17*build[0]*variation,1.17*build[1]/variation,1.17*build[2]*variation))));
  const points=this.supportPoints.get(p.index)||[],floor=points.length?Math.min(...points.map(v=>basis[1]*v[0]+basis[5]*v[1]+basis[9]*v[2])):0;
  const plant=['pre','snap','handoff'].includes(this.phase)||p.engaged||p.fallen||usesGroundedStride(meshyAnimationState(p,this.phase))||Math.hypot(p.vx||0,p.vz||0)<.2,correction=plant?floor:Math.min(0,floor);
  return mul(translate(p.x,lift+.02-correction,p.z),basis);
 }

 queueShadows(actors,phase,time){
  if(!this.ready||!this.renderer.shadowAvailable)return false;this.phase=phase;this.actorMap=new Map(actors.map(p=>[p.index,p]));this.frameBones=new Map(actors.map(p=>[p.index,this.bonesFor(p,phase,time)]));
  this.renderer.queueShadowCaster(lightVP=>{const gl=this.gl;gl.useProgram(this.depthProgram);gl.bindVertexArray(this.vao);gl.uniformMatrix4fv(this.depthUniforms.lightVP,false,lightVP);for(const p of actors){gl.uniformMatrix4fv(this.depthUniforms.model,false,this.modelFor(p));gl.uniformMatrix4fv(this.depthUniforms.bones,false,this.frameBones.get(p.index));gl.drawElements(gl.TRIANGLES,this.indexCount,this.indexType,0)}gl.bindVertexArray(null);return actors.length});return true;
 }
 draw(actors,phase,time){if(!this.ready)return false;this.phase=phase;this.actorMap=new Map(actors.map(p=>[p.index,p]));const gl=this.gl;this.lastStates=actors.map(p=>meshyAnimationState(p,phase));gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.uniformMatrix4fv(this.uniforms.vp,false,this.renderer.vp);gl.uniform3fv(this.uniforms.eye,this.renderer.eye);for(let i=0;i<3;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i])}gl.uniform1i(this.uniforms.baseMap,0);gl.uniform1i(this.uniforms.normalMap,1);gl.uniform1i(this.uniforms.ormMap,2);gl.uniform1i(this.uniforms.numberMap,3);gl.disable(gl.BLEND);gl.depthMask(true);
  for(const p of actors){const bones=this.frameBones?.get(p.index)||this.bonesFor(p,phase,time);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.renderer.textures.get('meshy-number-'+p.team+'-'+p.number));gl.uniformMatrix4fv(this.uniforms.model,false,this.modelFor(p));gl.uniformMatrix4fv(this.uniforms.bones,false,bones);gl.uniform1f(this.uniforms.rival,p.team?1:0);gl.uniform1f(this.uniforms.controlled,p.hasBall?1:0);gl.uniform1f(this.uniforms.playerSeed,((p.index*37+p.team*11)%17)/16);gl.drawElements(gl.TRIANGLES,this.indexCount,this.indexType,0);this.renderer.drawCalls++}
  this.frameBones=null;gl.bindVertexArray(null);return true;
 }
 ballAnchor(p){
  const phase=arguments[1]||this.phase||'run';if(!this.ready||!p)return null;const hands=this.handTransforms.get(p.index);if(!hands)return null;
  if(p.ballTarget){const c=p.ballTarget,h=p.heading||0;return{center:[...c],a:[c[0]-.16*Math.cos(h),c[1],c[2]+.16*Math.sin(h)],b:[c[0]+.16*Math.cos(h),c[1],c[2]-.16*Math.sin(h)],hand:'both'}}
  const model=this.modelFor(p),worldPoint=(matrix,offset=[0,0,0])=>pointFromMatrix(mul(model,matrix),offset),between=(a,b,t)=>a.map((value,index)=>value+(b[index]-value)*t),normal=(a,b)=>{const v=b.map((value,index)=>value-a[index]),length=Math.hypot(...v)||1;return v.map(value=>value/length)};
  const left=hands.left&&worldPoint(hands.left),right=hands.right&&worldPoint(hands.right),chest=hands.chest&&worldPoint(hands.chest,[0,.055,-.015]);
  if(p.role==='QB'&&['pre','pass','handoff'].includes(phase)&&left&&right){const grip=between(left,right,.5),center=chest?between(grip,chest,.18):grip,axis=normal(left,right),a=center.map((value,index)=>value-axis[index]*.155),b=center.map((value,index)=>value+axis[index]*.175);return{center,a,b,hand:'both'}}
  const carryRight=(p.index+p.team)%2===1,handMatrix=(carryRight?hands.right:hands.left)||(carryRight?hands.left:hands.right),forearmMatrix=(carryRight?hands.rightForearm:hands.leftForearm)||(carryRight?hands.leftForearm:hands.rightForearm);if(!handMatrix)return null;
  const hand=worldPoint(handMatrix),elbow=forearmMatrix?worldPoint(forearmMatrix):null,forearmCenter=elbow?between(elbow,hand,.64):hand,center=chest?between(forearmCenter,chest,.12):forearmCenter,axis=elbow?normal(elbow,hand):normal(worldPoint(handMatrix,[0,0,-.2]),worldPoint(handMatrix,[0,0,.2])),a=center.map((value,index)=>value-axis[index]*.155),b=center.map((value,index)=>value+axis[index]*.175);
  if(!center.every(Number.isFinite)||!a.every(Number.isFinite)||!b.every(Number.isFinite))return null;
  return{center,a,b,hand:carryRight?'right':'left'};
 }
 diagnostics(){return{ready:this.ready,error:this.error,triangles:this.triangles,clips:this.clipNames.length,motionRecipes:Object.keys(FOOTBALL_MOTION_RECIPES).length,motionFamilies:Object.fromEntries(Object.entries(FOOTBALL_MOTION_FAMILIES).map(([family,states])=>[family,states.length])),authenticityPilot:[...AUTHENTICITY_PILOT_STATES],states:[...this.lastStates],bones:this.joints?.length||0,asset:ASSET}}
}

export function createMeshyAthletes(renderer){return new MeshyAthletes(renderer)}

// The offline render gate compiles these same athlete shaders.
export const ATHLETE_SHADERS=Object.freeze({vertex,fragment});
