"""Build an original skinned football player from Blender geometry.

Usage:
blender -b --python scripts/build-running-back-prototype.py -- \
  public/play-moment-3d/assets/reference-helmeted-athlete-v1.glb \
  public/play-moment-3d/assets/running-back-prototype-v1.glb
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

SKIN, JERSEY, PANTS, HELMET, CAGE, GLOVE, CLEAT, TRIM, DARK, SOCK = range(10)
TAU = math.tau

source, target = map(lambda s: str(Path(s).resolve()), sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
rig.animation_data_clear()
rig.data.pose_position = 'REST'
for obj in list(bpy.context.scene.objects):
    if obj != rig:
        bpy.data.objects.remove(obj, do_unlink=True)

vertices, faces, joints, regions, uvs = [], [], [], [], []


def binding(*pairs):
    return [('mixamorig:' + joint, weight) for joint, weight in pairs if weight]


def rigid(joint):
    return binding((joint, 1.0))


def vertex(point, bind, region, uv):
    vertices.append(tuple(point))
    joints.append(bind)
    regions.append(region)
    uvs.append(uv)
    return len(vertices) - 1


def rings(sections, region, samples=16, cap=True):
    """A skinned loft of elliptical sections (center, cross-axis, depth-axis, radii, weights)."""
    loops = []
    for idx, (center, side, deep, width, depth, bind) in enumerate(sections):
        circle = []
        for j in range(samples):
            angle = TAU * j / samples
            p = center + side * (math.cos(angle) * width) + deep * (math.sin(angle) * depth)
            circle.append(vertex(p, bind, region, (j / samples, idx / (len(sections) - 1))))
        loops.append(circle)
    for previous, current in zip(loops, loops[1:]):
        for j in range(samples):
            nxt = (j + 1) % samples
            faces.append((previous[j], previous[nxt], current[nxt], current[j]))
    if cap:
        faces.append(tuple(reversed(loops[0])))
        faces.append(tuple(loops[-1]))


def torso(rows, region, samples=24):
    rings([
        (Vector((0, y, z)), Vector((1, 0, 0)), Vector((0, 1, 0)), w, d, bind)
        for z, y, w, d, bind in rows
    ], region, samples)


def along(rows, region, samples=14):
    centers = [Vector(row[0]) for row in rows]
    sections = []
    for i, (_, width, depth, bind) in enumerate(rows):
        axis = (centers[min(i + 1, len(centers) - 1)] - centers[max(0, i - 1)]).normalized()
        side = (Vector((1, 0, 0)) - axis * axis.x)
        if side.length < .15:
            side = Vector((0, 0, 1)) - axis * axis.z
        side.normalize()
        deep = axis.cross(side).normalized()
        sections.append((centers[i], side, deep, width, depth, bind))
    rings(sections, region, samples)


def ellipsoid(position, radii, bind, region, samples=16, levels=9):
    rows = []
    for i in range(levels):
        latitude = -math.pi / 2 + math.pi * i / (levels - 1)
        ratio = max(math.cos(latitude), .005)
        rows.append((position[2] + math.sin(latitude) * radii[2], position[1],
                     radii[0] * ratio, radii[1] * ratio, bind))
    start = len(vertices)
    torso(rows, region, samples)
    for i in range(start, len(vertices)):
        x, y, z = vertices[i]
        vertices[i] = (x + position[0], y, z)


hips, spine, ribs, shoulders = map(rigid, ('Hips', 'Spine', 'Spine1', 'Spine2'))
neck, head = rigid('Neck'), rigid('Head')
torso([
    (.853, .006, .105, .098, hips),
    (.895, .013, .163, .107, hips),
    (.967, .010, .171, .109, hips),
    (1.012, .005, .152, .104, hips),
], PANTS)
torso([
    (.956, .005, .154, .106, hips),
    (.989, .004, .160, .104, hips),
    (1.055, .003, .147, .097, spine),
    (1.135, .005, .162, .103, binding(('Spine', .55), ('Spine1', .45))),
    (1.223, .000, .195, .123, ribs),
    (1.309, -.002, .217, .136, binding(('Spine1', .38), ('Spine2', .62))),
    (1.363, .010, .225, .126, shoulders),
    (1.398, .015, .179, .096, shoulders),
    (1.425, .018, .080, .066, shoulders),
    (1.429, .020, .065, .054, shoulders),
], JERSEY)
torso([(1.414, .019, .070, .059, shoulders), (1.429, .020, .069, .057, shoulders),
       (1.435, .020, .058, .051, shoulders)], TRIM)
torso([(1.415, .026, .052, .043, neck), (1.474, .027, .048, .041, neck),
       (1.493, .025, .051, .041, head)], SKIN)
ellipsoid((.006, -.016, 1.555), (.080, .086, .085), head, SKIN, levels=8)
ellipsoid((.004, -.087, 1.501), (.046, .031, .040), head, SKIN, samples=12, levels=6)

for sign, side in [(1, 'Left'), (-1, 'Right')]:
    arm, forearm, hand = side + 'Arm', side + 'ForeArm', side + 'Hand'
    hip, knee, foot, toe = side + 'UpLeg', side + 'Leg', side + 'Foot', side + 'ToeBase'
    x = lambda n: sign * n
    upper, lower = rigid(arm), rigid(forearm)
    hand_bind = rigid(hand)
    along([
        ((x(.180), .039, 1.394), .071, .081, binding((arm, .70), ('Spine2', .30))),
        ((x(.211), .030, 1.371), .084, .109, upper),
        ((x(.225), .028, 1.312), .077, .097, upper),
        ((x(.232), .029, 1.264), .065, .074, upper),
        ((x(.233), .028, 1.246), .055, .065, upper),
    ], JERSEY)
    along([
        ((x(.230), .028, 1.274), .066, .075, upper),
        ((x(.233), .028, 1.261), .064, .073, upper),
    ], TRIM)
    along([
        ((x(.228), .033, 1.261), .049, .054, upper),
        ((x(.235), .032, 1.213), .057, .055, upper),
        ((x(.242), .041, 1.156), .049, .043, upper),
        ((x(.247), .042, 1.132), .044, .038, binding((arm, .46), (forearm, .54))),
        ((x(.261), .022, 1.091), .051, .044, lower),
        ((x(.292), -.007, 1.027), .046, .037, lower),
        ((x(.322), -.034, .948), .033, .029, lower),
        ((x(.334), -.045, .915), .031, .026, binding((forearm, .45), (hand, .55))),
    ], SKIN)
    along([
        ((x(.316), -.028, .967), .035, .032, lower),
        ((x(.332), -.041, .921), .033, .030, binding((forearm, .24), (hand, .76))),
    ], DARK)
    along([
        ((x(.332), -.044, .927), .035, .030, hand_bind),
        ((x(.346), -.069, .881), .041, .035, hand_bind),
        ((x(.355), -.090, .852), .040, .031, hand_bind),
        ((x(.358), -.105, .831), .027, .020, hand_bind),
    ], GLOVE)
    ellipsoid((x(.319), -.085, .873), (.022, .030, .027), hand_bind, GLOVE, samples=10, levels=6)

    thigh, shin, ankle, toe_bind = map(rigid, (hip, knee, foot, toe))
    following = binding((hip, .47), (knee, .53))
    along([
        ((x(.098), -.019, .932), .084, .091, binding(('Hips', .52), (hip, .48))),
        ((x(.109), -.026, .851), .093, .102, thigh),
        ((x(.121), -.019, .766), .089, .102, thigh),
        ((x(.130), -.004, .663), .077, .083, thigh),
        ((x(.140), .001, .558), .066, .063, binding((hip, .77), (knee, .23))),
        ((x(.143), .005, .510), .062, .063, following),
        ((x(.147), .014, .465), .056, .055, shin),
        ((x(.151), .020, .430), .051, .049, shin),
    ], PANTS)
    # Raised front panels are separate pads and bend with their associated joints.
    ellipsoid((x(.121), -.078, .754), (.066, .062, .123), thigh, PANTS, samples=16, levels=8)
    ellipsoid((x(.143), -.040, .531), (.048, .049, .065), following, PANTS, samples=14, levels=7)
    along([
        ((x(.148), .017, .454), .054, .052, shin),
        ((x(.155), .029, .377), .059, .059, shin),
        ((x(.164), .046, .294), .058, .057, shin),
        ((x(.171), .051, .231), .044, .047, shin),
        ((x(.178), .049, .165), .031, .037, shin),
        ((x(.181), .047, .124), .032, .034, binding((knee, .40), (foot, .60))),
    ], SOCK)
    along([((x(.155), .026, .399), .060, .058, shin), ((x(.157), .030, .382), .060, .060, shin)], TRIM)
    along([
        ((x(.182), .053, .126), .034, .040, ankle),
        ((x(.186), .029, .072), .046, .043, ankle),
        ((x(.214), -.015, .060), .048, .031, binding((foot, .75), (toe, .25))),
        ((x(.237), -.070, .054), .046, .026, toe_bind),
        ((x(.247), -.105, .050), .036, .021, toe_bind),
        ((x(.25), -.122, .049), .022, .017, toe_bind),
    ], CLEAT)
    for z, y, bind in [( .043, .019, ankle), (.038, -.065, toe_bind), (.033, -.093, toe_bind)]:
        for offset in [-.022, .024]:
            x_center = x(.20 if y > 0 else .235) + offset
            ellipsoid((x_center, y, z), (.010, .011, .011), bind, CLEAT, samples=8, levels=4)

# Helmet shell has a curved front aperture and raised front rim rather than
# covering the face with a full sphere. Adjacent stripe faces share the shape.
rows = [
    (1.476, .090, .016, .084, .91),
    (1.507, .111, .019, .112, .84),
    (1.555, .124, .014, .128, .72),
    (1.600, .128, .001, .137, .50),
    (1.625, .119, -.004, .128, .22),
    (1.657, .093, -.004, .105, 0),
    (1.682, .055, -.003, .067, 0),
    (1.697, .003, -.003, .004, 0),
]
samples = 32
helmet_layers = [[
    Vector((w * math.sin(a), y - d * math.cos(a), z))
    for j in range(samples + 1)
    for a in [aperture + (TAU - 2 * aperture) * j / samples]
] for z,w,y,d,aperture in rows]
helmet_points = {}
for layer in range(len(rows)-1):
    for j in range(samples):
        if layer < 4:
            is_center = j in (15, 16)
        else:
            is_center = j in (0, 15, 16, 31)
        region = TRIM if is_center else HELMET
        corners = [(layer,j), (layer,j+1), (layer+1,j+1), (layer+1,j)]
        ids = []
        for iz, ia in corners:
            key = (iz, ia, region)
            if key not in helmet_points:
                helmet_points[key] = vertex(helmet_layers[iz][ia], head, region, (ia/samples, iz/(len(rows)-1)))
            ids.append(helmet_points[key])
        faces.append(tuple(reversed(ids)))

for sign, side in [(1, 'Left'), (-1, 'Right')]:
    for row, region, width, samples in [
        ([(.106,-.067,1.572),(.095,-.113,1.552),(.072,-.166,1.529),(.038,-.179,1.523),(0,-.181,1.522)], CAGE, .0075, 9),
        ([(.109,-.061,1.537),(.098,-.112,1.504),(.074,-.161,1.481),(.035,-.179,1.477),(0,-.182,1.477)], CAGE, .008, 9),
        ([(.107,-.068,1.563),(.110,-.076,1.530),(.104,-.081,1.507)], CAGE, .006, 8),
        ([(.088,-.142,1.541),(.079,-.158,1.521),(.070,-.164,1.486)], CAGE, .0055, 8),
        ([(.036,-.130,1.585),(.077,-.108,1.582),(.106,-.079,1.570)], DARK, .013, 9),
    ]:
        along([((sign*x, y, z), width, width, head) for x,y,z in row], region, samples)
    ellipsoid((sign*.11, -.052, 1.515), (.020, .042, .041), head, HELMET, samples=12, levels=7)
    ellipsoid((sign*.126, -.082, 1.545), (.009, .017, .019), head, CAGE, samples=10, levels=5)
    ellipsoid((sign*.050, -.111, 1.489), (.026, .022, .014), head, DARK, samples=10, levels=5)

mesh = bpy.data.meshes.new('Running_Back')
mesh.from_pydata(vertices, [], faces)
mesh.validate()
mesh.update()
model = bpy.data.objects.new('BK Running Back', mesh)
bpy.context.collection.objects.link(model)
model.parent = rig

for poly in mesh.polygons:
    poly.use_smooth = True
layer = mesh.uv_layers.new(name='UVMap')
for loop in mesh.loops:
    layer.data[loop.index].uv = uvs[loop.vertex_index]
tag = mesh.attributes.new('_BKREGION', 'FLOAT', 'POINT')
tag.data.foreach_set('value', regions)

groups = {name: model.vertex_groups.new(name=name) for name in sorted({name for bind in joints for name, _ in bind})}
for index, bind in enumerate(joints):
    for name, weight in bind:
        groups[name].add([index], weight, 'REPLACE')

armature = model.modifiers.new('Existing Ball Knower skeleton', 'ARMATURE')
armature.object = rig
bpy.ops.object.select_all(action='DESELECT')
model.select_set(True)
bpy.context.view_layer.objects.active = model
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
rig.select_set(True)

bpy.ops.export_scene.gltf(filepath=target, export_format='GLB', use_selection=True,
                         export_materials='NONE', export_attributes=True,
                         export_animations=False, export_tangents=True)
print('Running back authored vertices:', len(vertices), 'faces:', len(faces))
