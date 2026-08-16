import { Player, ROSTER_REQUIREMENTS } from '../types';
import { countRosterGroups, getDraftPositionGroup, minimumCompletionCost } from './rosterRules';

export type GmPersonality = 'balanced'|'star_hunter'|'value_hunter'|'trenches'|'defense_first'|'air_raid';

const POSITION_VALUE: Record<string,number> = {
 QB:1.35, WR:1.12, TE:1.02, RB:.91, OL:1.13, DL_EDGE:1.18, LB:.98, CB:1.17, S:1.02, K:.70, P:.62
};

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
 const legal=pool.filter(p=>{
   if(drafted.has(p.id)||p.salary>remaining) return false;
   const g=getDraftPositionGroup(p), c=countRosterGroups(roster);
   if((c as any)[g] >= (ROSTER_REQUIREMENTS as any)[g]) return false;
   const after=[...roster,p];
   return minimumCompletionCost(after,pool.filter(x=>x.id!==p.id)) <= remaining-p.salary+0.0001;
 });
 return legal.sort((a,b)=>playerDraftValue(b,roster,pool,remaining,personality)-playerDraftValue(a,roster,pool,remaining,personality))[0]||null;
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
