import assert from 'node:assert/strict';
import {createNightStadiumParts, installNightStadium, signMatrix, NIGHT_SIGN, SIGN_WIDTH, SIGN_HEIGHT} from '../public/play-moment-3d/night-stadium.js';
import {point, view} from '../public/play-moment-3d/renderer.js';

const parts = createNightStadiumParts();
assert.ok(parts.length <= 240, `Scenery budget exceeded: ${parts.length}`);
assert.equal(new Set(parts.map(p => p.id)).size, parts.length);
assert.deepEqual(parts, createNightStadiumParts(), 'Scenery must be deterministic');
assert.equal(SIGN_WIDTH * SIGN_HEIGHT * 4, 1024 * 1024, 'One MiB base texture budget');
assert.equal(parts.filter(p => p.texture === NIGHT_SIGN).length, 2);
for (const p of parts) {
  assert.ok(['cube', 'cylinder', 'plane'].includes(p.shape));
  assert.equal(p.matrix.length, 16);
  assert.ok([...p.matrix, ...p.color].every(Number.isFinite), p.id);
  assert.ok(p.color.every(v => v >= 0 && v <= 1), p.id);
  // New scenery stays off the playable field except pads on existing posts.
  if (p.shape === 'cube') {
    const m = p.matrix;
    const xExtent = (Math.abs(m[0]) + Math.abs(m[4]) + Math.abs(m[8])) / 2;
    const zExtent = (Math.abs(m[2]) + Math.abs(m[6]) + Math.abs(m[10])) / 2;
    assert.ok(Math.abs(m[12]) - xExtent > 26.6667 ||
      m[14] + zExtent < 0 || m[14] - zExtent > 120, `On-field scenery: ${p.id}`);
  }
}
for (const z of [-9.47, 129.47]) {
  const m = signMatrix(z), camera = view([0, 15, 60], [0, 15, z]);
  const tl = point(camera, point(m, [-.5, 0, -.5]));
  const tr = point(camera, point(m, [.5, 0, -.5]));
  const bl = point(camera, point(m, [-.5, 0, .5]));
  assert.ok(tl[0] < tr[0], `Mirrored board at ${z}`);
  assert.ok(tl[1] > bl[1], `Upside-down board at ${z}`);
}
const oldDocument = globalThis.document;
try {
  let uploads = 0;
  const renderer = {textures: new Map(), texture(name) {uploads++;this.textures.set(name, true);}};
  globalThis.document = {createElement() {return {getContext() {return new Proxy({}, {get(_o, key) {
    if (key === 'createLinearGradient') return () => ({addColorStop() {}});
    return () => {};
  }});}};}};
  installNightStadium(renderer, () => {});
  installNightStadium(renderer, () => {});
  assert.equal(uploads, 1, 'Same renderer must not allocate the sign twice');
  globalThis.document = {createElement() {return {getContext() {return null;}};}};
  const fallback = [];
  installNightStadium({textures: new Map(), texture() {assert.fail('No canvas to upload');}}, (...p) => fallback.push(p));
  assert.equal(fallback.length, parts.length - 2);
} finally {
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
}
console.log(`PASS: ${parts.length} static pieces, two upright boards, one cached texture, optional-canvas fallback, no on-field boxes.`);
