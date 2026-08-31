const TEAM_NAMES: Record<string,string>={
  ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',LAR:'Los Angeles Rams',LAC:'Los Angeles Chargers',LV:'Las Vegas Raiders',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders',
};
const ALIASES:Record<string,string>={LA:'LAR',WSH:'WAS'};
const abbr=(value:any)=>{const raw=String(value||'').trim().toUpperCase();return ALIASES[raw]||raw||null};
const numberOrNull=(value:any)=>{if(value==null||(typeof value==='string'&&!value.trim()))return null;const n=Number(value);return Number.isFinite(n)?n:null};
const easternOffsetForDate=(date:string)=>{const parsed=new Date(`${date}T12:00:00Z`);if(Number.isNaN(parsed.getTime()))return'-05:00';const year=parsed.getUTCFullYear();const month=parsed.getUTCMonth()+1;if(month<3||month>11)return'-05:00';if(month>3&&month<11)return'-04:00';const nthSunday=(monthIndex:number,nth:number)=>{const first=new Date(Date.UTC(year,monthIndex,1));return 1+((7-first.getUTCDay())%7)+(nth-1)*7};const day=parsed.getUTCDate();if(month===3)return day>=nthSunday(2,2)?'-04:00':'-05:00';return day<nthSunday(10,1)?'-04:00':'-05:00'};
const kickoffIso=(date:any,time:any)=>{if(!date)return null;if(!time)return String(date);const clean=String(time).trim();if(/Z$|[+-]\d{2}:?\d{2}$/.test(clean))return`${date}T${clean}`;return`${date}T${clean}${easternOffsetForDate(String(date))}`};

export type CanonicalPredictionGame={id:string;kickoffAt:string|null;away:string;home:string;awayAbbr:string|null;homeAbbr:string|null;awaySpread:number|null;homeSpread:number|null;total:number|null;awayScore:number|null;homeScore:number|null;final:boolean;status?:string};

export async function fetchCanonicalPredictionGames():Promise<CanonicalPredictionGame[]>{
  const attempts=[5000,3000];let lastError:unknown;
  for(const timeoutMs of attempts){
    try{
      const response=await fetch('https://api.nfldata.org/v1/games?season=2026&limit=400',{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; BallKnower/1.0)'},signal:AbortSignal.timeout(timeoutMs)});
      if(!response.ok)throw new Error(`NFL feed returned ${response.status}`);
      const payload:any=await response.json();const rows=Array.isArray(payload?.data)?payload.data:Array.isArray(payload)?payload:[];
      if(!rows.length)throw new Error('NFL feed returned no games');
      return rows.map((g:any,i:number)=>{
        const awayAbbr=abbr(g?.away_team||g?.away);const homeAbbr=abbr(g?.home_team||g?.home);const spread=numberOrNull(g?.spread_line??g?.spread);const awayScore=numberOrNull(g?.away_score);const homeScore=numberOrNull(g?.home_score);const date=g?.gameday||g?.game_date||g?.date||null;const time=g?.gametime||g?.game_time||null;const kickoffAt=kickoffIso(date,time);const status=String(g?.game_status??g?.status??g?.game_state??'').trim();const kickoffMs=kickoffAt?Date.parse(kickoffAt):NaN;const hasScores=awayScore!==null&&homeScore!==null;const providerFinal=/final|complete|closed/i.test(status);const conservativeFinal=hasScores&&Number.isFinite(kickoffMs)&&Date.now()-kickoffMs>=6*60*60*1000;
        return{id:String(g?.game_id||g?.id||i),kickoffAt,away:awayAbbr?(TEAM_NAMES[awayAbbr]||awayAbbr):'Away',home:homeAbbr?(TEAM_NAMES[homeAbbr]||homeAbbr):'Home',awayAbbr,homeAbbr,awaySpread:spread===null?null:spread>0?spread:spread<0?-Math.abs(spread):0,homeSpread:spread===null?null:spread>0?-spread:spread<0?Math.abs(spread):0,total:numberOrNull(g?.total_line??g?.over_under??g?.total),awayScore,homeScore,final:hasScores&&(providerFinal||conservativeFinal),status};
      });
    }catch(error){lastError=error;}
  }
  throw lastError instanceof Error?lastError:new Error('NFL feed unavailable');
}

export function gradeCanonicalPrediction(pick:{market:string;selection:string;lockedLine:number},game:CanonicalPredictionGame):'win'|'loss'|'push'|null{
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
