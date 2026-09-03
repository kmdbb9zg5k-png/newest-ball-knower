import {App as CapacitorApp} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Capacitor} from '@capacitor/core';
import {supabase} from './supabase';

export const NATIVE_AUTH_CALLBACK='ballknower://auth/callback';
export const isNativeBallKnower=()=>Capacitor.isNativePlatform();
export const ballKnowerAuthRedirect=()=>isNativeBallKnower()?NATIVE_AUTH_CALLBACK:(typeof window!=='undefined'?window.location.origin:undefined);

export async function openNativeAuthUrl(url:string):Promise<boolean>{
  if(!isNativeBallKnower())return false;
  await Browser.open({url,presentationStyle:'popover'});
  return true;
}

async function consumeAuthCallback(url:string):Promise<boolean>{
  if(!supabase||!url.startsWith(NATIVE_AUTH_CALLBACK))return false;
  const parsed=new URL(url);
  const errorDescription=parsed.searchParams.get('error_description')||parsed.searchParams.get('error');
  if(errorDescription)throw new Error(errorDescription);

  const code=parsed.searchParams.get('code');
  if(code){
    const exchanged=await supabase.auth.exchangeCodeForSession(code);
    if(exchanged.error)throw exchanged.error;
  }else{
    const hash=new URLSearchParams(parsed.hash.replace(/^#/,''));
    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    if(!accessToken||!refreshToken)throw new Error('The sign-in callback did not contain a valid session.');
    const session=await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
    if(session.error)throw session.error;
  }

  await Browser.close().catch(()=>undefined);
  return true;
}

let nativeAuthListenerStarted=false;
export async function initializeNativeAuthCallback():Promise<void>{
  if(nativeAuthListenerStarted||!isNativeBallKnower())return;
  nativeAuthListenerStarted=true;
  await CapacitorApp.addListener('appUrlOpen',({url})=>{
    void consumeAuthCallback(url).then(consumed=>{
      if(consumed)window.location.reload();
    }).catch(error=>{
      console.error('Native authentication callback failed',error);
      void Browser.close().catch(()=>undefined);
    });
  });
}
