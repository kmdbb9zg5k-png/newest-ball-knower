"""Actual WebGL2 stadium/22-athlete fixtures, not full-game or device certification.
Run with Python + Playwright Chromium installed. Writes screenshots/report to
--output (defaults /tmp/bk-night-stadium). Makes no external network requests.
"""
import argparse
import base64
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
HTML = r'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;background:#0a141d;color:#edece4;font:12px system-ui;overflow:hidden}canvas{position:fixed;inset:0;width:100vw;height:100vh}#label{position:fixed;bottom:12px;left:16px;letter-spacing:.12em;font-size:9px;color:#d6c99e;text-shadow:0 2px 4px #000}#error{position:fixed;z-index:3;background:#222}
</style></head><body><canvas id="game"></canvas><div id="error" hidden><span id="errorText"></span></div><div id="label">BALL KNOWER · 3D PRACTICE · STADIUM PRESENTATION TEST</div><script type="module">
import {Renderer,pose,segment,hex} from '/play-moment-3d/renderer.js';
import {prepareJerseys,drawAthlete,advanceMotion} from '/play-moment-3d/athlete.js';
const baseline=new URLSearchParams(location.search).has('baseline');
const {makeStadium}=await import(baseline?'/__baseline_stadium.js':'/play-moment-3d/stadium.js');
const r=new Renderer(document.querySelector('canvas'));
let uploads=0;const originalTexture=r.texture.bind(r);r.texture=(...a)=>{uploads++;return originalTexture(...a)};
const stadium=makeStadium(r);
const specs=[['OL',-4.4,-.35,71],['OL',-2.2,-.35,64],['OL',0,-.35,55],['OL',2.2,-.35,68],['OL',4.4,-.35,79],['QB',0,-5,12],['RB',-2,-7,24],['WR',-21,0,11],['WR',-12,-.6,18],['WR',21,0,84],['TE',6.5,-.4,87],['DL',-5,.8,90],['DL',-1.7,.8,94],['DL',1.7,.8,97],['DL',5,.8,92],['LB',-8,5,53],['LB',0,5,54],['LB',8,5,58],['DB',-20,3,21],['DB',-12,9,23],['DB',20,4,29],['DB',8,17,31]];
const players=specs.map(([role,x,z,number],index)=>({role,x,z:z+35,number,index,team:index>=11?1:0,heading:index>=11?Math.PI:0,hasBall:index===5}));
prepareJerseys(r,players);for(const p of players)advanceMotion(p,0,'pre');
const cameras={game:[[4,16,6],[0,0,42]],sideline:[[16,4.3,23],[0,1,38]],bowl:[[46,29,-12],[0,4,62]],north:[[0,15,96],[0,15,130]],south:[[0,15,24],[0,15,-10]]};
window.render=(camera='game',frames=1)=>{
 const before=uploads;const originals=players.map(p=>[p.x,p.z,p.heading]);
 for(let i=0;i<frames;i++){
  r.camera(...cameras[camera]);r.begin();stadium.draw();
  r.add('plane',pose(0,.025,35,53.15,1,.11),hex('#4599ba'),'',true);
  r.add('plane',pose(0,.03,45,53.15,1,.13),hex('#e1c156'),'',true);
  for(const p of players)r.add('plane',pose(p.x+.13,.038,p.z-.12,1.65,1,1.15),[0,0,0,.75],'shadow',true);
  r.actorPass=true;for(const p of players)drawAthlete(r,p,0,'pre');r.actorPass=false;r.draw();
 }
 return {players:players.length,parts:stadium.parts,drawCalls:r.drawCalls,shadowDrawCalls:r.shadowDrawCalls,textures:r.textures.size,newUploads:uploads-before,glError:r.gl.getError(),maxBatch:Math.max(...[...r.batches.values()].map(b=>b.count)),coordinatesUnchanged:JSON.stringify(originals)===JSON.stringify(players.map(p=>[p.x,p.z,p.heading]))};
};
window.result=window.render();
</script></body></html>'''

def offline_bundle(baseline):
    """Scope original module bodies separately; no browser URL/network access."""
    folder = PUBLIC / 'play-moment-3d'
    def module(name, prefix, exports):
        source = (folder / name).read_text()
        source = re.sub(r"(?m)^import[^\n]+;\n", '', source)
        source = re.sub(r"(?m)^export\{[^}]+\};\n", '', source)
        source = re.sub(r"(?m)^export(?=\s+(?:function|class|const))\s*", '', source)
        return '(()=>{' + prefix + source + ';return {' + ','.join(exports) + '};})()'
    renderer_exports = ['Renderer','pose','segment','hex','mul','rx','ry','rz','translate','scale','point']
    out = ['const R=' + module('renderer.js','',renderer_exports) + ';']
    out.append('const G=' + module('geometry.js','',['createTorsoGeometry','createLimbGeometry','createPlayerDetailGeometry']) + ';')
    motion_exports = ['advanceMotion','samplePose','footTarget','twoBone','readyHandTarget']
    out.append('const M=' + module('motion.js','',motion_exports) + ';')
    out.append('const A=' + module('athlete.js',
        'const {'+','.join(renderer_exports)+'}=R;const {'+','.join(motion_exports)+'}=M;const {createTorsoGeometry,createLimbGeometry,createPlayerDetailGeometry}=G;',
        ['prepareJerseys','drawAthlete','advanceMotion']) + ';')
    out.append('const N=' + module('night-stadium.js',
        'const {hex,mul,pose,rx,scale,segment,translate}=R;', ['installNightStadium']) + ';')
    out.append('const S=' + module('stadium.js',
        'const {pose,mul,rx,rz,translate,scale,segment,hex}=R;' +
        ('const installNightStadium=()=>{};' if baseline else 'const {installNightStadium}=N;'),
        ['makeStadium']) + ';')
    scene = HTML.split('<script type="module">')[1].split('</script>')[0]
    scene = scene[scene.index("const r=new Renderer"):]
    return '() => {' + ''.join(out) + 'const {Renderer,pose,segment,hex}=R;const {prepareJerseys,drawAthlete,advanceMotion}=A;const {makeStadium}=S;' + scene + 'return window.result;}'


def capture_canvas(page, path, camera):
    """Render and read back in one browser task before the default framebuffer is discarded."""
    data = page.evaluate("camera => { window.render(camera); return document.getElementById('game').toDataURL('image/png').split(',')[1] }", camera)
    path.write_bytes(base64.b64decode(data))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path('/tmp/bk-night-stadium'))
    parser.add_argument('--chromium', default=None, help='Optional system Chromium executable; default uses Playwright Chromium')
    args = parser.parse_args();args.output.mkdir(parents=True, exist_ok=True)
    reports = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=args.chromium, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for width, height in [(844, 334), (932, 430), (1440, 810)]:
            page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
            errors, outbound = [], []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('request', lambda req: outbound.append(req.url))
            results = {}
            for baseline in [True, False]:
                page.set_content(HTML.split('<script type="module">')[0] + '</body></html>')
                page.evaluate(offline_bundle(baseline))
                result = page.evaluate("window.render('game', 2)")
                assert result['players'] == 22 and result['glError'] == 0, result
                assert result['maxBatch'] < 4096, result
                assert result['newUploads'] == 0 and result['coordinatesUnchanged'], result
                key = 'before' if baseline else 'after';results[key] = result
                for camera in ['game', 'sideline', 'bowl']:
                    capture_canvas(page, args.output / f'{key}-{camera}-{width}x{height}.png', camera)
                if not baseline and width == 932:
                    for camera in ['north', 'south']:
                        capture_canvas(page, args.output / f'board-{camera}.png', camera)
            assert results['after']['drawCalls'] - results['before']['drawCalls'] <= 1, results
            assert results['after']['textures'] - results['before']['textures'] == 1, results
            assert not errors and not outbound, {'errors': errors, 'outbound': outbound}
            reports.append({'viewport': [width, height], 'results': results, 'errors': errors, 'outbound': outbound})
            page.close()
        browser.close()
    (args.output / 'report.json').write_text(json.dumps(reports, indent=2))
    print(json.dumps(reports, indent=2))

if __name__ == '__main__':
    main()
