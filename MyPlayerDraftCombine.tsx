import {careerAthleteIdentity} from './athletePassport';
import React,{lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Dumbbell,Play,Sparkles,X} from 'lucide-react';
import {combineAthlete} from './combine/dash.js';
import {calculatePlayedCombine,cleanDraftCombine,draftDrillMark,requiredDraftDrills,type DraftCombinePerformance,type DraftDrill} from './myPlayerDraftCombine';
import type {Position} from './types';
import type {AthleteAppearance} from './athleteAppearance';
const Dash=lazy(()=>import('./combine/CombineExperience'));
const Jump=lazy(()=>import('./combine/BroadJumpExperience'));
const Skill=lazy(()=>import('./combine/AgilityStrengthExperience'));
const Routes=lazy(()=>import('./combine/RouteExperience'));
const RB=lazy(()=>import('./combine/RBExperience'));
const DB=lazy(()=>import('./combine/DBExperience'));
const events:Record<DraftDrill,{name:string;rule:string}>={
 dash:{name:'40-Yard Dash',rule:'Alternate strides. Your fastest finished run counts.'},
 'broad-jump':{name:'Broad Jump',rule:'Build power, time your jump, stick the landing. Longest distance counts.'},
 shuttle:{name:'20-Yard Shuttle',rule:'Time both cuts. Your fastest time including penalties counts.'},
 bench:{name:'Bench Press',rule:'Press and recover for 30 seconds. Most full reps counts.'},
 routes:{name:'Receiver Workout',rule:'Complete all eight routes. Highest average score counts.'},
 rb:{name:'Running Back Workout',rule:'Beat the linebacker through five reps. Highest average score counts.'},
 db:{name:'Defensive Back Workout',rule:'Cover the receiver through five reps. Highest average score counts.'},
};
type Profile={name:string;position:Position;number:number;speed:number;power:number;overall:number;heightInches:number;weightLbs:number;combinePerformance?:DraftCombinePerformance;combineId?:string}&Partial<AthleteAppearance>;
type Props={profile:Profile;onResult:(drill:DraftDrill,stats:Record<string,number>)=>void;onDraft:()=>void;storyMode?:boolean;onWorkoutClose?:()=>void};
export function MyPlayerDraftCombine({profile,onResult,onDraft,storyMode=false,onWorkoutClose}:Props){
 const [playing,setPlaying]=useState<DraftDrill|null>(null);
 const records=cleanDraftCombine(profile.combinePerformance).results;
 const required=requiredDraftDrills(profile.position),complete=required.filter(drill=>records[drill]).length;
 const result=calculatePlayedCombine(profile.position,profile.combinePerformance);
 const athlete=useMemo(()=>{const identity=careerAthleteIdentity(profile);return{...combineAthlete({id:'my-player-user',name:profile.name,position:profile.position,speed:profile.speed,grade:profile.overall}),heightInches:profile.heightInches,weightLbs:profile.weightLbs,jerseyNumber:profile.number,cosmeticIdentityId:`my-player-${identity.id}`,athleteAppearance:identity.appearance,careerStrength:profile.power};},[profile]);
 return <section className="rounded-[2rem] border border-white/10 bg-[#10151d] p-4 sm:p-7" aria-label="My Player draft Combine">
  <div className="flex items-center gap-3 text-[var(--bk-team-accent)]"><Dumbbell/><span className="text-[10px] font-black tracking-[.25em]">PLAYABLE DRAFT COMBINE</span></div>
  <h2 className="mt-3 text-3xl font-black sm:text-4xl">PROVE YOU BELONG</h2><p className="mt-3 text-sm leading-6 text-zinc-400">{profile.name} · {profile.position}. Complete your drills, then enter the draft. Your performance determines draft stock and can raise or lower your starting overall.</p>
  <p className="mt-4 text-xs font-black text-[var(--bk-team-accent)]" role="status">{complete} / {required.length} EVENTS COMPLETE</p><progress aria-label="Combine completion" max={required.length} value={complete} className="mt-2 h-2 w-full accent-[var(--bk-team-accent)]"/>
  <div className="mt-4 space-y-3">{required.map(drill=>{const record=records[drill],event=events[drill];return <article key={drill} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-black">{event.name}</h3><p className="mt-1 text-lg font-black text-[var(--bk-team-accent)]">{record?draftDrillMark(drill,record.best):'No result yet'}</p></div><button type="button" className="min-h-11 rounded-xl border border-[var(--bk-team-accent)]/35 bg-[var(--bk-team-accent)]/10 px-4 text-xs font-black text-[var(--bk-team-accent)]" onClick={()=>setPlaying(drill)}><Play className="mr-2 inline h-3.5 w-3.5"/>{record?'Retry':'Play'} {event.name}</button></div><p className="mt-2 text-xs leading-5 text-zinc-400">{event.rule}</p>{record&&<p className="mt-2 text-[10px] text-zinc-500">{record.attempts} completed {record.attempts===1?'attempt':'attempts'} · Last: {draftDrillMark(drill,record.last)}</p>}</article>;})}</div>
  <div className="mt-4 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 p-4"><span className="text-[10px] font-black tracking-widest text-[var(--bk-team-accent)]">{result?storyMode?'WORKOUT GRADE':'FINAL COMBINE GRADE':'DRAFT STOCK PENDING'}</span><p className="mt-2 text-2xl font-black">{result?`${result.score}/100 · ${result.label}`:'Earn your grade on the field'}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{result&&storyMode?'Your workouts are one part of the draft board. Interviews and team fit also matter.':result?`Projected round: ${result.draftRound}. ${result.overallChange>0?'+':''}${result.overallChange} starting OVR adjustment.`:'Complete every listed event to unlock draft night. False starts and unfinished sessions do not post a mark.'}</p></div>
  <p className="mt-4 text-xs leading-5 text-zinc-400">Retry before draft night to improve your bests. Each completed result stays with this career. Leaving mid-drill keeps your previous best.</p>
  {!storyMode&&<button type="button" disabled={!result} onClick={onDraft} className="mt-4 min-h-14 w-full rounded-2xl bg-[var(--bk-team-accent)] px-4 py-4 text-base font-black text-[var(--bk-on-accent)] disabled:opacity-40"><Sparkles className="mr-2 inline"/>ENTER THE PRO DRAFT</button>}
  {playing&&createPortal(<DraftDrillModal key={playing} drill={playing} athlete={athlete} context={`my-player-draft:${profile.combineId||'legacy'}`} onResult={stats=>onResult(playing,stats)} onClose={()=>{setPlaying(null);onWorkoutClose?.();}}/>,document.body)}
 </section>;
}
class DrillError extends React.Component<{children:React.ReactNode;onClose:()=>void;closeLabel?:string},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return{failed:true};}
 render(){return this.state.failed?<div className="m-auto max-w-md p-6 text-center"><h2 className="text-xl font-black">The drill could not load</h2><p className="my-4 text-sm text-zinc-400">Your previous Combine results are kept. Reopen the drill to try again.</p><button className="min-h-11 rounded-xl border border-white/20 px-4" onClick={this.props.onClose}>{this.props.closeLabel||'Back to draft Combine'}</button></div>:this.props.children;}
}
export function DraftDrillModal({drill,athlete,context,onResult,onClose,title="MY PLAYER · DRAFT COMBINE",closeLabel="Back to draft Combine"}:{drill:DraftDrill;athlete:ReturnType<typeof combineAthlete>;context:string;onResult:(stats:Record<string,number>)=>void;onClose:()=>void;title?:string;closeLabel?:string}){
 const dialog=useRef<HTMLDialogElement>(null);const [mark,setMark]=useState('');
 useEffect(()=>{dialog.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;};},[]);
 const props={players:[athlete],context,onClose,onResult:(stats:Record<string,number>)=>{onResult(stats);const value=drill==='dash'||drill==='shuttle'?stats.time:drill==='broad-jump'?stats.distance:drill==='bench'?stats.reps:stats.score;setMark(stats.dnf?'No time recorded. Retry the dash.':`${events[drill].name}: ${draftDrillMark(drill,value)} recorded`);}};
 return <dialog ref={dialog} aria-label={`${events[drill].name} ${title.includes('TRAINING CAMP')?'camp evaluation':'draft workout'}`} onCancel={event=>{event.preventDefault();onClose();}} className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-[#080f16] p-0 text-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] open:flex open:flex-col"><header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3"><div><strong className="block text-xs">{title}</strong><span className="mt-1 block text-[10px] text-zinc-400" role="status">{mark||`${athlete.name} · ${events[drill].name}`}</span></div><button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20"><X className="h-5 w-5"/></button></header><DrillError onClose={onClose} closeLabel={closeLabel}><Suspense fallback={<div className="m-auto p-6 text-center">Preparing your workout…<button className="mt-4 block min-h-11 w-full rounded-xl border border-white/20 px-4" onClick={onClose}>{closeLabel}</button></div>}><div className="relative min-h-0 flex-1 overflow-hidden [&>.combine-game]:!relative [&>.combine-game]:!inset-auto [&>.combine-game]:!h-full [&>.combine-game]:!min-h-0">{drill==='dash'?<Dash {...props}/>:drill==='broad-jump'?<Jump {...props}/>:drill==='bench'||drill==='shuttle'?<Skill {...props} drill={drill}/>:drill==='routes'?<Routes {...props}/>:drill==='rb'?<RB {...props}/>:<DB {...props}/>}</div></Suspense></DrillError></dialog>;
}
