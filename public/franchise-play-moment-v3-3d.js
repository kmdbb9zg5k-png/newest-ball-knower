import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const field = document.getElementById('field');
const MODEL_URL = '/models/gridiron-gold-player.glb';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (field && canRenderWebGL()) boot();
else document.body.dataset.bk3d = 'fallback';

function canRenderWebGL(){
  try{
    const probe=document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext&&probe.getContext('webgl2',{failIfMajorPerformanceCaveat:true}));
  }catch{return false}
}

function boot(){
  const canvas=document.createElement('canvas');
  canvas.className='bk-3d-layer';
  canvas.setAttribute('aria-hidden','true');
  field.prepend(canvas);

  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  }catch{
    canvas.remove();
    document.body.dataset.bk3d='fallback';
    return;
  }

  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;

  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(0,1,1,0,-1000,1000);
  camera.position.z=500;
  scene.add(new THREE.HemisphereLight(0xe9f4ff,0x102014,2.1));
  const key=new THREE.DirectionalLight(0xfff0ca,3.2);
  key.position.set(-120,240,320);
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xb7d8ff,1.7);
  fill.position.set(180,80,220);
  scene.add(fill);

  const actors=new Map();
  const clock=new THREE.Clock();
  let source=null;
  let clips=[];
  let sourceHeight=1;
  let sourceCenter=new THREE.Vector3();
  let sourceMinY=0;
  let width=0;
  let height=0;
  let disposed=false;

  new GLTFLoader().load(MODEL_URL,gltf=>{
    source=gltf.scene;
    clips=gltf.animations||[];
    const bounds=new THREE.Box3().setFromObject(source);
    const size=bounds.getSize(new THREE.Vector3());
    sourceHeight=Math.max(.001,size.y);
    sourceCenter=bounds.getCenter(new THREE.Vector3());
    sourceMinY=bounds.min.y;
    syncActors();
    if(actors.size)document.body.dataset.bk3d='ready';
  },undefined,()=>{
    document.body.dataset.bk3d='fallback';
    renderer.dispose();
    canvas.remove();
    disposed=true;
  });

  function animationMap(){
    return {
      running:clips[0],
      walking:clips[1],
      idle:clips[2]||clips[10]||clips[0],
      sprint:clips[3]||clips[0],
      throw:clips[4]||clips[0],
      catch:clips[5]||clips[0],
      block:clips[6]||clips[2]||clips[0],
      tackle:clips[7]||clips[0],
      celebrate:clips[8]||clips[2]||clips[0],
      rest:clips[10]||clips[2]||clips[0]
    };
  }

  function addActor(el){
    const root=new THREE.Group();
    const model=cloneSkinned(source);
    model.position.set(-sourceCenter.x,-sourceMinY,-sourceCenter.z);
    model.traverse(node=>{
      if(!node.isMesh)return;
      node.frustumCulled=false;
      node.castShadow=false;
      node.receiveShadow=false;
      if(el.classList.contains('defense')){
        const materials=Array.isArray(node.material)?node.material:[node.material];
        const tinted=materials.map(material=>{
          const copy=material.clone();
          if(copy.color)copy.color.lerp(new THREE.Color(0xd8e0e8),.62);
          if(copy.emissive){copy.emissive.set(0x24050a);copy.emissiveIntensity=.18}
          return copy;
        });
        node.material=Array.isArray(node.material)?tinted:tinted[0];
      }
    });
    root.add(model);
    root.rotation.y=el.classList.contains('defense')?0:Math.PI;
    scene.add(root);
    const actor={el,root,mixer:new THREE.AnimationMixer(root),action:null,actionName:''};
    actors.set(el.dataset.id,actor);
    setAction(actor,'idle',true);
  }

  function removeActor(id,actor){
    actor.mixer.stopAllAction();
    actor.root.traverse(node=>{
      if(!node.isMesh||!node.material)return;
      if(node.parent&&actor.el.classList.contains('defense')){
        const materials=Array.isArray(node.material)?node.material:[node.material];
        materials.forEach(material=>material.dispose());
      }
    });
    scene.remove(actor.root);
    actors.delete(id);
  }

  function syncActors(){
    if(!source)return;
    const present=new Map([...field.querySelectorAll('.player[data-id]')].map(el=>[el.dataset.id,el]));
    for(const [id,actor] of actors){
      if(present.get(id)!==actor.el)removeActor(id,actor);
    }
    for(const [id,el] of present){
      if(!actors.has(id))addActor(el);
    }
    if(actors.size)document.body.dataset.bk3d='ready';
  }

  function desiredAction(el){
    if(reduceMotion.matches)return 'rest';
    if(el.classList.contains('celebrate'))return 'celebrate';
    if(el.classList.contains('throw'))return 'throw';
    if(el.classList.contains('catch'))return 'catch';
    if(el.classList.contains('hit'))return 'tackle';
    if(el.classList.contains('skill')||el.classList.contains('bk-sprinting'))return 'sprint';
    if(el.classList.contains('run'))return el.classList.contains('blocker')?'block':'running';
    return 'idle';
  }

  function setAction(actor,name,immediate=false){
    if(actor.actionName===name)return;
    const clip=animationMap()[name];
    if(!clip)return;
    const next=actor.mixer.clipAction(clip);
    const oneShot=['throw','catch','tackle'].includes(name);
    next.reset();
    next.enabled=true;
    next.clampWhenFinished=oneShot;
    next.setLoop(oneShot?THREE.LoopOnce:THREE.LoopRepeat,oneShot?1:Infinity);
    next.setEffectiveTimeScale(name==='sprint'?1.18:name==='idle'?.72:1);
    next.setEffectiveWeight(1);
    if(actor.action&&!immediate)next.crossFadeFrom(actor.action,.12,true);
    else actor.action?.stop();
    next.play();
    actor.action=next;
    actor.actionName=name;
  }

  function resize(){
    const nextWidth=Math.max(1,field.clientWidth);
    const nextHeight=Math.max(1,field.clientHeight);
    if(nextWidth===width&&nextHeight===height)return;
    width=nextWidth;height=nextHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
    renderer.setSize(width,height,false);
    camera.left=0;camera.right=width;camera.top=height;camera.bottom=0;
    camera.updateProjectionMatrix();
  }

  function updateActor(actor){
    const el=actor.el;
    const x=parseFloat(el.style.left||'50');
    const y=parseFloat(el.style.top||'50');
    const style=getComputedStyle(el);
    const shiftX=parseFloat(style.getPropertyValue('--bk-shift-x'))||0;
    const shiftY=parseFloat(style.getPropertyValue('--bk-shift-y'))||0;
    const depthScale=parseFloat(style.getPropertyValue('--scale'))||1;
    const athleteHeight=Math.max(45,el.offsetHeight*depthScale*1.12);
    const scale=athleteHeight/sourceHeight;
    const footX=width*x/100+shiftX;
    const footY=height*y/100+shiftY+el.offsetHeight*depthScale*.28;
    actor.root.position.set(footX,height-footY,y*1.8);
    actor.root.scale.setScalar(scale);
    actor.root.visible=style.opacity!=='0'&&style.display!=='none';
    setAction(actor,desiredAction(el));
  }

  function frame(){
    if(disposed)return;
    requestAnimationFrame(frame);
    resize();
    syncActors();
    const dt=document.hidden?0:Math.min(clock.getDelta(),.05);
    for(const actor of actors){
      updateActor(actor[1]);
      if(!reduceMotion.matches)actor[1].mixer.update(dt);
    }
    renderer.render(scene,camera);
  }

  document.addEventListener('visibilitychange',()=>clock.getDelta());
  frame();
}
