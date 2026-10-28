import React,{useMemo} from 'react';
import {athleteMovement,BODY_PRESETS,feetAndInches,limitsFor,presetAthleteBuild,type AthleteBuild} from './athleteBuild';

type Props={value:AthleteBuild;onChange:(build:AthleteBuild)=>void};
const Slider=({label,value,min,max,display,onChange}:{label:string;value:number;min:number;max:number;display:string;onChange:(value:number)=>void})=><label className="mt-3 block"><span className="mb-1 flex justify-between text-[10px] font-black"><span className="text-zinc-500">{label}</span><b>{display}</b></span><input aria-label={label} type="range" min={min} max={max} value={value} onChange={event=>onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer accent-[var(--bk-team-accent)]"/></label>;

export default function AthleteBuildEditor({value,onChange}:Props){
  const limits=limitsFor(value.position),movement=useMemo(()=>athleteMovement(value),[value]);
  const set=(key:keyof AthleteBuild,next:number|string)=>onChange({...value,[key]:next,bodyPresetId:'custom'});
  return <div data-athlete-build-editor="madden-style">
    <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-black tracking-[.18em] text-[var(--bk-team-accent)]">PHYSIQUE & MOVEMENT</span><span className="text-[10px] font-bold text-zinc-500">LIVE BUILD</span></div>
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{BODY_PRESETS.map(preset=><button type="button" key={preset.id} aria-pressed={value.bodyPresetId===preset.id} onClick={()=>onChange(presetAthleteBuild(value.position,preset))} className={`min-h-14 rounded-xl border px-2 text-left ${value.bodyPresetId===preset.id?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10':'border-white/10 bg-[#111]'}`}><span className="block text-[9px] font-black">{preset.label}</span><span className="mt-0.5 block text-[8px] font-bold text-zinc-500">{preset.detail}</span></button>)}</div>
    <Slider label="HEIGHT" value={value.heightInches} min={limits.height[0]} max={limits.height[1]} display={feetAndInches(value.heightInches)} onChange={next=>set('heightInches',next)}/>
    <Slider label="WEIGHT" value={value.weightLbs} min={limits.weight[0]} max={limits.weight[1]} display={`${value.weightLbs} LB`} onChange={next=>set('weightLbs',next)}/>
    <Slider label="BODY BUILD" value={value.bodyBuild} min={0} max={100} display={value.bodyBuild<34?'LEAN':value.bodyBuild<67?'ATHLETIC':'POWER'} onChange={next=>set('bodyBuild',next)}/>
    <Slider label="SHOULDERS" value={value.shoulderWidth} min={0} max={100} display={`${value.shoulderWidth}%`} onChange={next=>set('shoulderWidth',next)}/>
    <Slider label="ARMS" value={value.armSize} min={0} max={100} display={`${value.armSize}%`} onChange={next=>set('armSize',next)}/>
    <Slider label="LEGS" value={value.legSize} min={0} max={100} display={`${value.legSize}%`} onChange={next=>set('legSize',next)}/>
    <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Build movement profile">{Object.entries(movement).map(([label,score])=><div key={label} className="rounded-xl border border-white/10 bg-white/[.03] p-2"><span className="block text-[8px] font-black uppercase text-zinc-500">{label}</span><strong className="text-lg">{score}</strong><span className="ml-1 text-[8px] text-zinc-600">/ 99</span></div>)}</div>
    <p className="mt-3 text-[10px] font-semibold leading-relaxed text-zinc-500">Your frame changes movement in practice: lighter builds accelerate and cut faster; heavier builds gain strength and contact. Rival challenges normalize every build to 85 so physique never becomes pay-to-win.</p>
  </div>;
}
