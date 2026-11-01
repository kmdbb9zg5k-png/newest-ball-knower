import type {UserProfile} from './types';
export type SessionBoundary={identity:string;anonymous:boolean;revision:number};
/** Resolving the first guest profile is hydration, not a change of account. */
export function nextSessionBoundary(previous:SessionBoundary,user:Pick<UserProfile,'id'|'isAnonymous'>|null):SessionBoundary{
 const identity=user?.id||'guest';
 const anonymous=user?.isAnonymous!==false;
 if(identity===previous.identity&&anonymous===previous.anonymous)return previous;
 const initialGuest=previous.identity==='guest'||previous.identity==='user-default-1';
 const guestHydration=initialGuest&&user?.isAnonymous===true;
 return {identity,anonymous,revision:previous.revision+(guestHydration?0:1)};
}
