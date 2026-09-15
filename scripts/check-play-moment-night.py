"""Offline rendered regression for the 3D night preview, not device certification.
Uses unchanged same-source modules through Blob URLs. No network service is used.
Run from the repo with Python Playwright and CHROMIUM_PATH set when needed.
"""
import base64, json, os, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('BK_NIGHT_RESULTS',str(ROOT/'tests/results')))
OUT.mkdir(parents=True,exist_ok=True)

def load(page,redzone=False,fbo_failure=False):
    html=(ROOT/'public/play-moment-3d-preview.html').read_text()
    html=re.sub(r'<script type="module">[\s\S]*?</script>','',html)
    html=html.replace('<link rel="stylesheet" href="/play-moment-3d/hud.css">','<style>'+(ROOT/'public/play-moment-3d/hud.css').read_text()+'</style>')
    page.set_content(html)
    if fbo_failure:
        page.evaluate('''() => {const original=HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=original.call(this,type,...args);
          if(type==='webgl2'&&gl)gl.checkFramebufferStatus=()=>gl.FRAMEBUFFER_UNSUPPORTED;return gl;};}''')
    urls={}
    for name in ['renderer','motion','geometry','athlete','night-stadium','stadium','game']:
        text=(ROOT/f'public/play-moment-3d/{name}.js').read_text()
        for dep,url in urls.items(): text=text.replace("'./"+dep+".js'",repr(url))
        text=text.replace("new URLSearchParams(location.search).has('qa')",'true')
        if redzone: text=text.replace("new URLSearchParams(location.search).get('scenario')==='redzone'",'true')
        urls[name]=page.evaluate("s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}))",text)
    page.evaluate("async url=>{const{start}=await import(url);start()}",urls['game'])
    page.evaluate('bk3dTest.manualFrames(); bk3dTest.step(.2)')

def diag(page): return page.evaluate('bk3dDiagnostics()')
def graphics(page): return page.evaluate('bkGraphicsDiagnostics()')
def step(page,s): page.evaluate('(s)=>bk3dTest.step(s)',s)
def restart(page):
    if not page.locator('#paused').is_visible(): page.click('#pause')
    page.click('#restart');step(page,.2)
def snap_canvas(page,path):
    data=page.evaluate("() => {bk3dTest.step(0); return document.getElementById('game').toDataURL('image/png').split(',')[1]}")
    path.write_bytes(base64.b64decode(data))

if __name__=='__main__':
    w,h=map(int,sys.argv[1:3] or ['932','430'])
    class Checks(list):
        def append(self,value):
            super().append(value);print('PASS:',value,flush=True)
    result={'viewport':[w,h],'renderer':'Chromium/SwiftShader WebGL2; not real-phone FPS or touch certification','checks':Checks()}
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,
            args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ozone-platform=headless'],env={**os.environ,'DISPLAY':''})
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=2,has_touch=True)
        errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        load(page,redzone=True)
        d=diag(page);g=graphics(page)
        assert len(d['players'])==22 and sum(x['team']==0 for x in d['players'])==11
        assert d['drive']['ball']==85 and d['drive']['clock']==63
        assert d['glError']==0 and g['shadowAvailable'] and g['shadowSize']==1024
        assert g['overflows']==0 and g['drawCalls']<55 and 0<g['shadowDrawCalls']<18
        result['checks'].append('22 actors; red-zone entry; night shaders/depth target; bounded draw calls; zero overflow')
        page.click('#pause');before=diag(page)
        for tier,size,ratio in [('eco',0,1),('high',2048,2),('balanced',1024,1.5),('high',2048,2)]:
            page.click('[data-bk-quality="'+tier+'"]');step(page,0);g=graphics(page)
            assert g['shadowSize']==size and g['canvas']==[round(w*ratio),round(h*ratio)],g
            assert diag(page)['players']==before['players'] and diag(page)['drive']==before['drive']
            assert diag(page)['glError']==0
        result['checks'].append('low-power/balanced/high switching; correct resolution; paused state/pose retained')
        page.click('#resume');page.click('#passTab');step(page,.2)
        page.screenshot(path=str(OUT/f'night-presnap-{w}x{h}.png'))
        for i in range(4):
            restart(page);page.click('#passTab');page.locator('#plays button').nth(i).click();page.click('#snap');step(page,1.3)
            d=diag(page);assert d['phase']=='pass' and d['players'][7]['distance']>3
            assert d['players'][5]['foot']['y']<h-10,d['players'][5]
            assert page.locator('#target-7').is_visible() and d['glError']==0
            if i==0: page.screenshot(path=str(OUT/f'night-pass-{w}x{h}.png'))
            page.keyboard.press('1');step(page,1.0)
            assert diag(page)['phase'] in ['run','dead','pre']
        result['checks'].append('all four pass concepts; moving receivers; pocket framing; target throws')
        restart(page);page.click('#runTab');page.click('#snap');step(page,.6)
        assert diag(page)['phase']=='run'
        stick=page.locator('#stick').bounding_box();sprint=page.locator('#sprint').bounding_box()
        cdp=page.context.new_cdp_session(page)
        touches=[{'x':stick['x']+stick['width']/2,'y':stick['y']+stick['height']*.2,'id':1},
                 {'x':sprint['x']+sprint['width']/2,'y':sprint['y']+sprint['height']/2,'id':2}]
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':touches})
        step(page,.25);running=diag(page);assert running['stamina']<.99,running['stamina']
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        step(page,.2);released=diag(page);assert released['stamina']>running['stamina']
        assert released['players'][6]['distance']>1
        page.screenshot(path=str(OUT/f'night-run-{w}x{h}.png'))
        result['checks'].append('handoff, manual movement, emulated simultaneous stick+sprint and release')
        for key,screen_side in [('ArrowRight',1),('ArrowLeft',-1)]:
            restart(page);page.click('#runTab');page.click('#snap');step(page,.6)
            before=diag(page);g=graphics(page);runner=before['players'][6]
            fx=g['target'][0]-g['eye'][0];fz=g['target'][2]-g['eye'][2];length=(fx*fx+fz*fz)**.5 or 1
            expected=(-fz*screen_side/length,fx*screen_side/length)
            page.keyboard.down(key);page.click('#juke');page.keyboard.up(key)
            after=diag(page)['players'][6];delta=(after['x']-runner['x'],after['z']-runner['z'])
            assert delta[0]*expected[0]+delta[1]*expected[1]>.9,(key,expected,delta,g)
            assert abs(after['heading']-runner['heading'])>.05,(key,runner,after)
        result['checks'].append('keyboard juke cuts follow camera-space left/right and visibly plant into the cut')
        restart(page);page.click('#runTab');page.click('#control');page.click('#snap');step(page,1.0)
        assert diag(page)['players'][6]['distance']>1 and page.locator('#control').inner_text().startswith('ASSIST')
        result['checks'].append('assisted run movement')
        restart(page);page.click('#passTab');page.click('#snap');step(page,6.5)
        assert diag(page)['phase']=='pre' and diag(page)['drive']['down']==2 and page.locator('#snap').is_visible()
        result['checks'].append('sack, next-down reset and controls recovery')
        shade=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        load(shade,redzone=True)
        shade.evaluate("document.querySelector('[data-bk-quality=balanced]').click()")
        on=OUT/f'shadow-on-{w}x{h}.png';off=OUT/f'shadow-off-{w}x{h}.png'
        snap_canvas(shade,on)
        shade.evaluate("document.querySelector('[data-bk-quality=eco]').click()")
        snap_canvas(shade,off)
        from PIL import Image,ImageChops
        diff=ImageChops.difference(Image.open(on).convert('RGB'),Image.open(off).convert('RGB'))
        changed=sum(1 for pixel in diff.getdata() if max(pixel)>8)
        assert changed>100,changed
        result['shadowChangedPixels']=changed
        result['checks'].append('same-frame same-resolution shadow-on/off rendered pixel comparison')
        shade.close()
        if not page.locator('#paused').is_visible():page.click('#pause')
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
        assert page.locator('#rotate').is_visible()
        page.set_viewport_size({'width':w,'height':h});page.click('#resume');assert not diag(page)['paused']
        assert diag(page)['glError']==0 and graphics(page)['overflows']==0
        assert not errors,errors
        assert not [u for u in requests if u.startswith(('http:','https:'))],requests
        result['checks'].append('portrait recovery; no JS/WebGL errors; no external requests')
        result['graphics']=graphics(page)
        fail=browser.new_page(viewport={'width':w,'height':h})
        load(fail,fbo_failure=True)
        assert not graphics(fail)['shadowAvailable'] and diag(fail)['glError']==0
        assert fail.locator('#snap').is_visible()
        fail.click('#snap');step(fail,.8);assert diag(fail)['players'][6]['distance']>1
        result['checks'].append('simulated unsupported depth framebuffer falls back to playable contact-shadow scene')
        browser.close()
    (OUT/f'checks-night-{w}x{h}.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
