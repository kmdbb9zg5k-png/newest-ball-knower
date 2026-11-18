import { practiceAsset, STORE_PRODUCTS } from './storeCatalog';
import { supabase } from './supabase';

const characters = STORE_PRODUCTS.filter(practiceAsset);
const characterSkus = characters.map(product => product.id);

export const characterOwnershipChanges = new EventTarget();

export class CharacterCodeSignInRequired extends Error {}

export async function redeemCharacterCode(code: string): Promise<string[]> {
  const client = supabase;
  const session = (await client?.auth.getSession())?.data.session;
  if (!client || !session || session.user.is_anonymous) {
    throw new CharacterCodeSignInRequired('Sign in with the Apple account you used for your wardrobe unlock.');
  }
  const { data, error } = await client.rpc('bk_store_character_code', { p_code: code })
    .setHeader('Authorization', `Bearer ${session.access_token}`)
    .abortSignal(AbortSignal.timeout(10000));
  const current = (await client.auth.getSession()).data.session;
  if (current?.user.id !== session.user.id) throw new Error('Your account changed. Reopen your cart to check access.');
  if (error?.code === 'PGRST301') throw new CharacterCodeSignInRequired('Your session expired. Sign in and try again.');
  if (error) throw new Error('Could not redeem the character code. Try again.');
  const skus = Array.isArray(data) ? data.map(row => row.sku).filter(sku => characterSkus.includes(sku)) : [];
  if (!skus.length) throw new Error('This character code is unavailable for your account.');
  characterOwnershipChanges.dispatchEvent(new Event('change'));
  return skus;
}

// Paid orders, redeemed codes, and previously issued purchase grants confer access.
export async function purchasedCharacterIds(): Promise<ReadonlySet<string>> {
  const owned = new Set<string>();
  const client = supabase;
  if (!client) return owned;
  try {
    const { data: { session } } = await client.auth.getSession();
    const user = session?.user;
    if (!user || user.is_anonymous) return owned;

    const [checkout, code, legacy] = await Promise.allSettled([
      client.rpc('bk_store_character_purchases').abortSignal(AbortSignal.timeout(4000)),
      client.rpc('bk_store_character_code').abortSignal(AbortSignal.timeout(4000)),
      client.from('ball_knower_entitlements')
        .select('sku,source,expires_at')
        .eq('auth_user_id', user.id)
        .eq('source', 'purchase')
        .in('sku', characterSkus)
        .abortSignal(AbortSignal.timeout(4000)),
    ]);
    const { data: { session: current } } = await client.auth.getSession();
    if (!current || current.user.id !== user.id || current.user.is_anonymous) return owned;
    for (const result of [checkout, code]) {
      if (result.status === 'fulfilled' && !result.value.error && Array.isArray(result.value.data)) {
        for (const row of result.value.data) {
          if (characterSkus.includes(row.sku)) owned.add(row.sku);
        }
      }
    }
    const now = Date.now();
    if (legacy.status === 'fulfilled' && !legacy.value.error && Array.isArray(legacy.value.data)) for (const row of legacy.value.data ?? []) {
      if (row.source === 'purchase' && characterSkus.includes(row.sku)
        && (row.expires_at === null || Date.parse(row.expires_at) > now)) owned.add(row.sku);
    }
  } catch {
    // Unavailable ownership data leaves the default athlete playable.
  }
  return owned;
}

export async function purchasedCharacterAsset(id: string) {
  const product = characters.find(character => character.id === id);
  const url = product && practiceAsset(product);
  if (!url || !(await purchasedCharacterIds()).has(id)) return null;
  return { url, fitId: product.fitPracticeRig ? product.id : undefined };
}
