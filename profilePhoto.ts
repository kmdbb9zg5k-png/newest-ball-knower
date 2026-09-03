import type { User } from '@supabase/supabase-js';
import { ensureOnlineSession, supabase } from './supabase';

export const PROFILE_PHOTO_BUCKET = 'ball-knower-avatars';
let profilePhotoMutationVersion = 0;

export const getProfilePhotoMutationVersion = () => profilePhotoMutationVersion;
export const invalidateProfilePhotoReads = () => { profilePhotoMutationVersion += 1; };
export const PROFILE_PHOTO_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const PROFILE_PHOTO_OUTPUT_SIZE = 512;
export const PROFILE_PHOTO_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const ACCEPTED_SOURCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

type StoredProfilePhoto = { avatar_path: string | null };

export type ProfilePhotoOverride = {
  hasOverride: boolean;
  avatarPath?: string;
  avatarUrl?: string;
};

export type AvatarCrop = { zoom: number; x: number; y: number };

export function profilePhotoPublicUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  if (!supabase) return undefined;
  return supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl || undefined;
}

export function validateProfilePhotoFile(file: File): void {
  if (!ACCEPTED_SOURCE_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
  }
  if (file.size <= 0 || file.size > PROFILE_PHOTO_MAX_SOURCE_BYTES) {
    throw new Error('Choose a photo smaller than 12 MB.');
  }
}

export async function loadMyProfilePhoto(): Promise<ProfilePhotoOverride> {
  if (!supabase) return { hasOverride: false };
  const auth = await ensureOnlineSession();
  const { data, error } = await supabase
    .from('ball_knower_user_profiles')
    .select('avatar_path')
    .eq('auth_user_id', auth.id)
    .maybeSingle<StoredProfilePhoto>();
  if (error) throw error;
  if (!data) return { hasOverride: false };
  const avatarPath = data.avatar_path || undefined;
  return { hasOverride: true, avatarPath, avatarUrl: profilePhotoPublicUrl(avatarPath) };
}

export async function resolveProfilePhotoForAuthUser(user: User): Promise<ProfilePhotoOverride> {
  const metadata = user.user_metadata || {};
  const metadataPath = typeof metadata.ball_knower_avatar_path === 'string'
    ? metadata.ball_knower_avatar_path
    : undefined;
  const metadataRemoved = metadata.ball_knower_avatar_removed === true;
  const metadataOverride: ProfilePhotoOverride = metadataPath
    ? { hasOverride: true, avatarPath: metadataPath, avatarUrl: profilePhotoPublicUrl(metadataPath) }
    : metadataRemoved
      ? { hasOverride: true }
      : { hasOverride: false };
  try {
    return await loadMyProfilePhoto();
  } catch (error) {
    console.warn('Profile photo record could not be loaded; using account metadata.', error);
    return metadataOverride;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That photo could not be opened. Try another image.'));
    };
    image.src = url;
  });
}

export async function drawSquareProfilePhoto(
  canvas: HTMLCanvasElement,
  file: File,
  crop: AvatarCrop,
  outputSize = PROFILE_PHOTO_OUTPUT_SIZE,
): Promise<void> {
  validateProfilePhotoFile(file);
  const image = await loadImage(file);
  drawSquareProfileImage(canvas, image, crop, outputSize);
}

export function drawSquareProfileImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: AvatarCrop,
  outputSize = PROFILE_PHOTO_OUTPUT_SIZE,
): void {
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo editing is unavailable on this device.');

  const zoom = Math.max(1, Math.min(3, crop.zoom));
  const positionX = Math.max(0, Math.min(100, crop.x)) / 100;
  const positionY = Math.max(0, Math.min(100, crop.y)) / 100;
  const scale = Math.max(outputSize / image.naturalWidth, outputSize / image.naturalHeight) * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const left = -(width - outputSize) * positionX;
  const top = -(height - outputSize) * positionY;

  context.clearRect(0, 0, outputSize, outputSize);
  context.drawImage(image, left, top, width, height);
}

export function canvasToProfilePhoto(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Photo compression failed. Try another image.'));
        return;
      }
      if (blob.size > PROFILE_PHOTO_MAX_UPLOAD_BYTES) {
        reject(new Error('The edited photo is still too large. Try a closer crop.'));
        return;
      }
      resolve(blob);
    }, 'image/webp', 0.84);
  });
}

async function setProfilePhotoPath(path: string | null): Promise<void> {
  if (!supabase) throw new Error('Profile photos require online services.');
  const { error } = await supabase.rpc('set_ball_knower_profile_photo', { p_avatar_path: path });
  if (error) throw error;
}

async function updatePhotoMetadata(path: string | null): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({
    data: {
      ball_knower_avatar_path: path,
      ball_knower_avatar_removed: path === null,
    },
  });
  if (error) console.warn('Profile photo metadata mirror could not be updated.', error);
}

export async function uploadProfilePhoto(blob: Blob, oldPath?: string): Promise<{ avatarPath: string; avatarUrl: string }> {
  if (!supabase) throw new Error('Profile photos require online services.');
  if (blob.type !== 'image/webp' || blob.size <= 0 || blob.size > PROFILE_PHOTO_MAX_UPLOAD_BYTES) {
    throw new Error('The edited profile photo is invalid or too large.');
  }
  const auth = await ensureOnlineSession();
  if (auth.is_anonymous) throw new Error('Sign in to save a profile photo to your account.');
  const avatarPath = `${auth.id}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(avatarPath, blob, { cacheControl: '31536000', contentType: 'image/webp', upsert: false });
  if (uploadError) throw uploadError;

  try {
    await setProfilePhotoPath(avatarPath);
  } catch (error) {
    await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([avatarPath]).catch(() => undefined);
    throw error;
  }

  await updatePhotoMetadata(avatarPath);
  if (oldPath && oldPath !== avatarPath) {
    const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([oldPath]);
    if (error) console.warn('Previous profile photo cleanup will be retried on a future change.', error);
  }
  const avatarUrl = profilePhotoPublicUrl(avatarPath);
  if (!avatarUrl) throw new Error('The profile photo saved, but its public URL could not be created.');
  return { avatarPath, avatarUrl };
}

export async function removeProfilePhoto(oldPath?: string): Promise<void> {
  if (!supabase) throw new Error('Profile photos require online services.');
  const auth = await ensureOnlineSession();
  if (auth.is_anonymous) throw new Error('Sign in to change your account photo.');
  await setProfilePhotoPath(null);
  await updatePhotoMetadata(null);
  if (oldPath) {
    const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([oldPath]);
    if (error) console.warn('Removed profile photo record; old object cleanup did not complete.', error);
  }
}
