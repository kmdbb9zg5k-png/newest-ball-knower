import assert from 'node:assert/strict';
import {
  PROFILE_PHOTO_MAX_UPLOAD_BYTES,
  PROFILE_PHOTO_OUTPUT_EXTENSION,
  PROFILE_PHOTO_OUTPUT_MIME,
  PROFILE_PHOTO_OUTPUT_SIZE,
  canvasToProfilePhoto,
  drawSquareProfileImage,
  isSupportedProfilePhotoFile,
  removeAndCommitProfilePhoto,
  uploadAndCommitProfilePhoto,
  validateProcessedProfilePhoto,
  validateProfilePhotoFile,
  type ProcessedProfilePhoto,
} from '../profilePhoto';

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const validBlob = new Blob([jpegBytes], { type: PROFILE_PHOTO_OUTPUT_MIME });
const validPhoto: ProcessedProfilePhoto = {
  blob: validBlob,
  mimeType: PROFILE_PHOTO_OUTPUT_MIME,
  extension: PROFILE_PHOTO_OUTPUT_EXTENSION,
  width: PROFILE_PHOTO_OUTPUT_SIZE,
  height: PROFILE_PHOTO_OUTPUT_SIZE,
};

const makeCanvas = (blob = validBlob) => {
  let requestedType = '';
  let requestedQuality: number | undefined;
  const canvas = {
    width: PROFILE_PHOTO_OUTPUT_SIZE,
    height: PROFILE_PHOTO_OUTPUT_SIZE,
    toBlob(callback: BlobCallback, type?: string, quality?: number) {
      requestedType = type || '';
      requestedQuality = quality;
      callback(blob);
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, requested: () => ({ type: requestedType, quality: requestedQuality }) };
};

for (const source of [
  { name: 'camera.jpeg', type: 'image/jpeg' },
  { name: 'library.png', type: 'image/png' },
  { name: 'portrait.HEIC', type: 'image/heic' },
  { name: 'portrait.HEIF', type: 'image/heif' },
  { name: 'ios-provider.heic', type: '' },
]) {
  assert.equal(isSupportedProfilePhotoFile(source), true, `${source.name} must reach the native/browser decoder`);
}

const largeIphonePhoto = new File(
  [new Uint8Array(18 * 1024 * 1024)],
  'IMG_9001.HEIC',
  { type: 'image/heic' },
);
assert.doesNotThrow(() => validateProfilePhotoFile(largeIphonePhoto), 'a large iPhone original must be validated as a source, not as the final upload');

const encoded = makeCanvas();
const processed = await canvasToProfilePhoto(encoded.canvas);
assert.equal(processed.width, 512);
assert.equal(processed.height, 512);
assert.equal(processed.mimeType, 'image/jpeg');
assert.equal(processed.extension, 'jpg');
assert.ok(processed.blob.size < PROFILE_PHOTO_MAX_UPLOAD_BYTES);
assert.deepEqual(encoded.requested(), { type: 'image/jpeg', quality: 0.84 });
await validateProcessedProfilePhoto(processed);

const drawCalls: number[][] = [];
const orientedPortraitCanvas = {
  width: 0,
  height: 0,
  getContext: () => ({
    clearRect: () => undefined,
    drawImage: (_image: CanvasImageSource, left: number, top: number, width: number, height: number) => drawCalls.push([left, top, width, height]),
  }),
} as unknown as HTMLCanvasElement;
const decodedPortrait = { naturalWidth: 3024, naturalHeight: 4032 } as HTMLImageElement;
drawSquareProfileImage(orientedPortraitCanvas, decodedPortrait, { zoom: 1, x: 50, y: 50 });
assert.equal(orientedPortraitCanvas.width, 512);
assert.equal(orientedPortraitCanvas.height, 512);
assert.ok(drawCalls[0][3] > drawCalls[0][2], 'decoded portrait orientation must remain portrait when drawn');
assert.ok(drawCalls[0][1] < 0, 'portrait crop must center vertically');

drawSquareProfileImage(orientedPortraitCanvas, decodedPortrait, { zoom: 2, x: 100, y: 0 });
assert.ok(drawCalls[1][0] < drawCalls[0][0], 'Left / Right positioning must affect the crop');
assert.equal(Math.abs(drawCalls[1][1]), 0, 'Up / Down positioning must affect the crop');
assert.ok(drawCalls[1][2] > drawCalls[0][2], 'Zoom must affect the crop');

const corruptPhoto: ProcessedProfilePhoto = {
  ...validPhoto,
  blob: new Blob([new TextEncoder().encode('not-a-jpeg')], { type: 'image/jpeg' }),
};
await assert.rejects(validateProcessedProfilePhoto(corruptPhoto), /not a valid JPEG/);
await assert.rejects(validateProcessedProfilePhoto({ ...validPhoto, extension: 'png' as 'jpg' }), /invalid or too large/);
await assert.rejects(validateProcessedProfilePhoto({ ...validPhoto, blob: new Blob([jpegBytes], { type: 'image/png' }) }), /invalid or too large/);
await assert.rejects(validateProcessedProfilePhoto({
  ...validPhoto,
  blob: new Blob([jpegBytes, new Uint8Array(PROFILE_PHOTO_MAX_UPLOAD_BYTES)], { type: 'image/jpeg' }),
}), /invalid or too large/);

let avatar = { url: 'https://example.com/old.webp', path: 'owner/old.webp' };
const commit = (url?: string, path?: string) => { avatar = { url: url || '', path: path || '' }; };
await assert.rejects(
  uploadAndCommitProfilePhoto(validPhoto, avatar.path, commit, async () => { throw new Error('upload failed'); }),
  /upload failed/,
);
assert.deepEqual(avatar, { url: 'https://example.com/old.webp', path: 'owner/old.webp' }, 'upload failure must retain the previous avatar');

await uploadAndCommitProfilePhoto(validPhoto, avatar.path, commit, async photo => {
  await validateProcessedProfilePhoto(photo);
  return { avatarUrl: 'https://example.com/new.jpg', avatarPath: 'owner/new.jpg' };
});
assert.deepEqual(avatar, { url: 'https://example.com/new.jpg', path: 'owner/new.jpg' }, 'Change Photo must commit only after upload succeeds');

await assert.rejects(
  removeAndCommitProfilePhoto(avatar.path, commit, async () => { throw new Error('remove failed'); }),
  /remove failed/,
);
assert.deepEqual(avatar, { url: 'https://example.com/new.jpg', path: 'owner/new.jpg' }, 'failed removal must retain the avatar');
await removeAndCommitProfilePhoto(avatar.path, commit, async () => undefined);
assert.deepEqual(avatar, { url: '', path: '' }, 'Remove Photo must clear the avatar only after removal succeeds');

console.log('Profile photo crop/save regressions passed: iPhone sources, 512px JPEG output, orientation/crop controls, validation, upload rollback, change, and removal.');
