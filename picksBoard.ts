import type {PicksGame} from './picksEngine';
export type PicksFilter='all'|'upcoming'|'live'|'final';
export type BoardGame=PicksGame&{scheduleDate?:string|null;season?:number|null;week?:number|null;seasonType?:string|null;awayAbbr?:string;homeAbbr?:string};
export const hasKickoff=(game:BoardGame)=>Boolean(game.date&&/T\d{2}:\d{2}/.test(game.date)&&Number.isFinite(Date.parse(game.date)));
export const gamePhase=(game:BoardGame,now=Date.now()):Exclude<PicksFilter,'all'>=>/final|complete|closed/i.test(game.status||'')?'final':/live|in progress|halftime/i.test(game.status||'')||(hasKickoff(game)&&Date.parse(game.date!)<=now)?'live':'upcoming';
export const slateKey=(game:BoardGame)=>game.season&&game.week?`${game.season}-${game.seasonType||'REG'}-${game.week}`:'schedule';
export const slateLabel=(game:BoardGame)=>game.week?`${game.seasonType&&game.seasonType.toUpperCase()!=='REG'?`${game.seasonType.toUpperCase()} · `:''}Week ${game.week}`:'Schedule';
export const gameOrder=(game:BoardGame)=>hasKickoff(game)?Date.parse(game.date!):game.scheduleDate&&/^\d{4}-\d{2}-\d{2}$/.test(game.scheduleDate)?Date.parse(`${game.scheduleDate}T23:59:59Z`):Number.MAX_SAFE_INTEGER;
export function initialSlate(games:BoardGame[],now=Date.now()):string{
  const ordered=[...games].sort((a,b)=>gameOrder(a)-gameOrder(b));
  const today=new Date(now).toISOString().slice(0,10);
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
