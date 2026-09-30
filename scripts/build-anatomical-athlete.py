#!/usr/bin/env python3
"""Build a complete clothed athlete from verified CC0 anatomy and the owned motion rig.
Original conversion, garment fitting, rig transfer and materials. No source mesh
from the previous athlete is retained in the body, hands or face.
"""
import copy,importlib.util,json,io,os,subprocess,sys
from pathlib import Path
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def module(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
rig=module('rig','rig-gridiron-sentinel.py');study=module('study','compile-player-study.py')
model=study.compile_study(ROOT/'artifacts/player-foundation',neutral=True,athletic=True)
doc,db=rig.prepare.read_glb(ROOT/'public/play-moment-3d/assets/ball-knower-gridiron-sentinel-v4.glb');doc=copy.deepcopy(doc)
prim=doc['meshes'][0]['primitives'][0];skin=doc['skins'][0];names=[doc['nodes'][i]['name'].split(':')[-1] for i in skin['joints']]
bind=np.linalg.inv(rig.read_array(doc,db,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1))
oldp=rig.read_array(doc,db,prim['attributes']['POSITION']);oldj=rig.read_array(doc,db,prim['attributes']['JOINTS_0']);oldw=rig.read_array(doc,db,prim['attributes']['WEIGHTS_0'])
# Fit anatomical joint landmarks to the existing rig in its actual bind pose.
# The face retains its natural skull shape instead of matching a generated head.
source=[];target=[];sf=1.7/model['height']
for side,label in [('Left','l'),('Right','r')]:
 for key,bone in [('shoulder','Arm'),('elbow','ForeArm'),('hand','Hand'),('upper-leg','UpLeg'),('knee','Leg'),('ankle','Foot')]:
  source.append(np.array(model['joints']['joint-'+label+'-'+key])*sf);target.append(bind[names.index(side+bone),:3,3])
for side in [-1,1]:
 for z in [-.045,.08,.18]:
  source.append([side*.225*sf,0,z*sf]);target.append([side*.20,.006,z*sf-.03])
for y in [.0,.75,1.02,1.30,1.46,1.60,1.70]:
 source.append([0,y,.02]);target.append([0,y,-.04 if y<1.42 else -.012])
warp=RBFInterpolator(np.array(source),np.array(target)-source,kernel='thin_plate_spline',smoothing=.0001)
def fit(p):
 q=np.array(p)*sf;fitted=q+warp(q)
 # Keep the anatomical face/skull rigid and undistorted. Arm landmarks must
 # never flatten a nose or shear the cheeks through a global warp.
 head=study.smooth(1.445,1.510,q[:,1])[:,None]
 return fitted*(1-head)+(q+np.array([0,0,-.040]))*head
def subdivide(p,uv,tri):
 # Loop subdivision across welded UV seams keeps cloth silhouettes continuous.
 unique,inv=np.unique(np.round(p,6),axis=0,return_inverse=True)
 neighbors=[set() for _ in unique];opposite={}
 for face in inv[tri]:
  for a,b,c in [(face[0],face[1],face[2]),(face[1],face[2],face[0]),(face[2],face[0],face[1])]:
   if a==b:continue
   neighbors[a].add(b);neighbors[b].add(a);opposite.setdefault(tuple(sorted([a,b])),[]).append(c)
 new=unique.copy()
 for i,ns in enumerate(neighbors):
  boundary=[n for n in ns if len(opposite[tuple(sorted([i,n]))])==1]
  if len(boundary)==2:new[i]=unique[i]*.75+unique[boundary].sum(0)*.125
  elif ns:
   beta=3/16 if len(ns)==3 else 3/(8*len(ns));new[i]=unique[i]*(1-len(ns)*beta)+unique[list(ns)].sum(0)*beta
 points=list(new[inv]);tex=list(uv);edges={};out=[]
 def edge(a,b):
  key=tuple(sorted([int(a),int(b)]))
  if key not in edges:
   wa,wb=inv[a],inv[b];others=opposite.get(tuple(sorted([wa,wb])),[])
   q=(unique[wa]+unique[wb])*.5 if len(others)!=2 else (unique[wa]+unique[wb])*.375+unique[others].sum(0)*.125
   edges[key]=len(points);points.append(q);tex.append((uv[a]+uv[b])*.5)
  return edges[key]
 for a,b,c in tri:
  ab,bc,ca=edge(a,b),edge(b,c),edge(c,a);out.extend([[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])
 return np.array(points),np.array(tex),np.array(out)
positions=[];uvs=[];regions=[];triangles=[]
for key,mesh in model['meshes'].items():
 v=np.array(mesh['v']).reshape(-1,8);p=fit(v[:,:3]);offset=sum(len(a) for a in positions)
 # Real room over football shoulder/chest pads, tapered to the waist.
 if key=='jersey':
  pad=study.smooth(1.05,1.30,p[:,1])*(1-study.smooth(1.40,1.48,p[:,1]))*(1-study.smooth(.25,.38,np.abs(p[:,0])))
  p[:,0]*=1+.14*pad;p[:,2]+=np.sign(p[:,2]+.04)*.025*pad
  p[:,1]+=.022*pad*np.exp(-((np.abs(p[:,0])-.22)/.085)**2)
 if key=='pants':
  for sign in [-1,1]:
   mask=study.smooth(.06,.11,sign*p[:,0])*(1-study.smooth(.83,.98,p[:,1]))*study.smooth(.38,.58,p[:,1])
   center=sign*(.13+.03*(.9-p[:,1]));p[:,0]+=(p[:,0]-center)*.13*mask;p[:,2]+=(p[:,2]+.03)*.10*mask
 tex=v[:,6:8];ix=np.array(mesh['ix']).reshape(-1,3)
 if key in ['jersey','pants']:p,tex,ix=subdivide(p,tex,ix)
 positions.append(p);uvs.append(tex);regions.extend([{'skin':6,'jersey':8,'pants':9,'socks':10,'cleats':11}[key]]*len(p));triangles.extend((ix+offset).tolist())
p=np.concatenate(positions);uv=np.concatenate(uvs);triangles=np.array(triangles,dtype=np.uint32);regions=np.array(regions,dtype=float)
# Retire only the skin hidden inside the fitted opaque shell: avoid skull
# poking through equipment during pose/role shaping, preserve the real face.
centers=p[triangles].mean(1);skin_faces=np.all(regions[triangles]==6,axis=1)
hidden=skin_faces&(centers[:,1]>1.595)&((centers[:,2]<.074)|(centers[:,1]>1.625))
triangles=triangles[~hidden]
# Interpolate the licensed donor's skin after landmark fitting; preserve all
# skeleton transforms and authored animation channels exactly.
dist,near=cKDTree(oldp).query(p,k=12);blend=1/np.maximum(dist,.004)**4;blend/=blend.sum(1)[:,None];dense=np.zeros((len(p),len(names)))
for k in range(12):
 for c in range(4):np.add.at(dense,(np.arange(len(p)),oldj[near[:,k],c]),blend[:,k]*oldw[near[:,k],c])
head=(p[:,1]>1.505)&(regions==6);dense[head]=0;dense[head,names.index('Head')]=1
# Sleeve/upper-arm vertices must follow the arm, never the nearby head or
# torso surface. Explicit anatomical weights prevent pad/sleeve separation.
for side,sign in [('Left',1),('Right',-1)]:
 x=sign*p[:,0];mask=study.smooth(.17,.29,x)*study.smooth(1.05,1.16,p[:,1])*(1-study.smooth(1.47,1.53,p[:,1]))
 arm=1-study.smooth(.345,.445,x);hand=study.smooth(.545,.635,x);fore=(1-arm)*(1-hand);arm*=1-hand
 anatomical=np.zeros_like(dense);anatomical[:,names.index(side+'Arm')]=arm;anatomical[:,names.index(side+'ForeArm')]=fore;anatomical[:,names.index(side+'Hand')]=hand
 dense=dense*(1-mask[:,None])+anatomical*mask[:,None]
# Clothing masks follow semantic parts, including anatomically modeled fingers.
hand=dense[:,[names.index(s+'Hand') for s in ['Left','Right']]].sum(1)+dense[:,[names.index(s+'HandMiddle4') for s in ['Left','Right']]].sum(1)
regions[(regions==6)&(hand>.48)]=12
regions[p[:,1]<.125]=11
j=np.argsort(dense,axis=1)[:,-4:][:,::-1];w=np.take_along_axis(dense,j,1);w/=w.sum(1)[:,None]
# Keep the authored helmet/cage; discard its sphere-based face entirely.
equipment_path=ROOT/'artifacts/anatomical-build/equipment.glb'
subprocess.run([sys.executable,str(ROOT/'scripts/remodel-gridiron-athlete.py')],check=True,env={**os.environ,'BK_EQUIPMENT_OUTPUT':str(equipment_path)},stdout=subprocess.DEVNULL)
equip,eb=rig.prepare.read_glb(equipment_path);ep=equip['meshes'][0]['primitives'][0];er=rig.read_array(equip,eb,ep['attributes']['_EQUIPMENT']).reshape(-1);ei=rig.read_array(equip,eb,ep['indices']).reshape(-1,3);ei=ei[np.all((er[ei]>0)&(er[ei]<5),axis=1)];used=np.unique(ei);mapping=np.zeros(len(er),dtype=np.uint32);mapping[used]=np.arange(len(used))+len(p)
triangles=np.concatenate([triangles,mapping[ei]]);p=np.concatenate([p,rig.read_array(equip,eb,ep['attributes']['POSITION'])[used]]);uv=np.concatenate([uv,rig.read_array(equip,eb,ep['attributes']['TEXCOORD_0'])[used]]);j=np.concatenate([j,rig.read_array(equip,eb,ep['attributes']['JOINTS_0'])[used]]);w=np.concatenate([w,rig.read_array(equip,eb,ep['attributes']['WEIGHTS_0'])[used]]);regions=np.concatenate([regions,er[used]])
# Anatomical eyeballs sit inside modeled eyelid openings.
def sphere(center,radius,region,rows=10,sides=20,bone=None):
 global p,uv,j,w,regions,triangles
 points=[];tex=[];ix=[];base=len(p)
 for a in range(rows+1):
  th=a/rows*np.pi
  for b in range(sides+1):
   ph=b/sides*2*np.pi;points.append(np.array(center)+np.array(radius)*[np.sin(th)*np.cos(ph),np.cos(th),np.sin(th)*np.sin(ph)]);tex.append([b/sides,a/rows])
 for a in range(rows):
  for b in range(sides):
   n=base+a*(sides+1)+b;ix.extend([[n,n+1,n+sides+1],[n+1,n+sides+2,n+sides+1]])
 p=np.concatenate([p,points]);uv=np.concatenate([uv,tex]);j=np.concatenate([j,np.tile([names.index(bone or 'Head'),0,0,0],(len(points),1))]);w=np.concatenate([w,np.tile([1,0,0,0],(len(points),1))]);regions=np.concatenate([regions,np.full(len(points),region)]);triangles=np.concatenate([triangles,ix])
for side in ['Left','Right']:
 toe=bind[names.index(side+'ToeBase'),:3,3].copy();toe[1]=.045;toe[2]+=.025
 sphere(toe,[.055,.038,.079],11,rows=12,sides=24,bone=side+'Foot')
 heel=bind[names.index(side+'Foot'),:3,3].copy();heel[1]=.076;heel[2]-=.014
 sphere(heel,[.052,.064,.047],11,rows=12,sides=24,bone=side+'Foot')
for eye in model['eyes']:
 e=fit(np.array([eye]))[0];sphere(e,[.0135,.013,.0138],4);sphere(e+[0,0,.0128],[.0047,.0047,.0015],7)
# Weld normals across UV seams, preserving smooth organic anatomy and hard
# equipment boundaries. This replaces the old generated dents completely.
n=np.zeros_like(p)
for c in range(3):np.add.at(n,triangles[:,c],np.cross(p[triangles[:,1]]-p[triangles[:,0]],p[triangles[:,2]]-p[triangles[:,0]]))
keys=np.column_stack([np.round(p*1e5),regions]);_,inverse=np.unique(keys,axis=0,return_inverse=True);sums=np.zeros((inverse.max()+1,3));np.add.at(sums,inverse,n);n=sums[inverse];n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-10)
t=rig.tangent_frame(p,n,uv,triangles)
# Compact the payload to active rig channels plus the new body and tiny maps.
binary=bytearray(db)
def view(raw):
 binary.extend(b'\0'*(-len(binary)%4));i=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(raw)});binary.extend(raw);return i
def accessor(a,typ,component):
 i=len(doc['accessors']);v={'bufferView':view(a.tobytes()),'componentType':component,'count':len(a),'type':typ}
 if typ=='VEC3':v.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 doc['accessors'].append(v);return i
prim['attributes']={k:accessor(a,typ,ct) for k,a,typ,ct in [('POSITION',p.astype('<f4'),'VEC3',5126),('NORMAL',n.astype('<f4'),'VEC3',5126),('TEXCOORD_0',uv.astype('<f4'),'VEC2',5126),('TANGENT',t,'VEC4',5126),('JOINTS_0',j.astype('<u2'),'VEC4',5123),('WEIGHTS_0',w.astype('<f4'),'VEC4',5126),('_EQUIPMENT',regions.astype('<f4').reshape(-1,1),'SCALAR',5126)]};prim['indices']=accessor(triangles.astype('<u4').reshape(-1,1),'SCALAR',5125)
doc['images']=[]
for color in [(190,190,190),(128,128,255),(255,210,0)]:
 image=Image.new('RGB',(8,8),color);buf=io.BytesIO();image.save(buf,format='PNG');doc['images'].append({'bufferView':view(buf.getvalue()),'mimeType':'image/png'})
doc['textures']=[{'source':i} for i in range(3)];doc['samplers']=[];doc['materials']=[{'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':2}},'normalTexture':{'index':1}}];prim['material']=0
refs=[(prim['attributes'],k) for k in prim['attributes']]+[(prim,'indices'),(skin,'inverseBindMatrices')]
for a in doc['animations']:
 for s in a['samplers']:refs.extend([(s,'input'),(s,'output')])
active=sorted({o[k] for o,k in refs});mapping={old:new for new,old in enumerate(active)};doc['accessors']=[doc['accessors'][i] for i in active]
for o,k in refs:o[k]=mapping[o[k]]
active=sorted({a['bufferView'] for a in doc['accessors']}|{im['bufferView'] for im in doc['images']});mapping={old:new for new,old in enumerate(active)};packed=bytearray();views=[]
for i in active:
 v=dict(doc['bufferViews'][i]);start=v.get('byteOffset',0);packed.extend(b'\0'*(-len(packed)%4));v['byteOffset']=len(packed);packed.extend(binary[start:start+v['byteLength']]);views.append(v)
for a in doc['accessors']:a['bufferView']=mapping[a['bufferView']]
for im in doc['images']:im['bufferView']=mapping[im['bufferView']]
doc['bufferViews']=views;doc['buffers'][0]['byteLength']=len(packed)
doc['asset']['generator']='Ball Knower anatomical athlete pipeline';doc['extras']={'ballKnowerAthlete':{'version':6,'name':'Anatomical Gridiron Athlete','bodySource':'MakeHuman CC0 core graphical assets','sourceRevision':model['sourceRevision'],'rigMethod':'anatomical landmark fitting and donor surface skin transfer','mobileVertices':len(p),'mobileTriangles':len(triangles),'motions':[a['name'] for a in doc['animations']],'transferDistanceP95':float(np.percentile(dist[:,0],95))}}
output=ROOT/'public/play-moment-3d/assets/ball-knower-anatomical-athlete-v6.glb';rig.prepare.write_glb(output,doc,packed);print(json.dumps({'bytes':output.stat().st_size,**doc['extras']['ballKnowerAthlete']},indent=2))
