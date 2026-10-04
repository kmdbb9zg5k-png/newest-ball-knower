import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const output='artifacts/combine-native';await mkdir(output,{recursive:true});
const fixture=`
import * as T from 'three';import {loadCombineRunner} from '/combine/meshy-runner.js';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(720,540);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#c3c9c9');scene.add(new T.HemisphereLight(0xffffff,0x606870,2));const light=new T.DirectionalLight(0xfff8f0,3);light.position.set(3,5,4);scene.add(light);scene.add(new T.GridHelper(12,24));
const runner=await loadCombineRunner({id:'combine-qa-wr',name:'QA Receiver',position:'WR'});scene.add(runner.root);const camera=new T.PerspectiveCamera(34,720/540,.1,80);
const bone=n=>runner.root.getObjectByName('mixamorig'+n),position=n=>bone(n).getWorldPosition(new T.Vector3());
window.check=()=>{let distance=0,previous=null,maxStep=0,lowFootDrift=0,contacts=0,resetDelta=0;const dt=1/120;runner.pose(0,0,true);const initial=position('Head');
 for(let i=0;i<1440;i++){const t=i*dt,speed=t<1?9*t:t<5?9:9*Math.exp(-Math.pow((t-5)/1.35,1.5));distance+=speed*dt;runner.root.position.z=distance;runner.pose(distance,speed,false,t/.72,0,t>=5,dt);const head=position('Head');if(previous)maxStep=Math.max(maxStep,head.distanceTo(previous));previous=head;for(const side of ['Left','Right']){const foot=position(side+'Foot');if(!Number.isFinite(foot.y))throw Error('Invalid foot transform');} }
 runner.root.position.z=0;runner.pose(0,0,true);resetDelta=position('Head').distanceTo(initial);
 // The native clip must have matching endpoints after removing translation.
 const asset=runner.root.getObjectByName('CombineAthlete'),stride=asset.userData.strides.Run;
 runner.pose(0,0,true);runner.pose(0,9,false,2,0,false,dt);const first=position('LeftFoot');runner.pose(stride,9,false,2,0,false,dt);const seam=position('LeftFoot').distanceTo(first);
 return{maxHeadStep:maxStep,resetDelta,seam,stride,walkStride:asset.userData.strides.Walk,triangles:(()=>{let n=0;runner.root.traverse(o=>{if(o.isSkinnedMesh)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return n;})()};};
window.frame=(t,side=false)=>{runner.root.position.z=0;runner.pose(0,0,true);let distance=0;for(let i=0;i<=Math.round(t*60);i++){const elapsed=i/60,speed=elapsed<1?9*elapsed:elapsed<5?9:9*Math.exp(-Math.pow((elapsed-5)/1.35,1.5));distance+=speed/60;runner.pose(distance,speed,false,elapsed/.72,0,elapsed>=5,1/60);}camera.position.set(side?4.2:2.6,1.35,side?.2:3.5);camera.lookAt(0,.9,0);renderer.render(scene,camera);};window.ready=true;
`;
const server=await createServer({server:{host:'127.0.0.1',port:3070},plugins:[{name:'native-qa',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url==='/native.html'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<body style="margin:0"><script type="module" src="/native.js"></script>'));}else next();});},resolveId(id){if(id==='/native.js')return '\0native';},load(id){if(id==='\0native')return fixture;}}]});await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{const page=await browser.newPage({viewport:{width:720,height:540}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:3070/native.html');await page.waitForFunction(()=>window.ready);const metrics=await page.evaluate(()=>window.check());assert.equal(metrics.triangles,50000);assert(metrics.seam<.001,'Loop seam jumps');assert(metrics.resetDelta<.001,'Retry changes start pose');assert(metrics.maxHeadStep<.15,'Transition teleports the upper body');for(const t of[0,.15,.3,.5,.72,1,3,5,6,7,9,12]){await page.evaluate(t=>window.frame(t,true),t);await page.screenshot({path:output+'/side-'+t+'.png'});}assert.deepEqual(errors,[]);console.log('PASS native launch, full-speed loop, run/walk/idle recovery, retry and finite joints',metrics);}finally{await browser.close();await server.close();}
