import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { ShoppingBag, X } from 'lucide-react';
import { redeemCharacterCode } from './characterPurchases';
import { refreshLocker } from './lockerCommerceClient';
import { supabase } from './supabase';
import { CART_KEY, canCheckOutStoreItem, cartProducts, cartTotal, cleanCart, formatStoreAmount, OUTFIT_PRICES, type StorePrices } from './storeCart';

export function useStoreCart() {
  const [ids, setIds] = useState<string[]>(() => { try { return cleanCart(JSON.parse(localStorage.getItem(CART_KEY) || '[]')); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(ids)); } catch { /* Cart remains usable in memory. */ } }, [ids]);
  useEffect(() => { const sync = (e: StorageEvent) => { if (e.key === CART_KEY) { try { setIds(cleanCart(JSON.parse(e.newValue || '[]'))); } catch { setIds([]); } } }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  const [characterPrices, setCharacterPrices] = useState<StorePrices>({});
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    let version = 0;
    let timer: ReturnType<typeof setTimeout>;
    function load() {
      const current = ++version;
      clearTimeout(timer);
      setCharacterPrices({});
      timer = setTimeout(() => {
        void request(undefined, '?catalog=1').then(data => {
          if (current === version) setCharacterPrices(data.catalogPrices || {});
        }).catch(() => {});
      }, 0);
    }
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') load();
    });
    load();
    return () => { version++; clearTimeout(timer); subscription?.data.subscription.unsubscribe(); };
  }, []);
  const prices = { ...OUTFIT_PRICES, ...characterPrices };
  return { ids, prices, add: (id: string) => setIds(v => cleanCart([...v, id])), remove: (id: string) => setIds(v => v.filter(x => x !== id)), removeOwned: (owned: string[]) => setIds(v => v.filter(x => !owned.includes(x))) };
}
async function request(body?: unknown, query = '') {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (body && (!session || session.user.is_anonymous)) throw new Error('Sign in to save purchases to your account, then return to your cart.');
  const response = await fetch('/api/store-commerce' + query, { method: body ? 'POST' : 'GET', headers: { ...(session && !session.user.is_anonymous ? { Authorization: `Bearer ${session.access_token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(30000) });
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
  const [code, setCode] = useState('');
  const [redemptionMessage, setRedemptionMessage] = useState('');
  const native = Capacitor.isNativePlatform();
  const checkoutPrices: StorePrices = status?.catalogPrices ?? {};
  const checkoutIds = cart.ids.filter(id => canCheckOutStoreItem(id, checkoutPrices));
  const savedCount = cart.ids.length - checkoutIds.length;
  async function refresh() {
    const id = ++refreshId.current;
    setError('');
    try { const data = await request(); if (id !== refreshId.current) return; setStatus(data); if (data.owned) cart.removeOwned(data.owned); await refreshLocker(); }
    catch (e) { if (id === refreshId.current) setError(e instanceof Error ? e.message : 'Could not check purchases.'); }
  }
  useEffect(() => { dialog.current?.showModal(); if (!native) void refresh(); return () => { refreshId.current++; }; }, []);
  useEffect(() => {
    if (native) return;
    let timer: ReturnType<typeof setTimeout>;
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
      refreshId.current++;
      setStatus(null);
      clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 0);
    });
    return () => { clearTimeout(timer); subscription?.data.subscription.unsubscribe(); };
  }, []);
  async function checkout(provider: 'stripe' | 'paypal') {
    if (busy || !checkoutIds.length) return;
    setBusy(true); setError('');
    try {
      const data = await request({ action: 'checkout', ids: checkoutIds, provider });
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || !(provider === 'stripe' ? ['checkout.stripe.com'] : ['www.paypal.com', 'www.sandbox.paypal.com']).includes(url.hostname)) throw new Error('Checkout returned an invalid address.');
      window.location.assign(url.href);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open checkout.'); setBusy(false); }
  }
  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError('');
    setRedemptionMessage('');
    try {
      const skus = await redeemCharacterCode(code.trim());
      cart.removeOwned(skus);
      setCode('');
      setRedemptionMessage('Characters unlocked. Choose your player in Profile.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not redeem your code. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return <dialog ref={dialog} className="bk-store-dialog bk-cart-dialog" aria-labelledby="bk-cart-title" onClose={onClose}>
    <div className="bk-store-dialog-content">
      <header className="bk-store-dialog-header"><h2 id="bk-cart-title"><ShoppingBag size={24}/> Your cart</h2><button type="button" className="bk-store-icon-button" aria-label="Close cart" onClick={() => dialog.current?.close()}><X/></button></header>
      <p>Save gear, outfits, and characters in one cart.</p>
      {cartProducts(cart.ids).map(product => <div className="bk-cart-item" key={product.id}>
        <img src={product.image} alt=""/>
        <div>
          <strong>{product.name}</strong>
          <span>{canCheckOutStoreItem(product.id, checkoutPrices) ? formatStoreAmount(checkoutPrices[product.id]) : 'Saved for later · Checkout coming soon'}</span>
        </div>
        <button type="button" disabled={busy} className="bk-store-button" aria-label={`Remove ${product.name}`} onClick={() => cart.remove(product.id)}>Remove</button>
      </div>)}
      {!cart.ids.length && <p className="bk-cart-empty">Your cart is empty. Explore the Store to add an item.</p>}
      {checkoutIds.length > 0 && <div className="bk-cart-total"><strong>Checkout subtotal</strong><strong>{formatStoreAmount(cartTotal(checkoutIds, checkoutPrices))}</strong></div>}
      {native ? <p>Purchasing in the native app is not available yet.</p> : <>
        <form className="bk-cart-code" onSubmit={redeem}>
          <label htmlFor="bk-character-code">Character code</label>
          <input id="bk-character-code" value={code} onChange={event => setCode(event.target.value)}
            maxLength={80} autoCapitalize="characters" autoComplete="off" spellCheck={false} required disabled={busy}/>
          <button type="submit" className="bk-store-button" disabled={busy || !code.trim()}>Redeem code</button>
          {redemptionMessage && <p role="status">{redemptionMessage}</p>}
        </form>
        {status?.owned?.length > 0 && <p role="status">{status.mode === 'test' ? 'Test checkout verified.' : 'Order verified. Find outfits in My Locker and playable characters in Profile.'}</p>}
        {status?.mode === 'test' && <p role="status">Test checkout — no real money or live ownership.</p>}
        {status && (status.stripe || status.paypal) && !status.signedIn && <p>Sign in to check out and save purchases to your account.</p>}
        {status && savedCount > 0 && checkoutIds.length > 0 && <p>Only checkout-ready items are included in this total. The rest stay in your cart.</p>}
        {!status?.stripe && !status?.paypal && <p>{status ? 'Payments are not open yet. Your cart is saved for later.' : error ? 'Checkout is unavailable. Your cart is saved.' : 'Checking checkout availability…'}</p>}
        <div className="bk-cart-payment-actions">
          <button type="button" className="bk-store-button bk-store-button-gold" disabled={busy || !checkoutIds.length || !status?.signedIn || !status?.stripe} onClick={() => checkout('stripe')}>{busy ? 'Opening checkout…' : 'Checkout · Card / Apple Pay / Google Pay'}</button>
          <button type="button" className="bk-store-button" disabled={busy || !checkoutIds.length || !status?.signedIn || !status?.paypal} onClick={() => checkout('paypal')}>Checkout with PayPal</button>
        </div>
        {status?.stripe && <p className="bk-store-purchase-status">Have a promo code? Enter it on the card checkout page.</p>}
        <p className="bk-store-purchase-status">Available wallets appear on supported devices at checkout. Items unlock after checkout is verified.</p>
        <button className="bk-store-button" type="button" disabled={busy} onClick={refresh}>Refresh purchases</button>
      </>}
      {status?.pending && <><p role="status">A checkout is pending. Finish it before starting another cart.</p><button className="bk-store-button" disabled={busy} onClick={async () => { setBusy(true); try { await request({ action: 'cancel' }); await refresh(); } catch(e) { setError(e instanceof Error ? e.message : 'Could not cancel checkout.'); } finally { setBusy(false); } }}>Cancel pending card checkout</button></>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="bk-store-button" onClick={() => dialog.current?.close()}>Continue shopping</button>
    </div>
  </dialog>;
}
