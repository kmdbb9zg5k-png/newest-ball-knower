import {supabase,ensureOnlineSession} from './supabase';
import type {MiniGameId,MiniStats} from './miniChallenges';
export type CompetitionEvent={id:string;title:string;crew_id:string|null;games:MiniGameId[];seed:number;starts_at:string;ends_at:string;finalized_at:string|null;joined?:boolean};
export type CompetitionCrew={id:string;name:string;emblem:string;color:string;captain:string;join_code:string;members:{user_id:string;name:string}[]};
export type CompetitionReward={event_id:string;title:string;badge:'champion'|'finisher';equipped:boolean;awarded_at:string};
export type CompetitionHome={crew:CompetitionCrew|null;events:CompetitionEvent[];rewards:CompetitionReward[]};
export type CompetitionDetail={event:CompetitionEvent;joined:boolean;mine:{game:MiniGameId;stats:MiniStats|null;score:number|null;submitted_at:string|null}[];standings:{user_id:string;name:string;points:number;completed:number;final_rank:number|null;crew_name:string|null;badge:string|null}[];crew_standings:{id:string;name:string;points:number;contributors:number}[]};
export async function competitionAction<T>(action:string,args:Record<string,unknown>={}):Promise<T>{
 if(!supabase)throw new Error('Online competitions are unavailable.');
 const user=await ensureOnlineSession();if(user.is_anonymous)throw new Error('Sign in to join competitions.');
 const {data,error}=await supabase.rpc('ball_knower_competitions',{p_action:action,p_args:args}).abortSignal(AbortSignal.timeout(15000));
 const current=await supabase.auth.getSession();if(current.data.session?.user.id!==user.id)throw new Error('Your account changed. Reopen competitions.');
 if(error)throw new Error(error.message);return data as T;
}
