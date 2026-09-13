import { useEffect, useMemo, useState } from 'react';
import type { Appearance, AppearancePlayer, UniformVariant } from './appearance';
import { appearanceRenderKey, defaultAppearance } from './appearance';
import { SIMULATED_ART_VERSION, simulatedIdentityFingerprint } from './artIdentity';

export type SimulatedArtSize = 'avatar'|'row'|'card'|'portrait'|'fullBody';
export type SimulatedArtUrls = Record<SimulatedArtSize,string>;
export type SimulatedArtManifest = {
  status:'approved'|'generating'|'missing'|'rejected';
  playerId:string;
  teamAbbr:string;
  uniformVariant:UniformVariant;
  appearanceKey:string;
  identityFingerprint:string;
  artVersion:number;
  urls?:Partial<SimulatedArtUrls>;
  width?:number;
  height?:number;
  reviewedAt?:string|null;
};

const REQUESTS=new Map<string,Promise<SimulatedArtManifest>>();
const MEMORY=new Map<string,SimulatedArtManifest>();
const BLOB_URLS=new Map<string,string>();
const CACHE_PREFIX=`ball-knower-simulated-art-manifest-v${SIMULATED_ART_VERSION}:`;
const IMAGE_CACHE=`ball-knower-simulated-art-v${SIMULATED_ART_VERSION}`;

const stableKey=(player:AppearancePlayer,variant:UniformVariant,look:Appearance)=>[
  SIMULATED_ART_VERSION,player.id,player.team||'FA',variant,appearanceRenderKey(look),simulatedIdentityFingerprint(player),
].join(':');

const browserStore=()=>{try{return typeof window==='undefined'?null:window.localStorage}catch{return null}};

function readStored(key:string):SimulatedArtManifest|null {
  try {
    const raw=browserStore()?.getItem(CACHE_PREFIX+key);if(!raw)return null;
    const parsed=JSON.parse(raw) as SimulatedArtManifest;
    return parsed.artVersion===SIMULATED_ART_VERSION&&parsed.status==='approved'&&parsed.urls?parsed:null;
  } catch { return null; }
}

function saveStored(key:string,value:SimulatedArtManifest) {
  if(value.status!=='approved'||!value.urls)return;
  try { browserStore()?.setItem(CACHE_PREFIX+key,JSON.stringify(value)); } catch { /* browser cache is best effort */ }
}

export async function requestSimulatedArtwork(player:AppearancePlayer,variant:UniformVariant='home',look:Appearance=defaultAppearance(player)):Promise<SimulatedArtManifest> {
  const key=stableKey(player,variant,look);
  const existing=MEMORY.get(key)??readStored(key);
  if(existing){MEMORY.set(key,existing);return existing;}
  const inflight=REQUESTS.get(key);if(inflight)return inflight;
  const params=new URLSearchParams({
    playerId:player.id,team:player.team||'FA',variant,position:player.position,name:player.name,
    number:String(look.number),appearanceKey:appearanceRenderKey(look),identityFingerprint:simulatedIdentityFingerprint(player),
    age:String(player.age??''),heightInches:String(player.heightInches??''),weightLbs:String(player.weightLbs??''),
  });
  const request=fetch(`/api/simulated-player-art?${params}`,{headers:{Accept:'application/json'}}).then(async response=>{
    const payload=await response.json().catch(()=>({})) as SimulatedArtManifest&{error?:string};
    if(!response.ok&&response.status!==202&&response.status!==404)throw new Error(payload.error||`Player artwork returned ${response.status}.`);
    const manifest:SimulatedArtManifest={
      status:payload.status||'missing',playerId:player.id,teamAbbr:player.team||'FA',uniformVariant:variant,
      appearanceKey:appearanceRenderKey(look),identityFingerprint:simulatedIdentityFingerprint(player),artVersion:SIMULATED_ART_VERSION,
      urls:payload.urls,width:payload.width,height:payload.height,reviewedAt:payload.reviewedAt??null,
    };
    if(manifest.status==='approved'&&manifest.urls){MEMORY.set(key,manifest);saveStored(key,manifest);}
    return manifest;
  }).finally(()=>{if(REQUESTS.get(key)===request)REQUESTS.delete(key);});
  REQUESTS.set(key,request);return request;
}

export function useSimulatedArtwork(player:AppearancePlayer,variant:UniformVariant='home',look?:Appearance,enabled=true) {
  const resolvedLook=look??defaultAppearance(player);
  const key=stableKey(player,variant,resolvedLook);
  const initial=useMemo(()=>MEMORY.get(key)??readStored(key),[key]);
  const [result,setResult]=useState<{key:string;manifest:SimulatedArtManifest|null;state:'loading'|'ready'|'missing'|'error'}>(()=>({key,manifest:initial,state:initial?'ready':'loading'}));
  useEffect(()=>{
    if(!enabled)return;
    const cached=MEMORY.get(key)??readStored(key);
    if(cached){setResult({key,manifest:cached,state:'ready'});return;}
    let cancelled=false;setResult({key,manifest:null,state:'loading'});
    requestSimulatedArtwork(player,variant,resolvedLook).then(manifest=>{
      if(cancelled)return;
      setResult({key,manifest,state:manifest.status==='approved'?'ready':'missing'});
    }).catch(error=>{if(!cancelled){console.warn('Simulated player art unavailable',player.id,error);setResult({key,manifest:null,state:'error'});}});
    return()=>{cancelled=true;};
  },[key,enabled]);
  return result.key===key?result:{key,manifest:initial,state:initial?'ready':'loading'};
}

export async function cacheSimulatedArtwork(url:string) {
  if(typeof window==='undefined'||!('caches' in window)||!url)return;
  try {
    const cache=await window.caches.open(IMAGE_CACHE);
    if(await cache.match(url))return;
    const response=await fetch(url,{cache:'force-cache'});
    if(response.ok)await cache.put(url,response.clone());
  } catch { /* HTTP cache remains the fallback */ }
}

export async function recoverCachedSimulatedArtwork(url:string) {
  if(typeof window==='undefined'||!('caches' in window)||!url)return null;
  const existing=BLOB_URLS.get(url);if(existing)return existing;
  try {
    const cache=await window.caches.open(IMAGE_CACHE);const response=await cache.match(url);
    if(!response)return null;
    const blobUrl=URL.createObjectURL(await response.blob());BLOB_URLS.set(url,blobUrl);return blobUrl;
  } catch { return null; }
}

const LOCAL_APPROVED_HOME_TEAMS:Record<string,string>={
  'bk-001-eli-rodriguez':'JCY',
  'solo-brk-02':'BRK','solo-slc-02':'SLC','solo-brk-05':'BRK','solo-slc-05':'SLC',
  'solo-brk-10':'BRK','solo-slc-10':'SLC','solo-brk-15':'BRK','solo-slc-15':'SLC',
  'solo-brk-21':'BRK','solo-slc-20':'SLC','solo-brk-30':'BRK','solo-slc-30':'SLC',
  'solo-brk-38':'BRK','solo-slc-38':'SLC','solo-brk-46':'BRK','solo-slc-45':'SLC',
  'solo-brk-52':'BRK','solo-slc-52':'SLC',
};

export function localApprovedArtwork(player:AppearancePlayer,variant:UniformVariant='home',look?:Appearance):Partial<SimulatedArtUrls>|null {
  if(LOCAL_APPROVED_HOME_TEAMS[player.id]!==player.team||variant!=='home')return null;
  if(look&&appearanceRenderKey(look)!==appearanceRenderKey(defaultAppearance(player)))return null;
  const root=player.id==='bk-001-eli-rodriguez'?'/solo-characters/v2/eli-rodriguez':`/solo-characters/v2/qa/${player.id}`;
  return {avatar:`${root}/avatar.webp`,row:`${root}/row.webp`,card:`${root}/card.webp`,portrait:`${root}/portrait.webp`,fullBody:`${root}/full-body.webp`};
}

export const simulatedArtRequestKey=stableKey;
