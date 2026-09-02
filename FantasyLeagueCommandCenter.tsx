import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Archive, Bell, Check, ClipboardCheck,
  CalendarClock, Copy, Crown, Eye, History, Lock, Pause, Play, QrCode, RefreshCw, RotateCcw,
  Settings, Shield, Sparkles, Trophy, Unlock, UserMinus, UserPlus, Users,
} from 'lucide-react';
import { League } from './types';
import { useBallKnower } from './BallKnowerContext';
import {
  archiveSeasonResult, fetchLeagueEvents, fetchMyNotifications, fetchRosterRevisions,
  fetchSeasonArchive, LeagueEvent, LeagueNotification, markAllNotificationsRead, markNotificationRead,
  notifyLeagueMembers, regenerateLeagueInvite, RosterRevision, SeasonArchiveEntry,
  updateLeagueOperations,
} from './leagueCloud';
import { setMemberRosterStatus } from './leagueAdminCloud';
import { DraftOrderSetup } from './DraftOrderSetup';
import { getLeagueCommissionerName, isLeagueCommissioner } from './leaguePermissions';
import { formatDraftSchedule } from './draftSchedule';
import { resolveSeasonChampion } from './simulation';
import { FantasyNotificationPreferences } from './FantasyNotificationPreferences';

type Tab = 'overview'|'commissioner'|'activity'|'history'|'notifications'|'results';

interface Props {
  league: League;
  onGoToDraft: () => void;
  onGoToSimulation: () => void;
}

const PUBLIC_APP_ORIGIN = 'https://ballknower.com';

const relativeTime = (iso:string) => {
  const seconds=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/1000));
  if(seconds<60) return `${seconds}s ago`;
  if(seconds<3600) return `${Math.floor(seconds/60)}m ago`;
  if(seconds<86400) return `${Math.floor(seconds/3600)}h ago`;
  return `${Math.floor(seconds/86400)}d ago`;
};

export const FantasyLeagueCommandCenter: React.FC<Props> = ({league,onGoToDraft,onGoToSimulation}) => {
  const {
    currentUser, autoFillLeagueWithAi, removeMemberFromLeague, startSimulation,
    resetLeagueSimulation, updateSalaryCap, updateLeagueSettings, startLiveFantasyDraft, showToast,
  } = useBallKnower();
  const operational=league as League & {inviteEnabled?:boolean;paused?:boolean;rostersLocked?:boolean};
  const isCommissioner=isLeagueCommissioner(league,currentUser?.id);
  const myMember=league.members.find(m=>m.userId===currentUser?.id);
  const readyCount=league.members.filter(m=>m.status==='ready').length;
  const humanCount=league.members.filter(m=>!m.isAi).length;
  const cpuCount=league.members.length-humanCount;
  const openSlots=Math.max(0,league.maxMembers-league.members.length);
  const isPublicLeague=league.settings?.leagueType==='public_free';
  const allReady=league.members.length>=2 && readyCount===league.members.length;
  const [tab,setTab]=useState<Tab>(league.status==='completed'?'results':'overview');
  const [events,setEvents]=useState<LeagueEvent[]>([]);
  const [history,setHistory]=useState<SeasonArchiveEntry[]>([]);
  const [notifications,setNotifications]=useState<LeagueNotification[]>([]);
  const [revisions,setRevisions]=useState<RosterRevision[]>([]);
  const [auxError,setAuxError]=useState<string|null>(null);
  const auxRequestRef=useRef(0);
  const [busy,setBusy]=useState<string|null>(null);
  const [copied,setCopied]=useState(false);
  const [cap,setCap]=useState<number|string>(league.salaryCap);
  const [inviteCode,setInviteCode]=useState(league.code);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const liveDraftComplete=league.liveDraft?.status==='completed';
  const scheduledDraftLabel=formatDraftSchedule(league);

  useEffect(()=>setCap(league.salaryCap),[league.salaryCap]);
  useEffect(()=>setInviteCode(league.code),[league.id,league.code]);

  const refreshAux=async()=>{
    const requestId=++auxRequestRef.current;
    try{
      const [e,h,n,r]=await Promise.all([
        fetchLeagueEvents(league.id),fetchSeasonArchive(league.id),fetchMyNotifications(),fetchRosterRevisions(league.id),
      ]);
      if(requestId!==auxRequestRef.current)return;
      setEvents(e);setHistory(h);setNotifications(n.filter(x=>!x.leagueId||x.leagueId===league.id));setRevisions(r);setAuxError(null);
    }catch(err:any){
      if(requestId!==auxRequestRef.current)return;
      const message=err?.message||'League command data could not be refreshed.';
      console.warn('League command data refresh failed',message);
      setAuxError(message);
    }
  };
  useEffect(()=>{void refreshAux();},[league.id,league.members.length,league.status,readyCount]);

  // Never leak a protected Vercel preview hostname into customer invite links.
  const inviteUrl=`${PUBLIC_APP_ORIGIN}?join=${encodeURIComponent(inviteCode)}`;
  const unread=notifications.filter(n=>!n.readAt).length;
  const numericCap=typeof cap==='number'?cap:Number(cap);
  const capValid=Number.isFinite(numericCap)&&numericCap>0;
  const rosterTarget=league.liveDraft?.rounds||20;
  const preflight=useMemo(()=>league.members.map(member=>{
    const roster=member.roster||[];
    const spent=roster.reduce((sum,p)=>sum+(Number(p.salary)||0),0);
    const complete=roster.length===rosterTarget;
    // A snake draft is not a salary-cap roster build. Its 20 legal picks are
    // validated by draft position limits instead of the order-game cap.
    const capOk=liveDraftComplete||spent<=league.salaryCap;
    const ready=member.status==='ready';
    return {member,rosterCount:roster.length,spent,complete,capOk,ready,valid:complete&&capOk&&ready};
  }),[league.members,league.salaryCap,liveDraftComplete,rosterTarget]);
  const preflightPass=preflight.length>=2&&preflight.every(x=>x.valid)&&!operational.paused&&(!isPublicLeague||openSlots===0);

  const revisionCountByMember=useMemo(()=>revisions.reduce((acc:any,r)=>{acc[r.memberId]=(acc[r.memberId]||0)+1;return acc;},{}),[revisions]);
  const result=league.seasonResult;
  const orderOnlyComplete=league.status==='completed'&&(result?.orderMethod==='random'||result?.orderMethod==='commissioner');
  const champion=result?resolveSeasonChampion(result):undefined;
  const biggestUpset=useMemo(()=>{
    if(!result?.games?.length||!result.standings?.length) return null;
    const ratings=new Map<string,number>(result.standings.map(s=>[s.memberId,s.teamRating]));
    return result.games.map(g=>({g,margin:(ratings.get(g.loserId)||0)-(ratings.get(g.winnerId)||0)})).sort((a,b)=>b.margin-a.margin)[0];
  },[result]);

  const run=async(key:string,fn:()=>Promise<void>|void)=>{
    if(busy) return; setBusy(key);
    try{await fn();await refreshAux();}catch(err:any){showToast(err?.message||'League operation failed.');}
    finally{setBusy(null);}
  };

  const toggleControl=(key:'paused'|'rostersLocked'|'inviteEnabled',value:boolean)=>run(key,async()=>{
    await updateLeagueOperations(league.id,{[key]:value},currentUser?.name||league.commissionerName);
    showToast(`${key==='paused'?'League pause':key==='rostersLocked'?'Roster lock':'Invites'} ${value?'enabled':'disabled'}.`);
  });

  const copyInvite=async()=>{
    try{
      if(!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);showToast('Invite link copied.');setTimeout(()=>setCopied(false),1800);
    }catch{
      showToast(`Copy failed. Share this code manually: ${inviteCode}`);
    }
  };
  const shareInvite=async()=>{
    if(!navigator.share){await copyInvite();return;}
    try{
      await navigator.share({title:league.name,text:`Join my Ball Knower league: ${inviteCode}`,url:inviteUrl});
    }catch(err:any){
      if(err?.name!=='AbortError') await copyInvite();
    }
  };

  const launchSeason=()=>run('simulate',async()=>{
    if(!preflightPass) throw new Error('Pre-simulation review has blocking issues. Fix them before starting the season.');
    const started=await startSimulation(league.id);
    if(!started) throw new Error('The season could not start. Check every roster and try again.');
    if(liveDraftComplete){showToast('Week 1 is final. Open the fantasy league hub to continue.');return;}
    await notifyLeagueMembers(league,'Season simulation complete',`The ${league.settings?.seasonGames||17}-game season was launched. Open League HQ to see standings and draft order.`,'results');
    showToast('Season simulation launched. Results and draft order are ready.');
    onGoToSimulation();
  });

  const fillOpenSpots=()=>run('cpu-fill',async()=>{
    await autoFillLeagueWithAi(league.id);
  });

  const archiveAndReset=()=>run('reset',async()=>{
    if(league.seasonResult) await archiveSeasonResult(league);
    await resetLeagueSimulation(league.id);
    showToast('Season archived and league reopened for a new competition.');
    setTab('history');
  });

  const openFantasyDraft=async()=>{
    if(league.liveDraft){onGoToDraft();return;}
    const started=await startLiveFantasyDraft(league.id);
    if(started)onGoToDraft();
  };

  const tabs: {id:Tab;label:string;icon:React.ReactNode;show?:boolean}[]=[
    {id:'overview',label:'Overview',icon:<Shield className="h-4 w-4"/>},
    {id:'commissioner',label:'Commissioner',icon:<Crown className="h-4 w-4"/>,show:isCommissioner},
    {id:'activity',label:'Activity',icon:<Activity className="h-4 w-4"/>},
    {id:'history',label:'History',icon:<History className="h-4 w-4"/>},
    {id:'notifications',label:`Alerts${unread?` ${unread}`:''}`,icon:<Bell className="h-4 w-4"/>},
    {id:'results',label:'Results',icon:<Trophy className="h-4 w-4"/>,show:Boolean(result)},
  ];

  if(league.status==='drafting'&&league.settings?.draftOrderMethod!=='game'&&!league.liveDraft){
    return <DraftOrderSetup league={league} onGoToDraft={onGoToDraft} onGoToResults={onGoToSimulation}/>;
  }

  if(orderOnlyComplete&&result){
    return <LockedDraftOrderSummary league={league} isCommissioner={isCommissioner} onOpenDraft={()=>void openFantasyDraft()} onViewResults={onGoToSimulation}/>;
  }

  return <div className="min-h-[calc(100dvh-7rem)] bg-[#07090c] px-3 py-5 text-white sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-[#0b0e12] p-4 shadow-2xl sm:rounded-[1.75rem] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(212,175,55,.18),transparent_27%),linear-gradient(115deg,#090b0f,#12161d_55%,#08090c)]"/>
        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[.18em] text-[#D4AF37] sm:text-[10px] sm:tracking-[.22em]"><Crown className="h-3.5 w-3.5"/> League Command Center <span className="text-zinc-600">•</span> {isPublicLeague?'Public Free':'Private'} <span className="text-zinc-600">•</span> {inviteCode}</div><h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight sm:text-6xl">{league.name}</h1><p className="mt-1 text-xs font-semibold text-zinc-400 sm:mt-2 sm:text-sm">Commissioner {league.commissionerName} · {humanCount} human · {cpuCount} CPU · {league.members.length}/{league.maxMembers} teams</p></div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]"><Metric label="Ready" value={`${readyCount}/${league.members.length}`} good={allReady}/><Metric label={liveDraftComplete?'Format':'Cap'} value={liveDraftComplete?'PPR':`${league.salaryCap}M`}/><Metric label="Season" value={`${league.settings?.seasonGames||17} GAMES`}/></div>
        </div>
      </section>

      {auxError&&<div className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-black uppercase text-amber-300">League data refresh issue</div><div className="mt-1 text-[11px] text-zinc-400">{auxError} Previously loaded activity and history are still shown.</div></div><button onClick={()=>void refreshAux()} className="min-h-11 rounded-xl border border-amber-400/25 px-4 text-[10px] font-black uppercase text-amber-200">Retry</button></div>}

      {scheduledDraftLabel&&<section className="flex items-center gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[.06] p-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#D4AF37] text-black"><CalendarClock className="h-5 w-5"/></div><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-[#D4AF37]">Scheduled Fantasy Draft</div><div className="mt-1 text-sm font-black uppercase text-white">{scheduledDraftLabel}</div></div></section>}

      {isPublicLeague&&league.status==='drafting'&&openSlots>0&&<section className="flex flex-col gap-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/[.06] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300"><Users className="h-4 w-4"/>Real Public Matchmaking</div><p className="mt-1 text-xs font-semibold leading-5 text-zinc-400">{humanCount} real player{humanCount===1?' is':'s are'} here. Keep waiting for people or fill the remaining {openSlots} spot{openSlots===1?'':'s'} with clearly labeled CPU teams.</p></div>{isCommissioner?<button onClick={fillOpenSpots} disabled={busy!==null} className="min-h-12 shrink-0 rounded-xl bg-emerald-300 px-5 text-xs font-black uppercase text-[#07100c] disabled:opacity-50"><Sparkles className="mr-2 inline h-4 w-4"/>{busy==='cpu-fill'?'Filling Spots…':`Start Now · Add ${openSlots} CPU`}</button>:<div className="rounded-xl border border-white/10 px-4 py-3 text-center text-[10px] font-black uppercase text-zinc-400">Waiting for the league starter</div>}</section>}

      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-[#0d1015] p-2 sm:flex sm:gap-2 sm:overflow-x-auto">{tabs.filter(x=>x.show!==false).map(x=><button key={x.id} onClick={()=>setTab(x.id)} className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-[9px] font-black uppercase tracking-wide transition sm:min-h-11 sm:shrink-0 sm:gap-2 sm:px-4 sm:text-[11px] ${tab===x.id?'bg-[#D4AF37] text-black':'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>{x.icon}<span className="truncate">{x.label}</span></button>)}</div>

      {tab==='overview' && <div className="space-y-4">
        <section className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[.05] p-4"><div className="flex items-start gap-3"><Trophy className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]"/><div><div className="text-xs font-black uppercase text-[#D4AF37]">{liveDraftComplete?'League Draft Complete':'Draft Order Game'}</div><p className="mt-1 text-xs leading-5 text-zinc-300">{liveDraftComplete?`All ${league.liveDraft?.pickIndex||0} picks are locked and every ${rosterTarget}-player roster is saved. The commissioner can start the ${league.settings?.seasonGames||17}-game season now.`:`Each manager builds a legal 20-player roster under the same cap. When every roster is submitted, Ball Knower simulates ${league.settings?.seasonGames||17} games. Final results determine the official fantasy draft order, with the champion receiving Pick #1.`}</p></div></div></section>
        <div className="grid gap-4 lg:grid-cols-[.9fr_1.5fr]">
          <aside className="space-y-3"><PanelTitle icon={<ClipboardCheck className="h-4 w-4"/>} title="Ready to Start?" subtitle="Check league readiness and kick off the season."/><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="grid grid-cols-2 gap-2"><Metric label="Submitted" value={`${readyCount}/${league.members.length}`} good={allReady}/><Metric label="Valid" value={`${preflight.filter(x=>x.valid).length}/${preflight.length}`} good={preflightPass}/></div>{operational.paused&&<Warning text="League is paused."/>}{isPublicLeague&&openSlots>0&&<Warning text={`Fill ${openSlots} open league spot${openSlots===1?'':'s'} first.`}/>} {!allReady&&<Warning text={`${league.members.length-readyCount} manager(s) still need to submit a legal roster.`}/>}<button onClick={launchSeason} disabled={!isCommissioner||!preflightPass||busy==='simulate'} className="mt-3 min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase tracking-wider text-black disabled:opacity-35"><Play className="mr-2 inline h-4 w-4"/>Start {league.settings?.seasonGames||17}-Game Season</button><button onClick={onGoToDraft} disabled={!liveDraftComplete&&(Boolean(operational.paused)||Boolean(operational.rostersLocked&&myMember?.status!=='ready'))} className="mt-2 min-h-12 w-full rounded-xl border border-[#D4AF37]/35 px-4 text-xs font-black uppercase tracking-wider text-[#D4AF37] disabled:opacity-40">{liveDraftComplete?'View Completed Fantasy Draft':myMember?.status==='ready'?'View My Locked Roster':'Build My 20-Player Roster'}</button></div></aside>
          <section className="space-y-3"><PanelTitle icon={<Users className="h-4 w-4"/>} title="Owner Room" subtitle="One compact status card per manager"/><div className="grid grid-cols-2 gap-2">{league.members.map(member=>{const mine=member.userId===currentUser?.id;const roster=member.roster||[];const spent=roster.reduce((s,p)=>s+(Number(p.salary)||0),0);return <div key={member.id} className={`min-w-0 rounded-xl border p-3 ${mine?'border-[#D4AF37]/35 bg-[#D4AF37]/5':'border-white/10 bg-[#101318]'}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-xs font-black uppercase">{member.userName}</div><div className="mt-1 truncate text-[9px] font-semibold text-zinc-500">{roster.length}/{rosterTarget} · {liveDraftComplete?'Standard fantasy':`${spent.toFixed(1)}M`}{member.isAi?' · CPU':''}</div></div><Status ready={member.status==='ready'}/></div></div>})}</div></section>
        </div>
      </div>}

      {tab==='commissioner'&&isCommissioner&&<div className="space-y-5">
        <PanelTitle icon={<Crown className="h-4 w-4"/>} title="Commissioner Control Center" subtitle="Every high-impact action is visible and logged"/>
        <div className="grid gap-4 md:grid-cols-3"><ControlCard icon={operational.paused?<Play/>:<Pause/>} title={operational.paused?'Resume League':'Pause League'} body="Pause blocks roster submissions and season launch without deleting anything." onClick={()=>toggleControl('paused',!operational.paused)} active={Boolean(operational.paused)}/><ControlCard icon={operational.rostersLocked?<Unlock/>:<Lock/>} title={operational.rostersLocked?'Unlock Rosters':'Lock Rosters'} body="Freeze all new roster submissions league-wide." onClick={()=>toggleControl('rostersLocked',!operational.rostersLocked)} active={Boolean(operational.rostersLocked)}/><ControlCard icon={<UserPlus/>} title={operational.inviteEnabled===false?'Enable Invites':'Disable Invites'} body="Turn the current league code on or off instantly." onClick={()=>toggleControl('inviteEnabled',operational.inviteEnabled===false)} active={operational.inviteEnabled!==false}/></div>
        <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-white/10 bg-[#101318] p-5"><h3 className="font-black uppercase">Invite Management</h3><div className="mt-4 flex items-center gap-2 rounded-xl bg-black/40 p-3 font-mono text-sm font-black text-[#D4AF37]"><span className="flex-1 truncate">{inviteCode}</span><button onClick={copyInvite}><Copy className="h-4 w-4"/></button></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>void shareInvite()} className="min-h-11 rounded-xl border border-white/10 text-[10px] font-black uppercase">Share Link</button><button onClick={()=>run('invite',async()=>{const next=await regenerateLeagueInvite(league.id,currentUser?.name||league.commissionerName);setInviteCode(next);showToast(`New invite: ${next}`);})} className="min-h-11 rounded-xl bg-[#D4AF37] text-[10px] font-black uppercase text-black"><RefreshCw className="mr-1 inline h-3.5 w-3.5"/>Regenerate</button></div><div className="mt-4 flex items-center gap-4 rounded-xl border border-white/5 bg-black/25 p-3"><img alt="League invite QR code" className="h-24 w-24 rounded-lg bg-white p-1" src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteUrl)}`}/><div><div className="flex items-center gap-2 text-xs font-black uppercase"><QrCode className="h-4 w-4 text-[#D4AF37]"/>Mobile QR Invite</div><p className="mt-2 text-[11px] leading-relaxed text-zinc-500">Scan to open this league directly. Regenerating the code invalidates the old QR immediately.</p></div></div></section>
          <section className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="flex items-center justify-between"><h3 className="font-black uppercase">League Settings</h3><button onClick={()=>setSettingsOpen(!settingsOpen)}><Settings className="h-4 w-4 text-[#D4AF37]"/></button></div><div className="mt-4 space-y-3"><div className={`${liveDraftComplete?'hidden':'block'} text-[10px] font-black uppercase text-zinc-500`}>Salary Cap<div className="mt-1 flex gap-2"><input aria-label="Salary cap in millions" value={cap} onChange={e=>{const raw=e.target.value;setCap(raw===''?'':Number(raw));}} type="number" min={1} className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 text-white"/><button disabled={!capValid} onClick={()=>{if(!capValid)return;updateSalaryCap(league.id,numericCap);showToast(`Cap set to $${numericCap}M`);}} className="min-h-11 rounded-xl bg-[#D4AF37] px-4 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40">SAVE</button></div></div><div className="grid grid-cols-2 gap-2"><SettingSelect label="Season" value={String(league.settings?.seasonGames||17)} options={[['17','17 Games'],['16','16 Games']]} onChange={v=>updateLeagueSettings(league.id,{seasonGames:Number(v) as 16|17})}/><SettingSelect label="Sim Style" value={league.settings?.simulationStyle||'realistic'} options={[['realistic','Realistic'],['balanced','Balanced'],['chaos','Chaos']]} onChange={v=>updateLeagueSettings(league.id,{simulationStyle:v as any})}/><SettingSelect label="AI Difficulty" value={league.settings?.aiDifficulty||'all_pro'} options={[['pro','Pro'],['all_pro','All-Pro'],['all_madden','All-Madden']]} onChange={v=>updateLeagueSettings(league.id,{aiDifficulty:v as any})}/><SettingSelect label="Playoff Teams" value={String(league.settings?.playoffTeams||6)} options={[['4','4'],['6','6'],['8','8']]} onChange={v=>updateLeagueSettings(league.id,{playoffTeams:Number(v) as any})}/></div></div></section></div>
        <section className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black uppercase">Owner Administration</h3><p className="mt-1 text-xs text-zinc-500">Reopen preserves audit history. Force-ready only works with a complete roster.</p></div>{league.members.length<league.maxMembers&&<button onClick={fillOpenSpots} disabled={busy!==null} className="min-h-10 rounded-xl border border-[#D4AF37]/30 px-3 text-[10px] font-black uppercase text-[#D4AF37] disabled:opacity-50"><Sparkles className="mr-1 inline h-3.5 w-3.5"/>{busy==='cpu-fill'?'Filling…':'Fill Empty With CPU'}</button>}</div><div className="mt-4 space-y-2">{league.members.filter(m=>!m.isCommissioner).map(m=><div key={m.id} className="flex flex-col gap-3 rounded-xl bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-black uppercase">{m.userName}</div><div className="text-[10px] text-zinc-500">{m.isAi?'CPU TEAM · ':''}{(m.roster||[]).length}/{rosterTarget} · {m.status.toUpperCase()} · {revisionCountByMember[m.id]||0} revisions</div></div><div className="flex gap-2"><button onClick={()=>run(`status-${m.id}`,()=>setMemberRosterStatus(league.id,m.id,m.status==='ready'?'building':'ready',currentUser?.name||league.commissionerName))} className="min-h-10 flex-1 rounded-lg border border-white/10 px-3 text-[9px] font-black uppercase sm:flex-none">{m.status==='ready'?'Reopen Roster':'Force Ready'}</button><button onClick={()=>removeMemberFromLeague(league.id,m.id)} className="min-h-10 rounded-lg border border-red-500/25 px-3 text-red-400"><UserMinus className="h-4 w-4"/></button></div></div>)}</div></section>
      </div>}

      {tab==='activity'&&<section className="space-y-4"><PanelTitle icon={<Activity className="h-4 w-4"/>} title="League Activity Feed" subtitle="Permanent receipts for joins, submissions and commissioner actions"/><div className="rounded-2xl border border-white/10 bg-[#101318] p-3 sm:p-5">{events.length===0?<Empty text="No league activity has been recorded yet."/>:<div className="space-y-2">{events.map(e=><div key={e.id} className="flex gap-3 rounded-xl border border-white/5 bg-black/25 p-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D4AF37]"/><div className="min-w-0"><div className="text-xs font-bold text-zinc-200">{e.message}</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{e.actorName} · {e.eventType.replaceAll('_',' ')} · {relativeTime(e.createdAt)}</div></div></div>)}</div>}</div></section>}

      {tab==='history'&&<section className="space-y-4"><PanelTitle icon={<Archive className="h-4 w-4"/>} title="Season Archive" subtitle="Champions, standings and draft orders survive every reset"/>{result&&<div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Current Completed Season</div><div className="mt-1 text-xl font-black uppercase">{champion?.memberName||'Champion'} · {champion?.wins}-{champion?.losses}{champion?.ties?`-${champion.ties}`:''}</div>{isCommissioner&&<button onClick={archiveAndReset} className="mt-3 min-h-11 rounded-xl bg-[#D4AF37] px-4 text-[10px] font-black uppercase text-black"><Archive className="mr-1 inline h-4 w-4"/>Archive & Start New Season</button>}</div>}{history.length===0?<Empty text="Archived seasons will appear here after a completed league is reset."/>:<div className="grid gap-3 md:grid-cols-2">{history.map(h=>{const archivedChampion=resolveSeasonChampion(h.result);return <div key={h.id} className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Season {h.seasonNumber}</div><div className="mt-2 text-lg font-black uppercase">🏆 {archivedChampion?.memberName||'Champion'}</div><div className="mt-2 text-xs text-zinc-500">{h.settings?.seasonGames||17}-game season · {new Date(h.createdAt).toLocaleDateString()}</div><div className="mt-3 border-t border-white/5 pt-3 text-[11px] text-zinc-400">Draft order: {(h.result.draftOrder||[]).slice(0,3).map(x=>`#${x.pickNumber} ${x.memberName}`).join(' · ')}</div></div>})}</div>}</section>}

      {tab==='notifications'&&<section className="space-y-4"><div className="flex items-end justify-between gap-3"><PanelTitle icon={<Bell className="h-4 w-4"/>} title="League Notifications" subtitle="Submission reminders, ready alerts and results in one place"/>{unread>0&&<button type="button" disabled={busy!==null} onClick={()=>run('notifications-read',async()=>{await markAllNotificationsRead(league.id);})} className="min-h-10 shrink-0 rounded-xl border border-white/10 px-3 text-[9px] font-black uppercase text-zinc-300 disabled:opacity-50">Mark All Read</button>}</div><div className="rounded-2xl border border-white/10 bg-[#101318] p-3 sm:p-5">{notifications.length===0?<Empty text="No notifications for this league yet."/>:<div className="space-y-2">{notifications.map(n=><button key={n.id} onClick={()=>run(`notification-${n.id}`,async()=>{await markNotificationRead(n.id);})} className={`w-full rounded-xl border p-3 text-left ${n.readAt?'border-white/5 bg-black/20':'border-[#D4AF37]/25 bg-[#D4AF37]/5'}`}><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase">{n.title}</div><p className="mt-1 text-xs text-zinc-400">{n.body}</p></div>{!n.readAt&&<span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D4AF37]"/>}</div><div className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">{n.category} · {relativeTime(n.createdAt)}</div></button>)}</div>}<FantasyNotificationPreferences userId={currentUser?.id}/></div></section>}

      {tab==='results'&&result&&<section className="space-y-5"><PanelTitle icon={<Trophy className="h-4 w-4"/>} title="Season Results Studio" subtitle="Standings, power rankings, weekly receipts and the draft-order reveal"/><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5 md:col-span-2"><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#D4AF37]">{champion?'Ball Knower Champion':'Playoffs In Progress'}</div><div className="mt-2 text-3xl font-black uppercase">{champion?.memberName||'No champion crowned'}</div>{champion?<><div className="mt-1 text-sm font-bold text-zinc-400">{champion.wins}-{champion.losses}{champion.ties?`-${champion.ties}`:''} · {champion.pointsFor} PF</div><p className="mt-4 text-sm leading-relaxed text-zinc-300">{result.winnerAnalysis?.summary}</p></>:<p className="mt-3 text-sm text-zinc-400">The regular-season leader is not the champion. This card updates only after the championship game is final.</p>}</div><div className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Upset of the Year</div>{biggestUpset&&biggestUpset.margin>0?<><div className="mt-2 text-lg font-black uppercase">{result.standings.find(s=>s.memberId===biggestUpset.g.winnerId)?.memberName}</div><div className="mt-1 text-xs text-zinc-500">Beat a team rated {biggestUpset.margin} points higher · Week {biggestUpset.g.week}</div></>:<p className="mt-3 text-xs text-zinc-500">No rating upset topped the board this season.</p>}</div></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><h3 className="text-xs font-black uppercase text-[#D4AF37]">Power Rankings / Standings</h3><div className="mt-3 space-y-1">{result.standings.map(s=><div key={s.memberId} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-xs"><span className="font-mono font-black text-zinc-600">#{s.rank}</span><span className="truncate font-black uppercase">{s.memberName}</span><span className="font-mono text-zinc-400">{s.wins}-{s.losses}</span><span className="font-mono font-black text-[#D4AF37]">{s.teamRating}</span></div>)}</div></div><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><h3 className="text-xs font-black uppercase text-[#D4AF37]">Next Draft Order</h3><div className="mt-3 space-y-1">{result.draftOrder.map(d=><div key={d.memberId} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-xs"><span className="font-black uppercase"><span className="mr-2 text-[#D4AF37]">#{d.pickNumber}</span>{d.memberName}</span><span className="font-mono text-zinc-500">{d.record}</span></div>)}</div></div></div><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase text-[#D4AF37]">Weekly Schedule & Receipts</h3><button onClick={onGoToSimulation} className="text-[10px] font-black uppercase text-zinc-400">Full Breakdown →</button></div><div className="mt-3 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{result.games.map(g=><div key={g.id} className="rounded-lg bg-black/25 p-3 text-[11px]"><div className="text-[9px] font-black uppercase text-zinc-600">Week {g.week}</div><div className="mt-2 font-bold">{result.standings.find(s=>s.memberId===g.homeMemberId)?.memberName} <span className="float-right font-mono">{g.homeScore}</span></div><div className="mt-1 font-bold">{result.standings.find(s=>s.memberId===g.awayMemberId)?.memberName} <span className="float-right font-mono">{g.awayScore}</span></div><div className="mt-2 text-[9px] text-zinc-600">{g.keyMatchupFactor}</div></div>)}</div></div></section>}
    </div>
  </div>;
};

const Metric=({label,value,good}:{label:string;value:string;good?:boolean})=><div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</div><div className={`mt-1 text-xs font-black ${good?'text-emerald-400':'text-white'}`}>{value}</div></div>;
const Badge=({children}:{children:React.ReactNode})=><span className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-400">{children}</span>;
const Status=({ready}:{ready:boolean})=><span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${ready?'border-emerald-500/25 bg-emerald-500/10 text-emerald-400':'border-[#D4AF37]/20 bg-[#D4AF37]/5 text-[#D4AF37]'}`}>{ready?'Ready':'Building'}</span>;
const Warning=({text}:{text:string})=><div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] font-bold text-amber-300"><AlertTriangle className="h-3.5 w-3.5"/>{text}</div>;
const StateChip=({label,active,activeText,inactiveText}:{label:string;active:boolean;activeText:string;inactiveText:string})=><div className="rounded-lg bg-black/35 p-2 text-center"><div className="text-[8px] font-black uppercase text-zinc-600">{label}</div><div className={`mt-1 text-[9px] font-black ${active?'text-emerald-400':'text-amber-400'}`}>{active?activeText:inactiveText}</div></div>;
const PanelTitle=({icon,title,subtitle}:{icon:React.ReactNode;title:string;subtitle:string})=><div><div className="flex items-center gap-2 text-sm font-black uppercase"><span className="text-[#D4AF37]">{icon}</span>{title}</div><p className="mt-1 text-xs font-semibold text-zinc-500">{subtitle}</p></div>;
const Empty=({text}:{text:string})=><div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs font-semibold text-zinc-600">{text}</div>;
const ControlCard=({icon,title,body,onClick,active}:{icon:React.ReactNode;title:string;body:string;onClick:()=>void;active:boolean})=><button onClick={onClick} className={`rounded-2xl border p-5 text-left transition active:scale-[.99] ${active?'border-[#D4AF37]/30 bg-[#D4AF37]/5':'border-white/10 bg-[#101318]'}`}><div className="text-[#D4AF37]">{React.cloneElement(icon as React.ReactElement,{className:'h-5 w-5'})}</div><div className="mt-3 text-sm font-black uppercase">{title}</div><p className="mt-2 text-xs leading-relaxed text-zinc-500">{body}</p></button>;
const SettingSelect=({label,value,options,onChange}:{label:string;value:string;options:[string,string][];onChange:(v:string)=>void})=><label className="text-[9px] font-black uppercase text-zinc-500">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-2 text-xs font-bold text-white">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;

const LockedDraftOrderSummary=({league,isCommissioner,onOpenDraft,onViewResults}:{league:League;isCommissioner:boolean;onOpenDraft:()=>void;onViewResults:()=>void})=>{
  const {currentUser}=useBallKnower();
  const result=league.seasonResult!;
  const random=result.orderMethod==='random';
  return <div className="min-h-[calc(100dvh-7rem)] bg-[#07090c] px-3 py-3 text-white sm:px-6"><div className="mx-auto max-w-4xl">
    <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-[10px] font-black uppercase tracking-[.18em] text-[#D4AF37]">{league.name}</div><div className="mt-1 text-xs font-semibold text-zinc-500">{league.members.length}/{league.maxMembers} managers · {league.code}</div></div><div className="shrink-0 rounded-lg border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-2 text-[9px] font-black uppercase text-emerald-300">Order Locked</div></div>
    <section className="rounded-2xl border border-[#D4AF37]/30 bg-[radial-gradient(circle_at_85%_10%,rgba(212,175,55,.16),transparent_30%),#101318] p-4 sm:p-6">
      <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#D4AF37] text-black">{random?<Sparkles className="h-5 w-5"/>:<Crown className="h-5 w-5"/>}</div><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Official Fantasy Draft Order</div><h1 className="mt-1 font-display text-3xl font-black uppercase">{random?'Randomized & Locked':'Commissioner Order Locked'}</h1><p className="mt-2 text-xs leading-5 text-zinc-400">{random?'The one-time randomization is complete.':'Every draft slot has been assigned and locked.'} No draft-order-game roster or season simulation is required. The commissioner can start the real fantasy draft now.</p></div></div>
      {!league.liveDraft&&!isCommissioner&&<p className="mt-4 text-center text-[10px] font-bold text-zinc-500">Waiting for {getLeagueCommissionerName(league)} to start the NFL player draft.</p>}
      <button onClick={onOpenDraft} disabled={!league.liveDraft&&!isCommissioner} className="mt-2 min-h-14 w-full rounded-xl bg-[#D4AF37] text-sm font-black uppercase tracking-wider text-black disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-white/[.04] disabled:text-zinc-500"><Play className="mr-2 inline h-4 w-4"/>{league.liveDraft?'Open NFL Player Draft':isCommissioner?'Continue to NFL Player Draft':`Waiting for ${getLeagueCommissionerName(league)}`}</button>
      <button onClick={onViewResults} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300"><Trophy className="mr-2 inline h-4 w-4"/>View & Share Official Order</button>
      <div className="mt-4 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">{result.draftOrder.map(pick=>{const member=league.members.find(item=>item.id===pick.memberId);const mine=member?.userId===currentUser?.id;const role=mine?(member?.isCommissioner?'You · Commissioner':'You'):member?.isAi?'CPU':member?.isCommissioner?'Commissioner':'Manager';return <div key={pick.memberId} className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 ${pick.pickNumber===1?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/10 bg-black/30'}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black ${pick.pickNumber===1?'bg-[#D4AF37] text-black':'border border-white/10 bg-[#0A0A0A]'}`}>#{pick.pickNumber}</div><div className="min-w-0"><div className="truncate text-xs font-black uppercase">{pick.memberName}</div><div className="text-[9px] font-bold uppercase text-zinc-500">{role}</div></div></div>})}</div>
    </section>
  </div></div>;
};
