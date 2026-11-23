"""Build the original running back mesh on the Ball Knower reference skeleton.

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


def rings(sections, region, samples=16, cap=True, drape=None):
    """A skinned loft of elliptical sections (center, cross-axis, depth-axis, radii, weights)."""
    loops = []
    for idx, (center, side, deep, width, depth, bind) in enumerate(sections):
        circle = []
        for j in range(samples):
            angle = TAU * j / samples
            relief = drape(idx, angle) if drape else 0
            p = center + (1 + relief) * (side * (math.cos(angle) * width) + deep * (math.sin(angle) * depth))
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


def along(rows, region, samples=14, drape=None):
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
    rings(sections, region, samples, drape=drape)


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
    (.846, .000, .109, .096, hips),
    (.893, .005, .162, .105, hips),
    (.935, .004, .165, .108, hips),
    (.978, .004, .140, .086, hips),
], PANTS)


def stitch(previous, current, skip=()):
    for j in range(len(previous)):
        if j in skip:
            continue
        k = (j + 1) % len(previous)
        faces.append((previous[j], previous[k], current[k], current[j]))


def jersey_shell():
    """Continuous jersey body with two bridged sleeve openings."""
    count = 36
    lower, upper, half_span = 5, 8, 3
    profile = [
        (.954, .003, .156, .106, hips),
        (1.001, .003, .160, .105, binding(('Hips', .70), ('Spine', .30))),
        (1.065, .002, .149, .096, spine),
        (1.147, .004, .166, .111, binding(('Spine', .48), ('Spine1', .52))),
        (1.215, .004, .181, .125, ribs),
        (1.270, -.003, .194, .134, binding(('Spine1', .70), ('Spine2', .30))),
        (1.316, .001, .207, .136, shoulders),
        (1.354, .011, .226, .125, shoulders),
        (1.391, .020, .213, .103, shoulders),
        (1.421, .016, .131, .072, shoulders),
        (1.430, .015, .065, .056, shoulders),
    ]
    rows = []
    for i, (z, depth_center, w, d, bind) in enumerate(profile):
        row = []
        for j in range(count):
            angle = TAU * j / count
            side, front = math.cos(angle), math.sin(angle)
            # Shallow, asymmetric drape keeps the jersey from reading as a cast torso.
            wave = 1 + .014 * math.sin(5*angle+i*.81) + .010 * math.sin(8*angle-i*.67)
            if i in (1,2,3):
                wave += (.026,-.036,.021)[i-1] * (.32+.68*abs(side)) * math.cos(3*angle+i*.75)
            if i in (5,6):
                wave -= .035 * abs(side)**5 * (1 if i==5 else -.45)
            y = depth_center+d*front*wave
            row.append(vertex((w*side*wave, y, z+.002*math.sin(4*angle+i)),
                              bind,JERSEY,(j/count,i/(len(profile)-1))))
        rows.append(row)
    sleeves = []
    removed = set()
    for sign, side in [(1, 'Left'),(-1, 'Right')]:
        middle = 0 if sign > 0 else count // 2
        start, end = middle-half_span, middle+half_span
        removed.update(j % count for j in range(start,end))
        opening = [(lower,j) for j in range(start,end)]
        opening += [(i,end) for i in range(lower,upper)]
        opening += [(upper,j) for j in range(end,start,-1)]
        opening += [(i,start) for i in range(upper,lower,-1)]
        sleeves.append((sign,side,[rows[i][j%count] for i,j in opening]))
    for i, (previous, current) in enumerate(zip(rows,rows[1:])):
        stitch(previous,current,removed if lower <= i < upper else ())
    faces.append(tuple(reversed(rows[0])))
    for sign, side, opening in sleeves:
        arm = side+'Arm'
        y0 = sum(vertices[i][1] for i in opening)/len(opening)
        z0 = sum(vertices[i][2] for i in opening)/len(opening)
        previous = opening
        profile = [
            ((sign*.211, .025, 1.341), .062, .081, binding(('Spine2',.58),(arm,.42)), .40),
            ((sign*.223, .026, 1.321), .066, .078, binding(('Spine2',.39),(arm,.61)), .70),
            ((sign*.228, .027, 1.297), .060, .070, binding(('Spine2',.16),(arm,.84)), .91),
            ((sign*.231, .027, 1.268), .054, .064, rigid(arm), 1),
            ((sign*.232, .028, 1.246), .052, .061, rigid(arm), 1),
        ]
        for j,(center,side_radius,depth_radius,bind,turn) in enumerate(profile):
            current = []
            for k, source in enumerate(opening):
                p = Vector(vertices[source])
                angle = math.atan2((p.z-z0)/.065,(p.y-y0)/.072)
                # Rotate the hole normal from lateral at the torso to down the arm.
                tilt = turn*math.pi*.47
                yaxis = Vector((0,1,0))
                axis = Vector((sign*math.sin(tilt),0,math.cos(tilt)))
                radial = math.sin(angle)*side_radius*axis + math.cos(angle)*depth_radius*yaxis
                target = Vector(center)+radial
                current.append(vertex(target,bind,JERSEY,(k/len(opening),j/(len(profile)-1))))
            stitch(previous,current)
            previous = current

jersey_shell()
torso([(1.418,.017,.067,.057,shoulders),(1.429,.016,.070,.059,shoulders),
       (1.436,.015,.067,.055,shoulders),(1.439,.015,.056,.049,shoulders),
       (1.432,.015,.051,.043,shoulders)], DARK, samples=36)
torso([(1.422, .023, .052, .044, neck), (1.464, .023, .047, .045, neck),
       (1.492, .016, .049, .042, head)], SKIN, samples=28)

# Head volume follows a shorter jaw, cheek/temple taper and a broad brow.
torso([
    (1.469,-.051,.031,.039,head),(1.483,-.043,.044,.051,head),
    (1.501,-.030,.055,.064,head),(1.525,-.021,.068,.074,head),
    (1.543,-.018,.075,.077,head),(1.562,-.013,.075,.076,head),
    (1.584,-.012,.074,.073,head),(1.608,-.012,.060,.060,head),
    (1.626,-.011,.022,.024,head),
], SKIN, samples=32)
along([
    ((0,-.085,1.567),.008,.008,head),((0,-.093,1.552),.010,.006,head),
    ((0,-.107,1.536),.011,.009,head),((0,-.105,1.525),.015,.006,head),
], SKIN, samples=12)
for sign in (-1,1):
    ellipsoid((sign*.028,-.087,1.555),(.016,.006,.0045),head,DARK, samples=12,levels=5)
    ellipsoid((sign*.070,-.012,1.537),(.011,.019,.025),head,SKIN,samples=12,levels=7)

for sign, side in [(1, 'Left'), (-1, 'Right')]:
    arm, forearm, hand = side + 'Arm', side + 'ForeArm', side + 'Hand'
    hip, knee, foot, toe = side + 'UpLeg', side + 'Leg', side + 'Foot', side + 'ToeBase'
    x = lambda n: sign * n
    upper, lower = rigid(arm), rigid(forearm)
    hand_bind = rigid(hand)
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
    # Flatten the glove palm and bend the thumb across the index side.
    along([
        ((x(.331), -.041, .927), .030, .026, hand_bind),
        ((x(.340), -.058, .894), .031, .025, hand_bind),
        ((x(.350), -.075, .866), .030, .022, hand_bind),
        ((x(.354), -.080, .851), .025, .016, hand_bind),
    ], GLOVE, samples=18)
    for finger, offset in enumerate((-.021,-.007,.007,.020)):
        reach = (.024,.028,.026,.020)[finger]
        position = x(.351+offset)
        along([
            ((position,-.078,.859),.008,.010,hand_bind),
            ((position+x(.004),-.088,.853-reach*.45),.008,.009,hand_bind),
            ((position+x(.005),-.100,.853-reach*.68),.0075,.008,hand_bind),
            ((position+x(.003),-.107,.853-reach*.61),.006,.006,hand_bind),
        ], GLOVE, samples=10)
    along([
        ((x(.322),-.061,.895),.013,.014,hand_bind),
        ((x(.315),-.081,.879),.012,.013,hand_bind),
        ((x(.323),-.096,.866),.010,.011,hand_bind),
        ((x(.335),-.099,.859),.008,.008,hand_bind),
    ], GLOVE, samples=12)

    thigh, shin, ankle, toe_bind = map(rigid, (hip, knee, foot, toe))
    following = binding((hip, .47), (knee, .53))
    def trouser_folds(row, angle):
        # Pinches follow lateral fabric tension near the hip and flexing knee.
        envelope = {1:.042,2:-.035,3:.022,6:-.043,7:.055,8:-.028}.get(row,0)
        return envelope*(.30+.70*abs(math.cos(angle))) * math.cos(3*angle+row*.71)

    # Padded depth is built into the front of the fabric cross-section.
    along([
        ((x(.092), -.007, .935), .086, .092, binding(('Hips', .52), (hip, .48))),
        ((x(.102), -.018, .877), .095, .102, thigh),
        ((x(.112), -.019, .817), .091, .104, thigh),
        ((x(.121), -.025, .754), .085, .109, thigh),
        ((x(.126), -.021, .705), .079, .101, thigh),
        ((x(.130), -.007, .657), .074, .083, thigh),
        ((x(.140), .001, .559), .063, .063, binding((hip, .77), (knee, .23))),
        ((x(.143), -.002, .514), .062, .068, following),
        ((x(.147), .013, .466), .057, .055, shin),
        ((x(.150), .020, .431), .052, .049, shin),
    ], PANTS, samples=28, drape=trouser_folds)
    along([
        ((x(.149), .018, .452), .052, .050, shin),
        ((x(.151), .024, .421), .055, .054, shin),
        ((x(.155), .030, .382), .059, .057, shin),
        ((x(.161), .042, .333), .060, .058, shin),
        ((x(.166), .049, .273), .051, .055, shin),
        ((x(.172), .053, .224), .040, .047, shin),
        ((x(.176), .052, .191), .032, .038, shin),
        ((x(.178), .051, .173), .034, .041, shin),
        ((x(.179), .049, .156), .031, .036, binding((knee, .66), (foot, .34))),
        ((x(.181), .046, .142), .034, .037, binding((knee, .48), (foot, .52))),
        ((x(.181), .047, .124), .033, .035, binding((knee, .40), (foot, .60))),
    ], SOCK, samples=20)
    along([
        ((x(.151),.023,.418),.056,.055,shin),((x(.152),.026,.412),.057,.056,shin),
        ((x(.153),.027,.408),.056,.055,shin),
    ], DARK, samples=18)
    along([
        ((x(.182), .053, .126), .034, .040, ankle),
        ((x(.186), .029, .072), .046, .043, ankle),
        ((x(.214), -.015, .060), .048, .031, binding((foot, .75), (toe, .25))),
        ((x(.237), -.070, .054), .046, .026, toe_bind),
        ((x(.247), -.105, .050), .036, .021, toe_bind),
        ((x(.25), -.122, .049), .022, .017, toe_bind),
    ], CLEAT)
    # Firm, flatter outsole wraps around the forefoot and takes small studs.
    ellipsoid((x(.218),-.042,.039),(.054,.102,.0155),
              binding((foot,.36),(toe,.64)),DARK,samples=22,levels=6)
    for z, y, bind in [( .041, .017, ankle), (.037, -.068, toe_bind), (.035, -.092, toe_bind)]:
        for offset in [-.021, .021]:
            x_center = x(.20 if y > 0 else .235) + offset
            ellipsoid((x_center, y, z), (.008, .009, .010), bind, CLEAT, samples=9, levels=4)

# Four sectors keep the face aperture, sidewalls and center stripe aligned.
rows = [
    (1.476,.082,.013,.083,.94),
    (1.510,.108,.012,.105,.95),
    (1.542,.115,.007,.123,.85),
    (1.570,.117,.002,.130,.70),
    (1.585,.117,-.002,.132,.58),
    (1.597,.117,-.003,.134,.43),
    (1.603,.116,-.003,.135,.22),
    (1.610,.115,-.003,.134,0),
    (1.626,.109,-.001,.127,0),
    (1.646,.097,.001,.114,0),
    (1.665,.077,.004,.094,0),
    (1.684,.049,.008,.065,0),
    (1.694,.003,.011,.004,0),
]
samples = 48
helmet_layers = [[
    Vector((w*math.sin(angle), y-d*math.cos(angle), z))
    for j in range(samples+1)
    for angle in [aperture+(TAU-2*aperture)*j/samples]
] for z,w,y,d,aperture in rows]
helmet_points = {}
for i in range(len(rows)-1):
    for j in range(samples):
        corners = [(i,j),(i,j+1),(i+1,j+1),(i+1,j)]
        ids = []
        for z, angle in corners:
            point = helmet_layers[z][angle]
            key = tuple(round(c,7) for c in point)
            if key not in helmet_points:
                helmet_points[key] = vertex(point,head,HELMET,(angle/samples,z/(len(rows)-1)))
            ids.append(helmet_points[key])
        faces.append(tuple(reversed(ids)))

def bar(points, radius, region=CAGE, sides=10):
    along([(point,radius,radius,head) for point in points],region,samples=sides)

def mirrored_bar(half, radius):
    bar([(-x,y,z) for x,y,z in half[:-1]]+list(reversed(half)),radius)

mirrored_bar([
    (.106,-.078,1.580),(.102,-.113,1.574),(.079,-.143,1.565),
    (.041,-.162,1.560),(0,-.165,1.559),
], .0045)
mirrored_bar([
    (.111,-.065,1.548),(.104,-.110,1.531),(.080,-.149,1.518),
    (.041,-.166,1.513),(0,-.170,1.512),
], .0055)
mirrored_bar([
    (.095,-.070,1.505),(.087,-.105,1.480),(.064,-.140,1.472),
    (.031,-.152,1.471),(0,-.155,1.471),
], .0053)
for sign in (-1,1):
    bar([(sign*.104,-.091,1.571),(sign*.104,-.102,1.541),(sign*.095,-.112,1.481)],.0041)
    bar([(sign*.071,-.148,1.562),(sign*.061,-.157,1.514),(sign*.057,-.151,1.472)],.0041)
    bar([(sign*.105,-.044,1.534),(sign*.085,-.076,1.496),(sign*.055,-.102,1.476),
         (sign*.023,-.111,1.473)],.0058,DARK)
    ellipsoid((sign*.111,-.051,1.529),(.018,.038,.041),head,HELMET,samples=18,levels=9)
    ellipsoid((sign*.120,-.069,1.554),(.006,.016,.014),head,CAGE,samples=14,levels=7)
    ellipsoid((sign*.123,-.026,1.535),(.009,.015,.019),head,DARK,samples=14,levels=7)
ellipsoid((0,-.114,1.478),(.044,.013,.011),head,DARK,samples=16,levels=7)

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
                         export_animations=False)
print('Running back authored vertices:', len(vertices), 'faces:', len(faces))
