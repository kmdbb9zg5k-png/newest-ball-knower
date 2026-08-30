import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gpnboygoosrmeydwjpvk.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: Request, res: Response) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!serviceRoleKey) return res.status(503).json({ error: 'Transaction processor is not configured.' });
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();
  const scheduled = await supabase.rpc('process_due_ball_knower_scheduled_drafts', { p_now: now });
  if (scheduled.error) return res.status(500).json({ error: scheduled.error.message });
  const [waivers, drafts, matchups] = await Promise.all([
    supabase.rpc('process_due_ball_knower_waivers', { p_now: now }),
    supabase.rpc('process_due_ball_knower_draft_picks', { p_now: now }),
    supabase.rpc('process_due_ball_knower_matchup_notifications', { p_now: now }),
  ]);
  if (waivers.error || drafts.error || matchups.error) return res.status(500).json({ error: waivers.error?.message || drafts.error?.message || matchups.error?.message });
  return res.status(200).json({ scheduledDrafts: scheduled.data, waivers: waivers.data, drafts: drafts.data, matchupNotifications: matchups.data });
}
