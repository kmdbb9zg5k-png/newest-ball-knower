export type PushSettings = {quietEnabled:boolean;timeZone:string;startMinute:number;endMinute:number};
export type PushReadiness = {web:{ready:boolean;publicKey:string|null};apns:{ready:boolean};android:{ready:false}};
export type PushDevice = {id:string;installationId:string;transport:'web'|'apns';label:string;lastSeenAt:string;revokedAt:string|null};
export type PushTarget = {notificationId:string;leagueId:string;destination:import('./fantasyNotificationRouting').FantasyNotificationDestination};
export const pushTargetTab=(target:PushTarget):'draft'|'simulation'|'lobby'=>target.destination==='draft'?'draft':target.destination==='results'?'simulation':'lobby';
export const DEFAULT_PUSH_SETTINGS:PushSettings={quietEnabled:false,timeZone:'UTC',startMinute:22*60,endMinute:7*60};
export const PUSH_OPEN_EVENT='ballknower:push-open';
export const PUSH_DESTINATION_EVENT='ballknower:push-destination';
export const PUSH_STATE_EVENT='ballknower:push-state';
export const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validPushSettings(value:unknown):value is PushSettings{
  const settings=value as PushSettings;
  if(!settings||typeof settings.quietEnabled!=='boolean'||typeof settings.timeZone!=='string'||settings.timeZone.length>80||
    !Number.isInteger(settings.startMinute)||settings.startMinute<0||settings.startMinute>1439||
    !Number.isInteger(settings.endMinute)||settings.endMinute<0||settings.endMinute>1439||settings.startMinute===settings.endMinute)return false;
  try{new Intl.DateTimeFormat('en',{timeZone:settings.timeZone}).format();return true;}catch{return false;}
}

export function isQuietMinute(minute:number,start:number,end:number){
  return start<end?minute>=start&&minute<end:minute>=start||minute<end;
}

/** Fail closed when a deployment embeds tzdata from before the 2026 rule changes. */
export function quietHoursRuntimeReady(){
  try{return [
    ['America/Vancouver','2026-11-06T06:30:00Z','23:30'],
    ['America/Edmonton','2026-11-06T06:30:00Z','00:30'],
    ['Africa/Casablanca','2026-10-15T06:30:00Z','06:30'],
  ].every(([zone,instant,expected])=>new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant))===expected);}catch{return false;}
}

/** Wall-clock evaluation; scanning real instants handles missing/repeated DST hours. */
export function quietUntil(settings:PushSettings,instant:Date):Date{
  if(!validPushSettings(settings))throw new Error('Invalid quiet hours.');
  if(!settings.quietEnabled)return instant;
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:settings.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const quiet=(date:Date)=>{const parts=formatter.formatToParts(date);return isQuietMinute(Number(parts.find(p=>p.type==='hour')?.value)*60+Number(parts.find(p=>p.type==='minute')?.value),settings.startMinute,settings.endMinute);};
  if(!quiet(instant))return instant;
  for(let time=Math.floor(instant.getTime()/60_000)*60_000+60_000;time<=instant.getTime()+26*60*60_000;time+=60_000){
    const next=new Date(time);if(!quiet(next))return next;
  }
  throw new Error('Could not resolve quiet interval.');
}
