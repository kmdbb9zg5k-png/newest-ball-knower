import { useEffect, useRef, useState } from 'react';
import { Box3, Color, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, ACESFilmicToneMapping, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './bkf-pose.css';

// Recovered from the previously completed Frostbite Meshy 7.1 rigged asset. Keep original A-pose and materials.
// This hosted URL is a prototype dependency; move it to durable asset hosting before launch.
const SOURCE='https://v3b.fal.media/files/b/0ab1eab9/7U3TFsS4ADTIdrTSvoC8Z_rigged_character.glb';
export default function BKFFrostbitePose(){
  const host=useRef<HTMLDivElement>(null),turn=useRef<Group|null>(null);
  const [state,setState]=useState<'loading'|'ready'|'unavailable'|'failed'>('loading');
  const [message,setMessage]=useState('');
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
    scene.background=new Color('#0b1523');
    scene.add(new HemisphereLight(0xd9efff,0x0b1525,2.1));
    const key=new DirectionalLight(0xf1faff,3.1);key.position.set(-3,6,6);scene.add(key);
    const fill=new DirectionalLight(0x8bbcff,1.6);fill.position.set(4,2,-3);scene.add(fill);
    const camera=new PerspectiveCamera(35,1,.01,100);
    camera.position.set(0,0,3.95);camera.lookAt(0,0,0);
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
      // Keep the original GLB bind pose: the upright A-pose is the only stance.
      setState('ready');
    },undefined,()=>{
      if(!stopped){setState('failed');setMessage('Could not load the 3D model. The source remains saved in fal.');}
    });
    return()=>{stopped=true;cancelAnimationFrame(raf);observer?.disconnect();turn.current=null;
      if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);
      renderer.dispose();};
  },[]);
  const rotate=(amount:number)=>{if(turn.current)turn.current.rotation.y+=amount;};
  return <div className="bkf-pose" data-bkf-rig-preview="frostbite" data-bkf-pose="a-pose" aria-label="BKF Frostbite standing 3D preview">
    <div ref={host} className="bkf-pose-stage" role="img" aria-label="3D BKF Frostbite character standing in an A-pose. Drag to rotate."
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
      <div role="group" aria-label="Rotate character">
        <button type="button" aria-label="Rotate left" disabled={state!=='ready'} onClick={()=>rotate(-Math.PI/6)}>↶</button>
        <span>Drag to rotate · 360°</span>
        <button type="button" aria-label="Rotate right" disabled={state!=='ready'} onClick={()=>rotate(Math.PI/6)}>↷</button>
      </div>
    </div>
    <p className="bkf-pose-note">3D character preview. Clothing is not individually wearable or purchasable yet.</p>
  </div>;
}
