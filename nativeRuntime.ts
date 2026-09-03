import {Capacitor} from '@capacitor/core';

const BALL_KNOWER_API_ORIGIN='https://ballknower.com';
let installed=false;

function nativeApiUrl(raw:string):string{
  if(raw.startsWith('/api/'))return `${BALL_KNOWER_API_ORIGIN}${raw}`;
  try{
    const parsed=new URL(raw);
    if((parsed.protocol==='capacitor:'||parsed.protocol==='ionic:')&&parsed.pathname.startsWith('/api/')){
      return `${BALL_KNOWER_API_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  }catch{}
  return raw;
}

/**
 * Capacitor serves bundled files from a device-local origin. Ball Knower's API
 * stays on Vercel, so native builds must turn app-relative /api calls into the
 * production HTTPS origin before CapacitorHttp sends them through native URLSession.
 */
export function installNativeApiBridge():void{
  if(installed||!Capacitor.isNativePlatform())return;
  installed=true;
  const upstream=globalThis.fetch.bind(globalThis);
  globalThis.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{
    if(typeof input==='string')return upstream(nativeApiUrl(input),init);
    if(input instanceof URL)return upstream(new URL(nativeApiUrl(input.toString())),init);
    if(typeof Request!=='undefined'&&input instanceof Request){
      const next=nativeApiUrl(input.url);
      if(next!==input.url)return upstream(new Request(next,input),init);
    }
    return upstream(input,init);
  }) as typeof fetch;
}
