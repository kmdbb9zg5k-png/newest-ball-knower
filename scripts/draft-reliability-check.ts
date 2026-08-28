import { PLAYERS_DATABASE } from '../players';
import { getLiveFantasyDraftGroup, LIVE_FANTASY_POSITION_LIMITS, LIVE_FANTASY_ROSTER_REQUIREMENTS, type LiveFantasyDraftGroup } from '../liveFantasyRules';

type Method='game'|'random'|'commissioner';
type Pick={overall:number;round:number;memberId:string;playerId:string;group:LiveFantasyDraftGroup;source:'cpu'|'autopick'};
type Preferences={queue:string[];preRankings:string[];favorites:string[];doNotDraft:Set<string>};
const GROUPS=Object.keys(LIVE_FANTASY_ROSTER_REQUIREMENTS) as LiveFantasyDraftGroup[];
const TEAMS=10;
const ROSTER_SIZE=15;

const orders:Record<Method,string[]>={
  game:Array.from({length:10},(_,index)=>`m${index+1}`),
  random:[7,3,10,6,2,9,5,1,8,4].map(index=>`m${index}`),
  commissioner:Array.from({length:10},(_,index)=>`m${10-index}`),
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
    return group&&!drafted.has(player.id)&&!preferences.doNotDraft.has(player.id)&&(counts[group]||0)<LIVE_FANTASY_POSITION_LIMITS[group]&&(!requiredNow||requiredNow.has(group));
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

function run(method:Method){
  const order=orders[method];const picks:Pick[]=[];
  const ranked=PLAYERS_DATABASE.filter(player=>getLiveFantasyDraftGroup(player)).sort((a,b)=>b.ovr-a.ovr);
  const queued=ranked.find(player=>getLiveFantasyDraftGroup(player)==='RB')!;
  const avoided=ranked.find(player=>player.id!==queued.id)!;
  const preferences:Preferences={queue:[queued.id],preRankings:[ranked[2].id],favorites:[ranked[3].id],doNotDraft:new Set([avoided.id])};
  for(let pickIndex=0;pickIndex<TEAMS*ROSTER_SIZE;pickIndex++){
    const memberId=memberAt(order,pickIndex);const prefs:Preferences=memberId===order[0]?preferences:{queue:[],preRankings:[],favorites:[],doNotDraft:new Set<string>()};
    const player=selectPlayer(picks,memberId,prefs);const group=getLiveFantasyDraftGroup(player)!;
    picks.push({overall:pickIndex+1,round:Math.floor(pickIndex/10)+1,memberId,playerId:player.id,group,source:memberId===order[0]?'autopick':'cpu'});
  }
  if(new Set(picks.map(pick=>pick.playerId)).size!==TEAMS*ROSTER_SIZE)throw new Error(`${method}: duplicate player`);
  if(picks[0].playerId!==queued.id)throw new Error(`${method}: queue priority failed`);
  if(picks.some(pick=>pick.playerId===avoided.id&&pick.memberId===order[0]))throw new Error(`${method}: do-not-draft failed`);
  for(const memberId of order){
    const roster=picks.filter(pick=>pick.memberId===memberId);if(roster.length!==ROSTER_SIZE)throw new Error(`${method}: incomplete ${memberId}`);
    for(const group of GROUPS){const count=roster.filter(pick=>pick.group===group).length;if(count>LIVE_FANTASY_POSITION_LIMITS[group]||count<LIVE_FANTASY_ROSTER_REQUIREMENTS[group])throw new Error(`${method}: illegal ${memberId} ${group} ${count}`);}
  }
  return {method,teams:TEAMS,rosterSize:ROSTER_SIZE,picks:picks.length,uniquePlayers:new Set(picks.map(pick=>pick.playerId)).size,completeRosters:TEAMS,queuePriority:'passed',doNotDraft:'passed',snakeOrder:'passed'};
}

console.log(JSON.stringify((['game','random','commissioner'] as Method[]).map(run),null,2));
