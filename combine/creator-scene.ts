import {createDrillRenderer,releaseDrillRenderer} from './startup.js';
import * as T from 'three';
import {loadCombineRunner} from './meshy-runner.js';

export async function createCreatorScene(host:HTMLElement,initial:any){
  const renderer=createDrillRenderer(T.WebGLRenderer,{alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  renderer.domElement.setAttribute('aria-label','Interactive 3D athlete');
  host.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.05,30);
  scene.add(new T.HemisphereLight(0xe4efff,0x26322c,2.4));
  const key=new T.DirectionalLight(0xffead0,3);key.position.set(3,4,5);scene.add(key);
  const rim=new T.DirectionalLight(0x9dcfff,3);rim.position.set(-3,2,-3);scene.add(rim);
  const fill=new T.DirectionalLight(0xffffff,1);fill.position.set(-3,1,4);scene.add(fill);
  const floor=new T.Mesh(new T.CylinderGeometry(.7,.72,.035,64),new T.MeshStandardMaterial({color:0x19242b,roughness:.7,metalness:.25}));
  floor.position.y=-.045;scene.add(floor);
  let runner:Awaited<ReturnType<typeof loadCombineRunner>>;
  try{runner=await loadCombineRunner(initial);}catch(error){releaseDrillRenderer(renderer);floor.geometry.dispose();floor.material.dispose();throw error;}
  scene.add(runner.root);
  let angle=.16,disposed=false,view:'body'|'head'='body',athleteHeight=initial.heightInches||72;
  function draw(){if(!disposed)renderer.render(scene,camera);}
  function resize(){
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;
    const head=1.72*athleteHeight/72;
    if(view==='head'){const scale=athleteHeight/72;camera.position.set(0,head+.06*scale,Math.max(1.18,.72/camera.aspect)*scale);camera.lookAt(0,head-.06*scale,0);}
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
  },setView(next:'body'|'head'){view=next;resize();},dispose(){
    if(disposed)return;disposed=true;observer.disconnect();visibility.disconnect();
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    scene.traverse(object=>{const mesh=object as T.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material){materials.add(material);for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);}});
    runner.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();releaseDrillRenderer(renderer);
  }};
}
