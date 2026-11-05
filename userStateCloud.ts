import { ensureOnlineSession, supabase } from './supabase';
import type { GauntletProgressEvent } from './gauntletEngine';
import { requireExpectedUser } from './expectedUser';

export type UserStateRow<T = unknown> = {
  state_key: string;
  value: T;
  updated_at: string;
};

const OWNER_STATE_KEY = 'owner_business_career_v1';
export const AGENT_PENDING_SIGNING_KEY = 'ballknower_player_agent_signing_pending_v1';
export const AGENT_PENDING_RECRUIT_ACTION_KEY = 'ballknower_player_agent_recruit_action_v1';
const ACCOUNT_BOUND_WRITE_TIMEOUT_MS = 12_000;
const pendingUserStateWrites = new Set<Promise<unknown>>();

function trackUserStateWrite<T>(write: Promise<T>): Promise<T> {
  pendingUserStateWrites.add(write);
  void write.finally(() => pendingUserStateWrites.delete(write)).catch(() => undefined);
  return write;
}

export async function flushPendingUserStateWrites(): Promise<void> {
  while (pendingUserStateWrites.size > 0) {
    await Promise.all([...pendingUserStateWrites]);
  }
}

async function tokenForExpectedUser(expectedUserId: string): Promise<string> {
  const {data, error} = await supabase!.auth.getSession();
  if (error) throw error;
  requireExpectedUser(data.session?.user.id ?? '', expectedUserId);
  if (!data.session?.access_token) throw new Error('Your session expired. Sign in again.');
  return data.session.access_token;
}

export async function loadUserStates<T = unknown>(stateKeys: string[], expectedUserId?: string): Promise<UserStateRow<T>[]> {
  if (!supabase || stateKeys.length === 0) return [];
  const user = await ensureOnlineSession();
  const userId = requireExpectedUser(user.id, expectedUserId);
  const { data, error } = await supabase
    .from('ball_knower_user_state')
    .select('state_key,value,updated_at')
    .eq('user_id', userId)
    .in('state_key', stateKeys)
    .abortSignal(AbortSignal.timeout(ACCOUNT_BOUND_WRITE_TIMEOUT_MS));
  if (error) throw error;
  return (data ?? []) as UserStateRow<T>[];
}

export function saveUserStates(entries: Array<{ stateKey: string; value: unknown }>, expectedUserId?: string): Promise<UserStateRow[]> {
  if (!supabase || entries.length === 0) return Promise.resolve([]);
  return trackUserStateWrite((async () => {
    const user = await ensureOnlineSession();
    const userId = requireExpectedUser(user.id, expectedUserId);
    // Capture the Owner RPC token before any awaits between batch writes. Its
    // auth.uid() must stay bound to the snapshot's owner even after account change.
    const ownerToken = entries.some(entry=>entry.stateKey===OWNER_STATE_KEY) ? await tokenForExpectedUser(userId) : null;
    const rows: UserStateRow[] = [];
    const regularEntries = entries.filter(entry => entry.stateKey !== OWNER_STATE_KEY);
    if (regularEntries.length > 0) {
      const { data, error } = await supabase.from('ball_knower_user_state').upsert(
        regularEntries.map(entry => ({
          user_id: userId,
          state_key: entry.stateKey,
          value: entry.value,
        })),
        { onConflict: 'user_id,state_key' },
      ).select('state_key,value,updated_at').abortSignal(AbortSignal.timeout(ACCOUNT_BOUND_WRITE_TIMEOUT_MS));
      if (error) throw error;
      rows.push(...((data ?? []) as UserStateRow[]));
    }
    for (const entry of entries.filter(candidate => candidate.stateKey === OWNER_STATE_KEY)) {
      const { data, error } = await supabase.rpc('save_ball_knower_revisioned_user_state', {
        p_state_key: entry.stateKey,
        p_value: entry.value,
      }).setHeader('Authorization', `Bearer ${ownerToken}`).abortSignal(AbortSignal.timeout(ACCOUNT_BOUND_WRITE_TIMEOUT_MS));
      if (error) throw error;
      rows.push(...((data ?? []) as UserStateRow[]));
    }
    return rows;
  })());
}

export async function loadUserState<T>(stateKey: string, expectedUserId?: string): Promise<T | null> {
  if (!supabase) return null;
  const user = await ensureOnlineSession();
  const userId = requireExpectedUser(user.id, expectedUserId);
  const { data, error } = await supabase
    .from('ball_knower_user_state')
    .select('value')
    .eq('user_id', userId)
    .eq('state_key', stateKey)
    .abortSignal(AbortSignal.timeout(ACCOUNT_BOUND_WRITE_TIMEOUT_MS))
    .maybeSingle();
  if (error) throw error;
  return (data?.value as T | undefined) ?? null;
}

export function saveUserState(stateKey: string, value: unknown, expectedUserId?: string): Promise<void> {
  if (!supabase) return Promise.resolve();
  // The revisioned Owner RPC derives ownership from auth.uid(), unlike row upserts.
  // Do not advertise an expected-account guarantee for an RPC without that argument.
  if (stateKey === OWNER_STATE_KEY && expectedUserId !== undefined) {
    return Promise.reject(new Error('Account-bound Owner writes require the revisioned career workflow.'));
  }
  return trackUserStateWrite((async () => {
    const user = await ensureOnlineSession();
    const userId = requireExpectedUser(user.id, expectedUserId);
    if (stateKey === OWNER_STATE_KEY) {
      const token = await tokenForExpectedUser(userId);
      const { error } = await supabase.rpc('save_ball_knower_revisioned_user_state', {
        p_state_key: stateKey,
        p_value: value,
      }).setHeader('Authorization', `Bearer ${token}`).abortSignal(AbortSignal.timeout(ACCOUNT_BOUND_WRITE_TIMEOUT_MS));
      if (error) throw error;
      return;
    }
    const { error } = await supabase.from('ball_knower_user_state').upsert({
      user_id: userId,
      state_key: stateKey,
      value,
    }, { onConflict: 'user_id,state_key' }).abortSignal(AbortSignal.timeout(ACCOUNT_BOUND_WRITE_TIMEOUT_MS));
    if (error) throw error;
  })());
}

export function commitAgentSigningForExpectedUser(
  expectedUserId: string,
  beforeValue: unknown,
  afterValue: unknown,
): Promise<void> {
  if (!supabase) return Promise.reject(new Error('Cloud persistence is unavailable.'));
  return trackUserStateWrite((async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ACCOUNT_BOUND_WRITE_TIMEOUT_MS);
    try {
      const { error } = await supabase.rpc('commit_ball_knower_expected_agent_signing', {
        p_expected_user_id: expectedUserId,
        p_before_value: beforeValue,
        p_after_value: afterValue,
      }).abortSignal(controller.signal);
      if (error) throw error;
    } finally {
      clearTimeout(timer);
    }
  })());
}

export async function loadGauntletProgressEvents(expectedUserId?: string): Promise<GauntletProgressEvent[]> {
  if (!supabase) return [];
  const user = await ensureOnlineSession();
  const userId = requireExpectedUser(user.id, expectedUserId);
  const { data, error } = await supabase
    .from('ball_knower_gauntlet_progress_events')
    .select('payload')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: true })
    .abortSignal(AbortSignal.timeout(ACCOUNT_BOUND_WRITE_TIMEOUT_MS));
  if (error) throw error;
  return (data ?? []).map(row => row.payload as GauntletProgressEvent);
}

export function saveGauntletProgressEvents(events: GauntletProgressEvent[], expectedUserId?: string): Promise<void> {
  if (!supabase || events.length === 0) return Promise.resolve();
  return trackUserStateWrite((async () => {
  const user = await ensureOnlineSession();
  const userId = requireExpectedUser(user.id, expectedUserId);
  for (let index = 0; index < events.length; index += 250) {
    const rows = events.slice(index, index + 250).map(event => ({
      user_id: userId,
      event_id: event.id,
      occurred_at: new Date(event.occurredAt).toISOString(),
      payload: event,
    }));
    const { error } = await supabase.from('ball_knower_gauntlet_progress_events').upsert(rows, { onConflict: 'user_id,event_id', ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(ACCOUNT_BOUND_WRITE_TIMEOUT_MS));
    if (error) throw error;
  }
  })());
}
