import {Capacitor} from '@capacitor/core';

export const BALL_KNOWER_API_ORIGIN='https://ballknower.com';
let installed=false;

const localNativeApiHost=(url:URL)=>
  url.protocol==='capacitor:'||
  url.protocol==='ionic:'||
  ((url.protocol==='http:'||url.protocol==='https:')&&(url.hostname==='localhost'||url.hostname==='127.0.0.1'));

export function nativeApiUrl(raw:string):string{
  if(typeof raw!=='string'||!raw)return raw;
  if(raw.startsWith('/api/'))return `${BALL_KNOWER_API_ORIGIN}${raw}`;
  if(raw.startsWith('api/'))return `${BALL_KNOWER_API_ORIGIN}/${raw}`;
  try{
    const parsed=new URL(raw);
    if(localNativeApiHost(parsed)&&parsed.pathname.startsWith('/api/')){
      return `${BALL_KNOWER_API_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  }catch{
    // Leave malformed/non-URL strings untouched. The bridge must never create
    // a WebKit URL-pattern exception while normalizing an unrelated request.
  }
  return raw;
}

const requestForNativeApi=(input:Request,nextUrl:string,init?:RequestInit)=>{
  const method=(init?.method||input.method||'GET').toUpperCase();
  return new Request(nextUrl,{
    method,
    headers:init?.headers||input.headers,
    body:method==='GET'||method==='HEAD'?undefined:(init?.body??input.clone().body),
    credentials:init?.credentials||input.credentials,
    cache:init?.cache||input.cache,
    redirect:init?.redirect||input.redirect,
    referrer:init?.referrer||input.referrer,
    referrerPolicy:init?.referrerPolicy||input.referrerPolicy,
    integrity:init?.integrity||input.integrity,
    keepalive:init?.keepalive??input.keepalive,
    signal:init?.signal||input.signal,
  });
};

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
    if(input instanceof URL)return upstream(nativeApiUrl(input.toString()),init);
    if(typeof Request!=='undefined'&&input instanceof Request){
      const next=nativeApiUrl(input.url);
      if(next!==input.url)return upstream(requestForNativeApi(input,next,init));
    }
    return upstream(input,init);
  }) as typeof fetch;
}
