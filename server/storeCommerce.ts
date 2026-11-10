import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cartProducts, cleanCart, STORE_WEARABLES } from '../storeCart.js';
import { CLOTHING_SLOTS } from '../playerWardrobe.js';
import { CommerceError, runtimeCommerce, verifiedOutfit } from './lockerCommerce.js';
const fail = (status: number, message: string): never => { throw new CommerceError(status, message); };
const ORIGIN = 'https://ballknowerofficial.com';
const idOf = (v: any): string | null => typeof v === 'string' ? v : v?.id || null;
export type StoreItem = { id: string; name: string; amount: number };
export type StoreOrder = { id: string; user_id: string; mode: 'test' | 'live'; provider: 'stripe' | 'paypal'; items: StoreItem[]; amount: number; provider_id: string | null; payment_id: string | null; status: string; created_at: string };
export function storeItems(raw: unknown): StoreItem[] {
  const ids = cleanCart(raw);
  if (!Array.isArray(raw) || !ids.length || ids.length !== raw.length || raw.length > 20) fail(400, 'Choose available outfits, once each.');
  return cartProducts(ids).map(p => ({ id: p.id, name: p.name, amount: p.priceCents }));
}
export function storeConfig(env: Record<string,string|undefined>) {
  const mode = env.STORE_COMMERCE_MODE;
  if (mode !== 'test' && mode !== 'live') return null;
  const key = env.STORE_STRIPE_KEY || '';
  const stripe = new RegExp(`^[sr]k_${mode}_`).test(key) && !!env.STORE_STRIPE_ACCOUNT && !!env.STORE_STRIPE_WEBHOOK_SECRET?.startsWith('whsec_');
  const paypal = !!env.STORE_PAYPAL_CLIENT_ID && !!env.STORE_PAYPAL_SECRET && !!env.STORE_PAYPAL_WEBHOOK_ID && !!env.STORE_PAYPAL_MERCHANT_ID;
  const buyers = (env.STORE_TEST_BUYERS || '').split(',').filter(Boolean);
  if ((!stripe && !paypal) || (mode === 'test' && !buyers.length)) return null;
  return { mode, stripe, paypal, key, stripeAccount: env.STORE_STRIPE_ACCOUNT!, stripeWebhook: env.STORE_STRIPE_WEBHOOK_SECRET!, buyers,
    paypalClient: env.STORE_PAYPAL_CLIENT_ID!, paypalSecret: env.STORE_PAYPAL_SECRET!, paypalWebhook: env.STORE_PAYPAL_WEBHOOK_ID!, paypalMerchant: env.STORE_PAYPAL_MERCHANT_ID! };
}
export function verifyStripeOrder(order: StoreOrder, session: Stripe.Checkout.Session, lines: Stripe.ApiList<Stripe.LineItem>, payment: Stripe.PaymentIntent | null) {
  if (session.livemode !== (order.mode === 'live') || session.mode !== 'payment' || session.metadata?.store_order !== order.id || session.client_reference_id !== order.user_id || (order.provider_id && session.id !== order.provider_id) || session.amount_total !== order.amount || session.currency !== 'usd' || lines.has_more || lines.data.length !== order.items.length) fail(409, 'Order verification failed.');
  const seen = new Set<string>();
  for (const line of lines.data) {
    const product = line.price?.product;
    const sku = typeof product === 'object' && product && 'metadata' in product ? product.metadata?.store_sku : undefined;
    const item = order.items.find(i => i.id === sku);
    if (!item || seen.has(sku!) || line.quantity !== 1 || line.amount_total !== item.amount || line.currency !== 'usd') fail(409, 'Item verification failed.');
    seen.add(sku!);
  }
  if (payment) {
    if (payment.livemode !== (order.mode === 'live') || payment.id !== idOf(session.payment_intent) || (order.payment_id && order.payment_id !== payment.id) || payment.metadata?.store_order !== order.id || payment.metadata?.user_id !== order.user_id || payment.amount !== order.amount || payment.currency !== 'usd') fail(409, 'Payment verification failed.');
    const charge = typeof payment.latest_charge === 'object' ? payment.latest_charge : null;
    if (charge?.disputed) return 'disputed';
    if (charge && charge.amount_refunded > 0) return 'refunded';
    if (session.status === 'complete' && session.payment_status === 'paid' && payment.status === 'succeeded' && payment.amount_received === order.amount && charge?.paid && charge.amount === order.amount && charge.currency === 'usd' && charge.livemode === (order.mode === 'live')) return 'paid';
  }
  return session.status === 'expired' ? 'expired' : 'pending';
}
export function verifyPayPalOrder(order: StoreOrder, remote: any, merchant: string) {
  const unit = remote.purchase_units?.[0];
  if (remote.id !== order.provider_id || remote.intent !== 'CAPTURE' || remote.purchase_units?.length !== 1 || unit?.custom_id !== order.id || unit?.payee?.merchant_id !== merchant || unit?.amount?.currency_code !== 'USD' || unit?.amount?.value !== (order.amount / 100).toFixed(2)) fail(409, 'PayPal order verification failed.');
  const captures = unit.payments?.captures || [];
  if (captures.length > 1) fail(409, 'Unexpected PayPal captures.');
  const capture = captures[0];
  if (!capture) return { status: ['VOIDED','EXPIRED'].includes(remote.status) ? 'expired' : 'pending', payment: null };
  if (capture.amount?.currency_code !== 'USD' || capture.amount?.value !== (order.amount / 100).toFixed(2) || (order.payment_id && order.payment_id !== capture.id)) fail(409, 'PayPal amount verification failed.');
  return { status: ['REFUNDED','PARTIALLY_REFUNDED'].includes(capture.status) ? 'refunded' : ['DECLINED','DENIED','FAILED'].includes(capture.status) ? 'expired' : remote.status === 'COMPLETED' && capture.status === 'COMPLETED' ? 'paid' : 'pending', payment: capture.id };
}
export function makeStoreCommerce(db: SupabaseClient, config: NonNullable<ReturnType<typeof storeConfig>>) {
  const stripe = config.stripe ? new Stripe(config.key, { maxNetworkRetries: 2, timeout: 12000 }) : null;
  const paypalBase = config.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  function result<T>(r: { data: T; error: any }): T {
    if (r.error) {
      if (r.error.message?.includes('PENDING_CART')) fail(409, 'Finish your pending checkout before changing items or payment method.');
      if (r.error.message?.includes('ALREADY_OWNED')) fail(409, 'You already own an item in this cart. Refresh purchases.');
      throw new Error('Store database unavailable');
    }
    return r.data;
  }
  async function paypal(path: string, body?: unknown, requestId?: string) {
    const auth = await fetch(`${paypalBase}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(config.paypalClient + ':' + config.paypalSecret).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(12000) });
    if (!auth.ok) fail(503, 'PayPal is temporarily unavailable.');
    const token = (await auth.json()).access_token;
    const response = await fetch(paypalBase + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(requestId ? { 'PayPal-Request-Id': requestId, Prefer: 'return=representation' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) });
    if (!response.ok) fail(503, 'PayPal could not confirm this request. Refresh purchases before retrying.');
    return response.json();
  }
  async function account() { if (!stripe || (await stripe.accounts.retrieve(null)).id !== config.stripeAccount) fail(503, 'Checkout account is not configured correctly.'); }
  const find = async(id: string) => result(await db.from('bk_store_orders').select('*').eq('id', id).eq('mode', config.mode).maybeSingle()) as StoreOrder | null;
  const settle = async(order: StoreOrder, providerId: string, paymentId: string | null, status: string) => result(await db.rpc('bk_store_settle', { p_id: order.id, p_provider_id: providerId, p_payment_id: paymentId, p_status: status })) as StoreOrder;
  async function reconcile(order: StoreOrder, capture = false) {
    if (!order.provider_id) return order;
    if (order.provider === 'stripe') {
      await account();
      const session = await stripe!.checkout.sessions.retrieve(order.provider_id);
      const lines = await stripe!.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ['data.price.product'] });
      const payment = session.payment_intent ? await stripe!.paymentIntents.retrieve(idOf(session.payment_intent)!, { expand: ['latest_charge'] }) : null;
      return settle(order, session.id, payment?.id || null, verifyStripeOrder(order, session, lines, payment));
    }
    let remote = await paypal(`/v2/checkout/orders/${encodeURIComponent(order.provider_id)}`);
    verifyPayPalOrder(order, remote, config.paypalMerchant);
    if (capture && remote.status === 'APPROVED') remote = await paypal(`/v2/checkout/orders/${encodeURIComponent(order.provider_id)}/capture`, {}, order.id);
    const verified = verifyPayPalOrder(order, remote, config.paypalMerchant);
    return settle(order, remote.id, verified.payment, verified.status);
  }
  async function state(user: string) {
    const orders = result(await db.from('bk_store_orders').select('*').eq('user_id', user).eq('mode', config.mode).in('status', ['pending','paid'])) as StoreOrder[];
    const verified = await Promise.all(orders.map(o => reconcile(o, o.provider === 'paypal' && o.status === 'pending')));
    const owned = [...new Set(verified.filter(o => o.status === 'paid').flatMap(o => o.items.map(i => i.id)))];
    const legacy = runtimeCommerce();
    const previous = config.mode === 'test' && legacy?.config.buyers.includes(user) ? await legacy.commerce.state(user) : null;
    const wearables = [...owned.flatMap(id => STORE_WEARABLES[id] || []), ...(previous?.owned || [])];
    const saved = result(await db.from('bk_store_outfits').select('outfit').eq('user_id', user).eq('mode', config.mode).maybeSingle());
    return { available: true, wearables, outfit: saved ? verifiedOutfit(saved.outfit, wearables) : previous?.outfit || null, prices: previous?.prices || {}, mode: config.mode, stripe: config.stripe, paypal: config.paypal, owned: [...new Set(verified.filter(o => o.status === 'paid').flatMap(o => o.items.map(i => i.id)))], pending: verified.some(o => o.status === 'pending') };
  }
  return { stripe, config, find, reconcile, paypal, settle,
    async authenticate(token: string) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous) fail(401, 'Sign in to save your purchases.');
      if (config.mode === 'test' && !config.buyers.includes(data.user.id)) fail(403, 'Checkout is currently being tested privately.');
      return data.user.id;
    }, state,
    async equip(user: string, raw: any) {
      const current = await state(user), outfit = verifiedOutfit(raw, current.wearables);
      if (!raw || CLOTHING_SLOTS.some(slot => raw[slot] !== outfit[slot])) fail(403, 'You do not own that outfit.');
      result(await db.from('bk_store_outfits').upsert({ user_id: user, mode: config.mode, outfit, updated_at: new Date().toISOString() }));
      return { ...current, outfit };
    },
    async cancel(user: string) {
      const orders = result(await db.from('bk_store_orders').select('*').eq('user_id', user).eq('mode', config.mode).eq('status','pending')) as StoreOrder[];
      for (const order of orders) {
        if (order.provider !== 'stripe' || !order.provider_id) fail(409, 'This pending payment needs to be completed or resolved with support before changing the cart.');
        await account();
        const session = await stripe!.checkout.sessions.retrieve(order.provider_id);
        if (session.status === 'open') await stripe!.checkout.sessions.expire(session.id);
        await reconcile(order);
      }
      return state(user);
    },
    async checkout(user: string, raw: unknown, provider: string) {
      if (!['stripe','paypal'].includes(provider) || !config[provider]) fail(503, 'This payment method is not connected yet.');
      const items = storeItems(raw);
      await state(user); // Reconcile previous orders before reserving the next cart.
      let order = result(await db.rpc('bk_store_begin', { p_user: user, p_mode: config.mode, p_provider: provider, p_items: items, p_amount: items.reduce((n, i) => n + i.amount, 0) })) as StoreOrder;
      // Never reuse expired provider idempotency windows after an ambiguous network failure.
      const age = Date.now() - Date.parse(order.created_at);
      if (!order.provider_id && age > (provider === 'paypal' ? 5 : 23) * 3600000) fail(409, 'This pending order needs support before retrying.');
      if (provider === 'stripe') {
        await account();
        const metadata = { store_order: order.id, user_id: user };
        const session = order.provider_id ? await stripe!.checkout.sessions.retrieve(order.provider_id) : await stripe!.checkout.sessions.create({
          mode: 'payment', client_reference_id: user, metadata, payment_intent_data: { metadata },
          integration_identifier: 'ball-knower-store-kfndpjra',
          line_items: order.items.map(i => ({ quantity: 1, price_data: { currency: 'usd', unit_amount: i.amount, product_data: { name: i.name, metadata: { store_sku: i.id } } } })),
          success_url: `${ORIGIN}/?store_checkout=return`, cancel_url: `${ORIGIN}/?store_checkout=cancel`,
          adaptive_pricing: { enabled: false }, expires_at: Math.floor(Date.parse(order.created_at) / 1000) + 86400,
        }, { idempotencyKey: `store-${order.id}` });
        order = await settle(order, session.id, idOf(session.payment_intent), 'pending');
        if (session.status !== 'open' || !session.url) fail(409, 'Payment is processing. Refresh purchases shortly.');
        return { url: session.url };
      }
      const remote = order.provider_id ? await paypal(`/v2/checkout/orders/${encodeURIComponent(order.provider_id)}`) : await paypal('/v2/checkout/orders', {
        intent: 'CAPTURE', purchase_units: [{ custom_id: order.id, invoice_id: order.id, payee: { merchant_id: config.paypalMerchant },
          amount: { currency_code: 'USD', value: (order.amount / 100).toFixed(2), breakdown: { item_total: { currency_code: 'USD', value: (order.amount / 100).toFixed(2) } } },
          items: order.items.map(i => ({ name: i.name, sku: i.id, quantity: '1', category: 'DIGITAL_GOODS', unit_amount: { currency_code: 'USD', value: (i.amount / 100).toFixed(2) } })) }],
        payment_source: { paypal: { experience_context: { user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: `${ORIGIN}/?store_checkout=return`, cancel_url: `${ORIGIN}/?store_checkout=cancel` } } },
      }, order.id);
      await settle(order, remote.id, null, 'pending');
      const url = remote.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
      if (!url) fail(409, 'Payment is processing. Refresh purchases shortly.');
      return { url };
    },
    async stripeEvent(event: Stripe.Event) {
      if (event.livemode !== (config.mode === 'live') || (event.account && event.account !== config.stripeAccount)) fail(400, 'Wrong payment environment.');
      const object = event.data.object as any;
      let orderId: string | undefined;
      if (event.type.startsWith('checkout.session.')) orderId = object.metadata?.store_order;
      else if (['charge.refunded','charge.dispute.created','charge.dispute.closed'].includes(event.type)) {
        const charge = event.type.startsWith('charge.dispute') ? await stripe!.charges.retrieve(idOf(object.charge)!) : object;
        if (charge.payment_intent) orderId = (await stripe!.paymentIntents.retrieve(idOf(charge.payment_intent)!)).metadata?.store_order;
      } else return;
      if (!orderId) return;
      let order = await find(orderId);
      if (!order || order.provider !== 'stripe') fail(409, 'Unknown order.');
      if (!order.provider_id && event.type.startsWith('checkout.session.')) order = { ...order, provider_id: object.id };
      if (!order.provider_id) fail(409, 'Order binding pending.');
      await reconcile(order);
    },
    async paypalEvent(event: any, headers: Record<string, any>) {
      const verified = await paypal('/v1/notifications/verify-webhook-signature', { auth_algo: headers['paypal-auth-algo'], cert_url: headers['paypal-cert-url'], transmission_id: headers['paypal-transmission-id'], transmission_sig: headers['paypal-transmission-sig'], transmission_time: headers['paypal-transmission-time'], webhook_id: config.paypalWebhook, webhook_event: event });
      if (verified.verification_status !== 'SUCCESS') fail(400, 'Invalid PayPal signature.');
      if (!['CHECKOUT.ORDER.APPROVED','PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.PENDING','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','CUSTOMER.DISPUTE.CREATED','CUSTOMER.DISPUTE.RESOLVED'].includes(event.event_type)) return;
      const resource = event.resource;
      const providerId = event.event_type === 'CHECKOUT.ORDER.APPROVED' ? resource.id : resource.supplementary_data?.related_ids?.order_id;
      const paymentId = resource.supplementary_data?.related_ids?.capture_id || resource.disputed_transactions?.[0]?.seller_transaction_id;
      let query = db.from('bk_store_orders').select('*').eq('provider','paypal').eq('mode',config.mode);
      if (providerId) query = query.eq('provider_id',providerId);
      else if (paymentId) query = query.eq('payment_id',paymentId);
      else if (resource.custom_id) query = query.eq('id',resource.custom_id);
      else fail(409, 'PayPal event could not be bound; retry required.');
      const order = result(await query.maybeSingle()) as StoreOrder | null;
      if (!order) fail(409, 'PayPal order binding pending.');
      if (['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','CUSTOMER.DISPUTE.CREATED','CUSTOMER.DISPUTE.RESOLVED'].includes(event.event_type)) {
        await settle(order, order.provider_id!, order.payment_id, event.event_type.startsWith('CUSTOMER') ? 'disputed' : 'refunded');
      } else await reconcile(order, true);
    },
  };
}
export function runtimeStore() {
  const config = storeConfig(process.env), key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) return null;
  const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gpnboygoosrmeydwjpvk.supabase.co', key, { auth: { persistSession: false, autoRefreshToken: false } });
  return makeStoreCommerce(db, config);
}
export { STORE_WEARABLES };
