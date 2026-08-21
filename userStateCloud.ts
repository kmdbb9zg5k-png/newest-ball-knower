import { ensureOnlineSession, supabase } from './supabase';

export type UserStateRow<T = unknown> = {
  state_key: string;
  value: T;
  updated_at: string;
};

export async function loadUserStates<T = unknown>(stateKeys: string[]): Promise<UserStateRow<T>[]> {
  if (!supabase || stateKeys.length === 0) return [];
  await ensureOnlineSession();
  const { data, error } = await supabase
    .from('ball_knower_user_state')
    .select('state_key,value,updated_at')
    .in('state_key', stateKeys);
  if (error) throw error;
  return (data ?? []) as UserStateRow<T>[];
}

export async function saveUserStates(entries: Array<{ stateKey: string; value: unknown }>): Promise<UserStateRow[]> {
  if (!supabase || entries.length === 0) return [];
  const user = await ensureOnlineSession();
  const { data, error } = await supabase.from('ball_knower_user_state').upsert(
    entries.map(entry => ({
      user_id: user.id,
      state_key: entry.stateKey,
      value: entry.value,
    })),
    { onConflict: 'user_id,state_key' },
  ).select('state_key,value,updated_at');
  if (error) throw error;
  return (data ?? []) as UserStateRow[];
}

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
  }, { onConflict: 'user_id,state_key' });
  if (error) throw error;
}
