"""Render one equipped anatomical character study in the current WebGL renderer.
This is an offline art prototype: not a new game route, rig, or gameplay integration.
"""
import argparse
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SCENE=r'''async({urls,model})=>{
 const {Renderer,pose,hex,mul,translate,scale,rx,rz,segment}=await import(urls.renderer);
 const {prepareJerseys}=await import(urls.athlete);
 const r=new Renderer(document.querySelector('canvas'));r.setQuality('high');
 prepareJerseys(r,[{team:0,number:11}]);
 for(const [key,mesh]of Object.entries(model.meshes))r.shapes['study-'+key]=mesh;
 // Fit the art-study helmet opening to the anatomical brow. This fit is not
 // shipped to the practice runtime; the whole study remains an offline candidate.
 const shell=structuredClone(r.shapes.helmet);
 for(let i=0;i<shell.v.length;i+=8){const y=shell.v[i+1],z=shell.v[i+2];const t=Math.max(0,Math.min(1,(.65-y)/.45));shell.v[i+1]-=.34*Math.max(0,z)**4*t;}
 for(let i=0;i<shell.v.length;i+=8)shell.v[i+3]=shell.v[i+4]=shell.v[i+5]=0;
 for(let i=0;i<shell.ix.length;i+=3){const ids=shell.ix.slice(i,i+3).map(j=>j*8),[a,b,c]=ids;const u=[0,1,2].map(k=>shell.v[b+k]-shell.v[a+k]),v=[0,1,2].map(k=>shell.v[c+k]-shell.v[a+k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const j of ids)for(let k=0;k<3;k++)shell.v[j+3+k]+=n[k];}
 for(let i=0;i<shell.v.length;i+=8){const l=Math.hypot(...shell.v.slice(i+3,i+6))||1;for(let k=3;k<6;k++)shell.v[i+k]/=l;}
 r.shapes['study-helmet']=shell;
 const colors={skin:hex('#ad7c57'),jersey:hex('#173349'),pants:hex('#203548'),socks:hex('#e6e8e2')};
 const white=hex('#e6e8e2'),dark=hex('#111a22'),gold=hex('#bba275');
 const head=mul(translate(0,1.832,.052),scale(.83,.85,.87));
 const tube=(a,b,radius,color)=>r.add('cylinder',mul(head,segment(a,b,radius)),color,'',false,.12,1);
 const ell=(m,x,y,z,sx,sy,sz,color,shine=0)=>r.add('sphere',mul(m,pose(x,y,z,sx,sy,sz)),color,'',false,shine,1);
 function equipment(){
  r.add('study-helmet',mul(head,scale(.178,.203,.204)),gold,'',false,.65,1);
  for(const [y,z]of[[-.044,.249],[-.128,.263]])for(let i=0;i<8;i++){
   const a=-1+i*.25,b=a+.25;tube([a*.143,y,z-.033*a*a],[b*.143,y,z-.033*b*b],.007,dark);
  }
  for(const side of[-1,1]){
   tube([side*.165,-.031,.119],[side*.143,-.044,.216],.007,dark);
   tube([side*.143,-.044,.216],[side*.143,-.128,.230],.007,dark);
   tube([side*.143,-.128,.230],[side*.126,-.164,.214],.007,dark);
   tube([side*.157,-.061,.092],[side*.06,-.174,.154],.008,white);
   ell(head,side*.173,-.052,-.004,.011,.025,.022,dark);
  }
  ell(head,0,-.182,.152,.060,.028,.036,white);
  for(let j=0;j<12;j++){const a=-1.57+j*.197,b=a+.205;tube([0,Math.cos(a)*.208,Math.sin(a)*.211],[0,Math.cos(b)*.208,Math.sin(b)*.211],.0075,colors.jersey);}
 }
 const positions={body:[[1.6,1.28,3.05],[0,1.04,0]],front:[[0,1.2,3.3],[0,1.05,0]],side:[[3,1.3,.2],[0,1.05,0]],rear:[[-1.6,1.28,-3.05],[0,1.04,0]],face:[[.4,1.80,1.10],[0,1.81,.08]],faceBare:[[.35,1.80,1],[0,1.81,.08]]};
 window.studyRender=(view='body')=>{
  r.camera(...positions[view]);r.begin();r.add('plane',pose(0,-.01,0,120,1,120),hex('#35404a'));
  r.actorPass=true;
  for(const key of Object.keys(model.meshes))r.add('study-'+key,pose(0,0,0),colors[key],'',false,0,key==='skin'?3:2);
  // Actual anatomical eye locations: the face's eyelid holes form the opening.
  for(const e of model.eyes){r.add('sphere',pose(...e,.0162,.0154,.0166),hex('#bfafa0'),'',false,.05,3);r.add('sphere',pose(e[0],e[1],e[2]+.015,.0065,.0065,.003),hex('#40301f'),'',false,.05,1);r.add('sphere',pose(e[0],e[1],e[2]+.0172,.0032,.0032,.0017),dark,'',false,.15,1);}
  // Opaque clothing covers the entire torso/pelvis; this is never a nude study.
  const front=mul(translate(0,1.38,.194),mul(rx(-Math.PI/2),scale(.28,-1,-.32)));
  const back=mul(translate(0,1.38,-.119),mul(rx(Math.PI/2),scale(-.28,-1,.32)));
  for(const m of[front,back])r.add('plane',m,[1,1,1,1],'jersey-0-11',false,0,2);
  for(const a of model.ankles)r.add('playerCleat',pose(a[0],.007,a[2]+.045,.084,.10,.16),dark,'',false,.10,1);
  if(view!=='faceBare')equipment();
  r.actorPass=false;r.draw();
  return{view,glError:r.gl.getError(),drawCalls:r.drawCalls,shadowDrawCalls:r.shadowDrawCalls,overflows:r.overflows,png:document.querySelector('canvas').toDataURL('image/png').split(',')[1]};
 };
}'''

def main():
    p=argparse.ArgumentParser();p.add_argument('--model',type=Path,default=Path('artifacts/anatomy-study/model.json'));p.add_argument('--output',type=Path,default=Path('artifacts/anatomy-study'))
    args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True);model=json.loads(args.model.read_text());reports=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':900,'height':900},device_scale_factor=1)
        errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
        page.set_content('<!doctype html><html><style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas></html>')
        urls={}
        for name in ['renderer','motion','geometry','athlete']:
            text=(ROOT/f'public/play-moment-3d/{name}.js').read_text()
            for dep,url in urls.items():text=text.replace("'./"+dep+".js'",repr(url))
            urls[name]=page.evaluate("s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}))",text)
        page.evaluate(SCENE,{'urls':urls,'model':model})
        for view in ['body','front','side','rear','face','faceBare']:
            d=page.evaluate('v=>studyRender(v)',view);png=d.pop('png');(args.output/f'study-{view}.png').write_bytes(base64.b64decode(png))
            assert d['glError']==0 and d['overflows']==0,d;reports.append(d)
        assert not errors and not[u for u in requests if u.startswith(('http:','https:'))],(errors,requests)
        browser.close()
    (args.output/'render-report.json').write_text(json.dumps({'scope':'Offline anatomical art study; not integrated gameplay or hardware certification','renders':reports,'errors':errors},indent=2))
    print(json.dumps(reports,indent=2))

if __name__=='__main__':main()
