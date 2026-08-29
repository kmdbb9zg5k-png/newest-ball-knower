import type { User } from '@supabase/supabase-js';
import {
  compactGauntletProgressForCloud,
  loadGauntletProgress,
  mergeGauntletProgress,
  mergeGauntletProgressEvents,
  saveGauntletProgress,
  type GauntletProgress,
} from './gauntletEngine';
import { ensureOnlineSession, type PermanentAuthProvider, supabase } from './supabase';
import {
  loadGauntletProgressEvents,
  loadUserState,
  saveGauntletProgressEvents,
  saveUserState,
} from './userStateCloud';

const PENDING_GUEST_MERGE_KEY = 'ballknower_pending_guest_merge_v1';

type PendingGuestMerge = { token: string; guestUserId: string; preparedAt: number };
type GuestMergeReceipt = {
  guest_user_id: string;
  guest_gauntlet_v2: GauntletProgress | null;
  guest_gauntlet_v1: GauntletProgress | null;
  gauntlet_events_copied: number;
  verified_events_copied: number;
  leagues_transferred: number;
};

export type ClaimedGuestMerge = {
  guestUserId: string;
  gauntletEventsCopied: number;
  verifiedEventsCopied: number;
  leaguesTransferred: number;
};

function readPendingGuestMerge(): PendingGuestMerge | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_GUEST_MERGE_KEY) || 'null') as PendingGuestMerge | null;
    return parsed?.token && parsed?.guestUserId ? parsed : null;
  } catch {
    return null;
  }
}

function writePendingGuestMerge(value: PendingGuestMerge | null) {
  try {
    if (value) localStorage.setItem(PENDING_GUEST_MERGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(PENDING_GUEST_MERGE_KEY);
  } catch {}
}

export function hasPendingGuestAccountMerge() {
  return Boolean(readPendingGuestMerge());
}

/** Flushes the latest local ledger before issuing the one-time guest claim. */
export async function prepareGuestAccountMerge(): Promise<PendingGuestMerge | null> {
  if (!supabase) return null;
  const guest = await ensureOnlineSession();
  if (!guest.is_anonymous) return null;

  const local = loadGauntletProgress(guest.id);
  await saveGauntletProgressEvents(Object.values(local.sync?.events || {}));
  await saveUserState('gauntlet_progress_v2', compactGauntletProgressForCloud(local));

  const response = await supabase.rpc('prepare_ball_knower_guest_merge');
  if (response.error) throw response.error;
  const token = String(response.data || '');
  if (!token) throw new Error('Could not prepare guest progress for account sign-in.');
  const pending = { token, guestUserId: guest.id, preparedAt: Date.now() };
  writePendingGuestMerge(pending);
  return pending;
}

export async function startOAuthSignIn(provider: PermanentAuthProvider): Promise<void> {
  if (!supabase) throw new Error('Online accounts are not configured.');
  const current = await ensureOnlineSession();
  if (current.is_anonymous) await prepareGuestAccountMerge();
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
}

/**
 * Claims server-owned guest rows, then performs the event-aware Gauntlet merge
 * under the newly authenticated permanent UUID. Repeating this operation is
 * safe because both claim and event writes are idempotent.
 */
export async function claimPendingGuestAccountMerge(user?: User): Promise<ClaimedGuestMerge | null> {
  if (!supabase) return null;
  const pending = readPendingGuestMerge();
  if (!pending) return null;
  const permanent = user || await ensureOnlineSession();
  if (permanent.is_anonymous || permanent.id === pending.guestUserId) return null;

  const response = await supabase.rpc('claim_ball_knower_guest_merge', { p_token: pending.token });
  if (response.error) throw response.error;
  const receipt = (Array.isArray(response.data) ? response.data[0] : response.data) as GuestMergeReceipt | null;
  if (!receipt) throw new Error('Guest progress claim returned no receipt.');

  const guestLocal = loadGauntletProgress(receipt.guest_user_id);
  const [targetV2, targetV1, targetEvents] = await Promise.all([
    loadUserState<GauntletProgress>('gauntlet_progress_v2'),
    loadUserState<GauntletProgress>('gauntlet_progress_v1'),
    loadGauntletProgressEvents(),
  ]);
  let merged = targetV2 || targetV1 || loadGauntletProgress(permanent.id);
  for (const guest of [receipt.guest_gauntlet_v2, receipt.guest_gauntlet_v1, guestLocal]) {
    if (guest) merged = mergeGauntletProgress(merged, guest);
  }
  merged = mergeGauntletProgressEvents(merged, targetEvents);
  saveGauntletProgress(merged, permanent.id);
  await saveUserState('gauntlet_progress_v2', compactGauntletProgressForCloud(merged));
  writePendingGuestMerge(null);

  return {
    guestUserId: receipt.guest_user_id,
    gauntletEventsCopied: Number(receipt.gauntlet_events_copied) || 0,
    verifiedEventsCopied: Number(receipt.verified_events_copied) || 0,
    leaguesTransferred: Number(receipt.leagues_transferred) || 0,
  };
}
