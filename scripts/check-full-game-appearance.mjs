/** Check the actual shipped helmet geometry, skinning and both full-game routes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('docs/qa/coherent-players');await mkdir(out,{recursive:true});
async function glb(name){const bytes=await readFile(resolve(root,'play-moment-3d/assets',name));const n=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);return{bytes,json,read(index){const a=json.accessors[index],v=json.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],types={5121:['getUint8',1],5122:['getInt16',2],5123:['getUint16',2],5125:['getUint32',4],5126:['getFloat32',4]},[get,width]=types[a.componentType],view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);return Array.from({length:a.count},(_,i)=>Array.from({length:size},(_,j)=>view[get]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||size*width)+j*width,true)))}}}
const original=await glb('tripo-gridiron-pro.glb'),equipped=await glb('reference-helmeted-athlete-v1.glb'),donor=await glb('ball-knower-gridiron-sentinel-v4.glb');
const meta=equipped.json.extras.referenceEquipment,op=original.json.meshes[0].primitives[0],ep=equipped.json.meshes[0].primitives[0],hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(meta.bodySha256,hash(original.bytes));assert.equal(meta.helmetSha256,hash(donor.bytes));
assert(equipped.bytes.length<6_000_000);assert.equal(equipped.json.meshes.length,1);assert.equal(equipped.json.meshes[0].primitives.length,1);
assert(meta.helmetVertices>10_000&&meta.helmetTriangles>8_000,'The helmet and facemask must be real indexed geometry');
for(const name of ['POSITION','NORMAL','TANGENT','JOINTS_0','WEIGHTS_0'])assert.deepEqual(equipped.read(ep.attributes[name]).slice(0,meta.bodyVertices),original.read(op.attributes[name]),`${name}: original body is unchanged`);
assert.deepEqual(equipped.json.nodes,original.json.nodes);assert.deepEqual(equipped.read(equipped.json.skins[0].inverseBindMatrices),original.read(original.json.skins[0].inverseBindMatrices));
for(let i=0;i<original.json.animations.length;i++){
 const a=original.json.animations[i],b=equipped.json.animations[i];assert.deepEqual(a.channels,b.channels);
 for(let j=0;j<a.samplers.length;j++)for(const field of ['input','output'])assert.deepEqual(equipped.read(b.samplers[j][field]),original.read(a.samplers[j][field]),'Existing motion samples must be retained');
}
const joints=equipped.read(ep.attributes.JOINTS_0),weights=equipped.read(ep.attributes.WEIGHTS_0),indices=equipped.read(ep.indices).flat();
for(let i=meta.bodyVertices;i<joints.length;i++){assert.equal(joints[i][0],meta.helmetJoint);assert.deepEqual(weights[i],[255,0,0,0],'Rigid helmet must follow the head, without neck stretching')}
assert.equal(equipped.json.nodes[equipped.json.skins[0].joints[meta.helmetJoint]].name,'mixamorig:Head');
assert(indices.slice(original.read(op.indices).length).every(i=>i>=meta.bodyVertices&&i<joints.length));
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');res.setHeader('Content-Type',({'.js':'text/javascript','.glb':'model/gltf-binary','.html':'text/html','.css':'text/css'})[extname(name)]||'application/octet-stream');res.end(await readFile(name))}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const mode of ['two-minute','five-minute']){
  await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?mode=${mode}&qa=1`);await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
  const d=await page.evaluate(()=>window.bk3dDiagnostics());assert(d.athletes.asset.endsWith('/reference-helmeted-athlete-v1.glb'));assert.equal(d.athletes.triangles,indices.length/3);
  await page.locator('#breakHuddle').dispatchEvent('click');await page.evaluate(()=>window.bk3dTest.step(1));await page.screenshot({path:out+'/'+mode+'.jpg',type:'jpeg',quality:90});
  await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await page.evaluate(()=>window.bk3dTest.step(1.2));assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().glError),0);
 }
 await page.evaluate(async()=>{
  const source=await(await fetch('/play-moment-3d/game.js')).text(),url=name=>new URL(source.match(new RegExp("from'([^']*"+name+"\\.js[^']*)'"))[1],location.origin+'/play-moment-3d/game.js').href;
  const {prepareJerseys}=await import(url('athlete'));window.prepareReviewJerseys=prepareJerseys;const {Renderer,pose}=await import(url('renderer')),{MeshyAthletes}=await import(url('reference-athlete'));const begin=Renderer.prototype.begin,draw=MeshyAthletes.prototype.draw;
  Renderer.prototype.begin=function(...args){window.reviewRenderer=this;return begin.apply(this,args)};MeshyAthletes.prototype.draw=function(...args){window.reviewRig=this;return draw.apply(this,args)};window.bk3dTest.step(1/60);
  document.querySelector('#hud').style.display='none';
  window.reviewEquipment=(view='front')=>{
   const r=window.reviewRenderer,rig=window.reviewRig,players=[{role:'QB',index:5,team:0,x:-.65,z:0,heading:0,vx:0,vz:0,number:12},{role:'DB',index:12,team:1,x:.65,z:0,heading:0,vx:0,vz:0,number:24,kitPrimary:'#971b2f',kitJersey:'#edf0ed',kitTrim:'#c5a56c'}];
   if(view==='running')for(const p of players)Object.assign(p,{vx:0,vz:9,hasBall:p.team===0,distance:2,motion:{stridePhase:.3,speed:9}});
   if(view==='contact')for(const p of players)Object.assign(p,{action:'wrap',actionT:.6,fallen:true});
   window.prepareReviewJerseys(r,players);r.resize();r.fov=38;r.camera(view==='rear'?[.4,1.8,-3.5]:[.4,1.8,3.5],[0,1.35,0]);r.begin();r.add('plane',pose(0,0,0,20,1,20),[.18,.36,.21,1],'',false,0,4);const phase=view==='running'?'run':'dead';rig.poseStates.clear();rig.queueShadows(players,phase,2);r.draw();rig.draw(players,phase,2);return r.gl.getError();
  };
 });
 for(const view of ['front','rear','running','contact']){assert.equal(await page.evaluate(v=>window.reviewEquipment(v),view),0);await page.screenshot({path:out+'/'+view+'.jpg',type:'jpeg',quality:92})}
 const motion=await page.evaluate(()=>{
  const rig=window.reviewRig,results=[];
  for(const speed of [3,6,9,11]){
   rig.poseStates.clear();const p={role:'DB',index:12,team:1,x:0,z:0,heading:0,vx:0,vz:speed,number:24,distance:0,motion:{stridePhase:0,speed}};const hands=[];const clips=new Set();
   for(let f=0;f<60;f++){p.distance=speed*f/60;p.motion.stridePhase=p.distance/3.4;const choice=rig.choose(p,'run',f/60);clips.add(choice.base);rig.bonesFor(p,'run',f/60);hands.push(rig.handTransforms.get(p.index).right[14]);}
   results.push({speed,clips:[...clips],handSwing:Math.max(...hands)-Math.min(...hands)});
  }
  return results;
 });
 for(const m of motion){assert.deepEqual(m.clips,[0],'Every free pursuit speed must use the verified run cycle');assert(m.handSwing>.18,JSON.stringify(m));}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({motion}));console.log('PASS: helmet shell/facemask geometry, rigid head weights, unchanged body/skeleton/all 11 clips, both full-game routes and four equipment views, zero page or WebGL errors.');
}finally{await browser.close();server.close()}
