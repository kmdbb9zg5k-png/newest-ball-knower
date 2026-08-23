import React,{useEffect,useMemo,useState} from 'react';
import {ArrowRight,Brain,Plus,Target,Trophy,Users} from 'lucide-react';
import {useBallKnower} from './BallKnowerContext';
import {fetchProgressionProfile,ProgressProfile} from './progressionCloud';
import {League} from './types';
import type {AppTab} from './App';

interface HomeDashboardProps{
  onOpenCreateLeague:()=>void;
  onOpenJoinLeague:()=>void;
  onSelectLeague:(league:League,tab:'lobby'|'draft'|'simulation')=>void;
  onNavigate:(tab:AppTab)=>void;
}

const tierFor=(rating:number)=>rating>=90?'CERTIFIED':rating>=80?'ELITE':rating>=70?'KNOWER':rating>=60?'STUDENT':'ROOKIE';

export const HomeDashboard:React.FC<HomeDashboardProps>=({onOpenCreateLeague,onOpenJoinLeague,onSelectLeague,onNavigate})=>{
  const {leagues,currentUser}=useBallKnower();
  const [profile,setProfile]=useState<ProgressProfile|null>(null);
  useEffect(()=>{let live=true;fetchProgressionProfile(currentUser?.name).then(data=>{if(live)setProfile(data.profile)}).catch(()=>{});return()=>{live=false}},[currentUser?.id,currentUser?.name]);

  const primaryLeague=useMemo(()=>leagues.find(l=>l.status!=='completed')||leagues[0],[leagues]);
  const myMember=primaryLeague?.members.find(member=>member.userId===currentUser?.id);
  const myPick=primaryLeague?.seasonResult?.draftOrder?.find(item=>item.memberId===myMember?.id)?.pickNumber;
  const rating=profile?.bkRating??50;

  return <div className="mx-auto max-w-5xl px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
    <section className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[radial-gradient(circle_at_90%_0%,rgb(var(--bk-team-primary-rgb)/.24),transparent_38%),#0b0e12] p-4 sm:p-5">
        <div className="text-[9px] font-black uppercase tracking-[.24em] text-[var(--bk-team-accent)]">Your Ball Knower Rating</div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div><div className="text-6xl font-black leading-none text-white sm:text-7xl">{rating}</div><div className="mt-2 text-xs font-black uppercase tracking-[.16em] text-[var(--bk-team-accent)]">{tierFor(rating)}</div></div>
          <div className="text-right text-[10px] font-bold uppercase leading-5 text-zinc-600">Fantasy · Picks · Trivia<br/>all feed one profile</div>
        </div>
        <button onClick={()=>onNavigate('locker')} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 text-[10px] font-black uppercase tracking-wider text-zinc-300">View profile <ArrowRight className="h-3.5 w-3.5"/></button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c0f13]/95 p-4 sm:p-5">
        <div className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-600">What should I do now?</div>
        <div className="mt-3 grid gap-2">
          <Quick icon={<Trophy className="h-4 w-4"/>} label="Fantasy" sub={primaryLeague?`Open ${primaryLeague.name}`:'Join or create a league'} onClick={()=>primaryLeague?onSelectLeague(primaryLeague,'lobby'):onNavigate('fantasy')}/>
          <Quick icon={<Target className="h-4 w-4"/>} label="Make Picks" sub="Call this week's NFL lines" onClick={()=>onNavigate('sportsbook')}/>
          <Quick icon={<Brain className="h-4 w-4"/>} label="Trivia" sub="Put your football IQ on the line" onClick={()=>onNavigate('challenges')}/>
        </div>
      </div>
    </section>

    {primaryLeague&&<section className="mt-3 rounded-2xl border border-white/10 bg-[#0b0e12]/95 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-600">Your Fantasy</div><div className="mt-1 truncate text-xl font-black uppercase">{primaryLeague.name}</div><div className="mt-1 text-[10px] font-bold uppercase text-zinc-600">{primaryLeague.members.length}/{primaryLeague.maxMembers} managers{myPick?` · Your pick #${myPick}`:''}</div></div>
        <span className="shrink-0 rounded-lg border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-2.5 py-1 text-[9px] font-black uppercase text-[var(--bk-team-accent)]">{primaryLeague.status}</span>
      </div>
      <button onClick={()=>onSelectLeague(primaryLeague,primaryLeague.status==='completed'?'simulation':'lobby')} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-white px-4 text-[10px] font-black uppercase tracking-wider text-black"><span>Open League</span><ArrowRight className="h-4 w-4"/></button>
    </section>}

    <section className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Action label="Create League" icon={<Plus className="h-4 w-4"/>} onClick={onOpenCreateLeague}/>
      <Action label="Join League" icon={<Users className="h-4 w-4"/>} onClick={onOpenJoinLeague}/>
      <Action label="Cheat Sheet" icon={<Trophy className="h-4 w-4"/>} onClick={()=>onNavigate('fantasy')}/>
      <Action label="Solo / Labs" icon={<ArrowRight className="h-4 w-4"/>} onClick={()=>onNavigate('solo')}/>
    </section>

    {!primaryLeague&&<section className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[.02] p-5 text-center"><div className="text-sm font-black uppercase">No fantasy league yet</div><p className="mt-1 text-xs text-zinc-600">Start with a real league, then use Trivia and Picks to build your Ball Knower Rating between matchups.</p><div className="mt-4 flex justify-center gap-2"><button onClick={onOpenCreateLeague} className="min-h-10 rounded-xl bg-[var(--bk-team-accent)] px-4 text-[10px] font-black uppercase text-black">Create</button><button onClick={onOpenJoinLeague} className="min-h-10 rounded-xl border border-white/10 px-4 text-[10px] font-black uppercase">Join</button></div></section>}
  </div>;
};

const Quick=({icon,label,sub,onClick}:{icon:React.ReactNode;label:string;sub:string;onClick:()=>void})=><button onClick={onClick} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/5 bg-white/[.025] px-3 text-left hover:border-[var(--bk-team-accent)]/25"><span className="text-[var(--bk-team-accent)]">{icon}</span><span className="min-w-0"><span className="block text-[11px] font-black uppercase">{label}</span><span className="block truncate text-[9px] font-bold text-zinc-600">{sub}</span></span><ArrowRight className="ml-auto h-3.5 w-3.5 text-zinc-700"/></button>;
const Action=({icon,label,onClick}:{icon:React.ReactNode;label:string;onClick:()=>void})=><button onClick={onClick} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0c0f13]/90 px-2 text-[9px] font-black uppercase tracking-wide text-zinc-300"><span className="text-[var(--bk-team-accent)]">{icon}</span>{label}</button>;
