import { Box3, Group, LinearFilter, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { invalidateCombineAsset, loadCombineAsset } from './asset-loading.js';

export const showroomModelUrl = (gold = false) => gold ? '/store/gold-standard-athlete-v1.glb' : '/store/tunnel-fit-athlete-v1.glb';
const sampleHeight = 1.83;

export async function loadTunnelFitAthlete(gold = false) {
  const url = showroomModelUrl(gold);
  try {
    const bytes = await loadCombineAsset(url);
    const { scene: model } = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(bytes, '');

    // The original Gold Standard GLB contains four 4096px WebP maps.
    // On iPhone WebKit, those expand to hundreds of MB on the GPU and can kill
    // the entire in-app browser. Downscale only the in-memory textures while
    // retaining the original geometry, UVs, materials and full 360-degree rig.
    const mobileShowroom = gold && typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches);
    if (mobileShowroom) {
      const originals = new Set<ImageBitmap>();
      const resized = new Map<TexImageSource, HTMLCanvasElement>();
      const converted = new Set<Texture>();
      model.traverse(object => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          for (const value of Object.values(material)) {
            if (!(value instanceof Texture) || converted.has(value)) continue;
            converted.add(value);
            const image = value.image as TexImageSource & { width?: number; height?: number; close?: () => void };
            const width = image?.width ?? 0, height = image?.height ?? 0;
            if (Math.max(width, height) <= 1024 || !width || !height) continue;
            try {
              let canvas = resized.get(image);
              if (!canvas) {
                const scale = 1024 / Math.max(width, height);
                canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                const context = canvas.getContext('2d', { alpha: true });
                if (!context) continue;
                context.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
                resized.set(image, canvas);
                if (typeof image.close === 'function') originals.add(image as ImageBitmap);
              }
              value.image = canvas;
              value.generateMipmaps = false;
              value.minFilter = LinearFilter;
              value.magFilter = LinearFilter;
              value.needsUpdate = true;
            } catch {
              // Keep the original texture when mobile canvas allocation fails.
            }
          }
        }
      });
      // Every referencing material has been redirected to the resized canvas.
      for (const image of originals) image.close();
    }

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
          if (!gold) object.material.metalness = .12;
          if (!gold) object.material.roughness = .9;
          if (gold) {
            // Preserve original geometry, UVs and textures while enabling direct-light response.
            object.material.metalness = Math.min(object.material.metalness, .42);
            object.material.roughness = Math.max(object.material.roughness, .36);
            object.material.needsUpdate = true;
          }
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
