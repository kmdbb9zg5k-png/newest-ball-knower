/** Real WebGL gate for the athlete materials, shaped bodies and mobile scene. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {footballGeometry} from '../public/play-moment-3d/renderer.js';
const ball=footballGeometry();
assert.ok(ball.v.every(Number.isFinite));
assert.ok(ball.ix.every(i=>i>=0&&i<ball.v.length/8));
for(let i=0;i<ball.v.length;i+=8)assert.ok(Math.abs(Math.hypot(...ball.v.slice(i+3,i+6))-1)<1e-5);
const root=resolve('public'),out=resolve(process.env.BK_GRAPHICS_OUT||'/tmp/bk-graphics-check');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');const data=await readFile(name);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.html':'text/html'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),...(process.env.BK_TEST_URL?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY}}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true,isMobile:true,ignoreHTTPSErrors:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BK_TEST_URL||`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready,{timeout:30000});
 await page.evaluate(async()=>{
  window.bk3dTest.manualFrames();const source=await(await fetch('/play-moment-3d/game.js')).text(),url=name=>new URL(source.match(new RegExp("from'([^']*"+name+"\\.js[^']*)'"))[1],location.origin+'/play-moment-3d/game.js').href;
  const {Renderer}=await import(url('renderer')),athletes=await import(url('meshy-athlete'));
  const begin=Renderer.prototype.begin,draw=athletes.MeshyAthletes.prototype.draw;
  Renderer.prototype.begin=function(){window.reviewRenderer=this;return begin.call(this)};
  athletes.MeshyAthletes.prototype.draw=function(...args){window.reviewAthletes=this;return draw.apply(this,args)};
  window.reviewAppearance=athletes;window.bk3dTest.step(1/60);
 });
 await page.locator('#filterPass').click();await page.locator('.play-card').first().click();await page.locator('#breakHuddle').click();await page.evaluate(()=>window.bk3dTest.step(1));
 await page.screenshot({path:out+'/mobile-presnap.png'});
 await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await page.evaluate(()=>window.bk3dTest.step(1.1));
 await page.screenshot({path:out+'/mobile-blocking.png'});
 let data=await page.evaluate(()=>({game:window.bk3dDiagnostics(),graphics:window.bkGraphicsDiagnostics()}));
 assert.equal(data.game.phase,'pass');assert.equal(data.game.glError,0);assert.equal(data.graphics.overflows,0);assert.ok(data.graphics.drawCalls<60);assert.ok(data.graphics.instanceBytes<2_000_000);assert.equal(data.graphics.shadowDrawCalls,22);assert.equal(data.game.athletes.bodyProfiles,8);
 await page.locator('#target-7').dispatchEvent('click',{detail:0});await page.evaluate(()=>window.bk3dTest.step(.3));assert.equal((await page.evaluate(()=>window.bk3dDiagnostics())).phase,'flight');
 await page.screenshot({path:out+'/mobile-throw.png'});
 // Transform feedback measures the actual GPU-deformed surface, not its support-point approximation.
 const surfaces=await page.evaluate(()=>{
  const rig=window.reviewAthletes,renderer=window.reviewRenderer,gl=renderer.gl,{ATHLETE_SHADERS,playerBuild}=window.reviewAppearance;
  const program=gl.createProgram(),compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);return s};
  const vs=compile(gl.VERTEX_SHADER,ATHLETE_SHADERS.vertex),fs=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.);}');
  gl.transformFeedbackVaryings(program,['world','bindPosition'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.bindVertexArray(rig.vao);const positions=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);gl.bindBuffer(gl.ARRAY_BUFFER,positions);const count=gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE)/12;
  const tf=gl.createTransformFeedback(),buffer=gl.createBuffer();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,buffer);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,count*24,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,buffer);
  const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),u=name=>gl.getUniformLocation(program,name),result=[];
  gl.useProgram(program);gl.uniformMatrix4fv(u('vp'),false,identity);gl.uniformMatrix4fv(u('lightVP'),false,identity);
  for(const role of ['QB','RB','WR','TE','OL','DL','LB','DB'])for(const action of ['pre','wrap','neutral']){
   const p={role,index:role==='QB'?5:6,team:0,x:0,z:0,heading:0,vx:0,vz:0,hasBall:role==='RB',action:action==='wrap'?'wrap':null,actionT:action==='wrap'?1:0,fallen:action==='wrap',actionSide:1};
   rig.phase=action==='pre'?'pre':'dead';rig.actorMap=new Map();rig.poseStates.clear();let bones=rig.bonesFor(p,rig.phase,1),model=rig.modelFor(p);if(action==='neutral'){bones=new Float32Array(rig.joints.length*16);for(let i=0;i<rig.joints.length;i++)bones.set(identity,i*16);model=identity;}
   gl.uniformMatrix4fv(u('model'),false,model);gl.uniformMatrix4fv(u('bones[0]'),false,bones);gl.uniform4fv(u('bodyProfile'),playerBuild(role).bulk);
   gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,count);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
   const points=new Float32Array(count*6);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,points);
   let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity;for(let i=0;i<points.length;i+=6){minY=Math.min(minY,points[i+1]);maxY=Math.max(maxY,points[i+1]);if(Math.abs(points[i+3])<.29&&points[i+4]>.86&&points[i+4]<1.05){minX=Math.min(minX,points[i]);maxX=Math.max(maxX,points[i])}}
   result.push({role,action,vertices:count,minY,maxY,width:maxX-minX,finite:points.every(Number.isFinite)});
  }
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.deleteTransformFeedback(tf);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.bindVertexArray(null);return result;
 });
 for(const surface of surfaces){assert.ok(surface.finite,JSON.stringify(surface));assert.ok(surface.action==='neutral'||surface.minY>-.065&&surface.minY<.05,JSON.stringify(surface));assert.ok(surface.maxY<2.7,JSON.stringify(surface));}
 assert.ok(surfaces.find(s=>s.role==='OL'&&s.action==='neutral').width>surfaces.find(s=>s.role==='WR'&&s.action==='neutral').width*1.1,JSON.stringify(surfaces.filter(s=>s.action==='neutral')));
 // Render a repeatable close-up of the same live player shader, including catch -> tuck.
 await page.setViewportSize({width:1108,height:620});
 const motion=await page.evaluate(async()=>{
  const {pose,segment,hex}=await import('/play-moment-3d/renderer.js'),r=window.reviewRenderer,rig=window.reviewAthletes;
  document.querySelector('#hud').style.display='none';r.resize();r.fov=38;r.camera([2.8,2.0,5.8],[0,1.0,0]);
  const actors=['QB','RB','OL'].map((role,i)=>({role,index:[5,6,0][i],number:[12,24,68][i],team:0,x:(i-1)*1.7,z:0,heading:0,vx:0,vz:0,hasBall:role==='RB',distance:0}));
  window.reviewDraw=(players=actors,phase='pre',time=1)=>{r.begin();r.add('plane',pose(0,0,0,20,1,20),[.18,.36,.21,1],'',false,0,4);rig.queueShadows(players,phase,time);for(const p of players)if(p.hasBall){const b=rig.ballAnchor(p,phase);if(b)r.add('football',segment(b.a,b.b,.105),[1,1,1,1],'',false,.08,5)}r.draw();rig.draw(players,phase,time)};
  window.reviewDraw();const result=[];
  for(const style of['rac','secure','aggressive']){
   const p={...actors[1],role:'WR',index:7,catchStyle:style,catchT:.45,hasBall:true,team:0};let previous=null,maxHandStep=0,maxBallStep=0,previousBall=null;
   rig.poseStates.clear();rig.actorMap=new Map();rig.phase='run';
   for(let i=0;i<29;i++){p.catchT=Math.max(.001,.45-i/60);rig.bonesFor(p,'run',i/60);const hands=rig.handTransforms.get(7),ball=rig.ballAnchor(p,'run'),hand=Array.from(hands.right.slice(12,15));if(previous)maxHandStep=Math.max(maxHandStep,Math.hypot(...hand.map((n,j)=>n-previous[j])));if(previousBall)maxBallStep=Math.max(maxBallStep,Math.hypot(...ball.center.map((n,j)=>n-previousBall[j])));previous=hand;previousBall=ball.center;}
   result.push({style,maxHandStep,maxBallStep});
  }
  window.reviewDraw();return result;
 });
 for(const m of motion){assert.ok(m.maxHandStep<.15,JSON.stringify(m));assert.ok(m.maxBallStep<.16,JSON.stringify(m));}
 await page.screenshot({path:out+'/player-builds.png'});
 await page.evaluate(()=>{window.bkSetGraphicsQualityForQA('eco');window.reviewDraw()});assert.equal(await page.evaluate(()=>window.reviewRenderer.gl.getError()),0);
 await page.screenshot({path:out+'/shadow-fallback.png'});
 // Equipment close-ups use the same skinned geometry and material as gameplay.
 await page.evaluate(()=>{
  window.bkSetGraphicsQualityForQA('high');const r=window.reviewRenderer;r.fov=36;
  window.reviewPlayer={role:'QB',index:5,number:12,team:0,x:0,z:0,heading:0,vx:0,vz:0,distance:0};
  r.camera([.65,1.85,1.25],[0,1.68,0]);window.reviewDraw([window.reviewPlayer]);
 });
 await page.screenshot({path:out+'/helmet-detail.png'});
 await page.evaluate(()=>{const r=window.reviewRenderer;r.camera([1.2,1.8,-3.5],[0,1.15,0]);window.reviewDraw([window.reviewPlayer])});
 await page.screenshot({path:out+'/uniform-rear.png'});
 assert.equal(await page.evaluate(()=>window.reviewRenderer.gl.getError()),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',graphics:data.graphics,athletes:data.game.athletes,surfaces,motion,pageErrors:errors,screenshots:out}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
