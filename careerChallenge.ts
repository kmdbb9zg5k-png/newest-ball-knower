import {FILM_CASES} from './myPlayerDecisions';
import type {MiniStats} from './miniChallenges';
export type CareerChallengeRound={prep:number;film:number;raw:number};
export const CHALLENGE_PREP=[{label:'Extra reps',detail:'+6 evaluation, +18 fatigue.'},{label:'Film study',detail:'+3 evaluation, +5 fatigue.'},{label:'Recovery',detail:'−2 evaluation, −24 fatigue.'}] as const;
// Deliberately simple shared arithmetic: Postgres recomputes this from the full round transcript.
export function challengeFilm(seed:number,round:number){return FILM_CASES[[0,3,5][(seed+round)%3]];}
export function challengeEvaluation(seed:number,rounds:CareerChallengeRound[]){
 let fatigue=20,total=0,correct=0;const scores:number[]=[];
 rounds.forEach((r,i)=>{fatigue=Math.max(0,Math.min(100,fatigue+[18,5,-24][r.prep]));const read=r.film===challengeFilm(seed,i).answer;correct+=Number(read);const score=Math.round(Math.max(0,Math.min(100,r.raw+[6,3,-2][r.prep]+(read?3:0)-Math.max(0,fatigue-35)*.12)));scores.push(score);total+=score;fatigue=Math.max(0,fatigue-12);});
 return {score:Math.round(total/Math.max(1,rounds.length)),fatigue,correct,scores};
}
export function careerChallengeStats(rounds:CareerChallengeRound[]):MiniStats{return Object.fromEntries(rounds.flatMap((r,i)=>[[`raw${i}`,r.raw],[`prep${i}`,r.prep],[`film${i}`,r.film]]));}
export type CareerChallengeSession={rounds:CareerChallengeRound[];prep?:number;film?:number};
export function cleanChallengeSession(raw:unknown):CareerChallengeSession{
 const r=raw as CareerChallengeSession;if(!r||!Array.isArray(r.rounds)||r.rounds.length>3||r.rounds.some(x=>!x||![x.prep,x.film,x.raw].every(Number.isInteger)||x.prep<0||x.prep>2||x.film<0||x.film>2||x.raw<0||x.raw>100))return {rounds:[]};
 return {rounds:r.rounds,prep:Number.isInteger(r.prep)&&r.prep!>=0&&r.prep!<=2?r.prep:undefined,film:Number.isInteger(r.prep)&&Number.isInteger(r.film)&&r.film!>=0&&r.film!<=2?r.film:undefined};
}
