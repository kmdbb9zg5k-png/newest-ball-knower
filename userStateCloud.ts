import { ensureOnlineSession, supabase } from './supabase';
import type { GauntletProgressEvent } from './gauntletEngine';

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

export async function assertUserStateAccount(expectedUserId: string) {
  if (!supabase || !expectedUserId) throw new Error('Your account changed. Reopen this screen.');
  const { data, error } = await supabase!.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id !== expectedUserId) {
    throw new Error('Your account changed. Reopen this screen.');
  }
  return data.session;
}

async function userStateSession(expectedUserId?: string) {
  const user = await ensureOnlineSession();
  if (expectedUserId && user.id !== expectedUserId) throw new Error('Your account changed. Reopen this screen.');
  const session = await assertUserStateAccount(user.id);
  // Pin the bearer token to the same identity as the payload. PostgREST would
  // otherwise ask for the latest session only when the request is dispatched.
  return { user, authorization: `Bearer ${session.access_token}` };
}

export async function loadUserStates<T = unknown>(stateKeys: string[], expectedUserId?: string): Promise<UserStateRow<T>[]> {
  if (!supabase || stateKeys.length === 0) return [];
  const { user, authorization } = await userStateSession(expectedUserId);
  const { data, error } = await supabase
    .from('ball_knower_user_state')
    .select('state_key,value,updated_at')
    .eq('user_id', user.id)
    .in('state_key', stateKeys)
    .setHeader('Authorization', authorization);
  if (error) throw error;
  await assertUserStateAccount(user.id);
  return (data ?? []) as UserStateRow<T>[];
}

export function saveUserStates(entries: Array<{ stateKey: string; value: unknown }>, expectedUserId?: string): Promise<UserStateRow[]> {
  if (!supabase || entries.length === 0) return Promise.resolve([]);
  return trackUserStateWrite((async () => {
    const { user, authorization } = await userStateSession(expectedUserId);
    const rows: UserStateRow[] = [];
    const regularEntries = entries.filter(entry => entry.stateKey !== OWNER_STATE_KEY);
    if (regularEntries.length > 0) {
      const { data, error } = await supabase.from('ball_knower_user_state').upsert(
        regularEntries.map(entry => ({
          user_id: user.id,
          state_key: entry.stateKey,
          value: entry.value,
        })),
        { onConflict: 'user_id,state_key' },
      ).select('state_key,value,updated_at').setHeader('Authorization', authorization);
      if (error) throw error;
      rows.push(...((data ?? []) as UserStateRow[]));
    }
    for (const entry of entries.filter(candidate => candidate.stateKey === OWNER_STATE_KEY)) {
      const { data, error } = await supabase.rpc('save_ball_knower_revisioned_user_state', {
        p_state_key: entry.stateKey,
        p_value: entry.value,
      }).setHeader('Authorization', authorization);
      if (error) throw error;
      rows.push(...((data ?? []) as UserStateRow[]));
    }
    return rows;
  })());
}

export async function loadUserState<T>(stateKey: string, expectedUserId?: string): Promise<T | null> {
  if (!supabase) return null;
  const { user, authorization } = await userStateSession(expectedUserId);
  const { data, error } = await supabase
    .from('ball_knower_user_state')
    .select('value')
    .eq('user_id', user.id)
    .eq('state_key', stateKey)
    .maybeSingle()
    .setHeader('Authorization', authorization);
  if (error) throw error;
  await assertUserStateAccount(user.id);
  return (data?.value as T | undefined) ?? null;
}

export function saveUserState(stateKey: string, value: unknown, expectedUserId?: string): Promise<void> {
  if (!supabase) return Promise.resolve();
  return trackUserStateWrite((async () => {
    const { user, authorization } = await userStateSession(expectedUserId);
    if (stateKey === OWNER_STATE_KEY) {
      const { error } = await supabase.rpc('save_ball_knower_revisioned_user_state', {
        p_state_key: stateKey,
        p_value: value,
      }).setHeader('Authorization', authorization);
      if (error) throw error;
      return;
    }
    const { error } = await supabase.from('ball_knower_user_state').upsert({
      user_id: user.id,
      state_key: stateKey,
      value,
    }, { onConflict: 'user_id,state_key' }).setHeader('Authorization', authorization);
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
  const { user, authorization } = await userStateSession(expectedUserId);
  const { data, error } = await supabase
    .from('ball_knower_gauntlet_progress_events')
    .select('payload')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: true })
    .setHeader('Authorization', authorization);
  if (error) throw error;
  await assertUserStateAccount(user.id);
  return (data ?? []).map(row => row.payload as GauntletProgressEvent);
}

export async function saveGauntletProgressEvents(events: GauntletProgressEvent[], expectedUserId?: string): Promise<void> {
  if (!supabase || events.length === 0) return;
  const { user, authorization } = await userStateSession(expectedUserId);
  for (let index = 0; index < events.length; index += 250) {
    const rows = events.slice(index, index + 250).map(event => ({
      user_id: user.id,
      event_id: event.id,
      occurred_at: new Date(event.occurredAt).toISOString(),
      payload: event,
    }));
    const { error } = await supabase.from('ball_knower_gauntlet_progress_events').upsert(rows, { onConflict: 'user_id,event_id', ignoreDuplicates: true }).setHeader('Authorization', authorization);
    if (error) throw error;
  }
}
