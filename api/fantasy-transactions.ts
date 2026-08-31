import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gpnboygoosrmeydwjpvk.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RPC_TIMEOUT_MS = 10000;

const timedFetch = async (input: any, init: any = {}) => {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const relayAbort = () => controller.abort();
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener('abort', relayAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    if (upstreamSignal) upstreamSignal.removeEventListener('abort', relayAbort);
  }
};

export default async function handler(req: Request, res: Response) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!serviceRoleKey) return res.status(503).json({ error: 'Transaction processor is not configured.' });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timedFetch as any },
  });
  const now = new Date().toISOString();

  const runRpc = async (name: string, args: Record<string, unknown>) => {
    try {
      const { data, error } = await supabase.rpc(name, args);
      if (error) throw error;
      return { ok: true as const, data };
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? `${name} exceeded ${RPC_TIMEOUT_MS / 1000}s`
        : error?.message || `${name} failed`;
      console.error('fantasy-transactions worker', { name, message });
      return { ok: false as const, error: message };
    }
  };

  const [scheduled, waivers, drafts, matchups] = await Promise.all([
    runRpc('process_due_ball_knower_scheduled_drafts', { p_now: now }),
    runRpc('process_due_ball_knower_waivers', { p_now: now }),
    runRpc('process_due_ball_knower_draft_picks', { p_now: now }),
    runRpc('process_due_ball_knower_matchup_notifications', { p_now: now }),
  ]);

  const failures = [
    ['scheduledDrafts', scheduled],
    ['waivers', waivers],
    ['drafts', drafts],
    ['matchupNotifications', matchups],
  ].filter(([, result]) => !result.ok).map(([job, result]: any) => ({ job, error: result.error }));

  return res.status(failures.length ? 503 : 200).json({
    ok: failures.length === 0,
    checkedAt: now,
    scheduledDrafts: scheduled.ok ? scheduled.data : null,
    waivers: waivers.ok ? waivers.data : null,
    drafts: drafts.ok ? drafts.data : null,
    matchupNotifications: matchups.ok ? matchups.data : null,
    failures,
  });
}
