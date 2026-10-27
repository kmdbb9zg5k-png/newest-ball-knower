import type {PicksGame} from './picksEngine';
export type PicksFilter='all'|'upcoming'|'live'|'final';
export type BoardGame=PicksGame&{scheduleDate?:string|null;season?:number|null;week?:number|null;seasonType?:string|null;awayAbbr?:string;homeAbbr?:string};
export const hasKickoff=(game:BoardGame)=>Boolean(game.date&&/T\d{2}:\d{2}/.test(game.date)&&Number.isFinite(Date.parse(game.date)));
// A kickoff locks picks, but does not prove the provider is reporting a live game.
export const PICKS_LIVE_WINDOW_MS=12*60*60*1000;
const nflDay=(now:number)=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
  const calendar=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${calendar.year}-${calendar.month}-${calendar.day}`;
};
export function gamePhase(game:BoardGame,now=Date.now()):Exclude<PicksFilter,'all'>|'unknown'{
  const status=game.status||'';
  if(/final|complete|closed/i.test(status))return 'final';
  if(/postponed|cancelled|canceled|suspended|delayed/i.test(status))return 'unknown';
  const kickoff=hasKickoff(game)?Date.parse(game.date!):null;
  if(/live|in progress|halftime/i.test(status)){
    // Without a trustworthy recent kickoff, do not keep an old live flag forever.
    return kickoff!==null&&kickoff<=now&&now-kickoff<PICKS_LIVE_WINDOW_MS?'live':'unknown';
  }
  if(kickoff!==null&&kickoff<=now)return 'unknown';
  if(kickoff===null&&game.scheduleDate&&game.scheduleDate<nflDay(now))return 'unknown';
  return 'upcoming';
}
export const slateKey=(game:BoardGame)=>game.season&&game.week?`${game.season}-${game.seasonType||'REG'}-${game.week}`:'schedule';
export const slateLabel=(game:BoardGame)=>game.week?`${game.seasonType&&game.seasonType.toUpperCase()!=='REG'?`${game.seasonType.toUpperCase()} · `:''}Week ${game.week}`:'Schedule';
export const gameOrder=(game:BoardGame)=>hasKickoff(game)?Date.parse(game.date!):game.scheduleDate&&/^\d{4}-\d{2}-\d{2}$/.test(game.scheduleDate)?Date.parse(`${game.scheduleDate}T23:59:59Z`):Number.MAX_SAFE_INTEGER;
export function initialSlate(games:BoardGame[],now=Date.now()):string{
  const ordered=[...games].sort((a,b)=>gameOrder(a)-gameOrder(b));
  const today=nflDay(now);
  const first=ordered.find(game=>gamePhase(game,now)==='live')||ordered.find(game=>gamePhase(game,now)==='upcoming'&&(!game.scheduleDate||game.scheduleDate>=today))||ordered.at(-1);
  return first?slateKey(first):'';
}
export function visiblePicksGames(games:BoardGame[],slate:string,filter:PicksFilter,query:string,now=Date.now()):BoardGame[]{
  const search=query.trim().toLowerCase();
  return games.filter(game=>(!slate||slateKey(game)===slate)&&(filter==='all'||gamePhase(game,now)===filter)&&`${game.away} ${game.home} ${game.awayAbbr||''} ${game.homeAbbr||''}`.toLowerCase().includes(search)).sort((a,b)=>gameOrder(a)-gameOrder(b));
}
export function scheduleLabel(game:BoardGame):string{
  if(hasKickoff(game))return new Date(game.date!).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  // A calendar day is not a midnight kickoff. Keep it stable in every timezone.
  const day=game.scheduleDate;
  if(day&&/^\d{4}-\d{2}-\d{2}$/.test(day))return `${new Date(`${day}T12:00:00Z`).toLocaleDateString([],{month:'short',day:'numeric',timeZone:'UTC'})} · Time TBD`;
  return 'Kickoff time TBD';
}
export function parsePicksBoard(data:unknown):BoardGame[]{
  if(!data||typeof data!=='object'||!('games' in data)||!Array.isArray(data.games))throw new Error('Invalid matchup response');
  const seen=new Set<string>();
  return data.games.map((game:BoardGame)=>{
    if(!game||typeof game.id!=='string'||!game.id||typeof game.away!=='string'||!game.away||typeof game.home!=='string'||!game.home||seen.has(game.id))throw new Error('Invalid matchup');
    for(const key of ['homeSpread','awaySpread','spread','overUnder','awayScore','homeScore'] as const)if(game[key]!=null&&!Number.isFinite(game[key]))throw new Error('Invalid game value');
    seen.add(game.id);return game;
  });
}

export function nextPicksKickoffDelay(games:BoardGame[],now=Date.now()):number|null{
  const future=games.filter(hasKickoff).flatMap(game=>[Date.parse(game.date!),...(/live|in progress|halftime/i.test(game.status||'')?[Date.parse(game.date!)+PICKS_LIVE_WINDOW_MS]:[])]).filter(time=>time>now);
  return future.length?Math.min(Math.min(...future)-now+1,2_147_483_647):null;
}
