import type {Position} from './types';
export type DraftDrill='dash'|'broad-jump'|'shuttle'|'bench'|'routes'|'rb'|'db';
export type DraftDrillRecord={best:number;last:number;attempts:number};
export type DraftCombinePerformance={version:1;results:Partial<Record<DraftDrill,DraftDrillRecord>>};
export const CORE_DRAFT_DRILLS:DraftDrill[]=['dash','broad-jump','shuttle','bench'];
export const draftPositionDrill=(position:Position):DraftDrill|null=>position==='RB'?'rb':['WR','TE'].includes(position)?'routes':['CB','S','FS','SS'].includes(position)?'db':null;
export const requiredDraftDrills=(position:Position):DraftDrill[]=>{const workout=draftPositionDrill(position);return [...CORE_DRAFT_DRILLS,...workout?[workout]:[]];};
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const validValue=(drill:DraftDrill,value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&(drill==='dash'?value>=1&&value<=120:drill==='shuttle'?value>=1&&value<=120:drill==='broad-jump'?value>=0&&value<=5:drill==='bench'?Number.isInteger(value)&&value>=0&&value<=200:value>=0&&value<=100&&Number.isInteger(value));
export function cleanDraftCombine(value:unknown):DraftCombinePerformance{
 const source=value as DraftCombinePerformance|null;const results:DraftCombinePerformance['results']={};
 if(source?.version===1&&source.results&&typeof source.results==='object')for(const drill of [...CORE_DRAFT_DRILLS,'routes','rb','db'] as DraftDrill[]){
  const row=source.results[drill];if(row&&validValue(drill,row.best)&&validValue(drill,row.last)&&Number.isInteger(row.attempts)&&row.attempts>0&&row.attempts<=10000)results[drill]={best:row.best,last:row.last,attempts:row.attempts};
 }
 return {version:1,results};
}
export function recordDraftDrill(current:DraftCombinePerformance|undefined,drill:DraftDrill,stats:Record<string,number>):DraftCombinePerformance{
 const clean=cleanDraftCombine(current);
 if(stats.dnf)return clean;
 const value=drill==='dash'||drill==='shuttle'?stats.time:drill==='broad-jump'?stats.distance:drill==='bench'?stats.reps:stats.score;
 if(!validValue(drill,value))return clean;
 if(['routes','rb','db'].includes(drill)&&stats.reps!==(drill==='routes'?8:5))return clean;
 const prior=clean.results[drill],lower=drill==='dash'||drill==='shuttle';
 return {version:1,results:{...clean.results,[drill]:{best:prior?(lower?Math.min(prior.best,value):Math.max(prior.best,value)):value,last:value,attempts:Math.min(10000,(prior?.attempts||0)+1)}}};
}
export function calculatePlayedCombine(position:Position,performance:DraftCombinePerformance|undefined){
 const rows=cleanDraftCombine(performance).results;const required=requiredDraftDrills(position);
 if(required.some(drill=>!rows[drill]))return null;
 const forty=rows.dash!.best,bench=rows.bench!.best,broadJump=rows['broad-jump']!.best,shuttle=rows.shuttle!.best;
 const speed=clamp((5.8-forty)/1.5*100),strength=clamp(bench/25*100),explosion=clamp((broadJump-1.3)/1.8*100),agility=clamp((7-shuttle)/3*100);
 const powerPosition=['EDGE','LB','DT','DE','OT','OG','C'].includes(position);
 const weights=powerPosition?[.20,.40,.20,.20]:position==='QB'?[.20,.20,.25,.35]:[.35,.15,.25,.25];
 const physical=speed*weights[0]+strength*weights[1]+explosion*weights[2]+agility*weights[3];
 const workout=draftPositionDrill(position);const score=Math.round(workout?physical*.8+rows[workout]!.best*.2:physical);
 return {forty,bench,broadJump,shuttle,score,label:score>=90?'ELITE':score>=80?'RISER':score>=68?'SOLID':score>=58?'MIXED':'SLIPPING',draftRound:score>=90?1:score>=82?2:score>=74?3:score>=66?4:score>=58?5:score>=45?6:7,overallChange:score>=90?4:score>=80?2:score<58?-2:0};
}
export function draftDrillMark(drill:DraftDrill,value:number){return drill==='dash'||drill==='shuttle'?`${value.toFixed(3)}s`:drill==='broad-jump'?`${value.toFixed(3)}m`:drill==='bench'?`${value} reps`:`${value}/100`;}
