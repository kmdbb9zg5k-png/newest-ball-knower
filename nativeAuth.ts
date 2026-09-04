import {App as CapacitorApp} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Capacitor} from '@capacitor/core';
import {supabase} from './supabase';

export const NATIVE_AUTH_CALLBACK='ballknower://auth/callback';
export const NATIVE_AUTH_RESULT_EVENT='ballknower:native-auth-result';
export type NativeAuthResultDetail={status:'cancelled'|'failed'};
export const isNativeBallKnower=()=>Capacitor.isNativePlatform();
export const ballKnowerAuthRedirect=()=>isNativeBallKnower()?NATIVE_AUTH_CALLBACK:(typeof window!=='undefined'?window.location.origin:undefined);

let nativeBrowserPending=false;
const emitNativeAuthResult=(detail:NativeAuthResultDetail)=>{
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent<NativeAuthResultDetail>(NATIVE_AUTH_RESULT_EVENT,{detail}));
};

export async function openNativeAuthUrl(url:string):Promise<boolean>{
  if(!isNativeBallKnower())return false;
  nativeBrowserPending=true;
  try{
    await Browser.open({url,presentationStyle:'popover'});
    return true;
  }catch(error){
    nativeBrowserPending=false;
    throw error;
  }
}

async function consumeAuthCallback(url:string):Promise<boolean>{
  if(!supabase||!url.startsWith(NATIVE_AUTH_CALLBACK))return false;
  const parsed=new URL(url);
  const errorDescription=parsed.searchParams.get('error_description')||parsed.searchParams.get('error');
  if(errorDescription)throw new Error('The sign-in provider did not complete authentication.');

  const code=parsed.searchParams.get('code');
  if(code){
    const exchanged=await supabase.auth.exchangeCodeForSession(code);
    if(exchanged.error)throw new Error('The sign-in session could not be verified.');
  }else{
    const hash=new URLSearchParams(parsed.hash.replace(/^#/,''));
    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    if(!accessToken||!refreshToken)throw new Error('The sign-in callback did not contain a valid session.');
    const session=await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
    if(session.error)throw new Error('The sign-in session could not be saved.');
  }

  nativeBrowserPending=false;
  await Browser.close().catch(()=>undefined);
  return true;
}

async function finishNativeCallback(url:string|undefined|null):Promise<void>{
  if(!url)return;
  try{
    if(await consumeAuthCallback(url))window.location.reload();
  }catch(error){
    console.error('Native authentication callback failed',error);
    nativeBrowserPending=false;
    await Browser.close().catch(()=>undefined);
    emitNativeAuthResult({status:'failed'});
  }
}

let nativeAuthListenerStarted=false;
export async function initializeNativeAuthCallback():Promise<void>{
  if(nativeAuthListenerStarted||!isNativeBallKnower())return;
  nativeAuthListenerStarted=true;
  await CapacitorApp.addListener('appUrlOpen',({url})=>{void finishNativeCallback(url)});
  await Browser.addListener('browserFinished',()=>{
    if(!nativeBrowserPending)return;
    nativeBrowserPending=false;
    emitNativeAuthResult({status:'cancelled'});
  });
  const launch=await CapacitorApp.getLaunchUrl();
  await finishNativeCallback(launch?.url);
}
