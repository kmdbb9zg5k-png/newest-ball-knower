import assert from 'node:assert/strict';
import { cleanCart, cartTotal } from '../storeCart';
import { storeConfig, storeItems, verifyStripeOrder, verifyPayPalOrder, type StoreOrder } from '../server/storeCommerce';
assert.deepEqual(cleanCart(['gold-standard','tunnel-fit','tunnel-fit','frostbite','bfk-dee',null,'__proto__']), ['frostbite','gold-standard','tunnel-fit']);
assert.equal(cartTotal(['gold-standard','tunnel-fit']),598);
for(const input of [null,[],['frostbite'],['tunnel-fit','tunnel-fit'],[{id:'tunnel-fit',amount:1}]]) assert.throws(()=>storeItems(input));
const items=storeItems(['tunnel-fit','gold-standard']);
assert.equal(items.reduce((s,i)=>s+i.amount,0),598);
const env={STORE_COMMERCE_MODE:'test',STORE_STRIPE_KEY:'rk_test_fixture',STORE_STRIPE_ACCOUNT:'acct_fixture',STORE_STRIPE_WEBHOOK_SECRET:'whsec_fixture',STORE_TEST_BUYERS:'buyer'};
const testConfig = storeConfig(env)!;
assert.equal(testConfig.prices.frostbite, 100);
assert.deepEqual(storeItems(['frostbite','gold-standard'], testConfig.prices).map(({id,kind,amount})=>[id,kind,amount]), [
  ['frostbite','character',100], ['gold-standard',undefined,299],
]);
const liveEnv = {...env, STORE_COMMERCE_MODE:'live', STORE_STRIPE_KEY:'rk_live_fixture'};
assert.equal(storeConfig(liveEnv)!.prices.frostbite, undefined);
const liveConfig = storeConfig({...liveEnv, STORE_CHARACTER_PRICES:JSON.stringify({frostbite:499,'bfk-dee':799,'bkf-kickflip':0,'bk-femme':'999'})})!;
assert.equal(liveConfig.prices.frostbite, 499);
assert.equal(liveConfig.prices['bfk-dee'], undefined);
assert.throws(()=>storeItems(['bkf-kickflip'],liveConfig.prices));
assert.throws(()=>storeItems(['bk-femme'],liveConfig.prices));
assert(storeConfig(env));assert.equal(storeConfig({}),null);assert.equal(storeConfig({...env,STORE_TEST_BUYERS:''}),null);assert.equal(storeConfig({...env,STORE_STRIPE_KEY:'rk_live_fixture'}),null);
const order:StoreOrder={id:'order',user_id:'buyer',mode:'test',provider:'stripe',items,amount:598,provider_id:'cs_1',payment_id:null,status:'pending',created_at:new Date().toISOString()};
const session:any={id:'cs_1',livemode:false,mode:'payment',metadata:{store_order:'order'},client_reference_id:'buyer',amount_subtotal:598,amount_total:598,currency:'usd',status:'complete',payment_status:'paid',payment_intent:'pi_1'};
const lines:any={has_more:false,data:items.map(i=>({quantity:1,amount_subtotal:i.amount,amount_total:i.amount,amount_discount:0,amount_tax:0,currency:'usd',price:{product:{metadata:{store_sku:i.id}}}}))};
const payment:any={id:'pi_1',livemode:false,metadata:{store_order:'order',user_id:'buyer'},amount:598,amount_received:598,currency:'usd',status:'succeeded',latest_charge:{paid:true,amount:598,currency:'usd',livemode:false,amount_refunded:0,disputed:false}};
assert.equal(verifyStripeOrder(order,session,lines,payment),'paid');
for(const patch of [{client_reference_id:'other'},{livemode:true},{id:'cs_other'},{amount_total:1},{currency:'eur'}])assert.throws(()=>verifyStripeOrder(order,{...session,...patch},lines,payment));
assert.throws(()=>verifyStripeOrder(order,session,{...lines,data:[lines.data[0],lines.data[0]]},payment));
assert.throws(()=>verifyStripeOrder(order,session,{...lines,data:[{...lines.data[0],quantity:2},lines.data[1]]},payment));
assert.equal(verifyStripeOrder(order,{...session,payment_status:'unpaid'},lines,payment),'pending');
assert.equal(verifyStripeOrder(order,session,lines,{...payment,latest_charge:{...payment.latest_charge,amount_refunded:1}}),'refunded');
assert.equal(verifyStripeOrder(order,session,lines,{...payment,latest_charge:{...payment.latest_charge,disputed:true}}),'disputed');
const promoSession = {...session,allow_promotion_codes:true,amount_total:538,total_details:{amount_discount:60,amount_tax:0,amount_shipping:0}};
const promoLines = {...lines,data:lines.data.map((line:any)=>({...line,amount_discount:30,amount_total:269}))};
const promoPayment = {...payment,amount:538,amount_received:538,latest_charge:{...payment.latest_charge,amount:538}};
assert.equal(verifyStripeOrder(order,promoSession,promoLines,promoPayment),'paid');
assert.equal(verifyStripeOrder(order,promoSession,promoLines,{...promoPayment,amount_received:537}),'pending');
assert.equal(verifyStripeOrder(order,promoSession,promoLines,{...promoPayment,latest_charge:{...promoPayment.latest_charge,amount_refunded:1}}),'refunded');
assert.throws(()=>verifyStripeOrder(order,promoSession,promoLines,payment));
for (const patch of [{allow_promotion_codes:false},{amount_subtotal:538},{total_details:{amount_discount:59}},{total_details:{amount_discount:60,amount_tax:1}}]) {
  assert.throws(()=>verifyStripeOrder(order,{...promoSession,...patch},promoLines,promoPayment));
}
assert.throws(()=>verifyStripeOrder(order,promoSession,{...promoLines,data:[{...promoLines.data[0],amount_subtotal:269},promoLines.data[1]]},promoPayment));
const freeSession = {...promoSession,amount_total:0,total_details:{amount_discount:598},payment_status:'no_payment_required',payment_intent:null};
const freeLines = {...lines,data:lines.data.map((line:any)=>({...line,amount_discount:line.amount_subtotal,amount_total:0}))};
assert.equal(verifyStripeOrder(order,freeSession,freeLines,null),'paid');
assert.equal(verifyStripeOrder(order,{...freeSession,status:'open'},freeLines,null),'pending');
assert.equal(verifyStripeOrder(order,{...freeSession,payment_status:'unpaid'},freeLines,null),'pending');
assert.equal(verifyStripeOrder({...order,payment_id:'pi_previous'},freeSession,freeLines,null),'pending');
const ppOrder={...order,provider:'paypal' as const,provider_id:'pp_1'};
const remote:any={id:'pp_1',intent:'CAPTURE',status:'COMPLETED',purchase_units:[{custom_id:'order',payee:{merchant_id:'merchant'},amount:{value:'5.98',currency_code:'USD'},payments:{captures:[{id:'capture_1',status:'COMPLETED',amount:{value:'5.98',currency_code:'USD'}}]}}]};
assert.deepEqual(verifyPayPalOrder(ppOrder,remote,'merchant'),{status:'paid',payment:'capture_1'});
assert.throws(()=>verifyPayPalOrder(ppOrder,remote,'wrong'));
for(const mutate of [(r:any)=>r.id='wrong',(r:any)=>r.purchase_units[0].custom_id='wrong',(r:any)=>r.purchase_units[0].amount.value='0.01',(r:any)=>r.purchase_units[0].payments.captures[0].amount.currency_code='EUR']){const r=structuredClone(remote);mutate(r);assert.throws(()=>verifyPayPalOrder(ppOrder,r,'merchant'));}
remote.purchase_units[0].payments.captures[0].status='PENDING';assert.equal(verifyPayPalOrder(ppOrder,remote,'merchant').status,'pending');
remote.purchase_units[0].payments.captures[0].status='REFUNDED';assert.equal(verifyPayPalOrder(ppOrder,remote,'merchant').status,'refunded');
console.log('PASS: cart sanitization, authoritative totals, configuration isolation, Stripe/PayPal verification, promo codes, pending payments, refunds and disputes');
