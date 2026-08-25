import { ensureOnlineSession, supabase } from './supabase';
import { League, Player } from './types';
import { PLAYERS_DATABASE } from './players';

export type TradeOffer={id:string;leagueId:string;proposerMemberId:string;recipientMemberId:string;offeredPlayerIds:string[];requestedPlayerIds:string[];proposerDropPlayerIds:string[];recipientDropPlayerIds:string[];status:string;note?:string;createdAt:string;resolvedAt?:string};
export type TradeResolution={tradeId?:string;status:string;reason?:string};
export type WaiverClaim={id:string;leagueId:string;memberId:string;playerId:string;dropPlayerId?:string;priority:number;status:string;createdAt:string;processedAt?:string};
export type LeagueTransaction={id:string;leagueId:string;memberId?:string;transactionType:string;summary:string;metadata:any;createdAt:string};
export type LeagueInjury={id:string;leagueId:string;memberId:string;playerId:string;playerName:string;injuryType:string;severity:'minor'|'moderate'|'major'|'season_ending';weeksRemaining:number;onIr:boolean;status:'questionable'|'doubtful'|'out'|'ir'|'cleared';createdAt:string;updatedAt:string};
export type LeagueMessage={id:string;leagueId:string;memberName:string;body:string;kind:'chat'|'announcement'|'receipt'|'reaction';replyTo?:string;createdAt:string};
export type WeeklyInjuryRollResult={week:number;created:number;reused:boolean};

const mapTrade=(x:any):TradeOffer=>({id:x.id,leagueId:x.league_id,proposerMemberId:x.proposer_member_id,recipientMemberId:x.recipient_member_id,offeredPlayerIds:x.offered_player_ids||[],requestedPlayerIds:x.requested_player_ids||[],proposerDropPlayerIds:x.proposer_drop_player_ids||[],recipientDropPlayerIds:x.recipient_drop_player_ids||[],status:x.status,note:x.note||undefined,createdAt:x.created_at,resolvedAt:x.resolved_at||undefined});
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

export async function proposeTrade(
  league:League,
  proposerMemberId:string,
  recipientMemberId:string,
  offeredPlayerIds:string[],
  requestedPlayerIds:string[],
  proposerDropPlayerIds:string[]=[],
  note='',
):Promise<TradeResolution>{
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  await ensureOnlineSession();
  if(proposerMemberId===recipientMemberId) throw new Error('Choose another owner to trade with.');
  if(!offeredPlayerIds.length||!requestedPlayerIds.length) throw new Error('Choose at least one player from each team.');
  if(offeredPlayerIds.length>3||requestedPlayerIds.length>3) throw new Error('Trade packages can include up to three players on each side.');
  const {data,error}=await supabase.rpc('propose_ball_knower_trade_v2',{
    p_league_id:league.id,
    p_recipient_member_id:recipientMemberId,
    p_offered_player_ids:offeredPlayerIds,
    p_requested_player_ids:requestedPlayerIds,
    p_proposer_drop_player_ids:proposerDropPlayerIds,
    p_note:note||null,
  });
  if(error) throw error;
  const tradeId=String(data||'');
  if(!tradeId) throw new Error('The trade was not created.');
  const recipient=league.members.find(member=>member.id===recipientMemberId);
  if(recipient?.isAi){
    const decision=await resolveTrade(tradeId,'accepted');
    return {...decision,tradeId};
  }
  return {tradeId,status:'pending',reason:'Offer sent.'};
}

export async function resolveTrade(
  tradeId:string,
  status:'accepted'|'rejected'|'cancelled'|'vetoed'|'approved',
  recipientDropPlayerIds:string[]=[],
):Promise<TradeResolution>{
  if(!supabase) return {tradeId,status};
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('resolve_ball_knower_trade_v2',{
    p_trade_id:tradeId,
    p_action:status,
    p_recipient_drop_player_ids:recipientDropPlayerIds,
  });
  if(error) throw error;
  const result=(data||{}) as {status?:string;reason?:string};
  return {tradeId,status:result.status||status,reason:result.reason};
}

export async function submitWaiverClaim(leagueId:string,memberId:string,playerId:string,dropPlayerId?:string,priority=999){
  if(!supabase) return; await ensureOnlineSession();
  const player=PLAYERS_DATABASE.find(p=>p.id===playerId);
  if(!player) throw new Error('Player could not be found in the current NFL pool.');
  const {error}=await supabase.from('ball_knower_waiver_claims').insert({league_id:leagueId,member_id:memberId,player_id:player.id,player_snapshot:player,drop_player_id:dropPlayerId||null,priority});
  if(error) throw error;
}

export async function processWaiverClaim(claimId:string){
  if(!supabase) return; await ensureOnlineSession();
  const {error}=await supabase.rpc('process_ball_knower_waiver',{p_claim_id:claimId});
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

export async function fetchNextInjuryWeek(leagueId:string):Promise<number>{
  if(!supabase) return 1;
  await ensureOnlineSession();
  const {data,error}=await supabase.from('ball_knower_injury_rolls').select('week_number').eq('league_id',leagueId).order('week_number',{ascending:false}).limit(1).maybeSingle();
  if(error) throw error;
  return Math.min(18,Math.max(1,(Number(data?.week_number)||0)+1));
}

export async function generateWeeklyInjuries(leagueId:string,week:number):Promise<WeeklyInjuryRollResult>{
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  await ensureOnlineSession();
  const safeWeek=Math.max(1,Math.min(18,Math.trunc(week)));
  const {data,error}=await supabase.rpc('generate_ball_knower_weekly_injuries',{p_league_id:leagueId,p_week_number:safeWeek});
  if(error) throw error;
  const result=(data||{}) as Partial<WeeklyInjuryRollResult>;
  return {week:Number(result.week)||safeWeek,created:Number(result.created)||0,reused:Boolean(result.reused)};
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