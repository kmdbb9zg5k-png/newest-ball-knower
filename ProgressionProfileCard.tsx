import React,{useEffect,useMemo,useState} from 'react';
import {Award,Brain,BriefcaseBusiness,Crown,RefreshCcw,ShieldCheck,Swords,Target,Trophy} from 'lucide-react';
import {useBallKnower} from './BallKnowerContext';
import {Achievement,fetchProgressionProfile,ProgressEvent,ProgressProfile} from './progressionCloud';

export const ProgressionProfileCard:React.FC=()=>{
  const {currentUser}=useBallKnower();
  const [profile,setProfile]=useState<ProgressProfile|null>(null);
  const [events,setEvents]=useState<ProgressEvent[]>([]);
  const [achievements,setAchievements]=useState<Achievement[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);

  const refresh=async()=>{setLoading(true);try{const data=await fetchProgressionProfile(currentUser?.name);setProfile(data.profile);setEvents(data.events);setAchievements(data.achievements);setError('');}catch(e:any){setError(e?.message||'Could not load Ball Knower profile.');}finally{setLoading(false);}};
  useEffect(()=>{void refresh()},[currentUser?.id,currentUser?.name]);
  const unlocked=useMemo(()=>achievements.filter(x=>Boolean(x.unlockedAt)),[achievements]);

  if(loading&&!profile)return <div className="rounded-[2rem] border border-white/10 bg-[#101318] p-6 text-sm font-bold text-zinc-500">Loading universal Ball Knower profile…</div>;
  if(error&&!profile)return <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-red-500/20 bg-red-500/5 p-5 text-xs font-bold text-red-300"><span>{error}</span><button onClick={()=>void refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/30 px-4"><RefreshCcw className="h-4 w-4"/>Retry</button></div>;
  if(!profile)return null;

  const categories=[
    ['Football IQ',profile.footballIq,Brain],['GM',profile.gmRating,Swords],['Predictions',profile.predictionRating,Target],['Trivia',profile.triviaRating,Trophy],['Agent',profile.agentRating,BriefcaseBusiness],['Owner',profile.ownerRating,Crown],
  ] as const;

  return <section className="overflow-hidden rounded-[2rem] border border-[#D4AF37]/30 bg-[radial-gradient(circle_at_85%_10%,rgba(212,175,55,.2),transparent_28%),#0b0e13] p-5 sm:p-7">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="text-[10px] font-black uppercase tracking-[.28em] text-[#D4AF37]">Universal Ball Knower Profile</div><div className="mt-2 text-3xl font-black sm:text-5xl">{profile.displayName}</div><div className="mt-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Level {profile.level} · {profile.xp.toLocaleString()} XP · {profile.championships} Championships</div></div>
      <div className="min-w-40 rounded-3xl border border-[#D4AF37]/30 bg-black/35 p-5 text-center"><div className="text-[10px] font-black uppercase tracking-[.2em] text-zinc-500">BK Rating</div><div className="mt-1 text-6xl font-black text-[#D4AF37]">{profile.bkRating}</div><div className="mt-1 text-[9px] font-black uppercase text-zinc-600">Server controlled</div></div>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{categories.map(([label,value,Icon])=><div key={label} className="rounded-2xl border border-white/10 bg-black/25 p-4"><Icon className="h-4 w-4 text-[#D4AF37]"/><div className="mt-3 text-[9px] font-black uppercase text-zinc-600">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>)}</div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase"><Award className="h-4 w-4 text-[#D4AF37]"/>Trophy Case</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{achievements.slice(0,6).map(a=><div key={a.key} className={`rounded-xl border p-3 ${a.unlockedAt?'border-[#D4AF37]/30 bg-[#D4AF37]/10':'border-white/5 bg-white/[.02] opacity-55'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-black uppercase">{a.title}</span>{a.unlockedAt&&<ShieldCheck className="h-4 w-4 text-emerald-300"/>}</div><div className="mt-1 text-[10px] leading-4 text-zinc-500">{a.description}</div></div>)}</div><div className="mt-3 text-[10px] font-black uppercase text-zinc-600">Unlocked {unlocked.length}/{achievements.length}</div></div>
      <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-xs font-black uppercase">Recent Verified Receipts</div><div className="mt-3 space-y-2">{events.length?events.slice(0,6).map(e=><div key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.03] p-3"><div><div className="text-xs font-black uppercase">{e.eventType.replaceAll('_',' ')}</div><div className="mt-1 text-[9px] uppercase text-zinc-600">{e.category} · {new Date(e.occurredAt).toLocaleDateString()}</div></div><div className="text-right text-[10px] font-black text-[#D4AF37]">+{e.xpAwarded} XP{e.ratingDelta?` · ${e.ratingDelta>0?'+':''}${e.ratingDelta} RTG`:''}</div></div>):<div className="rounded-xl border border-white/5 bg-white/[.02] p-4 text-xs text-zinc-500">No verified progression receipts yet. As Trivia, Leagues, Agent and Owner modes are connected, their trusted events will show here.</div>}</div></div>
    </div>
  </section>;
};
