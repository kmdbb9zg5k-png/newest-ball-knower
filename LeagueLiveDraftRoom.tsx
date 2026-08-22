import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, LoaderCircle, Play, Search, Trophy } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { playerPortraitUrl } from './playerPortraits';
import { PLAYERS_DATABASE } from './players';
import { getDraftPositionGroup } from './rosterRules';
import { LiveFantasyDraft, Player, ROSTER_REQUIREMENTS, RosterRequirements } from './types';

type Props={onBackToLobby:()=>void};
type DraftGroup=keyof RosterRequirements;
const GROUPS=Object.keys(ROSTER_REQUIREMENTS) as DraftGroup[];
const PLAYER_BY_ID=new Map(PLAYERS_DATABASE.map(player=>[player.id,player]));

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
    const group=getDraftPositionGroup(player);
    return Boolean(group&&(counts[group]||0)<ROSTER_REQUIREMENTS[group]);
  });
};

const cpuSelection=(draft:LiveFantasyDraft,memberId:string)=>{
  const counts=countsFor(draft,memberId);
  let best:Player|null=null;
  let bestScore=-Infinity;
  for(const player of legalPlayersFor(draft,memberId)){
    const group=getDraftPositionGroup(player);
    if(!group)continue;
    const remaining=ROSTER_REQUIREMENTS[group]-(counts[group]||0);
    const urgency=remaining/ROSTER_REQUIREMENTS[group];
    const score=player.ovr*100+urgency*22-player.salary*.01;
    if(score>bestScore||(score===bestScore&&player.name.localeCompare(best?.name||'')<0)){
      best=player;bestScore=score;
    }
  }
  return best;
};

export const LeagueLiveDraftRoom:React.FC<Props>=({onBackToLobby})=>{
  const {
    activeLeague,currentUser,makeLiveFantasyDraftPick,
    finalizeLiveFantasyDraftRosters,showToast,
  }=useBallKnower();
  const draft=activeLeague?.liveDraft;
  const [query,setQuery]=useState('');
  const [group,setGroup]=useState<DraftGroup|'ALL'>('ALL');
  const [busy,setBusy]=useState(false);
  const pickLockRef=useRef(false);
  const finalizeLockRef=useRef(false);

  const currentMemberId=draft?memberAtPick(draft):null;
  const currentMember=activeLeague?.members.find(member=>member.id===currentMemberId);
  const myMember=activeLeague?.members.find(member=>member.userId===currentUser?.id);
  const isCommissioner=activeLeague?.commissionerId===currentUser?.id;
  const rostersFinalized=Boolean(activeLeague?.members.length&&activeLeague.members.every(member=>
    member.status==='ready'&&(member.roster?.length||0)===draft?.rounds
  ));
  const seasonHandoffComplete=rostersFinalized&&activeLeague?.status==='drafting';
  const mySlot=draft&&myMember?draft.orderMemberIds.indexOf(myMember.id)+1:0;
  const myPicks=useMemo(()=>draft&&myMember?draft.picks.filter(pick=>pick.memberId===myMember.id):[],[draft,myMember]);
  const myRoster=useMemo(()=>myPicks.map(pick=>PLAYER_BY_ID.get(pick.playerId)).filter((player):player is Player=>Boolean(player)),[myPicks]);
  const available=useMemo(()=>{
    if(!draft||!currentMemberId)return [];
    const clean=query.trim().toLowerCase();
    return legalPlayersFor(draft,currentMemberId)
      .filter(player=>(group==='ALL'||getDraftPositionGroup(player)===group)&&(!clean||`${player.name} ${player.team} ${player.position}`.toLowerCase().includes(clean)))
      .sort((first,second)=>second.ovr-first.ovr||first.name.localeCompare(second.name))
      .slice(0,100);
  },[draft,currentMemberId,group,query]);

  const makePick=async(player:Player)=>{
    if(!activeLeague||pickLockRef.current)return;
    pickLockRef.current=true;setBusy(true);
    try{await makeLiveFantasyDraftPick(activeLeague.id,player);}finally{pickLockRef.current=false;setBusy(false);}
  };

  useEffect(()=>{
    if(!draft||draft.status!=='active'||!currentMember?.isAi||!isCommissioner||pickLockRef.current)return;
    const player=cpuSelection(draft,currentMember.id);
    if(!player){showToast(`${currentMember.userName} could not find a legal CPU pick.`);return;}
    const timer=window.setTimeout(()=>{void makePick(player);},120);
    return ()=>window.clearTimeout(timer);
  },[draft?.pickIndex,currentMember?.id,currentMember?.isAi,isCommissioner]);

  useEffect(()=>{
    if(!activeLeague||draft?.status!=='completed'||seasonHandoffComplete||!isCommissioner||finalizeLockRef.current)return;
    finalizeLockRef.current=true;
    setBusy(true);
    void finalizeLiveFantasyDraftRosters(activeLeague.id)
      .then(success=>{if(!success)finalizeLockRef.current=false;})
      .finally(()=>setBusy(false));
  },[activeLeague?.id,draft?.status,isCommissioner,seasonHandoffComplete]);

  if(!activeLeague||!draft){
    return <div className="min-h-[70dvh] bg-[#07090c] px-4 py-16 text-center text-white"><h2 className="text-2xl font-black uppercase">Fantasy Draft Has Not Started</h2><button onClick={onBackToLobby} className="mt-5 rounded-xl bg-[#D4AF37] px-5 py-3 text-xs font-black uppercase text-black">Return to League HQ</button></div>;
  }

  if(draft.status==='completed'){
    return <div className="min-h-[100dvh] bg-[#07090c] px-3 py-4 text-white sm:px-6"><div className="mx-auto max-w-5xl"><button onClick={onBackToLobby} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-black uppercase"><ArrowLeft className="mr-1 inline h-4 w-4"/>League HQ</button><section className="mt-4 rounded-2xl border border-[#D4AF37]/30 bg-[#101318] p-5 text-center"><Trophy className="mx-auto h-9 w-9 text-[#D4AF37]"/><h1 className="mt-2 font-display text-4xl font-black uppercase">Fantasy Draft Complete</h1><p className="mt-2 text-sm text-zinc-400">All {draft.pickIndex} picks are locked. Every manager has a complete 20-player roster.</p><button onClick={onBackToLobby} disabled={!seasonHandoffComplete} className="mt-4 min-h-14 w-full rounded-xl bg-[#D4AF37] text-sm font-black uppercase tracking-wider text-black disabled:cursor-wait disabled:opacity-45">{seasonHandoffComplete?<><Play className="mr-2 inline h-4 w-4"/>Go To League HQ & Start Season</>:<><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin"/>{isCommissioner?'Saving All League Rosters…':'Waiting For Commissioner To Save Rosters'}</>}</button></section><div className="mt-4 grid gap-3 sm:grid-cols-2">{draft.orderMemberIds.map(memberId=>{const member=activeLeague.members.find(item=>item.id===memberId);const picks=draft.picks.filter(pick=>pick.memberId===memberId);return <div key={memberId} className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div className="font-black uppercase">{member?.userName}</div><div className="text-xs font-black text-[#D4AF37]">{picks.length}/20</div></div><div className="mt-3 grid grid-cols-2 gap-1">{picks.map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);return <div key={pick.overall} className="truncate rounded-lg bg-black/30 px-2 py-1.5 text-[10px]"><b>{player?.position}</b> {player?.name}</div>})}</div></div>})}</div></div></div>;
  }

  const round=Math.floor(draft.pickIndex/draft.orderMemberIds.length)+1;
  const onClockIsMe=currentMember?.userId===currentUser?.id;
  const canPick=onClockIsMe&&!currentMember?.isAi&&!busy;
  const totalPicks=draft.orderMemberIds.length*draft.rounds;
  const myCounts=countsFor(draft,myMember?.id||'');

  return <div className="min-h-[100dvh] bg-[#07090c] px-3 pb-24 pt-3 text-white sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="sticky top-16 z-30 rounded-2xl border border-white/10 bg-[#0d1015]/95 p-3 shadow-2xl backdrop-blur-md"><div className="flex items-center gap-3"><button onClick={onBackToLobby} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Back to League HQ"><ArrowLeft className="h-5 w-5"/></button><div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Live 20-Round Snake Draft · Round {round}/{draft.rounds}</div><div className="truncate text-lg font-black uppercase">{currentMember?.userName||'Draft Complete'} Is On The Clock</div></div><div className="text-right"><div className="text-[9px] font-black uppercase text-zinc-600">Overall</div><div className="font-mono text-lg font-black">{Math.min(draft.pickIndex+1,totalPicks)}/{totalPicks}</div></div></div><div className="mt-2 grid grid-cols-3 gap-2"><MiniStat label="Your Slot" value={mySlot?`#${mySlot}`:'—'}/><MiniStat label="Your Roster" value={`${myRoster.length}/20`}/><MiniStat label="Turn" value={onClockIsMe?'Your Pick':currentMember?.isAi?'CPU Picking':'Waiting'}/></div></div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_.65fr]">
      <section className="min-w-0"><div className={`rounded-xl border p-3 text-center text-xs font-black uppercase ${canPick?'border-emerald-400/30 bg-emerald-400/[.08] text-emerald-300':'border-white/10 bg-[#101318] text-zinc-400'}`}>{canPick?'You are on the clock—select one player.':currentMember?.isAi?'CPU manager is selecting automatically…':`Waiting for ${currentMember?.userName||'the next manager'} to pick.`}</div><div className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search available players…" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#101318] pl-10 pr-3 text-sm font-bold outline-none focus:border-[#D4AF37]/50"/></div><select aria-label="Position group" value={group} onChange={event=>setGroup(event.target.value as DraftGroup|'ALL')} className="min-h-12 rounded-xl border border-white/10 bg-[#101318] px-3 text-xs font-black text-white"><option value="ALL">All Positions</option>{GROUPS.map(item=><option key={item} value={item}>{item}</option>)}</select></div><div className="mt-3 space-y-2">{available.map(player=><button key={player.id} onClick={()=>void makePick(player)} disabled={!canPick} className="grid w-full grid-cols-[48px_minmax(0,1fr)_72px] items-center gap-3 rounded-2xl border border-white/10 bg-[#101318] p-3 text-left disabled:cursor-not-allowed disabled:opacity-45"><div className="h-12 w-12 overflow-hidden rounded-full bg-white/5">{playerPortraitUrl(player)?<img src={playerPortraitUrl(player)} alt="" className="h-full w-full object-cover"/>:null}</div><div className="min-w-0"><div className="truncate font-black">{player.name}</div><div className="text-xs font-semibold text-zinc-500">{player.position} · {player.team}</div></div><div className="rounded-xl bg-[#D4AF37] py-2 text-center text-black"><div className="text-lg font-black">{player.ovr}</div><div className="text-[8px] font-black">DRAFT</div></div></button>)}</div></section>

      <aside className="space-y-3"><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div className="text-xs font-black uppercase text-[#D4AF37]">Your Roster</div><div className="text-xs font-black">{myRoster.length}/20</div></div><div className="mt-2 text-[10px] leading-5 text-zinc-500">{GROUPS.map(item=>`${item} ${myCounts[item]||0}/${ROSTER_REQUIREMENTS[item]}`).join(' · ')}</div><div className="mt-3 space-y-1">{myPicks.map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);return <div key={pick.overall} className="flex justify-between rounded-lg bg-black/30 px-2 py-2 text-xs"><span className="truncate"><b>{player?.position}</b> {player?.name}</span><b>{player?.ovr}</b></div>})}</div></div><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#D4AF37]"><Clock3 className="h-4 w-4"/>Recent Picks</div><div className="mt-3 space-y-2">{draft.picks.slice(-10).reverse().map(pick=>{const player=PLAYER_BY_ID.get(pick.playerId);const member=activeLeague.members.find(item=>item.id===pick.memberId);return <div key={pick.overall} className="text-xs"><div className="font-black">#{pick.overall} · {member?.userName}</div><div className="truncate text-zinc-500">{player?.name} · {player?.position}</div></div>})}</div></div><div className="flex items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] p-3 text-[11px] leading-5 text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>The locked order controls Round 1. Every even round reverses automatically for a true snake draft.</div></aside>
    </div>
  </div></div>;
};

const MiniStat=({label,value}:{label:string;value:string})=><div className="rounded-lg bg-black/30 p-2 text-center"><div className="text-[8px] font-black uppercase tracking-wider text-zinc-600">{label}</div><div className="mt-1 truncate text-[10px] font-black uppercase">{value}</div></div>;
