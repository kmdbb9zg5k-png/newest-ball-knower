import { Box3, Group, LinearFilter, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { unzip } from 'fflate';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { invalidateCombineAsset, loadCombineAsset } from './asset-loading.js';

// This URL hosts the verified, user-provided repair archive. The original Gold Standard
// GLB remains in public/store as a rollback. Only the preview branch uses this candidate.
const goldHeadArchiveUrl = 'https://v3b.fal.media/files/b/0ab1f0eb/Dkg7YQDQk3kVcEHuLp8i5_GoldHeadFix%281%29.zip';
const goldHeadArchiveEntry = 'Gold-Standard-Head-Candidate.glb';
const goldHeadExpectedBytes = 28013080;
export const showroomModelUrl = (gold = false) => gold ? goldHeadArchiveUrl : '/store/tunnel-fit-athlete-v1.glb';

async function unpackGoldHeadCandidate(zipBytes: ArrayBuffer): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    unzip(new Uint8Array(zipBytes), {filter: file => file.name === goldHeadArchiveEntry}, (error, files) => {
      if (error) { reject(error); return; }
      const glb = files[goldHeadArchiveEntry];
      if (!glb || glb.byteLength !== goldHeadExpectedBytes) {
        reject(new Error('The Gold Standard repair archive contains a missing or incomplete 3D model.'));
        return;
      }
      const head = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
      if (head.getUint32(0, true) !== 0x46546c67 || head.getUint32(4, true) !== 2 ||
          head.getUint32(8, true) !== glb.byteLength) {
        reject(new Error('The Gold Standard repair model failed GLB validation.'));
        return;
      }
      // Isolate the GLB from the ZIP worker's backing store before parsing.
      const modelBytes = new Uint8Array(glb.byteLength);
      modelBytes.set(glb);
      resolve(modelBytes.buffer);
    });
  });
}
const sampleHeight = 1.83;

export async function loadTunnelFitAthlete(gold = false) {
  const url = showroomModelUrl(gold);
  try {
    const archiveOrGlb = await loadCombineAsset(url, gold ? 90000 : 30000);
    const bytes = gold ? await unpackGoldHeadCandidate(archiveOrGlb) : archiveOrGlb;
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
            const texture = value as Texture;
            const image = texture.image as TexImageSource & { width?: number; height?: number; close?: () => void };
            const width = image?.width ?? 0, height = image?.height ?? 0;
            const preserveSkinColor = material instanceof MeshStandardMaterial &&
              (material.name === 'Original athlete skin' || material.name === 'BakedMaterial') && value === material.map;
            if (Math.max(width, height) <= (preserveSkinColor ? 2048 : 1024) || !width || !height) continue;
            try {
              let canvas = resized.get(image);
              if (!canvas) {
                // Eyes and facial detail are baked into the original skin albedo.
                // Keep its color map at 2K on phones; 1K blurred the irises,
                // while all other large maps stay at the 1K mobile memory limit.
                const skinColor = material instanceof MeshStandardMaterial &&
                  (material.name === 'Original athlete skin' || material.name === 'BakedMaterial') && value === material.map;
                const edge = skinColor ? 2048 : 1024;
                const scale = edge / Math.max(width, height);
                canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                const context = canvas.getContext('2d', { alpha: true });
                if (!context) continue;
                context.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
                resized.set(image, canvas);
                if (typeof image.close === 'function') originals.add(image as ImageBitmap);
              }
              texture.image = canvas;
              texture.generateMipmaps = false;
              texture.minFilter = LinearFilter;
              texture.magFilter = LinearFilter;
              texture.needsUpdate = true;
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
            // Gold outfit and facial skin use different primitives in the original GLB.
            // Skin must stay matte/nonmetallic; otherwise the strong outfit lights
            // blow out its baked eye texture and make the eyes appear blank.
            if (object.material.name === 'Original athlete skin' || object.material.name === 'BakedMaterial') {
              object.material.metalness = 0;
              object.material.roughness = .91;
              object.material.normalScale.set(.52, .52);
              object.material.color.multiplyScalar(.88);
            } else {
              // The recovered Gold Standard GLB has a glossy metallic-roughness
              // texture: its green roughness channel averages ~0.46, which is
              // multiplied by the material's roughnessFactor. It makes even
              // high-roughness hoodie fabric look wet and plastic.
              //
              // Keep its base-color/normal textures, UVs and geometry intact,
              // but disable metallic-roughness maps on the clothing surface.
              // The resulting soft sheen reads as athletic tracksuit fabric.
              object.material.roughnessMap = null;
              object.material.metalnessMap = null;
              object.material.roughness = .86;
              object.material.metalness = .035;
              object.material.envMapIntensity = .18;
            }
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
