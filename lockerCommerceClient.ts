import {Capacitor} from '@capacitor/core';
import {supabase} from './supabase';
import {setVerifiedWardrobe,type Outfit} from './playerWardrobe';
export type LockerState={available:boolean;mode?:'test';owned:string[];outfit?:Outfit|null;pending?:boolean;prices:Record<string,{amount:number;currency:string}>};
const EMPTY:LockerState={available:false,owned:[],prices:{}};
let snapshot=EMPTY,userId:string|null=null,epoch=0,requestId=0;
const listeners=new Set<()=>void>();
export const readLockerState=()=>snapshot;
export const subscribeLocker=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
function publish(next:LockerState){snapshot=next;setVerifiedWardrobe(next.available?{owned:next.owned,outfit:next.outfit??null}:null);listeners.forEach(listener=>listener());}
export function resetLockerIdentity(next:string|null){if(next===userId)return;userId=next;epoch++;requestId++;publish(EMPTY);}
async function session(){const {data}=await supabase.auth.getSession();const s=data.session;return s&&!s.user.is_anonymous?s:null;}
async function api(token:string,body?:unknown){
 const response=await fetch('/api/locker-commerce',{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(30000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not reach the Locker.');return data;
}
export async function refreshLocker(){
 if(Capacitor.isNativePlatform()){publish(EMPTY);return EMPTY;}
 const before=epoch,s=await session();if(before!==epoch)return snapshot;
 resetLockerIdentity(s?.user.id||null);
 if(!s){publish(EMPTY);return EMPTY;}
 const mine=++requestId,identity=epoch;
 try{const data=await api(s.access_token);if(mine===requestId&&identity===epoch)publish(data.available&&data.mode==='test'?data:EMPTY);}
 catch{if(mine===requestId&&identity===epoch)publish(EMPTY);}
 return snapshot;
}
export async function lockerAction(action:'restore'|'equip'|'checkout',extra:Record<string,unknown>={}){
 if(Capacitor.isNativePlatform())throw new Error('Purchases are not available in this app yet.');
 const s=await session();if(!s||s.user.id!==userId)throw new Error('Sign in again to use the Locker.');
 const identity=epoch;requestId++; // Discard any earlier reads that finish after this mutation.
 const data=await api(s.access_token,{...extra,action});
 if(identity!==epoch)throw new Error('Your account changed. Please try again.');
 if(action==='checkout'){
  const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Checkout could not be opened.');
  window.location.assign(url.href);
 }else await refreshLocker();
 return data;
}
