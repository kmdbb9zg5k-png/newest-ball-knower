"""Rebuild fitted trousers for the native Combine rig (numpy/scipy/scikit-image)."""
from pathlib import Path
import json,struct,base64,sys
import numpy as np
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes
root=Path(__file__).resolve().parents[1]
b=(root/'public/play-moment-3d/assets/combine-native-athlete-v1.glb').read_bytes();length=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+length]);raw=b[28+length:]
def attr(name):
 a=doc['accessors'][doc['meshes'][0]['primitives'][0]['attributes'][name]];v=doc['bufferViews'][a['bufferView']];dtype={5126:'<f4',5123:'<u2',5121:'u1'}[a['componentType']];count={'VEC3':3,'VEC4':4}[a['type']]
 return np.frombuffer(raw,dtype=dtype,count=a['count']*count,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,count)
p,si,sw=attr('POSITION'),attr('JOINTS_0'),attr('WEIGHTS_0')
step=.8;origin=np.array([-18,7,-12]);x,y,z=np.meshgrid(np.arange(-18,18+step,step),np.arange(7,57+step,step),np.arange(-12,12+step,step),indexing='ij')
t=np.clip((y-10)/29,0,1);cx=8.6-2.3*t;cz=-2.3+2.3*t;rx=3.2+3.1*t;rz=3.3+3.5*t
legs=np.minimum(np.sqrt(((x-cx)/rx)**2+((z-cz)/rz)**2)-1,np.sqrt(((x+cx)/rx)**2+((z-cz)/rz)**2)-1)*4
legs=np.maximum(legs,y-43)
hips=(np.sqrt((x/np.interp(y,[39,44,51,56.5],[10.8,12.8,11.3,9.5]))**2+(z/np.interp(y,[44,51,56.5],[8,7,5.4]))**2+(np.maximum(0,48-y)/11)**2)-1)*5
hips=np.maximum(hips,36-y)
h=np.clip(.5+.5*(hips-legs)/3.5,0,1);field=hips*(1-h)+legs*h-3.5*h*(1-h)
field=np.maximum(field,np.maximum(10-y,y-56.5))
if '--top' in sys.argv:
 origin=np.array([-36,52,-13]);step=.9
 x,y,z=np.meshgrid(np.arange(-36,36+step,step),np.arange(52,85+step,step),np.arange(-13,12+step,step),indexing='ij')
 rx=np.interp(y,[56,65,74,80,83],[11.8,13.8,13.5,10,6.5]);rz=np.interp(y,[56,65,74,80,83],[8,9,8,6,4.5])
 torso=(np.sqrt((x/rx)**2+((z+1)/rz)**2)-1)*6
 radius=np.interp(abs(x),[10,21,34],[5.5,4.4,3.1]);cz=np.interp(abs(x),[10,34],[-3.5,-1.5])
 arms=np.sqrt((y-74.8)**2+(z-cz)**2)-radius
 arms=np.maximum(arms,10-abs(x))
 h=np.clip(.5+.5*(arms-torso)/2,0,1);field=arms*(1-h)+torso*h-2*h*(1-h)
 neck=np.maximum((np.sqrt((x/4.2)**2+((z+1)/4.8)**2)-1)*4,79-y)
 field=np.maximum(field,-neck)
 field=np.maximum(field,np.maximum(np.maximum(53.5-y,y-83),abs(x)-34))
v,f,_,_=marching_cubes(field,0,spacing=(step,step,step));v+=origin
# Inverse-distance interpolation keeps each hem smooth across joint boundaries.
d,ids=cKDTree(p).query(v,k=4);factors=1/np.maximum(d,.1)**2;factors/=factors.sum(1)[:,None]
joints=[];weights=[]
for near,blend in zip(ids,factors):
 totals={}
 for row,amount in zip(near,blend):
  for bone,w in zip(si[row],sw[row]):totals[int(bone)]=totals.get(int(bone),0)+float(w*amount)
 best=sorted(totals.items(),key=lambda x:-x[1])[:4];best+=[(0,0)]*(4-len(best));total=sum(w for _,w in best)
 joints.extend(j for j,_ in best);weights.extend(w/total for _,w in best)
def enc(a,dtype):return base64.b64encode(np.array(a,dtype=dtype).tobytes()).decode()
out={'position':enc(np.round(v*100),'<i2'),'index':enc(f,'<u2'),'skinIndex':enc(joints,'<u2'),'skinWeight':enc(weights,'<f4')}
(root/('combine/casual-top.json' if '--top' in sys.argv else 'combine/casual-trousers.json')).write_text(json.dumps(out,separators=(',',':'))+'\n')
print(f'{len(v)} vertices, {len(f)} triangles')
