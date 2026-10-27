import * as T from 'three';
// Static, batched scenery stays outside the playable lanes. No extra shadow pass.
export function addFacilityPresentation(scene,isField){
 const pieces=[],lights=[];
 const add=(x,y,z,sx,sy,sz,color,lit=false)=>{(lit?lights:pieces).push({at:[x,y,z],scale:[sx,sy,sz],color});};
 const edge=isField?28:8.8;
 for(const side of [-1,1]){
  for(let z=4;z<=55;z+=8){
   // Padded rails, identification stripes, feet and integrated task lights.
   add(side*edge,.58,z,.22,1.1,5.6,'#152b32');
   add(side*(edge-.13),.94,z,.028,.06,5.1,'#b9cd91',true);
   for(const dz of [-2,2])add(side*edge,.07,z+dz,.7,.12,.35,'#25373c');
  }
  for(let z=0;z<=60;z+=12){
   add(side*(isField?27:9),13.9,z,1.8,.06,.10,'#dbe9ee',true);
  }
 }
 // Back-wall acoustic panels and restrained gold edges frame the combine sign.
 for(let x=-18;x<=18;x+=3){
  add(x,6.2,65.72,2.7,9.4,.09,x%2?'#243840':'#2b4048');
  add(x+1.38,6.2,65.69,.025,9.3,.02,'#83976b',true);
 }
 add(0,2.55,65.45,38,.07,.08,'#c5d2a6',true);
 const geometry=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
 for(const [items,material,name] of [[pieces,new T.MeshStandardMaterial({roughness:.78,metalness:.12}),'combine-facility-panels'],[lights,new T.MeshBasicMaterial({toneMapped:false}),'combine-facility-leds']]){
  const mesh=new T.InstancedMesh(geometry,material,items.length);mesh.name=name;
  items.forEach((p,i)=>{dummy.position.set(...p.at);dummy.scale.set(...p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color(p.color));});
  mesh.receiveShadow=false;scene.add(mesh);
 }
 return {staticInstances:pieces.length+lights.length,drawCalls:2};
}
