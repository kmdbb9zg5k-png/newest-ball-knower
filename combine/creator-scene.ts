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
  const renderer=createDrillRenderer(T.WebGLRenderer,{alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,showroom?2.5:2));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  renderer.domElement.setAttribute('aria-label','Interactive 3D athlete');
  host.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.05,30);
  scene.add(new T.HemisphereLight(0xe4efff,0x26322c,showroom?2.0:2.4));
  const key=new T.DirectionalLight(0xffead0,showroom?4.3:3);key.position.set(3,4,5);scene.add(key);
  const rim=new T.DirectionalLight(0x9dcfff,showroom?3.8:3);rim.position.set(-3,2,-3);scene.add(rim);
  const fill=new T.DirectionalLight(0xffffff,showroom?1.35:1);fill.position.set(-3,1,4);scene.add(fill);
  const floor=new T.Mesh(new T.CylinderGeometry(.7,.72,showroom?.065:.035,64),new T.MeshStandardMaterial({color:showroom?0x222a2d:0x19242b,roughness:.7,metalness:.25}));
  floor.position.y=showroom?-.058:-.045;scene.add(floor);
  const trim=showroom?new T.Mesh(new T.RingGeometry(.653,.658,96),new T.MeshStandardMaterial({color:0x786343,roughness:.55,metalness:.35,side:T.DoubleSide})):null;
  if(trim){
    trim.rotation.x=-Math.PI/2;trim.position.y=-.024;scene.add(trim);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=key.shadow.camera.bottom=-1.3;
    key.shadow.camera.right=key.shadow.camera.top=1.3;
    key.shadow.normalBias=.02;key.target.position.y=.85;scene.add(key.target);
    floor.receiveShadow=true;
  }
  const head = showroom && initial.showroomSample ? await import('./showroom-head').then(module=>module.loadShowroomHead()) : null;
  let runner:Awaited<ReturnType<typeof loadCombineRunner>>;
  try{runner=await loadCombineRunner(initial,showroom,Boolean(head));}catch(error){releaseDrillRenderer(renderer);floor.geometry.dispose();floor.material.dispose();trim?.geometry.dispose();trim?.material.dispose();throw error;}
  scene.add(runner.root);
  if(head){runner.root.add(head);renderer.domElement.dataset.showroomModel='high-detail';}
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
    else if(showroom){camera.position.set(0,1.04*scale,Math.max(3.62,1.84/camera.aspect)*scale);camera.lookAt(0,.96*scale,0);}
    else{camera.position.set(0,1.07,Math.max(3.9,1.9/camera.aspect));camera.lookAt(0,1.02,0);}
    camera.updateProjectionMatrix();draw();
  }
  function update(profile:any){athleteHeight=profile.heightInches||72;runner.setAthlete(profile);runner.poseCreator(profile);runner.root.rotation.y=angle;resize();}
  function rotate(value:number){angle=value;runner.root.rotation.y=angle;draw();}
  update(initial);
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  // Mobile appearance controls scroll the canvas out of view. Redraw when it
  // returns, including browsers that discard offscreen WebGL compositor tiles.
  const visibility=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))requestAnimationFrame(draw);});
  visibility.observe(host);
  return {update,rotate,capturePortrait(){
    const previousView=view,previousAngle=angle,ratio=renderer.getPixelRatio();
    try{
      view='head';angle=.16;runner.root.rotation.y=angle;
      renderer.setPixelRatio(1);renderer.setSize(256,320,false);camera.aspect=.8;
      const scale=athleteHeight/72;camera.position.set(0,1.78*scale,1.3*scale);camera.lookAt(0,1.60*scale,0);camera.updateProjectionMatrix();draw();
      return renderer.domElement.toDataURL('image/png');
    }finally{view=previousView;angle=previousAngle;runner.root.rotation.y=angle;renderer.setPixelRatio(ratio);resize();}
  },setView(next:CreatorView){view=next;resize();},dispose(){
    if(disposed)return;disposed=true;observer.disconnect();visibility.disconnect();
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    scene.traverse(object=>{const mesh=object as T.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material){materials.add(material);for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);}});
    runner.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();key.shadow.dispose();releaseDrillRenderer(renderer);
  }};
}
