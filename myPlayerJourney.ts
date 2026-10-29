import type {Position} from './types';
import {SOLO_TEAM_THEMES} from './soloUniverse';
export type JourneyChapter='roots'|'camp'|'agent'|'recovery'|'film'|'interview'|'visit';
export type JourneyChoice={id:string;label:string;detail:string;response:string;effects:Partial<JourneyMetrics>;attributes?:{speed?:number;power?:number;awareness?:number}};
export type JourneyMetrics={trust:number;readiness:number;visibility:number;medical:number;confidence:number};
export type JourneyState={version:1;seed:number;choices:Partial<Record<JourneyChapter,string>>;cursor:number;draftBaseGrade?:number;signedTeam?:string};
export type JourneyProfile={name:string;position:Position;combineId?:string};
export type DraftPick={overall:number;round:number;pick:number;team:string;name:string;position:string;mine:boolean};
export type CareerOffer={team:string;interest:number;role:'Starter candidate'|'Rotation prospect'|'Development project';style:string};
export type JourneyDraft={grade:number;combineGrade:number;storyDelta:number;kind:'drafted'|'undrafted';round:number;pick:number;overall:number;team:string;role:CareerOffer['role'];developmentPoints:number;board:DraftPick[];offers:CareerOffer[]};
export const JOURNEY_ORDER:JourneyChapter[]=['roots','camp','agent','recovery','film','interview','visit'];
const number=(n:unknown,lo:number,hi:number,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;
export function journeyHash(value:string){let seed=2166136261;for(const char of value){seed^=char.charCodeAt(0);seed=Math.imul(seed,16777619);}return seed>>>0;}
const teamExists=(abbr:unknown):abbr is string=>typeof abbr==='string'&&SOLO_TEAM_THEMES.some(t=>t.abbr===abbr);
export function teamStyle(abbr:string){return ['Win now','Patient development','Open competition'][journeyHash(abbr)%3];}
export function journeyOptions(chapter:JourneyChapter,profile:JourneyProfile):JourneyChoice[]{
 switch(chapter){
 case 'roots':return [
 {id:'captain',label:'The captain',detail:'Lead the locker room. More coach trust, less early attention.',response:'Your college coach backs your leadership. Clubs want to know if your ceiling matches your character.',effects:{trust:9,readiness:3,visibility:-5}},
 {id:'walk-on',label:'The overlooked walk-on',detail:'Arrive prepared and hungry. You have to create your own buzz.',response:'You earned every rep. Your agent books extra film sessions because scouts still need a reason to notice you.',effects:{readiness:9,confidence:5,visibility:-7}},
 {id:'headline',label:'The headline prospect',detail:'Get a bigger platform. Expectations rise before you take a rep.',response:'Your name leads the preview show. Coaches expect proof that the spotlight has not become the priority.',effects:{visibility:12,confidence:5,trust:-6}},
 ];
 case 'camp':return [
 {id:'speed',label:'Build an explosive first step',detail:'+3 speed, −1 power. Improve the burst scouts see on the track.',response:'Your trainer rebuilds your first ten yards. The new speed helps your playable dash; strength work takes a back seat.',effects:{readiness:4,medical:-3},attributes:{speed:3,power:-1}},
 {id:'power',label:'Own the weight room',detail:'+3 power, −1 speed. Put strength on film and develop your frame.',response:'Your strength coach signs off on the extra load. You arrive stronger, with a little less straight-line speed.',effects:{readiness:4,confidence:3},attributes:{power:3,speed:-1}},
 {id:'balanced',label:'Train the complete player',detail:'+2 awareness, +1 speed. More preparation, less publicity.',response:'Early film, balanced training, full recovery. It is a quieter camp, but coaches notice the preparation.',effects:{trust:4,readiness:6,visibility:-3},attributes:{awareness:2,speed:1}},
 ];
 case 'agent':return [
 {id:'fit',label:'Find the right football fit',detail:'Prioritize a development plan and lasting coach relationships.',response:'Your agent targets patient staffs. You may wait longer to hear your name, but the landing spot matters.',effects:{trust:5,readiness:5,visibility:-4}},
 {id:'hype',label:'Make my name impossible to miss',detail:'Chase exposure. Big expectations make weak workouts more costly.',response:'Your interview schedule fills up. If the drills back the campaign, clubs will notice. If they do not, the questions get louder.',effects:{visibility:12,confidence:4,trust:-4}},
 {id:'competition',label:'Put me where I can compete now',detail:'Target open depth charts. Accept the pressure of earning your place.',response:'Your agent asks clubs about actual practice reps. You are betting on an opportunity, not a promise.',effects:{confidence:8,trust:2,readiness:-3}},
 ];
 case 'recovery':return [
 {id:'recover',label:'Follow the recovery plan',detail:'Improve recovery and coach trust. Give up a publicity session.',response:'You skip the camera workout and arrive fresh for meetings. The medical staff closes its fatigue note.',effects:{medical:10,trust:6,visibility:-5}},
 {id:'showcase',label:'Take the extra public workout',detail:'More exposure, more fatigue. It pays off only if your drills back up the hype.',response:'Your workout clip makes the rounds. Scouts get another look, and the medical staff asks about your workload.',effects:{visibility:11,confidence:5,medical:-18}},
 {id:'film-first',label:'Use the extra day for film',detail:'Build preparation while keeping a lighter recovery load.',response:'You spend the afternoon with a position coach. Your answers sharpen, though you miss some recovery time.',effects:{readiness:8,medical:-6,visibility:-2}},
 ];
 case 'film':return [
 {id:'own',label:'Own the mistake and explain the fix',detail:'Trade a little swagger for coach trust and preparation.',response:'The position coach rewinds the clip. Your correction is specific, and the room starts taking notes.',effects:{trust:10,readiness:8,confidence:-3}},
 {id:'blame',label:'Explain why the scheme let you down',detail:'Protect your confidence. Coaches may question accountability.',response:'The coordinator asks why the same teammate executed the call correctly. The room grows quieter.',effects:{confidence:7,trust:-12,readiness:-4}},
 {id:'flash',label:'Ask them to watch the highlight first',detail:'Keep the star pitch alive. Some staffs want more self-evaluation.',response:'The highlight earns a nod. The scout still circles the unanswered mistake on the evaluation sheet.',effects:{visibility:7,confidence:4,trust:-5}},
 ];
 case 'interview':{
 const defensive=['CB','S','LB','EDGE','FS','SS'].includes(profile.position);
 return defensive?[
 {id:'assignment',label:'Read my key and keep my assignment',detail:'The offense motions late. Explain how you stay connected to the defensive call.',response:'You identify your key and explain the communication. The defensive coordinator marks you as prepared.',effects:{readiness:10,trust:6}},
 {id:'hero',label:'Ignore the call and hunt the big play',detail:'Bet on instincts. A missed assignment could leave a teammate exposed.',response:'The coach asks who covers the space you abandoned. Your confidence lands; the assignment concern stays.',effects:{confidence:9,readiness:-10,trust:-7}},
 {id:'ask',label:'Confirm the adjustment with the captain',detail:'Show communication. Admit you want the call clarified before the snap.',response:'You communicate before the snap. The coach likes the discipline but adds a processing-speed note.',effects:{trust:8,readiness:3,confidence:-2}},
 ]:[
 {id:'assignment',label:'Protect possession and work through my read',detail:'Third down, late in a close game. Explain how you keep the offense on schedule.',response:'You describe the read and the safe answer against pressure. The offensive staff marks your processing as a strength.',effects:{readiness:10,trust:6}},
 {id:'hero',label:'Force the highlight and make the crowd remember',detail:'Trust your talent. A spectacular play also risks ending the drive.',response:'The coordinator asks what happens when the window closes. Your ceiling is clear; your judgment is still being debated.',effects:{confidence:9,visibility:3,readiness:-10,trust:-7}},
 {id:'ask',label:'Communicate the pressure and confirm the adjustment',detail:'Show you can organize the call with teammates before the snap.',response:'You get the unit on the same page. The staff trusts your communication and wants the decision a little quicker.',effects:{trust:8,readiness:3,confidence:-2}},
 ];}
 case 'visit':return journeyVisitTeams(profile).map(team=>({id:team.abbr,label:`Visit ${team.name}`,detail:`${teamStyle(team.abbr)} · build a relationship with this staff. A visit increases interest, not a guaranteed selection.`,response:`The ${team.name} staff walks you through its plan. Your visit strengthens their interest; they still have to decide whether you fit their board.`,effects:{trust:3,confidence:3}}));
 }
}
export function journeyVisitTeams(profile:JourneyProfile){const seed=journeyHash(`${profile.combineId||profile.name}:${profile.position}:visits`);return [0,1,2].map(i=>SOLO_TEAM_THEMES[(seed+i*11)%32]);}
export function cleanJourney(raw:unknown,profile:JourneyProfile):JourneyState{
 const input=raw as Partial<JourneyState>|null;const choices:JourneyState['choices']={};
 if(input?.version===1)for(const chapter of JOURNEY_ORDER){const id=input.choices?.[chapter];if(typeof id==='string'&&journeyOptions(chapter,profile).some(o=>o.id===id))choices[chapter]=id;else break;}
 return {version:1,seed:Math.floor(number(input?.seed,0,4294967295,journeyHash(`${profile.combineId||profile.name}:${profile.position}:journey`))),choices,cursor:Math.floor(number(input?.cursor,0,224,0)),...(typeof input?.draftBaseGrade==='number'&&Number.isFinite(input.draftBaseGrade)&&JOURNEY_ORDER.every(c=>choices[c])?{draftBaseGrade:number(input.draftBaseGrade,0,100,0)}:{}),...(teamExists(input?.signedTeam)?{signedTeam:input.signedTeam}:{})};
}
export function nextJourneyChapter(state:JourneyState,combineComplete:boolean):JourneyChapter|'combine'|'ready'{
 for(const chapter of JOURNEY_ORDER){if(!state.choices[chapter])return ['recovery','film','interview','visit'].includes(chapter)&&!combineComplete?'combine':chapter;}
 return combineComplete?'ready':'combine';
}
export function chooseJourney(raw:JourneyState|undefined,profile:JourneyProfile,chapter:JourneyChapter,id:string,combineComplete:boolean){
 const state=cleanJourney(raw,profile);if(state.draftBaseGrade!==undefined||nextJourneyChapter(state,combineComplete)!==chapter)return state;
 if(!journeyOptions(chapter,profile).some(o=>o.id===id))return state;
 return {...state,choices:{...state.choices,[chapter]:id}};
}
export function journeyMetrics(raw:JourneyState|undefined,profile:JourneyProfile):JourneyMetrics{
 const state=cleanJourney(raw,profile);const metrics:JourneyMetrics={trust:50,readiness:50,visibility:40,medical:90,confidence:50};
 for(const chapter of JOURNEY_ORDER){const option=journeyOptions(chapter,profile).find(o=>o.id===state.choices[chapter]);if(option)for(const key of Object.keys(option.effects) as (keyof JourneyMetrics)[])metrics[key]+=option.effects[key]||0;}
 for(const key of Object.keys(metrics) as (keyof JourneyMetrics)[])metrics[key]=Math.max(0,Math.min(100,metrics[key]));return metrics;
}
export function journeyGrade(raw:JourneyState|undefined,profile:JourneyProfile,combineGrade:number){
 const state=cleanJourney(raw,profile),m=journeyMetrics(state,profile);
 const interviewDelta=(m.trust-50)*.17+(m.readiness-50)*.19+(m.confidence-50)*.025;
 const exposure=state.choices.agent==='hype'?(combineGrade>=75?2:-3):state.choices.agent==='fit'?-1:0;
 const delta=Math.max(-12,Math.min(12,Math.round(interviewDelta+exposure+(m.medical<75?-3:0)+(state.choices.recovery==='showcase'?(combineGrade>=75?2:-2):0))));
 return {grade:Math.max(0,Math.min(100,combineGrade+delta)),storyDelta:delta,combineGrade};
}
export function careerTeamInterest(raw:JourneyState|undefined,profile:JourneyProfile,combineGrade:number):CareerOffer[]{
 const state=cleanJourney(raw,profile),m=journeyMetrics(state,profile),grade=journeyGrade(state,profile,combineGrade).grade;
 return SOLO_TEAM_THEMES.map(t=>{const style=teamStyle(t.abbr),need=journeyHash(`${t.abbr}:${profile.position}:need`)%25;
 const alignment=(state.choices.agent==='fit'&&style==='Patient development'||state.choices.agent==='competition'&&style==='Open competition'||state.choices.agent==='hype'&&style==='Win now')?9:0;
 const interest=Math.max(0,Math.min(99,Math.round(grade*.62+need+(m.trust-50)*.16+(m.visibility-40)*.08+alignment+(state.choices.visit===t.abbr?16:0))));
 const role:CareerOffer['role']=m.trust>=72&&m.medical>=75&&grade>=74&&need>=12?'Starter candidate':grade>=53?'Rotation prospect':'Development project';
 return {team:t.abbr,interest,role,style};}).sort((a,b)=>b.interest-a.interest||a.team.localeCompare(b.team));
}
const firstNames=['Mason','Darius','Nico','Jalen','Cameron','Roman','Blake','Tyrell','Miles','Adrian','Devin','Kai','Malik','Cole','Julian','Andre'];
const lastNames=['Hayes','Bennett','Carter','Reed','Brooks','Walker','Morgan','Price','Hughes','Coleman','Foster','Grant','Rivera','Mitchell','Ross'];
export function journeyProspects(seed:number){
 const positions=['QB','RB','RB','WR','WR','WR','WR','TE','TE','OT','OT','OT','OG','OG','C','EDGE','EDGE','EDGE','DT','DT','LB','LB','CB','CB','CB','S','S','K','P'];return Array.from({length:256},(_,i)=>{const h=journeyHash(`${seed}:prospect:${i}`);return {id:`prospect-${i}`,name:`${firstNames[i%16]} ${lastNames[Math.floor(i/16)%15]}${i>=240?' Jr.':''}`,position:positions[h%positions.length],grade:35+(h%610)/10-(['K','P'].includes(positions[h%positions.length])?12:0)};});
}
export function resolveJourneyDraft(raw:JourneyState|undefined,profile:JourneyProfile,combineGrade:number):JourneyDraft{
 const state=cleanJourney(raw,profile);const frozen=state.draftBaseGrade??combineGrade;const grade=journeyGrade(state,profile,frozen);const interests=careerTeamInterest(state,profile,frozen);
 const pool=journeyProspects(state.seed);
 pool.push({id:'me',name:profile.name,position:profile.position,grade:grade.grade});
 const available=new Set(pool.map(p=>p.id));const board:DraftPick[]=[];let myPick:DraftPick|undefined;
 const order=[...SOLO_TEAM_THEMES].sort((a,b)=>journeyHash(`${state.seed}:order:${a.abbr}`)-journeyHash(`${state.seed}:order:${b.abbr}`));const draftedBy=new Map<string,string[]>();
 for(let i=0;i<224;i++){
 const team=order[i%32];let best=pool[0],value=-Infinity;
 for(const prospect of pool){if(!available.has(prospect.id))continue;const positionalNeed=journeyHash(`${team.abbr}:${prospect.position}:need`)%25;const duplicate=(draftedBy.get(team.abbr)||[]).filter(p=>p===prospect.position).length;
 const relationship=prospect.id==='me'?(interests.find(t=>t.team===team.abbr)!.interest-grade.grade*.62-positionalNeed)*.4:0;
 const score=prospect.grade+positionalNeed*.28-duplicate*7+relationship;
 if(score>value){value=score;best=prospect;}}
 available.delete(best.id);draftedBy.set(team.abbr,[...(draftedBy.get(team.abbr)||[]),best.position]);const pick={overall:i+1,round:Math.floor(i/32)+1,pick:i%32+1,team:team.abbr,name:best.name,position:best.position,mine:best.id==='me'};board.push(pick);if(pick.mine)myPick=pick;
 }
 const m=journeyMetrics(state,profile),offers=interests.slice(0,3),selected=myPick?interests.find(t=>t.team===myPick!.team)!:offers[0];
 return {...grade,kind:myPick?'drafted':'undrafted',round:myPick?.round||0,pick:myPick?.pick||0,overall:myPick?.overall||225,team:selected.team,role:selected.role,developmentPoints:m.readiness>=72?2:m.readiness>=60?1:0,board,offers};
}
