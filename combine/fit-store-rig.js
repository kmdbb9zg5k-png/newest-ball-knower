import { Bone, Box3, Float32BufferAttribute, MathUtils, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';

// Joint landmarks measured on the original showroom meshes, in units of
// stand height. Each row describes hips, shoulder, elbow, wrist, knee, ankle.
const fittings = {
  'bkf-iron-wolf': [[.061, .49], [.113, .79], [.155, .65], [.181, .53], [.089, .26], [.101, .06]],
  'bkf-kickflip': [[.057, .45], [.102, .79], [.144, .65], [.161, .49], [.070, .26], [.076, .057]],
  'bkf-lowrider': [[.062, .44], [.111, .79], [.162, .63], [.175, .49], [.073, .25], [.077, .06]],
  'bkf-outlaw': [[.058, .46], [.105, .79], [.150, .65], [.158, .51], [.075, .25], [.095, .06]],
  'bk-femme': [[.053, .47], [.093, .79], [.167, .64], [.234, .50], [.067, .25], [.080, .061]],
  'bkf-phantom': [[.057, .45], [.095, .79], [.135, .65], [.143, .50], [.075, .24], [.085, .058]],
};

const blend = (value, start, end) => MathUtils.smoothstep(value, start, end);
const sideNames = ['Left', 'Right'];

export function fitStoreRig(model, characterId) {
  const fitting = fittings[characterId];
  if (!fitting) throw new Error('The selected character has no fitted skeleton.');
  const [[hipX, hipY], [shoulderX, shoulderY], [elbowX, elbowY], [wristX, wristY],
    [kneeX, kneeY], [ankleX, ankleY]] = fitting;
  const meshes = [];
  model.traverse(object => { if (object.isMesh) meshes.push(object); });
  if (!meshes.length) throw new Error('The selected character has no mesh.');
  const bounds = new Box3().setFromObject(model);
  const origin = bounds.getCenter(new Vector3());
  origin.y = bounds.min.y;
  origin.z = 0;
  const height = bounds.max.y - origin.y;
  if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid character dimensions.');

  const bones = [];
  const indices = {};
  const joints = new Map();
  function joint(name, parent, x, y, z = 0) {
    const absolute = new Vector3(x, y, z).multiplyScalar(height).add(origin);
    const bone = new Bone();
    bone.name = name;
    bone.position.copy(absolute);
    if (parent) bone.position.sub(joints.get(parent));
    (parent ? bones[indices[parent]] : model).add(bone);
    joints.set(name, absolute);
    indices[name] = bones.length;
    bones.push(bone);
  }

  joint('Hips', null, 0, hipY);
  joint('Spine02', 'Hips', 0, hipY + .08);
  joint('Spine01', 'Spine02', 0, .64);
  joint('Spine', 'Spine01', 0, .74);
  joint('neck', 'Spine', 0, .83);
  joint('Head', 'neck', 0, .87);
  for (const [i, side] of sideNames.entries()) {
    const sign = i === 0 ? 1 : -1;
    joint(side + 'Shoulder', 'Spine', sign * shoulderX * .48, shoulderY + .012);
    joint(side + 'Arm', side + 'Shoulder', sign * shoulderX, shoulderY);
    joint(side + 'ForeArm', side + 'Arm', sign * elbowX, elbowY);
    joint(side + 'Hand', side + 'ForeArm', sign * wristX, wristY, .016);
    joint(side + 'UpLeg', 'Hips', sign * hipX, hipY - .016);
    joint(side + 'Leg', side + 'UpLeg', sign * kneeX, kneeY, .012);
    joint(side + 'Foot', side + 'Leg', sign * ankleX, ankleY, -.026);
    joint(side + 'ToeBase', side + 'Foot', sign * ankleX, .025, .062);
  }

  // Bind each original garment and its textures in the same coordinate system
  // as the skeleton. Skin attributes use normalized local-space measurements.
  model.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  const coordinate = new Vector3();
  const soles = [];
  for (const original of meshes) {
    const geometry = original.geometry;
    geometry.applyMatrix4(original.matrixWorld);
    geometry.computeBoundingBox();
    const position = geometry.getAttribute('position');
    const skinIndex = new Uint16Array(position.count * 4);
    const skinWeight = new Float32Array(position.count * 4);
    const bestIndex = new Uint16Array(4);
    const bestWeight = new Float32Array(4);
    const soleVertices = new Map();
    function weight(name, amount) {
      for (let i = 0; i < 4; i++) {
        if (amount <= bestWeight[i]) continue;
        for (let j = 3; j > i; j--) {
          bestWeight[j] = bestWeight[j - 1];
          bestIndex[j] = bestIndex[j - 1];
        }
        bestWeight[i] = amount;
        bestIndex[i] = indices[name];
        return;
      }
    }
    for (let vertex = 0; vertex < position.count; vertex++) {
      coordinate.fromBufferAttribute(position, vertex).sub(origin).divideScalar(height);
      const { x, y, z } = coordinate;
      const lateral = Math.abs(x);
      const side = x >= 0 ? 'Left' : 'Right';
      const opposite = side === 'Left' ? 'Right' : 'Left';
      if (y < .035) {
        const region = (x >= 0 ? 1 : -1) * (1 + (z < -.015 ? 0 : z < .035 ? 1 : 2));
        const foundation = soleVertices.get(region);
        if (!foundation || y < foundation.y) soleVertices.set(region, { vertex, y });
      }
      bestWeight.fill(0);
      // The fur tail follows the pelvis. Nicki's back hair follows the head.
      if (characterId === 'bkf-iron-wolf' && z < -.105 && y < .55) {
        weight('Hips', 1);
      } else if (characterId === 'bk-femme' && z < -.061 && y > .70 &&
                 lateral < .115 && (y > .79 || z < -.082)) {
        weight('Head', 1);
      } else {
        const armCenter = y < elbowY
          ? MathUtils.lerp(wristX, elbowX, MathUtils.clamp((y - wristY) / (elbowY - wristY), 0, 1))
          : MathUtils.lerp(elbowX, shoulderX, MathUtils.clamp((y - elbowY) / (shoulderY - elbowY), 0, 1));
        const armCut = armCenter - (characterId === 'bkf-phantom' ? .031 : .038);
        const arm = blend(lateral, armCut - .013, armCut + .013) *
          blend(y, wristY - .09, wristY - .046) * (1 - blend(y, shoulderY + .018, shoulderY + .065));
        const legs = (1 - arm) * (1 - blend(y, hipY - .055, hipY + .028));
        const torso = 1 - arm - legs;
        const hand = 1 - blend(y, wristY - .043, wristY + .026);
        const upperArm = blend(y, elbowY - .045, elbowY + .048);
        weight(side + 'Hand', arm * hand);
        weight(side + 'ForeArm', arm * (1 - hand) * (1 - upperArm));
        weight(side + 'Arm', arm * (1 - hand) * upperArm);

        const shin = 1 - blend(y, kneeY - .053, kneeY + .059);
        const foot = 1 - blend(y, ankleY - .025, ankleY + .047);
        const toe = blend(z, .045, .09) * (1 - blend(y, .018, .039));
        const nearHip = blend(y, hipY - .11, hipY);
        const farLeg = .5 * (1 - blend(lateral, 0, .038)) * nearHip;
        weight(side + 'UpLeg', legs * (1 - shin) * (1 - farLeg));
        weight(opposite + 'UpLeg', legs * (1 - shin) * farLeg);
        weight(side + 'Leg', legs * shin * (1 - foot));
        weight(side + 'Foot', legs * shin * foot * (1 - toe));
        weight(side + 'ToeBase', legs * shin * foot * toe);

        const pelvis = 1 - blend(y, hipY + .01, hipY + .14);
        const waist = 1 - blend(y, .61, .69);
        const chest = blend(y, .67, .76);
        const head = blend(y, .815, .878);
        weight('Hips', torso * pelvis);
        weight('Spine02', torso * (1 - pelvis) * waist);
        weight('Spine01', torso * (1 - pelvis) * (1 - waist) * (1 - chest));
        weight('Spine', torso * (1 - pelvis) * (1 - waist) * chest * (1 - head));
        weight('Head', torso * (1 - pelvis) * (1 - waist) * chest * head);
      }
      const sum = bestWeight.reduce((total, value) => total + value, 0);
      skinIndex.set(bestIndex, vertex * 4);
      for (let i = 0; i < 4; i++) skinWeight[vertex * 4 + i] = bestWeight[i] / sum;
    }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeight, 4));
    const fitted = new SkinnedMesh(geometry, original.material);
    fitted.name = original.name;
    original.removeFromParent();
    model.add(fitted);
    fitted.bind(skeleton);
    soles.push({ mesh: fitted, vertices: [...soleVertices.values()].map(sample => sample.vertex) });
  }
  return function lowestSole() {
    let height = Infinity;
    for (const { mesh, vertices } of soles) {
      for (const index of vertices) {
        mesh.getVertexPosition(index, coordinate).applyMatrix4(mesh.matrixWorld);
        height = Math.min(height, coordinate.y);
      }
    }
    return height;
  };
}
