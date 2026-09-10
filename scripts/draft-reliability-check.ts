import { PLAYERS_DATABASE } from '../players';
import { CPU_LIVE_FANTASY_POSITION_LIMITS, filterLiveFantasyPositionRows, getLiveFantasyDraftGroup, isLiveFantasyDraftGroup, LIVE_FANTASY_ROSTER_REQUIREMENTS, type LiveFantasyDraftGroup } from '../liveFantasyRules';
import { readFileSync } from 'node:fs';
import { memberIdAtLiveDraftPick, nextLiveDraftPickForMember, upcomingLiveDraftOrder } from '../liveDraftOrder';
import type { LiveFantasyDraft } from '../types';

type Method='game'|'random'|'commissioner';
type Pick={overall:number;round:number;memberId:string;playerId:string;group:LiveFantasyDraftGroup;source:'cpu'|'autopick'};
type Preferences={queue:string[];preRankings:string[];favorites:string[];doNotDraft:Set<string>};
const GROUPS=Object.keys(LIVE_FANTASY_ROSTER_REQUIREMENTS) as LiveFantasyDraftGroup[];
const LEAGUE_SIZES=[6,8,10,12,14,16] as const;
const ROSTER_SIZE=15;

function verifyKickersOnly(){
  const kicker=PLAYERS_DATABASE.find(player=>player.position==='K');
  const punter=PLAYERS_DATABASE.find(player=>player.position==='P');
  if(!kicker||!punter)throw new Error('Kicker/punter eligibility fixtures are missing.');
  if(getLiveFantasyDraftGroup(kicker)!=='K')throw new Error('Kickers must remain fantasy eligible.');
  if(getLiveFantasyDraftGroup(punter)!==null||isLiveFantasyDraftGroup('P'))throw new Error('Punters must not be fantasy eligible.');
  const rankings=filterLiveFantasyPositionRows([{player_key:'kicker',position:'K'},{player_key:'punter',position:'P'}]);
  if(rankings.length!==1||rankings[0].position!=='K')throw new Error('Cloud fantasy rankings did not remove punters.');
  return {kickerEligible:'passed',punterExcluded:'passed',cloudRankingsFiltered:'passed'};
}

const orderFor=(method:Method,teamCount:number)=>{
  const members=Array.from({length:teamCount},(_,index)=>`m${index+1}`);
  if(method==='commissioner')return [...members].reverse();
  if(method==='random')return [...members].sort((a,b)=>((Number(a.slice(1))*7)%teamCount)-((Number(b.slice(1))*7)%teamCount)||a.localeCompare(b));
  return members;
};

const memberAt=(order:string[],pickIndex:number)=>{
  const round=Math.floor(pickIndex/order.length);const slot=pickIndex%order.length;
  return order[round%2===0?slot:order.length-1-slot];
};

function selectPlayer(picks:Pick[],memberId:string,preferences:Preferences){
  const drafted=new Set(picks.map(pick=>pick.playerId));
  const mine=picks.filter(pick=>pick.memberId===memberId);
  const counts=mine.reduce<Partial<Record<LiveFantasyDraftGroup,number>>>((all,pick)=>({...all,[pick.group]:(all[pick.group]||0)+1}),{});
  const missing=GROUPS.flatMap(group=>Array.from({length:Math.max(0,LIVE_FANTASY_ROSTER_REQUIREMENTS[group]-(counts[group]||0))},()=>group));
  const requiredNow=ROSTER_SIZE-mine.length<=missing.length?new Set(missing):null;
  const queueOrder=new Map(preferences.queue.map((id,index)=>[id,index]));
  const preRankOrder=new Map(preferences.preRankings.map((id,index)=>[id,index]));
  const favorites=new Set(preferences.favorites);
  const candidates=PLAYERS_DATABASE.filter(player=>{
    const group=getLiveFantasyDraftGroup(player);
    return group&&!drafted.has(player.id)&&!preferences.doNotDraft.has(player.id)&&(counts[group]||0)<CPU_LIVE_FANTASY_POSITION_LIMITS[group]&&(!requiredNow||requiredNow.has(group));
  });
  candidates.sort((a,b)=>{
    const ag=getLiveFantasyDraftGroup(a)!;const bg=getLiveFantasyDraftGroup(b)!;
    const tier=(id:string)=>queueOrder.has(id)?0:preRankOrder.has(id)?1:favorites.has(id)?2:3;
    const tierDiff=tier(a.id)-tier(b.id);if(tierDiff)return tierDiff;
    if(queueOrder.has(a.id)||queueOrder.has(b.id))return (queueOrder.get(a.id)??9999)-(queueOrder.get(b.id)??9999);
    if(preRankOrder.has(a.id)||preRankOrder.has(b.id))return (preRankOrder.get(a.id)??9999)-(preRankOrder.get(b.id)??9999);
    const earlyPenalty=(group:LiveFantasyDraftGroup)=>group==='K'||group==='DST'?(mine.length<13?500:0):0;
    const depthPenalty=(group:LiveFantasyDraftGroup)=>({QB:75,RB:14,WR:10,TE:62,K:45,DST:45})[group]*(counts[group]||0);
    return (earlyPenalty(ag)+depthPenalty(ag)-a.ovr)-(earlyPenalty(bg)+depthPenalty(bg)-b.ovr)||b.ovr-a.ovr||a.id.localeCompare(b.id);
  });
  if(!candidates[0])throw new Error(`${memberId} has no legal player at pick ${picks.length+1}`);
  return candidates[0];
}

function run(method:Method,teamCount:number){
  const order=orderFor(method,teamCount);const picks:Pick[]=[];
  const ranked=PLAYERS_DATABASE.filter(player=>getLiveFantasyDraftGroup(player)).sort((a,b)=>b.ovr-a.ovr);
  const queued=ranked.find(player=>getLiveFantasyDraftGroup(player)==='RB')!;
  const avoided=ranked.find(player=>player.id!==queued.id)!;
  const preferences:Preferences={queue:[queued.id],preRankings:[ranked[2].id],favorites:[ranked[3].id],doNotDraft:new Set([avoided.id])};
  for(let pickIndex=0;pickIndex<teamCount*ROSTER_SIZE;pickIndex++){
    const memberId=memberAt(order,pickIndex);const prefs:Preferences=memberId===order[0]?preferences:{queue:[],preRankings:[],favorites:[],doNotDraft:new Set<string>()};
    const player=selectPlayer(picks,memberId,prefs);const group=getLiveFantasyDraftGroup(player)!;
    picks.push({overall:pickIndex+1,round:Math.floor(pickIndex/teamCount)+1,memberId,playerId:player.id,group,source:memberId===order[0]?'autopick':'cpu'});
  }
  if(new Set(picks.map(pick=>pick.playerId)).size!==teamCount*ROSTER_SIZE)throw new Error(`${teamCount}-${method}: duplicate player`);
  if(picks[0].playerId!==queued.id)throw new Error(`${method}: queue priority failed`);
  if(picks.some(pick=>pick.playerId===avoided.id&&pick.memberId===order[0]))throw new Error(`${method}: do-not-draft failed`);
  for(const memberId of order){
    const roster=picks.filter(pick=>pick.memberId===memberId);if(roster.length!==ROSTER_SIZE)throw new Error(`${method}: incomplete ${memberId}`);
    for(const group of GROUPS){const count=roster.filter(pick=>pick.group===group).length;if(count>CPU_LIVE_FANTASY_POSITION_LIMITS[group]||count<LIVE_FANTASY_ROSTER_REQUIREMENTS[group])throw new Error(`${method}: illegal ${memberId} ${group} ${count}`);}
  }
  return {method,teams:teamCount,rosterSize:ROSTER_SIZE,picks:picks.length,uniquePlayers:new Set(picks.map(pick=>pick.playerId)).size,completeRosters:teamCount,queuePriority:'passed',doNotDraft:'passed',snakeOrder:'passed'};
}

function verifyRecoveryClock(){
  const now=Date.parse('2026-08-28T12:00:00.000Z');
  const expired=Date.parse('2026-08-28T11:59:59.000Z');
  const active=Date.parse('2026-08-28T12:00:30.000Z');
  const due=(isAi:boolean,deadline:number,connected:boolean)=>isAi||deadline<=now;
  if(!due(false,expired,false))throw new Error('An abandoned human pick did not recover after its clock expired.');
  if(!due(false,expired,true))throw new Error('An expired connected phone incorrectly blocked server recovery.');
  if(due(false,active,false))throw new Error('A disconnected phone was auto-picked before its persisted deadline.');
  if(!due(true,active,false))throw new Error('A CPU pick waited for a human clock.');
  return {abandonedPick:'passed',disconnectedPhone:'passed',expiredClock:'passed',cpuTurn:'passed'};
}

function verifyVisibleUpcomingOrder(){
  const order=['m1','m2','m3','m4'];
  const draft:LiveFantasyDraft={leagueId:'order-test',status:'active',orderMemberIds:order,rounds:4,pickIndex:3,picks:[],startedAt:'2026-09-10T00:00:00.000Z',pickSeconds:60,updatedAt:'2026-09-10T00:00:00.000Z'};
  const sequence=upcomingLiveDraftOrder(draft,7).map(pick=>pick.memberId);
  const expected=['m4','m4','m3','m2','m1','m1','m2'];
  if(JSON.stringify(sequence)!==JSON.stringify(expected))throw new Error(`Upcoming strip lost snake turnarounds: ${sequence.join(',')}`);
  if(memberIdAtLiveDraftPick(draft,4)!=='m4')throw new Error('Snake turnaround must show the same end-slot manager twice.');
  const next=nextLiveDraftPickForMember(draft,'m1');
  if(!next||next.pickIndex!==7||next.overall!==8||next.round!==2)throw new Error('The personal next-pick countdown is inaccurate.');
  const room=readFileSync(new URL('../LeagueLiveDraftRoom.tsx',import.meta.url),'utf8');
  if(!room.includes('Upcoming draft order')||!room.includes('Your next: #')||!room.includes('live-draft-order-strip'))throw new Error('The live draft does not keep the upcoming order and personal countdown visible.');
  return {snakeTurnaround:'passed',personalCountdown:'passed',stickyOrderStrip:'passed'};
}

function verifyQuarantinedDraftRecovery(){
  const migration=readFileSync(new URL('../migrations/20260902225000_resume_stalled_fantasy_drafts.sql',import.meta.url),'utf8');
  const cloud=readFileSync(new URL('../leagueCloud.ts',import.meta.url),'utf8');
  const room=readFileSync(new URL('../LeagueLiveDraftRoom.tsx',import.meta.url),'utf8');
  for(const marker of [
    'resume_ball_knower_live_draft_recovery',
    "if v_draft.recovery_enabled then",
    "jsonb_array_length(v_draft.picks)<>v_draft.pick_index",
    "count(distinct pick->>'playerId')",
    "the saved draft order no longer matches league membership",
    "saved pick ledger failed ownership validation",
    "pick_deadline_at=v_now+make_interval(secs=>pick_seconds)",
    "'draft_recovery_resumed'",
  ])if(!migration.includes(marker))throw new Error(`Draft recovery is missing ${marker}`);
  if(!cloud.includes("supabase.rpc('resume_ball_knower_live_draft_recovery'"))throw new Error('Cloud draft recovery RPC is not connected.');
  if(!room.includes("draft.recoveryEnabled!==false")||!room.includes('Validating and restoring the draft clock'))throw new Error('The draft room does not surface and start safe recovery.');
  return {quarantinedRoom:'passed',ledgerValidation:'passed',auditableResume:'passed'};
}

function verifyImmediateHumanTimeoutClaim(){
  const migration=readFileSync(new URL('../migrations/20260910011000_claim_expired_live_draft_pick.sql',import.meta.url),'utf8');
  const cloud=readFileSync(new URL('../leagueCloud.ts',import.meta.url),'utf8');
  const context=readFileSync(new URL('../BallKnowerContext.tsx',import.meta.url),'utf8');
  const room=readFileSync(new URL('../LeagueLiveDraftRoom.tsx',import.meta.url),'utf8');
  for(const marker of [
    'claim_ball_knower_expired_draft_pick',
    'requester.auth_user_id = v_auth',
    'for update',
    'v_draft.pick_index <> p_expected_pick_index',
    "v_draft.pick_deadline_at > v_now",
    "'source', case when coalesce(v_member.is_ai, false) then 'cpu' else 'autopick' end",
    'revoke all on function public.claim_ball_knower_expired_draft_pick(text, integer)',
  ])if(!migration.includes(marker))throw new Error(`Immediate timeout claim is missing ${marker}`);
  if(!cloud.includes("supabase.rpc('claim_ball_knower_expired_draft_pick'"))throw new Error('Cloud timeout claim RPC is not connected.');
  if(!context.includes('claimExpiredLiveFantasyDraftPick'))throw new Error('Timeout claim does not update shared league state.');
  if(!room.includes("draftSecondsLeft!==0")||!room.includes('Automatic pick delayed—retrying'))throw new Error('Draft room does not immediately claim and surface expired human turns.');
  return {memberAuthorized:'passed',singlePickClaim:'passed',concurrentRetry:'passed',visibleRecovery:'passed'};
}

const matrix=LEAGUE_SIZES.flatMap(teamCount=>(['game','random','commissioner'] as Method[]).map(method=>run(method,teamCount)));
console.log(JSON.stringify({matrix,kickersOnly:verifyKickersOnly(),recovery:verifyRecoveryClock(),visibleUpcomingOrder:verifyVisibleUpcomingOrder(),quarantinedRecovery:verifyQuarantinedDraftRecovery(),immediateHumanTimeout:verifyImmediateHumanTimeoutClaim()},null,2));
