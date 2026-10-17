import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/db-swat',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:3094}});await server.listen();
const browser=await chromium.launch({executablePath:'/tmp/bk-browser/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:480,height:640}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/swat-qa',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:3094/swat-qa');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createDefender}=await import('/combine/defender-presentation.js'),{newDBRep}=await import('/combine/db-drill.js');
  const scene=new T.Scene();scene.background=new T.Color('#293739');scene.add(new T.HemisphereLight(0xffffff,0x667755,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);
  const db=await createDefender(scene),camera=new T.PerspectiveCamera(40,480/640,.05,100);camera.position.set(3,2.1,4.7);camera.lookAt(0,1.1,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(480,640);document.body.appendChild(renderer.domElement);
  const bones={};db.root.traverse(o=>{if(o.isBone)bones[o.name.replace('mixamorig','').replace(':','')]=o;});
  window.qa={T,scene,db,camera,renderer,bones,newDBRep};
 });
 for(const [side,x,height] of [['left',.6,1.5],['right',-.6,2.0],['low',-.6,.85]]){
  await page.evaluate(({x,height})=>{const q=window.qa;q.s=q.newDBRep({id:'qa',name:'DB',position:'CB'});q.db.draw(q.s,.016);Object.assign(q.s,{phase:'flight',clock:2,arrival:2.3,throwAt:1,playChoice:'swat',ballContact:[x,height,.5]});Object.assign(q.s.db,{x:0,z:0,vx:0,vz:4,heading:0,action:'trail',ballAware:true,lookAtBall:true});},{x,height});
  const samples=[];
  for(const t of [0,.08,.16,.24,.32,.48,.68,.8]){
   samples.push(await page.evaluate(t=>{const q=window.qa,s=q.s;s.clock=2+Math.min(t,.25);s.settle=Math.max(0,t-.25);s.phase=t>=.25?'settle':'flight';s.result=t>=.25?{brokenUp:true,intercepted:false}:null;s.db.distance=t*4;q.db.draw(s,.016);q.renderer.render(q.scene,q.camera);return Object.fromEntries(['LeftHand','RightHand','LeftFoot','RightFoot'].map(k=>[k,q.bones[k].getWorldPosition(new q.T.Vector3()).toArray()]));},t));
   await page.screenshot({path:`artifacts/db-swat/${side}-${String(Math.round(t*100)).padStart(2,'0')}.png`});
  }
  const hand=side==='left'?'LeftHand':'RightHand',dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  assert(Math.max(...samples.map(s=>dist(s[hand],samples[0][hand])))>.35,'No visible swat reach');
  assert(dist(samples[2][hand],samples[4][hand])>.15,'No swipe/follow-through');
  assert(dist(samples[0].LeftFoot,samples[3].LeftFoot)>.05,'Running legs frozen');
  assert(samples.flatMap(s=>Object.values(s).flat()).every(Number.isFinite));
  console.log('PASS native swat windup, strike, follow-through, recovery and moving legs',side);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await server.close();}
