"""Render the actual camera/HUD pass and exercise target taps. Not phone certification.
The optional before comparison uses the old game/HTML with the same current art.
All modules execute through offline Blob URLs; no server, CDN or storage is used.
"""
import argparse
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


def load(page, baseline=None):
    html = read_source('public/play-moment-3d-preview.html', baseline)
    html = re.sub(r'<script type="module">[\s\S]*?</script>', '', html)
    html = html.replace('<link rel="stylesheet" href="/play-moment-3d/hud.css">', '<style>' + read_source('public/play-moment-3d/hud.css') + '</style>')
    page.set_content(html)
    urls = {}
    for name in ['renderer', 'motion', 'geometry', 'athlete', 'night-stadium', 'stadium', 'game']:
        text = read_source(f'public/play-moment-3d/{name}.js', baseline)
        for dep, url in urls.items():
            text = text.replace("'./" + dep + ".js'", repr(url))
        text = text.replace("new URLSearchParams(location.search).has('qa')", 'true')
        text = text.replace("new URLSearchParams(location.search).get('scenario')==='redzone'", 'true')
        urls[name] = page.evaluate("s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}))", text)
    page.evaluate("async url=>{const {start}=await import(url);start();bk3dTest.manualFrames();bk3dTest.step(.2)}", urls['game'])


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
    assert len(markers) == 3
    for i, m in enumerate(markers):
        assert m['w'] >= 44 and m['h'] >= 44 and m['badgeW'] == 28 and m['badgeH'] == 28, m
        assert m['y'] >= 54 and m['y'] + m['h'] < height, m
        assert m['label'] in ['X', 'Y', 'Z'] and m['label'] in m['name'], m
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
                load(page, ref);d = state(page)
                assert d['phase'] == 'pre' and len(d['players']) == 22 and d['glError'] == 0
                snapshots[variant] = gameplay(d)
                qb = d['players'][5];pixels = qb['foot']['y'] - qb['head']['y']
                if variant == 'after':
                    assert pixels / h > .09, qb
                    for p in d['players'][:11]:
                        assert 24 < p['head']['x'] < w - 24 and 65 < p['head']['y'] and p['foot']['y'] < h - 85, p
                capture(page, args.output / f'{variant}-presnap-{w}x{h}.png')
                page.click('#passTab');page.click('#snap');page.evaluate('bk3dTest.step(1.3)')
                assert state(page)['phase'] == 'pass'
                markers = inspect_markers(page, h) if variant == 'after' else []
                capture(page, args.output / f'{variant}-passing-{w}x{h}.png')
                if variant == 'after':
                    # Tap outside the visible 28px circle but inside the real 44px button.
                    m = markers[0];page.touchscreen.tap(m['x'] + 3, m['y'] + 22)
                    assert state(page)['phase'] == 'flight', 'Transparent hit padding did not throw'
                    page.evaluate('bk3dTest.step(1)')
                    assert state(page)['phase'] in ['run', 'dead', 'pre']
                page.click('#pause');link = page.locator('#paused a');link.scroll_into_view_if_needed()
                if variant == 'after':
                    box = link.bounding_box();assert box['height'] >= 44 and box['width'] >= 44
                page.click('#restart');page.click('#runTab');page.click('#snap');page.evaluate('bk3dTest.step(.85)')
                assert state(page)['phase'] == 'run'
                capture(page, args.output / f'{variant}-running-{w}x{h}.png')
                g = page.evaluate('bkGraphicsDiagnostics()')
                assert g['drawCalls'] <= 44 and g['shadowDrawCalls'] == 10 and g['overflows'] == 0, g
                if variant == 'after':
                    page.set_viewport_size({'width': 390, 'height': 844})
                    box = page.locator('#rotate a').bounding_box();assert box and box['height'] >= 44
                assert not errors and not [u for u in requests if u.startswith(('http:', 'https:'))], {'errors': errors, 'requests': requests}
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
