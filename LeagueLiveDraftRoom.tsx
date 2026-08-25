import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Clock3, LoaderCircle, Play, Search, Trophy } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { playerPortraitUrl } from './playerPortraits';
import { PLAYERS_DATABASE } from './players';
import { getLiveFantasyDraftGroup, LIVE_FANTASY_POSITION_LIMITS, LIVE_FANTASY_ROSTER_REQUIREMENTS, LiveFantasyDraftGroup } from './liveFantasyRules';
import { FantasyRanking, loadFantasyRankings } from './fantasyRankingsCloud';
import { displayLeagueMemberName, resolveMyLeagueMember } from './leagueMemberDisplay';
import { LiveFantasyDraft, Player } from './types';

type Props={onBackToLobby:()=>void};
type DraftGroup=LiveFantasyDraftGroup;
const GROUPS=Object.keys(LIVE_FANTASY_ROSTER_REQUIREMENTS) as DraftGroup[];
const GROUP_LABELS:Record<DraftGroup,string>={QB:'QB',RB:'RB',WR:'WR',TE:'TE',K:'K',DST:'D/ST'};
const PLAYER_BY_ID=new Map(PLAYERS_DATABASE.map(player=>[player.id,player]));
const rankingKey=(name:string,team:string)=>`${name.toLowerCase().replace(/[^a-z0-9]/g,'')}|${team.toUpperCase()}`;

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

const legalPlayersFor=(draft:LiveFantasyDraft,memberId:string)=>{
  const drafted=new Set(draft.picks.map(pick=>pick.playerId));
  const counts=countsFor(draft,memberId);
  return PLAYERS_DATABASE.filter(player=>{
    if(drafted.has(player.id))return false;
    const group=getLiveFantasyDraftGroup(player);
    if(!group||(counts[group]||0)>=LIVE_FANTASY_POSITION_LIMITS[group])return false;
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
  for(const player of legalPlayersFor(draft,memberId)){
    const group=getLiveFantasyDraftGroup(player);
    if(!group)continue;
    if(requiredNow&&!requiredNow.has(group))continue;
    const ranking=rankings.get(rankingKey(player.name,player.team));
    const fantasyValue=ranking?1000-ranking.overall_rank:0;
    const score=fantasyValue;
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
    return legalPlayersFor(draft,currentMemberId)
      .filter(player=>(group==='ALL'||getLiveFantasyDraftGroup(player)===group)&&(!clean||`${player.name} ${player.team} ${player.position}`.toLowerCase().includes(clean)))
      .sort((first,second)=>{
        const firstRank=rankings.get(rankingKey(first.name,first.team))?.overall_rank??9999;
        const secondRank=rankings.get(rankingKey(second.name,second.team))?.overall_rank??9999;
        return firstRank-secondRank||second.ovr-first.ovr||first.name.localeCompare(second.name);
      })
      .slice(0,100);
  },[draft,currentMemberId,group,query,myCounts,rankings]);

  useEffect(()=>{
    let alive=true;
    void loadFantasyRankings()
      .then(rows=>{if(alive)setRankings(new Map(rows.map(row=>[rankingKey(row.player_name,row.team),row])));})
      .catch(error=>console.warn('Draft projections could not be loaded; using roster-aware fallback ordering.',error))
      .finally(()=>{if(alive)setRankingsReady(true);});
    return ()=>{alive=false;};
  },[]);

  const makePick=async(player:Player)=>{
    if(!activeLeague||pickLockRef.current)return;
    pickLockRef.current=true;setBusy(true);
    try{await makeLiveFantasyDraftPick(activeLeague.id,player);}finally{pickLockRef.current=false;setBusy(false);}
  };

  useEffect(()=>{
    if(!rankingsReady||!draft||draft.status!=='active'||!currentMember?.isAi||!myMember||pickLockRef.current)return;
    const player=cpuSelection(draft,currentMember.id,rankings);
    if(!player){showToast(`${currentMember.userName} could not find a legal CPU pick.`);return;}
    const timer=window.setTimeout(()=>{void makePick(player);},120);
    return ()=>window.clearTimeout(timer);
  },[draft?.pickIndex,currentMember?.id,currentMember?.isAi,myMember?.id,rankingsReady,rankings]);

  useEffect(()=>{
    if(!activeLeague||draft?.status!=='completed'||seasonHandoffComplete||!isCommissioner||finalizeLockRef.current)return;
    finalizeLockRef.current=true;
    setBusy(true);
    void finalizeLiveFantasyDraftRosters(activeLeague.id)
      .then(success=>{if(!success)finalizeLockRef.current=false;})
      .finally(()=>setBusy(false));
  },[activeLeague?.id,draft?.status,isCommissioner,seasonHandoffComplete]);

  useEffect(()=>{needsScrollRef.current?.scrollTo({left:0,behavior:'auto'});},[draft?.leagueId]);

  if(!activeLeague||!draft){
    return <div className="min-h-[70dvh] bg-[#07090c] px-4 py-16 text-center text-white"><h2 className="text-2xl font-black uppercase">Fantasy Draft Has Not Started</h2><button onClick={onBackToLobby} className="mt-5 rounded-xl bg-[#D4AF37] px-5 py-3 text-xs font-black uppercase text-black">Return to League HQ</button></div>;
  }

  if(draft.status==='completed'){
    const myGrade=myMember?draftGrade(draft,myMember.id,rankings):null;
    return <div className="min-h-[100dvh] bg-[#07090c] px-3 py-4 text-white sm:px-6"><div className="mx-auto max-w-5xl"><button onClick={onBackToLobby} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-black uppercase"><ArrowLeft className="mr-1 inline h-4 w-4"/>League HQ</button><section className="mt-4 rounded-2xl border border-[#D4AF37]/30 bg-[#101318] p-5 text-center"><Trophy className="mx-auto h-9 w-9 text-[#D4AF37]"/><h1 className="mt-2 font-display text-4xl font-black uppercase">Fantasy Draft Complete</h1><p className="mt-2 text-sm text-zinc-400">All {draft.pickIndex} picks are locked. Every manager has a complete 20-player roster.</p>{myGrade&&<div className="mx-auto mt-4 max-w-sm rounded-2xl border border-[#D4AF37]/30 bg-black/25 p-4"><div className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">Your Draft Grade</div><div className="mt-1 text-4xl font-black">{myGrade.letter}</div><div className="text-[10px] font-bold text-zinc-500">{myGrade.score}/100 · {myGrade.detail}</div></div>}<button onClick={onBackToLobby} disabled={!seasonHandoffComplete} className="mt-4 min-h-14 w-full rounded-xl bg-[#D4AF37] text-sm font-black uppercase tracking-wider text-black disabled:cursor-wait disabled:opacity-45">{seasonHandoffComplete?<><Play className="mr-2 inline h-4 w-4"/>Continue To Season</>:<><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin"/>{isCommissioner?'Saving All League Rosters…':'Waiting For Commissioner To Save Rosters'}</>}</button></section><div className="mt-4 grid gap-3 sm:grid-cols-2">{draft.orderMemberIds.map(memberId=>{const member=activeLeague.members.find(item=>item.id===memberId);const mine=member?.id===myMember?.id;const picks=draft.picks.filter(pick=>pick.memberId===memberId);return <div key={memberId} className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div className="font-black uppercase">{displayLeagueMemberName(member,mine,currentUser,activeLeague.members.indexOf(member!))}</div><div className="text-xs font-black text-[#D4AF37]">{picks.length}/20</div></div><div className="mt-3 grid grid-cols-2 gap-1">{picks.map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);return <div key={pick.overall} className="truncate rounded-lg bg-black/30 px-2 py-1.5 text-[10px]"><b>{player?.position}</b> {player?.name}</div>})}</div></div>})}</div></div></div>;
  }

  const round=Math.floor(draft.pickIndex/draft.orderMemberIds.length)+1;
  const currentMemberIsMe=currentMember?.id===myMember?.id;
  const onClockIsMe=currentMemberIsMe;
  const onClockName=displayLeagueMemberName(currentMember,currentMemberIsMe,currentUser,activeLeague.members.indexOf(currentMember!));
  const canPick=onClockIsMe&&!currentMember?.isAi&&!busy;
  const totalPicks=draft.orderMemberIds.length*draft.rounds;
  const openNeeds=GROUPS.filter(item=>(myCounts[item]||0)<LIVE_FANTASY_ROSTER_REQUIREMENTS[item]);

  return <div className="min-h-[100dvh] bg-[#07090c] px-3 pb-24 pt-3 text-white sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="sticky top-16 z-30 rounded-2xl border border-white/10 bg-[#0d1015]/95 p-3 shadow-2xl backdrop-blur-md"><div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 sm:grid-cols-[44px_minmax(0,1fr)_auto]"><button onClick={onBackToLobby} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Back to League HQ"><ArrowLeft className="h-5 w-5"/></button><div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[.16em] text-[#D4AF37]">Round {round} of {draft.rounds} · Snake Draft</div><div className="text-base font-black uppercase leading-tight sm:text-lg">{onClockName} Is On The Clock</div></div><div className="col-span-2 flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 sm:col-span-1 sm:block sm:bg-transparent sm:p-0 sm:text-right"><div className="text-[9px] font-black uppercase text-zinc-600">Current Pick</div><div className="font-mono text-sm font-black sm:text-lg">{Math.min(draft.pickIndex+1,totalPicks)} of {totalPicks}</div></div></div><div className="mt-2 grid grid-cols-3 gap-2"><MiniStat label="Your Slot" value={mySlot?`#${mySlot}`:'—'}/><MiniStat label="Your Roster" value={`${myRoster.length} Players`}/><MiniStat label="Turn" value={currentMemberIsMe?'Your Pick':currentMember?.isAi?'CPU Picking':'Waiting'}/></div></div>

    <section className="mt-3 rounded-2xl border border-[#D4AF37]/25 bg-[#0d1015] p-3 shadow-xl">
      <div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-[#D4AF37]">Your roster needs</div><div className="mt-0.5 text-[10px] font-bold text-zinc-500">Counts update after every pick</div></div><button type="button" aria-label={`My picks (${myPicks.length})`} onClick={()=>setShowMyPicks(value=>!value)} className="flex min-h-10 items-center gap-1 rounded-xl border border-white/10 px-3 text-[9px] font-black uppercase">My picks ({myPicks.length}) {showMyPicks?<ChevronUp className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}</button></div>
      <div ref={needsScrollRef} className="mt-2 grid grid-cols-6 gap-1.5">{GROUPS.map(item=>{const current=myCounts[item]||0;const required=LIVE_FANTASY_ROSTER_REQUIREMENTS[item];const filled=current>=required;return <button type="button" key={item} onClick={()=>setGroup(item)} className={`min-w-0 rounded-xl border px-1 py-2 text-center ${filled?'border-emerald-400/20 bg-emerald-400/[.07]':'border-amber-300/25 bg-amber-300/[.07]'}`}><div className="truncate text-[8px] font-black text-zinc-400">{GROUP_LABELS[item]}</div><div className={`mt-0.5 text-base font-black ${filled?'text-emerald-300':'text-amber-200'}`}>{current}</div><div className="text-[6px] font-black uppercase text-zinc-600">{filled?'Set':`Need ${required-current}`}</div></button>})}</div>
      {showMyPicks&&<div className="mt-2 grid gap-1 border-t border-white/10 pt-2 sm:grid-cols-2 lg:grid-cols-4">{myPicks.length?myPicks.slice().reverse().map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);return <div key={pick.overall} className="flex items-center justify-between rounded-lg bg-black/35 px-2.5 py-2 text-[10px]"><span className="min-w-0 truncate"><b>#{pick.overall} · {player?.position}</b> {player?.name}</span><b className="ml-2 text-[#D4AF37]">{player?.ovr}</b></div>}):<div className="py-2 text-[10px] font-bold text-zinc-600">You have not made a pick yet.</div>}</div>}
      {!showMyPicks&&<div className="mt-2 text-[9px] font-bold uppercase leading-4 text-zinc-600">Starter needs: {openNeeds.length?openNeeds.map(item=>`${LIVE_FANTASY_ROSTER_REQUIREMENTS[item]-(myCounts[item]||0)} ${GROUP_LABELS[item]}`).join(' · '):'Set — draft the best bench value'}</div>}
    </section>

    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_.65fr]">
      <section className="min-w-0"><div className={`rounded-xl border p-3 text-center text-xs font-black uppercase ${canPick?'border-emerald-400/30 bg-emerald-400/[.08] text-emerald-300':'border-white/10 bg-[#101318] text-zinc-400'}`}>{canPick?'You are on the clock—select one player.':currentMember?.isAi?'CPU manager is selecting automatically…':`Waiting for ${onClockName} to pick.`}</div><div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2"><div className="relative min-w-0"><Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search players…" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#101318] pl-10 pr-3 text-sm font-bold outline-none focus:border-[#D4AF37]/50"/></div><select aria-label="Position group" value={group} onChange={event=>setGroup(event.target.value as DraftGroup|'ALL')} className="min-h-12 max-w-[8.5rem] rounded-xl border border-white/10 bg-[#101318] px-2 text-xs font-black text-white"><option value="ALL">All Positions</option>{GROUPS.map(item=><option key={item} value={item}>{GROUP_LABELS[item]}</option>)}</select></div><div className="mt-3 space-y-2">{available.map((player,index)=>{const playerGroup=getLiveFantasyDraftGroup(player);const ranking=rankings.get(rankingKey(player.name,player.team));const teamDefense=playerGroup==='DST';return <button key={player.id} onClick={()=>void makePick(player)} disabled={!canPick} className="grid w-full grid-cols-[44px_minmax(0,1fr)_76px] items-center gap-2.5 rounded-2xl border border-white/10 bg-[#101318] p-3 text-left disabled:cursor-not-allowed disabled:opacity-45 sm:grid-cols-[48px_minmax(0,1fr)_88px] sm:gap-3"><div className="h-11 w-11 overflow-hidden rounded-full bg-white/5 sm:h-12 sm:w-12">{playerPortraitUrl(player)?<img src={playerPortraitUrl(player)} alt="" className="h-full w-full object-cover"/>:null}</div><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><div className="truncate font-black">{player.name}</div>{index===0&&group==='ALL'&&<span className="hidden shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[7px] font-black uppercase text-emerald-300 min-[390px]:inline">Top Available</span>}</div><div className="truncate text-xs font-semibold text-zinc-500">{player.position} · {player.team}</div></div><div className="rounded-xl bg-[#D4AF37] px-1 py-2 text-center text-black"><div className="text-base font-black sm:text-lg">{ranking?ranking.projected_points_2026.toFixed(1):teamDefense?'DEF':'—'}</div><div className="text-[7px] font-black">{ranking?'PROJ PTS':teamDefense?'TEAM D/ST':'DRAFT'}</div></div></button>})}</div></section>

      <aside className="space-y-3"><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div className="text-xs font-black uppercase text-[#D4AF37]">Your Roster</div><div className="text-xs font-black">{myRoster.length} players</div></div><div className="mt-2 text-[10px] leading-5 text-zinc-500">{GROUPS.map(item=>`${GROUP_LABELS[item]} ${myCounts[item]||0}`).join(' · ')}</div><div className="mt-3 space-y-1">{myPicks.map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);return <div key={pick.overall} className="flex justify-between rounded-lg bg-black/30 px-2 py-2 text-xs"><span className="truncate"><b>{player?.position}</b> {player?.name}</span><b>#{pick.overall}</b></div>})}</div></div><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#D4AF37]"><Clock3 className="h-4 w-4"/>Recent Picks</div><div className="mt-3 space-y-2">{draft.picks.slice(-10).reverse().map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);const member=activeLeague.members.find(item=>item.id===pick.memberId);const mine=member?.id===myMember?.id;return <div key={pick.overall} className="text-xs"><div className="font-black">#{pick.overall} · {displayLeagueMemberName(member,mine,currentUser,activeLeague.members.indexOf(member!))}</div><div className="truncate text-zinc-500">{player?.name} · {player?.position}</div></div>})}</div></div><div className="flex items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] p-3 text-[11px] leading-5 text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>The locked order controls Round 1. Every even round reverses automatically for a true snake draft.</div></aside>
    </div>
  </div></div>;
};

const MiniStat=({label,value}:{label:string;value:string})=><div className="rounded-lg bg-black/30 p-2 text-center"><div className="text-[8px] font-black uppercase tracking-wider text-zinc-600">{label}</div><div className="mt-1 truncate text-[10px] font-black uppercase">{value}</div></div>;
