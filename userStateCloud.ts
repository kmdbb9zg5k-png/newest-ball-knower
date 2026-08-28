import { ensureOnlineSession, supabase } from './supabase';
import type { GauntletProgressEvent } from './gauntletEngine';

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

export async function loadGauntletProgressEvents(): Promise<GauntletProgressEvent[]> {
  if (!supabase) return [];
  const user = await ensureOnlineSession();
  const { data, error } = await supabase
    .from('ball_knower_gauntlet_progress_events')
    .select('payload')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => row.payload as GauntletProgressEvent);
}

export async function saveGauntletProgressEvents(events: GauntletProgressEvent[]): Promise<void> {
  if (!supabase || events.length === 0) return;
  const user = await ensureOnlineSession();
  for (let index = 0; index < events.length; index += 250) {
    const rows = events.slice(index, index + 250).map(event => ({
      user_id: user.id,
      event_id: event.id,
      occurred_at: new Date(event.occurredAt).toISOString(),
      payload: event,
    }));
    const { error } = await supabase.from('ball_knower_gauntlet_progress_events').upsert(rows, { onConflict: 'user_id,event_id', ignoreDuplicates: true });
    if (error) throw error;
  }
}
