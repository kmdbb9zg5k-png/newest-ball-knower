const TEAM_NAMES={ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',LAR:'Los Angeles Rams',LAC:'Los Angeles Chargers',LV:'Las Vegas Raiders',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders'};
const ALIASES={LA:'LAR',WSH:'WAS',JAC:'JAX'};
const abbr=value=>{const raw=String(value||'').trim().toUpperCase();return ALIASES[raw]||raw||null};
const numberOrNull=value=>{if(value==null||(typeof value==='string'&&!value.trim()))return null;const n=Number(value);return Number.isFinite(n)?n:null};
const easternOffsetForDate=date=>{const parsed=new Date(`${date}T12:00:00Z`);if(Number.isNaN(parsed.getTime()))return'-05:00';const year=parsed.getUTCFullYear();const month=parsed.getUTCMonth()+1;if(month<3||month>11)return'-05:00';if(month>3&&month<11)return'-04:00';const nthSunday=(monthIndex,nth)=>{const first=new Date(Date.UTC(year,monthIndex,1));return 1+((7-first.getUTCDay())%7)+(nth-1)*7};const day=parsed.getUTCDate();if(month===3)return day>=nthSunday(2,2)?'-04:00':'-05:00';return day<nthSunday(10,1)?'-04:00':'-05:00'};
const isoDate=value=>{const raw=String(value||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const parsed=Date.parse(raw);return Number.isFinite(parsed)?new Date(parsed).toISOString().slice(0,10):null};
const normalizedClock=value=>{const raw=String(value||'').trim();if(!raw)return null;const twelve=raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);if(twelve){let hour=Number(twelve[1])%12;if(twelve[4].toUpperCase()==='PM')hour+=12;return`${String(hour).padStart(2,'0')}:${twelve[2]}:${twelve[3]||'00'}`;}const twentyFour=raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);if(twentyFour){const hour=Number(twentyFour[1]);if(hour<0||hour>23)return null;return`${String(hour).padStart(2,'0')}:${twentyFour[2]}:${twentyFour[3]||'00'}`;}return null};
export const kickoffIso=(date,time)=>{const day=isoDate(date);if(!day||!time)return null;const raw=String(time).trim();if(/^\d{2}:\d{2}(?::\d{2})?Z$/.test(raw)||/^\d{2}:\d{2}(?::\d{2})?[+-]\d{2}:?\d{2}$/.test(raw))return`${day}T${raw}`;const clock=normalizedClock(raw);return clock?`${day}T${clock}${easternOffsetForDate(day)}`:null};
const valueList=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
const statusFinal=value=>/final|complete|closed|game over/i.test(String(value||''));

const normalizeNflDataRows=rows=>rows.flatMap(g=>{
  const stableId=String(g?.game_id||g?.id||'').trim();if(!stableId)return[];
  const awayAbbr=abbr(g?.away_team||g?.away);const homeAbbr=abbr(g?.home_team||g?.home);if(!awayAbbr||!homeAbbr||awayAbbr===homeAbbr)return[];
  const spread=numberOrNull(g?.spread_line??g?.spread);const awayScore=numberOrNull(g?.away_score);const homeScore=numberOrNull(g?.home_score);const date=g?.gameday||g?.game_date||g?.date||null;const time=g?.gametime||g?.game_time||null;const kickoffAt=kickoffIso(date,time);const status=String(g?.game_status??g?.status??g?.game_state??'').trim();const hasScores=awayScore!==null&&homeScore!==null;
  return[{id:stableId,kickoffAt,away:TEAM_NAMES[awayAbbr]||awayAbbr,home:TEAM_NAMES[homeAbbr]||homeAbbr,awayAbbr,homeAbbr,awaySpread:spread===null?null:spread>0?spread:spread<0?-Math.abs(spread):0,homeSpread:spread===null?null:spread>0?-spread:spread<0?Math.abs(spread):0,total:numberOrNull(g?.total_line??g?.over_under??g?.total),awayScore,homeScore,final:hasScores&&statusFinal(status),status}];
});

const tankGet=async(path,params={})=>{
  const key=process.env.TANK01_API_KEY||process.env.RAPIDAPI_KEY;if(!key)throw new Error('Tank01 fallback is not configured');
  const host=process.env.TANK01_RAPIDAPI_HOST||'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
  const url=new URL(`https://${host}${path}`);for(const[name,value]of Object.entries(params))url.searchParams.set(name,String(value));
  const response=await fetch(url,{headers:{'x-rapidapi-key':key,'x-rapidapi-host':host},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(`Tank01 ${path} ${response.status}`);const payload=await response.json();return payload?.body??payload;
};
const tankKickoff=value=>{const epoch=numberOrNull(value?.gameTime_epoch??value?.gameTimeEpoch??value?.kickoffEpoch);if(epoch&&epoch>0){const ms=epoch>10_000_000_000?epoch:epoch*1000;const date=new Date(ms);if(Number.isFinite(date.getTime()))return date.toISOString();}return kickoffIso(value?.gameDate??value?.gameday??value?.date,value?.gameTime??value?.gametime??value?.time)};
const fetchTank01FallbackGames=async()=>{
  const current=await tankGet('/getNFLCurrentInfo');const season=Math.max(2026,Number(current?.season)||new Date().getUTCFullYear());const week=Math.max(1,Math.min(22,Number(current?.week)||1));const seasonType=String(current?.seasonType||'reg');
  const payload=await tankGet('/getNFLGamesForWeek',{week,season,seasonType});
  const games=valueList(payload).flatMap((g,index)=>{const id=String(g?.gameID||g?.gameId||g?.id||`tank01-${season}-${week}-${index}`).trim();const awayAbbr=abbr(g?.away||g?.awayTeam);const homeAbbr=abbr(g?.home||g?.homeTeam);if(!id||!awayAbbr||!homeAbbr||awayAbbr===homeAbbr)return[];const awayScore=numberOrNull(g?.awayPts??g?.awayScore);const homeScore=numberOrNull(g?.homePts??g?.homeScore);const status=String(g?.gameStatus||g?.status||'Scheduled');const hasScores=awayScore!==null&&homeScore!==null;return[{id,kickoffAt:tankKickoff(g),away:TEAM_NAMES[awayAbbr]||awayAbbr,home:TEAM_NAMES[homeAbbr]||homeAbbr,awayAbbr,homeAbbr,awaySpread:null,homeSpread:null,total:null,awayScore,homeScore,final:hasScores&&statusFinal(status),status:`${status}${status?' · ':''}schedule fallback`}];});
  if(!games.length)throw new Error('Tank01 fallback returned no games');return games;
};

export async function fetchCanonicalPredictionGames(){
  const attempts=[5000,3000];let lastError;
  for(const timeoutMs of attempts){
    try{
      const response=await fetch('https://api.nfldata.org/v1/games?season=2026&limit=400',{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; BallKnower/1.0)'},signal:AbortSignal.timeout(timeoutMs)});
      if(!response.ok)throw new Error(`NFL feed returned ${response.status}`);
      const payload=await response.json();const rows=Array.isArray(payload?.data)?payload.data:Array.isArray(payload)?payload:[];if(!rows.length)throw new Error('NFL feed returned no games');
      const games=normalizeNflDataRows(rows);if(!games.length)throw new Error('NFL feed returned no stable game IDs');return games;
    }catch(error){lastError=error;}
  }
  try{return await fetchTank01FallbackGames()}catch(fallbackError){console.warn('picks-tank01-fallback-degraded',String(fallbackError?.message||fallbackError));}
  throw lastError instanceof Error?lastError:new Error('NFL feed unavailable');
}

export function gradeCanonicalPrediction(pick,game){
  if(!game.final||game.awayScore===null||game.homeScore===null)return null;
  if(pick.market==='spread'){
    const selectedAway=pick.selection===game.away;const selectedHome=pick.selection===game.home;if(!selectedAway&&!selectedHome)return null;
    const selectedScore=(selectedAway?game.awayScore:game.homeScore)+pick.lockedLine;const opponentScore=selectedAway?game.homeScore:game.awayScore;
    return selectedScore>opponentScore?'win':selectedScore<opponentScore?'loss':'push';
  }
  if(pick.market==='total'){
    const total=game.awayScore+game.homeScore;if(pick.selection==='over')return total>pick.lockedLine?'win':total<pick.lockedLine?'loss':'push';if(pick.selection==='under')return total<pick.lockedLine?'win':total>pick.lockedLine?'loss':'push';
  }
  return null;
}
