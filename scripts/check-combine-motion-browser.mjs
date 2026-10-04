import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const out='artifacts/combine-motion';await mkdir(out,{recursive:true});
const fixture=`import * as T from '/node_modules/three/build/three.module.js';import{loadCombineRunner}from'/combine/meshy-runner.js';import{SPRINT_CYCLE_DISTANCE}from'/combine/sprint-motion.js';
const r=new T.WebGLRenderer({antialias:true});r.setSize(720,480);r.setPixelRatio(1);r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;document.body.appendChild(r.domElement);
const s=new T.Scene();s.background=new T.Color('#c3c9c9');s.add(new T.HemisphereLight('#ffffff','#596953',3));const l=new T.DirectionalLight('#fff0df',3);l.position.set(-3,6,4);s.add(l);
const floor=new T.Mesh(new T.PlaneGeometry(12,12),new T.MeshStandardMaterial({color:'#607d50'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;s.add(floor);const grid=new T.GridHelper(12,24,'#ffffff','#849775');s.add(grid);
const runner=await loadCombineRunner({id:'combine-qa-wr',name:'QA Receiver',position:'WR'});s.add(runner.root);const camera=new T.PerspectiveCamera(36,720/480,.1,50);
window.drawPose=(p,side=false,speed=9,stance=false,distance=20,recovering=false,launch=3)=>{runner.pose(0,0,true);runner.pose(distance+p*SPRINT_CYCLE_DISTANCE*1.08,speed,stance,launch,0,recovering);camera.position.set(side?3.8:-1.7,1.55,side?.3:-3.8);camera.lookAt(0,.92,0);r.render(s,camera);};window.drawPose(0);window.ready=true;`;
const server=await createServer({server:{host:'127.0.0.1',port:3058},plugins:[{name:'motion-fixture',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url==='/motion-qa.html'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<html><body style="margin:0"><script type="module" src="/motion-qa.js"></script></body></html>'));}else next();});},resolveId(id){if(id==='/motion-qa.js')return '\0motion-qa';},load(id){if(id==='\0motion-qa')return fixture;}}]});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{const page=await browser.newPage({viewport:{width:720,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:3058/motion-qa.html');await page.waitForFunction(()=>window.ready);
for(const side of[false,true])for(let i=0;i<8;i++){await page.evaluate(({p,side})=>window.drawPose(p,side),{p:i/8,side});await page.screenshot({path:out+'/'+(side?'side':'rear')+'-'+i+'.png'});}
for(const [name,speed,stance]of[['rest',0,false],['start',0,true]]){await page.evaluate(({speed,stance})=>window.drawPose(.63,true,speed,stance),{speed,stance});await page.screenshot({path:out+'/'+name+'.png'});}
for(const [name,distance,speed,recovering]of[['drive',1,7,false],['jog',40,4,true],['walk',44,1.4,true]]){await page.evaluate(({distance,speed,recovering})=>window.drawPose(.3,true,speed,false,distance,recovering),{distance,speed,recovering});await page.screenshot({path:out+'/'+name+'.png'});}
for(const launch of [.2,.5,.8]){await page.evaluate(launch=>window.drawPose(.2,true,5,false,.5,false,launch),launch);await page.screenshot({path:out+'/launch-'+launch+'.png'});}
if(errors.length)throw Error(errors.join('\n'));console.log('PASS actual athlete rendered through the sprint cycle, start and full-body rest.');
}finally{await browser.close();await server.close();}
