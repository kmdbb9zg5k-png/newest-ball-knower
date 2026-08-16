import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, RotateCcw, Play, Plus, Trash2, Search, Share2, Award, Activity, ShieldAlert, BarChart3, Crown, ChevronRight } from 'lucide-react';
import { PLAYERS_DATABASE } from '../data/players';
import { Player, DEFAULT_SALARY_CAP, TOTAL_ROSTER_SIZE, ROSTER_REQUIREMENTS, LeagueMember } from '../types';
import { countRosterGroups, getDraftPositionGroup, minimumCompletionCost, validateRosterShape } from '../utils/rosterRules';
import { calculateTeamRatings } from '../utils/evaluation';
import { chooseSmartPick, gradeDraft } from '../utils/smartDraft';
import { simulateGame } from '../utils/simulation';
import { useBallKnower } from '../context/BallKnowerContext';
import { publishCareer } from '../services/leaderboardCloud';
import {
  SoloWeek, InjuryEvent, SoloSettings, CareerProfile, defaultCareer, makeSoloOpponent,
  ratingsWithInjuries, simulateInjuries, generatePlayerLines, playoffSnapshot, buildAwards,
  achievementsForRun, updateCareer
} from '../utils/soloSeasonEngine';

type Stage='draft'|'regular'|'playoffs'|'finished';
type PlayoffResult={round:string;opponent:string;you:number;them:number;won:boolean};

const CAREER_KEY='ballknower_solo_career_v1';
const RUN_KEY='ballknower_solo_run_v1';

export const SoloMode:React.FC=()=>{
 const { currentUser } = useBallKnower();
 const [stage,setStage]=useState<Stage>('draft');
 const [roster,setRoster]=useState<Player[]>([]);
 const [bench,setBench]=useState<Player[]>([]);
 const [query,setQuery]=useState('');
 const [position,setPosition]=useState('ALL');
 const [weeks,setWeeks]=useState<SoloWeek[]>([]);
 const [injuries,setInjuries]=useState<InjuryEvent[]>([]);
 const [playoffs,setPlayoffs]=useState<PlayoffResult[]>([]);
 const [message,setMessage]=useState('');
 const [settings,setSettings]=useState<SoloSettings>({difficulty:'pro',injuries:'normal'});
 const [career,setCareer]=useState<CareerProfile>(()=>{try{return JSON.parse(localStorage.getItem(CAREER_KEY)||'null')||defaultCareer()}catch{return defaultCareer()}});
 const [runSaved,setRunSaved]=useState(false);

 useEffect(()=>{try{const raw=localStorage.getItem(RUN_KEY);if(raw){const r=JSON.parse(raw);if(r?.stage&&r.stage!=='draft'){setStage(r.stage);setRoster(r.roster||[]);setBench(r.bench||[]);setWeeks(r.weeks||[]);setInjuries(r.injuries||[]);setPlayoffs(r.playoffs||[]);setSettings(r.settings||settings);setMessage('Restored your last Solo Mode run.')}}}catch{}},[]);
 useEffect(()=>{if(stage!=='draft')localStorage.setItem(RUN_KEY,JSON.stringify({stage,roster,bench,weeks,injuries,playoffs,settings}))},[stage,roster,bench,weeks,injuries,playoffs,settings]);

 const spent=useMemo(()=>[...roster,...bench].reduce((n,p)=>n+p.salary,0),[roster,bench]), remaining=DEFAULT_SALARY_CAP-spent;
 const counts=countRosterGroups(roster), errors=validateRosterShape(roster);
 const valid=roster.length===TOTAL_ROSTER_SIZE&&errors.length===0&&spent<=DEFAULT_SALARY_CAP;
 const ratings=useMemo(()=>calculateTeamRatings(roster),[roster]);
 const grade=useMemo(()=>gradeDraft(roster,DEFAULT_SALARY_CAP),[roster]);
 const wins=weeks.filter(w=>w.won).length, losses=weeks.length-wins;
 const allLines=weeks.flatMap(w=>w.playerLines), awards=buildAwards(allLines);
 const leaders=useMemo(()=>{
   const m=new Map<string,{name:string,pos:string,score:number}>();
   allLines.forEach(l=>{const x=m.get(l.playerId)||{name:l.name,pos:l.position,score:0};x.score+=l.fantasyScore;m.set(l.playerId,x)});
   return [...m.values()].sort((a,b)=>b.score-a.score).slice(0,5);
 },[weeks]);
 const activeInjuries=injuries.filter(i=>i.weeks>0);

 const available=useMemo(()=>PLAYERS_DATABASE.filter(p=>{
   if(roster.some(r=>r.id===p.id)||bench.some(r=>r.id===p.id))return false;
   if(query&&!`${p.name} ${p.team} ${p.position}`.toLowerCase().includes(query.toLowerCase()))return false;
   if(position!=='ALL'&&getDraftPositionGroup(p)!==position&&p.position!==position)return false;
   return true;
 }).sort((a,b)=>b.ovr-a.ovr).slice(0,160),[roster,query,position]);

 const add=(p:Player)=>{
   const g=getDraftPositionGroup(p);
   if(p.salary>remaining)return setMessage('That player puts you over the cap.');
   if(roster.length===20){
     if(bench.length>=2)return setMessage('Your two bench/FLEX spots are full.');
     setBench(b=>[...b,p]);setMessage(`${p.name} added as injury insurance.`);return;
   }
   if((counts as any)[g]>=(ROSTER_REQUIREMENTS as any)[g])return setMessage(`${g} is filled. Finish the 20 starters first, then add up to 2 FLEX bench players.`);
   const after=[...roster,p], min=minimumCompletionCost(after,PLAYERS_DATABASE.filter(x=>!after.some(a=>a.id===x.id)));
   if(min>remaining-p.salary+.001)return setMessage('That pick leaves too little cap to finish a legal roster.');
   setRoster(after);setMessage('');
 };
 const autoDraft=()=>{let r:Player[]=[];for(let i=0;i<60&&r.length<20;i++){const p=chooseSmartPick(PLAYERS_DATABASE,r,DEFAULT_SALARY_CAP,'balanced');if(!p)break;r.push(p)}setRoster(r);setBench([]);setMessage('Smart starting roster built. You can still add up to 2 optional bench players if cap allows.');};
 const start=()=>{if(!valid)return setMessage(errors[0]||'Finish the roster first.');setWeeks([]);setInjuries([]);setPlayoffs([]);setRunSaved(false);setStage('regular');setMessage('Week 1 is ready. Your road starts now.');};

 const playWeek=()=>{
   const week=weeks.length+1;if(week>17)return;
   const current=activeInjuries;
   const myRatings=ratingsWithInjuries(roster,current,bench);
   const me:LeagueMember={id:'solo-user',userId:'solo-user',userName:'YOU',isCommissioner:true,status:'ready',roster,teamRatings:myRatings};
   const opp=makeSoloOpponent(week,settings.difficulty);
   const userHome=week%2===1;const game=userHome?simulateGame(week,me,opp):simulateGame(week,opp,me);
   const won=game.winnerId==='solo-user';
   const newWins=wins+(won?1:0),newLosses=losses+(won?0:1);const snap=playoffSnapshot(newWins,newLosses,week);
   const newInjuries=simulateInjuries(roster,week,settings.injuries,current);
   const playerLines=generatePlayerLines(roster,game,userHome,week);
   setWeeks(prev=>[...prev,{week,opponent:opp.userName,game,won,playerLines,injuries:newInjuries,playoffSeed:snap.seed,playoffOdds:snap.odds,record:`${newWins}-${newLosses}`}]);
   setInjuries(prev=>[...prev.map(i=>({...i,weeks:Math.max(0,i.weeks-1)})),...newInjuries]);
   setMessage(newInjuries.length?`${newInjuries[0].playerName} suffered a ${newInjuries[0].severity.toLowerCase()} injury (${newInjuries[0].weeks} week${newInjuries[0].weeks===1?'':'s'}).`:'');
 };

 const enterPlayoffs=()=>{
   const diff=weeks.reduce((n,w)=>n+(w.game.homeMemberId==='solo-user'?w.game.homeScore-w.game.awayScore:w.game.awayScore-w.game.homeScore),0);
   if(wins<9||(wins===9&&diff<0)){finish(false,0,`Season over at ${wins}-${losses}. You missed the playoffs.`);return}
   setStage('playoffs');setMessage(`Playoff berth clinched. Seed projection: #${weeks.at(-1)?.playoffSeed||7}.`);
 };
 const round=playoffs.length===0?'WILD CARD':playoffs.length===1?'DIVISIONAL':playoffs.length===2?'CONFERENCE CHAMPIONSHIP':playoffs.length===3?'SUPER BOWL':null;
 const playRound=()=>{
   if(!round)return;const idx=playoffs.length;const opp=makeSoloOpponent(25+idx,settings.difficulty);
   const me:LeagueMember={id:'solo-user',userId:'solo-user',userName:'YOU',isCommissioner:true,status:'ready',roster,teamRatings:ratingsWithInjuries(roster,activeInjuries,bench)};
   const home=idx%2===0;const g=home?simulateGame(18+idx,me,opp):simulateGame(18+idx,opp,me);
   const you=home?g.homeScore:g.awayScore,them=home?g.awayScore:g.homeScore,won=g.winnerId==='solo-user';
   const next=[...playoffs,{round,opponent:opp.userName,you,them,won}];setPlayoffs(next);
   if(!won)finish(false,next.filter(x=>x.won).length,`${round}: ${you}-${them}. Your run ends here.`);
   else if(round==='SUPER BOWL')finish(true,4,`WORLD CHAMPION — you won Super Bowl LXI ${you}-${them}.`);
   else setMessage(`${round} WIN ${you}-${them}. Keep going.`);
 };
 const finish=(champ:boolean,pw:number,msg:string)=>{
   const ach=achievementsForRun(wins,losses,champ,grade.score,roster);
   const next=updateCareer(career,wins,losses,champ,pw,grade.score,ach);setCareer(next);localStorage.setItem(CAREER_KEY,JSON.stringify(next));void publishCareer(currentUser?.name || 'Ball Knower GM', next).catch(()=>{});setRunSaved(true);setStage('finished');setMessage(msg);localStorage.removeItem(RUN_KEY);
 };
 const reset=()=>{setStage('draft');setRoster([]);setBench([]);setWeeks([]);setInjuries([]);setPlayoffs([]);setMessage('');setRunSaved(false);localStorage.removeItem(RUN_KEY)};
 const share=async()=>{
   const champ=message.includes('WORLD CHAMPION'),text=`BALL KNOWER ${champ?'SUPER BOWL CHAMPION':'SOLO RUN'} 🏈\nRecord: ${wins}-${losses}\nTeam OVR: ${ratings.overall}\nDraft Grade: ${grade.letter} (${grade.score}/100)\nCap: $${spent.toFixed(1)}M / $301.2M\n${champ?'🏆 SUPER BOWL LXI CHAMPION':''}`;
   try{if(navigator.share)await navigator.share({title:'Ball Knower Result',text});else{await navigator.clipboard.writeText(text);setMessage('Result card copied to clipboard.')}}catch{}
 };

 return <div className="min-h-screen bg-[#090909] text-white px-4 sm:px-8 py-8"><div className="mx-auto max-w-7xl">
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8"><div><div className="text-[#D4AF37] text-xs font-black tracking-[.3em]">SOLO MODE</div><h2 className="text-4xl sm:text-6xl font-black">ROAD TO THE <span className="text-[#D4AF37]">SUPER BOWL</span></h2><p className="text-zinc-400 mt-2">Draft. Survive 17 weeks. Chase a seed. Win four playoff games. Build your legacy.</p></div><div className="flex gap-2"><button onClick={share} className="flex gap-2 items-center border border-white/10 px-4 py-2 bg-[#151515]"><Share2 size={16}/> Share</button><button onClick={reset} className="flex gap-2 items-center border border-white/10 px-4 py-2 bg-[#151515]"><RotateCcw size={16}/> New Run</button></div></div>
  {message&&<div className="mb-5 border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] px-4 py-3 font-bold">{message}</div>}
  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6"><Stat label="Career Runs" value={`${career.runs}`}/><Stat label="Titles" value={`${career.championships}`}/><Stat label="Career W-L" value={`${career.regularWins}-${career.regularLosses}`}/><Stat label="Playoff Wins" value={`${career.playoffWins}`}/><Stat label="Best Record" value={career.bestRecord}/><Stat label="Best BK Score" value={`${career.bestScore}`}/></div>

  {stage==='draft'&&<><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"><Stat label="Cap Remaining" value={`$${remaining.toFixed(1)}M`}/><Stat label="Roster" value={`${roster.length}/20 + ${bench.length}/2 BENCH`}/><Stat label="Team OVR" value={`${ratings.overall}`}/><Stat label="Draft Grade" value={grade.letter}/><Stat label="Ball Knower" value={`${grade.score}/100`}/></div>
   <div className="bg-[#111] border border-white/10 p-4 mb-5 grid sm:grid-cols-2 gap-4"><label className="text-xs font-black">DIFFICULTY<select value={settings.difficulty} onChange={e=>setSettings({...settings,difficulty:e.target.value as any})} className="mt-2 block w-full bg-[#181818] border border-white/10 p-3"><option value="rookie">Rookie</option><option value="pro">Pro</option><option value="all_pro">All-Pro</option><option value="all_madden">All-Madden</option></select></label><label className="text-xs font-black">INJURIES<select value={settings.injuries} onChange={e=>setSettings({...settings,injuries:e.target.value as any})} className="mt-2 block w-full bg-[#181818] border border-white/10 p-3"><option value="off">Off</option><option value="normal">Normal</option><option value="chaos">Chaos</option></select></label></div>
   <div className="flex flex-wrap gap-2 mb-4">{['ALL','QB','RB','WR','TE','OL','DL_EDGE','LB','CB','S','K','P'].map(x=><button key={x} onClick={()=>setPosition(x)} className={`px-3 py-2 text-xs font-black border ${position===x?'border-[#D4AF37] text-[#D4AF37]':'border-white/10 text-zinc-400'}`}>{x}</button>)}</div>
   <div className="grid lg:grid-cols-[1.5fr_.8fr] gap-6"><div><div className="flex gap-2 mb-3"><div className="flex-1 flex items-center gap-2 bg-[#151515] border border-white/10 px-3"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players..." className="w-full bg-transparent py-3 outline-none"/></div><button onClick={autoDraft} className="px-4 bg-[#D4AF37] text-black font-black">SMART AUTO-DRAFT</button></div><div className="space-y-2 max-h-[700px] overflow-y-auto">{available.map(p=><div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center bg-[#121212] border border-white/5 p-3"><div><div className="font-black">{p.name}</div><div className="text-xs text-zinc-500">{p.team} • {p.position} • {p.salaryType==='cap_hit'?'VERIFIED CAP':'EST. CAP'}</div></div><b>{p.ovr}</b><span className="font-mono text-[#D4AF37]">${p.salary.toFixed(2)}M</span><button onClick={()=>add(p)} className="p-2 border border-[#D4AF37]/40 text-[#D4AF37]"><Plus size={16}/></button></div>)}</div></div>
   <div className="bg-[#111] border border-white/10 p-4 h-fit sticky top-24"><h3 className="text-xl font-black mb-2">YOUR 20</h3><div className="text-xs text-zinc-500 mb-3">QB {counts.QB}/1 • RB {counts.RB}/1 • WR {counts.WR}/2 • TE {counts.TE}/1 • OL {counts.OL}/4 • DL {counts.DL_EDGE}/3 • LB {counts.LB}/2 • CB {counts.CB}/2 • S {counts.S}/2 • K {counts.K}/1 • P {counts.P}/1</div><div className="space-y-1 max-h-[430px] overflow-y-auto">{roster.map(p=><div key={p.id} className="flex justify-between bg-[#181818] px-3 py-2"><span><b>{p.position}</b> {p.name}</span><button onClick={()=>setRoster(r=>r.filter(x=>x.id!==p.id))}><Trash2 size={15}/></button></div>)}</div>
           <div className="mt-4 pt-3 border-t border-white/10"><div className="text-[10px] text-[#D4AF37] font-black tracking-wider mb-2">OPTIONAL FLEX BENCH — {bench.length}/2</div>{bench.length===0?<div className="text-xs text-zinc-600">After your 20 starters are complete, draft up to two backups under the same cap.</div>:bench.map(p=><div key={p.id} className="flex justify-between bg-[#151515] px-3 py-2 mb-1"><span><b>{p.position}</b> {p.name}</span><button onClick={()=>setBench(b=>b.filter(x=>x.id!==p.id))}><Trash2 size={15}/></button></div>)}</div><button disabled={!valid} onClick={start} className="mt-4 w-full py-4 bg-[#D4AF37] disabled:bg-zinc-800 text-black font-black"><Play className="inline mr-2" size={17}/>START SEASON</button></div></div></>}

  {stage==='regular'&&<div className="grid lg:grid-cols-[1.4fr_.7fr] gap-6"><div><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"><Stat label="Week" value={`${weeks.length+1>17?'17':weeks.length+1}/17`}/><Stat label="Record" value={`${wins}-${losses}`}/><Stat label="Projected Seed" value={`#${weeks.at(-1)?.playoffSeed||'—'}`}/><Stat label="Playoff Odds" value={`${weeks.at(-1)?.playoffOdds||50}%`}/><Stat label="Team OVR" value={`${ratings.overall}`}/></div>
   {weeks.length<17&&<GameDay week={weeks.length+1} opponent={makeSoloOpponent(weeks.length+1,settings.difficulty).userName} ratings={ratings} injuries={activeInjuries} onPlay={playWeek}/>}
   {weeks.length===17&&<button onClick={enterPlayoffs} className="w-full bg-[#D4AF37] text-black py-5 font-black text-xl">SELECTION SUNDAY — CHECK PLAYOFF BRACKET <ChevronRight className="inline"/></button>}
   <div className="mt-6"><h3 className="font-black text-xl mb-3">SEASON LOG</h3><WeekList weeks={weeks}/></div></div>
   <aside className="space-y-5"><Panel title="INJURY REPORT" icon={<ShieldAlert size={18}/>}>{activeInjuries.length?activeInjuries.map(i=><div key={i.playerId} className="border-b border-white/5 py-2"><b>{i.playerName}</b><div className="text-xs text-zinc-500">{i.position} • {i.weeks} week(s) remaining • {i.severity}</div></div>):<p className="text-zinc-500 text-sm">Healthy roster.</p>}</Panel><Panel title="TEAM LEADERS" icon={<BarChart3 size={18}/>}>{leaders.map((l,i)=><div key={l.name} className="flex justify-between py-2 border-b border-white/5"><span>{i+1}. {l.name} <small className="text-zinc-500">{l.pos}</small></span><b>{l.score.toFixed(1)}</b></div>)}</Panel></aside></div>}

  {stage==='playoffs'&&<div className="max-w-4xl mx-auto"><div className="text-center mb-8"><Trophy className="mx-auto text-[#D4AF37]" size={60}/><h3 className="text-5xl font-black mt-3">NFL PLAYOFFS</h3><p className="text-zinc-400">Wild Card → Divisional → Conference Championship → Super Bowl LXI.</p></div><PlayoffBracket results={playoffs} current={round}/>{round&&<button onClick={playRound} className="mt-6 w-full py-5 bg-[#D4AF37] text-black font-black text-xl">PLAY {round}</button>}</div>}

  {stage==='finished'&&<div className="max-w-5xl mx-auto"><div className="text-center border border-[#D4AF37]/40 bg-[#111] p-8"><Crown className="mx-auto text-[#D4AF37]" size={70}/><h3 className="text-5xl font-black mt-3">{message.includes('WORLD CHAMPION')?'SUPER BOWL CHAMPION':'RUN COMPLETE'}</h3><p className="text-xl text-zinc-300 mt-3">{message}</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6"><Stat label="Record" value={`${wins}-${losses}`}/><Stat label="Team OVR" value={`${ratings.overall}`}/><Stat label="Draft Grade" value={grade.letter}/><Stat label="BK Score" value={`${grade.score}`}/></div></div>
   <div className="grid md:grid-cols-2 gap-6 mt-6"><Panel title="SEASON AWARDS" icon={<Award size={18}/>}>{awards.map(a=><div key={a.award} className="py-3 border-b border-white/5"><div className="text-[10px] text-[#D4AF37] font-black tracking-wider">{a.award}</div><div className="text-lg font-black">{a.winner}</div></div>)}</Panel><Panel title="ACHIEVEMENTS UNLOCKED" icon={<Trophy size={18}/>}>{achievementsForRun(wins,losses,message.includes('WORLD CHAMPION'),grade.score,roster).map(a=><div key={a} className="py-2 font-black">🏆 {a}</div>)}</Panel></div>
   <button onClick={share} className="mt-6 w-full py-4 border border-[#D4AF37] text-[#D4AF37] font-black"><Share2 className="inline mr-2"/>SHARE RESULT CARD</button></div>}
 </div></div>
};

const Stat=({label,value}:{label:string,value:string})=><div className="bg-[#121212] border border-white/10 p-4"><div className="text-[10px] text-zinc-500 font-black tracking-widest">{label}</div><div className="text-2xl font-black mt-1">{value}</div></div>;
const Panel=({title,icon,children}:{title:string,icon:React.ReactNode,children:React.ReactNode})=><div className="bg-[#111] border border-white/10 p-4"><h4 className="flex items-center gap-2 font-black mb-3 text-[#D4AF37]">{icon}{title}</h4>{children}</div>;
const GameDay=({week,opponent,ratings,injuries,onPlay}:{week:number,opponent:string,ratings:any,injuries:InjuryEvent[],onPlay:()=>void})=><div className="bg-[#111] border border-[#D4AF37]/30 p-6"><div className="text-xs text-[#D4AF37] font-black tracking-[.25em]">WEEK {week} • GAMEDAY</div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5 mt-6 text-center"><div><div className="text-3xl font-black">YOU</div><div className="text-zinc-500">{ratings.overall} OVR</div></div><div className="text-2xl font-black text-zinc-600">VS</div><div><div className="text-2xl font-black">{opponent}</div><div className="text-zinc-500">CPU</div></div></div><div className="mt-5 border-t border-white/5 pt-4 text-sm text-zinc-400"><b className="text-white">Key storyline:</b> {injuries.length?`${injuries.length} starter(s) are limited by injury.`:'Your roster enters healthy.'} Every result is driven by roster matchups, rating balance, and controlled variance.</div><button onClick={onPlay} className="mt-5 w-full py-4 bg-[#D4AF37] text-black font-black text-lg"><Play className="inline mr-2"/>SIMULATE WEEK {week}</button></div>;
const WeekList=({weeks}:{weeks:SoloWeek[]})=><div className="space-y-2">{[...weeks].reverse().map(w=>{const home=w.game.homeMemberId==='solo-user',you=home?w.game.homeScore:w.game.awayScore,them=home?w.game.awayScore:w.game.homeScore;return <details key={w.week} className="bg-[#121212] border border-white/10 p-4"><summary className="cursor-pointer grid grid-cols-[auto_1fr_auto] gap-4"><b className={w.won?'text-green-400':'text-red-400'}>{w.won?'W':'L'}</b><span><b>WEEK {w.week}</b> vs {w.opponent} <small className="text-zinc-500">• {w.record}</small></span><b>{you}-{them}</b></summary><div className="mt-3 text-xs text-zinc-400">{w.game.keyMatchupFactor}</div><div className="mt-3 grid sm:grid-cols-2 gap-2">{w.playerLines.slice(0,8).map(l=><div key={l.playerId} className="bg-[#181818] p-2"><b>{l.name}</b> <span className="text-zinc-500">{l.position}</span><div className="text-[11px]">{l.passYds!=null&&`${l.passYds} PASS YDS • ${l.passTD} TD`} {l.rushYds!=null&&`${l.rushYds} RUSH YDS`} {l.recYds!=null&&`${l.receptions} REC • ${l.recYds} YDS`} {l.sacks!=null&&`${l.tackles} TKL • ${l.sacks} SACK • ${l.picks} INT`} {l.fgMade!=null&&`${l.fgMade}/${l.fgAtt} FG`}</div></div>)}</div></details>})}</div>;
const PlayoffBracket=({results,current}:{results:PlayoffResult[],current:string|null})=><div className="grid md:grid-cols-4 gap-3">{['WILD CARD','DIVISIONAL','CONFERENCE CHAMPIONSHIP','SUPER BOWL'].map((r,i)=>{const x=results[i];return <div key={r} className={`p-4 border ${current===r?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/10 bg-[#111]'}`}><div className="text-[10px] text-[#D4AF37] font-black">{r}</div>{x?<><div className="font-black mt-2">{x.won?'WIN':'LOSS'} {x.you}-{x.them}</div><div className="text-xs text-zinc-500">{x.opponent}</div></>:<div className="text-zinc-600 mt-3">TBD</div>}</div>})}</div>;
