import { ensureOnlineSession, supabase } from './supabase';
import { League, Player, SeasonResult } from './types';
import { PLAYERS_DATABASE } from './players';

export type WeeklyLineup = {
  id:string;
  leagueId:string;
  memberId:string;
  week:number;
  starters:Record<string,string>;
  bench:string[];
  locked:boolean;
  lockedPlayerIds:string[];
  submittedAt:string;
  updatedAt:string;
  finalizedAt?:string;
};

export type PlayerScoreDetail = {
  slot:string;
  playerId:string;
  playerName:string;
  team:string;
  position:string;
  points:number;
  projectedPoints:number;
  status:string;
  kickoffAt?:string;
  isLive:boolean;
  isFinal:boolean;
  locked:boolean;
};

export type WeeklyScore = {
  leagueId:string;
  memberId:string;
  week:number;
  livePoints:number;
  projectedPoints:number;
  source:string;
  isFinal:boolean;
  scoreRevision:number;
  players:PlayerScoreDetail[];
  updatedAt:string;
  finalizedAt?:string;
  lastCorrectionAt?:string;
};

export type NflWeekGame = {
  providerGameId:string;
  season:number;
  week:number;
  awayTeam:string;
  homeTeam:string;
  kickoffAt:string;
  gameStatus:string;
  gamePeriod?:string;
  gameClock?:string;
  isLive:boolean;
  isFinal:boolean;
};

export type MemberFantasyMeta = {
  memberId:string;
  faabBalance:number;
  irPlayerIds:string[];
};

export type ArchivedSeason = {
  seasonNumber:number;
  result:any;
  settings:any;
  createdAt:string;
};

const mapLineup=(row:any):WeeklyLineup=>({
  id:row.id,
  leagueId:row.league_id,
  memberId:row.member_id,
  week:Number(row.week_number),
  starters:row.starters||{},
  bench:row.bench||[],
  locked:Boolean(row.locked),
  lockedPlayerIds:Array.isArray(row.locked_player_ids)?row.locked_player_ids:[],
  submittedAt:row.submitted_at,
  updatedAt:row.updated_at,
  finalizedAt:row.finalized_at||undefined,
});

const mapScore=(row:any):WeeklyScore=>({
  leagueId:row.league_id,
  memberId:row.member_id,
  week:Number(row.week_number),
  livePoints:Number(row.live_points)||0,
  projectedPoints:Number(row.projected_points)||0,
  source:row.source||'ball_knower',
  isFinal:Boolean(row.is_final),
  scoreRevision:Number(row.score_revision)||1,
  players:Array.isArray(row.score_details?.players)?row.score_details.players.map((player:any)=>({
    ...player,
    points:Number(player.points)||0,
    projectedPoints:Number(player.projectedPoints)||0,
    isLive:Boolean(player.isLive),
    isFinal:Boolean(player.isFinal),
    locked:Boolean(player.locked),
  })):[],
  updatedAt:row.updated_at,
  finalizedAt:row.finalized_at||undefined,
  lastCorrectionAt:row.last_correction_at||undefined,
});

const mapGame=(row:any):NflWeekGame=>({
  providerGameId:row.provider_game_id,
  season:Number(row.season),
  week:Number(row.week_number),
  awayTeam:row.away_team,
  homeTeam:row.home_team,
  kickoffAt:row.kickoff_at,
  gameStatus:row.game_status||'Scheduled',
  gamePeriod:row.game_period||undefined,
  gameClock:row.game_clock||undefined,
  isLive:Boolean(row.is_live),
  isFinal:Boolean(row.is_final),
});

export async function fetchFantasyParityState(leagueId:string,week:number,season=2026){
  if(!supabase) return {lineups:[],scores:[],members:[],archives:[],games:[]} as const;
  await ensureOnlineSession();
  const [lineups,scores,members,archives,games]=await Promise.all([
    supabase.from('ball_knower_weekly_lineups').select('*').eq('league_id',leagueId).eq('week_number',week),
    // Scores power standings and the full-season matchup list, so fetch every
    // week while keeping editable lineup data scoped to the selected week.
    supabase.from('ball_knower_weekly_scores').select('*').eq('league_id',leagueId),
    supabase.from('ball_knower_league_members').select('id,faab_balance,ir_player_ids').eq('league_id',leagueId),
    supabase.from('ball_knower_season_archive').select('season_number,result,settings,created_at').eq('league_id',leagueId).order('season_number',{ascending:false}).limit(25),
    supabase.from('ball_knower_nfl_games').select('*').eq('season',season).eq('season_type','reg').eq('week_number',week).order('kickoff_at',{ascending:true}),
  ]);
  const error=[lineups.error,scores.error,members.error,archives.error,games.error].find(Boolean);
  if(error) throw error;
  return {
    lineups:(lineups.data||[]).map(mapLineup),
    scores:(scores.data||[]).map(mapScore),
    members:(members.data||[]).map((row:any)=>({memberId:row.id,faabBalance:Number(row.faab_balance) || 0,irPlayerIds:Array.isArray(row.ir_player_ids)?row.ir_player_ids:[]} as MemberFantasyMeta)),
    archives:(archives.data||[]).map((row:any)=>({seasonNumber:Number(row.season_number),result:row.result||{},settings:row.settings||{},createdAt:row.created_at} as ArchivedSeason)),
    games:(games.data||[]).map(mapGame),
  };
}

export function subscribeToFantasyParity(leagueId:string,onChange:()=>void){
  if(!supabase) return ()=>{};
  let timer=0;
  const notify=()=>{
    window.clearTimeout(timer);
    timer=window.setTimeout(onChange,150);
  };
  const channel=supabase.channel(`ball-knower-fantasy-scores-${leagueId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'ball_knower_weekly_scores',filter:`league_id=eq.${leagueId}`},notify)
    .on('postgres_changes',{event:'*',schema:'public',table:'ball_knower_weekly_lineups',filter:`league_id=eq.${leagueId}`},notify)
    .subscribe();
  return ()=>{
    window.clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}

export async function saveMyWeeklyLineup(leagueId:string,week:number,starters:Record<string,string>,bench:string[]){
  if(!supabase) throw new Error('Online league services are not configured.');
  await ensureOnlineSession();
  const {error}=await supabase.rpc('save_my_ball_knower_weekly_lineup',{
    p_league_id:leagueId,
    p_week_number:week,
    p_starters:starters,
    p_bench:bench,
  });
  if(error) throw error;
}

export async function finalizeFantasySeasonFromScores(leagueId:string,result:SeasonResult):Promise<SeasonResult>{
  if(!supabase) throw new Error('Online league services are not configured.');
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('finalize_ball_knower_fantasy_season',{p_league_id:leagueId,p_season_result:result});
  if(error) throw error;
  return data as SeasonResult;
}

export async function setMyIrPlayer(leagueId:string,playerId:string,onIr:boolean){
  if(!supabase) throw new Error('Online league services are not configured.');
  await ensureOnlineSession();
  const {error}=await supabase.rpc('set_my_ball_knower_ir',{
    p_league_id:leagueId,
    p_player_id:playerId,
    p_on_ir:onIr,
  });
  if(error) throw error;
}

export type PlayerMoveResult={status:'added'|'pending';message:string;claimId?:string;claimGroupId?:string;processAt?:string};

export async function submitFaabClaim(leagueId:string,memberId:string,playerId:string,bid:number,dropPlayerId?:string,priority=1,claimGroupId?:string):Promise<PlayerMoveResult>{
  if(!supabase) throw new Error('Online league services are not configured.');
  await ensureOnlineSession();
  void memberId;
  const player=PLAYERS_DATABASE.find(item=>item.id===playerId);
  if(!player) throw new Error('That player is not in the active NFL pool.');
  const safeBid=Math.max(0,Math.round((Number(bid)||0)*100)/100);
  const {data,error}=await supabase.rpc('submit_ball_knower_player_move',{
    p_league_id:leagueId,
    p_player_snapshot:player,
    p_drop_player_id:dropPlayerId||null,
    p_faab_bid:safeBid,
    p_claim_order:Math.max(1,priority),
    p_claim_group_id:claimGroupId||null,
  });
  if(error) throw error;
  return data as PlayerMoveResult;
}

export async function counterTrade(tradeId:string,offeredPlayerIds:string[],requestedPlayerIds:string[],note=''){
  if(!supabase) throw new Error('Online league services are not configured.');
  await ensureOnlineSession();
  const {error}=await supabase.rpc('counter_ball_knower_trade',{
    p_trade_id:tradeId,
    p_offered_player_ids:offeredPlayerIds,
    p_requested_player_ids:requestedPlayerIds,
    p_note:note||null,
  });
  if(error) throw error;
}

// Standard fantasy lineup. Drafting stays unrestricted; managers must use their bench,
// free agency, waivers, or trades to field a legal weekly lineup.
export const LINEUP_SLOTS = [
  {id:'QB',label:'QB',accept:(p:Player)=>p.position==='QB'},
  {id:'RB1',label:'RB',accept:(p:Player)=>p.position==='RB'||p.position==='FB'},
  {id:'RB2',label:'RB',accept:(p:Player)=>p.position==='RB'||p.position==='FB'},
  {id:'WR1',label:'WR',accept:(p:Player)=>p.position==='WR'},
  {id:'WR2',label:'WR',accept:(p:Player)=>p.position==='WR'},
  {id:'TE',label:'TE',accept:(p:Player)=>p.position==='TE'},
  {id:'FLEX',label:'FLEX',accept:(p:Player)=>['RB','FB','WR','TE'].includes(p.position)},
  {id:'K',label:'K',accept:(p:Player)=>p.position==='K'},
  {id:'DST',label:'D/ST',accept:(p:Player)=>p.position==='DST'},
] as const;

export function optimizeWeeklyLineup(roster:Player[]):Record<string,string>{
  const chosen=new Set<string>();
  const starters:Record<string,string>={};
  for(const slot of LINEUP_SLOTS){
    const candidate=[...roster]
      .filter(player=>!chosen.has(player.id)&&slot.accept(player))
      .sort((a,b)=>(b.ovr||0)-(a.ovr||0))[0];
    if(candidate){starters[slot.id]=candidate.id;chosen.add(candidate.id);}
  }
  return starters;
}

export function validateWeeklyLineup(roster:Player[],starters:Record<string,string>):string[]{
  const errors:string[]=[];
  const used=new Set<string>();
  for(const slot of LINEUP_SLOTS){
    const id=starters[slot.id];
    if(!id){errors.push(`${slot.label} is empty.`);continue;}
    if(used.has(id)){errors.push('A player is assigned to more than one starter slot.');continue;}
    used.add(id);
    const player=roster.find(item=>item.id===id);
    if(!player){errors.push(`${slot.label} starter is no longer on your roster.`);continue;}
    if(!slot.accept(player)) errors.push(`${player.name} is not eligible for ${slot.label}.`);
  }
  return [...new Set(errors)];
}

export function buildLeagueRecords(league:League,archives:ArchivedSeason[]){
  const currentHasGames=Boolean(league.seasonResult?.standings.some(row=>(Number(row.wins)||0)+(Number(row.losses)||0)+(Number(row.ties)||0)>0));
  const seasons=[...archives.map(item=>({season:item.seasonNumber,result:item.result})),...(league.seasonResult&&currentHasGames?[{season:archives.length+1,result:league.seasonResult}]:[])];
  const games=seasons.flatMap(entry=>(entry.result?.games||[]).map((game:any)=>({...game,season:entry.season})));
  const standings=seasons.flatMap(entry=>(entry.result?.standings||[]).map((standing:any)=>({...standing,season:entry.season})));
  const name=(memberId:string)=>league.members.find(member=>member.id===memberId||member.userId===memberId)?.userName||memberId;
  const highGame=games.reduce<any>((best,game)=>{
    const candidates=[{memberId:game.homeMemberId,score:Number(game.homeScore)||0,week:game.week,season:game.season},{memberId:game.awayMemberId,score:Number(game.awayScore)||0,week:game.week,season:game.season}];
    return candidates.reduce((current,item)=>!current||item.score>current.score?item:current,best);
  },null);
  const biggestBlowout=games.reduce<any>((best,game)=>{
    const margin=Math.abs((Number(game.homeScore)||0)-(Number(game.awayScore)||0));
    const winner=(Number(game.homeScore)||0)>=(Number(game.awayScore)||0)?game.homeMemberId:game.awayMemberId;
    return !best||margin>best.margin?{margin,winner,week:game.week,season:game.season}:best;
  },null);
  const bestSeason=standings.reduce<any>((best,row)=>{
    const pct=Number(row.winPercentage)||((Number(row.wins)||0)/Math.max(1,(Number(row.wins)||0)+(Number(row.losses)||0)+(Number(row.ties)||0)));
    return !best||pct>best.pct?{...row,pct}:best;
  },null);
  const championships=new Map<string,number>();
  for(const season of seasons){const champ=season.result?.championMemberId;if(champ)championships.set(champ,(championships.get(champ)||0)+1);}
  const dynasty=[...championships.entries()].sort((a,b)=>b[1]-a[1])[0];
  return {
    highGame:highGame?{...highGame,name:name(highGame.memberId)}:null,
    biggestBlowout:biggestBlowout?{...biggestBlowout,name:name(biggestBlowout.winner)}:null,
    bestSeason:bestSeason?{...bestSeason,name:name(bestSeason.memberId)}:null,
    dynasty:dynasty?{memberId:dynasty[0],name:name(dynasty[0]),titles:dynasty[1]}:null,
    seasons:seasons.length,
  };
}
