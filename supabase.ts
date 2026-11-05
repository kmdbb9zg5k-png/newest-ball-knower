import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import {
  BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY,
  BALL_KNOWER_SUPABASE_URL,
} from './supabaseDefaults';
import { flushAllCloudStateBeforeIdentityChange } from './cloudSyncCoordinator';
import { createResilientFetch, resilientFetch } from './resilientFetch';
import { recordAccountDeletionResult, type AccountDeletionResult } from './accountDeletionRecovery';

const accountDeletionFetch = createResilientFetch({ writeTimeoutMs: 45_000 });

const viteEnv=(import.meta as ImportMeta&{env?:Record<string,string|undefined>}).env;
const url = viteEnv?.VITE_SUPABASE_URL || BALL_KNOWER_SUPABASE_URL;
const key = viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY
  || viteEnv?.VITE_SUPABASE_ANON_KEY
  || BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY;

export const isCloudConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT'));

const BALL_KNOWER_PRODUCTION_ORIGIN='https://ballknowerofficial.com';
export const ballKnowerEmailRedirect=()=>{
  if(typeof window==='undefined')return BALL_KNOWER_PRODUCTION_ORIGIN;
  if(window.location.protocol==='capacitor:'||window.location.protocol==='ionic:')return'ballknower://auth/callback';
  if(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')return window.location.origin;
  return BALL_KNOWER_PRODUCTION_ORIGIN;
};

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit' },
      global: { fetch: resilientFetch },
    })
  : null;

export type PermanentAuthProvider = 'google' | 'apple';
export type AuthProviderAvailability = Record<PermanentAuthProvider, boolean | null>;

/**
 * false means Supabase explicitly reports the provider disabled. null means
 * availability could not be verified, so the UI must not mislabel a transient
 * settings/network failure as "SETUP REQUIRED".
 */
export async function fetchAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  if (!url || !key) return { google: false, apple: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: controller.signal });
    if (!response.ok) throw new Error(`Auth settings returned ${response.status}`);
    const settings = await response.json() as { external?: Partial<Record<PermanentAuthProvider, boolean>> };
    return { google: Boolean(settings.external?.google), apple: Boolean(settings.external?.apple) };
  } catch (error) {
    console.warn('Could not verify social sign-in availability', error);
    return { google: null, apple: null };
  } finally {
    clearTimeout(timeout);
  }
}

let pendingAnonymousSession: Promise<User> | null = null;

export async function ensureOnlineSession(): Promise<User> {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;
  if (pendingAnonymousSession) return pendingAnonymousSession;

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
  },{emailRedirectTo:ballKnowerEmailRedirect()});
  if (error || !updated.user) {
    throw new Error(error?.message || 'Could not attach that email to this guest account.');
  }
  return updated.user;
}

export async function sendEmailMagicLink(email: string, displayName?: string): Promise<void> {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  await flushAllCloudStateBeforeIdentityChange();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: ballKnowerEmailRedirect(),
      shouldCreateUser: true,
      data: displayName?.trim() ? { full_name: displayName.trim(), name: displayName.trim() } : undefined,
    },
  });
  if (error) throw new Error(error.message || 'Could not send the sign-in email.');
}

export async function signOutOnline(): Promise<void> {
  if (!supabase) return;
  await flushAllCloudStateBeforeIdentityChange();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message || 'Could not sign out.');
}

export async function deleteBallKnowerAccount(expectedUserId: string): Promise<AccountDeletionResult> {
  if (!supabase) throw new Error('Account deletion requires online services.');
  const initial = await supabase.auth.getSession();
  if (!expectedUserId || initial.data.session?.user.id !== expectedUserId) throw new Error('Your account changed. Reopen Privacy before deleting an account.');
  await flushAllCloudStateBeforeIdentityChange();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sign in again before deleting your account.');
  if (data.session.user.id !== expectedUserId) throw new Error('Your account changed. Reopen Privacy before deleting an account.');
  const appleLinked = data.session.user.identities?.some(identity => identity.provider === 'apple') || data.session.user.app_metadata?.providers?.includes('apple');
  const appleAuthorization = appleLinked
    ? await (await import('./nativeAuth')).requestAppleDeletionAuthorization()
    : null;
  const beforeRequest = await supabase.auth.getSession();
  if (beforeRequest.data.session?.user.id !== expectedUserId) throw new Error('Your account changed. Reopen Privacy before deleting an account.');

  const response = await accountDeletionFetch('/api/account-delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({
      confirmation: 'DELETE',
      providerToken: data.session.provider_token || null,
      providerRefreshToken: data.session.provider_refresh_token || null,
      appleAuthorization,
    }),
  }).catch(() => { throw new Error('Account deletion could not be confirmed. Sign in again to check your account before retrying.'); });
  const payload = await response.json().catch(() => ({})) as Partial<AccountDeletionResult> & { error?: string; code?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Your account could not be deleted.');
  }
  if (payload.ok !== true) throw new Error('Account deletion could not be confirmed. Sign in again to check your account before retrying.');
  const result: AccountDeletionResult = {
    ok: true,
    appleAuthorizationRevoked: payload.appleAuthorizationRevoked === true ? true : appleLinked ? false : null,
    manualAppleRevokeRequired: payload.manualAppleRevokeRequired === true || Boolean(appleLinked && payload.appleAuthorizationRevoked !== true),
  };
  // Persist the follow-up before sign-out can trigger the account-isolation
  // reload. No provider token, account identity or personal data is retained.
  recordAccountDeletionResult(result);

  const current = await supabase.auth.getSession();
  result.sessionChanged = current.data.session?.user.id !== expectedUserId;
  if (!result.sessionChanged) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return result;
}
