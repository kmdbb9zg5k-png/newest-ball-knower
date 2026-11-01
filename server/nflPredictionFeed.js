import {nflverseCsv,normalizeTeam,requireColumns,attribution} from './bk/nflverse-csv.js';
import {easternKickoff} from './bk/nflverse-schedule.js';

const TEAM_NAMES={ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',LAR:'Los Angeles Rams',LAC:'Los Angeles Chargers',LV:'Las Vegas Raiders',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders'};
const ALIASES={LA:'LAR',WSH:'WAS',JAC:'JAX'};
const abbr=value=>{const raw=String(value||'').trim().toUpperCase();return ALIASES[raw]||raw||null};
const numberOrNull=value=>{if(value==null||(typeof value==='string'&&!value.trim()))return null;const n=Number(value);return Number.isFinite(n)?n:null};
const easternOffsetForDate=date=>{const parsed=new Date(`${date}T12:00:00Z`);if(Number.isNaN(parsed.getTime()))return'-05:00';const year=parsed.getUTCFullYear();const month=parsed.getUTCMonth()+1;if(month<3||month>11)return'-05:00';if(month>3&&month<11)return'-04:00';const nthSunday=(monthIndex,nth)=>{const first=new Date(Date.UTC(year,monthIndex,1));return 1+((7-first.getUTCDay())%7)+(nth-1)*7};const day=parsed.getUTCDate();if(month===3)return day>=nthSunday(2,2)?'-04:00':'-05:00';return day<nthSunday(10,1)?'-04:00':'-05:00'};
const isoDate=value=>{const raw=String(value||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;if(/^\d{8}$/.test(raw))return`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;const parsed=Date.parse(raw);return Number.isFinite(parsed)?new Date(parsed).toISOString().slice(0,10):null};
const normalizedClock=value=>{const raw=String(value||'').trim();if(!raw)return null;const twelve=raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);if(twelve){let hour=Number(twelve[1])%12;if(twelve[4].toUpperCase()==='PM')hour+=12;return`${String(hour).padStart(2,'0')}:${twelve[2]}:${twelve[3]||'00'}`;}const twentyFour=raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);if(twentyFour){const hour=Number(twentyFour[1]);if(hour<0||hour>23)return null;return`${String(hour).padStart(2,'0')}:${twentyFour[2]}:${twentyFour[3]||'00'}`;}return null};
export const kickoffIso=(date,time)=>{const day=isoDate(date);if(!day||!time)return null;const raw=String(time).trim();if(/^\d{2}:\d{2}(?::\d{2})?Z$/.test(raw)||/^\d{2}:\d{2}(?::\d{2})?[+-]\d{2}:?\d{2}$/.test(raw))return`${day}T${raw}`;const clock=normalizedClock(raw);return clock?`${day}T${clock}${easternOffsetForDate(day)}`:null};

export const normalizeNflDataRows=rows=>rows.flatMap(g=>{
  const stableId=String(g?.game_id||g?.id||'').trim();if(!stableId)return[];
  const awayAbbr=abbr(g?.away_team||g?.away);const homeAbbr=abbr(g?.home_team||g?.home);if(!awayAbbr||!homeAbbr||awayAbbr===homeAbbr)return[];
  const spread=numberOrNull(g?.spread_line??g?.spread);const awayScore=numberOrNull(g?.away_score);const homeScore=numberOrNull(g?.home_score);const date=g?.gameday||g?.game_date||g?.date||null;const time=g?.gametime||g?.game_time||null;const kickoffAt=kickoffIso(date,time);const status=String(g?.game_status??g?.status??g?.game_state??'').trim();const hasScores=awayScore!==null&&homeScore!==null;const providerFinal=/final|complete|closed/i.test(status);const total=numberOrNull(g?.total_line??g?.over_under??g?.total);
  return[{id:stableId,kickoffAt,scheduleDate:isoDate(date),season:numberOrNull(g?.season),week:numberOrNull(g?.week),seasonType:String(g?.game_type||'REG').toUpperCase(),away:TEAM_NAMES[awayAbbr]||awayAbbr,home:TEAM_NAMES[homeAbbr]||homeAbbr,awayAbbr,homeAbbr,awaySpread:spread===null?null:spread>0?spread:spread<0?-Math.abs(spread):0,homeSpread:spread===null?null:spread>0?-spread:spread<0?Math.abs(spread):0,total,awayScore,homeScore,final:hasScores&&providerFinal,status,oddsSource:spread!==null||total!==null?'NFLData':null}];
});

const TANK_ODDS_METADATA=new Set(['last_updated_e_time','gameDate','teamIDHome','teamIDAway','awayTeam','homeTeam','gameID']);
const TANK_ODDS_PREFERENCE=['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet'];
export const normalizeTank01Odds=entry=>{
  if(!entry||typeof entry!=='object')return{awaySpread:null,homeSpread:null,total:null,source:null};
  const candidates=Object.entries(entry)
    .filter(([key,value])=>!TANK_ODDS_METADATA.has(key)&&value&&typeof value==='object'&&!Array.isArray(value))
    .sort(([a],[b])=>{
      const ai=TANK_ODDS_PREFERENCE.findIndex(name=>a.toLowerCase().includes(name));
      const bi=TANK_ODDS_PREFERENCE.findIndex(name=>b.toLowerCase().includes(name));
      return(ai<0?999:ai)-(bi<0?999:bi);
    });
  for(const[source,book]of candidates){
    const awayRaw=numberOrNull(book?.awayTeamSpread??book?.awaySpread??book?.spread?.away);
    const homeRaw=numberOrNull(book?.homeTeamSpread??book?.homeSpread??book?.spread?.home);
    const awaySpread=awayRaw??(homeRaw===null?null:-homeRaw);
    const homeSpread=homeRaw??(awayRaw===null?null:-awayRaw);
    const total=numberOrNull(book?.totalOver??book?.totalUnder??book?.overUnder??book?.total);
    if(awaySpread!==null||homeSpread!==null||total!==null)return{awaySpread,homeSpread,total,source};
  }
  return{awaySpread:null,homeSpread:null,total:null,source:null};
};

const tankKickoff=value=>{const epoch=numberOrNull(value?.gameTime_epoch??value?.gameTimeEpoch??value?.kickoffEpoch);if(epoch&&epoch>0){const ms=epoch>10_000_000_000?epoch:epoch*1000;const date=new Date(ms);if(Number.isFinite(date.getTime()))return date.toISOString();}return kickoffIso(value?.gameDate??value?.gameday??value?.date,value?.gameTime??value?.gametime??value?.time)};
export function matchPredictionKickoff(game,candidates){
  const matches=candidates.filter(candidate=>abbr(candidate?.away||candidate?.awayTeam)===game.awayAbbr&&abbr(candidate?.home||candidate?.homeTeam)===game.homeAbbr&&isoDate(candidate?.gameDate??candidate?.gameday??candidate?.date)===game.scheduleDate);
  if(matches.length!==1)return null;
  const kickoff=tankKickoff(matches[0]);if(!kickoff)return null;
  // Reject provider conflicts rather than guessing an NFL kickoff or remapping a pick.
  const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(kickoff));
  return localDay===game.scheduleDate?kickoff:null;
}
/** Periodically published schedules, lines and completed results; never a live feed. */
export const NFLVERSE_PREDICTION_URL='https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
export const NFLVERSE_COMPLETED_URL='https://api.github.com/repos/nflverse/nflverse-pbp-internal/contents/released_games.csv?ref=main';
const PREDICTION_TTL=300_000;
const optionalNumber=(value,min,max,integer=false)=>{
  if(value==null||String(value).trim()===''||String(value).trim()==='NA')return null;
  if(!/^-?\d+(?:\.\d+)?$/.test(String(value).trim()))throw new Error('invalid_prediction_number');
  const number=Number(value);
  if(!Number.isFinite(number)||number<min||number>max||(integer&&!Number.isInteger(number)))throw new Error('invalid_prediction_number');
  return number;
};
export function normalizeNflversePredictionRows(rows,nowMs=Date.now(),season=2026){
  requireColumns(rows,['game_id','season','game_type','week','gameday','gametime','away_team','home_team','away_score','home_score','result','total','spread_line','total_line']);
  const seen=new Set();
  return rows.filter(row=>Number(row.season)===season).map(row=>{
    const id=String(row.game_id||'').trim(),week=Number(row.week);
    const awayAbbr=normalizeTeam(row.away_team),homeAbbr=normalizeTeam(row.home_team);
    const parts=id.match(/^(\d{4})_(\d{2})_([A-Z]{2,3})_([A-Z]{2,3})$/);
    if(!parts||Number(parts[1])!==season||Number(parts[2])!==week||!awayAbbr||!homeAbbr||awayAbbr===homeAbbr||
       normalizeTeam(parts[3])!==awayAbbr||normalizeTeam(parts[4])!==homeAbbr||!Number.isInteger(week)||week<1||week>22||
       !['REG','WC','DIV','CON','SB'].includes(row.game_type))throw new Error('invalid_prediction_game');
    if(seen.has(id))throw new Error('duplicate_prediction_game');seen.add(id);
    const day=String(row.gameday||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day<`${season}-08-01`||day>=`${season+1}-03-01`)throw new Error('invalid_prediction_date');
    const time=String(row.gametime||'').trim();
    if(time&&time!=='NA'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('invalid_prediction_time');
    const kickoffAt=time&&time!=='NA'?easternKickoff(day,time):null;
    const spread=optionalNumber(row.spread_line,-100,100),total=optionalNumber(row.total_line,0,200);
    const awayScore=optionalNumber(row.away_score,0,199,true),homeScore=optionalNumber(row.home_score,0,199,true);
    const result=optionalNumber(row.result,-199,199,true),combined=optionalNumber(row.total,0,398,true);
    // Arithmetic is validation only: it cannot prove that a game has ended.
    // Keep candidates private until the separate released-games manifest confirms completion.
    const consistent=awayScore!==null&&homeScore!==null&&result!==null&&combined!==null&&
      result===homeScore-awayScore&&combined===homeScore+awayScore;
    const espn=/^\d+$/.test(String(row.espn||''))?String(row.espn):null;
    const variants=team=>({LAR:['LAR','LA'],JAX:['JAX','JAC'],WAS:['WAS','WSH']}[team]||[team]);
    const aliases=espn?[`espn-${espn}`,espn]:[];
    for(const away of variants(awayAbbr))for(const home of variants(homeAbbr)){
      const legacy=`${day.replace(/-/g,'')}_${away}@${home}`;aliases.push(legacy,`tank01-${legacy}`);
    }
    return{id,kickoffAt,scheduleDate:day,season,week,seasonType:row.game_type,
      away:TEAM_NAMES[awayAbbr],home:TEAM_NAMES[homeAbbr],awayAbbr,homeAbbr,
      awaySpread:spread,homeSpread:spread===null?null:-spread,total,
      awayScore:null,homeScore:null,final:false,completionConfirmed:false,
      publishedResult:consistent?{awayScore,homeScore,result,total:combined}:null,
      status:kickoffAt&&Date.parse(kickoffAt)>nowMs?'Scheduled':'Result pending',
      oddsSource:spread!==null||total!==null?'nflverse published lines':null,
      source:'nflverse',live:false,espnId:espn,
      aliases,
    };
  }).sort((a,b)=>a.week-b.week||a.id.localeCompare(b.id));
}
/** The upstream release worker appends IDs only after status contains FINAL. */
export function normalizeCompletedPredictionIds(rows){
  requireColumns(rows,['game_id']);
  const ids=new Set();
  for(const row of rows){
    const id=String(row.game_id||'').trim();
    if(!/^\d{4}_\d{2}_[A-Z]{2,3}_[A-Z]{2,3}$/.test(id)||ids.has(id))throw new Error('invalid_completed_manifest');
    ids.add(id);
  }
  return [...ids];
}
export function applyPredictionCompletion(games,completedIds,nowMs=Date.now()){
  return games.map(game=>{
    const {publishedResult,...publicGame}=game;
    const result=publishedResult;
    const valid=result&&[result.awayScore,result.homeScore,result.result,result.total].every(Number.isInteger)&&
      result.awayScore>=0&&result.awayScore<=199&&result.homeScore>=0&&result.homeScore<=199&&
      result.result===result.homeScore-result.awayScore&&result.total===result.homeScore+result.awayScore;
    const final=Boolean(valid&&completedIds.has(game.id)&&game.kickoffAt&&Date.parse(game.kickoffAt)<nowMs);
    return {...publicGame,final,completionConfirmed:final,
      awayScore:final?result.awayScore:null,homeScore:final?result.homeScore:null,
      status:final?'Final':game.kickoffAt&&Date.parse(game.kickoffAt)>nowMs?'Scheduled':'Result pending'};
  });
}
export async function fetchCanonicalPredictionGames({fetchImpl=fetch,now=Date.now}={}){
  const schedule=nflverseCsv(NFLVERSE_PREDICTION_URL,rows=>{
    const games=normalizeNflversePredictionRows(rows,now());
    if(games.length<272||games.length>400||new Set(games.flatMap(game=>[game.homeAbbr,game.awayAbbr])).size!==32)throw new Error('incomplete_prediction_schedule');
    return games;
  },PREDICTION_TTL,fetchImpl,now,'prediction-games-v2');
  const completion=nflverseCsv(NFLVERSE_COMPLETED_URL,normalizeCompletedPredictionIds,
    PREDICTION_TTL,fetchImpl,now,'completed-games-v2').catch(()=>null);
  const [snapshot,completed]=await Promise.all([schedule,completion]);
  // GitHub Contents returns the manifest commit time as Last-Modified. A score
  // snapshot must be published at/after that version: local pre-completion
  // partials and unknown publication ordering can never settle a saved pick.
  const scorePublication=Date.parse(snapshot.sourceUpdatedAt??'');
  const completionPublication=Date.parse(completed?.sourceUpdatedAt??'');
  const scorePublicationVerified=Boolean(completed&&Number.isFinite(scorePublication)&&
    Number.isFinite(completionPublication)&&scorePublication>=completionPublication);
  const completedIds=scorePublicationVerified?new Set(completed.items):new Set();
  const games=applyPredictionCompletion(snapshot.items,completedIds,now());
  return Object.assign(games,{fetchedAt:snapshot.updatedAt,sourceUpdatedAt:snapshot.sourceUpdatedAt,
    completionAvailable:completed!==null,scorePublicationVerified,completionFetchedAt:completed?.updatedAt??null,
    completionSourceUpdatedAt:completed?.sourceUpdatedAt??null,
    source:'nflverse',freshness:'periodic',...attribution});
}

export function gradeCanonicalPrediction(pick,game){
  if((game.source==='nflverse'&&game.completionConfirmed!==true)||!game.final||game.awayScore===null||game.homeScore===null||!Number.isFinite(pick.lockedLine))return null;
  if(pick.market==='spread'){
    const selectedTeam=normalizeTeam(String(pick.selection||'').toUpperCase());const selectedAway=pick.selection===game.away||selectedTeam===game.awayAbbr;const selectedHome=pick.selection===game.home||selectedTeam===game.homeAbbr;if(!selectedAway&&!selectedHome)return null;
    const selectedScore=(selectedAway?game.awayScore:game.homeScore)+pick.lockedLine;const opponentScore=selectedAway?game.homeScore:game.awayScore;
    return selectedScore>opponentScore?'win':selectedScore<opponentScore?'loss':'push';
  }
  if(pick.market==='total'){
    const total=game.awayScore+game.homeScore;if(pick.selection==='over')return total>pick.lockedLine?'win':total<pick.lockedLine?'loss':'push';if(pick.selection==='under')return total<pick.lockedLine?'win':total>pick.lockedLine?'loss':'push';
  }
  return null;
}
