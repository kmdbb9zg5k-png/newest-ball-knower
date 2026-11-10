import { CommerceError } from '../server/lockerCommerce.js';
import { runtimeStore } from '../server/storeCommerce.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  const store = runtimeStore();
  if (!store) return res.status(req.method === 'GET' ? 200 : 503).json({ stripe: false, paypal: false, owned: [], error: 'Payments are not open yet. Your cart is saved.' });
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (req.method === 'GET' && !token) return res.status(200).json({ mode: store.config.mode, stripe: store.config.mode === 'live' && store.config.stripe, paypal: store.config.mode === 'live' && store.config.paypal, owned: [] });
    const user = await store.authenticate(token);
    if (req.method === 'GET') return res.status(200).json(await store.state(user));
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (body?.action === 'equip') return res.status(200).json(await store.equip(user, body.outfit));
    if (body?.action === 'restore') return res.status(200).json(await store.state(user));
    if (body?.action === 'cancel') return res.status(200).json(await store.cancel(user));
    if (body?.action === 'checkout') return res.status(200).json(await store.checkout(user, body.ids, body.provider));
    return res.status(400).json({ error: 'Unknown store action.' });
  } catch (e) { return res.status(e instanceof CommerceError ? e.status : 503).json({ error: e instanceof CommerceError ? e.message : 'Checkout could not be verified. Your cart is saved; please try again.' }); }
}
