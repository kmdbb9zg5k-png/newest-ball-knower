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
    for name in ['renderer','motion','geometry','athlete','meshy-athlete','night-stadium','stadium','game']:
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
def skill_gesture(cdp,box,dx,dy,touch_id):
    x=box['x']+box['width']/2;y=box['y']+box['height']/2
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':touch_id}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx,'y':y+dy,'id':touch_id}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
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
        assert d['glError']==0 and g['quality']=='high' and g['shadowAvailable'] and g['shadowSize']==2048
        assert g['canvas']==[round(w*2),round(h*2)],g
        assert page.locator('.graphics-settings').count()==0 and page.locator('[data-bk-quality]').count()==0
        assert g['overflows']==0 and g['drawCalls']<55 and 0<g['shadowDrawCalls']<18
        result['checks'].append('22 actors; red-zone entry; forced High graphics with no player selector; bounded draw calls; zero overflow')
        defensive_looks=[]
        for snap_number in range(6):
            assert page.evaluate('(n)=>bk3dTest.setSnapNumber(n)',snap_number)
            look=diag(page)
            defensive_looks.append((look['defense']['id'],look['defense']['coverage'],tuple((round(p['x'],2),round(p['z']-look['field']['scrimmage'],2)) for p in look['players'][11:])))
        assert len({look[0] for look in defensive_looks})==6,defensive_looks
        assert len({look[1] for look in defensive_looks})==4,defensive_looks
        assert len({look[2] for look in defensive_looks})==6,defensive_looks
        page.evaluate('bk3dTest.setSnapNumber(0)')
        blitz_counts=[]
        for snap_number in range(6):
            page.evaluate('(n)=>bk3dTest.setSnapNumber(n)',snap_number);blitz_counts.append(len(diag(page)['defense']['blitzers']))
        assert sorted(blitz_counts)==[0,0,1,1,1,2],blitz_counts
        page.evaluate('bk3dTest.setSnapNumber(0)')
        result['checks'].append('six distinct situational fronts rotate independently of the offense; pressure calls send real linebackers')
        page.click('#pause');before=diag(page)
        for tier,size,ratio in [('eco',0,1),('high',2048,2),('balanced',1024,1.5),('high',2048,2)]:
            page.evaluate('(tier)=>bkSetGraphicsQualityForQA(tier)',tier);step(page,0);g=graphics(page)
            assert g['shadowSize']==size and g['canvas']==[round(w*ratio),round(h*ratio)],g
            assert diag(page)['players']==before['players'] and diag(page)['drive']==before['drive']
            assert diag(page)['glError']==0
        result['checks'].append('QA-only fallback tier switching; correct resolution; paused state/pose retained')
        page.click('#resume');page.click('#passTab');step(page,.2)
        page.screenshot(path=str(OUT/f'night-presnap-{w}x{h}.png'))
        for i in range(4):
            restart(page);page.click('#passTab');page.locator('#plays button').nth(i).click();page.click('#snap');step(page,1.3)
            d=diag(page);assert d['phase']=='pass' and d['players'][7]['distance']>3
            assert d['players'][5]['foot']['y']<h-10,d['players'][5]
            assert page.locator('.target').count()==5 and page.locator('#target-7').is_visible() and page.locator('#target-10').is_visible() and page.locator('#target-6').is_visible() and d['glError']==0
            assert any(state in d['athletes']['states'] for state in ['route-stem','route-cut']),d['athletes']
            assert any(state in d['athletes']['states'] for state in ['coverage-pedal','coverage-break','coverage']),d['athletes']
            assert 'pass-anchor' in d['athletes']['states'],d['athletes']
            if i==0: page.screenshot(path=str(OUT/f'night-pass-{w}x{h}.png'))
            page.keyboard.press('4' if i==0 else '5' if i==1 else '1')
            assert page.locator('#catchChoices').is_visible()
            page.locator('#catchChoices button[data-catch="secure"]').click();assert diag(page)['catchStyle']=='secure'
            step(page,1.0)
            assert diag(page)['phase'] in ['run','dead','pre']
        result['checks'].append('all four pass concepts; five eligible targets including TE/RB; role-specific route, coverage and pass-anchor motion; live secure/aggressive/RAC choice; pocket framing')
        restart(page);page.click('#passTab');page.click('#snap');step(page,.2)
        page.keyboard.down('ArrowUp');step(page,1.45);page.keyboard.up('ArrowUp')
        scrambled=diag(page)
        assert scrambled['phase']=='run' and scrambled['players'][5]['hasBall'] and not scrambled['assist'],scrambled
        assert scrambled['players'][5]['z']>=scrambled['field']['scrimmage']+.15,scrambled
        assert page.locator('#target-7').count()==0 or not page.locator('#target-7').is_visible()
        receiver_z={index:scrambled['players'][index]['z'] for index in [6,7,8,9,10]}
        step(page,.25);supported=diag(page)
        assert all(supported['players'][index]['z']>=receiver_z[index]-.08 for index in receiver_z),(receiver_z,supported['players'])
        qb_skill=page.locator('#juke').bounding_box();qb_cdp=page.context.new_cdp_session(page)
        skill_gesture(qb_cdp,qb_skill,0,42,10);slid=diag(page)
        assert slid['phase']=='dead' and slid['lastSkill']=='slide' and slid['players'][5]['fallen'],slid
        result['checks'].append('quarterback crosses the line of scrimmage, keeps possession, receivers flow into support blocks without retreating, and a downward swipe slides')
        restart(page);page.click('#passTab');page.evaluate('bk3dTest.setSnapNumber(3)');page.click('#snap');step(page,.15)
        assert page.locator('#throwAway').is_visible() and page.locator('#throwAway').get_attribute('data-ready')=='false'
        page.click('#throwAway');assert diag(page)['phase']=='pass'
        page.keyboard.down('ArrowRight');step(page,1.55);page.keyboard.up('ArrowRight')
        escaped=diag(page);assert escaped['phase']=='pass' and abs(escaped['players'][5]['x'])>6,escaped
        assert page.locator('#throwAway').get_attribute('data-ready')=='true'
        page.click('#throwAway');assert diag(page)['phase']=='flight' and diag(page)['throwKind']=='throwaway'
        step(page,.55);thrown_away=diag(page)
        assert thrown_away['phase']=='dead' and thrown_away['drive']['down']==2 and thrown_away['drive']['ball']==85,thrown_away
        result['checks'].append('throwaway control rejects the pocket, becomes ready outside the tackles, animates to the sideline and preserves the spot')
        run_results=[]
        for run_index in range(4):
            restart(page);page.click('#runTab');page.evaluate('(n)=>bk3dTest.setSnapNumber(n)',run_index);page.locator('#plays button').nth(run_index).click()
            page.keyboard.down('ArrowUp');page.click('#snap');step(page,.95);fit=diag(page)
            mike=fit['players'][16]
            assert fit['phase']=='run',fit
            assert mike['z']>fit['field']['scrimmage']+.6,(run_index,mike,fit['defense'])
            assert mike['engagedWith'] is not None or mike['z']-fit['players'][6]['z']>2.2,(run_index,mike,fit['players'][6],fit['defense'])
            assert any(fit['players'][index]['engagedWith'] in [18,19,20] for index in [7,8,9]),(run_index,fit['players'][7:10],fit['defense'])
            assert 'stalk-block' in fit['athletes']['states'],(run_index,fit['athletes'])
            assert any(state in fit['athletes']['states'] for state in ['drive-block','reach-block','climb-block']),(run_index,fit['athletes'])
            step(page,.65);page.keyboard.up('ArrowUp');played=diag(page);runner=played['players'][6]
            assert runner['z']>=played['field']['scrimmage']-.25,(run_index,runner,played['defense'],played['lastTackler'])
            if played['phase']=='dead':assert played['drive']['ball']>=85,(run_index,played)
            run_results.append({'run':run_index,'defense':played['defense']['id'],'runnerX':runner['x'],'runnerZ':runner['z'],'scrimmage':played['field']['scrimmage'],'lastTackler':played['lastTackler']})
        assert max(sample['runnerX'] for sample in run_results)-min(sample['runnerX'] for sample in run_results)>4,run_results
        assert len({round(sample['runnerZ'],1) for sample in run_results})>1,run_results
        result['runFitSamples']=run_results
        result['checks'].append('four run concepts produce different landmarks and pace; drive/reach/climb blocks account for the box and receivers use a distinct stalk-block motion')
        restart(page);page.click('#runTab')
        assert page.locator('#stick').is_visible() and not page.locator('#moves').is_visible()
        presnap_stick=page.locator('#stick').bounding_box()
        cdp=page.context.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':presnap_stick['x']+presnap_stick['width']/2,'y':presnap_stick['y']+presnap_stick['height']*.2,'id':11}]})
        page.click('#snap');step(page,.6)
        assert diag(page)['phase']=='run'
        assert sum(p['team']==1 and p['engaged'] for p in diag(page)['players'])>=4,diag(page)['players']
        held_start=diag(page)['players'][6];step(page,.08);held_end=diag(page)['players'][6]
        assert held_end['z']-held_start['z']>.25,(held_start,held_end)
        stick=page.locator('#stick').bounding_box();sprint=page.locator('#sprint').bounding_box();juke=page.locator('#juke').bounding_box()
        assert abs(stick['x']-presnap_stick['x'])<1 and abs(stick['y']-presnap_stick['y'])<1,(presnap_stick,stick)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        cdp=page.context.new_cdp_session(page)
        touches=[{'x':stick['x']+stick['width']/2,'y':stick['y']+stick['height']*.2,'id':21},
                 {'x':sprint['x']+sprint['width']/2,'y':sprint['y']+sprint['height']/2,'id':22}]
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':touches})
        step(page,.25);running=diag(page);assert running['stamina']<.99,running['stamina']
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        step(page,.2);released=diag(page);assert released['stamina']>running['stamina']
        assert released['players'][6]['distance']>1
        # Exercise the tap juke from a fresh live-play state. The preceding
        # sustained-control sequence intentionally runs long enough for pursuit
        # contact, so reusing that runner makes this control assertion depend on
        # whether the randomized defense has already completed a tackle.
        restart(page);page.click('#runTab');page.click('#snap');step(page,.6)
        assert diag(page)['phase']=='run' and not diag(page)['players'][6]['fallen']
        juke=page.locator('#juke').bounding_box();cdp=page.context.new_cdp_session(page)
        before_juke=diag(page)['players'][6]
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':juke['x']+juke['width']/2,'y':juke['y']+juke['height']/2,'id':31}]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        after_juke=diag(page)['players'][6]
        # A juke now plants into a short lateral cut and carries the rest of the
        # burst through velocity instead of teleporting the runner 1.8 yards.
        # Verify both halves of that motion contract.
        assert ((after_juke['x']-before_juke['x'])**2+(after_juke['z']-before_juke['z'])**2)**.5>.32,(before_juke,after_juke)
        assert after_juke['action']=='juke' and (after_juke['vx']**2+after_juke['vz']**2)**.5>6.5,(before_juke,after_juke)
        assert abs(after_juke['heading']-before_juke['heading'])>.35,(before_juke,after_juke)
        assert diag(page)['lastSkill']=='juke'
        for name,dx,dy,touch_id in [('spin-right',42,0,41),('truck',0,-42,42),('hurdle',0,42,43)]:
            restart(page);page.click('#runTab');page.click('#snap');step(page,.6)
            skill=page.locator('#juke').bounding_box();before=diag(page)['players'][6]
            skill_gesture(page.context.new_cdp_session(page),skill,dx,dy,touch_id);step(page,.08)
            moved=diag(page);after=moved['players'][6]
            assert moved['lastSkill']==name,(name,moved)
            assert after['action']==('spin' if name=='spin-right' else name),(name,after)
            assert ((after['x']-before['x'])**2+(after['z']-before['z'])**2)**.5>.35,(name,before,after)
        page.screenshot(path=str(OUT/f'night-run-{w}x{h}.png'))
        result['checks'].append('fixed-position pre-snap stick with held input; five-man run assignments; simultaneous stick+sprint; tap juke; swipe spin, truck and hurdle')
        for key,screen_side in [('ArrowRight',1),('ArrowLeft',-1)]:
            restart(page);page.click('#runTab');page.click('#snap');step(page,.6)
            before=diag(page);g=graphics(page);runner=before['players'][6]
            fx=g['target'][0]-g['eye'][0];fz=g['target'][2]-g['eye'][2];length=(fx*fx+fz*fz)**.5 or 1
            expected=(-fz*screen_side/length,fx*screen_side/length)
            page.keyboard.down(key);page.click('#juke');page.keyboard.up(key)
            after=diag(page)['players'][6];delta=(after['x']-runner['x'],after['z']-runner['z'])
            assert delta[0]*expected[0]+delta[1]*expected[1]>.3,(key,expected,delta,g)
            assert abs(after['heading']-runner['heading'])>.05,(key,runner,after)
        result['checks'].append('keyboard juke cuts follow camera-space left/right and visibly plant into the cut')
        contact_samples=[]
        for contact_type in ['wrap','gang','big-hit']:
            restart(page);page.click('#runTab');page.click('#snap');step(page,.7)
            assert diag(page)['phase']=='run'
            assert page.evaluate('(kind)=>bk3dTest.forceContact(kind)',contact_type)
            started=diag(page);carrier_index=6
            assert started['phase']=='dead' and started['contact']['type']==contact_type,started
            assert started['players'][carrier_index]['fallen'] and started['players'][carrier_index]['action']==contact_type,started
            start_z=started['players'][carrier_index]['z'];start_time=started['simTime']
            step(page,.28);middle=diag(page)
            assert middle['simTime']>start_time and 0<middle['contact']['elapsed']<middle['contact']['duration'],middle
            assert .1<middle['players'][carrier_index]['actionT']<.8,middle['players'][carrier_index]
            assert middle['players'][carrier_index]['z']>start_z,(started,middle)
            tackler=middle['players'][middle['contact']['tackler']]
            assert ((tackler['x']-middle['players'][carrier_index]['x'])**2+(tackler['z']-middle['players'][carrier_index]['z'])**2)**.5<1.5,(contact_type,tackler,middle['players'][carrier_index])
            if contact_type=='gang':assert middle['contact']['helper'] is not None and middle['players'][middle['contact']['helper']]['action']=='gang',middle
            if contact_type=='wrap':page.screenshot(path=str(OUT/f'night-contact-{w}x{h}.png'))
            contact_samples.append({'type':contact_type,'duration':middle['contact']['duration'],'carrierDrive':middle['players'][carrier_index]['z']-start_z})
        result['contactSamples']=contact_samples
        result['checks'].append('wrap, gang and big-hit sequences continue after the whistle; carrier, tackler and gang helper finish contact instead of freezing on impact')
        restart(page);page.click('#runTab');page.click('#control');page.click('#snap');step(page,1.0)
        assert diag(page)['players'][6]['distance']>1 and page.locator('#control').inner_text().startswith('ASSIST')
        result['checks'].append('assisted run movement')
        restart(page);page.click('#passTab');page.click('#snap');step(page,6.5)
        assert diag(page)['phase']=='pre' and diag(page)['drive']['down']==2 and page.locator('#snap').is_visible()
        result['checks'].append('sack, next-down reset and controls recovery')
        shade=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        load(shade,redzone=True)
        shade.evaluate("bkSetGraphicsQualityForQA('balanced')")
        on=OUT/f'shadow-on-{w}x{h}.png';off=OUT/f'shadow-off-{w}x{h}.png'
        snap_canvas(shade,on)
        shade.evaluate("bkSetGraphicsQualityForQA('eco')")
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
