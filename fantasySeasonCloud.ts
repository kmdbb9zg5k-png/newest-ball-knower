import { ensureOnlineSession, supabase } from './supabase';
import type { League, Player } from './types';

export type TradeOffer={id:string;leagueId:string;proposerMemberId:string;recipientMemberId:string;offeredPlayerIds:string[];requestedPlayerIds:string[];proposerDropPlayerIds:string[];recipientDropPlayerIds:string[];status:string;note?:string;createdAt:string;resolvedAt?:string};
export type TradeResolution={tradeId?:string;status:string;reason?:string};
export type WaiverClaim={id:string;leagueId:string;memberId:string;playerId:string;dropPlayerId?:string;priority:number;faabBid:number;claimGroupId:string;claimOrder:number;status:string;createdAt:string;processAt:string;processedAt?:string;failureReason?:string};
export type LeagueTransaction={id:string;leagueId:string;memberId?:string;transactionType:string;summary:string;metadata:any;createdAt:string};
export type LeagueInjury={id:string;leagueId:string;memberId:string;playerId:string;playerName:string;injuryType:string;severity:'minor'|'moderate'|'major'|'season_ending';weeksRemaining:number;onIr:boolean;status:'questionable'|'doubtful'|'out'|'ir'|'cleared';createdAt:string;updatedAt:string};
export type LeagueMessage={id:string;leagueId:string;memberName:string;body:string;kind:'chat'|'announcement'|'receipt'|'reaction';replyTo?:string;createdAt:string};
export type FantasyDmThread={id:string;leagueId:string;participantA:string;participantB:string;lastReadAAt?:string;lastReadBAt?:string;updatedAt:string};
export type FantasyDmMessage={id:string;threadId:string;senderAuthId:string;body:string;createdAt:string};
export type TradeMessage={id:string;tradeId:string;senderAuthId:string;body:string;createdAt:string};
export type TradeThreadRead={tradeId:string;lastReadAt:string};
export type TradingBlockEntry={leagueId:string;memberId:string;playerId:string;status:'available'|'looking_for'|'untouchable';lookingFor:string[];note?:string;updatedAt:string};
export type WeeklyInjuryRollResult={week:number;created:number;reused:boolean};
export type TradeAction='accepted'|'rejected'|'cancelled'|'vetoed'|'approved';

const mapTrade=(x:any):TradeOffer=>({id:x.id,leagueId:x.league_id,proposerMemberId:x.proposer_member_id,recipientMemberId:x.recipient_member_id,offeredPlayerIds:x.offered_player_ids||[],requestedPlayerIds:x.requested_player_ids||[],proposerDropPlayerIds:x.proposer_drop_player_ids||[],recipientDropPlayerIds:x.recipient_drop_player_ids||[],status:x.status,note:x.note||undefined,createdAt:x.created_at,resolvedAt:x.resolved_at||undefined});
const mapClaim=(x:any):WaiverClaim=>({id:x.id,leagueId:x.league_id,memberId:x.member_id,playerId:x.player_id,dropPlayerId:x.drop_player_id||undefined,priority:Number(x.priority)||999,faabBid:Number(x.faab_bid)||0,claimGroupId:x.claim_group_id||x.id,claimOrder:Number(x.claim_order)||1,status:x.status,createdAt:x.created_at,processAt:x.process_at||x.created_at,processedAt:x.processed_at||undefined,failureReason:x.failure_reason||undefined});
const mapTxn=(x:any):LeagueTransaction=>({id:x.id,leagueId:x.league_id,memberId:x.member_id||undefined,transactionType:x.transaction_type,summary:x.summary,metadata:x.metadata||{},createdAt:x.created_at});
const mapInjury=(x:any):LeagueInjury=>({id:x.id,leagueId:x.league_id,memberId:x.member_id,playerId:x.player_id,playerName:x.player_name,injuryType:x.injury_type,severity:x.severity,weeksRemaining:Number(x.weeks_remaining)||0,onIr:Boolean(x.on_ir),status:x.status,createdAt:x.created_at,updatedAt:x.updated_at});
const mapMessage=(x:any):LeagueMessage=>({id:x.id,leagueId:x.league_id,memberName:x.member_name,body:x.body,kind:x.kind,replyTo:x.reply_to||undefined,createdAt:x.created_at});
const mapDmThread=(x:any):FantasyDmThread=>({id:x.id,leagueId:x.league_id,participantA:x.participant_a,participantB:x.participant_b,lastReadAAt:x.last_read_a_at||undefined,lastReadBAt:x.last_read_b_at||undefined,updatedAt:x.updated_at});
const mapDmMessage=(x:any):FantasyDmMessage=>({id:x.id,threadId:x.thread_id,senderAuthId:x.sender_auth_id,body:x.body,createdAt:x.created_at});
const mapTradeMessage=(x:any):TradeMessage=>({id:x.id,tradeId:x.trade_id,senderAuthId:x.sender_auth_id,body:x.body,createdAt:x.created_at});
const mapBlock=(x:any):TradingBlockEntry=>({leagueId:x.league_id,memberId:x.member_id,playerId:x.player_id,status:x.status,lookingFor:x.looking_for||[],note:x.note||undefined,updatedAt:x.updated_at});
const seasonOperationsCache=new Map<string,{trades:TradeOffer[];claims:WaiverClaim[];transactions:LeagueTransaction[];injuries:LeagueInjury[];messages:LeagueMessage[]}>();

export async function fetchFantasyCommunications(leagueId:string){
  if(!supabase)return {dmThreads:[] as FantasyDmThread[],dmMessages:[] as FantasyDmMessage[],tradeMessages:[] as TradeMessage[],tradeThreadReads:[] as TradeThreadRead[],tradingBlock:[] as TradingBlockEntry[],watchedPlayerIds:[] as string[]};
  const auth=await ensureOnlineSession();
  const [threads,tradeMessages,tradeThreadReads,tradingBlock,watched]=await Promise.all([
    supabase.from('ball_knower_dm_threads').select('*').eq('league_id',leagueId).order('updated_at',{ascending:false}),
    supabase.from('ball_knower_trade_messages').select('*,ball_knower_trades!inner(league_id)').eq('ball_knower_trades.league_id',leagueId).order('created_at',{ascending:true}),
    supabase.from('ball_knower_trade_thread_reads').select('trade_id,last_read_at').eq('auth_user_id',auth.id),
    supabase.from('ball_knower_trading_block').select('*').eq('league_id',leagueId).order('updated_at',{ascending:false}),
    supabase.from('ball_knower_watched_players').select('player_id').eq('league_id',leagueId).eq('auth_user_id',auth.id),
  ]);
  const firstError=[threads.error,tradeMessages.error,tradeThreadReads.error,tradingBlock.error,watched.error].find(Boolean);if(firstError)throw firstError;
  const threadIds=(threads.data||[]).map((row:any)=>row.id);
  const messages=threadIds.length?await supabase.from('ball_knower_dm_messages').select('*').in('thread_id',threadIds).order('created_at',{ascending:true}):{data:[],error:null};
  if(messages.error)throw messages.error;
  return {dmThreads:(threads.data||[]).map(mapDmThread),dmMessages:(messages.data||[]).map(mapDmMessage),tradeMessages:(tradeMessages.data||[]).map(mapTradeMessage),tradeThreadReads:(tradeThreadReads.data||[]).map((row:any)=>({tradeId:String(row.trade_id),lastReadAt:String(row.last_read_at)})),tradingBlock:(tradingBlock.data||[]).map(mapBlock),watchedPlayerIds:(watched.data||[]).map((row:any)=>String(row.player_id))};
}

export async function openFantasyDm(leagueId:string,otherMemberId:string):Promise<string>{if(!supabase)throw new Error('Private messages require online services.');await ensureOnlineSession();const {data,error}=await supabase.rpc('open_ball_knower_dm',{p_league_id:leagueId,p_other_member_id:otherMemberId});if(error)throw error;return String(data);}
export async function sendFantasyDm(threadId:string,body:string){if(!supabase)throw new Error('Private messages require online services.');await ensureOnlineSession();const {error}=await supabase.rpc('send_ball_knower_dm',{p_thread_id:threadId,p_body:body});if(error)throw error;}
export async function markFantasyDmRead(threadId:string){if(!supabase)throw new Error('Private messages require online services.');await ensureOnlineSession();const {error}=await supabase.rpc('mark_ball_knower_dm_read',{p_thread_id:threadId});if(error)throw error;}
export async function sendTradeThreadMessage(tradeId:string,body:string){if(!supabase)throw new Error('Trade messages require online services.');await ensureOnlineSession();const {error}=await supabase.rpc('send_ball_knower_trade_message',{p_trade_id:tradeId,p_body:body});if(error)throw error;}
export async function markTradeThreadRead(tradeId:string){if(!supabase)throw new Error('Trade messages require online services.');await ensureOnlineSession();const {error}=await supabase.rpc('mark_ball_knower_trade_thread_read',{p_trade_id:tradeId});if(error)throw error;}
export async function voteOnFantasyTrade(tradeId:string,vote:'approve'|'veto'){if(!supabase)throw new Error('Trade voting requires online services.');await ensureOnlineSession();const {data,error}=await supabase.rpc('vote_on_ball_knower_trade',{p_trade_id:tradeId,p_vote:vote});if(error)throw error;return data as {status:string;approvals:number;vetoes:number;needed:number};}
export async function setTradingBlockEntry(leagueId:string,memberId:string,playerId:string,status:TradingBlockEntry['status'],lookingFor:string[]=[],note=''){if(!supabase)throw new Error('Trading Block requires online services.');await ensureOnlineSession();const {error}=await supabase.from('ball_knower_trading_block').upsert({league_id:leagueId,member_id:memberId,player_id:playerId,status,looking_for:lookingFor,note:note||null,updated_at:new Date().toISOString()},{onConflict:'league_id,member_id,player_id'});if(error)throw error;}
export async function removeTradingBlockEntry(leagueId:string,memberId:string,playerId:string){if(!supabase)throw new Error('Trading Block requires online services.');await ensureOnlineSession();const {error}=await supabase.from('ball_knower_trading_block').delete().eq('league_id',leagueId).eq('member_id',memberId).eq('player_id',playerId);if(error)throw error;}
export async function setWatchedFantasyPlayer(leagueId:string,playerId:string,watched:boolean){if(!supabase)throw new Error('Watched players require online services.');const auth=await ensureOnlineSession();const query=supabase.from('ball_knower_watched_players');const {error}=watched?await query.upsert({league_id:leagueId,auth_user_id:auth.id,player_id:playerId},{onConflict:'league_id,auth_user_id,player_id'}):await query.delete().eq('league_id',leagueId).eq('auth_user_id',auth.id).eq('player_id',playerId);if(error)throw error;}

export function assertStandardFantasyTradePackage(offeredPlayerIds:string[],requestedPlayerIds:string[]){
  if(!offeredPlayerIds.length||!requestedPlayerIds.length) throw new Error('Choose at least one player from each team.');
  if(offeredPlayerIds.length>3||requestedPlayerIds.length>3) throw new Error('Trade packages can include up to three players on each side.');
  if(new Set(offeredPlayerIds).size!==offeredPlayerIds.length||new Set(requestedPlayerIds).size!==requestedPlayerIds.length) throw new Error('A player can only appear once in a trade package.');
}

export async function fetchSeasonOperations(leagueId:string){
  if(!supabase) return {trades:[],claims:[],transactions:[],injuries:[],messages:[]} as const;
  const cached=seasonOperationsCache.get(leagueId);
  try{
    await ensureOnlineSession();
  }catch(error:any){
    if(cached) return cached;
    throw new Error(error?.message||'Could not reconnect your Ball Knower session.');
  }
  const outcomes=await Promise.allSettled([
    supabase.from('ball_knower_trades').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(100),
    supabase.from('ball_knower_waiver_claims').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(100),
    supabase.from('ball_knower_transactions').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(150),
    supabase.from('ball_knower_injuries').select('*').eq('league_id',leagueId).neq('status','cleared').order('updated_at',{ascending:false}).limit(100),
    supabase.from('ball_knower_league_messages').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(100),
  ]);
  const rows=(index:number):any[]|null=>{
    const outcome=outcomes[index] as PromiseSettledResult<any>;
    if(outcome.status!=='fulfilled'||outcome.value?.error) return null;
    return outcome.value?.data||[];
  };
  const succeeded=outcomes.some((outcome:any)=>outcome.status==='fulfilled'&&!outcome.value?.error);
  if(!succeeded&&!cached){
    const first=outcomes.find((outcome:any)=>outcome.status==='rejected'||outcome.value?.error) as any;
    const reason=first?.status==='rejected'?first.reason:first?.value?.error;
    throw new Error(reason?.message||'League activity could not sync. Check your connection and try again.');
  }
  const trades=rows(0); const claims=rows(1); const transactions=rows(2); const injuries=rows(3); const messages=rows(4);
  const result={
    trades:trades?trades.map(mapTrade):(cached?.trades||[]),
    claims:claims?claims.map(mapClaim):(cached?.claims||[]),
    transactions:transactions?transactions.map(mapTxn):(cached?.transactions||[]),
    injuries:injuries?injuries.map(mapInjury):(cached?.injuries||[]),
    messages:messages?messages.map(mapMessage):(cached?.messages||[]),
  };
  seasonOperationsCache.set(leagueId,result);
  return result;
}

export async function proposeTradeWithResolution(
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
  assertStandardFantasyTradePackage(offeredPlayerIds,requestedPlayerIds);

  // Preserve the existing pre-live-draft trade contract. Flexible package cuts
  // and immediate CPU decisions are deliberately post-draft fantasy behavior.
  if(league.liveDraft?.status!=='completed'){
    if(proposerDropPlayerIds.length) throw new Error('Roster-cut trade packages unlock after the fantasy draft is complete.');
    const {data,error}=await supabase.rpc('propose_ball_knower_trade',{
      p_league_id:league.id,
      p_recipient_member_id:recipientMemberId,
      p_offered_player_ids:offeredPlayerIds,
      p_requested_player_ids:requestedPlayerIds,
      p_note:note||null,
    });
    if(error) throw error;
    return {tradeId:data?String(data):undefined,status:'pending',reason:'Offer sent.'};
  }

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
    try{
      const decision=await resolveTradeWithResult(tradeId,'accepted');
      return {...decision,tradeId};
    }catch{
      return {tradeId,status:'pending',reason:'Offer saved. The CPU decision could not finish — retry it from Sent Offers.'};
    }
  }
  return {tradeId,status:'pending',reason:'Offer sent.'};
}

// Existing screens call this with five arguments and expect Promise<void>.
// The post-draft builder supplies a drop-id array and receives the CPU/human result.
export function proposeTrade(
  league:League,
  proposerMemberId:string,
  recipientMemberId:string,
  offeredPlayerIds:string[],
  requestedPlayerIds:string[],
  note?:string,
):Promise<void>;
export function proposeTrade(
  league:League,
  proposerMemberId:string,
  recipientMemberId:string,
  offeredPlayerIds:string[],
  requestedPlayerIds:string[],
  proposerDropPlayerIds:string[],
  note?:string,
):Promise<TradeResolution>;
export async function proposeTrade(
  league:League,
  proposerMemberId:string,
  recipientMemberId:string,
  offeredPlayerIds:string[],
  requestedPlayerIds:string[],
  sixth:string|string[]=[],
  seventh='',
):Promise<void|TradeResolution>{
  const wantsResult=Array.isArray(sixth);
  const drops=wantsResult?sixth:[];
  const note=wantsResult?seventh:sixth;
  const result=await proposeTradeWithResolution(league,proposerMemberId,recipientMemberId,offeredPlayerIds,requestedPlayerIds,drops,note);
  if(wantsResult) return result;
}

export async function resolveTradeWithResult(
  tradeId:string,
  status:TradeAction,
  recipientDropPlayerIds:string[]=[],
):Promise<TradeResolution>{
  if(!supabase) throw new Error('Online multiplayer is not configured.');
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

export function resolveTrade(tradeId:string,status:TradeAction):Promise<void>;
export function resolveTrade(tradeId:string,status:TradeAction,recipientDropPlayerIds:string[]):Promise<TradeResolution>;
export async function resolveTrade(
  tradeId:string,
  status:TradeAction,
  recipientDropPlayerIds?:string[],
):Promise<void|TradeResolution>{
  if(recipientDropPlayerIds!==undefined){
    return resolveTradeWithResult(tradeId,status,recipientDropPlayerIds);
  }
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  await ensureOnlineSession();
  const {error}=await supabase.rpc('resolve_ball_knower_trade',{
    p_trade_id:tradeId,
    p_action:status,
  });
  if(error) throw error;
}

export async function submitWaiverClaim(leagueId:string,memberId:string,playerId:string,dropPlayerId?:string,priority=999){
  if(!supabase) return;
  await ensureOnlineSession();
  const {PLAYERS_DATABASE}=await import('./players');
  const player=PLAYERS_DATABASE.find(p=>p.id===playerId);
  if(!player) throw new Error('Player could not be found in the current NFL pool.');
  const {error}=await supabase.rpc('submit_ball_knower_player_move',{p_league_id:leagueId,p_player_snapshot:player,p_drop_player_id:dropPlayerId||null,p_faab_bid:0,p_claim_order:Math.max(1,priority),p_claim_group_id:null});
  if(error) throw error;
}

export async function cancelWaiverClaim(claimId:string){
  if(!supabase) return; await ensureOnlineSession();
  const {error}=await supabase.rpc('cancel_my_ball_knower_waiver',{p_claim_id:claimId});
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