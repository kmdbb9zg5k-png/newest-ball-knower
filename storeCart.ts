import { practiceAsset, STORE_PRODUCTS } from './storeCatalog.js';

export const CART_KEY = 'bk-store-cart-v1';
export const STORE_WEARABLES: Record<string, string[]> = {
  'tunnel-fit': ['top-tunnel-fit', 'shorts-tunnel-fit', 'shoes-tunnel-fit'],
  'gold-standard': ['top-gold-standard', 'shorts-gold-standard', 'shoes-gold-standard'],
};
export const STORE_CHARACTER_IDS = STORE_PRODUCTS.filter(practiceAsset).map(product => product.id);
export type StorePrices = Record<string, number>;
export const OUTFIT_PRICES = Object.fromEntries(STORE_PRODUCTS.filter(p => Object.hasOwn(STORE_WEARABLES, p.id)).map(p => [p.id, p.priceCents]));

export function cleanCart(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string =>
    typeof id === 'string' && (Object.hasOwn(STORE_WEARABLES, id) || STORE_CHARACTER_IDS.includes(id))))].sort() : [];
}
export function cartProducts(ids: string[]) {
  return cleanCart(ids).map(id => STORE_PRODUCTS.find(p => p.id === id)!);
}
export function cartTotal(ids: string[], prices: StorePrices = OUTFIT_PRICES) {
  return cleanCart(ids).reduce((sum, id) => sum + (prices[id] || 0), 0);
}
export const formatStoreAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;
