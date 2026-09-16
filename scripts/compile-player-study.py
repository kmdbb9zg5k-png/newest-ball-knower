"""Compile a clothed anatomical art study, never a production or gameplay asset.
Uses only the intake's hash-verified CC0 graphical files. Program logic is original.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import numpy as np


def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)


def compile_study(folder):
    provenance=json.loads((folder/'provenance.json').read_text())
    for f in provenance['files']:
        data=(folder/Path(f['path']).name).read_bytes()
        assert hashlib.sha256(data).hexdigest()==f['sha256'],f['path']
    vertices=[];uv=[];groups=defaultdict(list);group=''
    for line in (folder/'base.obj').read_text().splitlines():
        words=line.split()
        if not words:continue
        if words[0]=='v':vertices.append(list(map(float,words[1:4])))
        elif words[0]=='vt':uv.append(list(map(float,words[1:3])))
        elif words[0]=='g':group=' '.join(words[1:])
        elif words[0]=='f':groups[group].append([tuple(int(i)-1 for i in x.split('/')[:2]) for x in words[1:]])
    rest=np.asarray(vertices,dtype=float)
    for name in ['caucasian-male-young.target','african-male-young.target']:
        for line in (folder/name).read_text().splitlines():
            words=line.split()
            if not words or words[0].startswith('#'):continue
            index=int(words[0]);rest[index]+=np.asarray(list(map(float,words[1:4])))*.5
    def joint(name):
        ids=sorted({v[0] for f in groups[name] for v in f})
        return rest[ids].mean(0)
    joints={name:joint(name) for name in groups if name.startswith('joint-')}
    ground=joints['joint-ground'][1];factor=.109
    # A softer neutral arm spread for an equipment study, not a new game animation.
    posed=rest.copy()
    for side,label in [(1,'l'),(-1,'r')]:
        shoulder=joints[f'joint-{label}-shoulder'];delta=rest-shoulder
        angle=-side*np.deg2rad(23);c=np.cos(angle);s=np.sin(angle)
        rotated=np.stack([c*delta[:,0]-s*delta[:,1],s*delta[:,0]+c*delta[:,1],delta[:,2]],axis=1)+shoulder
        lower_mask=np.maximum(smooth(1.6,3.1,rest[:,1]),smooth(2.7,3.4,np.abs(rest[:,0])))
        weight=smooth(1.3,2.7,side*rest[:,0])*lower_mask*(1-smooth(6.0,6.8,rest[:,1]))
        posed+= (rotated-rest)*weight[:,None]
    final=posed.copy();final[:,1]-=ground;final*=factor
    output=defaultdict(lambda:{'v':[],'ix':[]});lookup=defaultdict(dict)
    def clip(poly, distance):
        # Clip an interpolated rest/posed/normal/UV polygon to a true garment edge.
        if not poly:return []
        out=[];previous=poly[-1];dp=distance(previous)
        for current in poly:
            dc=distance(current)
            if (dp>=0)!=(dc>=0):
                t=dp/(dp-dc);out.append(previous+(current-previous)*t)
            if dc>=0:out.append(current)
            previous=current;dp=dc
        return out
    def bands(poly,low,high):
        return clip(clip(poly,lambda v:v[1]-low),lambda v:high-v[1])
    def regions(source,face,poly):
        center=rest[[x[0] for x in face]].mean(0);x,y,z=center
        side='l' if x>=0 else 'r';a=joints[f'joint-{side}-shoulder'];b=joints[f'joint-{side}-elbow'];axis=b-a
        arm=(abs(x)>1.85 and y>1.8) or abs(x)>3.2
        position=lambda v:float(np.dot(v[:3]-a,axis)/np.dot(axis,axis))
        if source=='body':
            if arm:return [('skin',clip(poly,lambda v:position(v)-.40))]
            return [('skin',clip(poly,lambda v:v[1]-6.95))]
        if arm:poly=clip(poly,lambda v:.40-position(v))
        return [(key,bands(poly,low,high)) for key,low,high in
                [('jersey',1.15,7.0),('pants',-3.35,1.15),('socks',-7.25,-3.35)]]
    for source in ['body','helper-tights']:
        faces=groups[source];coords=final.copy()
        if source=='helper-tights':
            # Tailored room over shoulder pads; no exposed-body anatomy in the uniform.
            y=rest[:,1];central=1-smooth(1.6,2.7,np.abs(rest[:,0]));pad=smooth(3.2,5.2,y)*(1-smooth(6.1,7.0,y))*central
            coords[:,0]*=1+.07*pad;coords[:,2]+=np.sign(rest[:,2]-.015)*.017*pad
            coords[:,1]+=.022*pad*np.exp(-((np.abs(rest[:,0])-1.6)/.65)**2)
        normals=np.zeros_like(coords)
        for f in faces:
            ids=[x[0] for x in f]
            for j in range(1,len(ids)-1):
                tri=[ids[0],ids[j],ids[j+1]];a,b,c=coords[tri]
                n=np.cross(b-a,c-a)
                for i in tri:normals[i]+=n
        normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-10)
        for f in faces:
            poly=[np.concatenate([rest[index],coords[index],normals[index],uv[tex]]) for index,tex in f]
            for key,part in regions(source,f,poly):
                if len(part)<3:continue
                mesh=output[key];indices=[]
                for vertex in part:
                    normal=vertex[6:9];normal=normal/max(float(np.linalg.norm(normal)),1e-10)
                    data=np.round(np.concatenate([vertex[3:6],normal,vertex[9:11]]),6)
                    identity=(source,*data)
                    if identity not in lookup[key]:
                        lookup[key][identity]=len(mesh['v'])//8;mesh['v'].extend(data.tolist())
                    indices.append(lookup[key][identity])
                for j in range(1,len(indices)-1):mesh['ix'].extend([indices[0],indices[j],indices[j+1]])
    eyes=[]
    for label in ['l','r']:
        q=joints[f'joint-{label}-eye'].copy();q[1]-=ground;eyes.append((q*factor).tolist())
    ankles=[]
    for label in ['l','r']:
        q=joints[f'joint-{label}-ankle'].copy();q[1]-=ground;ankles.append((q*factor).tolist())
    for mesh in output.values():
        assert len(mesh['v'])//8<65536 and np.isfinite(mesh['v']).all()
        assert min(mesh['ix'])>=0 and max(mesh['ix'])<len(mesh['v'])//8
    return {'kind':'single fictional adult player art study; not rigged game integration','meshes':dict(output),'eyes':eyes,'ankles':ankles,'height':float(final[[x[0]for f in groups['body']for x in f],1].max()),'sourceRevision':provenance['revision'],'license':'CC0-1.0 source graphical assets; original conversion','triangles':{k:len(m['ix'])//3 for k,m in output.items()}}


def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=Path('artifacts/player-foundation'));p.add_argument('--output',type=Path,default=Path('artifacts/anatomy-study'))
    args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    result=compile_study(args.source);(args.output/'model.json').write_text(json.dumps(result,separators=(',',':')))
    print(json.dumps({k:v for k,v in result.items() if k!='meshes'},indent=2))

if __name__=='__main__':main()
