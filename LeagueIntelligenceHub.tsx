import React,{useEffect,useMemo,useState} from 'react';
import {Award,Crown,Eye,Flame,History,Medal,Newspaper,Share2,Shield,Star,Trophy,Users} from 'lucide-react';
import {League} from './types';
import {useBallKnower} from './BallKnowerContext';
import {fetchSeasonOperations,LeagueTransaction} from './fantasySeasonCloud';
import {fetchOwnerProfiles,OwnerProfile,setSpectatorMode} from './spectatorCloud';
import {buildAchievements,buildAwards,buildDraftGrades,buildLeagueNews,buildLeagueRecords,buildOwnerReputation,buildPowerRankings,buildRivalries,buildStorylines} from './leagueIntelligence';

type Tab='news'|'rankings'|'grades'|'awards'|'owners'|'rivalries'|'records'|'spectator';
const tabs:{id:Tab;label:string;icon:React.ReactNode}[]=[
{id:'news',label:'League News',icon:<Newspaper className="h-4 w-4"/>},{id:'rankings',label:'Power Rankings',icon:<Flame className="h-4 w-4"/>},{id:'grades',label:'Draft Grades',icon:<Award className="h-4 w-4"/>},{id:'awards',label:'Awards',icon:<Medal className="h-4 w-4"/>},{id:'owners',label:'Owner Ratings',icon:<Users className="h-4 w-4"/>},{id:'rivalries',label:'Rivalries',icon:<Shield className="h-4 w-4"/>},{id:'records',label:'Records',icon:<History className="h-4 w-4"/>},{id:'spectator',label:'Spectator',icon:<Eye className="h-4 w-4"/>},
];

export const LeagueIntelligenceHub:React.FC<{league:League}>=({league})=>{
 const {currentUser,showToast}=useBallKnower();
 const [tab,setTab]=useState<Tab>('news');
 const [transactions,setTransactions]=useState<LeagueTransaction[]>([]);
 const [profiles,setProfiles]=useState<OwnerProfile[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const operational=league as League & {spectatorEnabled?:boolean;publicSlug?:string};
 const [spectatorEnabled,setSpectatorEnabled]=useState(Boolean(operational.spectatorEnabled));
 const [publicSlug,setPublicSlug]=useState(operational.publicSlug||'');
 const isCommissioner=currentUser?.id===league.commissionerId;

 useEffect(()=>{
  setSpectatorEnabled(Boolean(operational.spectatorEnabled));
  setPublicSlug(operational.publicSlug||'');
 },[league.id,operational.spectatorEnabled,operational.publicSlug]);

 useEffect(()=>{let alive=true;(async()=>{try{const ops=await fetchSeasonOperations(league.id);if(!alive)return;setTransactions([...ops.transactions]);const ids=league.members.filter(m=>!m.isAi&&m.userId).map(m=>m.userId);const p=await fetchOwnerProfiles(ids);if(alive)setProfiles(p);}catch(e:any){if(alive)setError(e?.message||'Could not load league intelligence.');}})();return()=>{alive=false};},[league.id,league.members.length]);

 const rankings=useMemo(()=>buildPowerRankings(league),[league]);
 const grades=useMemo(()=>buildDraftGrades(league),[league]);
 const awards=useMemo(()=>buildAwards(league),[league]);
 const rivalries=useMemo(()=>buildRivalries(league),[league]);
 const achievements=useMemo(()=>buildAchievements(league,transactions),[league,transactions]);
 const reputations=useMemo(()=>buildOwnerReputation(league,achievements),[league,achievements]);
 const records=useMemo(()=>buildLeagueRecords(league),[league]);
 const storylines=useMemo(()=>buildStorylines(league,rivalries,transactions),[league,rivalries,transactions]);
 const news=useMemo(()=>buildLeagueNews(league,storylines,awards,records),[league,storylines,awards,records]);
 const profileMap=new Map(profiles.map(p=>[p.authUserId,p]));
 const shareUrl=publicSlug?`${window.location.origin}?spectate=${encodeURIComponent(publicSlug)}`:'';

 const toggleSpectator=async()=>{if(!isCommissioner)return;setBusy(true);try{const next=!spectatorEnabled;const slug=await setSpectatorMode(league.id,next);setSpectatorEnabled(next);if(slug)setPublicSlug(slug);showToast(next?'Spectator Mode is live.':'Spectator Mode disabled.');}catch(e:any){showToast(e?.message||'Could not update spectator mode.');}finally{setBusy(false)}};
 const copyShare=async()=>{try{await navigator.clipboard.writeText(shareUrl);showToast('Spectator link copied.');}catch{showToast('Copy failed. Press and hold the link to copy it.');}};

 return <section className="space-y-5">
  <div className="overflow-hidden rounded-[1.75rem] border border-[#D4AF37]/25 bg-[radial-gradient(circle_at_85%_15%,rgba(212,175,55,.16),transparent_25%),#0b0e12] p-5 sm:p-7">
   <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[.24em] text-[#D4AF37]">Ball Knower Intelligence</div><h2 className="mt-2 font-display text-3xl font-black uppercase sm:text-5xl">Make every league matter.</h2><p className="mt-2 max-w-2xl text-sm font-semibold text-zinc-400">Rankings, receipts, reputations, awards, rivalries and storylines generated from what actually happens in this league.</p></div><Star className="h-8 w-8 shrink-0 text-[#D4AF37]"/></div>
  </div>
  <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0d1015] p-2 no-scrollbar">{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-[10px] font-black uppercase tracking-wider ${tab===t.id?'bg-[#D4AF37] text-black':'text-zinc-400 hover:bg-white/5'}`}>{t.icon}{t.label}</button>)}</div>
  {error&&<div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-xs font-bold text-red-300">{error}</div>}

  {tab==='news'&&<div className="space-y-3"><Header title="Around The League" sub="Auto-generated headlines and season storylines from real league events"/>{news.map((n,i)=><article key={`${n.headline}-${i}`} className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">{n.kind}</div><h3 className="mt-1 text-lg font-black uppercase">{n.headline}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-400">{n.body}</p></article>)}</div>}

  {tab==='rankings'&&<div className="space-y-3"><Header title="Weekly Power Rankings" sub="Preseason uses fantasy lineup strength; weekly results add record, scoring and point differential"/>{rankings.map(r=><div key={r.memberId} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="text-center"><div className="text-2xl font-black text-[#D4AF37]">#{r.rank}</div><div className={`text-[9px] font-black ${r.movement>0?'text-emerald-400':r.movement<0?'text-red-400':'text-zinc-600'}`}>{r.movement>0?`▲${r.movement}`:r.movement<0?`▼${Math.abs(r.movement)}`:'—'}</div></div><div><div className="font-black uppercase">{r.memberName}</div><p className="mt-1 text-[11px] text-zinc-500">{r.reason}</p></div><div className="text-right"><div className="text-xl font-black">{r.score}</div><div className="text-[9px] text-zinc-600">POWER</div></div></div>)}</div>}

  {tab==='grades'&&<div className="space-y-3"><Header title="Draft Report Cards" sub="Roster quality, balance, cap efficiency and value picks"/>{grades.map((g,i)=><div key={g.memberId} className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-black uppercase text-zinc-600">League Rank #{i+1}</div><h3 className="text-lg font-black uppercase">{g.memberName}</h3></div><div className="text-4xl font-black text-[#D4AF37]">{g.grade}</div></div><p className="mt-3 text-xs text-zinc-400">{g.summary}</p><div className="mt-4 grid gap-2 sm:grid-cols-3"><Mini label="Score" value={String(g.score)}/><Mini label="Balance" value={String(g.balance)}/><Mini label="Cap Efficiency" value={String(g.capEfficiency)}/></div>{g.bestPick&&<p className="mt-3 text-[11px] text-emerald-400">Best value: <b>{g.bestPick.name}</b> ({g.bestPick.ovr} OVR / ${g.bestPick.salary}M)</p>}{g.worstValue&&<p className="mt-1 text-[11px] text-amber-400">Toughest spend: <b>{g.worstValue.name}</b> (${g.worstValue.salary}M)</p>}</div>)}</div>}

  {tab==='awards'&&<div className="space-y-4"><Header title="Ball Knower Awards" sub="Season honors use roster quality plus winning context"/><div className="grid gap-3 md:grid-cols-2">{awards.map(a=><div key={a.award} className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5"><Trophy className="h-5 w-5 text-[#D4AF37]"/><div className="mt-3 text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">{a.award}</div><div className="mt-1 text-xl font-black uppercase">{a.player.name}</div><div className="text-xs font-bold text-zinc-500">{a.memberName} · {a.player.position} · {a.player.ovr} OVR</div><p className="mt-3 text-xs text-zinc-400">{a.reason}</p></div>)}</div></div>}

  {tab==='owners'&&<div className="space-y-4"><Header title="Owner Reputation" sub="Your Ball Knower Rating follows you beyond one roster or one season"/>{reputations.map((r,i)=>{const member=league.members.find(m=>m.id===r.memberId);const career=member?profileMap.get(member.userId):undefined;return <div key={r.memberId} className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-black uppercase text-zinc-600">Owner Rank #{i+1}</div><div className="text-lg font-black uppercase">{r.memberName}</div><div className="mt-1 text-[10px] font-black text-[#D4AF37]">{r.tier}</div></div><div className="text-right"><div className="text-4xl font-black">{career?.ballKnowerRating??r.rating}</div><div className="text-[9px] text-zinc-600">BALL KNOWER RATING</div></div></div><p className="mt-3 text-xs text-zinc-400">{r.reason}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label="This League" value={r.record}/><Mini label="Badges" value={String(r.achievements)}/><Mini label="Career Wins" value={String(career?.careerWins??0)}/><Mini label="Titles" value={String(career?.championships??r.championships)}/></div><div className="mt-3 flex flex-wrap gap-2">{achievements.filter(a=>a.memberId===r.memberId).map(a=><span key={a.id} title={a.description} className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[9px] font-black uppercase">{a.emoji} {a.title}</span>)}</div></div>})}</div>}
  {tab==='rivalries'&&<div className="space-y-3"><Header title="Rivalry Tracker" sub="Head-to-head records turn repeated matchups into history"/>{rivalries.length?rivalries.map(r=><div key={`${r.aId}-${r.bId}`} className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-widest text-red-400">{r.label} · HEAT {r.heat}</div><div className="mt-1 text-lg font-black uppercase">{r.aName} <span className="text-zinc-600">vs</span> {r.bName}</div></div><Flame className="h-6 w-6 text-red-400"/></div><div className="mt-4 grid grid-cols-3 gap-2"><Mini label={r.aName} value={String(r.aWins)}/><Mini label="Meetings" value={String(r.games)}/><Mini label={r.bName} value={String(r.bWins)}/></div></div>):<Empty text="Rivalries begin building once league games are played."/>}</div>}

  {tab==='records'&&<div className="space-y-4"><Header title="League Records Book" sub="The numbers people will argue about next season"/><div className="grid gap-3 sm:grid-cols-2">{records.map(r=><div key={r.label} className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="text-[9px] font-black uppercase text-[#D4AF37]">{r.label}</div><div className="mt-1 text-2xl font-black">{r.value}</div><div className="mt-1 text-sm font-black uppercase">{r.holder}</div><div className="mt-2 text-xs text-zinc-500">{r.detail}</div></div>)}</div>{!records.length&&<Empty text="League records unlock after a completed season."/>}</div>}

  {tab==='spectator'&&<div className="space-y-4"><Header title="Spectator Mode" sub="Share the league without giving somebody a roster spot"/><div className="rounded-2xl border border-white/10 bg-[#101318] p-5"><div className="flex items-center justify-between gap-4"><div><div className="font-black uppercase">Public League View</div><p className="mt-1 text-xs text-zinc-500">Shows standings, ratings, weekly scores, rankings, playoffs, awards and records. Private roster contents stay hidden.</p></div>{isCommissioner?<button disabled={busy} onClick={()=>void toggleSpectator()} className={`min-h-11 rounded-xl px-4 text-[10px] font-black uppercase ${spectatorEnabled?'bg-emerald-500 text-black':'bg-white text-black'}`}>{spectatorEnabled?'LIVE':'ENABLE'}</button>:<div className="text-[10px] font-black uppercase text-zinc-500">Commissioner control</div>}</div>{spectatorEnabled&&shareUrl&&<div className="mt-4 rounded-xl bg-black/35 p-3"><div className="break-all font-mono text-[11px] text-[#D4AF37]">{shareUrl}</div><button onClick={()=>void copyShare()} className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase"><Share2 className="h-3.5 w-3.5"/>Copy spectator link</button></div>}</div></div>}
 </section>;
};

const Header=({title,sub}:{title:string;sub:string})=><div><h3 className="font-display text-2xl font-black uppercase">{title}</h3><p className="mt-1 text-xs font-semibold text-zinc-500">{sub}</p></div>;
const Mini=({label,value}:{label:string;value:string})=><div className="rounded-xl bg-black/30 p-3 text-center"><div className="text-[8px] font-black uppercase text-zinc-600">{label}</div><div className="mt-1 text-sm font-black">{value}</div></div>;
const Empty=({text}:{text:string})=><div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs font-semibold text-zinc-600">{text}</div>;
