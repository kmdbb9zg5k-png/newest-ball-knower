#!/usr/bin/env python3
"""Equip the saved reference athlete with the saved Sentinel helmet/facemask.

One skinned primitive and three 1024x512 material atlases preserve the mobile
renderer draw budget. The body, skeleton and animation samplers are unchanged.
Requires numpy and Pillow. Both source GLBs remain untouched.
"""
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rig', ROOT/'scripts/rig-gridiron-sentinel.py')
rig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rig)
assets = ROOT/'public/play-moment-3d/assets'
body_path = assets/'tripo-gridiron-pro.glb'
helmet_path = assets/'ball-knower-gridiron-sentinel-v4.glb'
output = assets/'reference-helmeted-athlete-v1.glb'
body, bb = rig.prepare.read_glb(body_path)
source, sb = rig.prepare.read_glb(helmet_path)
doc = copy.deepcopy(body)
bp, hp = body['meshes'][0]['primitives'][0], source['meshes'][0]['primitives'][0]
def read(model, data, index):
    a = model['accessors'][index]
    v = model['bufferViews'][a['bufferView']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    dtype = np.dtype({5121: '<u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']])
    return np.ndarray((a['count'], width), dtype=dtype, buffer=data,
                      offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
                      strides=(v.get('byteStride', width*dtype.itemsize), dtype.itemsize)).copy()
positions = read(source, sb, hp['attributes']['POSITION'])
triangles = read(source, sb, hp['indices']).reshape(-1, 3)
# The donor's rigid head/equipment region is documented by its skin-transfer
# pipeline. Keep complete faces only, excluding shoulder pads and the neck.
faces = triangles[np.all(positions[triangles, 1] > 1.465, axis=1)]
used, helmet_indices = np.unique(faces, return_inverse=True)
head = [body['nodes'][i]['name'] for i in body['skins'][0]['joints']].index('mixamorig:Head')
body_count = body['accessors'][bp['attributes']['POSITION']]['count']
# Fit the padded shell around the reference head, leaving clearance for hair,
# ears, brow and the projecting face cage. Uniform scale preserves normals.
helmet_positions = (positions[used] - [0, 1.585, -.01]) * 1.14 + [0, 1.598, .01]
arrays = {}
for name, index in bp['attributes'].items():
    a = read(body, bb, index)
    b = read(source, sb, hp['attributes'][name])[used].astype(float)
    template = body['accessors'][index]
    normalizer = np.iinfo(a.dtype).max if template.get('normalized') else 1
    source_template = source['accessors'][hp['attributes'][name]]
    if source_template.get('normalized'):
        b /= np.iinfo(read(source, sb, hp['attributes'][name]).dtype).max
    b *= normalizer
    if name == 'POSITION':
        b = helmet_positions.astype(a.dtype)
    elif name == 'JOINTS_0':
        b = np.zeros_like(b, dtype=a.dtype)
        b[:, 0] = head
    elif name == 'WEIGHTS_0':
        b = np.zeros_like(b, dtype=a.dtype)
        b[:, 0] = normalizer
    elif name == 'TEXCOORD_0':
        a[:, 0] = np.rint(a[:, 0]*.5)
        b[:, 0] = np.rint(b[:, 0]*.5 + normalizer*.5)
    arrays[name] = np.concatenate([a, b.astype(a.dtype)])
indices = np.concatenate([read(body, bb, bp['indices']).ravel(), helmet_indices.ravel() + body_count]).astype('<u4').reshape(-1, 1)
binary = bytearray()
doc['bufferViews'] = []
doc['accessors'] = []

def view(raw):
    binary.extend(b'\0' * (-len(binary) % 4))
    index = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw)})
    binary.extend(raw)
    return index

def accessor(array, template):
    a = copy.deepcopy(template)
    a.update(bufferView=view(array.tobytes()), byteOffset=0, count=len(array))
    if 'min' in a: a['min'] = array.min(axis=0).tolist()
    if 'max' in a: a['max'] = array.max(axis=0).tolist()
    index = len(doc['accessors'])
    doc['accessors'].append(a)
    return index

primitive = doc['meshes'][0]['primitives'][0]
primitive['attributes'] = {name: accessor(array, body['accessors'][bp['attributes'][name]]) for name, array in arrays.items()}
primitive['indices'] = accessor(indices, {'componentType': 5125, 'type': 'SCALAR'})
# Copy every non-mesh accessor byte-for-byte, including the original inverse
# binds and animation channels. Remap their references into the compact file.
remap = {}
def original(index):
    if index not in remap:
        remap[index] = accessor(read(body, bb, index), body['accessors'][index])
    return remap[index]
for skin in doc['skins']: skin['inverseBindMatrices'] = original(skin['inverseBindMatrices'])
for animation in doc['animations']:
    for sampler in animation['samplers']:
        sampler['input'] = original(sampler['input'])
        sampler['output'] = original(sampler['output'])

def texture_image(model, data, material, channel):
    texture = material['pbrMetallicRoughness'][channel] if channel != 'normalTexture' else material[channel]
    image = model['images'][model['textures'][texture['index']]['source']]
    v = model['bufferViews'][image['bufferView']]
    return Image.open(io.BytesIO(data[v.get('byteOffset', 0):v.get('byteOffset', 0)+v['byteLength']])).convert('RGB')

bm, hm = body['materials'][bp['material']], source['materials'][hp['material']]
for channel in ['baseColorTexture', 'normalTexture', 'metallicRoughnessTexture']:
    left = texture_image(body, bb, bm, channel)
    assert left.size == (512, 512)
    right = texture_image(source, sb, hm, channel).resize((512, 512), Image.Resampling.LANCZOS)
    atlas = Image.new('RGB', (1024, 512))
    atlas.paste(left, (0, 0)); atlas.paste(right, (512, 0))
    encoded = io.BytesIO(); atlas.save(encoded, format='PNG')
    texture = bm['pbrMetallicRoughness'][channel] if channel != 'normalTexture' else bm[channel]
    image_index = body['textures'][texture['index']]['source']
    doc['images'][image_index].update(bufferView=view(encoded.getvalue()), mimeType='image/png')
doc['asset']['generator'] = 'Ball Knower reference helmet equipment pipeline'
doc['extras'] = {'referenceEquipment': {
    'bodySha256': hashlib.sha256(body_path.read_bytes()).hexdigest(),
    'helmetSha256': hashlib.sha256(helmet_path.read_bytes()).hexdigest(),
    'bodyVertices': body_count, 'helmetVertices': len(used),
    'helmetTriangles': len(faces), 'helmetJoint': head,
    'helmetScale': 1.14, 'materialAtlas': [1024, 512],
    'method': 'Saved rigid helmet and facemask fitted to reference head; body and motion retained'
}}
rig.prepare.write_glb(output, doc, binary)
print(json.dumps({'output': str(output), 'bytes': output.stat().st_size, **doc['extras']['referenceEquipment']}, indent=2))
