import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ShoppingBag, X } from 'lucide-react';
import { refreshLocker } from './lockerCommerceClient';
import { supabase } from './supabase';
import { CART_KEY, cartProducts, cartTotal, cleanCart } from './storeCart';
import { storeImage, storePrice } from './storeCatalog';

export function useStoreCart() {
  const [ids, setIds] = useState<string[]>(() => { try { return cleanCart(JSON.parse(localStorage.getItem(CART_KEY) || '[]')); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(ids)); } catch { /* Cart remains usable in memory. */ } }, [ids]);
  useEffect(() => { const sync = (e: StorageEvent) => { if (e.key === CART_KEY) { try { setIds(cleanCart(JSON.parse(e.newValue || '[]'))); } catch { setIds([]); } } }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  return { ids, add: (id: string) => setIds(v => cleanCart([...v, id])), remove: (id: string) => setIds(v => v.filter(x => x !== id)), removeOwned: (owned: string[]) => setIds(v => v.filter(x => !owned.includes(x))) };
}
async function request(body?: unknown) {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (body && (!session || session.user.is_anonymous)) throw new Error('Sign in to save purchases to your account, then return to your cart.');
  const response = await fetch('/api/store-commerce', { method: body ? 'POST' : 'GET', headers: { ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Checkout is temporarily unavailable. Your cart is saved.');
  if ((await supabase?.auth.getSession())?.data.session?.user.id !== session?.user.id) throw new Error('Your account changed. Please reopen your cart.');
  return data;
}
export default function StoreCart({ cart, onClose }: { cart: ReturnType<typeof useStoreCart>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const refreshId = useRef(0);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const native = Capacitor.isNativePlatform();
  async function refresh() {
    const id = ++refreshId.current;
    setError('');
    try { const data = await request(); if (id !== refreshId.current) return; setStatus(data); if (data.owned) cart.removeOwned(data.owned); await refreshLocker(); }
    catch (e) { if (id === refreshId.current) setError(e instanceof Error ? e.message : 'Could not check purchases.'); }
  }
  useEffect(() => { dialog.current?.showModal(); if (!native) void refresh(); return () => { refreshId.current++; }; }, []);
  useEffect(() => { const subscription = supabase?.auth.onAuthStateChange(() => { refreshId.current++; setStatus(null); queueMicrotask(() => { if (!native) void refresh(); }); }); return () => subscription?.data.subscription.unsubscribe(); }, []);
  async function checkout(provider: 'stripe' | 'paypal') {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const data = await request({ action: 'checkout', ids: cart.ids, provider });
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || !(provider === 'stripe' ? ['checkout.stripe.com'] : ['www.paypal.com', 'www.sandbox.paypal.com']).includes(url.hostname)) throw new Error('Checkout returned an invalid address.');
      window.location.assign(url.href);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open checkout.'); setBusy(false); }
  }
  return <dialog ref={dialog} className="bk-store-dialog bk-cart-dialog" aria-labelledby="bk-cart-title" onClose={onClose}>
    <div className="bk-store-dialog-content">
      <header className="bk-store-dialog-header"><h2 id="bk-cart-title"><ShoppingBag size={24}/> Your cart</h2><button type="button" className="bk-store-icon-button" aria-label="Close cart" onClick={() => dialog.current?.close()}><X/></button></header>
      <p>Digital outfits for your Ball Knower account. One of each is all you need.</p>
      {cartProducts(cart.ids).map(product => <div className="bk-cart-item" key={product.id}>
        <img src={storeImage(product.id)} alt=""/><div><strong>{product.name}</strong><span>{storePrice(product)}</span></div>
        <button type="button" disabled={busy} className="bk-store-button" aria-label={`Remove ${product.name}`} onClick={() => cart.remove(product.id)}>Remove</button>
      </div>)}
      {!cart.ids.length && <p className="bk-cart-empty">Your cart is empty. Explore the store to add an outfit.</p>}
      <div className="bk-cart-total"><strong>Subtotal</strong><strong>${(cartTotal(cart.ids) / 100).toFixed(2)}</strong></div>
      {native ? <p>Purchasing in the native app is not available yet.</p> : <>
        {status?.owned?.length > 0 && <p role="status">Your verified outfits are ready in My Locker.</p>}
        {status?.mode === 'test' && <p role="status">Test checkout — no real money or live ownership.</p>}
        {!status?.stripe && !status?.paypal && <p>{status ? 'Payments are not open yet. Your cart is saved for later.' : 'Checking checkout availability…'}</p>}
        <div className="bk-cart-payment-actions">
          <button type="button" className="bk-store-button bk-store-button-gold" disabled={busy || !cart.ids.length || !status?.stripe} onClick={() => checkout('stripe')}>{busy ? 'Opening checkout…' : 'Checkout · Card / Apple Pay / Google Pay'}</button>
          <button type="button" className="bk-store-button" disabled={busy || !cart.ids.length || !status?.paypal} onClick={() => checkout('paypal')}>Checkout with PayPal</button>
        </div>
        <p className="bk-store-purchase-status">Available wallets appear on supported devices at checkout. Purchases unlock after payment is verified.</p>
        <button className="bk-store-button" type="button" disabled={busy} onClick={refresh}>Refresh purchases</button>
      </>}
      {status?.pending && <><p role="status">A checkout is pending. Finish it before starting another cart.</p><button className="bk-store-button" disabled={busy} onClick={async () => { setBusy(true); try { await request({ action: 'cancel' }); await refresh(); } catch(e) { setError(e instanceof Error ? e.message : 'Could not cancel checkout.'); } finally { setBusy(false); } }}>Cancel pending card checkout</button></>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="bk-store-button" onClick={() => dialog.current?.close()}>Continue shopping</button>
    </div>
  </dialog>;
}
