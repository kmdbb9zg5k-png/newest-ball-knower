"""Capture deterministic 30 fps frames from the actual Chromium/WebGL game.

Software render time is excluded from movie timing; this is motion/UI evidence,
not a device frame-rate benchmark. Keep diagnostics even when a scenario fails.
"""
import argparse
import json
import os
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

def record(browser, origin, out, mode):
    folder = out / mode
    frames = folder / 'frames'
    frames.mkdir(parents=True, exist_ok=True)
    viewport = {'width': 667, 'height': 290} if mode == 'qb-scramble' else {'width': 932, 'height': 430}
    context = browser.new_context(viewport=viewport, device_scale_factor=1, has_touch=True)
    page = context.new_page()
    errors, timeline = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    frame = 0
    result = {'mode': mode, 'status': 'failed', 'phonePerformanceCertified': False}
    def read():
        return page.evaluate('bk3dDiagnostics()')
    def check_pocket_controls():
        assert page.locator('#pumpFake').count() == 0
        assert page.locator('#scramble .action-icon').count() == 1
        assert page.locator('#throwAway .action-icon').count() == 1
        for index in [7, 8, 9, 10, 6]:
            assert page.locator(f'#target-{index} .target-label').inner_text() == read()['players'][index]['role']
        boxes = []
        for selector in ['#scramble', '#throwAway']:
            control = page.locator(selector)
            assert control.is_visible(), selector
            box = control.bounding_box()
            size = page.viewport_size
            assert box and box['width'] >= 44 and box['height'] >= 44, box
            assert box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= size['width'] and box['y'] + box['height'] <= size['height'], box
            assert control.evaluate('(el) => { const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }'), selector
            boxes.append(box)
        assert boxes[0]['x'] + boxes[0]['width'] + 4 <= boxes[1]['x'], 'Pocket actions overlap'
        instruction = page.locator('#instruction').bounding_box()
        assert instruction['x'] + instruction['width'] <= boxes[0]['x'], 'Guidance overlaps actions'
    def check_hit(selector):
        control = page.locator(selector)
        assert control.is_visible(), selector
        box, size = control.bounding_box(), page.viewport_size
        assert box and box['width'] >= 44 and box['height'] >= 44, (selector, box)
        assert box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= size['width'] + .1 and box['y'] + box['height'] <= size['height'] + .1, (selector, box)
        assert control.evaluate('(el) => { const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }'), selector
        return box
    def check_playbook():
        assert read()['playbook']['open'] and page.locator('#playbook').is_visible()
        assert page.locator('#playbookGrid .play-card').count() == 8
        assert page.locator('#pre').is_hidden() and page.locator('#live').is_hidden()
        for kind in ['run', 'pass']:
            for index in range(4):
                check_hit(f'#call-{kind}-{index}')
        for selector in ['#filterAll', '#filterRun', '#filterPass', '#breakHuddle']:
            check_hit(selector)
        score = page.locator('.scorebug').bounding_box()
        heading = page.locator('.playbook-heading').bounding_box()
        assert score['y'] + score['height'] <= heading['y'], 'Scoreboard overlaps playbook title'
    def check_presnap():
        assert not read()['playbook']['open'] and page.locator('#playbook').is_hidden()
        boxes = []
        for selector in ['#runTab', '#passTab', '#flipPlay', '#motionReceiver', '#identifyMike', '#openPlaybook', '#snap', '#stick']:
            boxes.append(check_hit(selector))
        for index in range(4):
            boxes.append(check_hit(f'#plays button:nth-child({index+1})'))
        assert page.locator('#instruction').is_hidden(), 'Duplicate pre-snap instruction returned'
        controls_top = page.locator('#plays').bounding_box()['y']
        for player in read()['players'][:11]:
            head, foot = player['head'], player['foot']
            assert head['y'] > 60 and foot['y'] < controls_top - 4, (player['role'], head, foot, controls_top)
            for box in boxes:
                assert max(head['x'], foot['x']) + 5 < box['x'] or min(head['x'], foot['x']) - 5 > box['x'] + box['width'] or foot['y'] < box['y'] or head['y'] > box['y'] + box['height'], ('Player/control overlap', player['role'], box)
    def capture(seconds):
        nonlocal frame
        for _ in range(round(seconds * 30)):
            page.evaluate('bk3dTest.step(1/30)')
            page.screenshot(path=str(frames / f'{frame:04d}.jpg'), type='jpeg', quality=85)
            state = read()
            assert state['glError'] == 0, state['glError']
            if frame % 10 == 0:
                holder = next((p for p in state['players'] if p['hasBall']), None)
                timeline.append({'frame': frame, 'phase': state['phase'], 'assist': state['assist'], 'camera': state['camera'], 'carrier': holder, 'states': state['athletes']['states']})
            frame += 1
    try:
        page.goto(origin + '/play-moment-3d-preview.html?qa', wait_until='domcontentloaded')
        page.wait_for_function('window.bk3dDiagnostics && bk3dDiagnostics().athletes.ready', timeout=45000)
        page.evaluate('bk3dTest.manualFrames(); bk3dTest.step(2)')
        loaded = read()
        assert (loaded['athletes']['triangles'], loaded['athletes']['bones'], loaded['athletes']['clips']) == (28988, 28, 8)
        assert loaded['assist'] is True
        assert loaded['playbook']['open'] and loaded['drive']['clock'] == 78
        page.keyboard.press('Space')
        page.evaluate('bk3dTest.step(2)')
        assert read()['phase'] == 'pre' and read()['drive']['clock'] == 78
        check_playbook()
        if mode == 'qb-scramble':
            for width, height in [(932, 430), (844, 390), (667, 290)]:
                page.set_viewport_size({'width': width, 'height': height})
                page.wait_for_function('([w,h]) => { const c=document.querySelector("#game"); return c.width===w && c.height===h; }', arg=[width, height])
                page.evaluate('bk3dTest.step(1/60)')
                check_playbook()
                page.screenshot(path=str(folder / f'playbook-{width}x{height}.png'))
                page.click('#filterPass')
                assert page.locator('#playbookGrid .play-card').count() == 4
                page.click('#call-pass-1')
                page.click('#pause');page.click('#resume')
                assert page.locator('#callName').inner_text() == 'VERTICALS'
                page.click('#breakHuddle')
                assert read()['mode'] == 'pass' and read()['selected'] == 1
                page.evaluate('bk3dTest.step(2)')
                check_presnap()
                page.screenshot(path=str(folder / f'presnap-{width}x{height}.png'))
                page.click('#openPlaybook')
                assert read()['playbook']['choice']['index'] == 1
                page.click('#filterRun')
                assert page.locator('#playbookGrid .play-card').count() == 4
                page.click('#filterAll')
        page.screenshot(path=str(folder / 'playbook.png'))
        call_mode = 'pass' if mode in ['pass', 'qb-scramble'] else 'run'
        page.click(f'#call-{call_mode}-0');page.click('#breakHuddle')
        page.evaluate('bk3dTest.step(2)')
        check_presnap()
        page.screenshot(path=str(folder / 'presnap.png'))
        if mode == 'manual-run':
            page.click('#control')
            assert read()['assist'] is False
            page.keyboard.down('ArrowUp')
        page.click('#snap')
        if mode == 'qb-scramble':
            capture(.45)
            assert read()['phase'] == 'pass'
            for width, height in [(932, 430), (844, 390), (667, 290)]:
                page.set_viewport_size({'width': width, 'height': height})
                # Resize clears WebGL's drawing buffer. Let the real resize
                # handler finish before drawing the paused manual-clock frame.
                page.wait_for_function('([w,h]) => { const c=document.querySelector("#game"); return c.width===w && c.height===h; }', arg=[width, height])
                page.evaluate('bk3dTest.step(1/60)')
                check_pocket_controls()
                page.screenshot(path=str(folder / f'controls-{width}x{height}.png'))
            page.screenshot(path=str(folder / 'scramble-controls.png'))
            page.locator('#scramble').click()
            assert read()['phase'] == 'run' and read()['players'][5]['hasBall']
            assert page.locator('#scramble').is_hidden()
            page.keyboard.down('Shift')
            capture(1.8)
            page.keyboard.up('Shift')
            assert any(item['phase'] == 'run' and item['carrier'] and item['carrier']['role'] == 'QB' for item in timeline)
        elif mode == 'pass':
            capture(.9)
            assert read()['phase'] == 'pass'
            check_pocket_controls()
            page.locator('#target-7').click()
            assert read()['throwing'] and read()['players'][5]['hasBall']
            for _ in range(24):
                if read()['phase'] == 'flight':
                    break
                assert read()['phase'] == 'pass' and read()['players'][5]['hasBall']
                capture(1 / 30)
            assert read()['phase'] == 'flight' and not read()['players'][5]['hasBall']
            # Catch choices intentionally appear partway through the flight.
            # In manual-clock mode, waiting for visibility cannot advance time.
            secure = page.locator('#catchChoices button[data-catch="secure"]')
            for _ in range(40):
                if secure.is_visible():
                    break
                assert read()['phase'] == 'flight', 'Flight ended before catch controls appeared'
                capture(1 / 30)
            assert secure.is_visible(), 'Catch controls never appeared during flight'
            secure.click()
            capture(1.8)
            assert read()['phase'] in ['run', 'dead']
        else:
            capture(1.5)
            assert read()['phase'] == 'run', read()['phase']
            if mode == 'manual-run':
                page.keyboard.down('ArrowRight')
            capture(1.2)
            if mode == 'manual-run':
                page.keyboard.up('ArrowRight')
                page.keyboard.up('ArrowUp')
            assert any(item['phase'] == 'run' for item in timeline)
            if read()['phase'] == 'run':
                assert page.evaluate("bk3dTest.forceContact('wrap')")
            capture(.9)
            assert read()['phase'] == 'dead'
            page.evaluate('bk3dTest.step(1.5)')
        page.screenshot(path=str(folder / 'finish.png'))
        if read()['phase'] == 'run':
            assert page.evaluate("bk3dTest.forceContact('wrap')")
        if read()['phase'] == 'dead':
            page.evaluate('bk3dTest.step(5)')
        if not read()['ended']:
            assert read()['phase'] == 'pre' and read()['playbook']['open']
            clock = read()['drive']['clock']
            page.evaluate('bk3dTest.step(2)')
            assert read()['drive']['clock'] == clock
            check_playbook()
            page.screenshot(path=str(folder / 'next-down-playbook.png'))
        assert not errors, errors
        result.update(status='passed', frames=frame, finalPhase=read()['phase'], glError=read()['glError'])
    except Exception as exc:
        result['error'] = f'{type(exc).__name__}: {exc}'
        try:
            page.screenshot(path=str(folder / 'failure.png'))
        except Exception:
            pass
    finally:
        context.close()
    result['pageErrors'] = errors
    (folder / 'timeline.json').write_text(json.dumps(timeline, indent=2))
    ffmpeg = shutil.which('ffmpeg')
    if ffmpeg and frame:
        encoded = subprocess.run([ffmpeg, '-v', 'error', '-framerate', '30', '-i', str(frames / '%04d.jpg'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-y', str(folder / 'gameplay.mp4')], capture_output=True, text=True)
        if encoded.returncode == 0:
            shutil.rmtree(frames)
            result['video'] = f'{mode}/gameplay.mp4'
        else:
            result['encodingError'] = encoded.stderr[-500:]
    (folder / 'report.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result), flush=True)
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/gameplay-motion')
    parser.add_argument('--mode', choices=['all', 'automatic-run', 'manual-run', 'pass', 'qb-scramble'], default='all')
    args = parser.parse_args()
    modes = ['automatic-run', 'manual-run', 'pass', 'qb-scramble'] if args.mode == 'all' else [args.mode]
    args.output.mkdir(parents=True, exist_ok=True)
    handler = lambda *a, **kw: QuietHandler(*a, directory=str(ROOT / 'public'), **kw)
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    results = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'), args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ozone-platform=headless'])
            for mode in modes:
                results.append(record(browser, f'http://127.0.0.1:{server.server_port}', args.output, mode))
            browser.close()
    finally:
        server.shutdown()
        thread.join(timeout=2)
        (args.output / 'report.json').write_text(json.dumps({'renderer': 'Chromium WebGL2 / SwiftShader', 'fps': 30, 'phonePerformanceCertified': False, 'scenarios': results}, indent=2))
    if len(results) != len(modes) or any(item['status'] != 'passed' for item in results):
        raise SystemExit('Actual WebGL motion verification failed; see reports and captures.')

if __name__ == '__main__':
    main()
