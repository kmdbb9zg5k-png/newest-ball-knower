import {App as CapacitorApp} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Capacitor} from '@capacitor/core';
import {NativeAuthSession} from '@ball-knower/native-auth-session';
import type {NativeAuthSessionPlugin} from './packages/native-auth-session';
import {supabase} from './supabase';

export const NATIVE_AUTH_CALLBACK='ballknower://auth/callback';
export const NATIVE_AUTH_RESULT_EVENT='ballknower:native-auth-result';
export type NativeAuthResultDetail={status:'cancelled'|'failed'};
export const isNativeBallKnower=()=>Capacitor.isNativePlatform();
export const ballKnowerAuthRedirect=()=>isNativeBallKnower()?NATIVE_AUTH_CALLBACK:(typeof window!=='undefined'?window.location.origin:undefined);

let nativeBrowserPending=false;
let nativeCallbackRunning=0;
const completedCallbacks=new Map<string,Promise<boolean>>();
const emitNativeAuthResult=(detail:NativeAuthResultDetail)=>{
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent<NativeAuthResultDetail>(NATIVE_AUTH_RESULT_EVENT,{detail}));
};

export async function openNativeAuthUrl(url:string):Promise<boolean>{
  if(!isNativeBallKnower())return false;
  if(nativeBrowserPending||nativeCallbackRunning>0)throw new Error('A sign-in is already in progress.');
  nativeBrowserPending=true;
  try{
    if(Capacitor.getPlatform()==='ios'){
      const result=await NativeAuthSession.authenticate({url});
      if(!await completeAuthCallback(result.url))throw new Error('Invalid sign-in callback.');
    }else{
      await Browser.open({url,presentationStyle:'fullscreen'});
    }
    return true;
  }catch(error){
    nativeBrowserPending=false;
    if((error as {code?:string})?.code==='AUTH_CANCELLED'){
      emitNativeAuthResult({status:'cancelled'});
      return false;
    }
    throw error;
  }
}

async function consumeAuthCallback(url:string):Promise<boolean>{
  if(!supabase)return false;
  let parsed:URL;
  try{parsed=new URL(url)}catch{return false}
  if(parsed.protocol!=='ballknower:'||parsed.hostname!=='auth'||parsed.pathname!=='/callback'||parsed.username||parsed.password||parsed.port)return false;
  nativeBrowserPending=false;
  const hash=new URLSearchParams(parsed.hash.replace(/^#/,''));
  const errorDescription=parsed.searchParams.get('error_description')||parsed.searchParams.get('error')||hash.get('error_description')||hash.get('error');
  if(errorDescription)throw new Error('The sign-in provider did not complete authentication.');

  const code=parsed.searchParams.get('code');
  if(code){
    const exchanged=await supabase.auth.exchangeCodeForSession(code);
    if(exchanged.error)throw new Error('The sign-in session could not be verified.');
  }else{
    // Native OAuth and email both use PKCE. Accepting token-only deep links
    // would allow an unrelated app/link to force an attacker-selected account.
    throw new Error('Request a new sign-in email or start sign-in again to verify this session.');
  }

  nativeBrowserPending=false;
  if(Capacitor.getPlatform()!=='ios')await Browser.close().catch(()=>undefined);
  return true;
}

function completeAuthCallback(url:string):Promise<boolean>{
  const pending=completedCallbacks.get(url);
  if(pending)return pending;
  nativeCallbackRunning++;
  const completion=consumeAuthCallback(url).then(consumed=>{
    if(consumed)window.location.reload();
    else completedCallbacks.delete(url);
    return consumed;
  }).catch(error=>{completedCallbacks.delete(url);throw error;}).finally(()=>{nativeCallbackRunning--});
  completedCallbacks.set(url,completion);
  if(completedCallbacks.size>16)completedCallbacks.delete(completedCallbacks.keys().next().value!);
  return completion;
}

/** Fresh Apple credentials go straight to the deletion API, never into storage. */
export async function requestAppleDeletionAuthorization():Promise<{authorizationCode:string;nonce:string;user:string}|null>{
  if(!isNativeBallKnower()||Capacitor.getPlatform()!=='ios')return null;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const nonce=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce));
  const hashedNonce=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  try{
    const result=await (NativeAuthSession as NativeAuthSessionPlugin).authorizeAppleForDeletion({nonce:hashedNonce});
    return {...result,nonce};
  }catch(error){
    if((error as {code?:string})?.code==='AUTH_CANCELLED')throw new Error('Account deletion was cancelled. Your account is still available.');
    throw new Error('Apple authorization could not be refreshed. Try again before deleting your account.');
  }
}

async function finishNativeCallback(url:string|undefined|null):Promise<void>{
  if(!url)return;
  try{
    await completeAuthCallback(url);
  }catch(error){
    console.error('Native authentication callback failed');
    nativeBrowserPending=false;
    if(Capacitor.getPlatform()!=='ios')await Browser.close().catch(()=>undefined);
    emitNativeAuthResult({status:'failed'});
  }
}

let nativeAuthListenerStarted=false;
let nativeAuthInitialization:Promise<void>|null=null;
export async function initializeNativeAuthCallback():Promise<void>{
  if(nativeAuthListenerStarted||!isNativeBallKnower())return;
  if(nativeAuthInitialization)return nativeAuthInitialization;
  nativeAuthInitialization=(async()=>{
    const handles:Array<{remove:()=>Promise<void>}>=[];
    try{
      handles.push(await CapacitorApp.addListener('appUrlOpen',({url})=>{void finishNativeCallback(url)}));
      handles.push(await Browser.addListener('browserFinished',()=>{
        if(!nativeBrowserPending)return;
        nativeBrowserPending=false;
        emitNativeAuthResult({status:'cancelled'});
      }));
      handles.push(await CapacitorApp.addListener('appStateChange',({isActive})=>{
        if(isActive){
          supabase?.auth.startAutoRefresh();
          window.dispatchEvent(new Event('ballknower:resume'));
        }else supabase?.auth.stopAutoRefresh();
      }));
      const launch=await CapacitorApp.getLaunchUrl();
      await finishNativeCallback(launch?.url);
      nativeAuthListenerStarted=true;
    }catch(error){
      await Promise.allSettled(handles.filter(Boolean).map(handle=>handle.remove()));
      throw error;
    }finally{nativeAuthInitialization=null;}
  })();
  return nativeAuthInitialization;
}
