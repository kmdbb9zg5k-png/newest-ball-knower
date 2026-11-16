// Keep the Store mesh and skin. The native Combine rig still drives the dash,
// while its poses are copied onto the character's own proportions.
import { Box3, MathUtils, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { invalidateCombineAsset, loadCombineAsset } from './asset-loading.js';

const jointNames = {
  Hips: 'Hips', Spine: 'Spine02', Spine1: 'Spine01', Spine2: 'Spine', Neck: 'neck', Head: 'Head',
};
const limbEnds = {};
for (const side of ['Left', 'Right']) {
  for (const part of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase']) {
    jointNames[side + part] = side + part;
  }
  limbEnds[side + 'Arm'] = side + 'ForeArm';
  limbEnds[side + 'ForeArm'] = side + 'Hand';
  limbEnds[side + 'UpLeg'] = side + 'Leg';
  limbEnds[side + 'Leg'] = side + 'Foot';
  limbEnds[side + 'Foot'] = side + 'ToeBase';
}

export async function loadPracticeCharacter(url, source, fitting) {
  let model;
  try {
    const bytes = await loadCombineAsset(url);
    ({ scene: model } = await new GLTFLoader().parseAsync(bytes.slice(0), new URL('.', new URL(url, location.href)).href));
    let lowestSole;
    if (fitting) {
      const { fitStoreRig } = await import('./fit-store-rig.js');
      lowestSole = fitStoreRig(model, fitting);
    }
    return bindPracticeCharacter(model, source, lowestSole);
  } catch (error) {
    if (model) disposePracticeCharacter(model);
    invalidateCombineAsset(url);
    throw error;
  }
}

function bindPracticeCharacter(model, source, lowestSole) {
  const target = new Map();
  let skinned = false;
  model.traverse(object => {
    if (object.isBone) target.set(object.name, object);
    if (object.isSkinnedMesh) {
      skinned = true;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    }
  });
  if (!skinned || Object.values(jointNames).some(name => !target.has(name))) {
    throw new Error('The selected character rig is incomplete.');
  }

  const bounds = new Box3().setFromObject(model);
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid character dimensions.');
  const scale = 1.78 / height;
  model.scale.multiplyScalar(scale);
  model.position.set(-bounds.getCenter(new Vector3()).x * scale, -bounds.min.y * scale, 0);
  model.updateMatrixWorld(true);

  const position = bone => bone.getWorldPosition(new Vector3());
  const orientation = bone => bone.getWorldQuaternion(new Quaternion());
  const adjustments = {};
  const pairs = Object.entries(jointNames).map(([name, otherName]) => {
    const a = source[name], b = target.get(otherName), child = limbEnds[name];
    const side = name.startsWith('Left') ? 'Left' : 'Right';
    let adjustment = new Quaternion();
    if (child) {
      const sourceDirection = position(source[child]).sub(position(a)).normalize();
      const targetDirection = position(target.get(jointNames[child])).sub(position(b)).normalize();
      adjustment.setFromUnitVectors(targetDirection, sourceDirection);
    } else if (name.endsWith('Hand')) adjustment.copy(adjustments[side + 'ForeArm']);
    else if (name.endsWith('ToeBase')) adjustment.copy(adjustments[side + 'Foot']);
    adjustments[name] = adjustment;
    return { source: a, target: b, correction: orientation(a).invert().multiply(adjustment).multiply(orientation(b)) };
  });

  const initialY = model.position.y;
  const sourceHip = source.Hips;
  const targetHip = target.get('Hips');
  const startSourceHip = sourceHip.position.clone();
  const startTargetHip = position(targetHip);
  const sourceHipScale = sourceHip.parent.getWorldScale(new Vector3());
  const inverseParent = new Quaternion(), hip = new Vector3();

  return {
    model,
    pose(root) {
      if (lowestSole) model.position.y = initialY;
      hip.copy(sourceHip.position).sub(startSourceHip).multiply(sourceHipScale).add(startTargetHip);
      targetHip.position.copy(targetHip.parent.worldToLocal(root.localToWorld(hip)));
      for (const pair of pairs) {
        pair.source.getWorldQuaternion(pair.target.quaternion);
        pair.target.quaternion.multiply(pair.correction);
        pair.target.parent.getWorldQuaternion(inverseParent).invert();
        pair.target.quaternion.premultiply(inverseParent);
        pair.target.updateMatrixWorld();
      }
      if (lowestSole) {
        model.updateMatrixWorld(true);
        // The original shoes have different proportions from the driver.
        // Keep them above the track without changing motion or race physics.
        model.position.y += MathUtils.clamp(root.position.y - lowestSole(), 0, .24);
        model.updateMatrixWorld(true);
      }
    },
    dispose() { disposePracticeCharacter(model); },
  };
}

function disposePracticeCharacter(model) {
  const released = new Set();
  model.traverse(object => {
    const resources = [object.geometry, object.skeleton];
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      resources.push(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) resources.push(value, value.image);
      }
    }
    for (const resource of resources) {
      if (!resource || released.has(resource)) continue;
      released.add(resource);
      resource.dispose?.();
      resource.close?.();
    }
  });
  model.removeFromParent();
}
