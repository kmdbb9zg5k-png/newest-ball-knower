import type { RealtimeChannel } from '@supabase/supabase-js';
import { ensureOnlineSession, supabase } from './supabase';

export type CommunityPerson={userId:string;displayName:string;bkRating:number;h2hRating:number;h2hWins:number;h2hLosses:number;h2hTies:number};
export type RankedCommunityPerson=CommunityPerson&{rank:number;level:number};
export type CommunityFriend=CommunityPerson&{friendshipId:string;status:'pending'|'accepted';direction:'incoming'|'outgoing'};
export type CommunityMatch={id:string;challengerId:string;opponentId?:string;challengerName:string;opponentName?:string;matchType:'quick'|'friend';status:'waiting'|'pending'|'active'|'completed'|'declined'|'cancelled';challengerScore:number;opponentScore:number;winnerId?:string;startedAt?:string;finishedAt?:string;createdAt:string};
export type CommunityHome={leaderboard:RankedCommunityPerson[];friends:CommunityFriend[];matches:CommunityMatch[]};
export type CommunityMessage={id:string;authorId:string;recipientId?:string;displayName?:string;body:string;createdAt:string};
export type CommunitySearchPerson=CommunityPerson&{isFriend:boolean;requestPending:boolean};
export type H2HQuestion={ordinal:number;tier:string;question:string;answers:string[];answered:boolean};
export type H2HMatch=CommunityMatch&{durationSeconds:number;questions:H2HQuestion[]};

const requiredClient=()=>{if(!supabase)throw new Error('Community requires online services.');return supabase;};
const permanentUser=async()=>{const user=await ensureOnlineSession();if(user.is_anonymous)throw new Error('Save or sign in to your Ball Knower account to use Community.');return user;};
const rpc=async(name:string,args:Record<string,unknown>={})=>{const client=requiredClient();await permanentUser();const response=await client.rpc(name,args);if(response.error)throw new Error(response.error.message);return response.data;};
const n=(value:unknown)=>Number(value)||0;
const person=(x:any):CommunityPerson=>({userId:String(x.user_id||''),displayName:String(x.display_name||'Ball Knower'),bkRating:n(x.bk_rating),h2hRating:n(x.h2h_rating)||1000,h2hWins:n(x.h2h_wins),h2hLosses:n(x.h2h_losses),h2hTies:n(x.h2h_ties)});
const match=(x:any):CommunityMatch=>({id:String(x.id),challengerId:String(x.challenger_id),opponentId:x.opponent_id?String(x.opponent_id):undefined,challengerName:String(x.challenger_name||'Ball Knower'),opponentName:x.opponent_name?String(x.opponent_name):undefined,matchType:x.match_type,status:x.status,challengerScore:n(x.challenger_score),opponentScore:n(x.opponent_score),winnerId:x.winner_id?String(x.winner_id):undefined,startedAt:x.started_at?String(x.started_at):undefined,finishedAt:x.finished_at?String(x.finished_at):undefined,createdAt:String(x.created_at||'')});

export async function fetchCommunityHome():Promise<CommunityHome>{
  const data=await rpc('get_ball_knower_community_home') as any;
  return {
    leaderboard:(data?.leaderboard||[]).map((x:any)=>({...person(x),rank:n(x.rank),level:n(x.level)||1})),
    friends:(data?.friends||[]).map((x:any)=>({...person(x),friendshipId:String(x.friendship_id),status:x.status,direction:x.direction})),
    matches:(data?.matches||[]).map(match),
  };
}

export async function searchCommunityUsers(query:string):Promise<CommunitySearchPerson[]>{
  const data=await rpc('search_ball_knower_community_users',{p_query:query.trim()}) as any[];
  return (data||[]).map(x=>({...person(x),isFriend:Boolean(x.is_friend),requestPending:Boolean(x.request_pending)}));
}
export const sendFriendRequest=(userId:string)=>rpc('send_ball_knower_friend_request',{p_user_id:userId});
export const respondFriendRequest=(friendshipId:string,accept:boolean)=>rpc('respond_ball_knower_friend_request',{p_friendship_id:friendshipId,p_accept:accept});
export const removeFriend=(friendshipId:string)=>rpc('remove_ball_knower_friend',{p_friendship_id:friendshipId});

export async function fetchGlobalMessages():Promise<CommunityMessage[]>{
  const data=await rpc('get_ball_knower_global_messages',{p_before:null}) as any[];
  return (data||[]).map(x=>({id:String(x.id),authorId:String(x.author_id),displayName:String(x.display_name||'Ball Knower'),body:String(x.body),createdAt:String(x.created_at)})).reverse();
}
export const postGlobalMessage=(body:string)=>rpc('post_ball_knower_global_message',{p_body:body});

export async function fetchDirectMessages(friendId:string):Promise<CommunityMessage[]>{
  const data=await rpc('get_ball_knower_direct_messages',{p_friend_id:friendId}) as any[];
  return (data||[]).map(x=>({id:String(x.id),authorId:String(x.author_id),recipientId:String(x.recipient_id),body:String(x.body),createdAt:String(x.created_at)})).reverse();
}
export const sendDirectMessage=(friendId:string,body:string)=>rpc('send_ball_knower_direct_message',{p_friend_id:friendId,p_body:body});

export async function startH2H(opponentId?:string){return String(await rpc('start_ball_knower_h2h',{p_opponent_id:opponentId||null}));}
export const respondH2H=(matchId:string,accept:boolean)=>rpc('respond_ball_knower_h2h',{p_match_id:matchId,p_accept:accept});
export const cancelH2H=(matchId:string)=>rpc('cancel_ball_knower_h2h',{p_match_id:matchId});
export async function fetchH2HMatch(matchId:string):Promise<H2HMatch>{
  const x=await rpc('get_ball_knower_h2h_match',{p_match_id:matchId}) as any;
  return {...match(x),durationSeconds:n(x.duration_seconds)||60,questions:(x.questions||[]).map((q:any)=>({ordinal:n(q.ordinal),tier:String(q.tier),question:String(q.question),answers:Array.isArray(q.answers)?q.answers.map(String):[],answered:Boolean(q.answered)}))};
}
export async function submitH2HAnswer(matchId:string,ordinal:number,selectedIndex:number){
  const data=await rpc('submit_ball_knower_h2h_answer',{p_match_id:matchId,p_ordinal:ordinal,p_selected_index:selectedIndex}) as any;
  const row=Array.isArray(data)?data[0]:data;return {isCorrect:Boolean(row?.is_correct),myScore:n(row?.my_score)};
}
export async function finishH2H(matchId:string):Promise<H2HMatch>{const x=await rpc('finish_ball_knower_h2h',{p_match_id:matchId}) as any;return {...match(x),durationSeconds:n(x.duration_seconds)||60,questions:(x.questions||[]).map((q:any)=>({ordinal:n(q.ordinal),tier:String(q.tier),question:String(q.question),answers:Array.isArray(q.answers)?q.answers.map(String):[],answered:Boolean(q.answered)}))};}

export function subscribeCommunity(kind:'messages'|'matches',refresh:()=>void):()=>void{
  const client=requiredClient();
  const table=kind==='messages'?'ball_knower_community_messages':'ball_knower_h2h_matches';
  const channel:RealtimeChannel=client.channel(`bk-community-${kind}-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table},()=>refresh()).subscribe();
  return()=>{void client.removeChannel(channel);};
}
