import { BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, Object3D, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { invalidateCombineAsset, loadCombineAsset } from './asset-loading.js';

const url = '/play-moment-3d/assets/combine-training-athlete-v1.glb';
const sides = ['Left', 'Right'] as const;
const forward = new Vector3(0, 0, 1);

function armFrame(elbow: Vector3, wrist: Vector3) {
  const down = wrist.clone().sub(elbow).normalize();
  const across = down.clone().cross(forward).normalize();
  return new Matrix4().makeBasis(across, down, across.clone().cross(down));
}

// The sample wears the Store outfit on the existing rig. Use its more
// detailed training mesh for the skin visible above and outside the hoodie.
export async function loadShowroomAthlete() {
  try {
    const bytes = await loadCombineAsset(url);
    const model = await new GLTFLoader().parseAsync(bytes.slice(0), '');
    const source = model.scene.getObjectByProperty('isSkinnedMesh', true) as Mesh;
    const geometry = source.geometry;
    const { position } = geometry.attributes;
    const index = geometry.index!;
    const material = source.material as MeshStandardMaterial;
    material.roughness = .85;
    material.metalness = 0;

    const rig = new Map<string, Object3D>();
    model.scene.traverse(node => rig.set(node.name.replace(':', ''), node));
    const arms = sides.map(side => {
      const elbow = rig.get('mixamorig' + side + 'ForeArm')!.getWorldPosition(new Vector3());
      const wrist = rig.get('mixamorig' + side + 'Hand')!.getWorldPosition(new Vector3());
      const cut = elbow.clone().lerp(wrist, .58);
      const direction = wrist.clone().sub(elbow).normalize();
      return { side, elbow, wrist, cut, direction, frame: armFrame(elbow, wrist).invert(), indices: [] as number[] };
    });

    const headIndices: number[] = [], point = new Vector3();
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      if (Math.min(position.getY(a), position.getY(b), position.getY(c)) >= 1.42) {
        headIndices.push(a, b, c);
        continue;
      }
      const arm = arms[position.getX(a) > 0 ? 0 : 1];
      const sign = arm.side === 'Left' ? 1 : -1;
      const beyondCuff = (vertex: number) => position.getX(vertex) * sign > .29 &&
        point.fromBufferAttribute(position, vertex).sub(arm.cut).dot(arm.direction) >= 0;
      if (beyondCuff(a) && beyondCuff(b) && beyondCuff(c)) arm.indices.push(a, b, c);
    }
    if (!headIndices.length || arms.some(arm => !arm.indices.length)) throw new Error('Showroom mesh parts are missing.');

    function makePart(indices: number[], name: string) {
      const part = new BufferGeometry();
      for (const key of ['position', 'normal', 'uv', 'tangent']) {
        const attribute = geometry.getAttribute(key);
        if (attribute) part.setAttribute(key, attribute);
      }
      part.setIndex(indices);
      const mesh = new Mesh(part, material);
      mesh.name = name;
      mesh.castShadow = true;
      return mesh;
    }

    const head = makePart(headIndices, 'Store sample high-detail head');
    head.scale.setScalar(1.85 / 1.7);
    head.position.z = .012;
    const forearms = arms.map(arm => ({ ...arm, mesh: makePart(arm.indices, 'Store sample ' + arm.side + ' hand') }));
    return {
      head,
      forearms,
      fitHands(root: Object3D) {
        root.updateMatrixWorld(true);
        for (const arm of forearms) {
          const elbow = root.getObjectByName('mixamorig' + arm.side + 'ForeArm')!.getWorldPosition(new Vector3());
          const wrist = root.getObjectByName('mixamorig' + arm.side + 'Hand')!.getWorldPosition(new Vector3());
          const scale = wrist.distanceTo(elbow) / arm.wrist.distanceTo(arm.elbow);
          arm.mesh.quaternion.setFromRotationMatrix(armFrame(elbow, wrist).multiply(arm.frame));
          arm.mesh.scale.setScalar(scale);
          arm.mesh.position.copy(arm.wrist).multiplyScalar(-scale).applyQuaternion(arm.mesh.quaternion).add(wrist);
        }
      },
      dispose() {
        for (const mesh of [head, ...forearms.map(arm => arm.mesh)]) mesh.geometry.dispose();
        for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
        material.dispose();
      },
    };
  } catch {
    invalidateCombineAsset(url);
    return null;
  }
}
