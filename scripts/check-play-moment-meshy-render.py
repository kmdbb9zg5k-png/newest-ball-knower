"""Rendered gate for the shipped skinned Meshy player in the actual game scene."""
import argparse
import json
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/meshy-player')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    handler = lambda *a, **kw: QuietHandler(*a, directory=str(ROOT / 'public'), **kw)
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.server_port}'
    report = {'kind': 'actual game WebGL2 + shipped skinned GLB; SwiftShader is not phone performance certification', 'views': []}

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                executable_path=os.environ.get('CHROMIUM_PATH'),
                args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ozone-platform=headless'],
                env={**os.environ, 'DISPLAY': ''},
            )
            page = browser.new_page(viewport={'width': 932, 'height': 430}, device_scale_factor=2, has_touch=True)
            errors, console_errors, responses = [], [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
            page.on('response', lambda response: responses.append((response.url, response.status)))
            page.goto(origin + '/play-moment-3d-preview.html?qa&scenario=redzone', wait_until='domcontentloaded')
            page.wait_for_function("window.bk3dDiagnostics && bk3dDiagnostics().athletes.ready", timeout=30_000)
            page.evaluate('bk3dTest.manualFrames(); bk3dTest.step(.2)')
            pre = page.evaluate('bk3dDiagnostics()')
            assert pre['athletes']['ready'] and not pre['athletes']['error'], pre['athletes']
            assert pre['athletes']['triangles'] == 14_187 and pre['athletes']['bones'] == 27 and pre['athletes']['clips'] == 11
            assert pre['athletes']['motionRecipes'] == 40 and pre['athletes']['states'] == ['pre'] * 22, pre['athletes']
            assert pre['athletes']['motionFamilies'] == {'quarterback': 9, 'ballCarrier': 9, 'receiver': 6, 'trenches': 11, 'contact': 7}, pre['athletes']
            assert pre['athletes']['authenticityPilot'] == ['pass-set', 'drive-block', 'edge-rush', 'carry-cut', 'wrap-tackle']
            assert len(pre['players']) == 22 and pre['drawCalls'] < 80 and pre['glError'] == 0, pre
            assert any(url.endswith('/meshy-gridiron-gold.glb') and status == 200 for url, status in responses), responses
            page.screenshot(path=str(args.output / 'detailed-presnap-932x430.png'))
            report['views'].append({'name': 'presnap', 'phase': pre['phase'], 'drawCalls': pre['drawCalls'], 'athletes': pre['athletes']})

            page.click('#snap')
            page.evaluate('bk3dTest.step(.95)')
            run = page.evaluate('bk3dDiagnostics()')
            assert run['phase'] == 'run' and any(player['engaged'] for player in run['players'][:11]), run
            assert any(player['engagedWith'] is not None for player in run['players']), 'Run blocks are not paired'
            assert 'carry-run' in run['athletes']['states'] or 'carry-sprint' in run['athletes']['states'], run['athletes']
            assert any(state in run['athletes']['states'] for state in ['drive-block', 'reach-block', 'climb-block']) and 'shed' in run['athletes']['states'], run['athletes']
            assert 'stalk-block' in run['athletes']['states'], run['athletes']
            page.screenshot(path=str(args.output / 'detailed-run-932x430.png'))
            report['views'].append({'name': 'run', 'phase': run['phase'], 'drawCalls': run['drawCalls']})

            page.click('#juke')
            page.evaluate('bk3dTest.step(.04)')
            skill = page.evaluate('bk3dDiagnostics()')
            assert skill['lastSkill'] == 'juke' and 'carry-juke' in skill['athletes']['states'], skill
            assert page.evaluate("bk3dTest.forceContact('dive')")
            page.evaluate('bk3dTest.step(.12)')
            contact = page.evaluate('bk3dDiagnostics()')
            assert contact['contact']['type'] == 'dive' and 'dive-tackle' in contact['athletes']['states'], contact
            page.screenshot(path=str(args.output / 'detailed-skill-contact-932x430.png'))
            report['views'].append({'name': 'skill-contact', 'phase': contact['phase'], 'drawCalls': contact['drawCalls']})

            page.click('#pause')
            page.click('#restart')
            page.evaluate('bk3dTest.step(.2)')
            page.click('#passTab')
            page.click('#snap')
            page.evaluate('bk3dTest.step(1.2)')
            passing = page.evaluate('bk3dDiagnostics()')
            assert passing['phase'] == 'pass' and passing['pocketPressure'] >= 0
            assert any(state in passing['athletes']['states'] for state in ['route-release', 'route-stem', 'route-cut']), passing['athletes']
            assert 'pass-anchor' in passing['athletes']['states'] and any(state in passing['athletes']['states'] for state in ['rush-engaged', 'rush-rip', 'rush-swim', 'bull-rush']), passing['athletes']
            page.locator('#target-7').click()
            page.evaluate('bk3dTest.step(.25)')
            flight = page.evaluate('bk3dDiagnostics()')
            assert flight['phase'] == 'flight' and flight['throwKind'] == 'bullet', flight
            assert flight['glError'] == 0 and flight['drawCalls'] < 80
            assert 'throw-bullet' in flight['athletes']['states'], flight['athletes']
            page.screenshot(path=str(args.output / 'detailed-pass-932x430.png'))
            report['views'].append({'name': 'pass', 'phase': flight['phase'], 'drawCalls': flight['drawCalls']})

            assert not errors and not console_errors, {'pageErrors': errors, 'consoleErrors': console_errors}
            browser.close()
    finally:
        server.shutdown()
        thread.join(timeout=2)

    (args.output / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
