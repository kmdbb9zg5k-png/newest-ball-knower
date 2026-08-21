import { ensureOnlineSession, supabase } from './supabase';

export async function loadUserState<T>(stateKey: string): Promise<T | null> {
  if (!supabase) return null;
  const user = await ensureOnlineSession();
  const { data, error } = await supabase
    .from('ball_knower_user_state')
    .select('value')
    .eq('user_id', user.id)
    .eq('state_key', stateKey)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as T | undefined) ?? null;
}

export async function saveUserState(stateKey: string, value: unknown): Promise<void> {
  if (!supabase) return;
  const user = await ensureOnlineSession();
  const { error } = await supabase.from('ball_knower_user_state').upsert({
    user_id: user.id,
    state_key: stateKey,
    value,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,state_key' });
  if (error) throw error;
}
