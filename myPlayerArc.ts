import {journeyHash,resolveJourneyDraft,type JourneyState} from './myPlayerJourney';
import {SOLO_TEAM_THEMES} from './soloUniverse';
import {franchiseSchedule,buildSoloTeamRoster} from './soloFranchiseEngine';
import type {Position} from './types';
import type {CareerLife} from './myPlayerCareer';
import type {MyPlayerRole} from './myPlayerOpportunity';
export type RivalChoice='train'|'respect'|'talk';
type Profile={name:string;teamAbbr:string;position:Position;draftJourney?:JourneyState;draftRound:number;draftPick:number;combineId?:string;overall:number};
export type ArcEvent={id:string;label:string;text:string};
export type CareerContract={team:string;start:number;end:number;annual:number;role:MyPlayerRole;priority:string};
export type CareerArc={version:1;year:number;seed:number;earnings:number;rival:{name:string;team:string;pick:number;overall:number;role:MyPlayerRole;relationship:number;total:number;games:number;last:number;firstStart?:number;awards:number};own:{total:number;games:number;firstStart?:number;awards:number};choice?:{key:string;id:RivalChoice};lastKey?:string;duels:{won:number;lost:number;tied:number};contract:CareerContract;events:ArcEvent[];seasons:{year:number;trackedGames?:number;average:number;rivalAverage:number;champion:boolean;wins:number}[];seasonOwn:number;seasonRival:number;seasonGames:number};
export type CareerOffer=CareerContract&{id:string;strength:number;detail:string};
const clamp=(n:number,a=0,b=100)=>Math.max(a,Math.min(b,n));
const role=(n:number):MyPlayerRole=>n>=76?'starter':n>=58?'rotation':'development';
const validRole=(s:unknown):s is MyPlayerRole=>['starter','rotation','development'].includes(String(s));
const team=(s:unknown)=>SOLO_TEAM_THEMES.some(t=>t.abbr===s);
export const teamName=(abbr:string)=>SOLO_TEAM_THEMES.find(t=>t.abbr===abbr)?.name||abbr;
export function createCareerArc(p:Profile,year=2026):CareerArc{
 const seed=journeyHash(`${p.combineId||p.name}:draft-class`),schedule=franchiseSchedule(p.teamAbbr),pick=p.draftRound>0?(p.draftRound-1)*32+p.draftPick:225;
 const board=p.draftJourney?.draftBaseGrade!==undefined?resolveJourneyDraft(p.draftJourney,p,p.draftJourney.draftBaseGrade).board.filter(b=>!b.mine&&schedule.some(t=>t.abbr===b.team)):[];const matched=board.filter(b=>b.position===p.position),candidates=matched.length?matched:board,prospect=candidates.length?candidates[seed%candidates.length]:undefined;
 const rivalPick=1+seed%224===pick?pick%224+1:1+seed%224;
 return {version:1,year,seed,earnings:0,rival:{name:prospect?.name||['Kellan Price','Jalen Mercer','Micah Vance','Trey Lawson'][seed%4],team:prospect?.team||schedule[seed%schedule.length].abbr,pick:prospect?.overall||rivalPick,overall:66+seed%10,role:'rotation',relationship:50,total:0,games:0,last:0,awards:0},own:{total:0,games:0,awards:0},duels:{won:0,lost:0,tied:0},contract:{team:p.teamAbbr,start:year,end:year+1,annual:Math.round((1+(225-pick)/60)*10)/10,role:'rotation',priority:'Rookie deal'},events:[{id:'draft',label:'Draft-class origins',text:`You: ${pick===225?'undrafted':`pick ${pick}`}. Your class rival: pick ${prospect?.overall||rivalPick}. Career comparisons are tracked from ${year}; earlier games are not reconstructed.`}],seasons:[],seasonOwn:0,seasonRival:0,seasonGames:0};
}
// Treat optional new save data as untrusted; older careers gain a fresh arc without resetting their season.
export function cleanCareerArc(raw:unknown,p:Profile):CareerArc|undefined{
 if(!raw||typeof raw!=='object')return;const r=raw as CareerArc;
 if(r.version!==1||!Number.isInteger(r.year)||r.year<2026||r.year>2200||!r.rival||!r.own||!r.contract||!r.duels||!team(r.rival.team)||!team(r.contract.team)||!validRole(r.rival.role)||!validRole(r.contract.role))return;
 const nums=[r.earnings??0,r.seed,r.rival.pick,r.rival.overall,r.rival.relationship,r.rival.total,r.rival.games,r.rival.last,r.rival.awards,r.own.total,r.own.games,r.own.awards,r.duels.won,r.duels.lost,r.duels.tied,r.contract.start,r.contract.end,r.contract.annual,r.seasonOwn,r.seasonRival,r.seasonGames];if(nums.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0)||r.contract.end<r.contract.start||r.contract.end>r.year+5||r.contract.annual>100)return;
 const b=createCareerArc(p,r.year);return {...b,...r,earnings:typeof r.earnings==='number'?r.earnings:0,rival:{...r.rival,name:typeof r.rival.name==='string'&&r.rival.name.length>0&&r.rival.name.length<80?r.rival.name:b.rival.name,overall:clamp(r.rival.overall,40,99),relationship:clamp(r.rival.relationship),last:clamp(r.rival.last)},events:Array.isArray(r.events)?trimEvents(r.events.filter(e=>e&&typeof e.id==='string'&&typeof e.label==='string'&&typeof e.text==='string')):b.events,seasons:Array.isArray(r.seasons)?r.seasons.filter(s=>s&&Number.isInteger(s.year)&&Number.isFinite(s.average)&&Number.isFinite(s.rivalAverage)&&Number.isFinite(s.wins)).slice(-50):[],choice:r.choice&&/^\d{4}:(regular|playoffs):\d+$/.test(r.choice.key)&&['train','respect','talk'].includes(r.choice.id)?r.choice:undefined,lastKey:typeof r.lastKey==='string'?r.lastKey:undefined};
}
function trimEvents(events:ArcEvent[]){const fixed=(e:ArcEvent)=>['draft','first-start','rival-first-start'].includes(e.id);const recent=new Set(events.filter(e=>!fixed(e)).slice(-197).map(e=>e.id));return events.filter(e=>fixed(e)||recent.has(e.id));}
function event(a:CareerArc,e:ArcEvent):CareerArc{return a.events.some(x=>x.id===e.id)?a:{...a,events:trimEvents([...a.events,e])};}
function turnOrder(key?:string){const m=key?.match(/^(\d{4}):(regular|playoffs):(\d+)$/);if(!m)return -1;const week=Number(m[3]);return week<1||week>(m[2]==='regular'?17:4)?-1:Number(m[1])*100+(m[2]==='regular'?week:17+week);}
export function chooseRival(a:CareerArc,life:CareerLife,key:string,id:RivalChoice):{arc:CareerArc;life:CareerLife}{
 if(turnOrder(key)<0||turnOrder(key)<=turnOrder(a.lastKey)||!['train','respect','talk'].includes(id)||a.lastKey===key||a.choice?.key===key||life.turn?.key===key&&life.turn.score!==undefined||Number(key.split(':')[0])!==a.year)return {arc:a,life};
 const delta=id==='train'?12:id==='respect'?6:-14;
 const arc=event({...a,rival:{...a.rival,relationship:clamp(a.rival.relationship+delta)},choice:{key,id}},{id:`${key}:relationship`,label:id==='train'?'Training partners':id==='respect'?'Mutual respect':'You raised the stakes',text:id==='train'?`You trained with ${a.rival.name}. +3 coach trust, +6 fatigue. Both players sharpen their next evaluation.`:id==='respect'?'You kept the rivalry respectful. Relationship +6; no performance bonus or pressure penalty.':'You talked trash. Reputation +3 now; an evaluation below 75 costs 5 coach trust after the game.'});
 return {arc,life:{...life,trust:clamp(life.trust+(id==='train'?3:0)),fatigue:clamp(life.fatigue+(id==='train'?6:0)),reputation:clamp(life.reputation+(id==='talk'?3:0))}};
}
export function completeArcWeek(a:CareerArc,life:CareerLife,key:string,won:boolean,opponent:string):{arc:CareerArc;life:CareerLife}{
 const h=life.history.find(h=>h.key===key);if(!h||turnOrder(key)<0||turnOrder(key)<=turnOrder(a.lastKey)||Number(key.split(':')[0])!==a.year||a.lastKey===key||a.events.some(e=>e.id===`${key}:result`))return {arc:a,life};
 const choice=a.choice?.key===key?a.choice.id:undefined,rivalScore=clamp(Math.round(a.rival.overall-12+(journeyHash(`${a.seed}:${key}`)%35)+(choice==='train'?2:0)),15,99),n=a.rival.games+1,overall=clamp(a.rival.overall+(rivalScore>=78?.35:rivalScore<45?-.2:.1),40,95),rivalRole=role(overall);
 let next:CareerArc={...a,lastKey:key,choice:undefined,rival:{...a.rival,overall,role:rivalRole,last:rivalScore,total:a.rival.total+rivalScore,games:n,firstStart:a.rival.firstStart??(rivalRole==='starter'?n:undefined)},own:{...a.own,games:a.own.games+1,total:a.own.total+h.score,firstStart:a.own.firstStart??(life.role==='starter'?a.own.games+1:undefined)},seasonOwn:a.seasonOwn+h.score,seasonRival:a.seasonRival+rivalScore,seasonGames:a.seasonGames+1};
 const spotlight=opponent===a.rival.team,duel=h.score>rivalScore?'won':h.score<rivalScore?'lost':'tied';if(spotlight)next={...next,duels:{...next.duels,[duel]:next.duels[duel]+1}};
 const reaction=duel==='won'?(a.rival.relationship>=70?'You earned that. Next one is mine.':'Enjoy the headline. I want the rematch.'):duel==='lost'?(a.rival.relationship>=70?'Keep your head up. We will work on it together.':'You wanted the spotlight. I brought the tape.'):'Nothing settled. See you next time.';
 next=event(next,{id:`${key}:result`,label:spotlight?`Spotlight showdown · ${duel}`:'Class watch',text:`${key.replaceAll(':',' · ')}: your evaluation ${h.score}, ${a.rival.name} ${rivalScore} (simulated). Team ${won?'win':'loss'}.${spotlight?` ${a.rival.name}: “${reaction}” Your individual comparison is separate from the team result.`:''}`});
 if(!a.own.firstStart&&next.own.firstStart)next=event(next,{id:'first-start',label:'Your first tracked starting role',text:`You reached starter status after ${next.own.firstStart} tracked games.`});
 if(!a.rival.firstStart&&next.rival.firstStart)next=event(next,{id:'rival-first-start',label:'Your rival earns a starting role',text:`${a.rival.name} reached starter status after ${next.rival.firstStart} tracked games.`});
 return {arc:next,life:{...life,trust:clamp(life.trust-(choice==='talk'&&h.score<75?5:0)),reputation:clamp(life.reputation+(spotlight?(duel==='won'?5:duel==='lost'?-2:1):0))}};
}
const strengthCache=new Map<string,number>();
function teamStrength(abbr:string){if(!strengthCache.has(abbr)){const roster=buildSoloTeamRoster(abbr);strengthCache.set(abbr,Math.round(roster.reduce((n,p)=>n+p.ovr,0)/roster.length));}return strengthCache.get(abbr)!;}
export function careerOffers(a:CareerArc,life:CareerLife,p:Profile):CareerOffer[]{
 const start=a.year+1,market=Math.round(clamp(p.overall*.12+life.reputation*.08+a.own.awards*1.5,1,25)*10)/10;
 const strength=teamStrength;
 const clubs=SOLO_TEAM_THEMES.filter(t=>t.abbr!==p.teamAbbr&&t.abbr!==a.rival.team).sort((x,y)=>strength(y.abbr)-strength(x.abbr)||x.abbr.localeCompare(y.abbr));
 const money=clubs[(a.seed+a.year)%clubs.length],reps=clubs.filter(t=>t.abbr!==money.abbr).at(-1)!,contender=clubs.find(t=>t.abbr!==money.abbr&&t.abbr!==reps.abbr)!;
 return [{id:'loyalty',team:p.teamAbbr,start,end:start+1,annual:market,role:life.role,priority:'Loyalty',strength:strength(p.teamAbbr),detail:'Keep your coach trust and locker-room chemistry. Two seasons with your current club.'},{id:'money',team:money.abbr,start,end:start+2,annual:Math.round(market*1.35*10)/10,role:'rotation',priority:'Money',strength:strength(money.abbr),detail:'The largest salary, a three-season commitment, and rotation reps to start.'},{id:'reps',team:reps.abbr,start,end:start,annual:Math.round(market*.75*10)/10,role:'starter',priority:'Playing time',strength:strength(reps.abbr),detail:'A one-season prove-it deal with an opening starting role. Performance can still cost you the job.'},{id:'ring',team:contender.abbr,start,end:start,annual:Math.round(market*.85*10)/10,role:'rotation',priority:'Chase a title',strength:strength(contender.abbr),detail:'A stronger roster, a one-season deal, and a competitive depth chart. No championship guarantee.'}];
}
export function finishArcSeason(a:CareerArc,life:CareerLife,p:Profile,year:number,wins:number,champion:boolean,offerId?:string):{arc:CareerArc;life:CareerLife;team:string}|undefined{
 if(year!==a.year||a.seasons.some(s=>s.year===year)||!Number.isInteger(wins)||wins<0||wins>17)return;
 const expired=year>=a.contract.end,offer=expired?careerOffers(a,life,p).find(o=>o.id===offerId):undefined;if(expired&&!offer)return;
 const average=Math.round(a.seasonOwn/Math.max(1,a.seasonGames)),rivalAverage=Math.round(a.seasonRival/Math.max(1,a.seasonGames)),won=average>rivalAverage,lost=average<rivalAverage;
 let arc:CareerArc={...a,year:year+1,earnings:Math.round((a.earnings+a.contract.annual)*10)/10,own:{...a.own,awards:a.own.awards+Number(won)},rival:{...a.rival,awards:a.rival.awards+Number(lost)},contract:offer?{team:offer.team,start:offer.start,end:offer.end,annual:offer.annual,role:offer.role,priority:offer.priority}:a.contract,seasons:[...a.seasons,{year,trackedGames:a.seasonGames,average,rivalAverage,champion,wins}].slice(-50),seasonOwn:0,seasonRival:0,seasonGames:0,choice:undefined};
 arc=event(arc,{id:`${year}:award`,label:!a.seasonGames?'Season archived · no tracked tape':won?'Class duel award · YOU':lost?`Class duel award · ${a.rival.name}`:'Class duel award · SHARED',text:`${year}: ${a.seasonGames?`average evaluation ${average}–${rivalAverage}`:'individual tape was not tracked'}. ${wins} regular-season wins.${champion?' You won the Legacy Bowl.':''} This award compares this career’s two tracked prospects, not the entire league.`});
 if(offer)arc=event(arc,{id:`${year}:contract`,label:`Signed · ${teamName(offer.team)}`,text:`${offer.priority}: $${offer.annual.toFixed(1)}M per season through ${offer.end}; opening role ${offer.role}. Fictional career contract.`});
 const changed=offer&&offer.team!==p.teamAbbr;
 return {arc,team:offer?.team||p.teamAbbr,life:{...life,turn:undefined,fatigue:0,...offer?{role:offer.role}:{},...changed?{rosterSlotId:undefined,trust:55,chemistry:50}:{}}};
}
