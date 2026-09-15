import json,os,re,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'public';OUT=Path(os.environ.get('BK_3D_RESULTS','/tmp/bk-3d-checks'));OUT.mkdir(parents=True,exist_ok=True)

def load(page):
 html=(ROOT/'play-moment-3d-preview.html').read_text();html=re.sub(r'<script type="module">[\s\S]*?</script>','',html);html=html.replace('<link rel="stylesheet" href="/play-moment-3d/hud.css">','<style>'+(ROOT/'play-moment-3d/hud.css').read_text()+'</style>');page.set_content(html)
 urls={}
 for name in ['renderer','athlete','stadium','game']:
  text=(ROOT/f'play-moment-3d/{name}.js').read_text()
  for dep,url in urls.items():text=text.replace("'./"+dep+".js'",repr(url))
  if name=='game':text=text.replace("new URLSearchParams(location.search).has('qa')",'true')
  urls[name]=page.evaluate("s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}))",text)
 page.evaluate("async url=>{const{start}=await import(url);start()}",urls['game']);page.evaluate('window.bk3dTest.manualFrames()');page.evaluate('window.bk3dTest.step(.2)')

def diag(page):return page.evaluate('window.bk3dDiagnostics()')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],env=os.environ.copy())
 w,h=(int(x) for x in (sys.argv[1:3] or ['844','334']));page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1,has_touch=True);errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));load(page)
 d=diag(page);assert len(d['players'])==22 and sum(x['team']==0 for x in d['players'])==11;assert d['glError']==0;assert d['drawCalls']<50
 assert page.locator('#snap').is_visible();page.screenshot(path=str(OUT/f'3d-presnap-{w}x{h}.png'))
 page.click('#passTab');page.click('#snap');page.evaluate('window.bk3dTest.step(1.8)');d=diag(page);assert d['phase']=='pass',d['phase'];assert d['players'][7]['distance']>3;assert d['players'][5]['foot']['y']<h-10,d['players'][5];assert page.locator('#target-7').is_visible();page.screenshot(path=str(OUT/f'3d-pass-{w}x{h}.png'))
 page.keyboard.press('1');page.evaluate('window.bk3dTest.step(1.6)');d=diag(page);assert d['phase'] in ['run','dead','pre'],d['phase']
 page.click('#pause');assert page.locator('#paused').is_visible();page.click('#restart');assert diag(page)['phase']=='pre';assert diag(page)['drive']['plays']==0
 page.click('#runTab');page.click('#snap');page.evaluate('window.bk3dTest.step(.6)');page.keyboard.down('ArrowUp');page.evaluate('window.bk3dTest.step(.6)');page.keyboard.up('ArrowUp');d=diag(page);assert d['phase'] in ['run','dead','pre'];assert d['players'][6]['distance']>1
 page.screenshot(path=str(OUT/f'3d-run-{w}x{h}.png'))
 page.click('#pause');page.click('#restart');page.click('#passTab');page.click('#snap');page.evaluate('window.bk3dTest.step(6.5)');d=diag(page);assert d['phase']=='pre',d['phase'];assert d['drive']['down']==2,d['drive'];assert page.locator('#snap').is_visible()
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300);assert page.locator('#rotate').is_visible();page.wait_for_function('window.bk3dDiagnostics().paused');page.set_viewport_size({'width':w,'height':h});page.click('#resume');assert not diag(page)['paused'];assert not errors,errors;assert not [u for u in requests if u.startswith(('http:','https:'))],requests
 result={'viewport':[w,h],'checks':'22 players, WebGL no error, <50 draw calls, passing movement, QB framing, receiver throw, run handoff + movement, pause/restart, sack/reset, orientation pause; no outbound requests','errors':errors,'outboundRequests':[u for u in requests if u.startswith(('http:','https:'))],'drawCalls':d['drawCalls'],'renderer':'Chromium software WebGL2 (SwiftShader); not real-iPhone certification'}
 (OUT/f'checks-{w}x{h}.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()
