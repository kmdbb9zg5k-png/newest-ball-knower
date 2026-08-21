import { League, LeagueMember, LeagueSettings, SeasonResult, TeamRatings } from './types';
import { ensureOnlineSession, supabase } from './supabase';

export type OwnerProfile={authUserId:string;displayName:string;ballKnowerRating:number;careerWins:number;careerLosses:number;careerTies:number;championships:number;leaguesPlayed:number;bestFinish?:number;badges:any[];favoriteTeam?:string;updatedAt:string};

type SpectatorMemberPayload={
  id?:unknown;
  userName?:unknown;
  userAvatar?:unknown;
  isCommissioner?:unknown;
  isAi?:unknown;
  teamRatings?:unknown;
};

type SpectatorLeaguePayload={
  id?:unknown;
  code?:unknown;
  name?:unknown;
  maxMembers?:unknown;
  salaryCap?:unknown;
  commissionerName?:unknown;
  status?:unknown;
  seasonResult?:unknown;
  createdAt?:unknown;
  settings?:unknown;
  members?:unknown;
  spectatorEnabled?:unknown;
  publicSlug?:unknown;
};

function toSpectatorMember(raw:SpectatorMemberPayload):LeagueMember|null {
  const id=typeof raw.id==='string'?raw.id:'';
  if(!id) return null;
  return {
    id,
    userId:id,
    userName:typeof raw.userName==='string'&&raw.userName.trim()?raw.userName:'Owner',
    userAvatar:typeof raw.userAvatar==='string'&&raw.userAvatar?raw.userAvatar:undefined,
    isCommissioner:Boolean(raw.isCommissioner),
    isAi:Boolean(raw.isAi),
    status:'ready',
    teamRatings:raw.teamRatings&&typeof raw.teamRatings==='object'?raw.teamRatings as TeamRatings:undefined,
  };
}

function toSpectatorLeague(raw:SpectatorLeaguePayload):(League & {spectatorEnabled?:boolean;publicSlug?:string})|null {
  const id=typeof raw.id==='string'?raw.id:'';
  const name=typeof raw.name==='string'?raw.name:'';
  const status=raw.status==='drafting'||raw.status==='simulating'||raw.status==='completed'?raw.status:null;
  if(!id||!name||!status) return null;
  const members=Array.isArray(raw.members)
    ? raw.members.map(item=>toSpectatorMember((item||{}) as SpectatorMemberPayload)).filter((item):item is LeagueMember=>Boolean(item))
    : [];
  const settings=raw.settings&&typeof raw.settings==='object'?raw.settings as LeagueSettings:undefined;
  return {
    id,
    code:typeof raw.code==='string'?raw.code:'',
    name,
    maxMembers:Number(raw.maxMembers)||members.length,
    salaryCap:Number(raw.salaryCap)||0,
    commissionerId:'',
    commissionerName:typeof raw.commissionerName==='string'?raw.commissionerName:'Commissioner',
    status,
    members,
    seasonResult:raw.seasonResult&&typeof raw.seasonResult==='object'?raw.seasonResult as SeasonResult:undefined,
    createdAt:typeof raw.createdAt==='string'?raw.createdAt:'',
    settings:{seasonGames:17,simulationStyle:'realistic',...(settings||{})},
    spectatorEnabled:Boolean(raw.spectatorEnabled),
    publicSlug:typeof raw.publicSlug==='string'?raw.publicSlug:undefined,
  };
}

export async function setSpectatorMode(leagueId:string,enabled:boolean):Promise<string>{
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('set_ball_knower_spectator_mode',{p_league_id:leagueId,p_enabled:enabled});
  if(error) throw error;
  return String(data||'');
}

export async function fetchSpectatorLeague(slug:string):Promise<(League & {spectatorEnabled?:boolean;publicSlug?:string})|null>{
  if(!supabase) return null;
  const {data,error}=await supabase.rpc('get_ball_knower_spectator_league',{p_slug:slug});
  if(error) throw error;
  if(!data) return null;
  return toSpectatorLeague(data as SpectatorLeaguePayload);
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
