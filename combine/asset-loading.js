// Share downloaded bytes, not mutable Three.js models or textures.
const downloads = new Map();
export function loadCombineAsset(url, timeoutMs = 30000) {
  if (downloads.has(url)) return downloads.get(url);
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
      const response = await fetch(url, {signal: controller.signal, cache: 'force-cache'});
      if (!response.ok) throw new Error('Could not download the drill assets.');
      return response.arrayBuffer();
    })(),
    timeout,
  ]).catch(error => {
    downloads.delete(url); // A failed request must be retryable.
    throw error;
  }).finally(() => clearTimeout(timer));
  downloads.set(url, request);
  return request;
}
