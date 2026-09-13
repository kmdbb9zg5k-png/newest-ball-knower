/** Shared, retryable image requests; ordinary Solo viewing never calls a generation service. */
export function createSoloImageLoader({
  createImage = () => new Image(),
  timeoutMs = 15_000,
}: { createImage?: () => HTMLImageElement; timeoutMs?: number } = {}) {
  const images = new Map<string, Promise<HTMLImageElement>>();
  return function loadImage(path: string): Promise<HTMLImageElement> {
    const cached = images.get(path);
    if (cached) return cached;
    const request = new Promise<HTMLImageElement>((resolve, reject) => {
      let image: HTMLImageElement;
      try { image = createImage(); } catch (error) { reject(error); return; }
      let settled = false;
      const timer = setTimeout(() => finish(new Error('Player artwork request timed out.')), timeoutMs);
      function finish(error?: Error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        if (error) {
          // Stop the stalled request after detaching handlers; a later Retry creates a fresh image.
          image.removeAttribute('src');
          reject(error);
        } else resolve(image);
      }
      image.decoding = 'async';
      image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0
        ? undefined : new Error('Player artwork has no usable pixels.'));
      image.onerror = () => finish(new Error('Player artwork could not be loaded.'));
      try { image.src = path; } catch { finish(new Error('Player artwork could not be loaded.')); }
    });
    images.set(path, request);
    // Failed promises must not poison Retry. Do not evict a newer request for the same URL.
    request.catch(() => { if (images.get(path) === request) images.delete(path); });
    return request;
  };
}

// Only shared local artwork paths are passed here, not a per-player bitmap cache.
export const loadSoloImage = createSoloImageLoader();
