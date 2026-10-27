"""Render the actual camera/HUD pass and exercise target taps. Not phone certification.
The optional before comparison uses the old game/HTML with the same current art.
Modules and assets are served from loopback using the real import graph. No CDN is used.
"""
import argparse
import atexit
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import os
import re
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]


def read_source(path, baseline=None):
    if baseline and path in ('public/play-moment-3d/game.js', 'public/play-moment-3d-preview.html'):
        return subprocess.check_output(['git', 'show', f'{baseline}:{path}'], cwd=ROOT).decode()
    return (ROOT / path).read_text()


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
SERVER=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT/'public')))
threading.Thread(target=SERVER.serve_forever,daemon=True).start()
atexit.register(SERVER.server_close)
ORIGIN=f'http://127.0.0.1:{SERVER.server_port}'

def load(page, baseline=None):
    def source_route(route):
        from urllib.parse import urlparse
        path='public'+urlparse(route.request.url).path
        if path.endswith(('.js','.html')):
            route.fulfill(body=read_source(path,baseline),content_type='text/javascript' if path.endswith('.js') else 'text/html')
        else: route.continue_()
    page.route(ORIGIN+'/**',source_route)
    page.goto(ORIGIN+'/play-moment-3d-preview.html?qa&scenario=redzone&assist=1',wait_until='domcontentloaded')
    page.wait_for_function('window.bk3dTest',timeout=45000)
    page.evaluate('bk3dTest.manualFrames()')
    page.wait_for_function('bk3dDiagnostics().athletes.ready',timeout=45000)
    page.wait_for_function('window.bkSceneArtDiagnostics && Object.values(bkSceneArtDiagnostics()).slice(0,3).every(Boolean)',timeout=45000)
    page.evaluate('bk3dTest.step(.2)')

def choose(page,mode='run',index=0):
    if not state(page)['playbook']['open']:
        page.click('#adjustPlay');page.click('#audibleTab');page.click('#openPlaybook')
    page.locator('#formationTabs button[data-formation="all"]').click()
    page.click('#filterRun' if mode=='run' else '#filterPass')
    page.click(f'#call-{mode}-{index}');page.click('#breakHuddle')

def until(page,predicate,limit=8,interval=.1):
    for _ in range(round(limit/interval)):
        d=state(page)
        if predicate(d):return d
        page.evaluate('(dt)=>bk3dTest.step(dt)',interval)
    raise AssertionError(('State did not arrive',state(page)))

def graphics_check(page):
    g=page.evaluate('bkGraphicsDiagnostics()')
    assert g['drawCalls']<77 and 0<g['shadowDrawCalls']<40 and g['overflows']==0,g
    assert g['textureCount']>=3,g
    return g


def capture(page, path):
    # Capture within the draw task; preserveDrawingBuffer remains disabled in-game.
    page.evaluate("""async()=>{bk3dTest.step(0);const canvas=document.getElementById('game');
      const im=new Image();im.id='qa-capture';im.src=canvas.toDataURL('image/png');
      im.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
      canvas.before(im);canvas.style.opacity='0';await im.decode();}""")
    try:
        page.screenshot(path=str(path))
    finally:
        page.evaluate("document.getElementById('qa-capture').remove();document.getElementById('game').style.opacity=''")


def state(page):
    return page.evaluate('bk3dDiagnostics()')


def gameplay(d):
    return {'phase': d['phase'], 'drive': d['drive'], 'players': [{k: p[k] for k in ['x', 'z', 'distance', 'heading']} for p in d['players']]}


def inspect_markers(page, height):
    markers = page.locator('.target').evaluate_all("""els=>els.map(e=>{
      const r=e.getBoundingClientRect(),b=e.querySelector('.target-label').getBoundingClientRect();
      return{id:e.id,x:r.x,y:r.y,w:r.width,h:r.height,badgeW:b.width,badgeH:b.height,badgeBottom:b.bottom,
      label:e.textContent,name:e.getAttribute('aria-label'),tether:e.firstElementChild.style.height};})""")
    assert len(markers) == 5
    for i, m in enumerate(markers):
        assert m['w'] >= 44 and m['h'] >= 44 and m['badgeW'] == 34 and m['badgeH'] == 34, m
        assert m['y'] >= 54 and m['y'] + m['h'] < height, m
        assert m['label'] in ['WR','TE','RB'] and m['label'] in m['name'], m
        for n in markers[:i]:
            assert m['x'] + m['w'] <= n['x'] or n['x'] + n['w'] <= m['x'] or m['y'] + m['h'] <= n['y'] or n['y'] + n['h'] <= m['y'], markers
    d = state(page)
    for m in markers:
        p = d['players'][int(m['id'].split('-')[1])]
        assert m['badgeBottom'] < p['head']['y'], {'marker': m, 'head': p['head']}
    return markers


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/framing')
    parser.add_argument('--baseline-ref', default=None)
    args = parser.parse_args();args.output.mkdir(parents=True, exist_ok=True)
    reports = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for w, h in [(844, 334), (932, 430), (1440, 810)]:
            snapshots, results = {}, {}
            for variant, ref in ([('before', args.baseline_ref)] if args.baseline_ref else []) + [('after', None)]:
                page = browser.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=True)
                errors, requests = [], []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.on('request', lambda r: requests.append(r.url))
                load(page, ref)
                if page.locator('#breakHuddle').is_visible():
                    page.click('#breakHuddle');page.evaluate('bk3dTest.step(2)')
                d = state(page)
                assert d['phase'] == 'pre' and len(d['players']) == 22 and d['glError'] == 0
                snapshots[variant] = gameplay(d)
                qb = d['players'][5];pixels = qb['foot']['y'] - qb['head']['y']
                if variant == 'after':
                    assert pixels / h > .09, qb
                    for p in d['players'][:11]:
                        assert 24 < p['head']['x'] < w - 24 and 65 < p['head']['y'] and p['foot']['y'] < h - 85, p
                capture(page, args.output / f'{variant}-presnap-{w}x{h}.png')
                page.click('#adjustPlay');page.click('#audibleTab');page.click('#openPlaybook');page.click('#call-pass-0');page.click('#breakHuddle');page.click('#snap');page.evaluate('bk3dTest.step(1.3)')
                assert state(page)['phase'] == 'pass'
                markers = inspect_markers(page, h) if variant == 'after' else []
                capture(page, args.output / f'{variant}-passing-{w}x{h}.png')
                if variant == 'after':
                    # Tap outside the visible 34px circle but inside the real 44px button.
                    m = markers[0];page.touchscreen.tap(m['x'] + 3, m['y'] + 22)
                    assert state(page)['throwing'], 'Transparent hit padding did not start throw windup'
                    until(page,lambda d:d['phase']=='flight',limit=1)
                    page.evaluate('bk3dTest.step(1)')
                    assert state(page)['phase'] in ['run', 'dead', 'pre']
                if state(page)['ended']:
                    until(page,lambda d:d['paused'],limit=14,interval=1)
                else:page.click('#pause')
                link = page.locator('#paused a');link.scroll_into_view_if_needed()
                if variant == 'after':
                    box = link.bounding_box();assert box['height'] >= 44 and box['width'] >= 44
                page.click('#restart')
                if page.locator('#breakHuddle').is_visible():
                    page.click('#breakHuddle')
                page.click('#adjustPlay');page.click('#audibleTab');page.click('#openPlaybook');page.click('#call-run-0');page.click('#breakHuddle');page.click('#snap');until(page,lambda d:d['phase']=='run',limit=3)
                assert state(page)['phase'] == 'run'
                capture(page, args.output / f'{variant}-running-{w}x{h}.png')
                # Detailed players plus the visible carried football stay inside a
                # bounded batch budget with the shipped local scene textures.
                g = graphics_check(page)
                if variant == 'after':
                    page.set_viewport_size({'width': 390, 'height': 844})
                    box = page.locator('#rotate a').bounding_box();assert box and box['height'] >= 44
                assert not errors and not [u for u in requests if u.startswith(('http:', 'https:')) and not u.startswith(ORIGIN+'/')], {'errors': errors, 'requests': requests}
                print(f'PASS framing {variant} {w}x{h}',flush=True)
                results[variant] = {'qbScreenHeight': pixels, 'graphics': g, 'markers': markers, 'errors': errors}
                page.close()
            if 'before' in snapshots:
                assert snapshots['before'] == snapshots['after'], 'Pre-snap game state changed'
                results['sizeRatio'] = results['after']['qbScreenHeight'] / results['before']['qbScreenHeight']
            reports.append({'viewport': [w, h], 'results': results})
        browser.close()
    (args.output / 'report.json').write_text(json.dumps(reports, indent=2))
    print(json.dumps(reports, indent=2))

if __name__ == '__main__':
    main()
