"""Actual WebGL/HUD goal-line fixtures using the existing offline Blob harness.
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
  situation(ball,down,toGo){drive={...initialDrive,ball,down,toGo};ended=false;paused=false;$('paused').hidden=true;setup();camera(1);},
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
            page.click('#snap');before=framing.state(page)['field'];finish(98)
            assert label()=='1ST & GOAL · OPP 2'
            assert page.locator('#message').inner_text()=='FIRST & GOAL · +13 YDS'
            assert framing.state(page)['field']==before,'Series marker jumped while the completed play was held'
            tick(1.3);assert framing.state(page)['field']=={'scrimmage':108,'lineToGain':110}
            page.click('#passTab');tick(.2)
            # Ensure the longer goal label stays inside its actual scoreboard box.
            box=page.locator('#down').evaluate('(e)=>({fits:e.scrollWidth<=e.clientWidth,width:e.clientWidth,text:e.textContent})')
            assert box['fits'],box
            framing.capture(page,args.output/f'first-goal-{w}x{h}.png')
            # A real timed sack preserves goal-to-go; the yellow target remains at the goal.
            page.click('#snap');tick(4.8)
            assert label()=='2ND & GOAL · OPP 8' and framing.state(page)['field']['lineToGain']==110
            tick(1.3);page.click('#snap');tick(4.8)
            assert label()=='3RD & GOAL · OPP 14';tick(1.3)
            framing.capture(page,args.output/f'long-goal-{w}x{h}.png')
            page.click('#snap');finish(93);assert label()=='4TH & GOAL · OPP 7'
            tick(1.3);page.click('#snap');finish(93,'INCOMPLETE',True)
            assert framing.state(page)['ended'] and page.locator('#dialogTitle').inner_text()=='TURNOVER ON DOWNS'
            # Being inside the ten alone is NOT sufficient to say goal-to-go.
            set_case(93,3,2);assert label()=='3RD & 2 · OPP 7';assert framing.state(page)['field']['lineToGain']==105
            # Ordinary first-down/loss target stays still through the dead-ball hold.
            set_case(25,1,10);page.click('#snap');old=framing.state(page)['field'];finish(29)
            assert framing.state(page)['field']==old;tick(1.3)
            assert framing.state(page)['field']=={'scrimmage':39,'lineToGain':45}
            # Actual touchdown completion and duplicate delivery do not award twice.
            set_case(98,1,2);page.click('#snap');finish(100,'TOUCHDOWN');assert framing.state(page)['drive']['score']==30
            finish(100,'TOUCHDOWN');assert framing.state(page)['drive']['score']==30
            page.click('#restart');tick();assert label()=='1ST & 10 · OPP 15'
            diag=framing.state(page);g=page.evaluate('bkGraphicsDiagnostics()')
            assert diag['glError']==0 and g['drawCalls']<=44 and g['shadowDrawCalls']==10 and g['overflows']==0,g
            assert not errors and not [u for u in requests if u.startswith(('http:','https:'))],(errors,requests)
            reports.append({'viewport':[w,h],'status':'PASS','goalLabelFits':box,'graphics':g,'errors':errors})
            page.close()
        browser.close()
    (args.output/'report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))

if __name__=='__main__':main()
