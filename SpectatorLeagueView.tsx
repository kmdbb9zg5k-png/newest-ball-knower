import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Eye,Flame,History,Trophy,Users} from 'lucide-react';
import {League} from './types';
import {fetchSpectatorLeague} from './spectatorCloud';
import {buildLeagueNews,buildLeagueRecords,buildPowerRankings,buildRivalries,buildStorylines} from './leagueIntelligence';

export const SpectatorLeagueView:React.FC<{slug:string}>=({slug})=>{
 const [league,setLeague]=useState<League|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 useEffect(()=>{let alive=true;(async()=>{try{const data=await fetchSpectatorLeague(slug);if(!alive)return;if(!data)throw new Error('This spectator link is unavailable or has been disabled.');setLeague(data);}catch(e:any){if(alive)setError(e?.message||'Could not load this league.');}finally{if(alive)setLoading(false);}})();return()=>{alive=false};},[slug]);
 if(loading)return <Shell><div className="py-24 text-center text-xs font-black uppercase tracking-[.2em] text-zinc-500">Loading league broadcast…</div></Shell>;
 if(error||!league)return <Shell><div className="mx-auto max-w-xl py-24 text-center"><Eye className="mx-auto h-9 w-9 text-zinc-600"/><h1 className="mt-4 text-2xl font-black uppercase">Broadcast unavailable</h1><p className="mt-2 text-sm text-zinc-500">{error||'This league is not public.'}</p><HomeButton/></div></Shell>;
 return <SpectatorContent league={league}/>;
};

const SpectatorContent=({league}:{league:League})=>{
 const rankings=useMemo(()=>buildPowerRankings(league),[league]);const rivalries=useMemo(()=>buildRivalries(league),[league]);const records=useMemo(()=>buildLeagueRecords(league),[league]);const stories=useMemo(()=>buildStorylines(league,rivalries,[]),[league,rivalries]);const news=useMemo(()=>buildLeagueNews(league,stories,[],records),[league,stories,records]);const standings=league.seasonResult?.standings||[];const games=league.seasonResult?.games||[];const weeks=[...new Set(games.map(g=>g.week))].sort((a,b)=>a-b);const memberName=(id:string)=>league.members.find(m=>m.id===id)?.userName||'Owner';
 return <Shell><div className="space-y-6 py-6">
  <section className="overflow-hidden rounded-[2rem] border border-[#D4AF37]/25 bg-[radial-gradient(circle_at_82%_15%,rgba(212,175,55,.22),transparent_25%),linear-gradient(120deg,#080a0d,#12161d_58%,#090a0c)] p-6 sm:p-9"><div className="text-[10px] font-black uppercase tracking-[.28em] text-[#D4AF37]">Ball Knower Live · Spectator Mode</div><h1 className="mt-2 font-display text-4xl font-black uppercase sm:text-6xl">{league.name}</h1><p className="mt-2 text-sm font-semibold text-zinc-400">Commissioner {league.commissionerName} · {league.members.length} teams · {league.settings?.seasonGames||17}-game season</p><div className="mt-6 grid grid-cols-3 gap-2"><Metric label="Status" value={league.status.toUpperCase()}/><Metric label="Teams" value={String(league.members.length)}/><Metric label="Cap" value={`$${league.salaryCap}M`}/></div></section>

  <section className="space-y-3"><Header icon={<Flame className="h-4 w-4"/>} title="Power Rankings"/><div className="space-y-2">{rankings.map(r=><div key={r.memberId} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="text-xl font-black text-[#D4AF37]">#{r.rank}</div><div><div className="font-black uppercase">{r.memberName}</div><div className="mt-1 text-[10px] text-zinc-500">{r.reason}</div></div><div className="text-xl font-black">{r.score}</div></div>)}</div></section>

  <section className="space-y-3"><Header icon={<Users className="h-4 w-4"/>} title="Standings"/>{standings.length?<div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101318]">{standings.map((s,i)=><div key={s.memberId} className="grid grid-cols-[34px_1fr_auto_auto] items-center gap-3 border-b border-white/5 p-3 last:border-0"><div className="text-xs font-black text-zinc-600">{i+1}</div><div className="font-black uppercase">{s.memberName}</div><div className="text-xs font-black">{s.wins}-{s.losses}{s.ties?`-${s.ties}`:''}</div><div className="text-xs font-black text-[#D4AF37]">{s.teamRating}</div></div>)}</div>:<Empty text="Standings appear when the season begins."/>}</section>

  <section className="space-y-3"><Header icon={<Eye className="h-4 w-4"/>} title="Around The League"/>{news.slice(0,6).map((n,i)=><article key={i} className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="text-[9px] font-black uppercase text-[#D4AF37]">{n.kind}</div><div className="mt-1 text-lg font-black uppercase">{n.headline}</div><p className="mt-2 text-xs leading-relaxed text-zinc-400">{n.body}</p></article>)}</section>

  <section className="space-y-3"><Header icon={<Trophy className="h-4 w-4"/>} title="Weekly Scoreboard"/>{weeks.length?weeks.map(week=><div key={week} className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="mb-3 text-xs font-black uppercase text-[#D4AF37]">Week {week}</div><div className="grid gap-2 sm:grid-cols-2">{games.filter(g=>g.week===week).map(g=><div key={g.id} className="rounded-xl bg-black/30 p-3"><div className="flex justify-between text-xs font-black"><span>{memberName(g.awayMemberId)}</span><span>{g.awayScore}</span></div><div className="mt-1 flex justify-between text-xs font-black"><span>{memberName(g.homeMemberId)}</span><span>{g.homeScore}</span></div></div>)}</div></div>):<Empty text="Weekly scores appear after games are simulated."/>}</section>

  <section className="space-y-3"><Header icon={<History className="h-4 w-4"/>} title="Records Book"/><div className="grid gap-3 sm:grid-cols-2">{records.map(r=><div key={r.label} className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="text-[9px] font-black uppercase text-[#D4AF37]">{r.label}</div><div className="mt-1 text-2xl font-black">{r.value}</div><div className="text-sm font-black uppercase">{r.holder}</div><div className="mt-2 text-xs text-zinc-500">{r.detail}</div></div>)}</div>{!records.length&&<Empty text="Records unlock after a completed season."/>}</section>
  <div className="pb-8 text-center"><HomeButton/></div>
 </div></Shell>;
};

const Shell=({children}:{children:React.ReactNode})=><div className="min-h-[100dvh] bg-[#07090c] px-3 text-white sm:px-6"><div className="mx-auto max-w-5xl">{children}</div></div>;
const Header=({icon,title}:{icon:React.ReactNode;title:string})=><div className="flex items-center gap-2 text-xl font-black uppercase">{icon}<span>{title}</span></div>;
const Metric=({label,value}:{label:string;value:string})=><div className="rounded-xl bg-black/30 p-3 text-center"><div className="text-[8px] font-black uppercase text-zinc-600">{label}</div><div className="mt-1 text-xs font-black sm:text-sm">{value}</div></div>;
const Empty=({text}:{text:string})=><div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-zinc-600">{text}</div>;
const HomeButton=()=> <button onClick={()=>{window.location.href=window.location.origin;}} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#D4AF37] px-5 text-xs font-black uppercase text-black"><ArrowLeft className="h-4 w-4"/>Open Ball Knower</button>;
