import { readRawBody } from './locker-webhook.js';
import { CommerceError } from '../server/lockerCommerce.js';
import { runtimeStore } from '../server/storeCommerce.js';
export const config = { api: { bodyParser: false } };
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const store = runtimeStore();
  if (!store) return res.status(503).json({ error: 'Store not configured' });
  try {
    const raw = await readRawBody(req);
    if (req.query?.provider === 'paypal') {
      if (!store.config.paypal) return res.status(503).end();
      await store.paypalEvent(JSON.parse(raw.toString()), req.headers);
    } else {
      if (!store.stripe) return res.status(503).end();
      let event;
      try { event = store.stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'] || '', store.config.stripeWebhook); }
      catch { return res.status(400).json({ error: 'Invalid signature' }); }
      await store.stripeEvent(event);
    }
    return res.status(200).json({ received: true });
  } catch (e) { return res.status(e instanceof CommerceError && e.status === 400 ? 400 : 500).json({ error: 'Payment verification incomplete; retry required' }); }
}
