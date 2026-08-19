import React, { useMemo, useState } from 'react';
import { ArrowLeft, Bot, Camera, ChevronRight, Crown, DraftingCompass, Gamepad2, ImagePlus, Shield, Sparkles, Trophy, Users } from 'lucide-react';
import { SoloMode } from './SoloMode';
import { PLAYERS_DATABASE } from './players';
import { Player, ROSTER_REQUIREMENTS } from './types';
import { getDraftPositionGroup, validateRosterShape } from './rosterRules';
import { playerPortraitUrl } from './playerPortraits';
import { teamLogoUrl } from './teamTheme';

type SoloRoute='hub'|'cap'|'fantasy'|'real-team'|'career';

const RUN_KEY='ballknower_solo_run_v1';
const TEAM_OPTIONS=[
 ['ARI','Arizona Cardinals'],['ATL','Atlanta Falcons'],['BAL','Baltimore Ravens'],['BUF','Buffalo Bills'],['CAR','Carolina Panthers'],['CHI','Chicago Bears'],['CIN','Cincinnati Bengals'],['CLE','Cleveland Browns'],['DAL','Dallas Cowboys'],['DEN','Denver Broncos'],['DET','Detroit Lions'],['GB','Green Bay Packers'],['HOU','Houston Texans'],['IND','Indianapolis Colts'],['JAX','Jacksonville Jaguars'],['KC','Kansas City Chiefs'],['LV','Las Vegas Raiders'],['LAC','Los Angeles Chargers'],['LAR','Los Angeles Rams'],['MIA','Miami Dolphins'],['MIN','Minnesota Vikings'],['NE','New England Patriots'],['NO','New Orleans Saints'],['NYG','New York Giants'],['NYJ','New York Jets'],['PHI','Philadelphia Eagles'],['PIT','Pittsburgh Steelers'],['SF','San Francisco 49ers'],['SEA','Seattle Seahawks'],['TB','Tampa Bay Buccaneers'],['TEN','Tennessee Titans'],['WAS','Washington Commanders']
] as const;

const saveRosterAndStart=(roster:Player[])=>{
 localStorage.setItem(RUN_KEY,JSON.stringify({stage:'regular',roster,bench:[],weeks:[],injuries:[],playoffs:[],settings:{difficulty:'pro',injuries:'normal'}}));
};

const buildRealTeamRoster=(abbr:string)=>{
 const pool=PLAYERS_DATABASE.filter(p=>p.team===abbr);
 const roster:Player[]=[];
 Object.entries(ROSTER_REQUIREMENTS).forEach(([group,count])=>{
   const matches=pool.filter(p=>getDraftPositionGroup(p)===group).sort((a,b)=>b.ovr-a.ovr);
   roster.push(...matches.slice(0,Number(count)));
 });
 return roster;
};

const ModeCard:React.FC<{title:string;eyebrow:string;description:string;icon:React.ReactNode;onClick:()=>void;featured?:boolean;tag?:string}>=({title,eyebrow,description,icon,onClick,featured,tag})=>(
 <button onClick={onClick} className={`group text-left rounded-3xl border p-5 sm:p-6 min-h-[190px] flex flex-col justify-between transition-all active:scale-[.99] ${featured?'border-[var(--bk-team-accent)]/50 bg-[var(--bk-team-accent)]/10 shadow-[0_0_40px_rgba(255,180,0,.08)]':'border-white/10 bg-[#111116]/90 hover:border-white/20'}`}>
  <div className="flex items-start justify-between gap-4"><div className={`grid h-12 w-12 place-items-center rounded-2xl ${featured?'bg-[var(--bk-team-accent)] text-black':'bg-white/5 text-[var(--bk-team-accent)]'}`}>{icon}</div>{tag&&<span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[9px] font-black tracking-[.18em] text-zinc-300">{tag}</span>}</div>
  <div className="mt-5"><div className="text-[9px] font-black tracking-[.26em] text-[var(--bk-team-accent)]">{eyebrow}</div><div className="mt-1 text-xl sm:text-2xl font-black">{title}</div><p className="mt-2 text-sm leading-5 text-zinc-400">{description}</p><div className="mt-4 flex items-center gap-1 text-xs font-black text-white">OPEN <ChevronRight size={14} className="transition-transform group-hover:translate-x-1"/></div></div>
 </button>
);

const BackButton:React.FC<{onClick:()=>void}>=({onClick})=><button onClick={onClick} className="mb-5 flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#111116] px-4 text-xs font-black"><ArrowLeft size={16}/> SOLO HOME</button>;

const FantasyDraft:React.FC<{onBack:()=>void;onLaunch:()=>void}>=({onBack,onLaunch})=>{
 const [roster,setRoster]=useState<Player[]>([]);
 const [position,setPosition]=useState('ALL');
 const [query,setQuery]=useState('');
 const counts=useMemo(()=>roster.reduce<Record<string,number>>((acc,p)=>{const g=getDraftPositionGroup(p);acc[g]=(acc[g]||0)+1;return acc},{}),[roster]);
 const available=useMemo(()=>PLAYERS_DATABASE.filter(p=>!roster.some(r=>r.id===p.id)).filter(p=>position==='ALL'||getDraftPositionGroup(p)===position).filter(p=>!query||`${p.name} ${p.team} ${p.position}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.ovr-a.ovr).slice(0,60),[roster,position,query]);
 const add=(p:Player)=>{const group=getDraftPositionGroup(p);const max=Number((ROSTER_REQUIREMENTS as any)[group]||0);if(roster.length>=20||!max||(counts[group]||0)>=max)return;setRoster(prev=>[...prev,p]);};
 const remove=(id:string)=>setRoster(prev=>prev.filter(p=>p.id!==id));
 const valid=roster.length===20&&validateRosterShape(roster).length===0;
 const launch=()=>{if(!valid)return;saveRosterAndStart(roster);onLaunch();};
 const groups=['ALL',...Object.keys(ROSTER_REQUIREMENTS)];
 return <div className="mx-auto max-w-7xl px-4 sm:px-8 py-5 text-white"><BackButton onClick={onBack}/>
  <div className="rounded-3xl border border-white/10 bg-[#0d0d12]/95 p-5 sm:p-7"><div className="text-[10px] font-black tracking-[.28em] text-[var(--bk-team-accent)]">MADDEN-STYLE SOLO</div><h2 className="mt-1 text-3xl font-black">FANTASY DRAFT</h2><p className="mt-2 max-w-2xl text-sm text-zinc-400">No salary cap. Build a legal 20-player starting roster from the full NFL pool, then take that team straight into the 17-game Solo season and playoffs.</p>
   <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-[9px] font-black tracking-widest text-zinc-500">PICKS</div><div className="mt-1 text-2xl font-black">{roster.length}/20</div></div><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-[9px] font-black tracking-widest text-zinc-500">CAP</div><div className="mt-1 text-2xl font-black text-[var(--bk-team-accent)]">OFF</div></div></div>
   {roster.length>0&&<div className="mt-5 flex gap-2 overflow-x-auto pb-2">{roster.map(p=><button key={p.id} onClick={()=>remove(p.id)} className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left"><div className="text-xs font-black">{p.name}</div><div className="text-[10px] text-zinc-500">{p.position} · {p.ovr} OVR · tap to remove</div></button>)}</div>}
   <div className="mt-5 flex gap-2 overflow-x-auto pb-2">{groups.map(g=><button key={g} onClick={()=>setPosition(g)} className={`min-h-11 shrink-0 rounded-xl border px-4 text-xs font-black ${position===g?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-black':'border-white/10 bg-black/30'}`}>{g}</button>)}</div>
   <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players..." className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none focus:border-[var(--bk-team-accent)]"/>
   <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{available.map(p=>{const group=getDraftPositionGroup(p);const full=(counts[group]||0)>=Number((ROSTER_REQUIREMENTS as any)[group]||0);return <button key={p.id} disabled={full||roster.length>=20} onClick={()=>add(p)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#121218] p-3 text-left disabled:opacity-35"><img src={playerPortraitUrl(p)} alt="" className="h-12 w-12 rounded-full object-cover bg-white/5"/><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{p.name}</div><div className="text-[10px] font-bold text-zinc-500">{p.team} · {p.position}</div></div><div className="text-right"><div className="font-black">{p.ovr}</div><div className="text-[9px] text-zinc-500">OVR</div></div></button>})}</div>
   <button disabled={!valid} onClick={launch} className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--bk-team-accent)] px-5 text-sm font-black text-black disabled:opacity-35">START 17-GAME FRANCHISE</button>
  </div>
 </div>;
};

const RealTeamStart:React.FC<{onBack:()=>void;onLaunch:()=>void}>=({onBack,onLaunch})=>{
 const [selected,setSelected]=useState('PHI');
 const team=TEAM_OPTIONS.find(([abbr])=>abbr===selected)!;
 const roster=useMemo(()=>buildRealTeamRoster(selected),[selected]);
 const valid=roster.length===20&&validateRosterShape(roster).length===0;
 const launch=()=>{if(!valid)return;saveRosterAndStart(roster);onLaunch();};
 return <div className="mx-auto max-w-7xl px-4 sm:px-8 py-5 text-white"><BackButton onClick={onBack}/><div className="rounded-3xl border border-white/10 bg-[#0d0d12]/95 p-5 sm:p-7"><div className="text-[10px] font-black tracking-[.28em] text-[var(--bk-team-accent)]">FRANCHISE</div><h2 className="mt-1 text-3xl font-black">TAKE OVER A REAL TEAM</h2><p className="mt-2 text-sm text-zinc-400">Skip the draft and start with one NFL club's highest-rated legal Solo lineup.</p>
  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{TEAM_OPTIONS.map(([abbr,name])=><button key={abbr} onClick={()=>setSelected(abbr)} aria-label={name} className={`min-h-20 rounded-2xl border p-3 ${selected===abbr?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10':'border-white/10 bg-black/20'}`}><img src={teamLogoUrl(abbr)} alt="" className="mx-auto h-9 w-9 object-contain"/><div className="mt-2 text-[10px] font-black">{abbr}</div></button>)}</div>
  <div className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/25 p-4"><img src={teamLogoUrl(selected)} alt="" className="h-16 w-16 object-contain"/><div><div className="text-xs font-black text-[var(--bk-team-accent)]">SELECTED</div><div className="text-xl font-black">{team[1]}</div><div className="text-xs text-zinc-500">{roster.length}/20 starters ready</div></div></div>
  {!valid&&<div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">This team's current data cannot form a legal 20-player Solo lineup yet.</div>}
  <button disabled={!valid} onClick={launch} className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--bk-team-accent)] px-5 text-sm font-black text-black disabled:opacity-35">START AS {selected}</button>
 </div></div>;
};

const CareerLab:React.FC<{onBack:()=>void}>=({onBack})=>{
 const [name,setName]=useState('');const [position,setPosition]=useState('WR');const [prompt,setPrompt]=useState('');const [photo,setPhoto]=useState<string>('');
 const upload=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>setPhoto(String(reader.result||''));reader.readAsDataURL(file);};
 return <div className="mx-auto max-w-5xl px-4 sm:px-8 py-5 text-white"><BackButton onClick={onBack}/><div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><div className="rounded-3xl border border-white/10 bg-[#0d0d12]/95 p-5"><div className="aspect-[4/5] rounded-3xl border border-dashed border-white/15 bg-black/30 grid place-items-center overflow-hidden">{photo?<img src={photo} alt="Your uploaded face" className="h-full w-full object-cover"/>:<label className="flex cursor-pointer flex-col items-center gap-3 text-center text-zinc-400"><ImagePlus size={34}/><span className="text-sm font-black text-white">UPLOAD YOUR FACE</span><span className="max-w-[220px] text-xs">Choose a clear front-facing photo. Your image stays in this browser preview.</span><input type="file" accept="image/*" className="hidden" onChange={e=>upload(e.target.files?.[0])}/></label>}</div></div>
 <div className="rounded-3xl border border-white/10 bg-[#0d0d12]/95 p-5 sm:p-7"><div className="text-[10px] font-black tracking-[.28em] text-[var(--bk-team-accent)]">PLAYER CAREER · ALPHA</div><h2 className="mt-1 text-3xl font-black">CREATE YOUR PLAYER</h2><p className="mt-2 text-sm text-zinc-400">Build the player profile now. The AI body/visual transformation and full draft-story progression are the next backend step, so this screen does not pretend an image edit happened when it hasn't.</p>
 <div className="mt-5 grid gap-3 sm:grid-cols-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Player name" className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none"/><select value={position} onChange={e=>setPosition(e.target.value)} className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm"><option>QB</option><option>RB</option><option>WR</option><option>TE</option><option>CB</option><option>EDGE</option><option>LB</option><option>S</option></select></div>
 <label className="mt-4 block text-[10px] font-black tracking-[.18em] text-zinc-500">DESCRIBE YOUR LOOK</label><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder='Example: “add a tattoo sleeve, black visor, white arm tape”' className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm outline-none"/>
 <div className="mt-4 rounded-2xl border border-[var(--bk-team-accent)]/20 bg-[var(--bk-team-accent)]/5 p-4 text-xs leading-5 text-zinc-300"><Sparkles size={16} className="mb-2 text-[var(--bk-team-accent)]"/>Saved concept: <b>{name||'Your Player'}</b> · {position}. AI visual edits will connect here without splitting Player Career into a separate Solo franchise.</div>
 </div></div></div>;
};

export const SoloHub:React.FC=()=>{
 const [route,setRoute]=useState<SoloRoute>('hub');
 if(route==='cap')return <div><button onClick={()=>setRoute('hub')} className="ml-4 sm:ml-8 mt-4 flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#111116] px-4 text-xs font-black text-white"><ArrowLeft size={16}/> SOLO HOME</button><SoloMode/></div>;
 if(route==='fantasy')return <FantasyDraft onBack={()=>setRoute('hub')} onLaunch={()=>setRoute('cap')}/>;
 if(route==='real-team')return <RealTeamStart onBack={()=>setRoute('hub')} onLaunch={()=>setRoute('cap')}/>;
 if(route==='career')return <CareerLab onBack={()=>setRoute('hub')}/>;
 return <div className="mx-auto max-w-7xl px-4 sm:px-8 py-5 sm:py-8 text-white"><div className="rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,20,28,.96),rgba(7,7,10,.96))] p-5 sm:p-8 overflow-hidden relative"><div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--bk-team-accent)]/10 blur-3xl"/><div className="relative"><div className="text-[10px] font-black tracking-[.30em] text-[var(--bk-team-accent)]">SOLO</div><h1 className="mt-2 max-w-3xl text-4xl sm:text-6xl font-black leading-[.94]">YOUR LEAGUE.<br/><span className="text-[var(--bk-team-accent)]">YOUR WAY.</span></h1><p className="mt-4 max-w-2xl text-sm sm:text-base leading-6 text-zinc-400">One Solo home for every way you want to play Ball Knower. Draft from scratch, run a real team, build a no-cap fantasy roster, or create yourself for a future player career.</p><div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black tracking-[.14em] text-zinc-400"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">17-GAME SEASON</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">PLAYOFFS</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">SUPER BOWL</span></div></div></div>
 <div className="mt-5 grid gap-4 sm:grid-cols-2"><ModeCard featured eyebrow="ORIGINAL BALL KNOWER" title="Salary Cap Draft" description="The mode already built: draft a legal 20-player roster under the cap, then chase the Super Bowl." icon={<Trophy size={24}/>} onClick={()=>setRoute('cap')} tag="PLAY NOW"/><ModeCard eyebrow="NO CAP" title="Fantasy Draft" description="Madden-style roster building from the full player pool. No salary cap — just roster construction and football knowledge." icon={<DraftingCompass size={24}/>} onClick={()=>setRoute('fantasy')} tag="BETA"/><ModeCard eyebrow="FRANCHISE" title="Real NFL Team" description="Pick one of all 32 NFL teams, inherit its current players, and start the season immediately." icon={<Shield size={24}/>} onClick={()=>setRoute('real-team')} tag="PLAY NOW"/><ModeCard eyebrow="STORY MODE" title="Player Career" description="Upload your face, define your position and describe your look. This becomes the home for getting drafted and upgrading through games." icon={<Camera size={24}/>} onClick={()=>setRoute('career')} tag="ALPHA"/></div>
 <div className="mt-4 rounded-3xl border border-white/10 bg-[#0f0f14]/90 p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-[var(--bk-team-accent)]"><Crown size={22}/></div><div><div className="font-black">One Franchise System</div><div className="text-xs text-zinc-500">These modes live inside Solo instead of creating separate franchise tabs.</div></div></div></div>
 </div>;
};
