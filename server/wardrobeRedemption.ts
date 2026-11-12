import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { CLOTHING, CLOTHING_SLOTS } from '../playerWardrobe.js';
import { CommerceError, verifiedOutfit } from './lockerCommerce.js';

export async function wardrobeRedemption(token: string, method: string, body?: {action?: string; code?: unknown; outfit?: unknown}) {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !key) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gpnboygoosrmeydwjpvk.supabase.co';
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return null;

  const rows = () => db.from('bk_wardrobe_redemptions');
  const { data: row, error } = await rows().select('redeemed_at,outfit').eq('user_id', user.id).maybeSingle();
  if (error || !row) return null;

  const owned = CLOTHING.filter(item => item.premium).map(item => item.id);
  const state = { available: true, mode: 'grant', owned, outfit: row.outfit ? verifiedOutfit(row.outfit, owned) : null, prices: {} };
  if (body?.action === 'redeem') {
    if (row.redeemed_at) return state;
    const code = typeof body.code === 'string' && body.code.length <= 80 ? body.code.trim().toUpperCase() : '';
    const codeHash = createHash('sha256').update(code).digest('hex');
    const { data: redeemed, error: redeemError } = await rows()
      .update({ code_hash: null, redeemed_at: new Date().toISOString() })
      .eq('user_id', user.id).is('redeemed_at', null).eq('code_hash', codeHash).select('user_id').maybeSingle();
    if (redeemError) throw new CommerceError(503, 'Could not redeem your code. Try again.');
    if (!redeemed) throw new CommerceError(400, 'That clothing code is invalid or has already been redeemed.');
    return state;
  }
  if (!row.redeemed_at) {
    return method === 'GET' ? { available: false, redeemable: true, owned: [], prices: {} } : null;
  }
  if (method === 'GET' || body?.action === 'restore') return state;
  if (body?.action === 'equip') {
    const requested = body.outfit as Record<string, unknown> | null;
    const outfit = verifiedOutfit(requested, owned);
    if (!requested || CLOTHING_SLOTS.some(slot => outfit[slot] !== requested[slot])) throw new CommerceError(403, 'That outfit is unavailable.');
    const { error: equipError } = await rows().update({ outfit }).eq('user_id', user.id);
    if (equipError) throw new CommerceError(503, 'Could not save your outfit. Try again.');
    return { ...state, outfit };
  }
  throw new CommerceError(400, 'This Locker action is unavailable.');
}
