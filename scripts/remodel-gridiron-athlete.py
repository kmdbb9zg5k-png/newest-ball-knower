"""Build the next athlete from the owned rig: authored equipment, preserved motion.

The helmet, cage, visor, chin cup and straps are new geometry, not a recolor.
Animations, skeleton, body UVs and weights are retained. No external art inputs.
"""
import importlib.util
import json
import struct
import os
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rig', Path(__file__).with_name('rig-gridiron-sentinel.py'))
rig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rig)
source = ROOT/'public/play-moment-3d/assets/ball-knower-gridiron-sentinel-v4.glb'
raw = source.read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+length])
binary = bytearray(raw[28+length:])
primitive = doc['meshes'][0]['primitives'][0]
arrays = {name: rig.read_array(doc, binary, index) for name, index in primitive['attributes'].items()}
triangles = rig.read_array(doc, binary, primitive['indices']).reshape(-1, 3)
p = arrays['POSITION']
# Retire the generated helmet and tangled cage. Leave the neck/body untouched.
keep_body=(np.max(p[triangles,1],axis=1)<1.487)&~(np.any((p[triangles,1]>1.445)&(p[triangles,2]>.025),axis=1))
triangles = triangles[keep_body]
# Repair tiny generated dents in garment geometry, with a bounded 6 mm change.
# Weld UV splits before smoothing so the authored seams cannot pull apart.
keys,inverse=np.unique(np.round(p*100000).astype(np.int64),axis=0,return_inverse=True)
points=keys.astype(float)/100000.;original=points.copy()
edges=np.concatenate([inverse[triangles[:,[0,1]]],inverse[triangles[:,[1,2]]],inverse[triangles[:,[2,0]]]])
edges=np.concatenate([edges,edges[:,::-1]])
active=(points[:,1]>.32)&(points[:,1]<1.435)&(np.abs(points[:,0])<.37)
for iteration in range(5):
    total=np.zeros_like(points);count=np.zeros(len(points))
    np.add.at(total,edges[:,0],points[edges[:,1]]);np.add.at(count,edges[:,0],1)
    average=total/np.maximum(count[:,None],1)
    delta=(average-points)*.28;delta[~active]=0
    points+=delta
    shift=points-original;length=np.linalg.norm(shift,axis=1)
    points=original+shift*np.minimum(1.,.006/np.maximum(length[:,None],1e-9))
arrays['POSITION']=points[inverse].astype('<f4');p=arrays['POSITION']
extra = {name: [] for name in arrays}
equipment = [0.] * len(p)
head_joint = doc['skins'][0]['joints'].index(next(i for i,n in enumerate(doc['nodes']) if n.get('name') == 'mixamorig:Head'))
new_indices = []

def vertex(point, normal, uv, region):
    index = len(p) + len(extra['POSITION'])
    n = np.asarray(normal, dtype=float)
    n /= max(np.linalg.norm(n), 1e-9)
    tangent = np.cross([0., 1., 0.], n)
    if np.linalg.norm(tangent) < .01:
        tangent = np.cross([1., 0., 0.], n)
    tangent /= np.linalg.norm(tangent)
    values = {'POSITION': point, 'NORMAL': n, 'TEXCOORD_0': uv,
              'TANGENT': [*tangent, 1.], 'JOINTS_0': [head_joint, 0, 0, 0],
              'WEIGHTS_0': [1., 0., 0., 0.]}
    for name in extra:
        extra[name].append(values[name])
    equipment.append(float(region))
    return index

def ellipsoid(center, radius, region, cut=False, rows=24, sides=48):
    grid = []
    for j in range(rows+1):
        theta = j/rows*np.pi
        row = []
        for i in range(sides+1):
            phi = i/sides*2*np.pi
            q = np.array([np.sin(theta)*np.cos(phi), np.cos(theta), np.sin(theta)*np.sin(phi)])
            row.append(vertex(np.array(center)+q*radius, q/np.array(radius), [i/sides,j/rows], region))
        grid.append(row)
    for j in range(rows):
        for i in range(sides):
            theta=(j+.5)/rows*np.pi; phi=(i+.5)/sides*2*np.pi
            # Open the front around the visor and mouth; retain side ear coverage.
            if cut and (theta>2.35 or (np.sin(phi)>.43 and theta>1.13)):
                continue
            a,b,c,d=grid[j][i],grid[j+1][i],grid[j][i+1],grid[j+1][i+1]
            new_indices.extend([[a,b,c],[c,b,d]])

def tube(points, radius, region, sides=8):
    points=np.array(points); rings=[]
    for k,point in enumerate(points):
        direction=points[min(k+1,len(points)-1)]-points[max(0,k-1)]
        direction/=np.linalg.norm(direction)
        axis=np.cross(direction,[0.,0.,1.])
        if np.linalg.norm(axis)<.1: axis=np.cross(direction,[0.,1.,0.])
        axis/=np.linalg.norm(axis); second=np.cross(direction,axis)
        ring=[]
        for i in range(sides):
            phi=i/sides*2*np.pi;n=axis*np.cos(phi)+second*np.sin(phi)
            ring.append(vertex(point+n*radius,n,[i/sides,k/(len(points)-1)],region))
        rings.append(ring)
    for k in range(len(rings)-1):
        for i in range(sides):
            a,b=rings[k][i],rings[k][(i+1)%sides]
            c,d=rings[k+1][i],rings[k+1][(i+1)%sides]
            new_indices.extend([[a,c,b],[b,c,d]])

ellipsoid([0.,1.573,-.008],[.115,.131,.132],1,cut=True)
# Face underneath a separate smoked eye shield, visible through real cage gaps.
ellipsoid([0.,1.517,.020],[.068,.076,.064],6,rows=14,sides=24)
# Sculpt nose, lips and chin underneath the smoked shield. Independent surfaces
# avoid sampling unrelated gold/white islands from the generated source atlas.
ellipsoid([0.,1.545,.079],[.015,.036,.019],6,rows=12,sides=20)
ellipsoid([0.,1.523,.096],[.020,.012,.018],6,rows=10,sides=20)
ellipsoid([0.,1.495,.080],[.024,.006,.006],7,rows=8,sides=20)
ellipsoid([0.,1.483,.072],[.027,.016,.016],6,rows=10,sides=20)
visor=[]
for j in range(7):
    row=[]
    for i in range(25):
        x=(i/24-.5)*.174;z=.131-.022*(x/.087)**2
        row.append(vertex([x,1.561+j/6*.035,z],[x*.7,.1,1.],[i/24,j/6],3))
    visor.append(row)
for j in range(6):
    for i in range(24):
        a,b,c,d=visor[j][i],visor[j+1][i],visor[j][i+1],visor[j+1][i+1]
        new_indices.extend([[a,c,b],[b,c,d]])
# Actual curved horizontal bars and side supports, clear of the eye shield.
for y,width,zfront in [(1.603,.103,.144),(1.529,.102,.155),(1.480,.080,.147)]:
    xs=np.linspace(-width,width,23)
    tube([[x,y,zfront-.050*(x/width)**2] for x in xs],.0062,2)
for side in [-1,1]:
    tube([[side*.106,1.603,.088],[side*.109,1.553,.107],[side*.090,1.488,.116],[side*.060,1.458,.118]],.0066,2)
    tube([[side*.042,1.528,.152],[side*.039,1.500,.150],[side*.033,1.480,.146]],.0054,2)
    tube([[side*.106,1.533,.065],[side*.079,1.484,.110],[side*.032,1.461,.142]],.0054,4)
ellipsoid([0.,1.463,.132],[.041,.019,.029],4,rows=10,sides=20)

def append_accessor(array,kind,component):
    while len(binary)%4: binary.append(0)
    offset=len(binary);data=array.tobytes();binary.extend(data)
    view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)})
    a={'bufferView':view,'componentType':component,'count':len(array),'type':kind}
    if kind=='VEC3':a.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
    index=len(doc['accessors']);doc['accessors'].append(a);return index

combined_triangles=np.concatenate([triangles,np.array(new_indices,dtype=triangles.dtype)])
used=np.unique(combined_triangles)
remap=np.zeros(len(equipment),dtype=triangles.dtype)
remap[used]=np.arange(len(used),dtype=triangles.dtype)
for name,array in arrays.items():
    combined=np.concatenate([array,np.array(extra[name],dtype=array.dtype)])[used]
    old=doc['accessors'][primitive['attributes'][name]]
    primitive['attributes'][name]=append_accessor(combined,old['type'],old['componentType'])
primitive['attributes']['_EQUIPMENT']=append_accessor(np.array(equipment,dtype='<f4')[used],'SCALAR',5126)
combined_triangles=remap[combined_triangles].reshape(-1,1)
primitive['indices']=append_accessor(combined_triangles,'SCALAR',5123 if triangles.dtype.itemsize==2 else 5125)
# Repack only referenced accessors/views; discard the retired head and old mesh
# payload rather than downloading both versions on every phone.
references=[]
for mesh in doc['meshes']:
    for prim in mesh['primitives']:
        references.extend((prim['attributes'],key) for key in prim['attributes'])
        references.append((prim,'indices'))
for skin in doc['skins']:references.append((skin,'inverseBindMatrices'))
for animation in doc['animations']:
    for sampler in animation['samplers']:
        references.extend([(sampler,'input'),(sampler,'output')])
active_accessors=sorted(set(container[key] for container,key in references))
accessor_map={old:new for new,old in enumerate(active_accessors)}
doc['accessors']=[doc['accessors'][old] for old in active_accessors]
for container,key in references:container[key]=accessor_map[container[key]]
active_views=sorted(set(a['bufferView'] for a in doc['accessors'])|set(im['bufferView'] for im in doc['images']))
view_map={old:new for new,old in enumerate(active_views)}
packed=bytearray();views=[]
for old in active_views:
    view=dict(doc['bufferViews'][old]);offset=view.get('byteOffset',0)
    while len(packed)%4:packed.append(0)
    view['byteOffset']=len(packed);packed.extend(binary[offset:offset+view['byteLength']]);views.append(view)
for a in doc['accessors']:a['bufferView']=view_map[a['bufferView']]
for im in doc['images']:im['bufferView']=view_map[im['bufferView']]
doc['bufferViews']=views;binary=packed
doc['buffers'][0]['byteLength']=len(binary)
doc['extras']['ballKnowerAthlete'].update(version=5,name='Gridiron Remodel',equipment='authored shell, open cage, visor, face, chin cup and straps',mobileVertices=len(used),mobileTriangles=len(combined_triangles)//3)
payload=json.dumps(doc,separators=(',',':')).encode();payload+=b' '*(-len(payload)%4);binary+=b'\0'*(-len(binary)%4)
result=struct.pack('<III',0x46546c67,2,28+len(payload)+len(binary))+struct.pack('<II',len(payload),0x4e4f534a)+payload+struct.pack('<II',len(binary),0x004e4942)+binary
destination=Path(os.environ.get('BK_EQUIPMENT_OUTPUT',str(source.with_name('ball-knower-gridiron-remodel-v5.glb'))));destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(result)
print(json.dumps({'output':str(destination.relative_to(ROOT)),'vertices':len(used),'triangles':len(combined_triangles)//3,'bytes':len(result),'skeletonAndClipsPreserved':True}))
