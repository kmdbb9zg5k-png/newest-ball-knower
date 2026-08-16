import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT'));

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function ensureOnlineSession() {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;

  // Invite codes work without forcing an account-creation screen.
  // Supabase Anonymous Sign-Ins must be enabled in Auth settings.
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error || !signed.user) {
    throw new Error(error?.message || 'Could not create online session.');
  }
  return signed.user;
}
