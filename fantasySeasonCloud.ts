import { ensureOnlineSession, supabase } from './supabase';
import { League, Player } from './types';

export type TradeOffer={id:string;leagueId:string;proposerMemberId:string;recipientMemberId:string;offeredPlayerIds:string[];requestedPlayerIds:string[];status:string;note?:string;createdAt:string;resolvedAt?:string};
export type WaiverClaim={id:string;leagueId:string;memberId:string;playerId:string;dropPlayerId?:string;priority:number;status:string;createdAt:string;processedAt?:string};
export type LeagueTransaction={id:string;leagueId:string;memberId?:string;transactionType:string;summary:string;metadata:any;createdAt:string};
export type LeagueInjury={id:string;leagueId:string;memberId:string;playerId:string;playerName:string;injuryType:string;severity:'minor'|'moderate'|'major'|'season_ending';weeksRemaining:number;onIr:boolean;status:'questionable'|'doubtful'|'out'|'ir'|'cleared';createdAt:string;updatedAt:string};
export type LeagueMessage={id:string;leagueId:string;memberName:string;body:string;kind:'chat'|'announcement'|'receipt'|'reaction';replyTo?:string;createdAt:string};

const mapTrade=(x:any):TradeOffer=>({id:x.id,leagueId:x.league_id,proposerMemberId:x.proposer_member_id,recipientMemberId:x.recipient_member_id,offeredPlayerIds:x.offered_player_ids||[],requestedPlayerIds:x.requested_player_ids||[],status:x.status,note:x.note||undefined,createdAt:x.created_at,resolvedAt:x.resolved_at||undefined});
const mapClaim=(x:any):WaiverClaim=>({id:x.id,leagueId:x.league_id,memberId:x.member_id,playerId:x.player_id,dropPlayerId:x.drop_player_id||undefined,priority:Number(x.priority)||999,status:x.status,createdAt:x.created_at,processedAt:x.processed_at||undefined});
const mapTxn=(x:any):LeagueTransaction=>({id:x.id,leagueId:x.league_id,memberId:x.member_id||undefined,transactionType:x.transaction_type,summary:x.summary,metadata:x.metadata||{},createdAt:x.created_at});
const mapInjury=(x:any):LeagueInjury=>({id:x.id,leagueId:x.league_id,memberId:x.member_id,playerId:x.player_id,playerName:x.player_name,injuryType:x.injury_type,severity:x.severity,weeksRemaining:Number(x.weeks_remaining)||0,onIr:Boolean(x.on_ir),status:x.status,createdAt:x.created_at,updatedAt:x.updated_at});
const mapMessage=(x:any):LeagueMessage=>({id:x.id,leagueId:x.league_id,memberName:x.member_name,body:x.body,kind:x.kind,replyTo:x.reply_to||undefined,createdAt:x.created_at});

export async function fetchSeasonOperations(leagueId:string){
  if(!supabase) return {trades:[],claims:[],transactions:[],injuries:[],messages:[]} as const;
  await ensureOnlineSession();
  const [trades,claims,transactions,injuries,messages]=await Promise.all([
    supabase.from('ball_knower_trades').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(100),
    supabase.from('ball_knower_waiver_claims').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(100),
    supabase.from('ball_knower_transactions').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(150),
    supabase.from('ball_knower_injuries').select('*').eq('league_id',leagueId).neq('status','cleared').order('updated_at',{ascending:false}).limit(100),
    supabase.from('ball_knower_league_messages').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(100),
  ]);
  const err=[trades.error,claims.error,transactions.error,injuries.error,messages.error].find(Boolean); if(err) throw err;
  return {trades:(trades.data||[]).map(mapTrade),claims:(claims.data||[]).map(mapClaim),transactions:(transactions.data||[]).map(mapTxn),injuries:(injuries.data||[]).map(mapInjury),messages:(messages.data||[]).map(mapMessage)};
}

export async function proposeTrade(league:League,proposerMemberId:string,recipientMemberId:string,offeredPlayerIds:string[],requestedPlayerIds:string[],note=''){
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  await ensureOnlineSession();
  if(proposerMemberId===recipientMemberId) throw new Error('Choose another owner to trade with.');
  if(!offeredPlayerIds.length&&!requestedPlayerIds.length) throw new Error('Add at least one player to the trade.');
  const {error}=await supabase.from('ball_knower_trades').insert({league_id:league.id,proposer_member_id:proposerMemberId,recipient_member_id:recipientMemberId,offered_player_ids:offeredPlayerIds,requested_player_ids:requestedPlayerIds,note:note||null});
  if(error) throw error;
}

export async function resolveTrade(tradeId:string,status:'accepted'|'rejected'|'cancelled'|'vetoed'){
  if(!supabase) return; await ensureOnlineSession();
  const {data,error}=await supabase.from('ball_knower_trades').update({status,resolved_at:new Date().toISOString()}).eq('id',tradeId).eq('status','pending').select('id').maybeSingle();
  if(error) throw error; if(!data) throw new Error('That trade is no longer pending.');
}

export async function submitWaiverClaim(leagueId:string,memberId:string,playerId:string,dropPlayerId?:string,priority=999){
  if(!supabase) return; await ensureOnlineSession();
  const {error}=await supabase.from('ball_knower_waiver_claims').insert({league_id:leagueId,member_id:memberId,player_id:playerId,drop_player_id:dropPlayerId||null,priority});
  if(error) throw error;
}

export async function postLeagueMessage(leagueId:string,memberName:string,body:string,kind:'chat'|'announcement'|'receipt'|'reaction'='chat'){
  if(!supabase) return; const auth=await ensureOnlineSession(); const clean=body.trim(); if(!clean) return;
  const {error}=await supabase.from('ball_knower_league_messages').insert({league_id:leagueId,auth_user_id:auth.id,member_name:memberName,body:clean.slice(0,500),kind});
  if(error) throw error;
}

export async function createInjury(leagueId:string,memberId:string,player:Player,severity:LeagueInjury['severity'],weeks:number){
  if(!supabase) return; await ensureOnlineSession();
  const status=severity==='season_ending'?'ir':'out';
  const {error}=await supabase.from('ball_knower_injuries').insert({league_id:leagueId,member_id:memberId,player_id:player.id,player_name:player.name,injury_type:severity==='season_ending'?'Season-ending injury':'Game injury',severity,weeks_remaining:Math.max(1,weeks),on_ir:severity==='season_ending',status});
  if(error) throw error;
}

export function getLeagueFreeAgents(league:League,playerPool:Player[]):Player[]{
  const rostered=new Set(league.members.flatMap(m=>(m.roster||[]).map(p=>p.id)));
  return playerPool.filter(p=>p.active!==false&&!rostered.has(p.id)).sort((a,b)=>b.ovr-a.ovr);
}

export function buildWeeklySnapshot(league:League){
  const games=league.seasonResult?.games||[];
  const weeks=new Map<number,typeof games>();
  for(const game of games){const list=weeks.get(game.week)||[];list.push(game);weeks.set(game.week,list);}
  return [...weeks.entries()].sort((a,b)=>a[0]-b[0]).map(([week,weekGames])=>({week,games:weekGames}));
}

export function buildPlayoffBracket(league:League){
  const standings=league.seasonResult?.standings||[];
  const count=Math.min(league.settings?.playoffTeams||4,standings.length);
  const seeds=standings.slice(0,count);
  const round1=[] as {home:any;away:any}[];
  for(let i=0;i<Math.floor(seeds.length/2);i++) round1.push({home:seeds[i],away:seeds[seeds.length-1-i]});
  return {seeds,round1};
}

export function ownerSeasonProfile(league:League,memberId:string){
  const member=league.members.find(m=>m.id===memberId||m.userId===memberId);
  const standing=league.seasonResult?.standings.find(s=>s.memberId===member?.id||s.memberId===memberId);
  const games=(league.seasonResult?.games||[]).filter(g=>g.homeMemberId===member?.id||g.awayMemberId===member?.id||g.homeMemberId===memberId||g.awayMemberId===memberId);
  const roster=member?.roster||[]; const spent=roster.reduce((s,p)=>s+(Number(p.salary)||0),0);
  return {member,standing,games,roster,spent,capRoom:league.salaryCap-spent};
}
