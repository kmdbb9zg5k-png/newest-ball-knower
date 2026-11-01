// Provider changes must never rename a saved pick or replace its locked line.
const teams={ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',LAR:'Los Angeles Rams',LAC:'Los Angeles Chargers',LV:'Las Vegas Raiders',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders'};
const aliases={LA:'LAR',JAC:'JAX',WSH:'WAS','WASHINGTON FOOTBALL TEAM':'WAS','WASHINGTON REDSKINS':'WAS','OAKLAND RAIDERS':'LV','SAN DIEGO CHARGERS':'LAC','ST LOUIS RAMS':'LAR'};
const clean=value=>typeof value==='string'?value.trim().replace(/\./g,'').replace(/\s+/g,' ').toUpperCase():'';
const names=Object.fromEntries(Object.entries(teams).map(([key,name])=>[clean(name),key]));
export const predictionTeam=value=>{const key=clean(value);return aliases[key]||names[key]||key;};
const nflDayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
export function predictionDay(value){
  if(typeof value!=='string'||!value)return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return Number.isFinite(Date.parse(value))?value:null;
  if(!/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)||!Number.isFinite(Date.parse(value)))return null;
  const parts=nflDayFormatter.formatToParts(new Date(value));
  const day=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${day.year}-${day.month}-${day.day}`;
}
const metadata=reference=>({away:predictionTeam(reference?.awayTeam??reference?.away??reference?.awayAbbr),home:predictionTeam(reference?.homeTeam??reference?.home??reference?.homeAbbr),day:predictionDay(reference?.kickoffAt??reference?.date??reference?.scheduleDate)});
const compatible=(reference,game)=>{const a=metadata(reference),b=metadata(game);return(!a.away||a.away===b.away)&&(!a.home||a.home===b.home)&&(!a.day||a.day===b.day);};
const identityKey=value=>value.away&&value.home&&value.day?`${value.away}|${value.home}|${value.day}`:null;
export function createPredictionGameResolver(games){
  const ids=new Map(),matchups=new Map();
  const add=(index,key,game)=>{if(!key)return;const values=index.get(key)||[];if(!values.includes(game))values.push(game);index.set(key,values);};
  for(const game of games){add(ids,game.id,game);for(const alias of Array.isArray(game.aliases)?game.aliases:[])add(ids,alias,game);add(matchups,identityKey(metadata(game)),game);}
  return reference=>{
    const id=String(reference?.gameId??reference?.id??'');
    const identified=ids.get(id)||[];
    if(identified.length)return{game:identified.length===1&&compatible(reference,identified[0])?identified[0]:null,ambiguous:identified.length>1,candidates:identified};
    const matches=matchups.get(identityKey(metadata(reference)))||[];
    return{game:matches.length===1?matches[0]:null,ambiguous:matches.length>1,candidates:matches};
  };
}
export const resolvePredictionGame=(reference,games)=>createPredictionGameResolver(games)(reference);
export function indexPredictionPicks(picks,games){
  const resolve=createPredictionGameResolver(games),index=new Map(games.map(game=>[game.id,{picks:[],ambiguous:false}]));
  for(const pick of picks){
    const match=resolve(pick);
    if(match.game){const value=index.get(match.game.id);value.picks.push(pick);value.ambiguous=value.ambiguous||value.picks.length>1;}
    else for(const candidate of match.candidates)index.get(candidate.id).ambiguous=true;
  }
  return index;
}
export const predictionPicksForGame=(game,picks,games)=>indexPredictionPicks(picks,games).get(game.id)||{picks:[],ambiguous:false};
export const samePredictionChoice=(a,b)=>Boolean(a&&b&&a.market===b.market&&predictionTeam(a.selection)===predictionTeam(b.selection)&&a.lockedLine===b.lockedLine);
