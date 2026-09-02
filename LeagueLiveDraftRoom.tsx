import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Ban, CheckCircle2, ChevronDown, ChevronUp, Clock3, ListPlus, LoaderCircle, MessageCircle, Play, Search, Send, Star, Trophy, X } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { playerPortraitFallbackUrl, playerPortraitUrl } from './playerPortraits';
import { PLAYERS_DATABASE } from './players';
import { CPU_LIVE_FANTASY_POSITION_LIMITS, getLiveFantasyDraftGroup, LIVE_FANTASY_ROSTER_REQUIREMENTS, LiveFantasyDraftGroup } from './liveFantasyRules';
import { FantasyRanking, loadFantasyRankings } from './fantasyRankingsCloud';
import { displayLeagueMemberName, resolveMyLeagueMember } from './leagueMemberDisplay';
import { LiveFantasyDraft, Player } from './types';
import { DraftPreferences, loadMyCloudDraftPreferences, saveMyCloudDraftPreferences } from './leagueCloud';
import { fetchSeasonOperations, LeagueMessage, postLeagueMessage } from './fantasySeasonCloud';
import { ModalPortal } from './ModalPortal';

type Props={onBackToLobby:()=>void};
type DraftGroup=LiveFantasyDraftGroup;
const GROUPS=Object.keys(LIVE_FANTASY_ROSTER_REQUIREMENTS) as DraftGroup[];
const GROUP_LABELS:Record<DraftGroup,string>={QB:'QB',RB:'RB',WR:'WR',TE:'TE',K:'K',DST:'D/ST'};
const CPU_POSITION_TARGETS:Record<DraftGroup,number>={QB:2,RB:5,WR:7,TE:2,K:2,DST:2};
const CPU_DEPTH_PENALTY:Record<DraftGroup,number>={QB:72,RB:18,WR:14,TE:48,K:120,DST:110};
const PLAYER_BY_ID=new Map(PLAYERS_DATABASE.map(player=>[player.id,player]));
const rankingKey=(name:string,team:string)=>`${name.toLowerCase().replace(/[^a-z0-9]/g,'')}|${team.toUpperCase()}`;
const EMPTY_PREFERENCES:DraftPreferences={queue:[],favorites:[],doNotDraft:[],preRankings:[]};

const memberAtPick=(draft:LiveFantasyDraft)=>{
  const teamCount=draft.orderMemberIds.length;
  if(!teamCount||draft.pickIndex>=teamCount*draft.rounds)return null;
  const round=Math.floor(draft.pickIndex/teamCount);
  const slot=draft.pickIndex%teamCount;
  return draft.orderMemberIds[round%2===0?slot:teamCount-1-slot]||null;
};

const countsFor=(draft:LiveFantasyDraft,memberId:string)=>draft.picks.reduce<Partial<Record<DraftGroup,number>>>((counts,pick)=>{
  if(pick.memberId===memberId)counts[pick.group]=(counts[pick.group]||0)+1;
  return counts;
},{});

export const legalPlayersFor=(draft:LiveFantasyDraft,memberId:string,enforceCpuLimits=false)=>{
  const drafted=new Set(draft.picks.map(pick=>pick.playerId));
  const counts=countsFor(draft,memberId);
  return PLAYERS_DATABASE.filter(player=>{
    if(drafted.has(player.id))return false;
    const group=getLiveFantasyDraftGroup(player);
    if(!group)return false;
    if(enforceCpuLimits&&(counts[group]||0)>=CPU_LIVE_FANTASY_POSITION_LIMITS[group])return false;
    return true;
  });
};

const cpuSelection=(draft:LiveFantasyDraft,memberId:string,rankings:Map<string,FantasyRanking>)=>{
  const counts=countsFor(draft,memberId);
  const picked=draft.picks.filter(pick=>pick.memberId===memberId).length;
  const picksRemaining=draft.rounds-picked;
  const missing=GROUPS.flatMap(group=>Array.from({length:Math.max(0,LIVE_FANTASY_ROSTER_REQUIREMENTS[group]-(counts[group]||0))},()=>group));
  const requiredNow=picksRemaining<=missing.length?new Set(missing):null;
  let best:Player|null=null;
  let bestScore=-Infinity;
  for(const player of legalPlayersFor(draft,memberId,true)){
    const group=getLiveFantasyDraftGroup(player);
    if(!group)continue;
    if((counts[group]||0)>=CPU_POSITION_TARGETS[group])continue;
    if(requiredNow&&!requiredNow.has(group))continue;
    const ranking=rankings.get(rankingKey(player.name,player.team));
    const fantasyValue=ranking?1000-ranking.overall_rank:player.ovr*2;
    const depthPenalty=(counts[group]||0)*CPU_DEPTH_PENALTY[group];
    const lateSpecialTeamsBoost=(group==='K'||group==='DST')&&picked<13?-180:0;
    const starterNeedBoost=(counts[group]||0)<LIVE_FANTASY_ROSTER_REQUIREMENTS[group]?240:0;
    const score=fantasyValue-depthPenalty+lateSpecialTeamsBoost+starterNeedBoost;
    if(score>bestScore||(score===bestScore&&player.name.localeCompare(best?.name||'')<0)){
      best=player;bestScore=score;
    }
  }
  return best;
};

const draftGrade=(draft:LiveFantasyDraft,memberId:string,rankings:Map<string,FantasyRanking>)=>{
  const picks=draft.picks.filter(pick=>pick.memberId===memberId);
  const counts=countsFor(draft,memberId);
  const missing=GROUPS.reduce((sum,group)=>sum+Math.max(0,LIVE_FANTASY_ROSTER_REQUIREMENTS[group]-(counts[group]||0)),0);
  const ranked=picks.flatMap(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);const ranking=player&&rankings.get(rankingKey(player.name,player.team));return ranking?[Math.max(-30,Math.min(30,pick.overall-ranking.overall_rank))]:[];});
  const value=ranked.length?ranked.reduce((sum,item)=>sum+item,0)/ranked.length:0;
  const score=Math.max(55,Math.min(98,Math.round(84+value*.35-missing*10)));
  const letter=score>=97?'A+':score>=93?'A':score>=90?'A-':score>=87?'B+':score>=83?'B':score>=80?'B-':score>=77?'C+':score>=73?'C':score>=70?'C-':score>=60?'D':'F';
  return {letter,score,detail:missing?`${missing} starter need${missing===1?'':'s'} unfilled`:`${ranked.length} picks graded against 2026 fantasy rank`};
};

export const LeagueLiveDraftRoom:React.FC<Props>=({onBackToLobby})=>{
  const {
    activeLeague,currentUser,makeLiveFantasyDraftPick,
    finalizeLiveFantasyDraftRosters,showToast,
  }=useBallKnower();
  const draft=activeLeague?.liveDraft;
  const [query,setQuery]=useState('');
  const [group,setGroup]=useState<DraftGroup|'ALL'>('ALL');
  const [showMyPicks,setShowMyPicks]=useState(false);
  const [busy,setBusy]=useState(false);
  const [rankings,setRankings]=useState<Map<string,FantasyRanking>>(new Map());
  const [rankingsReady,setRankingsReady]=useState(false);
  const [preferences,setPreferences]=useState<DraftPreferences>(EMPTY_PREFERENCES);
  const [preferencesReady,setPreferencesReady]=useState(false);
  const [now,setNow]=useState(()=>Date.now());
  const [chatOpen,setChatOpen]=useState(false);
  const [chatMessage,setChatMessage]=useState('');
  const [chatMessages,setChatMessages]=useState<LeagueMessage[]>([]);
  const [chatBusy,setChatBusy]=useState(false);
  const pickLockRef=useRef(false);
  const finalizeLockRef=useRef(false);
  const needsScrollRef=useRef<HTMLDivElement>(null);

  const currentMemberId=draft?memberAtPick(draft):null;
  const currentMember=activeLeague?.members.find(member=>member.id===currentMemberId);
  const myMember=resolveMyLeagueMember(activeLeague,currentUser);
  const isCommissioner=activeLeague?.commissionerId===currentUser?.id;
  const rostersFinalized=Boolean(activeLeague?.members.length&&activeLeague.members.every(member=>
    member.status==='ready'&&(member.roster?.length||0)===draft?.rounds
  ));
  const seasonHandoffComplete=rostersFinalized&&activeLeague?.status==='drafting';
  const mySlot=draft&&myMember?draft.orderMemberIds.indexOf(myMember.id)+1:0;
  const myPicks=useMemo(()=>draft&&myMember?draft.picks.filter(pick=>pick.memberId===myMember.id):[],[draft,myMember]);
  const myRoster=useMemo(()=>myPicks.map(pick=>PLAYER_BY_ID.get(pick.playerId)).filter((player):player is Player=>Boolean(player)),[myPicks]);
  const myCounts=useMemo(()=>draft?countsFor(draft,myMember?.id||''):{},[draft,myMember?.id]);
  const available=useMemo(()=>{
    if(!draft||!currentMemberId)return [];
    const clean=query.trim().toLowerCase();
    return legalPlayersFor(draft,currentMemberId,Boolean(currentMember?.isAi))
      .filter(player=>(group==='ALL'||getLiveFantasyDraftGroup(player)===group)&&(!clean||`${player.name} ${player.team} ${player.position}`.toLowerCase().includes(clean)))
      .sort((first,second)=>{
        const firstRank=rankings.get(rankingKey(first.name,first.team))?.overall_rank??9999;
        const secondRank=rankings.get(rankingKey(second.name,second.team))?.overall_rank??9999;
        return firstRank-secondRank||second.ovr-first.ovr||first.name.localeCompare(second.name);
      })
      .slice(0,100);
  },[draft,currentMemberId,currentMember?.isAi,group,query,myCounts,rankings]);

  useEffect(()=>{
    let alive=true;
    void loadFantasyRankings()
      .then(rows=>{if(alive)setRankings(new Map(rows.map(row=>[rankingKey(row.player_name,row.team),row])));})
      .catch(error=>console.warn('Draft projections could not be loaded; using roster-aware fallback ordering.',error))
      .finally(()=>{if(alive)setRankingsReady(true);});
    return ()=>{alive=false;};
  },[]);

  const refreshChat=useCallback(async()=>{
    if(!activeLeague?.id)return;
    try{const operations=await fetchSeasonOperations(activeLeague.id);setChatMessages(operations.messages.slice(0,100));}
    catch(error){console.warn('Draft chat could not be loaded.',error);}
  },[activeLeague?.id]);
  useEffect(()=>{void refreshChat();},[refreshChat]);
  const sendDraftMessage=async()=>{
    const body=chatMessage.trim();
    if(!activeLeague||!body||chatBusy)return;
    setChatBusy(true);
    try{
      await postLeagueMessage(activeLeague.id,currentUser?.name||myMember?.userName||'Ball Knower',body);
      setChatMessage('');
      await refreshChat();
    }catch(error:any){showToast(error?.message||'Draft chat message could not be sent.');}
    finally{setChatBusy(false);}
  };

  const makePick=async(player:Player)=>{
    if(!activeLeague||pickLockRef.current)return;
    pickLockRef.current=true;setBusy(true);
    try{await makeLiveFantasyDraftPick(activeLeague.id,player);}finally{pickLockRef.current=false;setBusy(false);}
  };

  useEffect(()=>{
    if(!rankingsReady||!draft||draft.status!=='active'||!currentMember?.isAi||!myMember||busy||pickLockRef.current)return;
    const player=cpuSelection(draft,currentMember.id,rankings);
    if(!player){showToast(`${currentMember.userName} could not find a legal CPU pick.`);return;}
    const timer=window.setTimeout(()=>{void makePick(player);},120);
    return ()=>window.clearTimeout(timer);
  },[draft?.pickIndex,currentMember?.id,currentMember?.isAi,myMember?.id,rankingsReady,rankings,busy]);

  useEffect(()=>{
    if(!activeLeague||draft?.status!=='completed'||seasonHandoffComplete||!isCommissioner||finalizeLockRef.current)return;
    finalizeLockRef.current=true;
    setBusy(true);
    void finalizeLiveFantasyDraftRosters(activeLeague.id)
      .then(success=>{if(!success)finalizeLockRef.current=false;})
      .finally(()=>setBusy(false));
  },[activeLeague?.id,draft?.status,isCommissioner,seasonHandoffComplete]);

  useEffect(()=>{needsScrollRef.current?.scrollTo({left:0,behavior:'auto'});},[draft?.leagueId]);

  useEffect(()=>{
    let alive=true;
    setPreferencesReady(false);
    if(!activeLeague?.id||!myMember?.id){setPreferences(EMPTY_PREFERENCES);return ()=>{alive=false;};}
    void loadMyCloudDraftPreferences(activeLeague.id,myMember.id)
      .then(value=>{if(alive){setPreferences(value);setPreferencesReady(true);}})
      .catch(error=>{console.warn('Draft preferences could not be loaded.',error);if(alive)setPreferencesReady(true);});
    return ()=>{alive=false;};
  },[activeLeague?.id,myMember?.id]);

  useEffect(()=>{
    if(!preferencesReady||!activeLeague?.id||!myMember?.id)return;
    const timer=window.setTimeout(()=>{void saveMyCloudDraftPreferences(activeLeague.id,myMember.id,preferences).catch(error=>console.warn('Draft preferences could not be saved.',error));},350);
    return ()=>window.clearTimeout(timer);
  },[preferences,preferencesReady,activeLeague?.id,myMember?.id]);

  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    return ()=>window.clearInterval(timer);
  },[]);

  const togglePreference=(key:'favorites'|'doNotDraft'|'preRankings',playerId:string)=>setPreferences(value=>{
    const present=value[key].includes(playerId);
    const next={...value,[key]:present?value[key].filter(id=>id!==playerId):[...value[key],playerId]};
    if(key==='doNotDraft'&&!present)next.queue=value.queue.filter(id=>id!==playerId);
    return next;
  });
  const toggleQueue=(playerId:string)=>setPreferences(value=>({
    ...value,
    queue:value.queue.includes(playerId)?value.queue.filter(id=>id!==playerId):[...value.queue,playerId],
    doNotDraft:value.doNotDraft.filter(id=>id!==playerId),
  }));
  const moveQueue=(playerId:string,direction:-1|1)=>setPreferences(value=>{
    const queue=[...value.queue];const from=queue.indexOf(playerId);const to=from+direction;
    if(from<0||to<0||to>=queue.length)return value;
    [queue[from],queue[to]]=[queue[to],queue[from]];return {...value,queue};
  });

  if(!activeLeague||!draft){
    return <div className="min-h-[70dvh] bg-[#07090c] px-4 py-16 text-center text-white"><h2 className="text-2xl font-black uppercase">Fantasy Draft Has Not Started</h2><button onClick={onBackToLobby} className="mt-5 rounded-xl bg-[#D4AF37] px-5 py-3 text-xs font-black uppercase text-black">Return to League HQ</button></div>;
  }

  if(draft.status==='completed'){
    const myGrade=myMember?draftGrade(draft,myMember.id,rankings):null;
    return <div className="min-h-[100dvh] bg-[#07090c] px-3 py-4 text-white sm:px-6"><div className="mx-auto max-w-5xl"><button onClick={onBackToLobby} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-black uppercase"><ArrowLeft className="mr-1 inline h-4 w-4"/>League HQ</button><section className="mt-4 rounded-2xl border border-[#D4AF37]/30 bg-[#101318] p-5 text-center"><Trophy className="mx-auto h-9 w-9 text-[#D4AF37]"/><h1 className="mt-2 font-display text-4xl font-black uppercase">Fantasy Draft Complete</h1><p className="mt-2 text-sm text-zinc-400">All {draft.pickIndex} picks are locked. Every manager has a complete {draft.rounds}-player roster.</p>{myGrade&&<div className="mx-auto mt-4 max-w-sm rounded-2xl border border-[#D4AF37]/30 bg-black/25 p-4"><div className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">Your Draft Grade</div><div className="mt-1 text-4xl font-black">{myGrade.letter}</div><div className="text-[10px] font-bold text-zinc-500">{myGrade.score}/100 · {myGrade.detail}</div></div>}<button onClick={onBackToLobby} disabled={!seasonHandoffComplete} className="mt-4 min-h-14 w-full rounded-xl bg-[#D4AF37] text-sm font-black uppercase tracking-wider text-black disabled:cursor-wait disabled:opacity-45">{seasonHandoffComplete?<><Play className="mr-2 inline h-4 w-4"/>Continue To Season</>:<><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin"/>{isCommissioner?'Saving All League Rosters…':'Waiting For Commissioner To Save Rosters'}</>}</button></section><div className="mt-4 grid gap-3 sm:grid-cols-2">{draft.orderMemberIds.map(memberId=>{const member=activeLeague.members.find(item=>item.id===memberId);const mine=member?.id===myMember?.id;const picks=draft.picks.filter(pick=>pick.memberId===memberId);return <div key={memberId} className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div className="font-black uppercase">{displayLeagueMemberName(member,mine,currentUser,activeLeague.members.indexOf(member!))}</div><div className="text-xs font-black text-[#D4AF37]">{picks.length}/{draft.rounds}</div></div><div className="mt-3 grid grid-cols-2 gap-1">{picks.map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);return <div key={pick.overall} className="truncate rounded-lg bg-black/30 px-2 py-1.5 text-[10px]"><b>{player?.position}</b> {player?.name}</div>})}</div></div>})}</div></div></div>;
  }

  const round=Math.floor(draft.pickIndex/draft.orderMemberIds.length)+1;
  const currentMemberIsMe=currentMember?.id===myMember?.id;
  const onClockIsMe=currentMemberIsMe;
  const onClockName=displayLeagueMemberName(currentMember,currentMemberIsMe,currentUser,activeLeague.members.indexOf(currentMember!));
  const canPick=onClockIsMe&&!currentMember?.isAi&&!busy;
  const totalPicks=draft.orderMemberIds.length*draft.rounds;
  const openNeeds=GROUPS.filter(item=>(myCounts[item]||0)<LIVE_FANTASY_ROSTER_REQUIREMENTS[item]);
  const secondsLeft=Math.max(0,Math.ceil(((draft.pickDeadlineAt?Date.parse(draft.pickDeadlineAt):Date.now())-now)/1000));
  const clockLabel=currentMember?.isAi?'CPU':secondsLeft>0?`${secondsLeft}s`:'AUTO';

  return <div className="bk-fantasy-shell min-h-[100dvh] bg-[#07090c] px-3 pt-3 text-white sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="bk-fantasy-sticky-nav bk-fantasy-card p-3 shadow-2xl backdrop-blur-md"><div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2 sm:grid-cols-[44px_minmax(0,1fr)_44px_auto]"><button onClick={onBackToLobby} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Back to League HQ"><ArrowLeft className="h-5 w-5"/></button><div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[.16em] text-[#D4AF37]">Round {round} of {draft.rounds} · Snake Draft</div><div className="truncate text-base font-black uppercase leading-tight sm:text-lg">{onClockName} Is On The Clock</div></div><button type="button" aria-label="Open draft chat" onClick={()=>setChatOpen(true)} className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/25"><MessageCircle className="h-4 w-4"/>{chatMessages.length>0&&<span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#D4AF37] px-1 text-[7px] font-black text-black">{Math.min(99,chatMessages.length)}</span>}</button><div className={`col-span-3 flex items-center justify-between rounded-lg px-3 py-2 sm:col-span-1 sm:block sm:p-0 sm:text-right ${secondsLeft<=10&&!currentMember?.isAi?'bg-red-500/10 text-red-300':'bg-black/25 sm:bg-transparent'}`}><div className="text-[9px] font-black uppercase opacity-60">Pick {Math.min(draft.pickIndex+1,totalPicks)} of {totalPicks}</div><div className="font-mono text-xl font-black sm:text-2xl">{clockLabel}</div></div></div><div className="mt-2 grid grid-cols-4 gap-2"><MiniStat label="Your Slot" value={mySlot?`#${mySlot}`:'—'}/><MiniStat label="Your Roster" value={`${myRoster.length} Players`}/><MiniStat label="Turn" value={currentMemberIsMe?'Your Pick':currentMember?.isAi?'CPU Picking':'Waiting'}/><MiniStat label="Auto Pick" value={preferences.queue.length?'Queue Ready':'Best Available'}/></div></div>

    <section className="bk-fantasy-card mt-3 border-[#D4AF37]/25 p-3 shadow-xl">
      <div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-[#D4AF37]">Your roster needs</div><div className="mt-0.5 text-[10px] font-bold text-zinc-500">Counts update after every pick</div></div><button type="button" aria-label={`My picks (${myPicks.length})`} onClick={()=>setShowMyPicks(value=>!value)} className="flex min-h-10 items-center gap-1 rounded-xl border border-white/10 px-3 text-[9px] font-black uppercase">My picks ({myPicks.length}) {showMyPicks?<ChevronUp className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}</button></div>
      <div ref={needsScrollRef} className="mt-2 grid grid-cols-6 gap-1.5">{GROUPS.map(item=>{const current=myCounts[item]||0;const required=LIVE_FANTASY_ROSTER_REQUIREMENTS[item];const filled=current>=required;return <button type="button" key={item} onClick={()=>setGroup(item)} className={`min-w-0 rounded-xl border px-1 py-2 text-center ${filled?'border-emerald-400/20 bg-emerald-400/[.07]':'border-amber-300/25 bg-amber-300/[.07]'}`}><div className="truncate text-[8px] font-black text-zinc-400">{GROUP_LABELS[item]}</div><div className={`mt-0.5 text-base font-black ${filled?'text-emerald-300':'text-amber-200'}`}>{current}</div><div className="text-[6px] font-black uppercase text-zinc-600">{filled?'Set':`Need ${required-current}`}</div></button>})}</div>
      {showMyPicks&&<div className="mt-2 grid gap-1 border-t border-white/10 pt-2 sm:grid-cols-2 lg:grid-cols-4">{myPicks.length?myPicks.slice().reverse().map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);return <div key={pick.overall} className="flex items-center justify-between rounded-lg bg-black/35 px-2.5 py-2 text-[10px]"><span className="min-w-0 truncate"><b>#{pick.overall} · {player?.position}</b> {player?.name}</span><b className="ml-2 text-[#D4AF37]">{player?.ovr}</b></div>}):<div className="py-2 text-[10px] font-bold text-zinc-600">You have not made a pick yet.</div>}</div>}
      {!showMyPicks&&<div className="mt-2 text-[9px] font-bold uppercase leading-4 text-zinc-600">Starter needs: {openNeeds.length?openNeeds.map(item=>`${LIVE_FANTASY_ROSTER_REQUIREMENTS[item]-(myCounts[item]||0)} ${GROUP_LABELS[item]}`).join(' · '):'Set — draft the best bench value'}</div>}
    </section>

    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_.65fr]">
      <section className="min-w-0">
        <div className={`rounded-xl border p-3 text-center text-xs font-black uppercase ${canPick?'border-emerald-400/30 bg-emerald-400/[.08] text-emerald-300':'border-white/10 bg-[#101318] text-zinc-400'}`}>{canPick?'You are on the clock—select one player.':currentMember?.isAi?'CPU manager is selecting automatically…':`Waiting for ${onClockName} to pick.`}</div>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2"><div className="relative min-w-0"><Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search players…" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#101318] pl-10 pr-3 text-sm font-bold outline-none focus:border-[#D4AF37]/50"/></div><select aria-label="Position group" value={group} onChange={event=>setGroup(event.target.value as DraftGroup|'ALL')} className="min-h-12 max-w-[8.5rem] rounded-xl border border-white/10 bg-[#101318] px-2 text-xs font-black text-white"><option value="ALL">All Positions</option>{GROUPS.map(item=><option key={item} value={item}>{GROUP_LABELS[item]}</option>)}</select></div>
        <div className="mt-3 space-y-2">{available.map((player,index)=>{
          const playerGroup=getLiveFantasyDraftGroup(player);const ranking=rankings.get(rankingKey(player.name,player.team));const teamDefense=playerGroup==='DST';
          const queued=preferences.queue.includes(player.id);const favorite=preferences.favorites.includes(player.id);const avoided=preferences.doNotDraft.includes(player.id);const preRanked=preferences.preRankings.includes(player.id);
          return <div key={player.id} className={`rounded-2xl border bg-[#101318] p-3 ${avoided?'border-red-400/25 opacity-60':queued?'border-[#D4AF37]/50':'border-white/10'}`}>
            <div className="grid grid-cols-[44px_minmax(0,1fr)_76px] items-center gap-2.5 sm:grid-cols-[48px_minmax(0,1fr)_88px] sm:gap-3">
              <div className="h-11 w-11 overflow-hidden rounded-full border border-white/10 bg-white/5 sm:h-12 sm:w-12"><img src={playerPortraitUrl(player)} alt={`${player.name} headshot`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src=playerPortraitFallbackUrl(player);}} className="h-full w-full object-cover"/></div>
              <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><div className="truncate font-black">{player.name}</div>{index===0&&group==='ALL'&&<span className="hidden shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[7px] font-black uppercase text-emerald-300 min-[390px]:inline">Top Available</span>}</div><div className="truncate text-xs font-semibold text-zinc-500">{player.position} · {player.team} · ADP {ranking?ranking.adp.toFixed(1):'—'}</div></div>
              <button onClick={()=>void makePick(player)} disabled={!canPick||avoided} className="rounded-xl bg-[#D4AF37] px-1 py-2 text-center text-black disabled:cursor-not-allowed disabled:opacity-45"><div className="text-base font-black sm:text-lg">{ranking?ranking.projected_points_2026.toFixed(1):teamDefense?'DEF':'—'}</div><div className="text-[7px] font-black">{canPick?'DRAFT':ranking?'PROJ PTS':teamDefense?'TEAM D/ST':'PLAYER'}</div></button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5 border-t border-white/5 pt-2">
              <PreferenceButton active={queued} label={queued?'Queued':'Queue'} onClick={()=>toggleQueue(player.id)}><ListPlus className="h-3.5 w-3.5"/></PreferenceButton>
              <PreferenceButton active={favorite} label="Favorite" onClick={()=>togglePreference('favorites',player.id)}><Star className="h-3.5 w-3.5"/></PreferenceButton>
              <PreferenceButton active={preRanked} label="Pre-rank" onClick={()=>togglePreference('preRankings',player.id)}><Trophy className="h-3.5 w-3.5"/></PreferenceButton>
              <PreferenceButton active={avoided} danger label="Avoid" onClick={()=>togglePreference('doNotDraft',player.id)}><Ban className="h-3.5 w-3.5"/></PreferenceButton>
            </div>
          </div>;
        })}</div>
      </section>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#101318] p-4"><div className="flex items-center justify-between"><div className="text-xs font-black uppercase text-[#D4AF37]">Auto-pick Queue</div><div className="text-[9px] font-black uppercase text-zinc-500">Saved</div></div><p className="mt-1 text-[10px] leading-4 text-zinc-500">If your clock expires, the first legal player here is selected. Then pre-ranks, favorites, and roster-aware best available.</p><div className="mt-3 space-y-1.5">{preferences.queue.filter(id=>!draft.picks.some(pick=>pick.playerId===id)).map((id,index)=>{const player=PLAYER_BY_ID.get(id);if(!player)return null;return <div key={id} className="grid grid-cols-[22px_minmax(0,1fr)_28px_28px] items-center gap-1 rounded-lg bg-black/30 px-2 py-2 text-xs"><b className="text-[#D4AF37]">{index+1}</b><span className="truncate"><b>{player.position}</b> {player.name}</span><button aria-label={`Move ${player.name} up`} onClick={()=>moveQueue(id,-1)} disabled={index===0} className="grid h-7 place-items-center rounded bg-white/5 disabled:opacity-25"><ArrowUp className="h-3.5 w-3.5"/></button><button aria-label={`Move ${player.name} down`} onClick={()=>moveQueue(id,1)} disabled={index===preferences.queue.length-1} className="grid h-7 place-items-center rounded bg-white/5 disabled:opacity-25"><ArrowDown className="h-3.5 w-3.5"/></button></div>} )}{!preferences.queue.length&&<div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-[10px] font-bold text-zinc-600">Tap Queue on players you want next.</div>}</div></div>
        <div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div className="text-xs font-black uppercase text-[#D4AF37]">Your Roster</div><div className="text-xs font-black">{myRoster.length} players</div></div><div className="mt-2 text-[10px] leading-5 text-zinc-500">{GROUPS.map(item=>`${GROUP_LABELS[item]} ${myCounts[item]||0}`).join(' · ')}</div><div className="mt-3 space-y-1">{myPicks.map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);return <div key={pick.overall} className="flex justify-between rounded-lg bg-black/30 px-2 py-2 text-xs"><span className="truncate"><b>{player?.position}</b> {player?.name}</span><b>#{pick.overall}</b></div>})}</div></div>
        <div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#D4AF37]"><Clock3 className="h-4 w-4"/>Recent Picks</div><div className="mt-3 space-y-2">{draft.picks.slice(-10).reverse().map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);const member=activeLeague.members.find(item=>item.id===pick.memberId);const mine=member?.id===myMember?.id;return <div key={pick.overall} className="text-xs"><div className="font-black">#{pick.overall} · {displayLeagueMemberName(member,mine,currentUser,activeLeague.members.indexOf(member!))}{pick.source==='autopick'?' · AUTO':''}</div><div className="truncate text-zinc-500">{player?.name} · {player?.position}</div></div>})}</div></div>
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] p-3 text-[11px] leading-5 text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>The locked order controls Round 1. Every even round reverses automatically for a true snake draft.</div>
      </aside>
    </div>
    {chatOpen&&<ModalPortal><div role="dialog" aria-modal="true" aria-label="Live draft chat" className="fixed inset-0 z-[9999] flex items-end bg-black/80 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"><section className="flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0d1015] pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-3xl sm:pb-0"><header className="flex items-center justify-between border-b border-white/10 p-4"><div><div className="text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">Live Draft</div><h2 className="text-lg font-black uppercase">League Chat</h2></div><button type="button" aria-label="Close draft chat" onClick={()=>setChatOpen(false)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10"><X className="h-5 w-5"/></button></header><div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">{chatMessages.length?chatMessages.slice().reverse().map(item=><div key={item.id} className="rounded-xl bg-black/30 p-3"><div className="text-[9px] font-black uppercase text-[#D4AF37]">{item.memberName}</div><p className="mt-1 text-sm leading-5 text-zinc-200">{item.body}</p></div>):<div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs font-bold text-zinc-600">No draft messages yet.</div>}</div><div className="grid grid-cols-[minmax(0,1fr)_48px] gap-2 border-t border-white/10 bg-[#101318] p-3"><input value={chatMessage} onChange={event=>setChatMessage(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void sendDraftMessage();}} placeholder="Message the league…" className="min-h-12 min-w-0 rounded-xl border border-white/10 bg-black/35 px-3 text-sm"/><button type="button" aria-label="Send draft message" disabled={!chatMessage.trim()||chatBusy} onClick={()=>void sendDraftMessage()} className="grid h-12 w-12 place-items-center rounded-xl bg-[#D4AF37] text-black disabled:opacity-35"><Send className="h-4 w-4"/></button></div></section></div></ModalPortal>}
  </div></div>;
};

const MiniStat=({label,value}:{label:string;value:string})=><div className="rounded-lg bg-black/30 p-2 text-center"><div className="text-[8px] font-black uppercase tracking-wider text-zinc-600">{label}</div><div className="mt-1 truncate text-[10px] font-black uppercase">{value}</div></div>;
const PreferenceButton=({active,danger=false,label,onClick,children}:{active:boolean;danger?:boolean;label:string;onClick:()=>void;children:React.ReactNode})=><button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-9 items-center justify-center gap-1 rounded-lg border px-1 text-[8px] font-black uppercase ${active?danger?'border-red-400/40 bg-red-400/10 text-red-300':'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37]':'border-white/10 text-zinc-500'}`}>{children}{label}</button>;
