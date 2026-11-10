import { useEffect, useRef, useState } from 'react';
import { Bone, Box3, Color, DirectionalLight, Euler, Group, HemisphereLight, PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, ACESFilmicToneMapping, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './bkf-pose.css';

// Existing fal library original: dbpirm4regj0dv5vedtg. Never modify its bind pose.
// This hosted URL is a prototype dependency; move it to durable asset hosting before launch.
const SOURCE='https://v3b.fal.media/files/b/0ab1eab7/V83xtyKKr4wmgiSU8ye4w_rigged_character.glb';
type Pose='crouch'|'neutral';
type Rig={root:Group;bones:Bone[];original:Map<Bone,{q:Quaternion;p:Vector3}>;hips:Bone|null};
const canon=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^mixamorig\d*/,'');
const find=(r:Rig,...names:string[])=>r.bones.find(b=>names.some(n=>canon(n)===canon(b.name)))??null;
function apply(r:Rig,pose:Pose){
  r.original.forEach(({q,p},b)=>{b.quaternion.copy(q);b.position.copy(p);});
  if(pose==='crouch'){
    const bend=(names:string[],x:number,y=0,z=0)=>{
      const bone=find(r,...names);
      if(bone)bone.quaternion.multiply(new Quaternion().setFromEuler(new Euler(x,y,z,'XYZ')));
    };
    // Meshy stores the joints in centimeters beneath a 0.01-scale armature.
    // A 47-unit adjustment lowers the pelvis about 47 centimeters, not 4.7 mm.
    if(r.hips)r.hips.position.y-=47;
    bend(['Spine'],.28);bend(['Spine1','Chest'],.18);
    bend(['LeftUpLeg','LeftUpperLeg'],-1.16,.13,.08);
    bend(['LeftLeg','LeftLowerLeg'],1.78);
    bend(['LeftFoot'],-.48);
    bend(['RightUpLeg','RightUpperLeg'],-1.36,-.11,-.06);
    bend(['RightLeg','RightLowerLeg'],1.55);
    bend(['RightFoot'],-.5);
    bend(['LeftArm','LeftUpperArm'],-.71,.1,-.24);
    bend(['LeftForeArm','LeftLowerArm'],1.13);
    bend(['RightArm','RightUpperArm'],-.73,-.1,.18);
    bend(['RightForeArm','RightLowerArm'],1.07);
    bend(['Neck'],-.1);bend(['Head'],-.13);
  }
  r.root.updateMatrixWorld(true);
}
export default function BKFYoungBoyPose(){
  const host=useRef<HTMLDivElement>(null),rig=useRef<Rig|null>(null),turn=useRef<Group|null>(null),cameraRef=useRef<PerspectiveCamera|null>(null);
  const [pose,setPose]=useState<Pose>('crouch');
  const [state,setState]=useState<'loading'|'ready'|'unavailable'|'failed'>('loading');
  const [message,setMessage]=useState('');
  const poseRef=useRef(pose);poseRef.current=pose;
  const drag=useRef<{x:number;start:number}|null>(null);
  useEffect(()=>{
    const mount=host.current;if(!mount)return;
    let stopped=false,raf=0,observer:ResizeObserver|null=null;
    let renderer:WebGLRenderer;
    try{renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}
    catch{setState('failed');setMessage('Your device could not initialize the 3D renderer.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    renderer.outputColorSpace=SRGBColorSpace;
    renderer.toneMapping=ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.2;
    mount.appendChild(renderer.domElement);
    const scene=new Scene();
    scene.background=new Color('#15100b');
    scene.add(new HemisphereLight(0xffe5bb,0x151825,2.1));
    const key=new DirectionalLight(0xffe3bd,3.1);key.position.set(-3,6,6);scene.add(key);
    const fill=new DirectionalLight(0xe3e9ff,1.6);fill.position.set(4,2,-3);scene.add(fill);
    const camera=new PerspectiveCamera(35,1,.01,100);
    cameraRef.current=camera;
    camera.position.set(0,-.43,3.3);camera.lookAt(0,-.43,0);
    const pivot=new Group();scene.add(pivot);turn.current=pivot;
    const resize=()=>{
      if(stopped)return;
      const w=Math.max(mount.clientWidth,1),h=Math.max(mount.clientHeight,1);
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    };
    observer=new ResizeObserver(resize);observer.observe(mount);resize();
    const paint=()=>{if(stopped)return;raf=requestAnimationFrame(paint);renderer.render(scene,camera);};paint();
    new GLTFLoader().load(SOURCE,gltf=>{
      if(stopped)return;
      const root=gltf.scene;
      const bounds=new Box3().setFromObject(root);
      const size=bounds.getSize(new Vector3());
      if(!Number.isFinite(size.y)||size.y<=0){
        setState('failed');setMessage('The asset has invalid geometry.');return;
      }
      root.scale.multiplyScalar(1.9/size.y);
      const center=new Box3().setFromObject(root).getCenter(new Vector3());
      root.position.sub(center);
      pivot.add(root);
      const bones:Bone[]=[];
      root.traverse(x=>{if((x as Bone).isBone)bones.push(x as Bone);});
      const original=new Map<Bone,{q:Quaternion;p:Vector3}>();
      bones.forEach(b=>original.set(b,{q:b.quaternion.clone(),p:b.position.clone()}));
      const found:Rig={root,bones,original,hips:null};found.hips=find(found,'Hips','Pelvis');
      rig.current=found;
      if(!found.hips||!find(found,'LeftUpLeg','LeftUpperLeg')||!find(found,'RightUpLeg','RightUpperLeg')||
        !find(found,'LeftLeg','LeftLowerLeg')||!find(found,'RightLeg','RightLowerLeg')){
        setState('unavailable');setMessage('3D character loaded, but this rig needs joint mapping to support the crouch.');
      }else{apply(found,poseRef.current);setState('ready');}
    },undefined,()=>{
      if(!stopped){setState('failed');setMessage('Could not load the 3D model. The source remains saved in fal.');}
    });
    return()=>{stopped=true;cancelAnimationFrame(raf);observer?.disconnect();rig.current=null;turn.current=null;cameraRef.current=null;
      if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);
      renderer.dispose();};
  },[]);
  const change=(next:Pose)=>{if(state!=='ready'||!rig.current)return;apply(rig.current,next);setPose(next);
    const camera=cameraRef.current;if(camera){const y=next==='crouch'?-0.43:0,z=next==='crouch'?3.3:3.95;camera.position.set(0,y,z);camera.lookAt(0,y,0);}};
  const rotate=(amount:number)=>{if(turn.current)turn.current.rotation.y+=amount;};
  return <div className="bkf-pose" data-bkf-rig-preview="youngboy" aria-label="BKF YoungBoy 3D pose preview">
    <div ref={host} className="bkf-pose-stage" role="img" aria-label="3D BKF YoungBoy character. Drag to rotate."
      onPointerDown={event=>{if(state!=='ready'||!turn.current)return;
        drag.current={x:event.clientX,start:turn.current.rotation.y};
        event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{if(drag.current&&turn.current)
        turn.current.rotation.y=drag.current.start+(event.clientX-drag.current.x)*.012;}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
      onLostPointerCapture={()=>{drag.current=null;}}/>
    {state==='loading'&&<p className="bkf-pose-loading" role="status">Loading original rigged 3D athlete…</p>}
    {(state==='failed'||state==='unavailable')&&<p className="bkf-pose-loading" role="status">{message}</p>}
    <div className="bkf-pose-controls">
      <div role="group" aria-label="Select stance">
        <button type="button" aria-pressed={pose==='crouch'} disabled={state!=='ready'} onClick={()=>change('crouch')}>Signature crouch</button>
        <button type="button" aria-pressed={pose==='neutral'} disabled={state!=='ready'} onClick={()=>change('neutral')}>Original A-pose</button>
      </div>
      <div role="group" aria-label="Rotate character">
        <button type="button" aria-label="Rotate left" disabled={state!=='ready'} onClick={()=>rotate(-Math.PI/6)}>↶</button>
        <span>Drag to rotate · 360°</span>
        <button type="button" aria-label="Rotate right" disabled={state!=='ready'} onClick={()=>rotate(Math.PI/6)}>↷</button>
      </div>
    </div>
    <p className="bkf-pose-note">Experimental character pose preview. Clothing is not individually wearable or purchasable yet.</p>
  </div>;
}
