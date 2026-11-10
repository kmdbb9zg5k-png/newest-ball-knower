import {createDrillRenderer,releaseDrillRenderer} from './startup.js';
import * as T from 'three';
import {loadCombineRunner} from './meshy-runner.js';

export type CreatorView='body'|'head'|'hoodie'|'sweats'|'trainers';
const detailFrames={
  hoodie:{target:1.36,distance:1.55,width:1.38,lift:.045},
  sweats:{target:.63,distance:1.98,width:1.12,lift:.055},
  trainers:{target:.125,distance:1.02,width:1.1,lift:.25},
};

export async function createCreatorScene(host:HTMLElement,initial:any,showroom=false){
  const mobileShowroom = showroom && typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches);
  const renderer=createDrillRenderer(T.WebGLRenderer,{
    alpha:true, antialias:!mobileShowroom, powerPreference:'low-power'
  });
  renderer.setPixelRatio(mobileShowroom ? 1 : Math.min(devicePixelRatio||1,showroom?1.5:2));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  const goldShowroom = showroom && initial.wardrobe?.top === 'top-gold-standard';
  renderer.toneMappingExposure=goldShowroom?1.42:showroom?1.17:1.35;
  renderer.domElement.setAttribute('aria-label','Interactive 3D athlete');
  host.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.05,30);
  scene.add(new T.HemisphereLight(showroom?0xffebd4:0xe4efff,showroom?0x443024:0x26322c,showroom?1.75:2.4));
  const key=new T.DirectionalLight(showroom?0xffd1a2:0xffead0,showroom?3.8:3);key.position.set(showroom?2:3,showroom?5:4,showroom?3:5);scene.add(key);
  const rim=new T.DirectionalLight(showroom?0xffbd79:0x9dcfff,showroom?3.35:3);rim.position.set(-3,2,-3);scene.add(rim);
  const fill=new T.DirectionalLight(0xffffff,showroom?1.35:1);fill.position.set(-3,1,4);scene.add(fill);
  if (goldShowroom) {
    // Softer gold-specific lighting keeps face highlights and irises readable
    // without changing the original GLB's geometry or clothing textures.
    scene.add(new T.AmbientLight(0xffedcf,.9));
    const front=new T.DirectionalLight(0xffffff,2.1);
    front.position.set(0,3,6);scene.add(front);
  }
  const floor=showroom
    ?new T.Mesh(new T.PlaneGeometry(6,6),new T.ShadowMaterial({opacity:.37,depthWrite:false}))
    :new T.Mesh(new T.CylinderGeometry(.7,.72,.035,64),new T.MeshStandardMaterial({color:0x19242b,roughness:.7,metalness:.25}));
  floor.position.y=showroom?-.014:-.045;scene.add(floor);
  const trim=showroom?new T.Mesh(new T.RingGeometry(.52,.525,96),new T.MeshBasicMaterial({color:0xd0a767,transparent:true,opacity:.66,depthWrite:false,side:T.DoubleSide})):null;
  let ticks:T.LineSegments<T.BufferGeometry,T.LineBasicMaterial>|undefined;
  if(trim){
    floor.rotation.x=-Math.PI/2;
    trim.rotation.x=-Math.PI/2;trim.position.y=-.01;scene.add(trim);
    const points=[];
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6;
      for(const radius of [.525,i%3===0?.558:.54])points.push(new T.Vector3(Math.cos(angle)*radius,-.009,Math.sin(angle)*radius));
    }
    ticks=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xc6a36c,transparent:true,opacity:.66,depthWrite:false}));
    scene.add(ticks);
    if (!mobileShowroom) {
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
      key.castShadow=true;key.shadow.mapSize.set(1024,1024);
      key.shadow.camera.left=key.shadow.camera.bottom=-1.3;
      key.shadow.camera.right=key.shadow.camera.top=1.3;
      key.shadow.normalBias=.02;key.target.position.y=.85;scene.add(key.target);
      floor.receiveShadow=true;
    }
  }
  const gold = initial.wardrobe?.top === 'top-gold-standard';
  const isSample = showroom && initial.showroomSample;
  let fullSample:Awaited<ReturnType<typeof import('./tunnel-fit-athlete').loadTunnelFitAthlete>> = null;
  let fallback:Awaited<ReturnType<typeof import('./showroom-head').loadShowroomAthlete>> = null;
  let runner:Awaited<ReturnType<typeof loadCombineRunner>>|undefined;
  let root:T.Object3D;
  try{
    if(isSample){
      fullSample=await import('./tunnel-fit-athlete').then(module=>module.loadTunnelFitAthlete(gold));
      if(!fullSample)throw new Error('The detailed showroom athlete could not load. Please retry.');
    }
    if(fullSample){
      root=fullSample;
      renderer.domElement.dataset.showroomModel=gold?'gold-standard-athlete-natural-head':'tunnel-fit-athlete';
    }else{
      runner=await loadCombineRunner(initial,showroom,Boolean(fallback));
      root=runner.root;
      if(fallback)root.add(fallback.head,...fallback.forearms.map(arm=>arm.mesh));
      if(isSample)renderer.domElement.dataset.showroomModel='standard-fallback';
    }
  }catch(error){
    releaseDrillRenderer(renderer);floor.geometry.dispose();floor.material.dispose();
    trim?.geometry.dispose();trim?.material.dispose();ticks?.geometry.dispose();ticks?.material.dispose();
    key.shadow.dispose();fallback?.dispose();throw error;
  }
  scene.add(root);
  let angle=.16,disposed=false,view:CreatorView='body',athleteHeight=initial.heightInches||72;
  function draw(){if(!disposed)renderer.render(scene,camera);}
  function resize(){
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;
    const scale=athleteHeight/72,head=1.72*scale;
    if(view==='head'){camera.position.set(0,head+.06*scale,Math.max(showroom?.78:1.18,.72/camera.aspect)*scale);camera.lookAt(0,head-.06*scale,0);}
    else if(view!=='body'){
      const {target,distance,width,lift}=detailFrames[view];
      camera.position.set(0,(target+lift)*scale,Math.max(distance,width/camera.aspect)*scale);
      camera.lookAt(0,target*scale,0);
    }
    else if(showroom){camera.position.set(0,1.23*scale,Math.max(3.58,1.74/camera.aspect)*scale);camera.lookAt(0,.96*scale,0);}
    else{camera.position.set(0,1.07,Math.max(3.9,1.9/camera.aspect));camera.lookAt(0,1.02,0);}
    camera.updateProjectionMatrix();draw();
  }
  function update(profile:any){
    athleteHeight=profile.heightInches||72;
    if(runner){runner.setAthlete(profile);runner.poseCreator(profile);fallback?.fitHands(root);}
    root.rotation.y=angle;resize();
  }
  function rotate(value:number){angle=value;root.rotation.y=angle;draw();}
  update(initial);
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  // Mobile appearance controls scroll the canvas out of view. Redraw when it
  // returns, including browsers that discard offscreen WebGL compositor tiles.
  const visibility=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))requestAnimationFrame(draw);});
  visibility.observe(host);
  return {update,rotate,capturePortrait(){
    const previousView=view,previousAngle=angle,ratio=renderer.getPixelRatio();
    try{
      view='head';angle=.16;root.rotation.y=angle;
      renderer.setPixelRatio(1);renderer.setSize(256,320,false);camera.aspect=.8;
      const scale=athleteHeight/72;camera.position.set(0,1.78*scale,1.3*scale);camera.lookAt(0,1.60*scale,0);camera.updateProjectionMatrix();draw();
      return renderer.domElement.toDataURL('image/png');
    }finally{view=previousView;angle=previousAngle;root.rotation.y=angle;renderer.setPixelRatio(ratio);resize();}
  },setView(next:CreatorView){view=next;resize();},dispose(){
    if(disposed)return;disposed=true;observer.disconnect();visibility.disconnect();
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    scene.traverse(object=>{const mesh=object as T.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material){materials.add(material);for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);}});
    runner?.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();key.shadow.dispose();releaseDrillRenderer(renderer);
  }};
}
