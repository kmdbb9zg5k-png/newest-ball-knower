import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY,
  BALL_KNOWER_SUPABASE_URL,
} from './supabaseDefaults';

const viteEnv=(import.meta as ImportMeta&{env?:Record<string,string|undefined>}).env;
const url = viteEnv?.VITE_SUPABASE_URL || BALL_KNOWER_SUPABASE_URL;
const key = viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY
  || viteEnv?.VITE_SUPABASE_ANON_KEY
  || BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY;

export const isCloudConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT'));

const RETRYABLE_STATUS_CODES=new Set([408,425,429,500,502,503,504]);
const READ_TIMEOUT_MS=8000;
const READ_ATTEMPTS=3;
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

const resilientSupabaseFetch=async(input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
  const options=init??{};
  const method=String(options.method||'GET').toUpperCase();
  const canRetry=method==='GET'||method==='HEAD';
  const attempts=canRetry?READ_ATTEMPTS:1;
  let lastError:unknown;

  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=canRetry?new AbortController():null;
    const upstreamSignal=options.signal;
    const relayAbort=()=>controller?.abort();
    if(controller&&upstreamSignal){
      if(upstreamSignal.aborted) controller.abort();
      else upstreamSignal.addEventListener('abort',relayAbort,{once:true});
    }
    const timeout=controller?setTimeout(()=>controller.abort(),READ_TIMEOUT_MS):null;
    try{
      const response=await globalThis.fetch(input,{...options,signal:controller?.signal||upstreamSignal});
      if(!canRetry||!RETRYABLE_STATUS_CODES.has(response.status)||attempt===attempts) return response;
      lastError=new Error(`Supabase read returned ${response.status}`);
    }catch(error){
      lastError=error;
      if(!canRetry||upstreamSignal?.aborted||attempt===attempts) throw error;
    }finally{
      if(timeout) clearTimeout(timeout);
      if(controller&&upstreamSignal) upstreamSignal.removeEventListener('abort',relayAbort);
    }
    await sleep(250*attempt);
  }

  throw lastError instanceof Error?lastError:new Error('Supabase read failed.');
};

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: resilientSupabaseFetch as typeof fetch },
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
