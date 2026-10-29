import type {Position} from './types';
import {cleanJourney,journeyHash,journeyProspects,type JourneyProfile,type JourneyState} from './myPlayerJourney';
import {draftPositionDrill,type DraftDrill,type DraftDrillRecord} from './myPlayerDraftCombine';
export type CombineStanding={id:string;name:string;position:string;mark:number;rank:number;mine:boolean;dnf?:boolean};
/** Stable simulated marks for the same fictional prospects used on this career's draft board. */
export function officialCombineStandings(profile:JourneyProfile&{draftJourney?:JourneyState},drill:DraftDrill,result:DraftDrillRecord):CombineStanding[]{
 const seed=cleanJourney(profile.draftJourney,profile).seed;
 const peers=journeyProspects(seed).filter(p=>['dash','shuttle','broad-jump','bench'].includes(drill)||draftPositionDrill(p.position as Position)===drill).map(p=>{
  const u=(journeyHash(`${seed}:${p.id}:${drill}:mark`)%10001)/10000;
  const heavy=['OT','OG','C','DT'].includes(p.position),fast=['WR','CB','S','RB'].includes(p.position);
  const mark=drill==='dash'?4.28+u*.65+(heavy?.65:fast?0:.2):drill==='shuttle'?3.95+u*.8+(heavy?.5:0):drill==='broad-jump'?2.25+u*1.05-(heavy?.2:0):drill==='bench'?Math.round(8+u*24+(heavy?5:0)):Math.round(45+u*53);
  return {id:p.id,name:p.name,position:p.position,mark:Number(mark.toFixed(3)),mine:false,dnf:false,rank:0};
 });
 const rows=[...peers,{id:'me',name:profile.name,position:profile.position,mark:Number(result.best.toFixed(3)),mine:true,dnf:Boolean(result.dnf),rank:0}];
 const lower=drill==='dash'||drill==='shuttle';
 rows.sort((a,b)=>Number(a.dnf)-Number(b.dnf)||(lower?a.mark-b.mark:b.mark-a.mark)||a.id.localeCompare(b.id));
 rows.forEach((row,index)=>{const prior=rows[index-1];row.rank=prior&&row.mark===prior.mark&&row.dnf===prior.dnf?prior.rank:index+1;});
 return rows;
}
