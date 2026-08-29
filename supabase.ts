import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY,
  BALL_KNOWER_SUPABASE_URL,
} from './supabaseDefaults';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || BALL_KNOWER_SUPABASE_URL;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY;

export const isCloudConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT'));

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export type PermanentAuthProvider = 'google' | 'apple';
export type AuthProviderAvailability = Record<PermanentAuthProvider, boolean>;

export async function fetchAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  if (!url || !key) return { google: false, apple: false };
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!response.ok) throw new Error(`Auth settings returned ${response.status}`);
    const settings = await response.json() as { external?: Partial<Record<PermanentAuthProvider, boolean>> };
    return { google: Boolean(settings.external?.google), apple: Boolean(settings.external?.apple) };
  } catch (error) {
    console.warn('Could not verify social sign-in availability', error);
    return { google: false, apple: false };
  }
}

let pendingAnonymousSession: Promise<User> | null = null;

export async function ensureOnlineSession(): Promise<User> {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;
  if (pendingAnonymousSession) return pendingAnonymousSession;

  // Share one in-flight anonymous signup so concurrent callers cannot create
  // competing guest UUIDs and drift league ownership from the visible profile.
  pendingAnonymousSession = (async () => {
    const { data: signed, error } = await supabase.auth.signInAnonymously();
    if (error || !signed.user) {
      throw new Error(error?.message || 'Could not create online session.');
    }
    return signed.user;
  })();

  try {
    return await pendingAnonymousSession;
  } finally {
    pendingAnonymousSession = null;
  }
}

export async function attachEmailToAnonymousUser(email: string, displayName?: string): Promise<User> {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  const current = await ensureOnlineSession();
  if (!current.is_anonymous) {
    throw new Error('This account already has a permanent sign-in identity.');
  }

  const data = displayName?.trim()
    ? { full_name: displayName.trim(), name: displayName.trim() }
    : undefined;
  const { data: updated, error } = await supabase.auth.updateUser({
    email: email.trim().toLowerCase(),
    data,
  });
  if (error || !updated.user) {
    throw new Error(error?.message || 'Could not attach that email to this guest account.');
  }
  return updated.user;
}

export async function sendEmailMagicLink(email: string, displayName?: string): Promise<void> {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
      data: displayName?.trim() ? { full_name: displayName.trim(), name: displayName.trim() } : undefined,
    },
  });
  if (error) throw new Error(error.message || 'Could not send the sign-in email.');
}

export async function signOutOnline(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message || 'Could not sign out.');
}
