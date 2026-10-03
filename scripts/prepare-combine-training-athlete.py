#!/usr/bin/env python3
"""Retarget the approved Meshy locomotion to the uploaded Smart Rig athlete.

Keeps every vertex, triangle, UV and skin weight. The untouched uploaded GLB is
our master; this derivative uses 4K color and 2K normal and 1K material maps.
Requires numpy, scipy and Pillow. No external service or credentials required.
"""
import argparse, importlib.util, io, json, struct
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation as R, Slerp

spec=importlib.util.spec_from_file_location('glb',Path(__file__).with_name('prepare-meshy-rigged-athlete.py'))
glb=importlib.util.module_from_spec(spec);spec.loader.exec_module(glb)
# Anatomical mapping verified against bind-space joint coordinates in this export.
NAMES={35:'Hips',34:'PelvisBase',33:'Pelvis',18:'Spine',17:'Spine1',16:'Spine2',15:'Chest',14:'Neck',1:'Head',0:'HeadTop_End',13:'LeftShoulder',12:'LeftArm',11:'LeftForeArm',10:'LeftHand',9:'LeftHandMiddle4',8:'LeftFingerEnd',7:'RightShoulder',6:'RightArm',5:'RightForeArm',4:'RightHand',3:'RightHandMiddle4',2:'RightFingerEnd',32:'LeftUpLeg',31:'LeftLeg',30:'LeftFoot',29:'LeftToeBase',28:'LeftToe1',27:'LeftToe2',26:'LeftToe_End',25:'RightUpLeg',24:'RightLeg',23:'RightFoot',22:'RightToeBase',21:'RightToe1',20:'RightToe2',19:'RightToe_End'}
CHILD={'Hips':'Spine','Spine':'Spine1','Spine1':'Spine2','Spine2':'Neck','Neck':'Head','Head':'HeadTop_End'}
for side in ('Left','Right'):
 for a,b in [('Shoulder','Arm'),('Arm','ForeArm'),('ForeArm','Hand'),('Hand','HandMiddle4'),('UpLeg','Leg'),('Leg','Foot'),('Foot','ToeBase'),('ToeBase','Toe_End')]:CHILD[side+a]=side+b

def accessor(d,b,i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',np.dtype(dt).itemsize*k)
 return np.ndarray((a['count'],k),dtype=dt,buffer=b,offset=off,strides=(stride,np.dtype(dt).itemsize)).copy()

def skeleton(d):
 ns=d['nodes'];parents={c:i for i,n in enumerate(ns)for c in n.get('children',[])}
 p=np.array([n.get('translation',[0,0,0])for n in ns],float);q=np.array([n.get('rotation',[0,0,0,1])for n in ns],float)
 if any('matrix'in n or not np.allclose(n.get('scale',[1,1,1]),[1,1,1],atol=1e-5)for n in ns):raise ValueError('Unexpected node transform; inspect before retargeting')
 return parents,p,q

def world(parents,p,q):
 wp=np.zeros_like(p);wq=np.zeros_like(q);seen=set()
 def visit(i):
  if i in seen:return
  if i in parents:
   j=parents[i];visit(j);r=R.from_quat(wq[j]);wp[i]=wp[j]+r.apply(p[i]);wq[i]=(r*R.from_quat(q[i])).as_quat()
  else:wp[i]=p[i];wq[i]=q[i]
  seen.add(i)
 for i in range(len(p)):visit(i)
 return wp,wq

def align(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);cross=np.cross(a,b);dot=np.clip(a@b,-1,1)
 if dot < -.99999:raise ValueError('Opposite anatomical axes require explicit correction')
 return R.from_quat(np.r_[cross,1+dot])

def main():
 ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('motions',type=Path);ap.add_argument('output',type=Path);args=ap.parse_args()
 d,b=glb.read_glb(args.source);s,sb=glb.read_glb(args.motions)
 if len(d.get('skins',[]))!=1 or len(d['skins'][0]['joints'])!=36:raise ValueError('Expected approved 36-joint Smart Rig')
 for i,name in NAMES.items():
  if not d['nodes'][i]['name'].startswith('Bone_'):raise ValueError('Unexpected source skeleton')
  d['nodes'][i]['name']='mixamorig:'+name
 tp,tpos,tquat=skeleton(d);sp,spos,squat=skeleton(s);tw,tq=world(tp,tpos,tquat);sw,sq=world(sp,spos,squat)
 tn={n['name'].replace('mixamorig:',''):i for i,n in enumerate(d['nodes'])};sn={n['name'].replace('mixamorig:',''):i for i,n in enumerate(s['nodes'])}
 mapping={name:(tn[name],sn[name]) for name in CHILD if name in tn and name in sn}
 correction={}
 for name,(ti,si)in mapping.items():
  child=CHILD[name];a=tw[tn[child]]-tw[ti];z=sw[sn[child]]-sw[si]
  correction[name]=R.from_quat(sq[si]).inv()*align(a,z)*R.from_quat(tq[ti])
 # Compact embedded textures without touching the authored geometry or weights.
 replacements={}
 for im in d['images']:
  vi=im['bufferView'];v=d['bufferViews'][vi];raw=b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];image=Image.open(io.BytesIO(raw)).convert('RGB');limit={'texture_0':4096,'normal':2048,'texture_0_metallic_roughness':1024}[im['name']];image.thumbnail((limit,limit),Image.Resampling.LANCZOS);out=io.BytesIO()
  if im['name']=='texture_0':image.save(out,'JPEG',quality=95,subsampling=0,optimize=True);im['mimeType']='image/jpeg'
  else:image.save(out,'JPEG',quality=97,subsampling=0,optimize=True);im['mimeType']='image/jpeg'
  replacements[vi]=out.getvalue()
 buf=bytearray()
 for vi,v in enumerate(d['bufferViews']):
  buf.extend(b'\0'*((-len(buf))%4));raw=replacements.get(vi,b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);v['byteOffset']=len(buf);v['byteLength']=len(raw);buf.extend(raw)
 def add(array,typ):
  array=np.asarray(array,dtype='<f4');buf.extend(b'\0'*((-len(buf))%4));vi=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(buf),'byteLength':array.nbytes});buf.extend(array.tobytes());ai=len(d['accessors']);a={'bufferView':vi,'componentType':5126,'count':len(array),'type':typ}
  if typ=='SCALAR':a.update(min=[float(array.min())],max=[float(array.max())])
  d['accessors'].append(a);return ai
 d['animations']=[]
 for clip in s['animations']:
  if clip['name'] not in ('run','walk','sprint','rest'):continue
  tracks=[];duration=0
  for c in clip['channels']:
   sam=clip['samplers'][c['sampler']];times=accessor(s,sb,sam['input']).ravel();values=accessor(s,sb,sam['output']);duration=max(duration,float(times[-1]));tracks.append((c['target']['node'],c['target']['path'],times,values))
  times=np.linspace(0,duration,max(2,int(np.ceil(duration*30))+1));rotations={ti:[]for ti,si in mapping.values()};positions=[]
  for time in times:
   p=spos.copy();q=squat.copy()
   for i,path,ts,vals in tracks:
    t=np.clip(time,ts[0],ts[-1])
    if path=='rotation':q[i]=Slerp(ts,R.from_quat(vals))(t).as_quat()
    elif path=='translation':p[i]=[np.interp(t,ts,vals[:,j])for j in range(3)]
   aw,aq=world(sp,p,q);outq=tquat.copy();outp=tpos.copy()
   # Traverse parents before children even though GLB nodes are stored leaf-first.
   def depth(i):return 0 if i not in tp else depth(tp[i])+1
   for name,(ti,si) in sorted(mapping.items(),key=lambda item:depth(item[1][0])):
    desired=R.from_quat(aq[si])*correction[name]
    _,curq=world(tp,outp,outq);outq[ti]=(R.from_quat(curq[tp[ti]]).inv()*desired).as_quat() if ti in tp else desired.as_quat()
    rotations[ti].append(outq[ti].copy())
   # Keep the runner in place; scale only the vertical locomotion bounce.
   hip=tn['Hips'];outp[hip]=tpos[hip];outp[hip][1]+=(aw[sn['Hips']][1]-sw[sn['Hips']][1])*(tw[hip][1]/sw[sn['Hips']][1]);positions.append(outp[hip].copy())
  ai=add(times,'SCALAR');anim={'name':clip['name'],'samplers':[],'channels':[]}
  for ti,values in rotations.items():
   values=np.array(values)
   for j in range(1,len(values)):
    if values[j]@values[j-1]<0:values[j]*=-1
   idx=len(anim['samplers']);anim['samplers'].append({'input':ai,'output':add(values,'VEC4'),'interpolation':'LINEAR'});anim['channels'].append({'sampler':idx,'target':{'node':ti,'path':'rotation'}})
  idx=len(anim['samplers']);anim['samplers'].append({'input':ai,'output':add(positions,'VEC3'),'interpolation':'LINEAR'});anim['channels'].append({'sampler':idx,'target':{'node':tn['Hips'],'path':'translation'}});d['animations'].append(anim)
 d['extras']={'ballKnowerAthlete':{'source':'User Meshy SmartRig upload','geometryPreserved':True,'colorTexture':4096,'motionSource':'approved sentinel v4 locomotion','rigMap':NAMES,'validation':'pending visual deformation review'}}
 glb.write_glb(args.output,d,buf)
 print(json.dumps({'output':str(args.output),'bytes':args.output.stat().st_size,'joints':len(d['skins'][0]['joints']),'animations':[a['name']for a in d['animations']]}))
if __name__=='__main__':main()
