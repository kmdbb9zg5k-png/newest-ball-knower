"""Actual WebGL/HUD goal-line fixtures using the actual loopback module harness.
Only the harness injects controlled situations; no fixture setters ship in-game.
This tests rendering and actual endPlay integration, not physical phone behavior.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('bk_framing',ROOT/'scripts/check-play-moment-framing.py')
framing=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(framing)
ORIGINAL_READ=framing.read_source

def fixture_source(path,baseline=None):
    text=ORIGINAL_READ(path,baseline)
    if path=='public/play-moment-3d/game.js':
        anchor=' setup();camera(1);scene(.016,0);'
        assert text.count(anchor)==1
        hook="""
 window.bkGoalFixture={
  situation(ball,down,toGo){drive={...initialDrive,ball,down,toGo};activeContact=null;pendingDriveEnd=null;pendingWhistle=null;ended=false;paused=false;$('paused').hidden=true;setup();camera(1);},
  finish(spot,reason='TACKLED',incomplete=false){endPlay(reason,spot,incomplete);}
 };
"""
        text=text.replace(anchor,hook+anchor,1)
    return text

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'artifacts/goal-line')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    reports=[]
    framing.read_source=fixture_source
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for w,h in [(844,334),(932,430),(1440,810)]:
            page=browser.new_page(viewport={'width':w,'height':h},has_touch=True,device_scale_factor=1)
            errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
            framing.load(page)
            def label(): return page.locator('#down').inner_text()
            def tick(t=0): page.evaluate('(t)=>bk3dTest.step(t)',t)
            def set_case(ball,down,to_go):
                page.evaluate('([b,d,g])=>bkGoalFixture.situation(b,d,g)',[ball,down,to_go]);tick()
            def finish(spot,reason='TACKLED',incomplete=False):
                page.evaluate('([s,r,i])=>bkGoalFixture.finish(s,r,i)',[spot,reason,incomplete]);tick()
            assert label()=='1ST & 10 · OPP 15'
            framing.choose(page)
            page.click('#snap');before=framing.state(page)['field'];finish(98)
            assert label()=='1ST & GOAL · OPP 2'
            assert page.locator('#message').inner_text()=='FIRST & GOAL · +13 YDS'
            assert framing.state(page)['field']==before,'Series marker jumped while the completed play was held'
            framing.until(page,lambda d:d['phase']=='pre')
            assert framing.state(page)['field']=={'scrimmage':108,'lineToGain':110}
            framing.choose(page,'pass')
            box=page.locator('#down').evaluate('(e)=>({fits:e.scrollWidth<=e.clientWidth,width:e.clientWidth,text:e.textContent})')
            assert box['fits'],box
            framing.capture(page,args.output/f'first-goal-{w}x{h}.png')
            # A real timed sack preserves the goal-line target, whatever its actual spot.
            page.click('#snap')
            sack=framing.until(page,lambda d:d['phase']=='dead',limit=12)
            assert sack['contact'] and sack['drive']['down']==2 and sack['field']['lineToGain']==110,sack
            assert label().startswith('2ND & GOAL'),label()
            # Exact loss/series cases use controlled spots through the real endPlay path.
            set_case(92,2,8);framing.choose(page,'pass');page.click('#snap');finish(86,'SACK')
            assert label()=='3RD & GOAL · OPP 14'
            framing.capture(page,args.output/f'long-goal-{w}x{h}.png')
            framing.until(page,lambda d:d['phase']=='pre');framing.choose(page);page.click('#snap');finish(93)
            assert label()=='4TH & GOAL · OPP 7'
            framing.until(page,lambda d:d['phase']=='pre');framing.choose(page);page.click('#snap');finish(93,'INCOMPLETE',True)
            assert framing.state(page)['ended']
            framing.until(page,lambda d:d['paused'],limit=14)
            assert page.locator('#dialogTitle').inner_text()=='TURNOVER ON DOWNS'
            # Being inside the ten alone is NOT sufficient to say goal-to-go.
            set_case(93,3,2);assert label()=='3RD & 2 · OPP 7';assert framing.state(page)['field']['lineToGain']==105
            # Ordinary first-down/loss target stays still through the dead-ball hold.
            set_case(25,1,10);framing.choose(page);page.click('#snap');old=framing.state(page)['field'];finish(29)
            assert framing.state(page)['field']==old;framing.until(page,lambda d:d['phase']=='pre')
            assert framing.state(page)['field']=={'scrimmage':39,'lineToGain':45}
            # Actual touchdown completion and duplicate delivery do not award twice.
            set_case(98,1,2);framing.choose(page);page.click('#snap');finish(100,'TOUCHDOWN');assert framing.state(page)['drive']['score']==30
            finish(100,'TOUCHDOWN');assert framing.state(page)['drive']['score']==30
            framing.until(page,lambda d:d['paused'],limit=14);page.click('#restart');tick();assert label()=='1ST & 10 · OPP 15'
            diag=framing.state(page);g=framing.graphics_check(page)
            assert diag['glError']==0,g
            assert not errors and not [u for u in requests if u.startswith(('http:','https:')) and not u.startswith(framing.ORIGIN+'/')],(errors,requests)
            reports.append({'viewport':[w,h],'status':'PASS','goalLabelFits':box,'graphics':g,'errors':errors})
            page.close()
        browser.close()
    (args.output/'report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))

if __name__=='__main__':main()
