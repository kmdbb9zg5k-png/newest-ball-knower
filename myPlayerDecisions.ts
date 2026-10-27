import {journeyHash} from './myPlayerJourney';
import type {CareerArc,CareerContract} from './myPlayerArc';
import {recordWeekMoment,type CareerLife} from './myPlayerCareer';
import type {Position} from './types';
import type {MyPlayerRole} from './myPlayerOpportunity';
export type CoachChoice='adapt'|'compete'|'trade';
export type CounterRequest='money'|'role';
export type CareerDecisions={
 coach?:{year:number;choice:CoachChoice;role:MyPlayerRole};
 film?:{key:string;answer:number;correct:boolean};
 counters:{year:number;id:string;request:CounterRequest;accepted:boolean}[];
 contracts:CareerContract[];
 best:{key:string;score:number;opponent:string;won:boolean}[];
};
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
function append(a:CareerArc,e:CareerArc['events'][number]){const fixed=(x:CareerArc['events'][number])=>['draft','first-start','rival-first-start'].includes(x.id);return [...a.events.filter(fixed),...a.events.filter(x=>!fixed(x)).slice(-196),e];}
export function decisions(a:CareerArc):CareerDecisions{return a.decisions||{counters:[],contracts:[a.contract],best:[]};}
export function cleanDecisions(raw:unknown,a:CareerArc):CareerDecisions{
 const r=raw as Partial<CareerDecisions>|undefined,base={counters:[],contracts:[a.contract],best:[]};if(!r||typeof r!=='object')return base;
 const roles=['starter','rotation','development'];
 return {coach:r.coach&&r.coach.year===a.year&&['adapt','compete','trade'].includes(r.coach.choice)&&roles.includes(r.coach.role)?r.coach:undefined,
 film:r.film&&typeof r.film.key==='string'&&/^\d{4}:(regular|playoffs):\d+$/.test(r.film.key)&&Number.isInteger(r.film.answer)&&r.film.answer>=0&&r.film.answer<=2?{...r.film,correct:r.film.correct===true}:undefined,
 counters:Array.isArray(r.counters)?r.counters.filter(c=>c&&c.year===a.year&&['money','reps','ring'].includes(c.id)&&['money','role'].includes(c.request)&&typeof c.accepted==='boolean').filter((c,i,all)=>all.findIndex(x=>x.id===c.id)===i).slice(0,3):[],
 contracts:Array.isArray(r.contracts)?r.contracts.filter(c=>c&&typeof c.team==='string'&&Number.isInteger(c.start)&&Number.isInteger(c.end)&&c.start<=c.end&&Number.isFinite(c.annual)&&c.annual>=0&&c.annual<=100&&roles.includes(c.role)&&typeof c.priority==='string').slice(-100):[a.contract],
 best:Array.isArray(r.best)?r.best.filter(b=>b&&typeof b.key==='string'&&typeof b.opponent==='string'&&Number.isFinite(b.score)&&b.score>=0&&b.score<=100&&typeof b.won==='boolean').sort((x,y)=>y.score-x.score).slice(0,5):[]};
}
const schemes=[{name:'Space & tempo',focus:'speed',detail:'Quick decisions, separation and pursuit speed.'},{name:'Power & pressure',focus:'power',detail:'Contact balance, strong hands and winning at the point of attack.'},{name:'Read & react',focus:'awareness',detail:'Assignment discipline, coverage recognition and anticipation.'}] as const;
export function careerCoach(a:CareerArc,p:{teamAbbr:string;speed:number;power:number;awareness:number},life:CareerLife){
 const cycle=Math.floor((a.year-2026)/2),index=journeyHash(`${a.seed}:${p.teamAbbr}:staff`) % 3;
 const scheme=schemes[(index+cycle)%3],fit=p[scheme.focus],prior=decisions(a).coach;
 const proposed:MyPlayerRole=fit<75&&life.role==='starter'?'rotation':life.role;
 return {name:['Coach Avery Cole','Coach Devin Ward','Coach Cameron Hayes'][(index+cycle)%3],scheme,fit,proposed,changed:cycle>0,chosen:prior?.year===a.year?prior:undefined};
}
export function chooseCoach(a:CareerArc,life:CareerLife,p:{teamAbbr:string;speed:number;power:number;awareness:number},id:CoachChoice){
 const coach=careerCoach(a,p,life);if(coach.chosen||!['adapt','compete','trade'].includes(id)||life.turn?.score!==undefined)return {arc:a,life};
 const nextRole=id==='compete'?life.role:coach.proposed;
 const next={...life,role:nextRole,trust:clamp(life.trust+(id==='adapt'?6:id==='compete'?-4:-8)),fatigue:clamp(life.fatigue+(id==='compete'?8:0))};
 return {arc:{...a,decisions:{...decisions(a),coach:{year:a.year,choice:id,role:nextRole}},events:append(a,{id:`${a.year}:scheme`,label:`${coach.scheme.name} · ${id==='adapt'?'Adapt':id==='compete'?'Compete':'Trade requested'}`,text:`${coach.name}: ${nextRole} opportunity. ${id==='trade'?'Agent will present trade destinations after the season; the current contract carries with you.':id==='adapt'?'You committed to the scheme. Coach trust +6.':'You retained your role for now. Trust −4, fatigue +8; weekly tape still decides your job.'}`})} as CareerArc,life:next};
}
export const FILM_CASES=[
 {title:'Two safeties stay deep',cue:'The corners sink outside and the linebackers widen with the slots. The hook defender leaves the middle underneath.',options:['Force the outside fade','Take the underneath middle','Wait for a deep double move'],answer:1,why:'The underneath middle is available against the deep shell. Take the space the defense concedes.'},
 {title:'The edge crashes inside',cue:'On an outside-zone run, the end crosses the tackle’s face. Your tight end seals the pursuit inside; the corner is blocked outside.',options:['Bounce through the outside crease','Cut into the crashing end','Stop behind the tackle'],answer:0,why:'The seal creates an outside crease. Press it before pursuit can recover.'},
 {title:'Stay over the top',cue:'You are the deep defender. A receiver threatens vertically while a shallow crosser enters a teammate’s underneath zone.',options:['Jump the shallow crosser','Blitz the quarterback','Carry the vertical threat'],answer:2,why:'Protect your deep assignment. Chasing the shallow route would leave the vertical receiver uncovered.'},
 {title:'Pressure shows late',cue:'The slot defender blitzes. Your receiver has a hot route into the area the blitzer just left.',options:['Hit the hot route','Hold for the longest route','Throw toward the covered sideline'],answer:0,why:'The hot route replaces the blitzer and gets the ball out before pressure arrives.'},
 {title:'Keep outside leverage',cue:'You are the force defender against a sweep. Help is coming from inside; the runner wants to reach the sideline.',options:['Dive across the runner inside','Stay outside and force him toward help','Retreat straight downfield'],answer:1,why:'Outside leverage funnels the runner back to your teammates instead of conceding the edge.'},
 {title:'Settle in the window',cue:'You run a short option route against zone. The linebacker widens and the next defender stays deep.',options:['Run into the deep defender','Drift back toward the linebacker','Settle between the zones'],answer:2,why:'Settling in the open window gives the quarterback a clear target before the zone closes.'},
] as const;
export function filmCase(position:Position,seed:number,key:string){const pool=position==='RB'?[1,4]:['CB','S','LB','EDGE'].includes(position)?[2,4]:[0,3,5];return FILM_CASES[pool[journeyHash(`${seed}:${key}:film`)%pool.length]];}
export function chooseFilm(a:CareerArc,life:CareerLife,position:Position,key:string,answer:number){
 if(!/^\d{4}:(regular|playoffs):\d+$/.test(key)||Number(key.slice(0,4))!==a.year||a.lastKey===key||decisions(a).film?.key===key||life.turn?.key===key&&life.turn.score!==undefined||!Number.isInteger(answer)||answer<0||answer>2)return a;
 return {...a,decisions:{...decisions(a),film:{key,answer,correct:answer===filmCase(position,a.seed,key).answer}}};
}
export function recordFilmMoment(a:CareerArc,life:CareerLife,key:string,raw:number){const next=recordWeekMoment(life,key,raw);return next===life?life:{...next,turn:{...next.turn!,score:Math.min(100,next.turn!.score!+filmBonus(a,key))}};}
export function filmBonus(a:CareerArc,key:string){const f=decisions(a).film;return f?.key===key&&f.correct?3:0;}
export function counterChance(life:CareerLife){return Math.min(80,40+Math.floor(life.agent/5)+Math.floor(life.reputation/5));}
export function counterOffer(a:CareerArc,life:CareerLife,id:string,request:CounterRequest):CareerArc{
 const d=decisions(a);if(a.year<a.contract.end||!['money','reps','ring'].includes(id)||!['money','role'].includes(request)||d.counters.some(c=>c.year===a.year&&c.id===id)||id==='reps'&&request==='role')return a;
 const accepted=journeyHash(`${a.seed}:${a.year}:${id}:counter`)%100<counterChance(life);
 return {...a,decisions:{...d,counters:[...d.counters,{year:a.year,id,request,accepted}]},events:append(a,{id:`${a.year}:counter:${id}`,label:accepted?'Counteroffer accepted':'Team withdrew its offer',text:`Jordan negotiated ${request==='money'?'15% more annual salary':'an opening starting role'} on the ${id} offer. ${accepted?'Updated terms are ready to review; nothing is signed yet.':'The team walked away. Your current club remains a fallback.'}`})};
}
