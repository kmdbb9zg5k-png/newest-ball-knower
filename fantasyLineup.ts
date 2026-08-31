import type { Player } from './types';

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

const stablePlayerKey=(player:Player)=>[
  player.name.trim().toLowerCase(),
  player.team.trim().toUpperCase(),
  player.position,
  player.id,
].join('|');

export function compareLineupPlayers(a:Player,b:Player):number{
  return (b.ovr||0)-(a.ovr||0)||stablePlayerKey(a).localeCompare(stablePlayerKey(b));
}

export function optimizeWeeklyLineup(roster:Player[]):Record<string,string>{
  const chosen=new Set<string>();
  const starters:Record<string,string>={};
  for(const slot of LINEUP_SLOTS){
    const candidate=[...roster]
      .filter(player=>!chosen.has(player.id)&&slot.accept(player))
      .sort(compareLineupPlayers)[0];
    if(candidate){starters[slot.id]=candidate.id;chosen.add(candidate.id);}
  }
  return starters;
}
