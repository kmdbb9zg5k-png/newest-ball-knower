import React,{useMemo,useState} from 'react';
import {Brain,Flame,Gamepad2,Medal,MessageSquareQuote,Play,ShieldQuestion,Swords,Target,Trophy} from 'lucide-react';

type Mode='trivia'|'film'|'picks'|'debates'|'gauntlet';
const modes:{id:Mode;label:string;sub:string;icon:React.ReactNode}[]=[
{id:'trivia',label:'Trivia',sub:'Rookie → Hall of Fame',icon:<Brain className="h-5 w-5"/>},
{id:'film',label:'Film Room',sub:'Read coverages & situations',icon:<Gamepad2 className="h-5 w-5"/>},
{id:'picks',label:'Predictions',sub:'Make weekly football calls',icon:<Target className="h-5 w-5"/>},
{id:'debates',label:'Debates',sub:'Start / Bench / Cut & blind resumes',icon:<MessageSquareQuote className="h-5 w-5"/>},
{id:'gauntlet',label:'Gauntlet',sub:'Keep going until you miss',icon:<Flame className="h-5 w-5"/>},
];

const triviaTiers=[
{name:'ROOKIE',tone:'emerald',desc:'Stars, teams, Super Bowls and basic records.',xp:'1× XP',locked:false},
{name:'PRO',tone:'sky',desc:'Draft history, coaches, playoff moments and tougher stats.',xp:'1.5× XP',locked:false},
{name:'ALL-PRO',tone:'violet',desc:'Deep roster knowledge, obscure seasons and advanced comparisons.',xp:'2× XP',locked:false},
{name:'HALL OF FAME',tone:'amber',desc:'Brutal NFL history, exact stat lines and rare record knowledge.',xp:'3× XP',locked:false},
];

const sampleQuestions=[
{tier:'ROOKIE',question:'Which team won Super Bowl LIX?',answers:['Philadelphia Eagles','Kansas City Chiefs','Buffalo Bills','Detroit Lions'],correct:0},
{tier:'PRO',question:'Which quarterback was selected 24th overall in the 2005 NFL Draft?',answers:['Aaron Rodgers','Jason Campbell','Alex Smith','Kyle Orton'],correct:0},
{tier:'ALL-PRO',question:'Which player set the single-game receiving yardage record with 336 yards?',answers:['Flipper Anderson','Calvin Johnson','Julio Jones','Jerry Rice'],correct:0},
{tier:'HALL OF FAME',question:'Who led the NFL in rushing yards during the 1990 regular season?',answers:['Barry Sanders','Thurman Thomas','Emmitt Smith','Christian Okoye'],correct:0},
];

export const ChallengesHub:React.FC=()=>{
 const [mode,setMode]=useState<Mode>('trivia');
 const [tier,setTier]=useState('ROOKIE');
 const [selected,setSelected]=useState<number|null>(null);
 const sample=useMemo(()=>sampleQuestions.find(q=>q.tier===tier)||sampleQuestions[0],[tier]);
 return <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
  <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_80%_10%,rgba(212,175,55,.18),transparent_28%),#090c11] p-5 sm:p-8">
   <div className="text-[10px] font-black uppercase tracking-[.28em] text-[#D4AF37]">Challenges Hub</div>
   <h1 className="mt-2 font-display text-4xl font-black uppercase sm:text-6xl">Prove You Know Ball.</h1>
   <p className="mt-3 max-w-3xl text-sm font-semibold text-zinc-400">Trivia, Film Room, weekly picks, debates and gauntlets live here — one hub instead of a hundred tabs.</p>
  </section>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{modes.map(m=><button key={m.id} onClick={()=>setMode(m.id)} className={`rounded-2xl border p-4 text-left transition ${mode===m.id?'border-[#D4AF37]/50 bg-[#D4AF37]/10':'border-white/10 bg-[#101318] hover:border-white/20'}`}><div className="text-[#D4AF37]">{m.icon}</div><div className="mt-3 text-xs font-black uppercase">{m.label}</div><div className="mt-1 text-[10px] leading-4 text-zinc-500">{m.sub}</div></button>)}</div>
  {mode==='trivia'&&<section className="space-y-5"><div className="grid gap-3 md:grid-cols-4">{triviaTiers.map(t=><button key={t.name} onClick={()=>{setTier(t.name);setSelected(null)}} className={`rounded-[1.5rem] border p-5 text-left ${tier===t.name?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/10 bg-[#101318]'}`}><div className="flex items-center justify-between"><Trophy className="h-5 w-5 text-[#D4AF37]"/><span className="text-[9px] font-black uppercase text-zinc-500">{t.xp}</span></div><div className="mt-4 font-display text-2xl font-black uppercase">{t.name}</div><div className="mt-2 text-xs leading-5 text-zinc-500">{t.desc}</div></button>)}</div>
   <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-[#0c0f14] p-5 sm:p-7"><div className="flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#D4AF37]">{sample.tier}</div><div className="mt-1 text-[10px] font-bold uppercase text-zinc-600">Question preview · 4 believable answers</div></div><div className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-zinc-400">0:20</div></div><h2 className="mt-5 text-xl font-black leading-tight sm:text-2xl">{sample.question}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{sample.answers.map((a,i)=>{const answered=selected!==null;const correct=i===sample.correct;const chosen=i===selected;return <button key={a} onClick={()=>setSelected(i)} className={`min-h-16 rounded-2xl border px-4 text-left text-sm font-black ${answered&&correct?'border-emerald-400 bg-emerald-400/10 text-emerald-300':answered&&chosen?'border-red-400 bg-red-400/10 text-red-300':'border-white/10 bg-white/[.03] hover:border-[#D4AF37]/40'}`}><span className="mr-3 text-[#D4AF37]">{String.fromCharCode(65+i)}.</span>{a}</button>})}</div>{selected!==null&&<div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-zinc-400">{selected===sample.correct?'Correct. That is Ball Knower behavior.':'Not this time. The correct answer is highlighted above.'} Every real question will include a short explanation so users learn, not just tap.</div>}</div>
  </section>}
  {mode==='film'&&<FeaturePanel icon={<ShieldQuestion className="h-7 w-7"/>} title="Film Room" text="Situational football questions: coverage recognition, pressure looks, down-and-distance decisions, route concepts and clock management. Difficulty scales from obvious reads to coordinator-level decisions."/>}
  {mode==='picks'&&<FeaturePanel icon={<Target className="h-7 w-7"/>} title="Prediction Picks" text="Weekly football predictions tracked as skill stats: winners, stat leaders and matchup calls. No wagering — accuracy feeds the Ball Knower profile and seasonal challenge score."/>}
  {mode==='debates'&&<FeaturePanel icon={<Swords className="h-7 w-7"/>} title="Debate Arena" text="Start / Bench / Cut, blind resumes, community polls and saved receipts. Vote first, reveal community percentages after, and keep old takes on the profile."/>}
  {mode==='gauntlet'&&<FeaturePanel icon={<Flame className="h-7 w-7"/>} title="Ball Knower Gauntlet" text="Endless questions until the first miss. Separate Rookie, Pro, All-Pro and HOF ladders, daily streaks and leaderboard records make this the purest flex mode in the app."/>}
 </div>;
};

const FeaturePanel=({icon,title,text}:{icon:React.ReactNode;title:string;text:string})=><div className="rounded-[2rem] border border-white/10 bg-[#0d1015] p-6 sm:p-8"><div className="text-[#D4AF37]">{icon}</div><div className="mt-4 font-display text-3xl font-black uppercase">{title}</div><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{text}</p><div className="mt-6 flex flex-wrap gap-2"><Badge icon={<Medal className="h-3.5 w-3.5"/>} text="Ratings"/><Badge icon={<Trophy className="h-3.5 w-3.5"/>} text="Leaderboards"/><Badge icon={<Play className="h-3.5 w-3.5"/>} text="Daily Challenges"/></div></div>;
const Badge=({icon,text}:{icon:React.ReactNode;text:string})=><span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] font-black uppercase text-zinc-400">{icon}{text}</span>;
