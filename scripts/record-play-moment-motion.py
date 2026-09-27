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
    context = browser.new_context(viewport={'width': 932, 'height': 430}, device_scale_factor=1, has_touch=True)
    page = context.new_page()
    errors, timeline = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    frame = 0
    result = {'mode': mode, 'status': 'failed', 'phonePerformanceCertified': False}
    def read():
        return page.evaluate('bk3dDiagnostics()')
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
        page.screenshot(path=str(folder / 'presnap.png'))
        if mode == 'manual-run':
            page.click('#control')
            assert read()['assist'] is False
            page.keyboard.down('ArrowUp')
        elif mode == 'pass':
            page.click('#passTab')
        page.click('#snap')
        if mode == 'pass':
            capture(.9)
            assert read()['phase'] == 'pass'
            page.locator('#target-7').click()
            assert read()['phase'] == 'flight'
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
    parser.add_argument('--mode', choices=['all', 'automatic-run', 'manual-run', 'pass'], default='all')
    args = parser.parse_args()
    modes = ['automatic-run', 'manual-run', 'pass'] if args.mode == 'all' else [args.mode]
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
