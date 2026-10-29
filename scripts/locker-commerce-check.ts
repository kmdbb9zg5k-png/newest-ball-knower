import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {CommerceError,makeCommerce,TEST_ACCOUNT,TEST_PRICES,testConfig,validatePrice,verifiedOutfit,verifiedStatus,type Order} from '../server/lockerCommerce';
import {readRawBody} from '../api/locker-webhook';
import {DEFAULT_OUTFIT} from '../playerWardrobe';
const buyer='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const env={LOCKER_COMMERCE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',LOCKER_TEST_BUYERS:buyer};
const cfg=testConfig(env)!;
assert(cfg);assert.equal(testConfig({}),null);assert.equal(testConfig({...env,STRIPE_SECRET_KEY:'sk_live_fixture'}),null);assert.equal(testConfig({...env,LOCKER_COMMERCE_MODE:'live'}),null);assert.equal(testConfig({...env,LOCKER_TEST_BUYERS:''}),null);
const price={id:TEST_PRICES['top-gold'],active:true,livemode:false,type:'one_time',currency:'usd',unit_amount:100,metadata:{sku:'top-gold',purpose:'locker_sandbox'}} as unknown as Stripe.Price;
validatePrice(price,'top-gold');for(const patch of [{unit_amount:1},{currency:'eur'},{livemode:true},{metadata:{sku:'shoes-gold'}},{active:false},{type:'recurring'}])assert.throws(()=>validatePrice({...price,...patch} as Stripe.Price,'top-gold'));
const order:Order={id:'order-1',user_id:buyer,sku:'top-gold',stripe_account:TEST_ACCOUNT,livemode:false,price_id:price.id,amount:100,currency:'usd',session_id:null,payment_intent:null,status:'pending',created_at:new Date().toISOString()};
const metadata={order_id:order.id,user_id:buyer,sku:'top-gold'};
const session:any={id:'cs_test_1',status:'complete',payment_status:'paid',livemode:false,mode:'payment',client_reference_id:buyer,metadata,amount_total:100,currency:'usd',payment_intent:'pi_test_1'};
const lines:any={has_more:false,data:[{quantity:1,price,amount_total:100}]};
const payment:any={id:'pi_test_1',status:'succeeded',livemode:false,amount:100,amount_received:100,currency:'usd',metadata,latest_charge:{id:'ch_test_1',paid:true,amount:100,currency:'usd',livemode:false,amount_refunded:0,disputed:false}};
assert.equal(verifiedStatus(order,session,lines,payment),'paid');
for(const patch of [{livemode:true},{metadata:{...metadata,user_id:other}},{amount_total:1},{currency:'eur'},{client_reference_id:other},{mode:'subscription'}])assert.throws(()=>verifiedStatus(order,{...session,...patch},lines,payment));
assert.throws(()=>verifiedStatus(order,session,{...lines,has_more:true},payment));
assert.throws(()=>verifiedStatus(order,session,{...lines,data:[{...lines.data[0],quantity:2}]},payment));
assert.throws(()=>verifiedStatus(order,session,lines,{...payment,metadata:{...metadata,user_id:other}}));
assert.equal(verifiedStatus(order,{...session,payment_status:'unpaid'},lines,payment),'pending');
assert.equal(verifiedStatus(order,session,lines,{...payment,latest_charge:{...payment.latest_charge,amount_refunded:1}}),'refunded');
assert.equal(verifiedStatus(order,session,lines,{...payment,latest_charge:{...payment.latest_charge,disputed:true}}),'disputed');
assert.deepEqual(verifiedOutfit({...DEFAULT_OUTFIT,top:'top-gold',shoes:'top-gold'},[]),DEFAULT_OUTFIT);
assert.equal(verifiedOutfit({...DEFAULT_OUTFIT,top:'top-gold'},['top-gold']).top,'top-gold');

// Exercise the service against stateful fakes, including duplicate checkout and
// webhook-before-response. The same RPCs are tested against Postgres separately.
let rows:Order[]=[],outfits:any[]=[],createCalls=0,createdParams:any,accountId=TEST_ACCOUNT;
let fakeSession:any={...session,status:'open',payment_status:'unpaid',payment_intent:null,url:'https://checkout.stripe.com/c/pay/cs_test_1'};
let fakePayment=structuredClone(payment);
const clone=(v:any)=>structuredClone(v);
const db:any={auth:{getUser:async(token:string)=>({data:{user:token==='valid'?{id:buyer}:token==='other'?{id:other}:token==='anon'?{id:buyer,is_anonymous:true}:null},error:null})},
 rpc:async(name:string,args:any)=>{
  if(name==='bk_begin_locker_test_order'){let row=rows.find(r=>r.user_id===args.p_user_id&&r.sku===args.p_sku&&['pending','paid'].includes(r.status));if(!row){row={...clone(order),id:`order-${rows.length+1}`,user_id:args.p_user_id,sku:args.p_sku,price_id:args.p_price};rows.push(row);}return {data:clone(row),error:null};}
  const row=rows.find(r=>r.id===args.p_id)!;
  if(row.session_id&&row.session_id!==args.p_session||row.payment_intent&&row.payment_intent!==args.p_payment)return {error:new Error('binding')};
  row.session_id=args.p_session;row.payment_intent??=args.p_payment;
  if(!['expired','refunded','disputed'].includes(row.status)&&(row.status!=='paid'||['refunded','disputed'].includes(args.p_status)))row.status=args.p_status;
  return {data:clone(row),error:null};
 },from:(table:string)=>{let filters:Array<(v:any)=>boolean>=[],single=false;const q:any={select:()=>q,eq:(key:string,value:any)=>{filters.push(v=>v[key]===value);return q;},in:(key:string,value:any[])=>{filters.push(v=>value.includes(v[key]));return q;},maybeSingle:()=>{single=true;return q;},upsert:async(row:any)=>{outfits=[row];return {data:null,error:null};},then:(resolve:any)=>{const records=(table.endsWith('outfits')?outfits:rows).filter(v=>filters.every(f=>f(v)));return Promise.resolve({data:clone(single?records[0]??null:records),error:null}).then(resolve);}};return q;}};
const fakeStripe:any={accounts:{retrieve:async()=>({id:accountId})},prices:{retrieve:async()=>price},paymentIntents:{retrieve:async()=>clone(fakePayment)},checkout:{sessions:{retrieve:async()=>clone(fakeSession),listLineItems:async()=>lines,list:async()=>({data:[fakeSession]}),create:async(params:any,options:any)=>{createCalls++;createdParams=params;assert.equal(options.idempotencyKey,'bk-locker-test-order-1');assert.equal(params.line_items[0].price,price.id);return clone(fakeSession);}}}};
const service=makeCommerce(db,fakeStripe,cfg);
assert.equal(await service.authenticate('valid'),buyer);
for(const token of ['','bad','anon','other'])await assert.rejects(()=>service.authenticate(token),CommerceError);
await assert.rejects(()=>service.checkout(buyer,'top-standard'),/Unknown/);
await service.checkout(buyer,'top-gold');await service.checkout(buyer,'top-gold');assert.equal(createCalls,1);
assert.equal(createdParams.success_url,'https://ballknowerofficial.com/?locker_checkout=return');assert.equal(createdParams.mode,'payment');assert.equal(createdParams.adaptive_pricing.enabled,false);
assert.deepEqual((await service.state(buyer)).owned,[]);
await assert.rejects(()=>service.equip(buyer,{...DEFAULT_OUTFIT,top:'top-gold'}),/do not own/);
fakeSession=clone(session);
await service.webhook({type:'checkout.session.completed',livemode:false,data:{object:session}} as any);
await service.webhook({type:'checkout.session.completed',livemode:false,data:{object:session}} as any);
assert.deepEqual((await service.state(buyer)).owned,['top-gold']);
assert.deepEqual((await service.state(other)).owned,[]);
await service.equip(buyer,{...DEFAULT_OUTFIT,top:'top-gold'});assert.equal((await service.state(buyer)).outfit?.top,'top-gold');
await assert.rejects(()=>service.checkout(buyer,'top-gold'),/already own/);
await assert.rejects(()=>service.webhook({type:'checkout.session.completed',livemode:true,data:{object:session}} as any));
fakePayment.latest_charge.amount_refunded=100;
await service.webhook({type:'charge.refunded',livemode:false,data:{object:{payment_intent:payment.id}}} as any);
assert.deepEqual((await service.state(buyer)).owned,[]);assert.equal((await service.state(buyer)).outfit?.top,'top-standard');
fakePayment=clone(payment);await service.webhook({type:'checkout.session.completed',livemode:false,data:{object:session}} as any);assert.deepEqual((await service.state(buyer)).owned,[]);
accountId='acct_wrong';await assert.rejects(()=>makeCommerce(db,fakeStripe,cfg).checkout(buyer,'top-gold'),/Wrong sandbox/);

// The real SDK must reject forged or stale webhook signatures and parsed bodies.
const sdk=new Stripe('sk_test_fixture'),payload=JSON.stringify({type:'checkout.session.completed',livemode:false});
const signature=sdk.webhooks.generateTestHeaderString({payload,secret:cfg.webhook});
assert.equal(sdk.webhooks.constructEvent(payload,signature,cfg.webhook).type,'checkout.session.completed');
assert.throws(()=>sdk.webhooks.constructEvent(payload+' ',signature,cfg.webhook));
assert.throws(()=>sdk.webhooks.constructEvent(payload,signature,'whsec_wrong'));
const stale=sdk.webhooks.generateTestHeaderString({payload,secret:cfg.webhook,timestamp:1});assert.throws(()=>sdk.webhooks.constructEvent(payload,stale,cfg.webhook));
await assert.rejects(()=>readRawBody({body:JSON.parse(payload)}));
assert.equal((await readRawBody({body:Buffer.from(payload)})).toString(),payload);
console.log('PASS sandbox gates, auth/anonymous/cross-user, amounts, duplicate checkout, pending/paid, restore/equip, refund/replay, account binding and signed raw webhook.');
