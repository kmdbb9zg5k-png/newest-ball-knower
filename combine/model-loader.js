import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function combineModelLoader(textureLimit) {
  const loader = new GLTFLoader();
  if (!textureLimit) return loader;
  return loader.register(parser => {
    const loadImage = parser.loadImageSource.bind(parser);
    let pending = Promise.resolve();
    // Decode one source at a time so iOS doesn't hold every full-size image
    // while resizing. GLTFLoader owns the source cache and texture metadata.
    parser.loadImageSource = (index, imageLoader) => {
      const result = pending.then(async () => {
        const texture = await loadImage(index, imageLoader);
        const image = texture.image;
        const scale = textureLimit / Math.max(image.width, image.height);
        if (scale >= 1) return texture;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return texture;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        texture.image = canvas;
        texture.needsUpdate = true;
        image.close?.();
        return texture;
      });
      pending = result.then(() => {}, () => {});
      return result;
    };
    return { name: 'BK_combine_texture_budget' };
  });
}
