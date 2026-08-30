import { createClient } from '@supabase/supabase-js';

// Keep this route self-contained. Vercel's TypeScript function runtime has
// failed to package modules imported from outside api/ for this project.
// These scoring rules mirror fantasyLiveScoring.ts, which remains the tested
// browser/shared implementation.
type FantasyScoringFormat = 'standard' | 'half_ppr' | 'ppr';
type FantasyStatLine = {
  passingYards:number;
  passingTouchdowns:number;
  interceptionsThrown:number;
  rushingYards:number;
  rushingTouchdowns:number;
  receivingYards:number;
  receivingTouchdowns:number;
  receptions:number;
  twoPointConversions:number;
  fumblesLost:number;
  returnTouchdowns:number;
  fieldGoalsMade:number;
  fieldGoalsMissed:number;
  extraPointsMade:number;
  extraPointsMissed:number;
};
type DefenseStatLine = {
  sacks:number;
  interceptions:number;
  fumbleRecoveries:number;
  defensiveTouchdowns:number;
  returnTouchdowns:number;
  safeties:number;
  blockedKicks:number;
  pointsAllowed:number;
};

const coreNumeric = (value:unknown):number => {
  const parsed=typeof value==='number'?value:Number.parseFloat(String(value??'0'));
  return Number.isFinite(parsed)?parsed:0;
};
const rounded = (value:number):number => Math.round((value+Number.EPSILON)*100)/100;
const object = (value:unknown):Record<string,unknown> =>
  value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const firstNumber = (...values:unknown[]):number => {
  for(const value of values) if(value!==undefined&&value!==null&&value!=='') return coreNumeric(value);
  return 0;
};

function normalizeScoringFormat(value:unknown):FantasyScoringFormat{
  const normalized=String(value||'').toLowerCase().replace(/[^a-z]/g,'');
  if(normalized==='standard') return 'standard';
  if(normalized==='halfppr') return 'half_ppr';
  return 'ppr';
}

function normalizeTank01PlayerStats(rawValue:unknown):FantasyStatLine{
  const raw=object(rawValue);
  const passing=object(raw.Passing??raw.passing);
  const rushing=object(raw.Rushing??raw.rushing);
  const receiving=object(raw.Receiving??raw.receiving);
  const defense=object(raw.Defense??raw.defense);
  const kicking=object(raw.Kicking??raw.kicking);
  const categorizedTwoPointConversions=[
    passing.passingTwoPointConversion,
    rushing.rushingTwoPointConversion,
    receiving.receivingTwoPointConversion,
  ].reduce<number>((sum,value)=>sum+coreNumeric(value),0);
  return {
    passingYards:firstNumber(passing.passYds,passing.passingYards,raw.passYds,raw.passingYards),
    passingTouchdowns:firstNumber(passing.passTD,passing.passingTDs,raw.passTD,raw.passingTouchdowns),
    interceptionsThrown:firstNumber(passing.int,passing.interceptions,raw.int,raw.interceptionsThrown),
    rushingYards:firstNumber(rushing.rushYds,rushing.rushingYards,raw.rushYds,raw.rushingYards),
    rushingTouchdowns:firstNumber(rushing.rushTD,rushing.rushingTDs,raw.rushTD,raw.rushingTouchdowns),
    receivingYards:firstNumber(receiving.recYds,receiving.receivingYards,raw.recYds,raw.receivingYards),
    receivingTouchdowns:firstNumber(receiving.recTD,receiving.receivingTDs,raw.recTD,raw.receivingTouchdowns),
    receptions:firstNumber(receiving.receptions,raw.receptions),
    twoPointConversions:categorizedTwoPointConversions||firstNumber(raw.twoPointConversion,raw.twoPointConversions),
    fumblesLost:firstNumber(defense.fumblesLost,raw.fumblesLost),
    returnTouchdowns:firstNumber(raw.returnTD,raw.returnTouchdowns,raw.specialTeamsTD),
    fieldGoalsMade:firstNumber(kicking.fgMade,kicking.fieldGoalsMade,raw.fgMade,raw.fieldGoalsMade),
    fieldGoalsMissed:firstNumber(kicking.fgMissed,kicking.fieldGoalsMissed,raw.fgMissed,raw.fieldGoalsMissed),
    extraPointsMade:firstNumber(kicking.xpMade,kicking.extraPointsMade,raw.xpMade,raw.extraPointsMade),
    extraPointsMissed:firstNumber(kicking.xpMissed,kicking.extraPointsMissed,raw.xpMissed,raw.extraPointsMissed),
  };
}

function normalizeTank01DefenseStats(rawValue:unknown):DefenseStatLine{
  const raw=object(rawValue);
  return {
    sacks:firstNumber(raw.sacks),
    interceptions:firstNumber(raw.defensiveInterceptions,raw.interceptions),
    fumbleRecoveries:firstNumber(raw.fumblesRecovered,raw.fumbleRecoveries),
    defensiveTouchdowns:firstNumber(raw.defTD,raw.defensiveTouchdowns),
    returnTouchdowns:firstNumber(raw.returnTD,raw.returnTouchdowns),
    safeties:firstNumber(raw.safeties),
    blockedKicks:firstNumber(raw.blockKick,raw.blockedKicks),
    pointsAllowed:firstNumber(raw.ptsAllowed,raw.pointsAllowed),
  };
}

function scoreFantasyPlayer(stats:FantasyStatLine,format:FantasyScoringFormat):number{
  const receptionValue=format==='ppr'?1:format==='half_ppr'?0.5:0;
  return rounded(
    stats.passingYards/25
    +stats.passingTouchdowns*4
    +stats.interceptionsThrown*-2
    +stats.rushingYards/10
    +stats.rushingTouchdowns*6
    +stats.receivingYards/10
    +stats.receivingTouchdowns*6
    +stats.receptions*receptionValue
    +stats.twoPointConversions*2
    +stats.fumblesLost*-2
    +stats.returnTouchdowns*6
    +stats.fieldGoalsMade*3
    +stats.fieldGoalsMissed*-1
    +stats.extraPointsMade
    +stats.extraPointsMissed*-1,
  );
}

function defensePointsAllowed(pointsAllowed:number):number{
  if(pointsAllowed<=0) return 10;
  if(pointsAllowed<=6) return 7;
  if(pointsAllowed<=13) return 4;
  if(pointsAllowed<=20) return 1;
  if(pointsAllowed<=27) return 0;
  if(pointsAllowed<=34) return -1;
  return -4;
}

function scoreFantasyDefense(stats:DefenseStatLine):number{
  return rounded(
    stats.sacks
    +stats.interceptions*2
    +stats.fumbleRecoveries*2
    +stats.defensiveTouchdowns*6
    +stats.returnTouchdowns*6
    +stats.safeties*2
    +stats.blockedKicks*2
    +defensePointsAllowed(stats.pointsAllowed),
  );
}

function allFormatScores(rawStats:unknown):Record<FantasyScoringFormat,number>{
  const stats=normalizeTank01PlayerStats(rawStats);
  return {
    standard:scoreFantasyPlayer(stats,'standard'),
    half_ppr:scoreFantasyPlayer(stats,'half_ppr'),
    ppr:scoreFantasyPlayer(stats,'ppr'),
  };
}

function normalizePlayerName(value:unknown):string{
  return String(value||'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
}

function isFinalGameStatus(value:unknown):boolean{
  const status=String(value||'').trim().toLowerCase();
  return status==='final'||status==='completed'||status.includes('game over');
}

function isLiveGameStatus(value:unknown):boolean{
  const status=String(value||'').trim().toLowerCase();
  return !isFinalGameStatus(status)&&(
    status.includes('progress')
    ||status.includes('live')
    ||/^q[1-4]$/.test(status)
    ||status.includes('halftime')
    ||status.includes('overtime')
  );
}

function kickoffIsoFromTank01Game(gameValue:unknown):string|null{
  const game=object(gameValue);
  const epoch=firstNumber(game.gameTime_epoch,game.gameTimeEpoch,game.kickoffEpoch);
  if(epoch<=0) return null;
  const milliseconds=epoch>10_000_000_000?epoch:epoch*1000;
  const date=new Date(milliseconds);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}

function liveProjectedPoints(actualPoints:number,pregameProjection:number,gameStatus:unknown,periodValue:unknown):number{
  if(isFinalGameStatus(gameStatus)) return rounded(actualPoints);
  if(!isLiveGameStatus(gameStatus)) return rounded(pregameProjection);
  const periodText=String(periodValue||'').toLowerCase();
  const period=periodText.includes('half')?2:Math.max(1,Math.min(5,coreNumeric(periodText.replace(/[^0-9]/g,''))||1));
  const remaining=period>=5?0.08:Math.max(0.08,1-period/4);
  return rounded(actualPoints+Math.max(0,pregameProjection*remaining));
}

function scoreForFormat(
  scores:Partial<Record<FantasyScoringFormat,unknown>>|null|undefined,
  format:FantasyScoringFormat,
):number{
  return coreNumeric(scores?.[format]);
}

function scoreWithLeagueOverrides(rawStats:unknown,format:FantasyScoringFormat,customValue:unknown):number{
  const custom=object(customValue);
  if(!Object.keys(custom).length)return scoreFantasyPlayer(normalizeTank01PlayerStats(rawStats),format);
  const stats=normalizeTank01PlayerStats(rawStats);
  const receptionDefault=format==='ppr'?1:format==='half_ppr'?0.5:0;
  const weight=(key:string,fallback:number)=>custom[key]===undefined?fallback:coreNumeric(custom[key]);
  return rounded(
    stats.passingYards*weight('passYards',1/25)+stats.passingTouchdowns*weight('passTd',4)+stats.interceptionsThrown*weight('interception',-2)
    +stats.rushingYards*weight('rushYards',0.1)+stats.rushingTouchdowns*weight('rushTd',6)
    +stats.receivingYards*weight('recYards',0.1)+stats.receivingTouchdowns*weight('recTd',6)+stats.receptions*weight('reception',receptionDefault)
    +stats.twoPointConversions*2+stats.fumblesLost*weight('fumbleLost',-2)+stats.returnTouchdowns*6
    +stats.fieldGoalsMade*weight('fieldGoal',3)+stats.fieldGoalsMissed*-1+stats.extraPointsMade*weight('extraPoint',1)+stats.extraPointsMissed*-1,
  );
}

export const config = { maxDuration: 60 };

type Json = Record<string, any>;
type RosterPlayer = { id:string; name:string; team:string; position:string; ovr?:number };
type LeagueRow = { id:string; status:string; settings:Json|null };
type MemberRow = { id:string; league_id:string; roster:RosterPlayer[]|null };
type GameRow = {
  provider_game_id:string;
  season:number;
  season_type:string;
  week_number:number;
  away_team:string;
  home_team:string;
  kickoff_at:string;
  game_status:string;
  game_status_code?:string|null;
  game_period?:string|null;
  game_clock?:string|null;
  is_live:boolean;
  is_final:boolean;
  final_at?:string|null;
  last_polled_at?:string|null;
};

const TANK01_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
class Tank01Error extends Error {
  constructor(public path:string,public status:number,public code:'auth'|'rate_limit'|'upstream'|'payload',message:string){super(message);this.name='Tank01Error';}
  get retryable(){return this.code==='rate_limit'||this.code==='upstream';}
}
const TEAM_ALIASES:Record<string,string>={LA:'LAR',WSH:'WAS',JAC:'JAX'};
const STANDARD_SLOTS = [
  {id:'QB',positions:['QB']},
  {id:'RB1',positions:['RB','FB']},
  {id:'RB2',positions:['RB','FB']},
  {id:'WR1',positions:['WR']},
  {id:'WR2',positions:['WR']},
  {id:'TE',positions:['TE']},
  {id:'FLEX',positions:['RB','FB','WR','TE']},
  {id:'K',positions:['K']},
  {id:'DST',positions:['DST']},
] as const;

const valueList = (value:unknown):Json[] => {
  if (Array.isArray(value)) return value.filter(item=>item&&typeof item==='object') as Json[];
  if (value && typeof value === 'object') return Object.values(value as Json).filter(item=>item&&typeof item==='object');
  return [];
};

const jsonEqual = (a:unknown,b:unknown) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
const numeric = (value:unknown) => {
  const parsed=Number.parseFloat(String(value??'0'));
  return Number.isFinite(parsed)?parsed:0;
};

const projectionScores = (projection:Json|undefined):Record<FantasyScoringFormat,number> => {
  const points=projection?.fantasyPointsDefault||projection?.fantasyPoints||{};
  return {
    standard:numeric(points.standard),
    half_ppr:numeric(points.halfPPR ?? points.half_ppr),
    ppr:numeric(points.PPR ?? points.ppr),
  };
};

const tankGet = async (path:string,params:Record<string,string|boolean>={}) => {
  const key=process.env.TANK01_API_KEY||process.env.RAPIDAPI_KEY;
  if(!key) throw new Tank01Error(path,0,'auth','Tank01 API key is not configured.');
  const host=process.env.TANK01_RAPIDAPI_HOST||TANK01_HOST;
  const url=new URL(`https://${host}${path}`);
  Object.entries(params).forEach(([name,value])=>url.searchParams.set(name,String(value)));
  const response=await fetch(url,{headers:{'x-rapidapi-key':key,'x-rapidapi-host':host},signal:AbortSignal.timeout(12_000)});
  if(!response.ok){
    const code=response.status===401||response.status===403?'auth':response.status===429?'rate_limit':'upstream';
    throw new Tank01Error(path,response.status,code,`Tank01 ${path} failed (${response.status}).`);
  }
  const payload=await response.json() as Json;
  if(payload?.error) throw new Tank01Error(path,response.status,'payload',`Tank01 ${path}: ${payload.error}`);
  return payload?.body ?? payload;
};

const normalizeTeam = (value:unknown) => {
  const team=String(value||'').trim().toUpperCase();
  return TEAM_ALIASES[team]||team;
};
const playerKey = (name:unknown,team:unknown) => `${normalizePlayerName(name)}|${normalizeTeam(team)}`;
const teamForPlayer = (player:RosterPlayer) => normalizeTeam(player.team);

function defaultLineup(roster:RosterPlayer[], projections:Map<string,Record<FantasyScoringFormat,number>>, format:FantasyScoringFormat){
  const used=new Set<string>();
  const starters:Record<string,string>={};
  for(const slot of STANDARD_SLOTS){
    const player=roster
      .filter(item=>!used.has(item.id)&&slot.positions.includes(item.position as never))
      .sort((a,b)=>(projections.get(b.id)?.[format]||0)-(projections.get(a.id)?.[format]||0)||(b.ovr||0)-(a.ovr||0))[0];
    if(player){starters[slot.id]=player.id;used.add(player.id);}
  }
  return {starters,bench:roster.filter(player=>!used.has(player.id)).map(player=>player.id)};
}

export default async function handler(req:any,res:any){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');
  const cronSecret=process.env.CRON_SECRET;
  if(!cronSecret) return res.status(503).json({ok:false,error:'CRON_SECRET is not configured'});
  if(req.headers?.authorization!==`Bearer ${cronSecret}`) return res.status(401).json({ok:false,error:'Unauthorized'});

  const supabaseUrl=process.env.SUPABASE_URL
    ||process.env.VITE_SUPABASE_URL
    ||'https://gpnboygoosrmeydwjpvk.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(503).json({ok:false,error:'SUPABASE_SERVICE_ROLE_KEY is not configured'});
  const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const now=new Date();

  try{
    const current=await tankGet('/getNFLCurrentInfo') as Json;
    const season=Math.max(2026,Number(current?.season)||now.getUTCFullYear());
    const week=Math.max(1,Math.min(22,Number(current?.week)||1));
    const seasonType=String(current?.seasonType||'reg');
    if(seasonType==='Final') return res.status(200).json({ok:true,season,week,seasonType,gamesPolled:0,message:'NFL season is final.'});
    if(seasonType!=='reg') return res.status(200).json({
      ok:true,season,week,seasonType,gamesPolled:0,
      message:'Live fantasy scoring waits for the NFL regular season.',
    });

    const [gamesPayload,projectionsPayload,existingGamesResult,leagueResult,draftResult]=await Promise.all([
      tankGet('/getNFLGamesForWeek',{week:String(week),season:String(season),seasonType}),
      tankGet('/getNFLProjections',{week:String(week)}).catch(error=>{
        console.warn('tank01-optional-projections-failed',{message:error instanceof Error?error.message:String(error),status:error instanceof Tank01Error?error.status:undefined,code:error instanceof Tank01Error?error.code:undefined});
        return {playerProjections:{},teamDefenseProjections:{}};
      }),
      db.from('ball_knower_nfl_games').select('*').eq('season',season).eq('season_type',seasonType).eq('week_number',week),
      db.from('ball_knower_leagues').select('id,status,settings'),
      db.from('ball_knower_live_drafts').select('league_id,status').eq('status','completed'),
    ]);
    if(existingGamesResult.error) throw existingGamesResult.error;
    if(leagueResult.error) throw leagueResult.error;
    if(draftResult.error) throw draftResult.error;

    const projectionBody=(projectionsPayload||{}) as Json;
    const rawPlayerProjections=projectionBody.playerProjections||projectionBody.players||{};
    const rawDefenseProjections=projectionBody.teamDefenseProjections||projectionBody.defenses||{};
    const providerProjectionById=new Map<string,Json>();
    const providerProjectionByKey=new Map<string,Json>();
    for(const projection of valueList(rawPlayerProjections)){
      const id=String(projection.playerID||projection.playerId||'');
      if(id) providerProjectionById.set(id,projection);
      providerProjectionByKey.set(playerKey(projection.longName||projection.playerName,projection.teamAbv||projection.team),projection);
    }
    const defenseProjectionByTeam=new Map<string,Json>();
    for(const projection of valueList(rawDefenseProjections)) defenseProjectionByTeam.set(normalizeTeam(projection.teamAbv||projection.team),projection);

    const existingGameMap=new Map<string,GameRow>((existingGamesResult.data||[]).map((game:any)=>[game.provider_game_id,game as GameRow]));
    const scheduleRows:GameRow[]=valueList(gamesPayload).flatMap(game=>{
      const providerGameId=String(game.gameID||game.gameId||'');
      const kickoff=kickoffIsoFromTank01Game(game);
      if(!providerGameId||!kickoff) return [];
      const status=String(game.gameStatus||'Scheduled');
      const existing=existingGameMap.get(providerGameId);
      return [{
        provider_game_id:providerGameId,
        season,
        season_type:seasonType,
        week_number:week,
        away_team:normalizeTeam(game.away||game.awayTeam),
        home_team:normalizeTeam(game.home||game.homeTeam),
        kickoff_at:kickoff,
        game_status:status,
        game_status_code:String(game.gameStatusCode||''),
        game_period:existing?.game_period||null,
        game_clock:existing?.game_clock||null,
        is_live:isLiveGameStatus(status),
        is_final:isFinalGameStatus(status)||Boolean(existing?.is_final),
        final_at:existing?.final_at||null,
        last_polled_at:existing?.last_polled_at||null,
      }];
    });
    if(scheduleRows.length){
      const {error}=await db.from('ball_knower_nfl_games').upsert(scheduleRows,{onConflict:'provider_game_id'});
      if(error) throw error;
    }

    const completedDraftLeagueIds=new Set((draftResult.data||[]).map((draft:any)=>String(draft.league_id)));
    const activeLeagues=(leagueResult.data||[] as LeagueRow[]).filter(league=>(
      Boolean(league.settings?.fantasySeasonStarted)||completedDraftLeagueIds.has(league.id)
    )&&!league.settings?.fantasySeasonComplete&&Number(league.settings?.nflSeason||season)===season);
    await Promise.all(activeLeagues.filter(league=>(
      !league.settings?.fantasySeasonStarted
      || Number(league.settings?.currentWeek)!==week
      || Number(league.settings?.nflSeason)!==season
    )).map(async league=>{
      const settings={...(league.settings||{}),fantasySeasonStarted:true,fantasySeasonComplete:false,currentWeek:week,nflSeason:season};
      const {error}=await db.from('ball_knower_leagues').update({settings}).eq('id',league.id);
      if(error) throw error;
      league.settings=settings;
    }));
    const activeLeagueIds=activeLeagues.map(league=>league.id);
    const memberResult=activeLeagueIds.length
      ? await db.from('ball_knower_league_members').select('id,league_id,roster').in('league_id',activeLeagueIds)
      : {data:[],error:null};
    if(memberResult.error) throw memberResult.error;
    const members=(memberResult.data||[]) as MemberRow[];
    const appPlayerByKey=new Map<string,RosterPlayer>();
    const appPlayerById=new Map<string,RosterPlayer>();
    for(const member of members) for(const player of member.roster||[]){
      appPlayerById.set(player.id,player);
      appPlayerByKey.set(playerKey(player.name,player.team),player);
    }

    const projectionByAppPlayer=new Map<string,Record<FantasyScoringFormat,number>>();
    for(const player of appPlayerById.values()){
      if(player.position==='DST'){
        const points=numeric(defenseProjectionByTeam.get(teamForPlayer(player))?.fantasyPointsDefault);
        projectionByAppPlayer.set(player.id,{standard:points,half_ppr:points,ppr:points});
      }else{
        const projection=providerProjectionByKey.get(playerKey(player.name,player.team));
        if(projection) projectionByAppPlayer.set(player.id,projectionScores(projection));
      }
    }

    const pollable=scheduleRows.filter(game=>{
      const kickoff=Date.parse(game.kickoff_at);
      const prior=existingGameMap.get(game.provider_game_id);
      const lastPoll=Date.parse(prior?.last_polled_at||'');
      const correctionWindow=now.getTime()-kickoff<8*24*60*60*1000;
      if(now.getTime()<kickoff-15*60*1000) return false;
      if(!game.is_final&&!prior?.is_final) return true;
      return correctionWindow&&(!Number.isFinite(lastPoll)||now.getTime()-lastPoll>=6*60*60*1000);
    });

    const priorPlayerResult=pollable.length
      ? await db.from('ball_knower_player_week_scores').select('*').in('provider_game_id',pollable.map(game=>game.provider_game_id))
      : {data:[],error:null};
    if(priorPlayerResult.error) throw priorPlayerResult.error;
    const priorPlayerMap=new Map<string,Json>((priorPlayerResult.data||[]).map((row:any)=>[`${row.provider_game_id}|${row.provider_player_id}`,row]));
    let correctionCount=0;
    let playerRowsWritten=0;

    await Promise.all(pollable.map(async game=>{
      const box=await tankGet('/getNFLBoxScore',{gameID:game.provider_game_id,playByPlay:false,fantasyPoints:true}) as Json;
      const status=String(box.gameStatus||game.game_status||'Scheduled');
      const isFinal=isFinalGameStatus(status);
      const gameUpdate={
        game_status:status,
        game_period:String(box.currentPeriod||box.lineScore?.period||''),
        game_clock:String(box.gameClock||box.lineScore?.gameClock||''),
        is_live:isLiveGameStatus(status),
        is_final:isFinal,
        final_at:isFinal?(game.final_at||now.toISOString()):null,
        last_polled_at:now.toISOString(),
        provider_updated_at:now.toISOString(),
        updated_at:now.toISOString(),
      };
      const {error:gameError}=await db.from('ball_knower_nfl_games').update(gameUpdate).eq('provider_game_id',game.provider_game_id);
      if(gameError) throw gameError;
      Object.assign(game,gameUpdate);

      const rows:Json[]=[];
      for(const playerRaw of valueList(box.playerStats||box.players||{})){
        const providerPlayerId=String(playerRaw.playerID||playerRaw.playerId||'');
        if(!providerPlayerId) continue;
        const name=String(playerRaw.longName||playerRaw.playerName||providerPlayerId);
        const team=normalizeTeam(playerRaw.teamAbv||playerRaw.team);
        const appPlayer=appPlayerByKey.get(playerKey(name,team));
        const stats=normalizeTank01PlayerStats(playerRaw);
        const fantasyPoints=allFormatScores(playerRaw);
        const baseline=projectionScores(providerProjectionById.get(providerPlayerId)||providerProjectionByKey.get(playerKey(name,team)));
        const projectedPoints={
          standard:liveProjectedPoints(fantasyPoints.standard,baseline.standard,status,gameUpdate.game_period),
          half_ppr:liveProjectedPoints(fantasyPoints.half_ppr,baseline.half_ppr,status,gameUpdate.game_period),
          ppr:liveProjectedPoints(fantasyPoints.ppr,baseline.ppr,status,gameUpdate.game_period),
        };
        const prior=priorPlayerMap.get(`${game.provider_game_id}|${providerPlayerId}`);
        const changed=Boolean(prior)&&(!jsonEqual(prior.stats,stats)||!jsonEqual(prior.fantasy_points,fantasyPoints));
        if(prior?.is_final&&changed){
          correctionCount++;
          const {error}=await db.from('ball_knower_stat_corrections').insert({
            provider_game_id:game.provider_game_id,provider_player_id:providerPlayerId,ball_knower_player_id:appPlayer?.id||prior.ball_knower_player_id||null,
            season,week_number:week,player_name:name,previous_stats:prior.stats||{},corrected_stats:stats,
            previous_points:prior.fantasy_points||{},corrected_points:fantasyPoints,detected_at:now.toISOString(),
          });
          if(error) throw error;
        }
        rows.push({
          provider_game_id:game.provider_game_id,provider_player_id:providerPlayerId,ball_knower_player_id:appPlayer?.id||null,
          season,season_type:seasonType,week_number:week,player_name:name,team,position:String(playerRaw.pos||appPlayer?.position||''),
          kickoff_at:game.kickoff_at,game_status:status,is_final:isFinal,stats,fantasy_points:fantasyPoints,projected_points:projectedPoints,
          score_revision:changed?Number(prior?.score_revision||1)+1:Number(prior?.score_revision||1),provider_updated_at:now.toISOString(),updated_at:now.toISOString(),
        });
      }

      for(const side of ['away','home'] as const){
        const defenseRaw=box.DST?.[side];
        if(!defenseRaw) continue;
        const team=normalizeTeam(defenseRaw.teamAbv||game[`${side}_team` as 'away_team'|'home_team']);
        const providerPlayerId=`DST:${team}`;
        const appPlayer=appPlayerById.get(`dst-${team.toLowerCase()}`);
        const stats=normalizeTank01DefenseStats(defenseRaw);
        const actual=scoreFantasyDefense(stats);
        const baseline=numeric(defenseProjectionByTeam.get(team)?.fantasyPointsDefault);
        const fantasyPoints={standard:actual,half_ppr:actual,ppr:actual};
        const projected=liveProjectedPoints(actual,baseline,status,gameUpdate.game_period);
        const projectedPoints={standard:projected,half_ppr:projected,ppr:projected};
        const prior=priorPlayerMap.get(`${game.provider_game_id}|${providerPlayerId}`);
        const changed=Boolean(prior)&&(!jsonEqual(prior.stats,stats)||!jsonEqual(prior.fantasy_points,fantasyPoints));
        if(prior?.is_final&&changed){
          correctionCount++;
          const {error}=await db.from('ball_knower_stat_corrections').insert({
            provider_game_id:game.provider_game_id,provider_player_id:providerPlayerId,ball_knower_player_id:appPlayer?.id||prior.ball_knower_player_id||null,
            season,week_number:week,player_name:`${team} D/ST`,previous_stats:prior.stats||{},corrected_stats:stats,
            previous_points:prior.fantasy_points||{},corrected_points:fantasyPoints,detected_at:now.toISOString(),
          });
          if(error) throw error;
        }
        rows.push({
          provider_game_id:game.provider_game_id,provider_player_id:providerPlayerId,ball_knower_player_id:appPlayer?.id||`dst-${team.toLowerCase()}`,
          season,season_type:seasonType,week_number:week,player_name:`${team} D/ST`,team,position:'DST',kickoff_at:game.kickoff_at,
          game_status:status,is_final:isFinal,stats,fantasy_points:fantasyPoints,projected_points:projectedPoints,
          score_revision:changed?Number(prior?.score_revision||1)+1:Number(prior?.score_revision||1),provider_updated_at:now.toISOString(),updated_at:now.toISOString(),
        });
      }
      if(rows.length){
        const {error}=await db.from('ball_knower_player_week_scores').upsert(rows,{onConflict:'provider_game_id,provider_player_id'});
        if(error) throw error;
        playerRowsWritten+=rows.length;
      }
    }));

    const [freshGamesResult,playerScoreResult,lineupResult,weeklyScoreResult]=await Promise.all([
      db.from('ball_knower_nfl_games').select('*').eq('season',season).eq('season_type',seasonType).eq('week_number',week),
      db.from('ball_knower_player_week_scores').select('*').eq('season',season).eq('season_type',seasonType).eq('week_number',week),
      activeLeagueIds.length?db.from('ball_knower_weekly_lineups').select('*').in('league_id',activeLeagueIds).eq('week_number',week):Promise.resolve({data:[],error:null}),
      activeLeagueIds.length?db.from('ball_knower_weekly_scores').select('*').in('league_id',activeLeagueIds).eq('week_number',week):Promise.resolve({data:[],error:null}),
    ]);
    const stateError=[freshGamesResult.error,playerScoreResult.error,lineupResult.error,weeklyScoreResult.error].find(Boolean);
    if(stateError) throw stateError;
    const freshGames=(freshGamesResult.data||[]) as GameRow[];
    const playerScores=(playerScoreResult.data||[]) as Json[];
    const scoreByAppPlayer=new Map(playerScores.filter(row=>row.ball_knower_player_id).map(row=>[row.ball_knower_player_id,row]));
    const gameByTeam=new Map<string,GameRow>();
    freshGames.forEach(game=>{gameByTeam.set(game.home_team,game);gameByTeam.set(game.away_team,game);});
    const weekIsFinal=freshGames.length>0&&freshGames.every(game=>game.is_final);
    const lineupMap=new Map((lineupResult.data||[]).map((row:any)=>[`${row.league_id}|${row.member_id}`,row]));
    const weeklyScoreMap=new Map((weeklyScoreResult.data||[]).map((row:any)=>[`${row.league_id}|${row.member_id}`,row]));
    const lineupWrites:Json[]=[];
    const weeklyScoreWrites:Json[]=[];

    for(const league of activeLeagues){
      const format=normalizeScoringFormat(league.settings?.scoringFormat);
      const customScoring=league.settings?.customScoring;
      const usesCustomScoring=Object.keys(object(customScoring)).length>0;
      for(const member of members.filter(item=>item.league_id===league.id)){
        const roster=member.roster||[];
        let lineup=lineupMap.get(`${league.id}|${member.id}`);
        if(!lineup){
          const built=defaultLineup(roster,projectionByAppPlayer,format);
          lineup={league_id:league.id,member_id:member.id,week_number:week,starters:built.starters,bench:built.bench,locked:false,locked_player_ids:[],submitted_at:now.toISOString(),updated_at:now.toISOString()};
        }
        const lockedIds=new Set<string>(Array.isArray(lineup.locked_player_ids)?lineup.locked_player_ids:[]);
        const details:Json[]=[];
        let livePoints=0;
        let projectedPoints=0;
        for(const slot of STANDARD_SLOTS){
          const playerId=String(lineup.starters?.[slot.id]||'');
          const player=roster.find(item=>item.id===playerId);
          if(!player) continue;
          const game=gameByTeam.get(teamForPlayer(player));
          if(game&&Date.parse(game.kickoff_at)<=now.getTime()) lockedIds.add(player.id);
          const playerScore=scoreByAppPlayer.get(player.id);
          const actual=playerScore
            ? (player.position==='DST'?scoreForFormat(playerScore.fantasy_points,format):scoreWithLeagueOverrides(playerScore.stats,format,league.settings?.customScoring))
            : 0;
          const providerProjection=player.position==='DST'?undefined:providerProjectionByKey.get(playerKey(player.name,player.team));
          const projected=usesCustomScoring&&player.position!=='DST'
            ? (providerProjection?liveProjectedPoints(actual,scoreWithLeagueOverrides(providerProjection,format,customScoring),game?.game_status,game?.game_period):0)
            : playerScore
              ? scoreForFormat(playerScore.projected_points,format)
              : projectionByAppPlayer.get(player.id)?.[format]||0;
          livePoints+=actual;
          projectedPoints+=projected;
          details.push({slot:slot.id,playerId:player.id,playerName:player.name,team:player.team,position:player.position,
            points:actual,projectedPoints:projected,status:game?.game_status||(game?'Scheduled':'Bye'),kickoffAt:game?.kickoff_at||null,
            isLive:Boolean(game?.is_live),isFinal:Boolean(game?.is_final)||(!game&&weekIsFinal),locked:lockedIds.has(player.id)});
        }
        lineupWrites.push({...lineup,locked_player_ids:[...lockedIds],locked:lockedIds.size>=STANDARD_SLOTS.length,
          finalized_at:weekIsFinal?(lineup.finalized_at||now.toISOString()):null,updated_at:now.toISOString()});

        const previous=weeklyScoreMap.get(`${league.id}|${member.id}`);
        const totalChanged=Boolean(previous)&&(numeric(previous.live_points)!==Math.round(livePoints*100)/100||numeric(previous.projected_points)!==Math.round(projectedPoints*100)/100);
        const corrected=Boolean(previous?.is_final)&&totalChanged;
        weeklyScoreWrites.push({
          league_id:league.id,member_id:member.id,week_number:week,live_points:Math.round(livePoints*100)/100,
          projected_points:Math.round(projectedPoints*100)/100,source:'tank01',is_final:weekIsFinal,
          score_revision:totalChanged?Number(previous?.score_revision||1)+1:Number(previous?.score_revision||1),
          score_details:{season,seasonType,format,players:details},finalized_at:weekIsFinal?(previous?.finalized_at||now.toISOString()):null,
          last_correction_at:corrected?now.toISOString():(previous?.last_correction_at||null),updated_at:now.toISOString(),
        });
      }
    }
    if(lineupWrites.length){
      const {error}=await db.from('ball_knower_weekly_lineups').upsert(lineupWrites,{onConflict:'league_id,member_id,week_number'});
      if(error) throw error;
    }
    if(weeklyScoreWrites.length){
      const {error}=await db.from('ball_knower_weekly_scores').upsert(weeklyScoreWrites,{onConflict:'league_id,member_id,week_number'});
      if(error) throw error;
    }

    return res.status(200).json({
      ok:true,season,week,seasonType,gamesScheduled:scheduleRows.length,gamesPolled:pollable.length,
      playerRowsWritten,leagueScoresWritten:weeklyScoreWrites.length,statCorrections:correctionCount,weekIsFinal,checkedAt:now.toISOString(),
    });
  }catch(error:any){
    if(error instanceof Tank01Error){
      console.error('fantasy-live-scoring-provider-failed',{provider:'tank01',path:error.path,status:error.status,code:error.code,retryable:error.retryable,message:error.message});
      if(error.retryable)res.setHeader('Retry-After',error.code==='rate_limit'?'60':'30');
      return res.status(error.code==='auth'?503:502).json({ok:false,provider:'tank01',code:`tank01_${error.code}`,status:error.status||null,retryable:error.retryable,error:error.code==='auth'?'Live scoring provider authentication is unavailable. Existing scores are preserved.':'Live scoring provider is temporarily unavailable. Existing scores are preserved.'});
    }
    console.error('fantasy-live-scoring-failed',{message:error?.message||String(error)});
    return res.status(500).json({ok:false,code:'live_scoring_internal',error:error?.message||'Live scoring update failed'});
  }
}
