import type { Player } from './types';

export type WeeklyProjectionInput = {
  playerId:string;
  projectedPoints:Record<string,number>;
};

export function resolveWeeklyProjection(
  playerId:string,
  projections:WeeklyProjectionInput[],
  format:'standard'|'half_ppr'|'ppr',
  hasCustomScoring:boolean,
  seasonProjection:number|null=null,
  verifiedSeasonGames=0,
  playsThisWeek=true,
):number|null{
  if(hasCustomScoring) return null;
  const value=Number(projections.find(item=>item.playerId===playerId)?.projectedPoints[format]);
  if(Number.isFinite(value)) return value;
  if(seasonProjection===null) return null;
  const seasonValue=Number(seasonProjection);
  if(verifiedSeasonGames!==17||!Number.isFinite(seasonValue)||seasonValue<0) return null;
  return playsThisWeek?seasonValue/17:0;
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

export type StandardFantasyLineupSlotId=(typeof LINEUP_SLOTS)[number]['id'];
export type LineupMoveResult={
  starters:Record<string,string>;
  changed:boolean;
  reason?:string;
};

const stablePlayerKey=(player:Player)=>[
  player.position,
  player.name.trim().toLowerCase(),
  player.team.trim().toUpperCase(),
  player.id,
].join('|');
const compareCodeUnits=(a:string,b:string)=>a<b?-1:a>b?1:0;

/**
 * Neutral deterministic fallback for standard fantasy. This deliberately does not
 * inspect Madden/football-game OVR. Callers with fantasy projections should pass a
 * projection-aware comparator to optimizeWeeklyLineup instead.
 */
export function compareLineupPlayers(a:Player,b:Player):number{
  return compareCodeUnits(stablePlayerKey(a),stablePlayerKey(b));
}

const slotById=(slotId:string)=>LINEUP_SLOTS.find(slot=>slot.id===slotId);

/**
 * Move an eligible roster player into a standard-fantasy starter slot without ever
 * duplicating a starter or moving a kicked-off/locked player.
 *
 * If the selected player is already starting elsewhere, this performs an atomic
 * starter-to-starter swap when the displaced target starter is eligible for the
 * selected player's prior slot. If not, the prior slot is left empty and the
 * displaced player returns to the bench; validation then keeps Save disabled until
 * the manager fills the open slot.
 */
export function movePlayerIntoLineupSlot(
  roster:Player[],
  starters:Record<string,string>,
  targetSlotId:string,
  playerId:string,
  lockedPlayerIds:Iterable<string>=[],
):LineupMoveResult{
  const targetSlot=slotById(targetSlotId);
  if(!targetSlot)return{starters:{...starters},changed:false,reason:'That lineup slot is unavailable.'};
  const player=roster.find(item=>item.id===playerId);
  if(!player)return{starters:{...starters},changed:false,reason:'That player is no longer on your roster.'};
  if(!targetSlot.accept(player))return{starters:{...starters},changed:false,reason:`${player.name} is not eligible for ${targetSlot.label}.`};

  const locked=new Set(lockedPlayerIds);
  const currentTargetId=starters[targetSlotId]||'';
  if(currentTargetId===playerId)return{starters:{...starters},changed:false};
  if(currentTargetId&&locked.has(currentTargetId))return{starters:{...starters},changed:false,reason:'That starter is locked because the game has started.'};

  const sourceEntry=Object.entries(starters).find(([slotId,id])=>slotId!==targetSlotId&&id===playerId);
  const sourceSlotId=sourceEntry?.[0];
  if(sourceSlotId&&locked.has(playerId))return{starters:{...starters},changed:false,reason:`${player.name} is locked because the game has started.`};

  const next={...starters};
  // Defensive de-duplication: the selected player may occupy only the requested slot.
  for(const [slotId,id] of Object.entries(next)){
    if(slotId!==targetSlotId&&id===playerId)delete next[slotId];
  }
  next[targetSlotId]=playerId;

  if(sourceSlotId&&currentTargetId){
    const sourceSlot=slotById(sourceSlotId);
    const displaced=roster.find(item=>item.id===currentTargetId);
    if(sourceSlot&&displaced&&sourceSlot.accept(displaced))next[sourceSlotId]=currentTargetId;
  }

  const ids=Object.values(next).filter(Boolean);
  if(new Set(ids).size!==ids.length){
    return{starters:{...starters},changed:false,reason:'That move would assign a player to more than one starter slot.'};
  }
  return{starters:next,changed:true};
}

export function optimizeWeeklyLineup(
  roster:Player[],
  comparePlayers:(a:Player,b:Player)=>number=compareLineupPlayers,
):Record<string,string>{
  const chosen=new Set<string>();
  const starters:Record<string,string>={};
  for(const slot of LINEUP_SLOTS){
    const candidate=[...roster]
      .filter(player=>!chosen.has(player.id)&&slot.accept(player))
      .sort(comparePlayers)[0];
    if(candidate){starters[slot.id]=candidate.id;chosen.add(candidate.id);}
  }
  return starters;
}
