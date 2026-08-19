import { Player, ROSTER_REQUIREMENTS } from './types';
import { countRosterGroups, DraftPositionGroup, getDraftPositionGroup } from './rosterRules';

export type GmPersonality = 'balanced'|'star_hunter'|'value_hunter'|'trenches'|'defense_first'|'air_raid';

const POSITION_VALUE: Record<string,number> = {
 QB:1.35, WR:1.12, TE:1.02, RB:.91, OL:1.13, DL_EDGE:1.18, LB:.98, CB:1.17, S:1.02, K:.70, P:.62
};

const DRAFT_GROUPS=Object.keys(ROSTER_REQUIREMENTS) as DraftPositionGroup[];
type SmartPoolIndex={
 bySalary:Record<DraftPositionGroup,Player[]>;
 byOverall:Record<DraftPositionGroup,Player[]>;
 groupById:Map<string,DraftPositionGroup>;
};
const SMART_POOL_INDEXES=new WeakMap<Player[],SmartPoolIndex>();

function smartPoolIndex(pool:Player[]):SmartPoolIndex{
 const cached=SMART_POOL_INDEXES.get(pool);if(cached)return cached;
 const bySalary={} as Record<DraftPositionGroup,Player[]>;
 const byOverall={} as Record<DraftPositionGroup,Player[]>;
 const groupById=new Map<string,DraftPositionGroup>();
 for(const group of DRAFT_GROUPS){bySalary[group]=[];byOverall[group]=[]}
 for(const player of pool){const group=getDraftPositionGroup(player);if(!group)continue;groupById.set(player.id,group);bySalary[group].push(player);byOverall[group].push(player)}
 for(const group of DRAFT_GROUPS){
   bySalary[group].sort((a,b)=>a.salary-b.salary||b.ovr-a.ovr);
   byOverall[group].sort((a,b)=>b.ovr-a.ovr||a.salary-b.salary);
 }
 const index={bySalary,byOverall,groupById};SMART_POOL_INDEXES.set(pool,index);return index;
}

export function playerDraftValue(p:Player, roster:Player[], pool:Player[], capRemaining:number, personality:GmPersonality='balanced') {
 const g=getDraftPositionGroup(p); const counts=countRosterGroups(roster);
 const need=Math.max(0,(ROSTER_REQUIREMENTS as any)[g]-(counts as any)[g]);
 const same=pool.filter(x=>getDraftPositionGroup(x)===g).sort((a,b)=>b.ovr-a.ovr);
 const rank=Math.max(0,same.findIndex(x=>x.id===p.id));
 const scarcity=Math.max(0, 8-rank)*1.1;
 const capEfficiency=(p.ovr/Math.max(p.salary,0.75))*2.2;
 let score=p.ovr*(POSITION_VALUE[g]||1)+need*9+scarcity+Math.min(capEfficiency,30);
 if(p.salary>capRemaining*.35) score-=12;
 if(p.salaryType!=='cap_hit') score-=3; // prefer verified cap data
 if(personality==='star_hunter') score+=Math.max(0,p.ovr-88)*3-p.salary*.08;
 if(personality==='value_hunter') score+=Math.min(capEfficiency,35);
 if(personality==='trenches' && ['OL','DL_EDGE'].includes(g)) score+=18;
 if(personality==='defense_first' && ['DL_EDGE','LB','CB','S'].includes(g)) score+=14;
 if(personality==='air_raid' && ['QB','WR','TE'].includes(g)) score+=15;
 return score;
}

export function chooseSmartPick(pool:Player[], roster:Player[], salaryCap:number, personality:GmPersonality='balanced') {
 const spent=roster.reduce((n,p)=>n+p.salary,0), remaining=salaryCap-spent;
 const drafted=new Set(roster.map(p=>p.id));
 const counts=countRosterGroups(roster);
 const candidates=pool.filter(p=>!drafted.has(p.id));
 const poolIndex=smartPoolIndex(pool);
 const groups=DRAFT_GROUPS;
 const bySalary={} as Record<DraftPositionGroup,Player[]>;
 const salaryPrefixes={} as Record<DraftPositionGroup,number[]>;
 const salaryIndexes={} as Record<DraftPositionGroup,Map<string,number>>;
 const overallRanks=new Map<string,number>();

 for(const group of groups){
   bySalary[group]=poolIndex.bySalary[group].filter(p=>!drafted.has(p.id));
   const prefix=[0];
   for(const player of bySalary[group])prefix.push(prefix[prefix.length-1]+player.salary);
   salaryPrefixes[group]=prefix;
   salaryIndexes[group]=new Map(bySalary[group].map((p,index)=>[p.id,index]));
   let overallRank=0;
   for(const player of poolIndex.byOverall[group])if(!drafted.has(player.id))overallRanks.set(player.id,overallRank++);
 }

 let best:Player|null=null,bestScore=Number.NEGATIVE_INFINITY;
 for(const player of candidates){
   if(player.salary>remaining)continue;
   const group=poolIndex.groupById.get(player.id);if(!group)continue;
   const required=ROSTER_REQUIREMENTS[group];
   if(counts[group]>=required)continue;

   let completionCost=0,canFinish=true;
   for(const needGroup of groups){
     const needed=Math.max(0,ROSTER_REQUIREMENTS[needGroup]-counts[needGroup]-(needGroup===group?1:0));
     if(!needed)continue;
     const available=bySalary[needGroup];
     const excludesCurrent=needGroup===group;
     if(available.length-(excludesCurrent?1:0)<needed){canFinish=false;break}
     if(excludesCurrent){
       const playerIndex=salaryIndexes[needGroup].get(player.id)??Number.POSITIVE_INFINITY;
       completionCost+=playerIndex<needed
         ? salaryPrefixes[needGroup][needed+1]-player.salary
         : salaryPrefixes[needGroup][needed];
     }else completionCost+=salaryPrefixes[needGroup][needed];
   }
   if(!canFinish||completionCost>remaining-player.salary+.0001)continue;

   const need=Math.max(0,required-counts[group]);
   const rank=overallRanks.get(player.id)??0;
   const scarcity=Math.max(0,8-rank)*1.1;
   const capEfficiency=(player.ovr/Math.max(player.salary,.75))*2.2;
   let score=player.ovr*(POSITION_VALUE[group]||1)+need*9+scarcity+Math.min(capEfficiency,30);
   if(player.salary>remaining*.35)score-=12;
   if(player.salaryType!=='cap_hit')score-=3;
   if(personality==='star_hunter')score+=Math.max(0,player.ovr-88)*3-player.salary*.08;
   if(personality==='value_hunter')score+=Math.min(capEfficiency,35);
   if(personality==='trenches'&&['OL','DL_EDGE'].includes(group))score+=18;
   if(personality==='defense_first'&&['DL_EDGE','LB','CB','S'].includes(group))score+=14;
   if(personality==='air_raid'&&['QB','WR','TE'].includes(group))score+=15;
   if(score>bestScore||(score===bestScore&&(!best||player.ovr>best.ovr||(player.ovr===best.ovr&&player.salary<best.salary)))){
     best=player;bestScore=score;
   }
 }
 return best;
}

export function gradeDraft(roster:Player[], salaryCap:number) {
 if(!roster.length) return {score:0,letter:'F',summary:'No roster submitted',strengths:[],weaknesses:['Roster incomplete']};
 const spent=roster.reduce((n,p)=>n+p.salary,0);
 const avg=roster.reduce((n,p)=>n+p.ovr,0)/roster.length;
 const verified=roster.filter(p=>p.salaryType==='cap_hit').length/roster.length;
 const groups=countRosterGroups(roster);
 const complete=Object.entries(ROSTER_REQUIREMENTS).every(([g,n])=>(groups as any)[g]>=n);
 const stars=roster.filter(p=>p.ovr>=90).length;
 const value=roster.reduce((n,p)=>n+p.ovr/Math.max(p.salary,1),0)/roster.length;
 let score=avg*.70 + Math.min(12,value*.65) + Math.min(7,stars*1.4) + verified*5 + (complete?6:0);
 if(spent>salaryCap) score-=25;
 score=Math.max(0,Math.min(100,Math.round(score)));
 const letter=score>=93?'A+':score>=90?'A':score>=87?'A-':score>=83?'B+':score>=80?'B':score>=77?'B-':score>=73?'C+':score>=70?'C':score>=65?'D':'F';
 const strengths:string[]=[]; const weaknesses:string[]=[];
 if(avg>=86) strengths.push('High-end talent across the roster'); else weaknesses.push('Overall talent level is light');
 if(value>=5) strengths.push('Strong production per cap dollar'); else weaknesses.push('Too much cap tied up for the rating return');
 if(stars>=3) strengths.push(`${stars} elite 90+ OVR players`);
 if(verified<.8) weaknesses.push('Some salaries still need verified 2026 cap-hit data');
 return {score,letter,summary:`${letter} — ${score}/100 Ball Knower Draft Score`,strengths,weaknesses,spent,remaining:salaryCap-spent};
}
