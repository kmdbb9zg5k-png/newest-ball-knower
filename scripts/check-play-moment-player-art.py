"""Close-up athlete review using the shipped WebGL2 renderer, not concept images.
No production route, gameplay mutation, runtime service or new art dependency.
The optional baseline swaps only athlete/geometry modules under identical lights.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MODULES = ['renderer', 'motion', 'geometry', 'athlete']
HTML = '''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;background:#0b1420}canvas{display:block;width:100vw;height:100vh}#error{display:none}
</style></head><body><canvas id="game"></canvas><div id="error"><span id="errorText"></span></div></body></html>'''
SCENE = r'''async ({urls}) => {
 const {Renderer,pose,hex}=await import(urls.renderer);
 const {drawAthlete,prepareJerseys,advanceMotion}=await import(urls.athlete);
 const r=new Renderer(document.getElementById('game'));r.setQuality('high');
 const roles=['QB','RB','WR','TE','OL','DL','LB','DB'];
 const actors=roles.flatMap((role,index)=>[0,1].map(team=>({role,index:index*2+team,number:[12,24,11,87,71,90,54,21][index],team,x:0,z:0,heading:0,distance:0,moving:false,engaged:false,fallen:false,hasBall:role==='QB',throwT:0,catchT:0})));
 prepareJerseys(r,actors);
 for(const p of actors)advanceMotion(p,0,'run');
 window.playerArtRender=(role='WR',team=0,angle=0,view='body',action='idle')=>{
  const p=actors.find(p=>p.role===role&&p.team===team);
  delete p.motion;p.x=0;p.z=0;p.heading=angle;p.engaged=false;p.hasBall=role==='QB';p.fallen=false;p.catchT=0;p.throwT=0;
  const phase=action==='ready'?'pre':action==='throw'?'pass':'run';
  advanceMotion(p,0,phase);
  if(action==='running'){
   p.hasBall=true;for(let i=0;i<24;i++){p.z+=7.2/60;advanceMotion(p,1/60,phase);}
  }else if(action==='catch'){
   p.catchT=.35;for(let i=0;i<10;i++)advanceMotion(p,1/60,phase);
  }else if(action==='block'){
   p.engaged=true;for(let i=0;i<24;i++)advanceMotion(p,1/60,phase);
  }else if(action==='throw'){
   p.throwT=.1;for(let i=0;i<10;i++)advanceMotion(p,1/60,phase);
  }
  // Fixture translation only; do not modify model proportions or the game renderer.
  p.z=0;if(p.motion){p.motion.x=p.x;p.motion.z=p.z;p.motion.heading=p.heading;}
  const camera=view==='head'?[[.38,1.77,1.05],[0,1.72,0]]:[[1.6,1.28,3.05],[0,1.04,0]];
  r.camera(...camera);
  const state=JSON.stringify(p),textureCount=r.textures.size;
  for(let i=0;i<2;i++){
   r.begin();r.add('plane',pose(0,-.015,0,120,1,120),hex('#35404a'));
   drawAthlete(r,p,0,phase);r.draw();
  }
  return {role,team,action,view,drawCalls:r.drawCalls,shadowDrawCalls:r.shadowDrawCalls,glError:r.gl.getError(),overflows:r.overflows,textureCount:r.textures.size,textureCountStable:textureCount===r.textures.size,actorStateStable:state===JSON.stringify(p),actorPassRestored:r.actorPass===false,meshTriangles:Object.fromEntries(Object.entries(r.shapes).map(([key,g])=>[key,g.ix.length/3])),png:document.getElementById('game').toDataURL('image/png').split(',')[1]};
 };
}'''


def source(name, baseline=None):
    path=f'public/play-moment-3d/{name}.js'
    if baseline and name in ['athlete','geometry']:
        return subprocess.check_output(['git','show',f'{baseline}:{path}'],cwd=ROOT).decode()
    return (ROOT/path).read_text()


def load(page, baseline=None):
    page.set_content(HTML)
    urls={}
    for name in MODULES:
        text=source(name,baseline)
        for dep,url in urls.items():
            text=text.replace("'./"+dep+".js'",repr(url))
        assert not re.search(r"from\s*['\"]\./",text),f'Unresolved dependency: {name}'
        urls[name]=page.evaluate("s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}))",text)
    page.evaluate(SCENE,{'urls':urls})


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT/'artifacts/player-art')
    parser.add_argument('--baseline-ref',default=None)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    baseline=args.baseline_ref
    if baseline:
        for name in ['athlete','geometry']:
            if subprocess.run(['git','cat-file','-e',f'{baseline}:public/play-moment-3d/{name}.js'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
                print('Optional baseline unavailable; current model review still runs.');baseline=None;break
    report={'kind':'actual WebGL2 athlete fixtures; not device performance certification','baseline':baseline,'sourceSha256':{name:hashlib.sha256(source(name).encode()).hexdigest() for name in MODULES},'views':[]}
    views=[('WR',0,0,'body','idle'),('QB',1,0,'body','idle'),('OL',0,0,'body','idle'),('WR',0,3.14159,'body','idle'),('QB',0,0,'head','idle'),('WR',1,0,'head','idle'),('WR',0,0,'body','running'),('WR',1,0,'body','catch'),('OL',0,0,'body','block'),('QB',0,0,'body','throw')]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for variant,ref in ([('before',baseline)] if baseline else [])+[('after',None)]:
            page=browser.new_page(viewport={'width':900,'height':900},device_scale_factor=1)
            errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
            load(page,ref)
            for i,args_view in enumerate(views):
                out=page.evaluate('(a)=>window.playerArtRender(...a)',list(args_view))
                png=out.pop('png');filename=f'{variant}-{i:02d}-{args_view[0]}-{args_view[3]}-{args_view[4]}.png'
                (args.output/filename).write_bytes(base64.b64decode(png))
                assert out['glError']==0 and out['overflows']==0 and out['actorStateStable'] and out['textureCountStable'] and out['actorPassRestored'],out
                report['views'].append({'variant':variant,'image':filename,**out})
            assert not errors and not [u for u in requests if u.startswith(('http:','https:'))],{'errors':errors,'requests':requests}
            page.close()
        browser.close()
    (args.output/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

if __name__=='__main__':main()
