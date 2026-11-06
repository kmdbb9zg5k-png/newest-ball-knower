import {Capacitor} from '@capacitor/core';
import {supabase} from './supabase';
import {PUSH_OPEN_EVENT,PUSH_STATE_EVENT,UUID_PATTERN,type PushDevice,type PushReadiness,type PushSettings,type PushTarget} from './pushContracts';

const INSTALLATION_KEY='ballknower_push_installation_v1';
type Installation={installationId:string;installationSecret:string;ownerId?:string;enabled?:boolean};
type DeviceState={installationId?:string;supported:boolean;permission:'default'|'granted'|'denied'|'unavailable';enabled:boolean;native:boolean;detail?:string};
let nativeToken='';
let nativeListeners:Promise<void>|null=null;
let registrationWaiter:{resolve:(token:string)=>void;reject:(error:Error)=>void}|null=null;
let clientStarted=false;
let explicitGeneration=0;
let authGeneration=0;
let nativeRegistration:Promise<string>|null=null;
let localTransportOperations:Promise<unknown>=Promise.resolve();
function withLocalTransport<T>(operation:()=>Promise<T>):Promise<T>{
  const result=localTransportOperations.catch(()=>undefined).then(operation);
  localTransportOperations=result.catch(()=>undefined);return result;
}
const changed=()=>window.dispatchEvent(new Event(PUSH_STATE_EVENT));
function installation(create=false):Installation|null{
  try{
    const stored=JSON.parse(localStorage.getItem(INSTALLATION_KEY)||'null');
    if(stored&&UUID_PATTERN.test(stored.installationId)&&/^[A-Za-z0-9_-]{43}$/.test(stored.installationSecret))return stored;
    if(!create)return null;
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const value:Installation={installationId:crypto.randomUUID(),installationSecret:btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')};
    localStorage.setItem(INSTALLATION_KEY,JSON.stringify(value));return value;
  }catch{if(create)throw new Error('Allow device storage before enabling push notifications.');return null;}
}
const save=(value:Installation)=>{localStorage.setItem(INSTALLATION_KEY,JSON.stringify(value));changed();};
async function session(expectedOwner?:string){
  const result=await supabase?.auth.getSession();
  const current=result?.data.session;
  if(!current||current.user.is_anonymous||expectedOwner&&current.user.id!==expectedOwner)throw new Error('Sign in to a permanent account to manage push notifications.');
  return current;
}
async function request<T>(resource:string,body?:Record<string,unknown>,expectedOwner?:string,accessToken?:string):Promise<T>{
  const current=accessToken?null:await session(expectedOwner);
  const response=await fetch(`/api/push${resource?`?${resource}`:''}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${accessToken||current!.access_token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12_000)});
  let result:any;try{result=await response.json();}catch{throw new Error('Push services could not be reached. Try again.');}
  if(!response.ok)throw Object.assign(new Error(typeof result?.error==='string'?result.error:'Push settings could not be saved.'),{code:result?.code});
  if(current)await session(current.user.id);
  return result as T;
}
export async function getPushReadiness():Promise<PushReadiness>{
  const response=await fetch('/api/push?resource=config',{signal:AbortSignal.timeout(10_000),cache:'no-store'});
  if(!response.ok)throw new Error('Push availability could not be checked.');return response.json();
}
export const getPushSettings=(owner:string)=>request<PushSettings>('resource=settings',undefined,owner);
export const savePushSettings=(settings:PushSettings,owner:string)=>request<PushSettings>('',{action:'settings',...settings},owner);
export const getPushDevices=(owner:string)=>request<PushDevice[]>('resource=devices',undefined,owner);
export const revokePushDevice=(deviceId:string,owner:string)=>request<{ok:boolean}>('',{action:'revoke-device',deviceId},owner);
export const resolvePushTarget=(id:string,owner:string)=>request<PushTarget>(`resource=notification&id=${encodeURIComponent(id)}`,undefined,owner);

const iosInstalled=()=>!(/iPad|iPhone|iPod/.test(navigator.userAgent))||window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
async function worker(){
  const registered=await navigator.serviceWorker.register('/push-worker.js',{scope:'/',updateViaCache:'none'});
  // Do not await navigator.serviceWorker.ready indefinitely when the first worker is installing.
  if(!registered.active)await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Push setup is still starting. Try again.')),10_000))]);
  return registered;
}
async function addNativeListeners(){
  if(nativeListeners)return nativeListeners;
  nativeListeners=(async()=>{
    const {PushNotifications}=await import('@capacitor/push-notifications');
    await PushNotifications.addListener('registration',({value})=>{nativeToken=value;registrationWaiter?.resolve(value);});
    await PushNotifications.addListener('registrationError',()=>registrationWaiter?.reject(new Error('iPhone push registration failed. Try again.')));
    await PushNotifications.addListener('pushNotificationActionPerformed',event=>{
      const id=event.notification.data?.notificationId;
      if(typeof id==='string'&&UUID_PATTERN.test(id))window.dispatchEvent(new CustomEvent(PUSH_OPEN_EVENT,{detail:{notificationId:id}}));
    });
  })().catch(error=>{nativeListeners=null;throw error;});
  return nativeListeners;
}
async function registerNative():Promise<string>{
  if(nativeRegistration)return nativeRegistration;
  nativeRegistration=(async()=>{
  await addNativeListeners();
  const {PushNotifications}=await import('@capacitor/push-notifications');
  return new Promise<string>((resolve,reject)=>{
    const timeout=setTimeout(()=>{registrationWaiter=null;reject(new Error('iPhone registration timed out. Try again.'));},12_000);
    registrationWaiter={resolve:token=>{clearTimeout(timeout);registrationWaiter=null;resolve(token);},reject:error=>{clearTimeout(timeout);registrationWaiter=null;reject(error);}};
    void PushNotifications.register().catch(()=>registrationWaiter?.reject(new Error('iPhone push registration failed.')));
  });
  })();
  try{return await nativeRegistration;}finally{nativeRegistration=null;}
}
export async function getPushDeviceState(owner:string):Promise<DeviceState>{
  const current=installation();
  if(Capacitor.isNativePlatform()){
    if(Capacitor.getPlatform()!=='ios')return {supported:false,permission:'unavailable',enabled:false,native:true,detail:'Push is not available on this platform yet.'};
    const {PushNotifications}=await import('@capacitor/push-notifications');
    const permission=await PushNotifications.checkPermissions();
    return {installationId:current?.installationId,supported:true,permission:permission.receive==='granted'?'granted':permission.receive==='denied'?'denied':'default',enabled:Boolean(current?.enabled&&current.ownerId===owner),native:true};
  }
  const supported=Boolean(window.isSecureContext&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window&&iosInstalled());
  return {installationId:current?.installationId,supported,permission:supported?Notification.permission:'unavailable',enabled:Boolean(supported&&current?.enabled&&current.ownerId===owner),native:false,detail:supported?undefined:!iosInstalled()?'On iPhone, add Ball Knower to your Home Screen, then enable alerts there.':'This browser does not support push notifications. In-app alerts remain available.'};
}
const deviceLabel=()=>Capacitor.isNativePlatform()?'Ball Knower on iPhone':/iPhone|iPad/.test(navigator.userAgent)?'Home Screen on iPhone':/Firefox/.test(navigator.userAgent)?'Firefox browser':/Chrome|Chromium/.test(navigator.userAgent)?'Chrome browser':'My browser';

/** Called by an explicit button gesture; this is the only permission-requesting path. */
export async function enablePush(owner:string,readiness:PushReadiness){
  const generation=++explicitGeneration;
  // Safari requires requestPermission while the Enable click still has transient activation.
  const browserPermission=!Capacitor.isNativePlatform()&&readiness.web.ready&&'Notification' in window&&Notification.permission==='default'?Notification.requestPermission():null;
  const current=await session(owner),state=await getPushDeviceState(owner);
  if(!state.supported)throw new Error(state.detail||'Push is unavailable on this device.');
  if(state.permission==='denied')throw new Error('Notifications are blocked. Allow them in your device or browser settings, then try again.');
  if(state.native?!readiness.apns.ready:!readiness.web.ready)throw new Error('Push delivery is not configured for this device yet.');
  const device=installation(true)!;
  try{
  if(state.native){
    const {PushNotifications}=await import('@capacitor/push-notifications');
    const permission=await PushNotifications.requestPermissions();
    if(permission.receive!=='granted'){changed();throw new Error('Notifications are not allowed. You can change this in iPhone Settings.');}
    const token=await withLocalTransport(registerNative);
    await request('',{action:'subscribe',installationId:device.installationId,installationSecret:device.installationSecret,transport:'apns',token,label:deviceLabel()},owner);
  }else{
    if(browserPermission&&await browserPermission!=='granted'){changed();throw new Error('Notifications are not allowed. You can change this in browser settings.');}
    const subscription=await withLocalTransport(async()=>{
    const registration=await worker();
    let subscription=await registration.pushManager.getSubscription();
    const key=readiness.web.publicKey!;
    const keyBytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),character=>character.charCodeAt(0));
    if(subscription){
      const old=subscription.options.applicationServerKey;
      if(old&&BufferlessBase64(old)!==key){await subscription.unsubscribe();subscription=null;}
    }
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes});
    return subscription;
    });
    await request('',{action:'subscribe',installationId:device.installationId,installationSecret:device.installationSecret,transport:'web',subscription:subscription.toJSON(),label:deviceLabel()},owner);
  }
  await session(current.user.id);
  if(generation===explicitGeneration)save({...device,ownerId:owner,enabled:true});
  }catch(error){
    if(generation===explicitGeneration)await Promise.allSettled([request('',{action:'unsubscribe',installationId:device.installationId,installationSecret:device.installationSecret},owner,current.access_token),withLocalTransport(unsubscribeLocal)]);
    throw error;
  }
}
function BufferlessBase64(buffer:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
async function unsubscribeLocal(){
  if(Capacitor.isNativePlatform()){
    if(Capacitor.getPlatform()==='ios'){const {PushNotifications}=await import('@capacitor/push-notifications');await PushNotifications.unregister();await PushNotifications.removeAllDeliveredNotifications();nativeToken='';}
  }else if('serviceWorker' in navigator){
    const registration=await navigator.serviceWorker.getRegistration('/push-worker.js');
    const subscription=await registration?.pushManager.getSubscription();if(subscription)await subscription.unsubscribe();
    for(const notification of await registration?.getNotifications()||[])notification.close();
  }
}
export async function disablePush(owner:string,accessToken?:string){
  const generation=++explicitGeneration;
  const device=installation();if(!device||device.ownerId!==owner||!device.enabled)return;
  const outcomes=await Promise.allSettled([
    request('',{action:'unsubscribe',installationId:device.installationId,installationSecret:device.installationSecret},owner,accessToken),
    withLocalTransport(unsubscribeLocal),
  ]);
  if(generation!==explicitGeneration)return;
  if(outcomes.every(result=>result.status==='rejected'))throw new Error('Push could not be disabled. Try again before changing accounts.');
  save({...device,ownerId:undefined,enabled:false});
}
export async function beforePushSignOut(){
  const result=await supabase?.auth.getSession();
  const current=result?.data.session;
  if(current&&!current.user.is_anonymous)await disablePush(current.user.id,current.access_token);
}

/** Restore opted-in registration only; never prompt, create a subscription or reload app code. */
export async function initializePushClient(){
  if(clientStarted||!supabase)return;
  clientStarted=true;
  if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type==='ballknower:push-open'&&UUID_PATTERN.test(event.data.notificationId))window.dispatchEvent(new CustomEvent(PUSH_OPEN_EVENT,{detail:{notificationId:event.data.notificationId}}));
  });
  if(Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios')await addNativeListeners();
  let previousToken='',previousOwner='';
  const synchronize=async(accessToken:string,owner:string,anonymous=false)=>{
    const device=installation();
    if(device?.enabled&&device.ownerId&&(device.ownerId!==owner||anonymous)){
      await disablePush(device.ownerId,previousOwner===device.ownerId?previousToken:undefined).catch(()=>withLocalTransport(unsubscribeLocal).catch(()=>undefined));
    }
    previousToken=accessToken;previousOwner=owner;
    if(!device?.enabled||device.ownerId!==owner||anonymous)return;
    const state=await getPushDeviceState(owner);
    if(state.permission!=='granted'){await disablePush(owner,accessToken);return;}
    const readiness=await getPushReadiness();
    if(state.native&&readiness.apns.ready){
      const token=await withLocalTransport(registerNative);
      await request('',{action:'subscribe',restore:true,installationId:device.installationId,installationSecret:device.installationSecret,transport:'apns',token,label:deviceLabel()},owner,accessToken);
    }else if(!state.native&&readiness.web.ready){
      const registration=await worker(),subscription=await registration.pushManager.getSubscription();
      if(subscription)await request('',{action:'subscribe',restore:true,installationId:device.installationId,installationSecret:device.installationSecret,transport:'web',subscription:subscription.toJSON(),label:deviceLabel()},owner,accessToken);
    }
  };
  let synchronizations=Promise.resolve();
  supabase.auth.onAuthStateChange((_event,current)=>{
    // Never await auth calls within the Supabase auth-state lock; serialize native token registration.
    const generation=++authGeneration,attemptedOwner=current?.user.id||'',attemptedDevice=installation(),explicit=explicitGeneration;
    setTimeout(()=>{synchronizations=synchronizations.catch(()=>undefined).then(async()=>{
      if(generation!==authGeneration)return;
      try{await synchronize(current?.access_token||'',attemptedOwner,Boolean(current?.user.is_anonymous));}
      catch(error:any){
        const device=installation();
        if(error?.code==='push_reenable_required'&&generation===authGeneration&&explicit===explicitGeneration&&device?.ownerId===attemptedOwner&&device?.installationId===attemptedDevice?.installationId)save({...device,enabled:false});
      }
    });},0);
  });
}
