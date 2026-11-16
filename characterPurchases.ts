import { practiceAsset, STORE_PRODUCTS } from './storeCatalog';
import { supabase } from './supabase';

const characters = STORE_PRODUCTS.filter(practiceAsset);
const characterSkus = characters.map(product => product.id);

// Purchase fulfillment uses the playable character's catalog ID as its SKU.
export async function purchasedCharacterIds(): Promise<ReadonlySet<string>> {
  const owned = new Set<string>();
  const client = supabase;
  if (!client) return owned;
  try {
    const { data: { session } } = await client.auth.getSession();
    const user = session?.user;
    if (!user || user.is_anonymous) return owned;

    const { data, error } = await client.from('ball_knower_entitlements')
      .select('sku,source,expires_at')
      .eq('auth_user_id', user.id)
      .eq('source', 'purchase')
      .in('sku', characterSkus)
      .abortSignal(AbortSignal.timeout(4000));
    if (error || !data) return owned;

    const { data: { session: current } } = await client.auth.getSession();
    if (!current || current.user.id !== user.id || current.user.is_anonymous) return owned;
    const now = Date.now();
    for (const row of data) {
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
