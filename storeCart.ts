import { STORE_PRODUCTS } from './storeCatalog';
export const CART_KEY = 'bk-store-cart-v1';
// Only these collections currently have wearable fulfillment mappings.
export const STORE_WEARABLES: Record<string, string[]> = {
  'tunnel-fit': ['top-tunnel-fit', 'shorts-tunnel-fit', 'shoes-tunnel-fit'],
  'gold-standard': ['top-gold-standard', 'shorts-gold-standard', 'shoes-gold-standard'],
};
export function cleanCart(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && Object.hasOwn(STORE_WEARABLES, id)))].sort() : [];
}
export function cartProducts(ids: string[]) { return cleanCart(ids).map(id => STORE_PRODUCTS.find(p => p.id === id)!); }
export function cartTotal(ids: string[]) { return cartProducts(ids).reduce((sum, p) => sum + p.priceCents, 0); }
