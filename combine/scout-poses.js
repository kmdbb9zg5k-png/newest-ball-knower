import {gunzipSync, strFromU8} from 'fflate';
import {loadCombineAsset, invalidateCombineAsset} from './asset-loading.js';

export const SCOUT_POSES_URL = '/play-moment-3d/assets/combine-scout-poses-v1.json.gz';

export function decodeScoutPoses(buffer) {
  const bytes = new Uint8Array(buffer);
  // Decode locally: scenery must work in WebViews without DecompressionStream.
  // Also accept bytes already decompressed by the host/browser.
  const poses = JSON.parse(strFromU8(bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes) : bytes));
  if (!Array.isArray(poses) || poses.length !== 4 || poses.some(pose =>
    !Array.isArray(pose.geometries) || !pose.geometries.length || pose.geometries.some(geometry => {
      const position = geometry?.data?.attributes?.position;
      return position?.itemSize !== 3 || !Array.isArray(position.array) ||
        !position.array.length || position.array.length % 3 || !position.array.every(Number.isFinite);
    }))) throw new Error('Invalid Combine scout poses.');
  return poses;
}

export async function loadScoutPoses(timeoutMs = 8000) {
  let failure;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return decodeScoutPoses(await loadCombineAsset(SCOUT_POSES_URL, timeoutMs)); }
    catch (error) {
      failure = error;
      // This includes decoding/validation failures, not just HTTP failures.
      invalidateCombineAsset(SCOUT_POSES_URL);
    }
  }
  throw failure;
}
