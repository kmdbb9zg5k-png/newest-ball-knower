import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/combine-reactions',{recursive:true});
const fixture=`import * as T from 'three';import{loadCombineRunner}from'/combine/meshy-runner.js';import{createCombineBackground}from'/combine/background-people.js';
const runner=await loadCombineRunner({id:'test',name:'Test',position:'WR'});runner.poseJump({phase:'idle',elapsed:0,flight:1.2,height:0,visualDistance:0});
const scene=new T.Scene();scene.background=new T.Color('#53626a');scene.add(new T.HemisphereLight(0xffffff,0x465048,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-3,8,4);scene.add(light);
const bg=await createCombineBackground(scene,runner.root),group=scene.getObjectByName('combine-background-people'),waiting=group.children.filter(o=>o.name.startsWith('waiting-athlete'));
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(900,600);document.body.appendChild(renderer.domElement);const camera=new T.PerspectiveCamera(35,1.5,.01,100);camera.position.set(-1.5,2.8,-3);camera.lookAt(4.4,1,2.5);
const target=new T.Vector3(0,0,2.5);window.step=(phase='idle',frames=1,distance=2.5)=>{for(let i=0;i<frames;i++)bg.update(1/30,{phase,distance},target);renderer.render(scene,camera);};
window.inspect=()=>waiting.map(root=>{root.updateMatrixWorld(true);const bone=n=>root.getObjectByName('mixamorig'+n).getWorldPosition(new T.Vector3());const left=bone('LeftHand'),right=bone('RightHand');return {id:root.userData.playerId,appearance:root.userData.appearance,clapping:root.userData.clapping,gap:left.distanceTo(right),yaw:root.rotation.y,desired:Math.atan2(target.x-root.position.x,target.z-root.position.z),head:bone('Head').toArray(),hair:root.getObjectByName('CombineHair').children.map(o=>o.name)};});
window.switchPlayer=()=>runner.setAthlete({id:'different',name:'Different',position:'OL'});window.step('idle',60);window.ready=true;`;
const server=await createServer({server:{host:'127.0.0.1',port:3081},plugins:[{name:'reaction-test',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url==='/reactions.html'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<script type="module" src="/reactions.js"></script>'));}else next();});},resolveId(id){if(id==='/reactions.js')return '\0reactions';},load(id){if(id==='\0reactions')return fixture;}}]});await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:900,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:3081/reactions.html');await page.waitForFunction(()=>window.ready,{timeout:60000});
 await page.evaluate(()=>window.step('idle',1));
 const idle=await page.evaluate(()=>window.inspect());assert(idle.every(p=>Number.isFinite(p.gap)),'idle arms must have finite joints');assert.equal(new Set(idle.map(p=>p.appearance.skinTone)).size,3);assert.equal(new Set(idle.map(p=>p.hair.join())).size,3);assert(idle.every(p=>!p.clapping&&Math.abs(p.yaw-p.desired)<.02));
 await page.screenshot({path:'artifacts/combine-reactions/watching.png'});
 await page.evaluate(()=>window.switchPlayer());assert.deepEqual(await page.evaluate(()=>window.inspect()),idle);
 await page.evaluate(()=>window.step('flight',30));assert((await page.evaluate(()=>window.inspect())).every(p=>!p.clapping));
 await page.evaluate(()=>window.step('landed',28));const clap=await page.evaluate(()=>window.inspect());assert(clap.every(p=>p.clapping));await page.screenshot({path:'artifacts/combine-reactions/clapping.png'});
 const gaps=[];for(let i=0;i<12;i++){await page.evaluate(()=>window.step('finished',1));gaps.push((await page.evaluate(()=>window.inspect())).map(p=>p.gap));}
 for(let i=0;i<3;i++)assert(Math.max(...gaps.map(g=>g[i]))-Math.min(...gaps.map(g=>g[i]))>.07,'hands must open and close');
 await page.evaluate(()=>window.step('finished',180));assert((await page.evaluate(()=>window.inspect())).every(p=>!p.clapping));
 await page.evaluate(()=>{window.step('idle',30);window.step('finished',60,0);});assert((await page.evaluate(()=>window.inspect())).every(p=>!p.clapping),'timeout must not applaud');
 await page.evaluate(()=>{window.step('idle',30);window.step('landed',30);});assert((await page.evaluate(()=>window.inspect())).every(p=>p.clapping),'second attempt must react');
 assert.deepEqual(errors,[]);console.log('PASS independent identities, tracking, no early applause, moving hands, settle, timeout and second-attempt reactions');
}finally{await browser.close();await server.close();}
