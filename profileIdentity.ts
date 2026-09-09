import type { User } from '@supabase/supabase-js';
import { ensureOnlineSession, supabase } from './supabase';

export const GM_DISPLAY_NAME_MIN_LENGTH = 2;
export const GM_DISPLAY_NAME_MAX_LENGTH = 40;

const PLACEHOLDER_GM_NAMES = new Set([
  'ball knower',
  'ball knower guest',
  'ball knower gm',
  'fantasy gm',
  'guest',
  'guest gm',
]);

export function normalizeGmDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isPlaceholderGmName(value?: string | null): boolean {
  const normalized = normalizeGmDisplayName(value || '').toLowerCase();
  return !normalized || PLACEHOLDER_GM_NAMES.has(normalized);
}

export function validateGmDisplayName(value: string): string {
  const normalized = normalizeGmDisplayName(value);
  if (normalized.length < GM_DISPLAY_NAME_MIN_LENGTH) throw new Error('Enter a GM name with at least 2 characters.');
  if (normalized.length > GM_DISPLAY_NAME_MAX_LENGTH) throw new Error('Keep your GM name to 40 characters or fewer.');
  if (/[\u0000-\u001f\u007f]/.test(normalized)) throw new Error('Your GM name cannot contain control characters.');
  return normalized;
}

export function guestGmName(userId: string): string {
  const suffix = userId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'ROOKIE';
  return `Guest GM ${suffix}`;
}

export function resolveAuthDisplayName(user: Pick<User, 'id' | 'email' | 'is_anonymous' | 'user_metadata'>, localName?: string): string {
  const metadata = user.user_metadata || {};
  const candidates = [metadata.full_name, metadata.name, localName];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || isPlaceholderGmName(candidate)) continue;
    return normalizeGmDisplayName(candidate).slice(0, GM_DISPLAY_NAME_MAX_LENGTH);
  }
  if (user.is_anonymous) return guestGmName(user.id);
  const emailName = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ');
  return emailName && !isPlaceholderGmName(emailName)
    ? normalizeGmDisplayName(emailName).slice(0, GM_DISPLAY_NAME_MAX_LENGTH)
    : 'Ball Knower GM';
}

export async function saveProfileDisplayName(value: string): Promise<User> {
  if (!supabase) throw new Error('Profile customization requires online services.');
  const displayName = validateGmDisplayName(value);
  const current = await ensureOnlineSession();

  const projection = await supabase.rpc('set_ball_knower_profile_name', { p_display_name: displayName });
  if (projection.error) throw new Error(projection.error.message || 'Could not update your league identity.');

  try {
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: displayName, name: displayName },
    });
    if (error) throw error;
    return data.user || current;
  } catch (error) {
    // The UUID-owned database projection is authoritative. Do not report a
    // failed save after it committed just because the Auth metadata mirror had
    // a transient failure; bootstrap will retry the mirror on the next visit.
    console.warn('GM name saved, but Auth profile metadata could not be mirrored yet.', error);
    return current;
  }
}
