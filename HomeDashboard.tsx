import React,{useCallback,useEffect,useState} from 'react';
import {ArrowRight,Bell,Brain,ChevronDown,ClipboardList,FlaskConical,Plus,RefreshCcw,Target,Trophy,UserPlus,Users} from 'lucide-react';
import {useBallKnower} from './BallKnowerContext';
import {fetchProgressionProfile,ProgressProfile} from './progressionCloud';
import {fetchSeasonOperations} from './fantasySeasonCloud';
import {formatDraftSchedule} from './draftSchedule';
import {League} from './types';
import type {TeamTheme} from './teamTheme';
import type {AppTab} from './App';

interface HomeDashboardProps{
  onOpenCreateLeague:()=>void;
  onOpenJoinLeague:()=>void;
  onSelectLeague:(league:League,tab:'lobby'|'draft'|'simulation')=>void;
  onNavigate:(tab:AppTab)=>void;
  onOpenCheatSheet:()=>void;
  teamTheme:TeamTheme;
}

type HomeActivity={id:string;label:string;detail:string;occurredAt?:string};

const tierFor=(rating:number)=>rating>=90?'CERTIFIED':rating>=80?'ELITE':rating>=70?'KNOWER':rating>=60?'STUDENT':'ROOKIE';
const nextTierFor=(rating:number)=>rating<60?{name:'STUDENT',at:60}:rating<70?{name:'KNOWER',at:70}:rating<80?{name:'ELITE',at:80}:rating<90?{name:'CERTIFIED',at:90}:null;
const leagueDestination=(league:League):'lobby'|'draft'|'simulation'=>league.liveDraft?.status==='active'?'draft':league.status==='completed'?'simulation':'lobby';
const leagueAction=(league:League)=>league.liveDraft?.status==='active'?'Enter Draft':league.status==='completed'?'View Results':league.settings?.fantasySeasonStarted?'View Matchup':'Open League';
const formatActivityTime=(value?:string)=>{
  if(!value)return'';
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return'';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);
};

export const HomeDashboard:React.FC<HomeDashboardProps>=({onOpenCreateLeague,onOpenJoinLeague,onSelectLeague,onNavigate,onOpenCheatSheet,teamTheme})=>{
  const {leagues,activeLeague,currentUser,setActiveLeagueId}=useBallKnower();
  const [profile,setProfile]=useState<ProgressProfile|null>(null);
  const [ratingLoading,setRatingLoading]=useState(true);
  const [ratingError,setRatingError]=useState('');
  const [leagueMenuOpen,setLeagueMenuOpen]=useState(false);
  const [activity,setActivity]=useState<HomeActivity[]>([]);
  const [activityLoading,setActivityLoading]=useState(false);
  const [activityUnavailable,setActivityUnavailable]=useState(false);

  const loadProfile=useCallback(async()=>{
    setRatingLoading(true);setRatingError('');
    try{const data=await fetchProgressionProfile(currentUser?.name);setProfile(data.profile)}
    catch(e:any){setProfile(null);setRatingError(e?.message||'Could not verify your Ball Knower Rating.')}
    finally{setRatingLoading(false)}
  },[currentUser?.name]);

  useEffect(()=>{let live=true;setRatingLoading(true);setRatingError('');fetchProgressionProfile(currentUser?.name).then(data=>{if(live)setProfile(data.profile)}).catch((e:any)=>{if(live){setProfile(null);setRatingError(e?.message||'Could not verify your Ball Knower Rating.')}}).finally(()=>{if(live)setRatingLoading(false)});return()=>{live=false}},[currentUser?.id,currentUser?.name]);

  const primaryLeague=activeLeague||leagues.find(league=>league.status!=='completed')||leagues[0];
  const myMember=primaryLeague?.members.find(member=>member.userId===currentUser?.id);
  const liveDraftIndex=primaryLeague?.liveDraft?.orderMemberIds.indexOf(myMember?.id||'')??-1;
  const myPick=primaryLeague?.seasonResult?.draftOrder?.find(item=>item.memberId===myMember?.id)?.pickNumber??(liveDraftIndex>=0?liveDraftIndex+1:undefined);
  const rating=profile?.bkRating;
  const nextTier=nextTierFor(rating??0);
  const ratingProgress=rating==null?0:rating>=90?100:((rating%10)/10)*100;
  const scheduledDraft=primaryLeague?formatDraftSchedule(primaryLeague):null;
  const openPrimaryLeague=()=>primaryLeague?onSelectLeague(primaryLeague,leagueDestination(primaryLeague)):onNavigate('fantasy');

  useEffect(()=>{
    if(!primaryLeague){setActivity([]);setActivityUnavailable(false);return}
    let live=true;
    setActivityLoading(true);setActivityUnavailable(false);
    fetchSeasonOperations(primaryLeague.id).then(operations=>{
      if(!live)return;
      const rows:HomeActivity[]=[];
      if(scheduledDraft&&primaryLeague.liveDraft?.status!=='completed')rows.push({id:'draft-schedule',label:'Draft scheduled',detail:scheduledDraft,occurredAt:primaryLeague.settings?.draftScheduledAt});
      operations.transactions.slice(0,2).forEach(item=>rows.push({id:`transaction-${item.id}`,label:'League transaction',detail:item.summary,occurredAt:item.createdAt}));
      operations.messages.filter(item=>item.kind==='announcement'||item.kind==='receipt').slice(0,2).forEach(item=>rows.push({id:`message-${item.id}`,label:item.kind==='announcement'?'Commissioner update':'League receipt',detail:item.body,occurredAt:item.createdAt}));
      operations.claims.filter(item=>item.memberId===myMember?.id).slice(0,1).forEach(item=>rows.push({id:`claim-${item.id}`,label:'Waiver claim',detail:item.status==='pending'?'Your claim is pending.':`Claim ${item.status}.`,occurredAt:item.createdAt}));
      operations.trades.filter(item=>item.proposerMemberId===myMember?.id||item.recipientMemberId===myMember?.id).slice(0,1).forEach(item=>rows.push({id:`trade-${item.id}`,label:'Trade update',detail:`Your trade is ${item.status}.`,occurredAt:item.createdAt}));
      rows.sort((a,b)=>new Date(b.occurredAt||0).getTime()-new Date(a.occurredAt||0).getTime());
      setActivity(rows.slice(0,3));
    }).catch(()=>{if(live)setActivityUnavailable(true)}).finally(()=>{if(live)setActivityLoading(false)});
    return()=>{live=false};
  },[primaryLeague?.id,primaryLeague?.liveDraft?.status,primaryLeague?.settings?.draftScheduledAt,myMember?.id,scheduledDraft]);

  return <div className="bk-home-dashboard mx-auto max-w-5xl pb-5 pl-[max(.75rem,env(safe-area-inset-left))] pr-[max(.75rem,env(safe-area-inset-right))] pt-3 sm:pb-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-6">
    <section className="relative">
      <button onClick={()=>setLeagueMenuOpen(value=>!value)} aria-expanded={leagueMenuOpen} className="flex min-h-[70px] w-full items-center gap-3 rounded-2xl border border-[rgb(var(--bk-team-primary-rgb)/.42)] bg-[linear-gradient(105deg,rgb(var(--bk-team-primary-rgb)/.20),rgba(9,13,18,.94)_44%)] px-4 text-left shadow-[inset_0_1px_rgba(255,255,255,.06),0_18px_50px_rgba(0,0,0,.24)] sm:min-h-[78px] sm:px-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[rgb(var(--bk-team-primary-rgb)/.36)] bg-black/35 text-[#D9B43B]"><Trophy className="h-5 w-5"/></span>
        <span className="min-w-0 flex-1"><span className="block truncate font-display text-lg font-black uppercase tracking-[.04em] text-white sm:text-2xl">{primaryLeague?.name||'Choose a fantasy league'}</span><span className="mt-1 block truncate text-[8px] font-black uppercase tracking-[.18em] text-zinc-500 sm:text-[9px]">{teamTheme.abbr==='BK'?'Ball Knower theme':`${teamTheme.name} theme`} · {primaryLeague?'League home':'Create or join to begin'}</span></span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform ${leagueMenuOpen?'rotate-180':''}`}/>
      </button>
      {leagueMenuOpen&&<div className="absolute inset-x-0 top-[calc(100%+.5rem)] z-30 rounded-2xl border border-white/10 bg-[#0b0f14]/98 p-2 shadow-2xl backdrop-blur-xl"><div className="max-h-60 overflow-y-auto">{leagues.length?leagues.map(league=><button key={league.id} onClick={()=>{setActiveLeagueId(league.id);setLeagueMenuOpen(false)}} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left ${league.id===primaryLeague?.id?'bg-[#D9B43B]/10 text-[#E7C75A]':'text-zinc-300 hover:bg-white/5'}`}><span className="min-w-0 truncate text-xs font-black uppercase">{league.name}</span><span className="shrink-0 text-[9px] font-bold text-zinc-600">{league.code}</span></button>):<div className="p-4 text-center text-xs font-bold text-zinc-500">No fantasy leagues yet.</div>}</div><div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-2"><button onClick={()=>{setLeagueMenuOpen(false);onOpenCreateLeague()}} className="min-h-11 rounded-xl border border-white/10 text-[10px] font-black uppercase"><Plus className="mr-1 inline h-3.5 w-3.5 text-[#D9B43B]"/>Create</button><button onClick={()=>{setLeagueMenuOpen(false);onOpenJoinLeague()}} className="min-h-11 rounded-xl border border-white/10 text-[10px] font-black uppercase"><Users className="mr-1 inline h-3.5 w-3.5 text-[#D9B43B]"/>Join</button></div></div>}
    </section>

    <section className="mt-3 rounded-2xl border border-white/10 bg-[linear-gradient(115deg,rgba(18,23,30,.96),rgba(7,10,14,.92))] p-4 shadow-[inset_0_1px_rgba(255,255,255,.055),0_18px_50px_rgba(0,0,0,.22)] sm:p-5">
      {ratingLoading?<div className="flex min-h-20 items-center text-xs font-bold text-zinc-500">Verifying your Ball Knower Rating…</div>:ratingError?<div className="flex min-h-20 items-center justify-between gap-3"><div><div className="text-xs font-black uppercase text-red-300">Rating unavailable</div><p className="mt-1 text-[10px] text-zinc-600">Your last verified rating was not replaced.</p></div><button onClick={()=>void loadProfile()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Retry rating"><RefreshCcw className="h-4 w-4"/></button></div>:<div className="grid grid-cols-[auto_1fr] items-end gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div><div className="text-[8px] font-black uppercase tracking-[.2em] text-zinc-500">Ball Knower Rating</div><div className="mt-1 font-display text-6xl font-black leading-none text-white">{rating}</div></div>
        <div className="pb-1"><div className="font-display text-lg font-black uppercase tracking-wider text-[#D9B43B]">{tierFor(rating??0)}</div><div className="mt-2 flex max-w-56 gap-1.5" aria-label={`${ratingProgress}% progress to next tier`}><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#D9B43B]" style={{width:`${ratingProgress}%`}}/></span></div>{nextTier&&<div className="mt-2 text-[8px] font-black uppercase tracking-wider text-zinc-600">{nextTier.at-(rating??0)} rating points to {nextTier.name}</div>}</div>
        <button onClick={()=>onNavigate('locker')} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D9B43B]/25 bg-[#D9B43B]/5 px-4 text-[9px] font-black uppercase tracking-wider text-[#E7C75A] sm:col-span-1"><span>View Profile</span><ArrowRight className="h-3.5 w-3.5"/></button>
      </div>}
    </section>

    {primaryLeague?<section className="relative mt-3 overflow-hidden rounded-[1.4rem] border border-[rgb(var(--bk-team-primary-rgb)/.55)] bg-[#071014] p-5 shadow-[inset_0_1px_rgba(255,255,255,.06),0_24px_70px_rgba(0,0,0,.34)] sm:p-7"><div aria-hidden="true" className="absolute inset-0 opacity-90" style={{background:`radial-gradient(circle at 88% 20%,${teamTheme.primary}66,transparent 35%),linear-gradient(120deg,rgba(4,9,12,.98),${teamTheme.primary}33 58%,rgba(3,7,10,.96))`}}/><div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-36 opacity-35 [background:repeating-linear-gradient(90deg,transparent_0_10%,rgba(255,255,255,.07)_10.2%_10.4%,transparent_10.6%_20%),linear-gradient(180deg,transparent,rgba(0,0,0,.72))]"/><div className="relative"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.22em] text-[#E7C75A]"><Trophy className="h-4 w-4"/>Continue your league</div><span className="rounded-lg border border-[#D9B43B]/35 bg-black/35 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-[#E7C75A]">{primaryLeague.liveDraft?.status==='active'?'Live Draft':primaryLeague.settings?.fantasySeasonStarted?`Week ${primaryLeague.settings.currentWeek||1}`:primaryLeague.status}</span></div><h2 className="mt-5 max-w-3xl truncate font-display text-4xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl">{primaryLeague.name}</h2><div className="mt-4 text-[10px] font-black uppercase tracking-[.12em] text-zinc-400">{primaryLeague.members.length}/{primaryLeague.maxMembers} managers{myPick?` · Your pick #${myPick}`:''}</div>{scheduledDraft&&primaryLeague.liveDraft?.status!=='completed'&&<div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Draft · {scheduledDraft}</div>}<button onClick={openPrimaryLeague} className="mt-6 flex min-h-14 w-full items-center justify-between rounded-xl bg-[#D9B43B] px-5 font-display text-lg font-black uppercase tracking-[.08em] text-[#07090D] shadow-[0_14px_35px_rgba(217,180,59,.22)] sm:max-w-sm"><span>{leagueAction(primaryLeague)}</span><ArrowRight className="h-5 w-5"/></button></div></section>:<section className="mt-3 rounded-[1.4rem] border border-dashed border-white/15 bg-black/35 p-6 text-center"><div className="font-display text-2xl font-black uppercase">Build your first league</div><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500">Create a league or join with an invite code. Your most important league action will always appear here.</p><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={onOpenCreateLeague} className="min-h-12 rounded-xl bg-[#D9B43B] text-[10px] font-black uppercase text-black">Create League</button><button onClick={onOpenJoinLeague} className="min-h-12 rounded-xl border border-white/10 text-[10px] font-black uppercase">Join League</button></div></section>}

    {primaryLeague&&<section className="mt-3 rounded-2xl border border-white/10 bg-[#0b0f14]/92 p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgb(var(--bk-team-primary-rgb)/.42)] bg-[rgb(var(--bk-team-primary-rgb)/.13)] text-[#D9B43B]"><Bell className="h-4 w-4"/></span><div className="min-w-0 flex-1"><div className="text-[8px] font-black uppercase tracking-[.22em] text-zinc-500">League Activity</div><div className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#E7C75A]">{activityLoading?'Checking updates…':activity.length?`${activity.length} recent update${activity.length===1?'':'s'}`:activityUnavailable?'Updates unavailable':'You’re all caught up'}</div></div><button onClick={openPrimaryLeague} aria-label="Open league activity" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-500"><ArrowRight className="h-4 w-4"/></button></div>{activity.length>0&&<div className="mt-3 space-y-2 border-t border-white/5 pt-3">{activity.map(item=><div key={item.id} className="flex min-w-0 items-start justify-between gap-3 text-[10px]"><div className="min-w-0"><span className="font-black uppercase text-zinc-300">{item.label}</span><span className="ml-2 text-zinc-500">{item.detail}</span></div>{item.occurredAt&&<span className="shrink-0 text-[8px] font-bold uppercase text-zinc-700">{formatActivityTime(item.occurredAt)}</span>}</div>)}</div>}</section>}

    <section aria-label="Primary destinations" className="mt-3 grid grid-cols-3 gap-2"><ModeCard icon={<Trophy/>} label="Fantasy" onClick={()=>onNavigate('fantasy')}/><ModeCard icon={<Target/>} label="Picks" onClick={()=>onNavigate('sportsbook')}/><ModeCard icon={<Brain/>} label="Trivia" onClick={()=>onNavigate('challenges')}/></section>

    <section className="mt-4"><div className="mb-2 px-1 text-[8px] font-black uppercase tracking-[.22em] text-zinc-600">Quick Links</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Action label="Create League" icon={<Plus/>} onClick={onOpenCreateLeague}/><Action label="Join League" icon={<UserPlus/>} onClick={onOpenJoinLeague}/><Action label="Cheat Sheet" icon={<ClipboardList/>} onClick={onOpenCheatSheet}/><Action label="Solo Mode" icon={<FlaskConical/>} onClick={()=>onNavigate('solo')}/></div></section>
  </div>;
};

const ModeCard=({icon,label,onClick}:{icon:React.ReactNode;label:string;onClick:()=>void})=><button onClick={onClick} className="group flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[linear-gradient(150deg,rgba(18,23,30,.94),rgba(7,10,14,.92))] px-2 text-center shadow-[inset_0_1px_rgba(255,255,255,.05)] active:scale-[.98]"><span className="grid h-9 w-9 place-items-center rounded-full border border-[#D9B43B]/25 bg-black/35 text-[#D9B43B] [&>svg]:h-4 [&>svg]:w-4">{icon}</span><span className="font-display text-sm font-black uppercase tracking-wider text-white sm:text-base">{label}</span></button>;
const Action=({icon,label,onClick}:{icon:React.ReactNode;label:string;onClick:()=>void})=><button onClick={onClick} className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-[#0b0f14]/90 px-3 text-left text-[9px] font-black uppercase tracking-wide text-zinc-300"><span className="text-[#D9B43B] [&>svg]:h-4 [&>svg]:w-4">{icon}</span><span>{label}</span></button>;
