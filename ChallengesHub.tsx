import React,{useEffect,useState} from 'react';
import {Brain,Flame,Gamepad2,Loader2,Medal,MessageSquareQuote,Play,RefreshCw,ShieldQuestion,Swords,Target,Trophy} from 'lucide-react';
import {fetchTriviaQuestion,submitTriviaAnswer,TriviaAnswerResult,TriviaQuestion} from './progressionCloud';
import {ModeGuide} from './ModeGuide';

type Mode='trivia'|'film'|'picks'|'debates'|'gauntlet';
const modes:{id:Mode;label:string;sub:string;icon:React.ReactNode}[]=[
{id:'trivia',label:'Trivia',sub:'Rookie → Hall of Fame',icon:<Brain className="h-5 w-5"/>},
{id:'film',label:'Film Room',sub:'Read coverages & situations',icon:<Gamepad2 className="h-5 w-5"/>},
{id:'picks',label:'Predictions',sub:'Make weekly football calls',icon:<Target className="h-5 w-5"/>},
{id:'debates',label:'Debates',sub:'Start / Bench / Cut & blind resumes',icon:<MessageSquareQuote className="h-5 w-5"/>},
{id:'gauntlet',label:'Survivor',sub:'One miss ends your run',icon:<Flame className="h-5 w-5"/>},
];

const triviaTiers=[
{name:'ROOKIE',desc:'Stars, teams, Super Bowls and basic records.',xp:'15 XP'},
{name:'PRO',desc:'Draft history, coaches, playoff moments and tougher stats.',xp:'25 XP'},
{name:'ALL-PRO',desc:'Deep roster knowledge, obscure seasons and advanced comparisons.',xp:'40 XP'},
{name:'HALL OF FAME',desc:'Brutal NFL history, exact stat lines and rare record knowledge.',xp:'60 XP'},
];

export const ChallengesHub:React.FC=()=>{
 const [mode,setMode]=useState<Mode>('trivia');
 const [tier,setTier]=useState('ROOKIE');
 const [question,setQuestion]=useState<TriviaQuestion|null>(null);
 const [selected,setSelected]=useState<number|null>(null);
 const [result,setResult]=useState<TriviaAnswerResult|null>(null);
 const [loading,setLoading]=useState(false);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState('');

 const loadQuestion=async(nextTier=tier)=>{
   setLoading(true);setError('');setSelected(null);setResult(null);
   try{setQuestion(await fetchTriviaQuestion(nextTier));}
   catch(err){setQuestion(null);setError(err instanceof Error?err.message:'Could not load trivia right now.');}
   finally{setLoading(false);}
 };

 useEffect(()=>{void loadQuestion(tier);},[]);

 const chooseTier=(nextTier:string)=>{setTier(nextTier);void loadQuestion(nextTier);};
 const answer=async(index:number)=>{
   if(!question||selected!==null||submitting)return;
   setSelected(index);setSubmitting(true);setError('');
   try{setResult(await submitTriviaAnswer(question.attemptId,index));}
   catch(err){setSelected(null);setError(err instanceof Error?err.message:'Could not score that answer.');}
   finally{setSubmitting(false);}
 };

 return <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
  <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_80%_10%,rgba(212,175,55,.18),transparent_28%),#090c11] p-5 sm:p-8">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.28em] text-[#D4AF37]">Trivia · decisions · football IQ</div>
   <h1 className="mt-2 font-display text-4xl font-black uppercase sm:text-6xl">The Gauntlet</h1>
   <p className="mt-3 max-w-3xl text-sm font-semibold text-zinc-400">Answer football questions and complete quick challenges. Harder modes earn more XP.</p></div><ModeGuide storageKey="bk-guide-the-gauntlet-v1" title="The Gauntlet" summary="This is where you test your football knowledge in short games." steps={["Choose a game like Trivia or Film Room.","Read the question and pick your answer.","Correct answers earn XP; harder questions earn more."]}/></div>
  </section>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{modes.map(m=><button key={m.id} onClick={()=>setMode(m.id)} className={`rounded-2xl border p-4 text-left transition ${mode===m.id?'border-[#D4AF37]/50 bg-[#D4AF37]/10':'border-white/10 bg-[#101318] hover:border-white/20'}`}><div className="text-[#D4AF37]">{m.icon}</div><div className="mt-3 text-xs font-black uppercase">{m.label}</div><div className="mt-1 text-[10px] leading-4 text-zinc-500">{m.sub}</div></button>)}</div>
  {mode==='trivia'&&<section className="space-y-5"><div className="grid gap-3 md:grid-cols-4">{triviaTiers.map(t=><button key={t.name} onClick={()=>chooseTier(t.name)} className={`rounded-[1.5rem] border p-5 text-left ${tier===t.name?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/10 bg-[#101318]'}`}><div className="flex items-center justify-between"><Trophy className="h-5 w-5 text-[#D4AF37]"/><span className="text-[9px] font-black uppercase text-zinc-500">{t.xp}</span></div><div className="mt-4 font-display text-2xl font-black uppercase">{t.name}</div><div className="mt-2 text-xs leading-5 text-zinc-500">{t.desc}</div></button>)}</div>
   <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-[#0c0f14] p-5 sm:p-7">
    <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#D4AF37]">{tier}</div><div className="mt-1 text-[10px] font-bold uppercase text-zinc-600">Server-verified question · XP counts on your BK Profile</div></div><button onClick={()=>void loadQuestion()} disabled={loading||submitting} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[10px] font-black uppercase text-zinc-400 disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5"/>New</button></div>
    {loading&&<div className="flex min-h-56 items-center justify-center text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Loading challenge…</div>}
    {!loading&&error&&<div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm font-semibold text-red-200">{error}<button onClick={()=>void loadQuestion()} className="ml-2 underline">Retry</button></div>}
    {!loading&&question&&<><h2 className="mt-5 text-xl font-black leading-tight sm:text-2xl">{question.question}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{question.answers.map((a,i)=>{const answered=Boolean(result);const correct=answered&&i===result?.correctIndex;const chosen=i===selected;return <button key={`${question.attemptId}-${i}`} disabled={selected!==null||submitting} onClick={()=>void answer(i)} className={`min-h-16 rounded-2xl border px-4 text-left text-sm font-black disabled:cursor-default ${correct?'border-emerald-400 bg-emerald-400/10 text-emerald-300':answered&&chosen?'border-red-400 bg-red-400/10 text-red-300':selected!==null&&chosen?'border-[#D4AF37]/60 bg-[#D4AF37]/10':'border-white/10 bg-white/[.03] hover:border-[#D4AF37]/40'}`}><span className="mr-3 text-[#D4AF37]">{String.fromCharCode(65+i)}.</span>{a}</button>})}</div>{submitting&&<div className="mt-4 flex items-center text-xs font-bold text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Locking in your receipt…</div>}{result&&<div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-zinc-400"><div className={`font-black uppercase ${result.isCorrect?'text-emerald-300':'text-red-300'}`}>{result.isCorrect?'Correct — Ball Knower behavior.':'Missed it this time.'} {result.xpAwarded>0&&`+${result.xpAwarded} XP`}</div><div className="mt-2">{result.explanation}</div>{result.progressionRecorded&&<div className="mt-2 text-[#D4AF37]">Verified receipt saved to your BK Profile.</div>}</div>}</>}
   </div>
  </section>}
  {mode==='film'&&<FeaturePanel icon={<ShieldQuestion className="h-7 w-7"/>} title="Film Room" text="Situational football questions: coverage recognition, pressure looks, down-and-distance decisions, route concepts and clock management. Difficulty scales from obvious reads to coordinator-level decisions."/>}
  {mode==='picks'&&<FeaturePanel icon={<Target className="h-7 w-7"/>} title="Prediction Picks" text="Weekly football predictions tracked as skill stats: winners, stat leaders and matchup calls. No wagering — accuracy feeds the Ball Knower profile and seasonal challenge score."/>}
  {mode==='debates'&&<FeaturePanel icon={<Swords className="h-7 w-7"/>} title="Debate Arena" text="Start / Bench / Cut, blind resumes, community polls and saved receipts. Vote first, reveal community percentages after, and keep old takes on the profile."/>}
  {mode==='gauntlet'&&<FeaturePanel icon={<Flame className="h-7 w-7"/>} title="Survivor" text="Keep answering until you miss one. Longer runs move you higher on the leaderboard. One wrong answer ends the run."/>}
 </div>;
};

const FeaturePanel=({icon,title,text}:{icon:React.ReactNode;title:string;text:string})=><div className="rounded-[2rem] border border-white/10 bg-[#0d1015] p-6 sm:p-8"><div className="text-[#D4AF37]">{icon}</div><div className="mt-4 font-display text-3xl font-black uppercase">{title}</div><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{text}</p><div className="mt-6 flex flex-wrap gap-2"><Badge icon={<Medal className="h-3.5 w-3.5"/>} text="Ratings"/><Badge icon={<Trophy className="h-3.5 w-3.5"/>} text="Leaderboards"/><Badge icon={<Play className="h-3.5 w-3.5"/>} text="Daily Challenges"/></div></div>;
const Badge=({icon,text}:{icon:React.ReactNode;text:string})=><span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] font-black uppercase text-zinc-400">{icon}{text}</span>;
