import { Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { invalidateCombineAsset, loadCombineAsset } from './asset-loading.js';

const url = '/play-moment-3d/assets/combine-training-athlete-v1.glb';

// The sample wears the Store outfit on its original rig. Fit the head and
// neck from the higher-resolution training model above the hoodie's neckline.
export async function loadShowroomHead() {
  try {
    const bytes = await loadCombineAsset(url);
    const model = await new GLTFLoader().parseAsync(bytes.slice(0), '');
    const source = model.scene.getObjectByProperty('isSkinnedMesh', true) as Mesh;
    const geometry = source.geometry;
    const { position } = geometry.attributes;
    const index = geometry.index!;
    const triangles: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      if (Math.min(position.getY(a), position.getY(b), position.getY(c)) >= 1.42) triangles.push(a, b, c);
    }
    geometry.setIndex(triangles);
    const material = source.material as MeshStandardMaterial;
    material.roughness = .85;
    material.metalness = 0;
    const head = new Mesh(geometry, material);
    head.name = 'Store sample high-detail head';
    head.scale.setScalar(1.85 / 1.7);
    head.position.z = .012;
    head.castShadow = true;
    return head;
  } catch {
    invalidateCombineAsset(url);
    return null;
  }
}
