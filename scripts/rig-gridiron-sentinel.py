#!/usr/bin/env python3
"""Transfer the game's licensed Meshy rig to its replacement A-pose mesh.

Pose the donor into the target A-pose, interpolate its skin on nearby surface
samples, then inverse-skin the target into the donor bind pose. The original
skeleton and all animation channels remain byte-for-byte intact. This is a
skin-transfer build, not a claim that Meshy auto-rigged the replacement.
Requires numpy, scipy, Pillow. Input files are never modified.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

spec = importlib.util.spec_from_file_location('prepare', Path(__file__).with_name('prepare-meshy-rigged-athlete.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def read_array(doc, binary, index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    sizes = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
    dtype = np.dtype({5121: '<u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']])
    width = sizes[a['type']]
    return np.ndarray((a['count'], width), dtype=dtype, buffer=binary,
                      offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                      strides=(v.get('byteStride', width*dtype.itemsize), dtype.itemsize)).copy()


def rotation_z(angle, origin):
    c, s = np.cos(angle), np.sin(angle)
    m = np.eye(4)
    m[:3, :3] = [[c, -s, 0], [s, c, 0], [0, 0, 1]]
    m[:3, 3] = origin - m[:3, :3] @ origin
    return m


def tangent_frame(p, n, uv, triangles):
    a, b, c = triangles.T
    e1, e2 = p[b]-p[a], p[c]-p[a]
    u1, u2 = uv[b]-uv[a], uv[c]-uv[a]
    determinant = u1[:, 0]*u2[:, 1]-u1[:, 1]*u2[:, 0]
    reciprocal = np.divide(1., determinant, out=np.zeros_like(determinant), where=np.abs(determinant)>1e-10)
    t = (e1*u2[:, 1, None]-e2*u1[:, 1, None])*reciprocal[:, None]
    bt = (e2*u1[:, 0, None]-e1*u2[:, 0, None])*reciprocal[:, None]
    out, bitangent = np.zeros_like(p), np.zeros_like(p)
    for indices in (a, b, c):
        np.add.at(out, indices, t)
        np.add.at(bitangent, indices, bt)
    out -= n*np.sum(n*out, axis=1)[:, None]
    length = np.linalg.norm(out, axis=1)
    bad = length < 1e-9
    fallback = np.cross(n[bad], [0., 1., 0.])
    degenerate = np.linalg.norm(fallback, axis=1)<1e-9
    fallback[degenerate] = np.cross(n[bad][degenerate], [1., 0., 0.])
    out[bad] = fallback
    out /= np.maximum(np.linalg.norm(out, axis=1)[:, None], 1e-10)
    handedness = np.where(np.sum(np.cross(n, out)*bitangent, axis=1)<0, -1., 1.)
    return np.column_stack((out, handedness)).astype('<f4')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source', type=Path)
    ap.add_argument('donor', type=Path)
    ap.add_argument('output', type=Path)
    args = ap.parse_args()
    src, sb = prepare.read_glb(args.source)
    doc, db = prepare.read_glb(args.donor)
    doc = copy.deepcopy(doc)
    sp, dp = src['meshes'][0]['primitives'][0], doc['meshes'][0]['primitives'][0]
    target = read_array(src, sb, sp['attributes']['POSITION']).astype(float)
    target[:, 1] -= target[:, 1].min()
    target *= 1.7/target[:, 1].max()
    donor = read_array(doc, db, dp['attributes']['POSITION']).astype(float)
    dj = read_array(doc, db, dp['attributes']['JOINTS_0']).astype(int)
    dw = read_array(doc, db, dp['attributes']['WEIGHTS_0']).astype(float)
    skin = doc['skins'][0]
    names = [doc['nodes'][i]['name'] for i in skin['joints']]
    ib = read_array(doc, db, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    bind = np.linalg.inv(ib)
    pose = np.tile(np.eye(4), (len(names), 1, 1))
    for side, sign in [('Left', -1), ('Right', 1)]:
        arm = names.index('mixamorig:'+side+'Arm')
        transform = rotation_z(np.deg2rad(sign*43), bind[arm, :3, 3])
        for suffix in ['Arm', 'ForeArm', 'Hand', 'HandMiddle4']:
            pose[names.index('mixamorig:'+side+suffix)] = transform
    donor_matrices = np.sum(pose[dj]*dw[:, :, None, None], axis=1)
    posed = np.einsum('nij,nj->ni', donor_matrices, np.column_stack((donor, np.ones(len(donor)))))[:, :3]
    distances, near = cKDTree(posed).query(target, k=12)
    blend = 1/np.maximum(distances, .003)**4
    blend /= blend.sum(axis=1)[:, None]
    dense = np.zeros((len(target), len(names)))
    rows = np.arange(len(target))
    for k in range(near.shape[1]):
        for c in range(4):
            np.add.at(dense, (rows, dj[near[:, k], c]), blend[:, k]*dw[near[:, k], c])
    # Helmet and face cage are rigid equipment; no neck/pad influences.
    head = target[:, 1] > 1.465
    dense[head] = 0
    dense[head, names.index('mixamorig:Head')] = 1
    joints = np.argsort(dense, axis=1)[:, -4:][:, ::-1]
    weights = np.take_along_axis(dense, joints, axis=1)
    weights /= weights.sum(axis=1)[:, None]
    matrices = np.sum(pose[joints]*weights[:, :, None, None], axis=1)
    inverse = np.linalg.inv(matrices)
    p = np.einsum('nij,nj->ni', inverse, np.column_stack((target, np.ones(len(target)))))[:, :3]
    normals = read_array(src, sb, sp['attributes']['NORMAL']).astype(float)
    normals = np.einsum('nji,nj->ni', matrices[:, :3, :3], normals)
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    uv = read_array(src, sb, sp['attributes']['TEXCOORD_0'])
    triangles = read_array(src, sb, sp['indices']).reshape(-1, 3).astype(int)
    tangents = tangent_frame(p, normals, uv, triangles)
    reconstruction = np.einsum('nij,nj->ni', matrices, np.column_stack((p, np.ones(len(p)))))[:, :3]
    assert np.max(np.abs(reconstruction-target)) < 1e-6
    assert np.all(np.isfinite(p)) and np.all(np.isfinite(tangents))
    binary = bytearray(db)

    def append_view(raw):
        binary.extend(b'\0' * (-len(binary) % 4))
        index = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw)})
        binary.extend(raw)
        return index

    def append_accessor(array, component_type, kind, bounds=False):
        a = {'bufferView': append_view(array.tobytes()), 'componentType': component_type, 'count': len(array), 'type': kind}
        if bounds:
            a.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        index = len(doc['accessors'])
        doc['accessors'].append(a)
        return index

    attrs = {}
    for name, array, component_type, kind in [
        ('POSITION', p.astype('<f4'), 5126, 'VEC3'),
        ('NORMAL', normals.astype('<f4'), 5126, 'VEC3'),
        ('TEXCOORD_0', uv.astype('<f4'), 5126, 'VEC2'),
        ('TANGENT', tangents, 5126, 'VEC4'),
        ('JOINTS_0', joints.astype('<u2'), 5123, 'VEC4'),
        ('WEIGHTS_0', weights.astype('<f4'), 5126, 'VEC4')]:
        attrs[name] = append_accessor(array, component_type, kind, name=='POSITION')
    dp['attributes'] = attrs
    dp['indices'] = append_accessor(triangles.astype('<u4').reshape(-1, 1), 5125, 'SCALAR')
    doc['materials'], doc['textures'], doc['samplers'] = copy.deepcopy(src['materials']), copy.deepcopy(src['textures']), copy.deepcopy(src.get('samplers', []))
    dp['material'] = sp.get('material', 0)
    doc['images'] = copy.deepcopy(src['images'])
    for image in doc['images']:
        v = src['bufferViews'][image['bufferView']]
        start = v.get('byteOffset', 0)
        image['bufferView'] = append_view(prepare.encode_jpeg(sb[start:start+v['byteLength']], image.get('name', '')))
        image['mimeType'] = 'image/jpeg'
    # Remove unused donor geometry/images rather than shipping both assets.
    active_accessors = set(attrs.values()) | {dp['indices'], skin['inverseBindMatrices']}
    for animation in doc['animations']:
        for sampler in animation['samplers']:
            active_accessors.update([sampler['input'], sampler['output']])
    remap = {old: new for new, old in enumerate(sorted(active_accessors))}
    doc['accessors'] = [doc['accessors'][i] for i in sorted(active_accessors)]
    dp['attributes'] = {key: remap[value] for key, value in attrs.items()}
    dp['indices'], skin['inverseBindMatrices'] = remap[dp['indices']], remap[skin['inverseBindMatrices']]
    for animation in doc['animations']:
        for sampler in animation['samplers']:
            sampler['input'], sampler['output'] = remap[sampler['input']], remap[sampler['output']]
    views = sorted({a['bufferView'] for a in doc['accessors']} | {i['bufferView'] for i in doc['images']})
    view_map = {old: new for new, old in enumerate(views)}
    compact = bytearray()
    for i in views:
        v = doc['bufferViews'][i]
        raw = binary[v['byteOffset']:v['byteOffset']+v['byteLength']]
        compact.extend(b'\0' * (-len(compact) % 4))
        v['byteOffset'] = len(compact)
        compact.extend(raw)
    doc['bufferViews'] = [doc['bufferViews'][i] for i in views]
    for a in doc['accessors']:
        a['bufferView'] = view_map[a['bufferView']]
    for i in doc['images']:
        i['bufferView'] = view_map[i['bufferView']]
    doc['asset']['generator'] = 'Ball Knower Sentinel skin-transfer pipeline'
    doc['extras'] = {'ballKnowerAthlete': {
        'version': 4, 'name': 'Gridiron Sentinel', 'surfaceRefinement': 'normals-only',
        'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
        'rigMethod': 'A-pose donor surface skin transfer with inverse bind reconstruction',
        'mobileVertices': len(p), 'mobileTriangles': len(triangles),
        'motions': [a['name'] for a in doc['animations']],
        'transferDistanceP95': float(np.percentile(distances[:, 0], 95))}}
    prepare.write_glb(args.output, doc, compact)
    print(json.dumps({'output': str(args.output), 'bytes': args.output.stat().st_size, **doc['extras']['ballKnowerAthlete']}, indent=2))


if __name__ == '__main__':
    main()
