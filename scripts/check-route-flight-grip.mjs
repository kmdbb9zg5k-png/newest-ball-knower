import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:3086}});await server.listen();
const browser=await chromium.launch({executablePath:'/tmp/bk-browser/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:600,height:600}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/grip',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await p.goto('http://127.0.0.1:3086/grip');
 const checks=await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{loadCombineRunner}=await import('/combine/meshy-runner.js'),{createRoutePresentation}=await import('/combine/route-presentation.js'),{newRoute}=await import('/combine/routes.js');
  const player={id:'receiver-qa',name:'Receiver',position:'WR'},runner=await loadCombineRunner(player),scene=new T.Scene(),camera=new T.PerspectiveCamera(53,390/680,.05,160);scene.add(runner.root,new T.HemisphereLight(0xffffff,0x444444,3));scene.background=new T.Color('#334449');
  const pres=await createRoutePresentation(scene,runner,camera,document.body,player),s=newRoute(player,1);pres.draw(s,.1);
  const ball=scene.getObjectByName('receiver-drill-football'),qb=scene.children.find(o=>o.userData.playerId==='combine-quarterback-114'),position=ball.position.clone(),quaternion=ball.quaternion.clone();
  for(let i=0;i<20;i++)pres.draw(s,.05);
  const heldStable=ball.position.distanceTo(position)<1e-6&&ball.quaternion.angleTo(quaternion)<1e-6;
  const palms=[];qb.traverse(o=>{if(o.isBone&&/HandMiddle1$/.test(o.name))palms.push(o.getWorldPosition(new T.Vector3()));});
  const gripDistance=Math.min(...palms.map(p=>p.distanceTo(ball.position)));
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(600,600);document.body.appendChild(renderer.domElement);camera.aspect=1;camera.updateProjectionMatrix();camera.position.set(5,1.8,0);camera.lookAt(3,1,-3);renderer.render(scene,camera);
  window.checkFlight=()=>{
   Object.assign(s,{phase:'flight',clock:4,throwAt:3,arrival:4.3,flight:1.3,ballTarget:[5,7],catchAt:3,x:4,z:7,vx:4.8,vz:0,distance:11,heading:Math.PI/2});pres.draw(s,.05);const before=ball.position.clone();s.x=6;pres.draw(s,.05);const fixedFlight=ball.position.distanceTo(before)<1e-6;
   s.clock=s.arrival-1e-5;pres.draw(s,.01);const contact=ball.position.clone();s.clock=s.arrival;s.phase='settle';s.settle=0;s.result={caught:true};pres.draw(s,.01);const contactJump=ball.position.distanceTo(contact);
   s.settle=.6;pres.draw(s,.05);const carryQ=ball.quaternion.clone();s.settle=1;pres.draw(s,.05);const carryStable=ball.quaternion.angleTo(carryQ)<1e-6;
   camera.aspect=390/680;camera.updateProjectionMatrix();let cameraSafe=true,receiverVisible=true;
   for(const x of [-45,-14,-8,0,8,14,45]){s.x=x;s.z=24;for(let i=0;i<35;i++)pres.draw(s,.1);cameraSafe&&=Math.abs(camera.position.x)<60;const projected=new T.Vector3(x,1,24).project(camera);receiverVisible&&=Math.abs(projected.x)<.95&&Math.abs(projected.y)<.95;}
   return {fixedFlight,contactJump,carryStable,cameraSafe,receiverVisible};
  };
  window.cleanup=()=>{pres.dispose();runner.dispose();renderer.dispose();};return {heldStable,gripDistance};
 });
 assert(checks.heldStable);assert(checks.gripDistance<.15,JSON.stringify(checks));await p.screenshot({path:'artifacts/receiver-routes/quarterback-grip-fixed.png'});
 const flight=await p.evaluate(()=>window.checkFlight());assert(flight.fixedFlight);assert(flight.contactJump<.01);assert(flight.carryStable);assert(flight.cameraSafe);assert(flight.receiverVisible);assert.deepEqual(errors,[]);await p.evaluate(()=>window.cleanup());
 console.log('PASS native QB palm grip, stationary held ball, fixed trajectory despite receiver motion, continuous catch contact, stable carried ball and camera/receiver bounds',checks,flight);
}finally{await browser.close();await server.close();}
