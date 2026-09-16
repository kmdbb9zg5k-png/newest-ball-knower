"""Isolated actual-renderer character regression, not full-game/device QA."""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ.get('BK_MODEL_SOURCE',str(Path(__file__).resolve().parents[1]/'public')))
OUT=Path(os.environ.get('BK_MODEL_RESULTS','/tmp/bk-model-checks'));OUT.mkdir(parents=True,exist_ok=True)
FIXTURE=r"""
const r=new renderer.Renderer(document.querySelector('canvas'));
const roles=['OL','QB','WR','DL'];
let actors=roles.map((role,i)=>({role,index:i,number:[71,12,18,94][i],team:role==='DL'?1:0,x:(i-1.5)*1.7,z:0,heading:i===1?Math.PI:0,throwT:0,catchT:0,hasBall:role==='QB'}));
let phase='pre',time=0;
athlete.prepareJerseys(r,actors);actors.forEach(p=>motion.advanceMotion(p,0,phase));
const rawAdd=r.add.bind(r);r.add=(shape,m,...args)=>{if(!Array.from(m).every(Number.isFinite))throw Error('Nonfinite model matrix');rawAdd(shape,m,...args)};
function paint(){
 r.begin();r.add('plane',renderer.pose(0,-.003,0,75,1,75),renderer.hex('#315e3b'));
 for(let z=-20;z<25;z+=5)r.add('plane',renderer.pose(0,.008,z,55,1,.025),renderer.hex('#a8b3a0'));
 for(const p of actors){r.add('sphere',renderer.pose(p.x,.012,p.z,.37,.017,.31),renderer.hex('#213d29'));athlete.drawAthlete(r,p,time,phase)}r.draw();
}
function camera(){r.camera([.1,2.7,8.5],[0,.85,0])}camera();
window.review={
 step(dt,newPhase='run'){phase=newPhase;for(let i=0;i<Math.ceil(dt*60);i++){for(const p of actors){const z=p.z;p.z+=.1;motion.advanceMotion(p,1/60,phase);p.z=z;p.motion.z=z;}time+=1/60;}paint()},
 roster(){actors=Array.from({length:22},(_,i)=>({role:['OL','QB','RB','WR','TE','DL','LB','DB'][i%8],index:i,number:12+i,team:i>10?1:0,x:(i%11-5)*1.3,z:i>10?3:-1,heading:i>10?Math.PI:0,throwT:0,catchT:0}));athlete.prepareJerseys(r,actors);actors.forEach(p=>motion.advanceMotion(p,0,'pre'));phase='pre';r.camera([1,6,-15],[0,.6,1]);paint()},
 detail(back){actors=[{role:'QB',index:5,number:12,team:0,x:0,z:0,heading:0,throwT:0,catchT:0,hasBall:false}];phase='pre';athlete.prepareJerseys(r,actors);motion.advanceMotion(actors[0],0,'pre');r.camera([0,1.5,back?-3.2:3.2],[0,1.25,0]);paint()},
 check(){return{players:actors.length,glError:r.gl.getError(),drawCalls:r.drawCalls,phase,coordinates:actors.map(p=>[p.x,p.z,p.heading])}}
};
function frame(){paint();requestAnimationFrame(frame)}frame();
"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ozone-platform=headless'],headless=True,env={k:v for k,v in os.environ.items() if k!='DISPLAY'})
 results=[]
 for w,h in [(844,334),(932,430)]:
  page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1);errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
  page.set_content('<style>html,body{margin:0;background:#0c1720;color:white;font:12px system-ui}canvas{width:100vw;height:100vh;display:block}label{position:fixed;left:20px;top:14px;font-size:11px;letter-spacing:2px;color:#e6d295}small{position:fixed;left:20px;bottom:14px;color:#ddd}</style><canvas></canvas><label>BALL KNOWER · CHARACTER REVIEW</label><small>Actual renderer · Isolated pose test, not live gameplay</small>')
  urls={}
  for name in ['renderer','motion','geometry','athlete']:
   source=(ROOT/f'play-moment-3d/{name}.js').read_text()
   for dep,url in urls.items():source=source.replace("'./"+dep+".js'",repr(url))
   urls[name]=page.evaluate("s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}))",source)
  code='\n'.join(f"const {name}=await import({json.dumps(url)});" for name,url in urls.items())+FIXTURE
  page.evaluate('async code=>{await (new (Object.getPrototypeOf(async function(){}).constructor)(code))()}',code)
  page.wait_for_timeout(250);page.screenshot(path=str(OUT/f'stances-{w}x{h}.png'))
  page.evaluate("review.step(.7,'run')");page.screenshot(path=str(OUT/f'running-poses-{w}x{h}.png'))
  page.evaluate('review.detail(false)');page.screenshot(path=str(OUT/f'number-front-{w}x{h}.png'))
  page.evaluate('review.detail(true)');page.screenshot(path=str(OUT/f'number-back-{w}x{h}.png'))
  page.evaluate('review.roster()');page.screenshot(path=str(OUT/f'roster-{w}x{h}.png'))
  d=page.evaluate('review.check()');assert d['players']==22 and d['glError']==0 and d['drawCalls']<50,d
  coords=d['coordinates'];page.wait_for_timeout(150);assert page.evaluate('review.check().coordinates')==coords
  assert not errors,errors;outbound=[u for u in requests if u.startswith(('http:','https:'))];assert not outbound,outbound
  results.append({'viewport':[w,h],'webglErrors':d['glError'],'drawCalls':d['drawCalls'],'players':d['players'],'jsErrors':errors,'outboundRequests':outbound,'scope':'isolated renderer/pose fixtures, not full gameplay or hardware performance'});page.close()
 b.close();(OUT/'stance-browser-checks.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
