import { League } from './types';
import { ensureOnlineSession, supabase } from './supabase';

export type OwnerProfile={authUserId:string;displayName:string;ballKnowerRating:number;careerWins:number;careerLosses:number;careerTies:number;championships:number;leaguesPlayed:number;bestFinish?:number;badges:any[];favoriteTeam?:string;updatedAt:string};
export type SpectatorState={enabled:boolean;publicSlug:string};

export async function setSpectatorMode(leagueId:string,enabled:boolean):Promise<string>{
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('set_ball_knower_spectator_mode',{p_league_id:leagueId,p_enabled:enabled});
  if(error) throw error;
  return String(data||'');
}

export async function fetchSpectatorState(leagueId:string):Promise<SpectatorState>{
  if(!supabase) return {enabled:false,publicSlug:''};
  await ensureOnlineSession();
  const {data,error}=await supabase.from('ball_knower_leagues').select('spectator_enabled,public_slug').eq('id',leagueId).maybeSingle();
  if(error) throw error;
  return {enabled:Boolean(data?.spectator_enabled),publicSlug:String(data?.public_slug||'')};
}

export async function fetchSpectatorLeague(slug:string):Promise<(League & {spectatorEnabled?:boolean;publicSlug?:string})|null>{
  if(!supabase) return null;
  const {data,error}=await supabase.rpc('get_ball_knower_spectator_league',{p_slug:slug});
  if(error) throw error;
  if(!data) return null;
  return data as League & {spectatorEnabled?:boolean;publicSlug?:string};
}

export async function fetchOwnerProfiles(authIds:string[]):Promise<OwnerProfile[]>{
  if(!supabase||!authIds.length) return [];
  const {data,error}=await supabase.from('ball_knower_owner_profiles').select('*').in('auth_user_id',authIds);
  if(error) throw error;
  return (data||[]).map((x:any)=>({authUserId:x.auth_user_id,displayName:x.display_name,ballKnowerRating:Number(x.ball_knower_rating)||50,careerWins:Number(x.career_wins)||0,careerLosses:Number(x.career_losses)||0,careerTies:Number(x.career_ties)||0,championships:Number(x.championships)||0,leaguesPlayed:Number(x.leagues_played)||0,bestFinish:x.best_finish==null?undefined:Number(x.best_finish),badges:Array.isArray(x.badges)?x.badges:[],favoriteTeam:x.favorite_team||undefined,updatedAt:x.updated_at}));
}

export async function rollupOwnerProfiles(leagueId:string):Promise<void>{
  if(!supabase) return;
  await ensureOnlineSession();
  const {error}=await supabase.rpc('rollup_ball_knower_owner_profiles',{p_league_id:leagueId});
  if(error) throw error;
}
