"""Local mini-game regression, not a full-app or real-iPhone certification.
Run from the repository: python scripts/validate-play-moment-viewport.py
Requires Python, Pillow, Playwright, and Chromium (system or Playwright install).
Assets are stubbed; engine state exposure and deterministic rolls exist only in this test.
"""
from pathlib import Path
import json, time, hashlib, re, base64
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp'/'play-moment-viewport-checks';OUT.mkdir(parents=True,exist_ok=True)
# Fixed-ratio texture stub for layout tests. No production image is changed.
from io import BytesIO
buf=BytesIO();Image.new('RGBA',(1024,1536),(120,135,150,255)).save(buf,format='PNG')
image=buf.getvalue()
MEASURE="""() => {
 const b = document.querySelector('.scoreboard').getBoundingClientRect();
 const dock=document.querySelector('.controls').getBoundingClientRect();
 const stage=document.querySelector('.game-wrap').getBoundingClientRect();
 const players=[...document.querySelectorAll('#field .player')].map(el=>{
   const r=el.getBoundingClientRect(),m=el.querySelector('.portrait-mask').getBoundingClientRect(),tag=el.querySelector('.tag').getBoundingClientRect();
   return {id:el.dataset.id,x:parseFloat(el.style.left),y:parseFloat(el.style.top),top:Math.min(r.top,m.top),bottom:Math.max(r.bottom,m.bottom,tag.bottom),left:r.left,right:r.right};
 });
 const routes=[...document.querySelectorAll('#routes .route')].map(el=>{
  const p=el.getPointAtLength(0).matrixTransform(el.getScreenCTM()),cs=getComputedStyle(el);
  const id=['x','slot','z'].find(k=>el.classList.contains(k))||(el.classList.contains('runroute')?'runner':null);
  const pr=document.querySelector('.player[data-id="'+id+'"]')?.getBoundingClientRect();
  return {id,stroke:cs.strokeWidth,effect:cs.vectorEffect,error:pr?Math.hypot(p.x-(pr.left+pr.width/2),p.y-(pr.bottom-3)):null};
 });
 return {players,routes,h:innerHeight,scoreBottom:b.bottom,dockTop:dock.top,dockH:dock.height,stageH:stage.height,
   ready:!document.querySelector('#snapBtn').disabled,live:document.body.dataset.live,ended:document.body.dataset.ended,
   controlsDisplay:getComputedStyle(document.querySelector('.controls')).display,routeOpacity:getComputedStyle(document.querySelector('#routes')).opacity,
   world:document.querySelector('#field').getBoundingClientRect().height,fieldTop:document.querySelector('#field').getBoundingClientRect().top};
}"""

def assert_pocket(m,pre=False):
    bottom=m['dockTop']-3 if pre else m['h']-20
    for p in m['players']:
        if p['id'] in ['qb','x','slot','z','ol0','ol1','ol2','ol3','ol4']:
            assert p['top']>=m['scoreBottom']-1,(p,m)
            assert p['bottom']<=bottom+1,(p,m)

def run():
 results=[]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=__import__('shutil').which('chromium'),headless=True,args=['--no-sandbox'])
  for w,h in [(844,334),(932,430),(667,300),(1024,768)]:
   context=browser.new_context(viewport={'width':w,'height':h},has_touch=True,device_scale_factor=1)
   page=context.new_page(); errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
   page.route('**/solo-characters/**',lambda route:route.fulfill(status=200,content_type='image/png',body=image))
   # Expose existing state only in the local test response. Never modify the committed engine.
   engine=(ROOT/'public/franchise-play-moment-v3.js').read_text()
   extra='\nwindow.__BK_TEST={state,resetPlay,snap,throwTo,payload,finishRun,finish};\n'
   tested=engine.replace('\n})();',extra+'\n})();')
   page.route('**/franchise-play-moment-v3.js',lambda route:route.fulfill(content_type='application/javascript',body=tested))
   html=(ROOT/'public/franchise-play-moment-v3.html').read_text()
   html=re.sub(r'<script[^>]*src=[^>]+></script>', '', html)
   html=re.sub(r'<link[^>]+>', '', html)
   page.set_content(html)
   for css in ['.css','-polish.css','-immersive.css','-camera.css','-football.css']:
    page.add_style_tag(content=(ROOT/'public'/('franchise-play-moment-v3'+css)).read_text())
   page.add_script_tag(content=tested)
   for js in ['-polish.js','-immersive.js','-camera.js']:
    page.add_script_tag(content=(ROOT/'public'/('franchise-play-moment-v3'+js)).read_text())
   page.evaluate('''src=>{
    const fill=()=>document.querySelectorAll('.player img').forEach(el=>{if(el.src!==src){el.dataset.bkOriginalSrc='fixture-only';el.src=src}});
    new MutationObserver(fill).observe(document.querySelector('#field'),{childList:true});fill();
   }''','data:image/png;base64,'+base64.b64encode(image).decode())
   page.wait_for_timeout(600)
   m=page.evaluate(MEASURE);assert_pocket(m,True)
   assert all(float(r['stroke'].replace('px',''))<=3 and r['effect']=='non-scaling-stroke' and r['error']<1.0 for r in m['routes']),m
   assert m['dockH']>=44 and m['dockTop']>m['scoreBottom']
   page.screenshot(path=str(OUT/f'presnap-{w}x{h}.png'))
   # Count no self-triggering frame chains while at rest.
   page.evaluate('window.__mut=0;window.__mo=new MutationObserver(rs=>window.__mut+=rs.length);window.__mo.observe(document.documentElement,{subtree:true,attributes:true,childList:true});')
   page.wait_for_timeout(250); mutations=page.evaluate('window.__mo.disconnect();window.__mut')
   assert mutations<25,mutations
   for play in ['mesh','verts','flood','dagger']:
    page.locator(f'[data-play="{play}"]').click();page.wait_for_timeout(120)
    page.locator('#snapBtn').click();page.wait_for_timeout(100)
    assert page.evaluate('document.body.dataset.live')=='1'
    for i in range(8):
      page.wait_for_timeout(420)
      m=page.evaluate(MEASURE);assert_pocket(m)
      assert m['controlsDisplay']=='none' and float(m['routeOpacity'])==0,m
      assert page.evaluate('''() => [...document.querySelectorAll('.player.run:not(.cut):not(.throw):not(.catch):not(.hit):not(.celebrate):not(.skill)')].every(p=>getComputedStyle(p.querySelector('img')).animationName==='none'&&getComputedStyle(p.querySelector('.portrait-mask')).animationName==='none')''')
    if play=='verts':page.screenshot(path=str(OUT/f'live-pass-{w}x{h}.png'))
    # Incomplete result forced using the normal throw and ball-flight code.
    page.evaluate('Math.random=()=>.99999')
    receiver=page.locator('#field .player[data-id="z"]')
    receiver.click(force=True);page.wait_for_timeout(1500)
    m=page.evaluate(MEASURE)
    assert m['ready'] and m['live']=='0',(play,m)
    assert_pocket(m,True)
    assert all(r['error']<1 for r in m['routes']),m
    # Reset the scenario between concepts so the fourth throw is not a turnover.
    page.evaluate("Object.assign(__BK_TEST.state,{down:1,clock:78,ended:false});__BK_TEST.resetPlay()")
    page.wait_for_timeout(120)
   # Sack then next down.
   page.locator('#snapBtn').click();page.wait_for_timeout(5000)
   m=page.evaluate(MEASURE);assert m['ready'];assert_pocket(m,True)
   # Manual handoff, touch steering, and recovery via the engine.
   page.locator('#runMode').click();page.locator('#snapBtn').click();page.wait_for_timeout(650)
   assert page.locator('#manualHud').get_attribute('aria-hidden')=='false'
   joy=page.locator('#joystick').bounding_box();x=joy['x']+joy['width']/2;y=joy['y']+joy['height']/2
   initial=page.evaluate('__BK_TEST.state.runner.x')
   page.mouse.move(x+23,y-15);page.mouse.down()
   page.wait_for_timeout(280)
   assert page.evaluate('__BK_TEST.state.runner.x')>initial
   page.mouse.up()
   page.screenshot(path=str(OUT/f'run-{w}x{h}.png'))
   page.evaluate("__BK_TEST.finishRun(false,'TACKLED')");page.wait_for_timeout(900)
   assert page.evaluate('__BK_TEST.payload().rushers[0].attempts')==1
   assert page.evaluate(MEASURE)['ready']
   assert not errors,errors
   results.append({'viewport':[w,h],'passConcepts':4,'incompleteReset':True,'sackReset':True,'manualSteering':True,'rushStats':True,'idleMutations':mutations,'errors':errors})
   context.close()
  browser.close()
 (OUT/'checks.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':run()
