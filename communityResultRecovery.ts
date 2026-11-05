import type {MiniStats} from './miniChallenges';
export type PendingMiniResult={token:string;seed:number;stats:MiniStats;expiresAt:string};
const key=(userId:string,scope:string)=>`bk-mini-result:v1:${userId}:${scope}`;
export function validMiniResultStats(value:unknown):value is MiniStats{
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length>0&&Object.keys(value).length<=32&&Object.values(value).every(v=>typeof v==='number'&&Number.isFinite(v));
}
// Account and challenge/event IDs isolate attempts. The original server token and
// exact received stats are replayed; no locally cached score grants a reward.
export function readMiniResult(userId:string,scope:string,storage?:Storage):PendingMiniResult|null{
  if(!userId)return null;
  try{
    const cache=storage??globalThis.sessionStorage;if(!cache)return null;
    const raw=cache.getItem(key(userId,scope));if(!raw)return null;
    const value=JSON.parse(raw) as PendingMiniResult;
    if(typeof value.token!=='string'||!value.token||!Number.isFinite(value.seed)||!validMiniResultStats(value.stats)||!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<Date.now()){
      cache.removeItem(key(userId,scope));return null;
    }
    return value;
  }catch{return null;}
}
export function saveMiniResult(userId:string,scope:string,value:PendingMiniResult,storage?:Storage):boolean{
  if(!userId)return false;
  try{const cache=storage??globalThis.sessionStorage;if(!cache)return false;cache.setItem(key(userId,scope),JSON.stringify(value));return true;}catch{return false;}
}
export function clearMiniResult(userId:string,scope:string,storage?:Storage){
  try{(storage??globalThis.sessionStorage)?.removeItem(key(userId,scope));}catch{/* The in-memory retry still works with browser storage disabled. */}
}
