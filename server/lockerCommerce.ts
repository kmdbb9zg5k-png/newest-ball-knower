import Stripe from 'stripe';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {CLOTHING,CLOTHING_SLOTS,cleanOutfit,type Outfit} from '../playerWardrobe.js';

export const TEST_ACCOUNT='acct_1UVzIs7OIO7jIgo7';
// These are $1 sandbox fixtures, NOT approved retail prices.
export const TEST_PRICES:Record<string,string>={
 'top-gold':'price_1UVzrU7OIO7jIgo743aFAHZG',
 'top-electric':'price_1UVzri7OIO7jIgo7IwChYAzD',
 'shoes-gold':'price_1UVzrl7OIO7jIgo7jd2gvCAH',
 'wrist-gold':'price_1UVzrn7OIO7jIgo7N1MlksZR',
};
export class CommerceError extends Error {constructor(public status:number,message:string){super(message);}}
const fail=(status:number,message:string):never=>{throw new CommerceError(status,message);};
export function testConfig(env:Record<string,string|undefined>){
 const key=env.STRIPE_SECRET_KEY||'',webhook=env.STRIPE_WEBHOOK_SECRET||'';
 const buyers=(env.LOCKER_TEST_BUYERS||'').split(',').map(v=>v.trim()).filter(v=>/^[a-f\d-]{36}$/i.test(v));
 if(env.LOCKER_COMMERCE_MODE!=='test'||!/^sk_test_/.test(key)||!webhook.startsWith('whsec_')||!buyers.length)return null;
 return {key,webhook,buyers};
}
export type Order={id:string;user_id:string;sku:string;stripe_account:string;livemode:boolean;price_id:string;amount:number;currency:string;session_id:string|null;payment_intent:string|null;status:string;created_at:string};
export function validatePrice(price:Stripe.Price,sku:string){
 if(!TEST_PRICES[sku]||price.id!==TEST_PRICES[sku]||price.livemode||!price.active||price.type!=='one_time'||price.currency!=='usd'||price.unit_amount!==100||price.metadata?.sku!==sku||price.metadata?.purpose!=='locker_sandbox'||price.custom_unit_amount||price.transform_quantity)fail(503,'This test item is unavailable.');
}
const idOf=(value:any):string|null=>typeof value==='string'?value:value?.id||null;
export function verifiedStatus(order:Order,session:Stripe.Checkout.Session,lines:Stripe.ApiList<Stripe.LineItem>,payment:Stripe.PaymentIntent|null):string{
 const meta=session.metadata;
 if(order.livemode||order.stripe_account!==TEST_ACCOUNT||session.livemode||session.mode!=='payment'||meta?.order_id!==order.id||meta?.user_id!==order.user_id||meta?.sku!==order.sku||session.client_reference_id!==order.user_id||(order.session_id&&order.session_id!==session.id)||lines.has_more||lines.data.length!==1)fail(409,'Purchase verification failed.');
 const line=lines.data[0];
 if(line.quantity!==1||line.price?.id!==order.price_id||line.amount_total!==order.amount||session.amount_total!==order.amount||session.currency!==order.currency)fail(409,'Purchase amount verification failed.');
 if(payment){
  if(payment.livemode||payment.id!==idOf(session.payment_intent)||(order.payment_intent&&order.payment_intent!==payment.id)||payment.amount!==order.amount||payment.currency!==order.currency||payment.metadata?.order_id!==order.id||payment.metadata?.user_id!==order.user_id||payment.metadata?.sku!==order.sku)fail(409,'Payment verification failed.');
  const charge=typeof payment.latest_charge==='object'?payment.latest_charge:null;
  if(charge?.disputed)return 'disputed';
  if(charge&&(charge.refunded||charge.amount_refunded>0))return 'refunded';
  if(session.status==='complete'&&session.payment_status==='paid'&&payment.status==='succeeded'&&payment.amount_received===order.amount&&charge?.paid&&!charge.livemode&&charge.amount===order.amount&&charge.currency===order.currency)return 'paid';
 }
 return session.status==='expired'?'expired':'pending';
}
export function verifiedOutfit(raw:unknown,owned:string[]):Outfit{
 const result=cleanOutfit(raw),value=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 for(const slot of CLOTHING_SLOTS){const item=CLOTHING.find(v=>v.id===value[slot]&&v.slot===slot);if(item?.premium&&owned.includes(item.id))result[slot]=item.id;}
 return result;
}
export function makeCommerce(db:SupabaseClient,stripe:Stripe,config:NonNullable<ReturnType<typeof testConfig>>){
 let accountChecked:Promise<void>|null=null;
 const checkAccount=()=>accountChecked??=(async()=>{const account=await stripe.accounts.retrieve(null);if(account.id!==TEST_ACCOUNT)fail(503,'Wrong sandbox account.');})().catch(e=>{accountChecked=null;throw e;});
 const result=<T>(r:{data:T;error:any}):T=>{if(r.error)throw new Error('Locker database unavailable');return r.data;};
 const orders=async(userId:string)=>result(await db.from('bk_locker_test_orders').select('*').eq('user_id',userId).in('status',['pending','paid'])) as Order[];
 const settle=async(order:Order,session:Stripe.Checkout.Session,status:string)=>result(await db.rpc('bk_settle_locker_test_order',{p_id:order.id,p_session:session.id,p_payment:idOf(session.payment_intent),p_status:status})) as Order;
 async function reconcile(order:Order,sessionId=order.session_id){
  if(!sessionId)return order;
  await checkAccount();
  const session=await stripe.checkout.sessions.retrieve(sessionId);
  const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:2});
  const paymentId=idOf(session.payment_intent);
  const payment=paymentId?await stripe.paymentIntents.retrieve(paymentId,{expand:['latest_charge']}):null;
  return settle(order,session,verifiedStatus(order,session,lines,payment));
 }
 async function state(userId:string){
  const active=await orders(userId);
  // Also reconcile on reads: refunds and a missed webhook must not leave stale grants.
  const verified=await Promise.all(active.map(order=>reconcile(order)));
  const owned=verified.filter(v=>v.status==='paid').map(v=>v.sku);
  const row=result(await db.from('bk_locker_test_outfits').select('outfit').eq('user_id',userId).maybeSingle());
  return {available:true,mode:'test' as const,owned,outfit:row?verifiedOutfit(row.outfit,owned):null,pending:verified.some(v=>v.status==='pending'),prices:Object.fromEntries(Object.keys(TEST_PRICES).map(sku=>[sku,{amount:100,currency:'usd'}]))};
 }
 return {
  async authenticate(token:string){
   if(!token)fail(401,'Sign in to your account.');
   const auth=await db.auth.getUser(token),user=auth.data.user;
   if(auth.error||!user||user.is_anonymous)fail(401,'Sign in to your account.');
   if(!config.buyers.includes(user.id))fail(403,'Purchases are being tested privately.');
   return user.id;
  },
  state,
  async equip(userId:string,raw:unknown){
   const current=await state(userId),outfit=verifiedOutfit(raw,current.owned);
   if(!raw||CLOTHING_SLOTS.some(slot=>outfit[slot]!==raw[slot]))fail(403,'You do not own that outfit.');
   result(await db.from('bk_locker_test_outfits').upsert({user_id:userId,outfit,updated_at:new Date().toISOString()}));
   return {...current,outfit};
  },
  async checkout(userId:string,sku:string){
   if(!Object.hasOwn(TEST_PRICES,sku))fail(400,'Unknown clothing item.');
   await checkAccount();validatePrice(await stripe.prices.retrieve(TEST_PRICES[sku]),sku);
   let order=result(await db.rpc('bk_begin_locker_test_order',{p_user_id:userId,p_sku:sku,p_price:TEST_PRICES[sku]})) as Order;
   if(order.session_id){
    order=await reconcile(order);
    if(order.status==='expired'||order.status==='refunded'||order.status==='disputed')order=result(await db.rpc('bk_begin_locker_test_order',{p_user_id:userId,p_sku:sku,p_price:TEST_PRICES[sku]})) as Order;
   }
   if(order.status==='paid')fail(409,'You already own this item. Restore your purchases.');
   // Stripe retains idempotency keys for at least 24 hours. Never recreate an
   // unbound, old order whose session may have been created before a network loss.
   if(!order.session_id&&Date.now()-Date.parse(order.created_at)>23*60*60*1000)fail(409,'This checkout needs support before it can be retried.');
   const metadata={order_id:order.id,user_id:userId,sku};
   const session=order.session_id?await stripe.checkout.sessions.retrieve(order.session_id):await stripe.checkout.sessions.create({
    mode:'payment',client_reference_id:userId,line_items:[{price:order.price_id,quantity:1}],metadata,payment_intent_data:{metadata},
    success_url:'https://ballknowerofficial.com/?locker_checkout=return',cancel_url:'https://ballknowerofficial.com/?locker_checkout=cancel',
    adaptive_pricing:{enabled:false},expires_at:Math.floor(Date.parse(order.created_at)/1000)+1800,
   },{idempotencyKey:`bk-locker-test-${order.id}`});
   await reconcile(order,session.id);
   if(session.status!=='open'||!session.url||new URL(session.url).hostname!=='checkout.stripe.com'||new URL(session.url).protocol!=='https:')fail(409,'Checkout is processing. Restore your purchases shortly.');
   return {url:session.url};
  },
  async webhook(event:Stripe.Event){
   if(event.livemode||event.account&&event.account!==TEST_ACCOUNT)fail(400,'Wrong event account or mode.');
   const supported=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired','charge.refunded','charge.dispute.created','charge.dispute.closed'];
   if(!supported.includes(event.type))return;
   await checkAccount();
   const object=event.data.object as any;
   let orderId:string|undefined,sessionId:string|undefined;
   if(event.type.startsWith('checkout.session.')){orderId=object.metadata?.order_id;sessionId=object.id;}
   else {
    let paymentId=idOf(object.payment_intent);
    if(!paymentId&&idOf(object.charge)){const charge=await stripe.charges.retrieve(idOf(object.charge)!);paymentId=idOf(charge.payment_intent);}
    if(!paymentId)return;
    const payment=await stripe.paymentIntents.retrieve(paymentId);orderId=payment.metadata?.order_id;
   }
   if(!orderId)return; // Other sandbox products do not belong to the Locker.
   const order=result(await db.from('bk_locker_test_orders').select('*').eq('id',orderId).maybeSingle()) as Order|null;
   if(!order)fail(409,'Unknown purchase order.');
   if(!sessionId&&!order.session_id){
    const paymentId=idOf(object.payment_intent);
    if(paymentId){const sessions=await stripe.checkout.sessions.list({payment_intent:paymentId,limit:2});sessionId=sessions.data.find(s=>s.metadata?.order_id===orderId)?.id;}
   }
   if(!sessionId&&!order.session_id)fail(409,'Purchase binding is pending. Retry webhook.');
   await reconcile(order,sessionId||order.session_id);
  }
 };
}
export function runtimeCommerce(){
 const config=testConfig(process.env),key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!config||!key)return null;
 const db=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'https://gpnboygoosrmeydwjpvk.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}});
 const stripe=new Stripe(config.key,{maxNetworkRetries:2,timeout:12000});
 return {commerce:makeCommerce(db,stripe,config),stripe,config};
}
