import React,{useState} from 'react';
import {Crown,ShieldCheck} from 'lucide-react';
import {activeSoloCareer,loadSoloUniverse,xpForLevel} from './soloCareerUniverse';

/** Read the existing career ledger; moving these cards never creates or resets a save. */
export default function MyPlayerCareerStats(){
 const [universe]=useState(()=>loadSoloUniverse());
 const activeSave=activeSoloCareer(universe);
 const levelTarget=xpForLevel(universe.profile.level);
 const xpPct=Math.min(100,Math.round(universe.profile.xp/levelTarget*100));
 return <section className="mx-auto max-w-5xl px-3 py-4 sm:px-5" aria-label="Career stats">
  <h2 className="mb-2 text-xl font-black text-white">Career stats</h2>
  <p className="mb-5 text-sm text-zinc-400">Progress across your Solo careers. Pressure and morale reflect your active career{activeSave?` · ${activeSave.title}`:''}.</p>
        <section className="mb-4 grid gap-3 sm:grid-cols-[1.35fr_.65fr]">
          <div className="overflow-hidden rounded-[28px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(22,17,8,.97),rgba(8,11,16,.96)_58%,rgba(17,24,34,.96))] p-4 shadow-2xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.24em] text-amber-300">Solo Career</div>
                <div className="mt-1 text-2xl font-black uppercase tracking-tight">BK Level {universe.profile.level}</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-200">
                <Crown size={23} />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span>{universe.profile.xp.toLocaleString()} XP</span>
              <span>{levelTarget.toLocaleString()} to level {universe.profile.level + 1}</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                ['REP', universe.profile.reputation],
                ['LEGACY', universe.profile.legacy],
                ['TITLES', universe.profile.championships],
                ['CALLS', universe.profile.decisions],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-black/25 px-2 py-3 text-center">
                  <div className="text-lg font-black text-white">{value}</div>
                  <div className="text-[8px] font-black uppercase tracking-wider text-zinc-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#080b10]/94 p-4 shadow-2xl sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-zinc-500">
              <ShieldCheck size={14} /> Career Status
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Achievements</span>
                <strong className="text-sm text-white">{universe.profile.achievements.length}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Active careers</span>
                <strong className="text-sm text-white">{universe.saves.length}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Pressure</span>
                <strong className={activeSave && activeSave.pressure >= 70 ? 'text-sm text-red-400' : 'text-sm text-white'}>{activeSave?.pressure ?? 0}%</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Morale</span>
                <strong className="text-sm text-emerald-300">{activeSave?.morale ?? 0}%</strong>
              </div>
            </div>
          </div>
        </section>
 </section>;
}
