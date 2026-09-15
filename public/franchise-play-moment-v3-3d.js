import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const field = document.getElementById('field');
const MODEL_URL = '/models/gridiron-gold-player.glb';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const FIELD_WIDTH = 19;
const FIELD_LENGTH = 34;
const FIELD_CENTER_Z = -5;
const LOS_Z = percentToWorldZ(89);
const FIRST_DOWN_Z = percentToWorldZ(68);

if(field){document.body.dataset.bk3d='loading';boot()}
else document.body.dataset.bk3d='fallback';

function boot(){
  const canvas=document.createElement('canvas');
  canvas.className='bk-3d-layer';
  canvas.setAttribute('aria-hidden','true');
  field.prepend(canvas);

  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true,powerPreference:'high-performance'});
  }catch(error){
    console.error('[Ball Knower 3D] WebGL renderer failed',error);
    canvas.remove();
    document.body.dataset.bk3d='fallback';
    return;
  }

  renderer.setClearColor(0x03130f,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.14;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x03130f);
  scene.fog=new THREE.FogExp2(0x03130f,.028);
  const camera=new THREE.PerspectiveCamera(35,1,.1,100);
  scene.add(new THREE.HemisphereLight(0xcbe8ff,0x07120c,2.5));
  const key=new THREE.DirectionalLight(0xffe9af,4.1);
  key.position.set(-8,15,10);
  scene.add(key);
  const fill=new THREE.DirectionalLight(0x9bc8ff,2.2);
  fill.position.set(10,8,4);
  scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffcc58,1.9);
  rim.position.set(0,7,-18);
  scene.add(rim);
  createStadium(scene);
  const football=createFootball();
  scene.add(football);

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
  let routeSignature='';
  const routeGroup=new THREE.Group();
  scene.add(routeGroup);

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
  },undefined,error=>{
    console.error('[Ball Knower 3D] Player model failed to load',error);
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
    const shadow=new THREE.Mesh(
      new THREE.CircleGeometry(.58,20),
      new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.42,depthWrite:false})
    );
    shadow.rotation.x=-Math.PI/2;
    shadow.position.y=.015;
    root.add(shadow);
    const selector=new THREE.Mesh(
      new THREE.RingGeometry(.52,.65,26),
      new THREE.MeshBasicMaterial({color:0xf6d260,transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide})
    );
    selector.rotation.x=-Math.PI/2;
    selector.position.y=.025;
    selector.visible=false;
    selector.userData.isSelector=true;
    root.add(selector);
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
    const aspect=width/height;
    camera.aspect=aspect;
    camera.fov=aspect<.82?48:aspect<1.25?41:35;
    camera.position.set(0,aspect<.82?15:9.2,aspect<.82?23:22);
    camera.lookAt(0,.55,aspect<.82?-4:-3);
    camera.updateProjectionMatrix();
  }

  function updateActor(actor){
    const el=actor.el;
    const x=parseFloat(el.style.left||'50');
    const y=parseFloat(el.style.top||'50');
    const style=getComputedStyle(el);
    const shiftX=parseFloat(style.getPropertyValue('--bk-shift-x'))||0;
    const shiftY=parseFloat(style.getPropertyValue('--bk-shift-y'))||0;
    const roleScale=el.classList.contains('blocker')?1.07:el.classList.contains('defense')?1.02:1;
    const scale=1.86*roleScale/sourceHeight;
    const worldX=percentToWorldX(x)+(shiftX/Math.max(1,width))*FIELD_WIDTH;
    const worldZ=percentToWorldZ(y)+(shiftY/Math.max(1,height))*FIELD_LENGTH;
    actor.root.position.set(worldX,.025,worldZ);
    actor.root.renderOrder=Math.round(100-worldZ*2);
    actor.root.scale.setScalar(scale);
    actor.root.visible=style.opacity!=='0'&&style.display!=='none';
    const selector=actor.root.children.find(child=>child.userData.isSelector);
    if(selector)selector.visible=el.classList.contains('open')||el.classList.contains('runner');
    setAction(actor,desiredAction(el));
  }

  function syncFootball(dt){
    const ball=document.getElementById('ball');
    if(!ball)return;
    const style=getComputedStyle(ball);
    football.visible=style.display!=='none'&&style.opacity!=='0';
    if(!football.visible)return;
    const x=Number.parseFloat(ball.style.left||'50');
    const y=Number.parseFloat(ball.style.top||'88');
    football.position.set(percentToWorldX(x),1.1,percentToWorldZ(y));
    football.rotation.x+=dt*10;
    football.rotation.z+=dt*6;
  }

  function syncRoutes(){
    const routeLayer=document.getElementById('routes');
    if(!routeLayer)return;
    const signature=routeLayer.innerHTML;
    if(signature!==routeSignature){
      routeSignature=signature;
      while(routeGroup.children.length){
        const child=routeGroup.children[0];
        routeGroup.remove(child);
        child.geometry?.dispose();
        child.material?.dispose();
      }
      for(const path of routeLayer.querySelectorAll('path')){
        const raw=(path.getAttribute('d')||'').match(/-?\d+(?:\.\d+)?/g)||[];
        const points=[];
        for(let i=0;i+1<raw.length;i+=2){
          points.push(new THREE.Vector3(percentToWorldX(Number(raw[i])),.055,percentToWorldZ(Number(raw[i+1]))));
        }
        if(points.length<2)continue;
        const geometry=new THREE.BufferGeometry().setFromPoints(points);
        const color=path.classList.contains('slot')?0xff76a9:path.classList.contains('z')?0x54d9ff:0xf6d260;
        const material=new THREE.LineDashedMaterial({color,transparent:true,opacity:.92,dashSize:.42,gapSize:.3,depthTest:true});
        const line=new THREE.Line(geometry,material);
        line.computeLineDistances();
        routeGroup.add(line);
      }
    }
    const opacity=Number.parseFloat(getComputedStyle(routeLayer).opacity)||0;
    routeGroup.children.forEach(line=>{line.material.opacity=.92*opacity});
  }

  function frame(){
    if(disposed)return;
    requestAnimationFrame(frame);
    resize();
    syncActors();
    syncRoutes();
    const dt=document.hidden?0:Math.min(clock.getDelta(),.05);
    for(const actor of actors){
      updateActor(actor[1]);
      if(!reduceMotion.matches)actor[1].mixer.update(dt);
    }
    syncFootball(dt);
    renderer.render(scene,camera);
  }

  document.addEventListener('visibilitychange',()=>clock.getDelta());
  frame();
}

function percentToWorldX(percent){
  return (percent-50)/100*FIELD_WIDTH;
}

function percentToWorldZ(percent){
  return (percent-72)/100*FIELD_LENGTH;
}

function createStadium(scene){
  const turf=new THREE.MeshStandardMaterial({color:0x0c5b35,roughness:.94,metalness:0});
  const stripeA=new THREE.MeshStandardMaterial({color:0x12683e,roughness:.95});
  const stripeB=new THREE.MeshStandardMaterial({color:0x0c5633,roughness:.95});
  const white=new THREE.MeshBasicMaterial({color:0xe7eadc,transparent:true,opacity:.82});
  const gold=new THREE.MeshBasicMaterial({color:0xefc85b});
  const cyan=new THREE.MeshBasicMaterial({color:0x42b7ff,transparent:true,opacity:.86});

  const fieldPlane=new THREE.Mesh(new THREE.PlaneGeometry(FIELD_WIDTH,FIELD_LENGTH),turf);
  fieldPlane.rotation.x=-Math.PI/2;
  fieldPlane.position.set(0,0,FIELD_CENTER_Z);
  scene.add(fieldPlane);

  for(let i=0;i<10;i++){
    const stripe=new THREE.Mesh(new THREE.PlaneGeometry(FIELD_WIDTH,FIELD_LENGTH/10),i%2?stripeA:stripeB);
    stripe.rotation.x=-Math.PI/2;
    stripe.position.set(0,.004,FIELD_CENTER_Z-FIELD_LENGTH/2+FIELD_LENGTH/20+i*FIELD_LENGTH/10);
    scene.add(stripe);
  }

  const endzone=new THREE.Mesh(new THREE.PlaneGeometry(FIELD_WIDTH,3.4),new THREE.MeshStandardMaterial({color:0x07131c,roughness:.9}));
  endzone.rotation.x=-Math.PI/2;
  endzone.position.set(0,.012,FIELD_CENTER_Z-FIELD_LENGTH/2+1.7);
  scene.add(endzone);
  scene.add(makeEndzoneWordmark());

  for(let i=0;i<=10;i++){
    const z=FIELD_CENTER_Z-FIELD_LENGTH/2+i*FIELD_LENGTH/10;
    scene.add(marking(FIELD_WIDTH,.035,z,white));
    if(i>0&&i<10){
      for(const x of [-3.2,3.2]){
        for(let j=-3;j<=3;j++){
          const hash=new THREE.Mesh(new THREE.PlaneGeometry(.32,.055),white);
          hash.rotation.x=-Math.PI/2;
          hash.position.set(x+j*.7,.022,z+.18);
          scene.add(hash);
        }
      }
    }
  }
  for(const x of [-FIELD_WIDTH/2,FIELD_WIDTH/2]){
    const sideline=new THREE.Mesh(new THREE.PlaneGeometry(.08,FIELD_LENGTH),white);
    sideline.rotation.x=-Math.PI/2;
    sideline.position.set(x,.025,FIELD_CENTER_Z);
    scene.add(sideline);
  }
  scene.add(marking(FIELD_WIDTH,.065,LOS_Z,cyan));
  scene.add(marking(FIELD_WIDTH,.065,FIRST_DOWN_Z,gold));

  const rearStand=new THREE.Mesh(
    new THREE.BoxGeometry(31,7,4.5),
    new THREE.MeshStandardMaterial({color:0x071019,roughness:.78,metalness:.18})
  );
  rearStand.position.set(0,3,-25.4);
  rearStand.rotation.x=-.13;
  scene.add(rearStand);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(30,.12,.12),gold);
  rail.position.set(0,1.1,-23.05);
  scene.add(rail);

  const crowdPositions=[];
  let seed=417;
  const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
  for(let i=0;i<950;i++){
    crowdPositions.push((random()-.5)*29,1.5+random()*4.7,-23.05-random()*3.8);
  }
  const crowdGeometry=new THREE.BufferGeometry();
  crowdGeometry.setAttribute('position',new THREE.Float32BufferAttribute(crowdPositions,3));
  const crowd=new THREE.Points(crowdGeometry,new THREE.PointsMaterial({color:0xd6bd73,size:.085,transparent:true,opacity:.72,sizeAttenuation:true}));
  scene.add(crowd);

  const postMaterial=new THREE.MeshBasicMaterial({color:0xffd84c});
  const upright=(radius,length)=>new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,10),postMaterial);
  const stem=upright(.055,4.2);stem.position.set(0,2.1,-20.2);scene.add(stem);
  const crossbar=upright(.05,4.4);crossbar.rotation.z=Math.PI/2;crossbar.position.set(0,3.1,-20.2);scene.add(crossbar);
  for(const x of [-2.15,2.15]){const arm=upright(.045,3.2);arm.position.set(x,4.65,-20.2);scene.add(arm)}

  for(const x of [-10.8,-7.2,7.2,10.8]){
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:0xfff3cb}));
    bulb.position.set(x,7.1,-22.2);
    scene.add(bulb);
    const glow=new THREE.PointLight(0xffe6a4,5.2,17,2);
    glow.position.copy(bulb.position);
    scene.add(glow);
  }
}

function marking(width,depth,z,material){
  const line=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),material);
  line.rotation.x=-Math.PI/2;
  line.position.set(0,.02,z);
  return line;
}

function makeEndzoneWordmark(){
  const textureCanvas=document.createElement('canvas');
  textureCanvas.width=1024;
  textureCanvas.height=256;
  const context=textureCanvas.getContext('2d');
  context.clearRect(0,0,1024,256);
  context.fillStyle='#e8c55e';
  context.textAlign='center';
  context.textBaseline='middle';
  context.font='900 112px Arial Black, sans-serif';
  context.fillText('BALL KNOWER',512,132);
  const texture=new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true});
  const wordmark=new THREE.Mesh(new THREE.PlaneGeometry(14.8,2.5),material);
  wordmark.rotation.x=-Math.PI/2;
  wordmark.position.set(0,.028,FIELD_CENTER_Z-FIELD_LENGTH/2+1.7);
  return wordmark;
}

function createFootball(){
  const material=new THREE.MeshStandardMaterial({color:0x6f351d,roughness:.64,metalness:.02});
  const football=new THREE.Mesh(new THREE.SphereGeometry(.16,18,12),material);
  football.scale.set(1.55,.72,.72);
  football.rotation.z=.35;
  football.visible=false;
  return football;
}
