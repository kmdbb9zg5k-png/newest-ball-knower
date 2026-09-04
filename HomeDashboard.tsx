import React,{useCallback,useEffect,useState} from 'react';
import {ArrowRight,Bell,Brain,ChevronDown,ClipboardList,Flag,FlaskConical,Newspaper,Plus,RefreshCcw,Target,Trophy,UserPlus,Users} from 'lucide-react';
import {useBallKnower} from './BallKnowerContext';
import type {ProgressProfile} from './progressionCloud';
import {formatDraftSchedule} from './draftSchedule';
import {League} from './types';
import type {TeamTheme} from './teamTheme';
import type {AppTab} from './App';
import {PartnerCard} from './PartnerCard';
import {homePartners} from './partners';

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
    try{
      const {fetchProgressionProfile}=await import('./progressionCloud');
      const data=await fetchProgressionProfile(currentUser?.name);
      setProfile(data.profile);
    }
    catch(e:any){setProfile(null);setRatingError(e?.message||'Could not verify your Ball Knower Rating.')}
    finally{setRatingLoading(false)}
  },[currentUser?.name]);

  useEffect(()=>{
    let live=true;
    setRatingLoading(true);setRatingError('');
    void import('./progressionCloud')
      .then(({fetchProgressionProfile})=>fetchProgressionProfile(currentUser?.name))
      .then(data=>{if(live)setProfile(data.profile)})
      .catch((e:any)=>{if(live){setProfile(null);setRatingError(e?.message||'Could not verify your Ball Knower Rating.')}})
      .finally(()=>{if(live)setRatingLoading(false)});
    return()=>{live=false};
  },[currentUser?.id,currentUser?.name]);

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
    void import('./fantasySeasonCloud')
      .then(({fetchSeasonOperations})=>fetchSeasonOperations(primaryLeague.id))
      .then(operations=>{
      if(!live)return;
      const rows:HomeActivity[]=[];
      if(scheduledDraft&&primaryLeague.liveDraft?.status!=='completed')rows.push({id:'draft-schedule',label:'Draft scheduled',detail:scheduledDraft,occurredAt:primaryLeague.settings?.draftScheduledAt});
      operations.transactions.slice(0,2).forEach(item=>rows.push({id:`transaction-${item.id}`,label:'League transaction',detail:item.summary,occurredAt:item.createdAt}));
      operations.messages.filter(item=>item.kind==='announcement'||item.kind==='receipt').slice(0,2).forEach(item=>rows.push({id:`message-${item.id}`,label:item.kind==='announcement'?'Commissioner update':'League receipt',detail:item.body,occurredAt:item.createdAt}));
      operations.claims.filter(item=>item.memberId===myMember?.id).slice(0,1).forEach(item=>rows.push({id:`claim-${item.id}`,label:'Waiver claim',detail:item.status==='pending'?'Your claim is pending.':`Claim ${item.status}.`,occurredAt:item.createdAt}));
      operations.trades.filter(item=>item.proposerMemberId===myMember?.id||item.recipientMemberId===myMember?.id).slice(0,1).forEach(item=>rows.push({id:`trade-${item.id}`,label:'Trade update',detail:`Your trade is ${item.status}.`,occurredAt:item.createdAt}));
      rows.sort((a,b)=>new Date(b.occurredAt||0).getTime()-new Date(a.occurredAt||0).getTime());
      setActivity(rows.slice(0,2));
    }).catch(()=>{if(live)setActivityUnavailable(true)}).finally(()=>{if(live)setActivityLoading(false)});
    return()=>{live=false};
  },[primaryLeague?.id,primaryLeague?.liveDraft?.status,primaryLeague?.settings?.draftScheduledAt,myMember?.id,scheduledDraft]);

  return <div className="bk-home-dashboard mx-auto max-w-5xl pb-5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 sm:pb-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-6">
    <section className="relative">
      <button onClick={()=>setLeagueMenuOpen(value=>!value)} aria-expanded={leagueMenuOpen} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-[rgb(var(--bk-team-primary-rgb)/.46)] bg-[linear-gradient(105deg,rgb(var(--bk-team-primary-rgb)/.22),rgba(7,11,16,.95)_44%)] px-3.5 text-left shadow-[inset_0_1px_rgba(255,255,255,.07),0_15px_45px_rgba(0,0,0,.26)] sm:min-h-[72px] sm:px-5">
        <LeagueCrest compact/>
        <span className="min-w-0 flex-1"><span className="block truncate font-display text-[20px] font-black uppercase leading-none tracking-[.04em] text-white sm:text-2xl">{primaryLeague?.name||'Choose a fantasy league'}</span><span className="mt-1.5 block truncate text-[7px] font-black uppercase tracking-[.2em] text-zinc-500 sm:text-[9px]">{teamTheme.abbr==='BK'?'Ball Knower theme':`${teamTheme.name} theme`} · {primaryLeague?'League home':'Create or join to begin'}</span></span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform ${leagueMenuOpen?'rotate-180':''}`}/>
      </button>
      {leagueMenuOpen&&<div className="absolute inset-x-0 top-[calc(100%+.5rem)] z-30 rounded-2xl border border-white/10 bg-[#0b0f14]/98 p-2 shadow-2xl backdrop-blur-xl"><div className="max-h-60 overflow-y-auto">{leagues.length?leagues.map(league=><button key={league.id} onClick={()=>{setActiveLeagueId(league.id);setLeagueMenuOpen(false)}} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left ${league.id===primaryLeague?.id?'bg-[#D9B43B]/10 text-[#E7C75A]':'text-zinc-300 hover:bg-white/5'}`}><span className="min-w-0 truncate text-xs font-black uppercase">{league.name}</span><span className="shrink-0 text-[9px] font-bold text-zinc-600">{league.code}</span></button>):<div className="p-4 text-center text-xs font-bold text-zinc-500">No fantasy leagues yet.</div>}</div><div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-2"><button onClick={()=>{setLeagueMenuOpen(false);onOpenCreateLeague()}} className="min-h-11 rounded-xl border border-white/10 text-[10px] font-black uppercase"><Plus className="mr-1 inline h-3.5 w-3.5 text-[#D9B43B]"/>Create</button><button onClick={()=>{setLeagueMenuOpen(false);onOpenJoinLeague()}} className="min-h-11 rounded-xl border border-white/10 text-[10px] font-black uppercase"><Users className="mr-1 inline h-3.5 w-3.5 text-[#D9B43B]"/>Join</button></div></div>}
    </section>

    <section className="mt-3 rounded-2xl border border-white/10 bg-[linear-gradient(110deg,rgba(14,19,26,.97),rgba(6,9,14,.94))] px-4 py-3.5 shadow-[inset_0_1px_rgba(255,255,255,.055),0_16px_45px_rgba(0,0,0,.22)] sm:px-5">
      {ratingLoading?<div className="flex min-h-[74px] items-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">Verifying your Ball Knower Rating…</div>:ratingError?<div className="flex min-h-[74px] items-center justify-between gap-3"><div><div className="text-xs font-black uppercase text-red-300">Rating unavailable</div><p className="mt-1 text-[9px] text-zinc-600">Your last verified rating was not replaced.</p></div><button onClick={()=>void loadProfile()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Retry rating"><RefreshCcw className="h-4 w-4"/></button></div>:<div className="grid min-h-[74px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-5">
        <div><div className="whitespace-nowrap text-[7px] font-black uppercase tracking-[.17em] text-zinc-500 sm:text-[8px]">Ball Knower Rating</div><div className="mt-1 font-display text-[52px] font-black leading-[.8] text-white sm:text-6xl">{rating}</div></div>
        <div className="min-w-0"><div className="font-display text-lg font-black uppercase tracking-wider text-[#D9B43B]">{tierFor(rating??0)}</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-label={`${ratingProgress}% progress to next tier`}><span className="block h-full rounded-full bg-[#D9B43B]" style={{width:`${ratingProgress}%`}}/></div>{nextTier&&<div className="mt-1.5 truncate text-[7px] font-black uppercase tracking-wider text-zinc-600">{nextTier.at-(rating??0)} rating points to {nextTier.name}</div>}</div>
        <button onClick={()=>onNavigate('locker')} className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#D9B43B]/25 bg-[#D9B43B]/5 px-3 text-[8px] font-black uppercase tracking-wider text-[#E7C75A] sm:px-4 sm:text-[9px]"><span className="hidden min-[360px]:inline">View Profile</span><ArrowRight className="h-3.5 w-3.5"/></button>
      </div>}
    </section>

    <section className="relative mt-3 min-h-[258px] overflow-hidden rounded-[1.4rem] border border-[rgb(var(--bk-team-primary-rgb)/.60)] bg-[#071014] p-5 shadow-[inset_0_1px_rgba(255,255,255,.08),0_24px_70px_rgba(0,0,0,.38)] sm:p-7">
      <div aria-hidden="true" className="absolute inset-0 opacity-95" style={{background:`radial-gradient(circle at 86% 18%,${teamTheme.primary}7A,transparent 34%),linear-gradient(120deg,rgba(3,8,12,.98),${teamTheme.primary}3D 58%,rgba(2,6,9,.98))`}}/>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[55%] opacity-55 [background:repeating-linear-gradient(90deg,transparent_0_10%,rgba(255,255,255,.08)_10.2%_10.45%,transparent_10.7%_20%),linear-gradient(180deg,transparent,rgba(0,0,0,.76))]"/>
      <div aria-hidden="true" className="absolute -left-8 top-10 h-20 w-20 rounded-full bg-white/10 blur-2xl"/><div aria-hidden="true" className="absolute right-4 top-14 h-24 w-24 rounded-full bg-white/10 blur-2xl"/>
      {primaryLeague?<div className="relative flex min-h-[218px] flex-col"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.22em] text-[#E7C75A]"><Flag className="h-4 w-4"/>Continue your league</div><span className="rounded-lg border border-[#D9B43B]/40 bg-black/40 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-[#E7C75A]">{primaryLeague.liveDraft?.status==='active'?'Drafting':primaryLeague.settings?.fantasySeasonStarted?`Week ${primaryLeague.settings.currentWeek||1}`:primaryLeague.status}</span></div><div className="mt-5 flex min-w-0 items-center justify-between gap-4"><div className="min-w-0"><h2 className="truncate font-display text-[40px] font-black uppercase leading-[.9] tracking-tight text-white sm:text-6xl">{primaryLeague.name}</h2><div className="mt-4 text-[9px] font-black uppercase tracking-[.14em] text-zinc-400 sm:text-[10px]">{primaryLeague.members.length}/{primaryLeague.maxMembers} managers{myPick?` · Your pick #${myPick}`:''}</div>{scheduledDraft&&primaryLeague.liveDraft?.status!=='completed'&&<div className="mt-2 truncate text-[8px] font-bold uppercase tracking-wider text-zinc-500">Draft · {scheduledDraft}</div>}</div><LeagueCrest hero/></div><button onClick={openPrimaryLeague} className="mt-auto flex min-h-14 w-full items-center justify-center gap-4 rounded-xl bg-[linear-gradient(100deg,#D6A92F,#F0C94E)] px-5 font-display text-xl font-black uppercase tracking-[.1em] text-[#07090D] shadow-[0_14px_35px_rgba(217,180,59,.24)]"><span>{leagueAction(primaryLeague)}</span><ArrowRight className="h-5 w-5"/></button></div>:<div className="relative flex min-h-[218px] flex-col items-center justify-center text-center"><LeagueCrest hero/><h2 className="mt-3 font-display text-3xl font-black uppercase tracking-wide text-white">Build your first league</h2><p className="mt-2 max-w-md text-[10px] leading-5 text-zinc-400">Create a league or join with an invite code. Your most important league action will appear here.</p><div className="mt-5 grid w-full grid-cols-2 gap-2"><button onClick={onOpenCreateLeague} className="min-h-12 rounded-xl bg-[#D9B43B] text-[10px] font-black uppercase text-black">Create League</button><button onClick={onOpenJoinLeague} className="min-h-12 rounded-xl border border-white/15 bg-black/25 text-[10px] font-black uppercase">Join League</button></div></div>}
    </section>

    <section className="mt-3 rounded-2xl border border-white/10 bg-[#0b0f14]/94 px-4 py-3.5 shadow-[inset_0_1px_rgba(255,255,255,.045)]"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgb(var(--bk-team-primary-rgb)/.42)] bg-[rgb(var(--bk-team-primary-rgb)/.13)] text-[#D9B43B]"><Bell className="h-4 w-4"/></span><div className="min-w-0 flex-1"><div className="text-[8px] font-black uppercase tracking-[.22em] text-[rgb(var(--bk-team-secondary-rgb)/.72)]">League Activity</div><div className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#E7C75A]">{!primaryLeague?'Choose a league to see updates':activityLoading?'Checking updates…':activity.length?`${activity.length} recent update${activity.length===1?'':'s'}`:activityUnavailable?'Updates unavailable':'You’re all caught up'}</div></div>{primaryLeague&&<button onClick={openPrimaryLeague} aria-label="Open league activity" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-500"><ArrowRight className="h-4 w-4"/></button>}</div>{primaryLeague&&activity.length>0&&<div className="mt-3 space-y-2 border-t border-white/5 pt-3">{activity.map(item=><div key={item.id} className="flex min-w-0 items-start justify-between gap-3 text-[9px]"><div className="min-w-0 truncate"><span className="font-black uppercase text-zinc-300">{item.label}</span><span className="ml-2 text-zinc-500">{item.detail}</span></div>{item.occurredAt&&<span className="shrink-0 text-[7px] font-bold uppercase text-zinc-700">{formatActivityTime(item.occurredAt)}</span>}</div>)}</div>}</section>

    <section aria-label="Primary destinations" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><ModeCard icon={<Trophy/>} label="Fantasy" onClick={()=>onNavigate('fantasy')}/><ModeCard icon={<Target/>} label="Picks" onClick={()=>onNavigate('sportsbook')}/><ModeCard icon={<Brain/>} label="Trivia" onClick={()=>onNavigate('challenges')}/><ModeCard icon={<Newspaper/>} label="NFL News" onClick={()=>onNavigate('news')}/></section>

    <section className="mt-4"><div className="mb-2 px-1 text-[8px] font-black uppercase tracking-[.22em] text-[rgb(var(--bk-team-secondary-rgb)/.62)]">Quick Links</div><div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14]/94"><Action label="Create League" icon={<Plus/>} onClick={onOpenCreateLeague}/><Action label="Join League" icon={<UserPlus/>} onClick={onOpenJoinLeague}/><Action label="Cheat Sheet" icon={<ClipboardList/>} onClick={onOpenCheatSheet}/><Action label="Solo Mode" icon={<FlaskConical/>} onClick={()=>onNavigate('solo')}/></div></section>

    {homePartners.length>0&&<section aria-labelledby="home-partners-heading" className="mt-5 border-t border-white/10 pt-4"><div id="home-partners-heading" className="mb-2 px-1 text-[8px] font-black uppercase tracking-[.22em] text-[rgb(var(--bk-team-secondary-rgb)/.62)]">Our Partners</div><div className="space-y-2">{homePartners.map(partner=><PartnerCard key={partner.name} partner={partner} compact/>)}</div>{homePartners.length>1&&<button onClick={()=>onNavigate('partners')} className="mt-1 min-h-10 w-full text-center text-[9px] font-black uppercase tracking-[.16em] text-zinc-500 hover:text-[#E7C75A]">View All Partners</button>}</section>}
  </div>;
};

const LeagueCrest=({compact=false,hero=false}:{compact?:boolean;hero?:boolean})=><span aria-hidden="true" className={`relative grid shrink-0 rotate-45 place-items-center border border-[rgb(var(--bk-team-primary-rgb)/.46)] bg-[linear-gradient(145deg,rgba(3,8,12,.96),rgb(var(--bk-team-primary-rgb)/.18))] shadow-[inset_0_1px_rgba(255,255,255,.08),0_10px_25px_rgba(0,0,0,.30)] ${hero?'h-16 w-16 sm:h-20 sm:w-20':compact?'h-11 w-11 rounded-xl':'h-12 w-12 rounded-xl'}`}><Trophy className={`-rotate-45 text-[#D9B43B] ${hero?'h-7 w-7':'h-5 w-5'}`}/></span>;
const ModeCard=({icon,label,onClick}:{icon:React.ReactNode;label:string;onClick:()=>void})=><button onClick={onClick} className="group flex min-h-[94px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[linear-gradient(150deg,rgba(18,23,30,.96),rgba(7,10,14,.94))] px-2 text-center shadow-[inset_0_1px_rgba(255,255,255,.055)] active:scale-[.98]"><span className="grid h-10 w-10 place-items-center rounded-full border border-[#D9B43B]/35 bg-black/40 text-[#D9B43B] [&>svg]:h-4 [&>svg]:w-4">{icon}</span><span className="font-display text-sm font-black uppercase tracking-wider text-white sm:text-base">{label}</span><span className="h-0.5 w-7 rounded-full bg-[#D9B43B]"/></button>;
const Action=({icon,label,onClick}:{icon:React.ReactNode;label:string;onClick:()=>void})=><button onClick={onClick} className="flex min-h-[70px] min-w-0 overflow-hidden flex-col items-center justify-center gap-1.5 border-r border-white/10 px-1 text-center text-[7px] font-black uppercase tracking-normal text-zinc-300 last:border-r-0 min-[390px]:text-[8px] sm:min-h-[76px] sm:text-[9px]"><span className="shrink-0 text-[#D9B43B] [&>svg]:h-5 [&>svg]:w-5">{icon}</span><span className="block max-w-full break-words leading-[1.05]">{label}</span></button>;
