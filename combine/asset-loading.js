// Share downloaded bytes, not mutable Three.js models or textures.
const downloads = new Map();
const refresh = new Set();
export function invalidateCombineAsset(url) {
  downloads.delete(url);
  refresh.add(url);
}
function validateAsset(url, bytes) {
  // A captive portal, stale cache or truncated 200 response must not be kept
  // forever as a successful model download.
  if (/\.glb(?:[?#]|$)/.test(url)) {
    const header = new DataView(bytes);
    if (bytes.byteLength < 12 || header.getUint32(0, true) !== 0x46546c67 ||
        header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength) {
      throw new Error('The athlete download was incomplete or invalid. Please retry.');
    }
  }
  if (!bytes.byteLength) throw new Error('The drill download was empty. Please retry.');
  return bytes;
}
export function loadCombineAsset(url, timeoutMs = 30000) {
  if (downloads.has(url)) return downloads.get(url);
  const cache = refresh.has(url) ? 'reload' : 'force-cache';
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('The drill download timed out. Please retry.'));
    }, timeoutMs);
  });
  const request = Promise.race([
    (async () => {
      const response = await fetch(url, {signal: controller.signal, cache});
      if (!response.ok) throw new Error('Could not download the drill assets.');
      const bytes = validateAsset(url, await response.arrayBuffer());
      refresh.delete(url);
      return bytes;
    })(),
    timeout,
  ]).catch(error => {
    invalidateCombineAsset(url); // Retry bypasses the failed browser cache entry too.
    throw error;
  }).finally(() => clearTimeout(timer));
  downloads.set(url, request);
  return request;
}
