import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT'));

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function ensureOnlineSession(): Promise<User> {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;

  // Every browser gets one real Supabase identity. Anonymous users still use the
  // authenticated role, so league ownership can safely key off this UUID.
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error || !signed.user) {
    throw new Error(error?.message || 'Could not create online session.');
  }
  return signed.user;
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
