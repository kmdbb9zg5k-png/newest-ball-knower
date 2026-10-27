import type {Position,TeamRatings} from './types';
import type {JourneyState,JourneyProfile} from './myPlayerJourney';
import {journeyHash,journeyMetrics} from './myPlayerJourney';
import type {MyPlayerRole} from './myPlayerOpportunity';
export type CareerPerson='agent'|'coach'|'rival'|'teammate';
export const CAREER_CAST:Record<CareerPerson,{name:string;role:string;initials:string;color:string}>={
 agent:{name:'Jordan Ellis',role:'Your agent',initials:'JE',color:'#ad96ef'},
 coach:{name:'Coach Marcus Reed',role:'Position coach',initials:'MR',color:'#e7be65'},
 rival:{name:'Dante Cross',role:'Your depth-chart rival',initials:'DC',color:'#f29379'},
 teammate:{name:'Andre Brooks',role:'Locker-room captain',initials:'AB',color:'#79c9b1'},
};
export type Prep='extra'|'film'|'recovery';
export type Response='team'|'bet'|'business';
export type CareerTurn={key:string;prep?:Prep;response?:Response;score?:number};
export type CareerHistory={key:string;score:number;won:boolean;role:MyPlayerRole;feedback:string;prep?:Prep;response?:Response};
export type CareerLife={version:1;rosterSlotId?:string;trust:number;chemistry:number;agent:number;fatigue:number;reputation:number;camp:{plan?:Prep;response?:Response;scores:number[];complete:boolean;legacy?:boolean};rival:number;role:MyPlayerRole;turn?:CareerTurn;history:CareerHistory[];games:number;lastKey?:string};
const clamp=(n:number,lo=0,hi=100)=>Math.max(lo,Math.min(hi,n));
const finite=(v:unknown,f:number)=>typeof v==='number'&&Number.isFinite(v)?clamp(v):f;
export const PREPARATIONS:{id:Prep;label:string;detail:string}[]=[
 {id:'extra',label:'Take the extra reps',detail:'+6 preparation bonus, +18 fatigue. A sharper session now can make next week harder.'},
 {id:'film',label:'Study with the position coach',detail:'+3 preparation bonus, +4 coach trust, +5 fatigue. Trade recovery time for understanding.'},
 {id:'recovery',label:'Protect your recovery day',detail:'−2 preparation bonus, −24 fatigue. Arrive fresher and widen your timing window.'},
];
export const REPLIES:{id:Response;label:string;detail:string}[]=[
 {id:'team',label:'Put the room first',detail:'+7 chemistry, +3 trust, −3 agent confidence. Build support without campaigning for yourself.'},
 {id:'bet',label:'Ask for the toughest assignment',detail:'+5 trust, +5 fatigue, −3 chemistry. A score below 60 costs another 8 trust.'},
 {id:'business',label:'Let my agent push for opportunity',detail:'+8 agent confidence, +3 reputation, −4 trust. Gain visibility while the staff waits for proof.'},
];
export function createCareerLife(profile:JourneyProfile,journey?:JourneyState,role:MyPlayerRole='development'):CareerLife{
 const m=journeyMetrics(journey,profile);
 return {version:1,trust:m.trust,chemistry:journey?.choices.roots==='captain'?63:50,agent:journey?.choices.agent==='hype'?65:50,fatigue:clamp(100-m.medical),reputation:Math.round(m.visibility/2),camp:{scores:[],complete:false},rival:60+journeyHash(`${profile.combineId||profile.name}:rival`)%17,role,games:0,history:[]};
}
export function cleanCareerLife(raw:unknown,profile:JourneyProfile,journey?:JourneyState):CareerLife|undefined{
 if(!raw||typeof raw!=='object'||(raw as CareerLife).version!==1)return undefined;
 const r=raw as CareerLife,b=createCareerLife(profile,journey),prep=(v:unknown):v is Prep=>PREPARATIONS.some(p=>p.id===v),reply=(v:unknown):v is Response=>REPLIES.some(p=>p.id===v);
 const scores:number[]=[];if(prep(r.camp?.plan)&&Array.isArray(r.camp?.scores))for(const value of r.camp.scores.slice(0,reply(r.camp.response)?3:1)){if(typeof value!=='number'||!Number.isFinite(value))break;scores.push(Math.round(clamp(value)));}
 const role=['starter','rotation','development'].includes(r.role)?r.role:b.role;
 const turn=r.turn&&typeof r.turn.key==='string'&&r.turn.key.length<80?{key:r.turn.key,...prep(r.turn.prep)?{prep:r.turn.prep}:{},...prep(r.turn.prep)&&reply(r.turn.response)?{response:r.turn.response}:{},...prep(r.turn.prep)&&reply(r.turn.response)&&typeof r.turn.score==='number'&&Number.isFinite(r.turn.score)?{score:finite(r.turn.score,0)}:{}}:undefined;
 return {...b,...(typeof r.rosterSlotId==='string'&&r.rosterSlotId.length<100?{rosterSlotId:r.rosterSlotId}:{}),trust:finite(r.trust,b.trust),chemistry:finite(r.chemistry,50),agent:finite(r.agent,50),fatigue:finite(r.fatigue,b.fatigue),reputation:finite(r.reputation,0),rival:clamp(finite(r.rival,b.rival),60,76),role,turn,games:Number.isInteger(r.games)?clamp(r.games,0,10000):0,lastKey:typeof r.lastKey==='string'?r.lastKey:undefined,camp:{scores,complete:r.camp?.complete===true&&(scores.length===3||r.camp.legacy===true),...(r.camp?.legacy===true?{legacy:true}:{}),...prep(r.camp?.plan)?{plan:r.camp.plan}:{},...reply(r.camp?.response)?{response:r.camp.response}:{}},history:Array.isArray(r.history)?r.history.filter(h=>h&&typeof h.key==='string'&&typeof h.feedback==='string'&&Number.isFinite(h.score)&&['starter','rotation','development'].includes(h.role)).slice(-12):[]};
}
function prepare(s:CareerLife,id:Prep){return {...s,fatigue:clamp(s.fatigue+(id==='extra'?18:id==='film'?5:-24)),trust:clamp(s.trust+(id==='film'?4:0))};}
function respond(s:CareerLife,id:Response){return {...s,trust:clamp(s.trust+(id==='team'?3:id==='bet'?5:-4)),chemistry:clamp(s.chemistry+(id==='team'?7:id==='bet'?-3:0)),agent:clamp(s.agent+(id==='business'?8:id==='team'?-3:0)),fatigue:clamp(s.fatigue+(id==='bet'?5:0)),reputation:clamp(s.reputation+(id==='business'?3:0))};}
export function chooseCamp(s:CareerLife,kind:'prep'|'response',id:string):CareerLife{
 if(s.camp.complete)return s;
 if(kind==='prep'&&!s.camp.plan&&PREPARATIONS.some(p=>p.id===id))return {...prepare(s,id as Prep),camp:{...s.camp,plan:id as Prep}};
 if(kind==='response'&&s.camp.scores.length===1&&!s.camp.response&&REPLIES.some(p=>p.id===id))return {...respond(s,id as Response),camp:{...s.camp,response:id as Response}};
 return s;
}
export const prepBonus=(prep?:Prep)=>prep==='extra'?6:prep==='film'?3:prep==='recovery'?-2:0;
export function campScore(s:CareerLife,index:number,raw:number):CareerLife{
 if(s.camp.complete||!s.camp.plan||index!==s.camp.scores.length||index>2||index>0&&!s.camp.response||!Number.isFinite(raw)||raw<0||raw>100)return s;
 const score=Math.round(clamp(raw+prepBonus(s.camp.plan)-Math.max(0,s.fatigue-35)*.12));
 return {...s,fatigue:clamp(s.fatigue+8),trust:clamp(s.trust+(score>=70?4:score<45?-5:0)-(s.camp.response==='bet'&&score<60?8:0)),camp:{...s.camp,scores:[...s.camp.scores,score]}};
}
export function campEvaluation(s:CareerLife){const average=s.camp.scores.length?s.camp.scores.reduce((a,b)=>a+b,0)/s.camp.scores.length:0;const grade=Math.round(clamp(average*.8+s.trust*.15+s.chemistry*.05));const role:MyPlayerRole=grade>=s.rival&&s.trust>=55?'starter':grade>=s.rival-15?'rotation':'development';return {average:Math.round(average),grade,role};}
export function finishCamp(s:CareerLife):CareerLife{if(s.camp.complete||s.camp.scores.length!==3)return s;return {...s,role:campEvaluation(s).role,camp:{...s.camp,complete:true},fatigue:clamp(s.fatigue-20)};}
export function chooseWeek(s:CareerLife,key:string,kind:'prep'|'response',id:string):CareerLife{
 if(!s.camp.complete||s.lastKey===key||s.history.some(h=>h.key===key))return s;
 const turn=s.turn?.key===key?s.turn:{key};
 if(kind==='prep'&&!turn.prep&&PREPARATIONS.some(p=>p.id===id))return {...prepare(s,id as Prep),turn:{...turn,prep:id as Prep}};
 if(kind==='response'&&turn.prep&&!turn.response&&REPLIES.some(p=>p.id===id))return {...respond(s,id as Response),turn:{...turn,response:id as Response}};
 return s;
}
export function recordWeekMoment(s:CareerLife,key:string,raw:number):CareerLife{
 if(s.turn?.key!==key||!s.turn.response||s.turn.score!==undefined||!Number.isFinite(raw)||raw<0||raw>100||s.lastKey===key)return s;
 return {...s,turn:{...s.turn,score:Math.round(clamp(raw+prepBonus(s.turn.prep)-Math.max(0,s.fatigue-35)*.12))}};
}
export function weekReady(s:CareerLife|undefined,key:string){return Boolean(s?.turn?.key===key&&s.turn.response&&s.turn.score!==undefined&&s.lastKey!==key);}
export function completeCareerWeek(s:CareerLife,key:string,won:boolean):CareerLife{
 if(!weekReady(s,key))return s;
 const score=s.turn!.score!,trust=clamp(s.trust+(score>=75?6:score<45?-7:1)-(s.turn!.response==='bet'&&score<60?8:0));
 const recent=[...s.history.slice(-2).map(h=>h.score),score],average=recent.reduce((a,b)=>a+b,0)/recent.length;
 let role=s.role;if(recent.length>=2&&average>=75&&trust>=65)role='starter';else if(recent.length>=2&&average<40)role=role==='starter'?'rotation':'development';else if(role==='development'&&average>=55&&trust>=45)role='rotation';
 const feedback=role!==s.role?`Your role changes from ${s.role} to ${role}. Recent tape and trust moved the depth chart.`:score>=75?'You delivered when called. Reed adds more responsibility to your next game plan.':score<45?'Reed wants cleaner execution. Another poor evaluation can cost you reps.':'Reliable tape. Keep stacking good weeks to challenge for a larger role.';
 return {...s,trust,role,fatigue:clamp(s.fatigue-12),reputation:clamp(s.reputation+(score>=75?5:score<45?-3:1)+(won?2:0)),games:s.games+1,lastKey:key,turn:undefined,history:[...s.history,{key,score,won,role,feedback,prep:s.turn?.prep,response:s.turn?.response}].slice(-12)};
}
export function careerGameBoost(s:CareerLife|undefined,key:string){return s&&weekReady(s,key)?Math.round((s.turn!.score!-50)/20):0;}
export function applyCareerRatings(ratings:TeamRatings,boost:number|undefined):TeamRatings{if(!boost)return ratings;const n=clamp(boost,-3,3);return {...ratings,overall:clamp(ratings.overall+n),offense:clamp(ratings.offense+n),defense:clamp(ratings.defense+n),passing:clamp(ratings.passing+n),rushing:clamp(ratings.rushing+n),passProtection:clamp(ratings.passProtection+n),runBlocking:clamp(ratings.runBlocking+n),passRush:clamp(ratings.passRush+n),runDefense:clamp(ratings.runDefense+n),coverage:clamp(ratings.coverage+n)};}
export function careerConversation(s:CareerLife,week:number):{person:CareerPerson;title:string;text:string}{
 const last=s.history.at(-1);
 if(week%4===1)return {person:'rival',title:'Same room. One starting spot.',text:`Dante: “${last&&last.score>=75?'You earned those reps last week. I noticed.':'The depth chart is still moving.'} ${s.chemistry>=65?'We can push each other without splitting this room.':'I am coming for the same job you want.'} How are you approaching this week?”`};
 if(week%4===2)return {person:'coach',title:'The door is open.',text:`Reed: “${s.trust>=65?'You have earned some trust.':'I need consistency before I promise you more.'} ${last?.score!==undefined&&last.score<45?'We cannot repeat that last session.':'The next opponent will test your preparation.'} Tell me how you want to handle the responsibility.”`};
 if(week%4===3)return {person:'agent',title:'Your name is in the conversation.',text:`Jordan: “${last?.response==='business'?'You asked me to push for reps last week. I did.':s.agent>=60?'I have kept your name in front of decision-makers.':'You asked me to let the work speak.'} ${s.reputation>=50?'Your tape is building a reputation.':'There is still ground to make up.'} Do we push for opportunity or keep building quietly?”`};
 return {person:'teammate',title:'A locker room remembers.',text:`Andre: “${s.chemistry>=65?'You have shown up for this room. We have your back.':'Everyone wants snaps. We still need to trust one another.'} Dante and the coaches will notice how you handle the next assignment.”`};
}
export function positionMoment(position:Position){
 if(position==='QB')return {title:'Pocket read',action:'THROW',instruction:'Move to the open receiver lane, then throw as the ball reaches the gold window.'};
 if(['WR','TE'].includes(position))return {title:'Third-down reception',action:'CATCH',instruction:'Break into the highlighted route lane, then catch as the ball reaches the gold window.'};
 if(position==='RB')return {title:'Find the crease',action:'CUT',instruction:'Find the open running lane, then cut as the ball reaches the gold window.'};
 if(['EDGE','LB'].includes(position))return {title:'Beat the protection',action:'SHED',instruction:'Attack the highlighted gap, then shed as the ball reaches the gold window.'};
 return {title:'Close the passing window',action:'SWAT',instruction:'Match the highlighted receiver lane, then swat as the ball reaches the gold window.'};
}
export function momentRep(seed:string,rep:number){const n=journeyHash(`${seed}:${rep}`);return {lane:n%3,shift:(n%3+1+(n>>>4)%2)%3,duration:2600+(n%600)};}
export function scoreMoment(elapsed:number,duration:number,lane:number,target:number,fatigue:number){const error=Math.abs(elapsed/duration-.72),window=.12-Math.min(100,Math.max(0,fatigue))*.00045;return lane!==target?0:Math.round(clamp(100-error/window*70));}
