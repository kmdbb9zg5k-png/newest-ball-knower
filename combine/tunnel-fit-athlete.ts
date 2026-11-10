import { Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { invalidateCombineAsset, loadCombineAsset } from './asset-loading.js';

const url = '/store/tunnel-fit-athlete-v1.glb';
const sampleHeight = 1.83;

export async function loadTunnelFitAthlete() {
  try {
    const bytes = await loadCombineAsset(url);
    const { scene: model } = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(bytes, '');

    const bounds = new Box3().setFromObject(model, true);
    const scale = sampleHeight / (bounds.max.y - bounds.min.y);
    const center = bounds.getCenter(model.position.clone());
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    model.traverse(object => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        // The baked normal map provides the cloth relief. Keep reflected
        // light soft on the skin and graphite fleece.
        if (object.material instanceof MeshStandardMaterial) {
          object.material.metalness = .12;
          object.material.roughness = .9;
        }
      }
    });

    const root = new Group();
    root.add(model);
    return root;
  } catch {
    invalidateCombineAsset(url);
    return null;
  }
}
