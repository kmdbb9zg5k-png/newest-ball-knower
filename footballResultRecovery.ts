import {validFootballStats,type FootballAttempt,type FootballStats} from './footballArena';

export type PendingFootballResult={attempt:FootballAttempt;stats:FootballStats;expired:boolean;expiresAt:string};
const key=(userId:string,matchId:string)=>`bk-football-result:v1:${userId}:${matchId}`;
// Only finished, unsaved drives are cached. A live drive can never be restarted.
// The server remains authoritative and accepts a retry only for the original token.
export function readFootballResult(userId:string,matchId:string,storage?:Storage):PendingFootballResult|null{
  if(!userId)return null;
  try{
    const cache=storage??globalThis.sessionStorage;if(!cache)return null;
    const raw=cache.getItem(key(userId,matchId));if(!raw)return null;
    const value=JSON.parse(raw) as PendingFootballResult;
    if(!validFootballStats(value.stats)||typeof value.expired!=='boolean'||!value.attempt||typeof value.attempt.token!=='string'||!value.attempt.token||![1,2,3].includes(value.attempt.drive)||!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<Date.now()){
      cache.removeItem(key(userId,matchId));return null;
    }
    return value;
  }catch{return null;}
}
export function saveFootballResult(userId:string,matchId:string,value:PendingFootballResult,storage?:Storage):boolean{
  if(!userId)return false;
  try{const cache=storage??globalThis.sessionStorage;if(!cache)return false;cache.setItem(key(userId,matchId),JSON.stringify(value));return true;}catch{return false;}
}
export function clearFootballResult(userId:string,matchId:string,storage?:Storage){
  try{(storage??globalThis.sessionStorage)?.removeItem(key(userId,matchId));}catch{/* Storage may be disabled by the browser. */}
}
