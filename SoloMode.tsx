import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Trophy, RotateCcw, Play, Plus, Trash2, Search, Share2, Award, Activity, ShieldAlert, BarChart3, Crown, ChevronRight } from 'lucide-react';
import { PLAYERS_DATABASE } from './players';
import { Player, DEFAULT_SALARY_CAP, TOTAL_ROSTER_SIZE, ROSTER_REQUIREMENTS, LeagueMember } from './types';
import { countRosterGroups, getDraftPositionGroup, minimumCompletionCost, validateRosterShape } from './rosterRules';
import { calculateTeamRatings } from './evaluation';
import { chooseSmartPick, gradeDraft } from './smartDraft';
import { simulateGame } from './simulation';
import { useBallKnower } from './BallKnowerContext';
import { publishCareer } from './leaderboardCloud';
import { playerPortraitUrl } from './playerPortraits';
import { getTeamTheme, teamLogoUrl } from './teamTheme';
import { SoloExperience, SoloFranchiseHub } from './SoloFranchiseHub';
import {
  SoloWeek, InjuryEvent, SoloSettings, CareerProfile, defaultCareer, makeSoloOpponent, getSoloOpponentTeam,
  ratingsWithInjuries, simulateInjuries, generatePlayerLines, playoffSnapshot, buildAwards,
  achievementsForRun, updateCareer
} from './soloSeasonEngine';
import { trackBallKnowerEvent } from './analytics';

type Stage='draft'|'regular'|'playoffs'|'finished';
type PlayoffResult={round:string;opponent:string;you:number;them:number;won:boolean};

const CAREER_KEY='ballknower_solo_career_v1';
const RUN_KEY='ballknower_solo_run_v1';
const INITIAL_PLAYER_BATCH=40;
const PLAYER_BY_ID=new Map(PLAYERS_DATABASE.map(player=>[player.id,player]));

const FantasyFranchiseMode=lazy(()=>import('./FantasyFranchise').then(module=>({default:module.FantasyFranchise})));
const RealTeamFranchiseMode=lazy(()=>import('./RealTeamFranchise').then(module=>({default:module.RealTeamFranchise})));
const MyPlayerStoryMode=lazy(()=>import('./MyPlayerStory').then(module=>({default:module.MyPlayerStory})));

const isPlayer=(value:unknown):value is Player=>{
 if(!value||typeof value!=='object')return false;
 const player=value as Partial<Player>;
 return typeof player.id==='string'&&typeof player.name==='string'&&Number.isFinite(Number(player.salary))&&Number.isFinite(Number(player.ovr));
};

const restoreCareer=():CareerProfile=>{
 const fallback=defaultCareer();
 try{
   const raw=localStorage.getItem(CAREER_KEY);if(!raw)return fallback;
   const saved=JSON.parse(raw);
   if(!saved||typeof saved!=='object')return fallback;
   return {
     ...fallback,
     ...saved,
     achievements:Array.isArray(saved.achievements)?saved.achievements.filter((x:unknown)=>typeof x==='string'):[],
   };
 }catch{return fallback}
};

const restoreRun=()=>{
 try{
   const raw=localStorage.getItem(RUN_KEY);if(!raw)return null;
   const saved=JSON.parse(raw);
   if(!saved||!['draft','regular','playoffs'].includes(saved.stage))throw new Error('Unsupported Solo stage');
   if(!Array.isArray(saved.roster)||saved.roster.length>TOTAL_ROSTER_SIZE||!saved.roster.every(isPlayer))throw new Error('Invalid Solo roster');
   if(!Array.isArray(saved.bench)||saved.bench.length>2||!saved.bench.every(isPlayer))throw new Error('Invalid Solo bench');
   const roster=saved.roster.map((player:Player)=>PLAYER_BY_ID.get(player.id));
   const bench=saved.bench.map((player:Player)=>PLAYER_BY_ID.get(player.id));
   if(roster.some((player:Player|undefined)=>!player)||bench.some((player:Player|undefined)=>!player))throw new Error('Saved Solo player is no longer active');
   const currentRoster=roster as Player[],currentBench=bench as Player[];
   const ids=[...currentRoster,...currentBench].map(player=>player.id);
   if(new Set(ids).size!==ids.length)throw new Error('Duplicate Solo player');
   const draftCounts=countRosterGroups(currentRoster);
   if((Object.entries(ROSTER_REQUIREMENTS) as Array<[keyof typeof ROSTER_REQUIREMENTS,number]>).some(([group,required])=>draftCounts[group]>required))throw new Error('Illegal Solo roster shape');
   if(saved.stage!=='draft'&&(currentRoster.length!==TOTAL_ROSTER_SIZE||validateRosterShape(currentRoster).length))throw new Error('Incomplete active Solo roster');
   if(currentBench.length&&currentRoster.length!==TOTAL_ROSTER_SIZE)throw new Error('Bench added before starters completed');
   if([...currentRoster,...currentBench].reduce((sum,player)=>sum+player.salary,0)>DEFAULT_SALARY_CAP+.001)throw new Error('Solo roster exceeds current salary cap');
   if(!Array.isArray(saved.weeks)||saved.weeks.length>17||saved.weeks.some((week:any)=>
     !week||typeof week!=='object'||!week.game||typeof week.game!=='object'||
     !Number.isFinite(Number(week.game.homeScore))||!Number.isFinite(Number(week.game.awayScore))||
     !Array.isArray(week.playerLines)
   ))throw new Error('Incompatible Solo season history');
   if(!Array.isArray(saved.injuries)||!Array.isArray(saved.playoffs))throw new Error('Invalid Solo season state');
   const difficulty=['rookie','pro','all_pro','all_madden'].includes(saved.settings?.difficulty)?saved.settings.difficulty:'pro';
   const injurySetting=['off','normal','chaos'].includes(saved.settings?.injuries)?saved.settings.injuries:'normal';
   const weeks=saved.weeks.map((week:any,index:number)=>({...week,opponent:getSoloOpponentTeam(Number(week.week)||index+1).name}));
   const playoffs=saved.playoffs.map((result:any,index:number)=>({...result,opponent:getSoloOpponentTeam(25+index).name}));
   return {...saved,roster:currentRoster,bench:currentBench,weeks,playoffs,settings:{difficulty,injuries:injurySetting}};
 }catch(error){
   console.warn('Discarding incompatible Solo save',error);
   try{localStorage.removeItem(RUN_KEY)}catch{}
   return null;
 }
};

export const SoloMode:React.FC<{initialExperience?:SoloExperience}>=({initialExperience='hub'})=>{
 const [experience,setExperience]=useState<SoloExperience>(initialExperience);
 const openExperience=(next:SoloExperience)=>{trackBallKnowerEvent('Solo Experience Opened',{experience:next});setExperience(next)};
 if(experience==='hub')return <SoloFranchiseHub onOpen={openExperience}/>;
 const back=()=>setExperience('hub');
 return <Suspense fallback={<SoloModeLoading/>}>{experience==='cap'?<CapChallenge onBack={back}/>:experience==='fantasy'?<FantasyFranchiseMode onBack={back}/>:experience==='real'?<RealTeamFranchiseMode onBack={back}/>:<MyPlayerStoryMode onBack={back}/>}</Suspense>;
};

const CapChallenge:React.FC<{onBack:()=>void}>=({onBack})=>{
 const { currentUser } = useBallKnower();
 const [stage,setStage]=useState<Stage>('draft');
 const [roster,setRoster]=useState<Player[]>([]);
 const [bench,setBench]=useState<Player[]>([]);
 const [query,setQuery]=useState('');
 const [position,setPosition]=useState('ALL');
 const [visiblePlayerCount,setVisiblePlayerCount]=useState(INITIAL_PLAYER_BATCH);
 const [weeks,setWeeks]=useState<SoloWeek[]>([]);
 const [injuries,setInjuries]=useState<InjuryEvent[]>([]);
 const [playoffs,setPlayoffs]=useState<PlayoffResult[]>([]);
 const [message,setMessage]=useState('');
 const [settings,setSettings]=useState<SoloSettings>({difficulty:'pro',injuries:'normal'});
 const [career,setCareer]=useState<CareerProfile>(restoreCareer);
 const [runSaved,setRunSaved]=useState(false);
 const [isAutoDrafting,setIsAutoDrafting]=useState(false);
 const [didRestore,setDidRestore]=useState(false);
 const [isSimulating,setIsSimulating]=useState(false);
 const simulationLock=useRef(false);

 useEffect(()=>{const saved=restoreRun();if(saved){setStage(saved.stage);setRoster(saved.roster);setBench(saved.bench);setWeeks(saved.weeks);setInjuries(saved.injuries);setPlayoffs(saved.playoffs);setSettings(saved.settings);setMessage('Restored your last Solo Mode run.')}setDidRestore(true)},[]);
 useEffect(()=>{if(!didRestore)return;if(stage==='finished'||(stage==='draft'&&!roster.length&&!bench.length)){try{localStorage.removeItem(RUN_KEY)}catch(error){console.warn('Unable to clear Solo run',error)}return}try{localStorage.setItem(RUN_KEY,JSON.stringify({stage,roster,bench,weeks,injuries,playoffs,settings}))}catch(error){console.warn('Unable to save Solo run',error)}},[didRestore,stage,roster,bench,weeks,injuries,playoffs,settings]);
 useEffect(()=>{setVisiblePlayerCount(INITIAL_PLAYER_BATCH)},[query,position]);

 const spent=useMemo(()=>[...roster,...bench].reduce((n,p)=>n+p.salary,0),[roster,bench]), remaining=DEFAULT_SALARY_CAP-spent;
 const counts=countRosterGroups(roster), errors=validateRosterShape(roster);
 const valid=roster.length===TOTAL_ROSTER_SIZE&&errors.length===0&&spent<=DEFAULT_SALARY_CAP;
 const ratings=useMemo(()=>calculateTeamRatings(roster),[roster]);
 const grade=useMemo(()=>gradeDraft(roster,DEFAULT_SALARY_CAP),[roster]);
 const wins=weeks.filter(w=>w.won).length, losses=weeks.length-wins;
 const finalPointDifferential=weeks.reduce((total,week)=>total+(week.game.homeMemberId==='solo-user'?week.game.homeScore-week.game.awayScore:week.game.awayScore-week.game.homeScore),0);
 const finalPlayoffOdds=weeks.length===17?(wins>9||(wins===9&&finalPointDifferential>=0)?100:0):weeks.at(-1)?.playoffOdds??50;
 const allLines=weeks.flatMap(w=>Array.isArray(w.playerLines)?w.playerLines:[]), awards=buildAwards(allLines);
 const leaders=useMemo(()=>{
   const m=new Map<string,{name:string,pos:string,score:number}>();
   allLines.forEach(l=>{const x=m.get(l.playerId)||{name:l.name,pos:l.position,score:0};x.score+=l.fantasyScore;m.set(l.playerId,x)});
   return [...m.values()].sort((a,b)=>b.score-a.score).slice(0,5);
 },[weeks]);
 const activeInjuries=injuries.filter(i=>i.weeks>0);

 const availablePool=useMemo(()=>PLAYERS_DATABASE.filter(p=>{
   if(roster.some(r=>r.id===p.id)||bench.some(r=>r.id===p.id))return false;
   if(query&&!`${p.name} ${p.team} ${p.position}`.toLowerCase().includes(query.toLowerCase()))return false;
   if(position!=='ALL'&&getDraftPositionGroup(p)!==position&&p.position!==position)return false;
   return true;
 }).sort((a,b)=>b.ovr-a.ovr),[roster,bench,query,position]);
 const available=useMemo(()=>availablePool.slice(0,visiblePlayerCount),[availablePool,visiblePlayerCount]);

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
 const autoDraft=async()=>{
   if(isAutoDrafting)return;
   setIsAutoDrafting(true);setRoster([]);setBench([]);setMessage('Smart Auto-Draft is building your roster…');
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   const nextRoster:Player[]=[];
   try{
     for(let i=0;i<60&&nextRoster.length<20;i++){
       const pick=chooseSmartPick(PLAYERS_DATABASE,nextRoster,DEFAULT_SALARY_CAP,'balanced');if(!pick)break;
       nextRoster.push(pick);
       if(nextRoster.length%4===0){
         setRoster([...nextRoster]);setMessage(`Smart Auto-Draft: ${nextRoster.length}/20 players selected…`);
         await new Promise<void>(resolve=>setTimeout(resolve,0));
       }
     }
     setRoster(nextRoster);
     setMessage(nextRoster.length===20?'Smart starting roster built. You can still add up to 2 optional bench players if cap allows.':'Auto-Draft could not complete a legal roster. Try again or draft manually.');
   }finally{setIsAutoDrafting(false)}
 };
 const start=()=>{if(!valid)return setMessage(errors[0]||'Finish the roster first.');trackBallKnowerEvent('Solo Season Started',{difficulty:settings.difficulty,injuries:settings.injuries,team_overall:ratings.overall,draft_grade:grade.letter});setWeeks([]);setInjuries([]);setPlayoffs([]);setRunSaved(false);setStage('regular');setMessage('Week 1 is ready. Your road starts now.');};
 const unlockSimulation=()=>window.setTimeout(()=>{simulationLock.current=false;setIsSimulating(false)},400);

 const playWeek=()=>{
   const week=weeks.length+1;if(week>17||simulationLock.current)return;
   simulationLock.current=true;setIsSimulating(true);
   try{
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
   }finally{unlockSimulation()}
 };

 const enterPlayoffs=()=>{
   const diff=weeks.reduce((n,w)=>n+(w.game.homeMemberId==='solo-user'?w.game.homeScore-w.game.awayScore:w.game.awayScore-w.game.homeScore),0);
   if(wins<9||(wins===9&&diff<0)){finish(false,0,`Season over at ${wins}-${losses}. You missed the playoffs.`);return}
   setStage('playoffs');setMessage(`Playoff berth clinched. Seed projection: #${weeks.at(-1)?.playoffSeed||7}.`);
 };
 const round=playoffs.length===0?'WILD CARD':playoffs.length===1?'DIVISIONAL':playoffs.length===2?'CONFERENCE CHAMPIONSHIP':playoffs.length===3?'SUPER BOWL':null;
 const playRound=()=>{
   if(!round||simulationLock.current)return;simulationLock.current=true;setIsSimulating(true);
   try{const idx=playoffs.length;const opp=makeSoloOpponent(25+idx,settings.difficulty);
   const me:LeagueMember={id:'solo-user',userId:'solo-user',userName:'YOU',isCommissioner:true,status:'ready',roster,teamRatings:ratingsWithInjuries(roster,activeInjuries,bench)};
   const home=idx%2===0;const g=home?simulateGame(18+idx,me,opp):simulateGame(18+idx,opp,me);
   const you=home?g.homeScore:g.awayScore,them=home?g.awayScore:g.homeScore,won=g.winnerId==='solo-user';
   const next=[...playoffs,{round,opponent:opp.userName,you,them,won}];setPlayoffs(next);
   if(!won)finish(false,next.filter(x=>x.won).length,`${round}: ${you}-${them}. Your run ends here.`);
   else if(round==='SUPER BOWL')finish(true,4,`WORLD CHAMPION — you won Super Bowl LXI ${you}-${them}.`);
   else setMessage(`${round} WIN ${you}-${them}. Keep going.`);
   }finally{unlockSimulation()}
 };
 const finish=(champ:boolean,pw:number,msg:string)=>{
   trackBallKnowerEvent('Solo Season Completed',{champion:champ,wins,losses,playoff_wins:pw,team_overall:ratings.overall,difficulty:settings.difficulty});
   const ach=achievementsForRun(wins,losses,champ,grade.score,roster);
   const next=updateCareer(career,wins,losses,champ,pw,grade.score,ach);setCareer(next);try{localStorage.setItem(CAREER_KEY,JSON.stringify(next));localStorage.removeItem(RUN_KEY)}catch(error){console.warn('Unable to save completed Solo career',error)}void publishCareer(currentUser?.name || 'Ball Knower GM', next).catch(()=>{});setRunSaved(true);setStage('finished');setMessage(msg);
 };
 const reset=()=>{setStage('draft');setRoster([]);setBench([]);setWeeks([]);setInjuries([]);setPlayoffs([]);setMessage('');setRunSaved(false);try{localStorage.removeItem(RUN_KEY)}catch(error){console.warn('Unable to clear Solo run',error)}};
 const share=async()=>{
   const champ=message.includes('WORLD CHAMPION'),text=`BALL KNOWER ${champ?'SUPER BOWL CHAMPION':'SOLO RUN'} 🏈\nRecord: ${wins}-${losses}\nTeam OVR: ${ratings.overall}\nDraft Grade: ${grade.letter} (${grade.score}/100)\nCap: $${spent.toFixed(1)}M / $301.2M\n${champ?'🏆 SUPER BOWL LXI CHAMPION':''}`;
   try{if(navigator.share)await navigator.share({title:'Ball Knower Result',text});else{await navigator.clipboard.writeText(text);setMessage('Result card copied to clipboard.')}}catch{}
 };

 return <div className="min-h-[100dvh] bg-transparent text-white px-4 sm:px-8 pt-4 pb-8"><div className="mx-auto max-w-7xl">
  <button type="button" onClick={onBack} aria-label="Back to Solo Franchise Hub" className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]"><ArrowLeft size={19}/></button>
  <div className="flex items-center justify-between gap-3 mb-4"><div className="min-w-0"><div className="text-[var(--bk-team-accent)] text-[10px] font-black tracking-[.28em]">SOLO MODE</div><h2 className="text-2xl sm:text-4xl font-black leading-none mt-1">{stage==='draft'?'BUILD YOUR ROSTER':<>ROAD TO THE <span className="text-[var(--bk-team-accent)]">SUPER BOWL</span></>}</h2></div><div className="flex shrink-0 gap-2"><button onClick={share} aria-label="Share Solo Mode" className="flex gap-2 items-center justify-center min-h-11 min-w-11 border border-white/10 px-3 sm:px-4 bg-[#151515]"><Share2 size={16}/><span className="hidden sm:inline">Share</span></button><button onClick={reset} disabled={isAutoDrafting} aria-label="Start a new Solo run" className="flex gap-2 items-center justify-center min-h-11 min-w-11 border border-white/10 px-3 sm:px-4 bg-[#151515] disabled:cursor-wait disabled:opacity-40"><RotateCcw size={16}/><span className="hidden sm:inline">New Run</span></button></div></div>
  {message&&<div className="mb-5 border border-[var(--bk-team-accent)]/30 bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)] px-4 py-3 font-bold">{message}</div>}

  {stage==='draft'&&<><div className="grid grid-cols-3 gap-2 mb-2"><DraftStat label="CAP LEFT" value={`$${remaining.toFixed(1)}M`}/><DraftStat label="ROSTER" value={`${roster.length}/20`} detail={`+ ${bench.length}/2 BENCH`}/><DraftStat label="TEAM OVR" value={`${ratings.overall}`}/></div>
   <div className="grid grid-cols-2 gap-2 mb-3"><div className="flex items-center justify-between border border-white/10 bg-[#121212] px-3 py-2 text-[10px] font-black tracking-wider text-zinc-500"><span>DRAFT GRADE</span><b className="text-base text-white">{grade.letter}</b></div><div className="flex items-center justify-between border border-white/10 bg-[#121212] px-3 py-2 text-[10px] font-black tracking-wider text-zinc-500"><span>BALL KNOWER</span><b className="text-base text-white">{grade.score}/100</b></div></div>
   <details className="group bg-[#111] border border-white/10 mb-3"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-black"><span>DRAFT SETTINGS</span><span className="text-zinc-400 capitalize">{settings.difficulty.replace('_','-')} • {settings.injuries}</span></summary><div className="border-t border-white/10 p-3 grid grid-cols-2 gap-3"><label className="text-[10px] font-black text-zinc-400">DIFFICULTY<select value={settings.difficulty} onChange={e=>setSettings({...settings,difficulty:e.target.value as any})} className="mt-1 block w-full bg-[#181818] border border-white/10 p-3 text-sm text-white"><option value="rookie">Rookie</option><option value="pro">Pro</option><option value="all_pro">All-Pro</option><option value="all_madden">All-Madden</option></select></label><label className="text-[10px] font-black text-zinc-400">INJURIES<select value={settings.injuries} onChange={e=>setSettings({...settings,injuries:e.target.value as any})} className="mt-1 block w-full bg-[#181818] border border-white/10 p-3 text-sm text-white"><option value="off">Off</option><option value="normal">Normal</option><option value="chaos">Chaos</option></select></label></div></details>
   <div className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0"><div className="flex w-max gap-2">{['ALL','QB','RB','WR','TE','OL','DL_EDGE','LB','CB','S','K','P'].map(x=><button key={x} onClick={()=>setPosition(x)} className={`min-h-10 shrink-0 px-3 text-xs font-black border ${position===x?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]':'border-white/10 bg-[#111] text-zinc-400'}`}>{x}</button>)}</div></div>
   <div className="grid lg:grid-cols-[1.5fr_.8fr] gap-6"><div><div className="flex gap-2 mb-3"><div className="min-w-0 flex-1 flex items-center gap-2 bg-[#151515] border border-white/10 px-3"><Search className="shrink-0" size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players..." className="min-w-0 w-full bg-transparent py-3 outline-none"/></div><button onClick={autoDraft} disabled={isAutoDrafting} aria-busy={isAutoDrafting} className="shrink-0 px-3 sm:px-4 bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] text-xs sm:text-sm font-black disabled:cursor-wait disabled:opacity-70"><span className="sm:hidden">{isAutoDrafting?'DRAFTING…':'AUTO-DRAFT'}</span><span className="hidden sm:inline">{isAutoDrafting?`DRAFTING ${roster.length}/20…`:'SMART AUTO-DRAFT'}</span></button></div><div className="space-y-2 max-h-[68dvh] sm:max-h-[700px] overflow-y-auto overscroll-contain">{available.map(p=><div key={p.id} className="grid grid-cols-[48px_minmax(0,1fr)_44px] gap-3 items-center bg-[#121212] border border-white/5 p-3"><PlayerPhoto player={p}/><div className="min-w-0"><div className="font-black truncate">{p.name}</div><div className="text-[11px] text-zinc-500 truncate">{p.team} • {p.position} • {p.salaryType==='cap_hit'?'VERIFIED CAP':'EST. CAP'}</div><div className="mt-1 flex items-center gap-3 text-xs"><b>{p.ovr} OVR</b><span className="font-mono text-[var(--bk-team-accent)]">${p.salary.toFixed(2)}M</span></div></div><button onClick={()=>add(p)} disabled={isAutoDrafting} aria-label={`Add ${p.name}`} className="grid h-11 w-11 place-items-center border border-[var(--bk-team-accent)]/40 text-[var(--bk-team-accent)] disabled:cursor-wait disabled:opacity-40"><Plus size={17}/></button></div>)}{available.length<availablePool.length&&<button onClick={()=>setVisiblePlayerCount(count=>count+INITIAL_PLAYER_BATCH)} className="w-full border border-white/10 bg-[#151515] py-3 text-xs font-black text-[var(--bk-team-accent)]">SHOW MORE PLAYERS ({availablePool.length-available.length} LEFT)</button>}</div></div>
   <div className="bg-[#111] border border-white/10 p-4 h-fit sticky top-24"><h3 className="text-xl font-black mb-2">YOUR 20</h3><div className="text-xs text-zinc-500 mb-3">QB {counts.QB}/1 • RB {counts.RB}/1 • WR {counts.WR}/2 • TE {counts.TE}/1 • OL {counts.OL}/4 • DL {counts.DL_EDGE}/3 • LB {counts.LB}/2 • CB {counts.CB}/2 • S {counts.S}/2 • K {counts.K}/1 • P {counts.P}/1</div><div className="space-y-1 max-h-[430px] overflow-y-auto">{roster.map(p=><div key={p.id} className="flex justify-between bg-[#181818] px-3 py-2"><span><b>{p.position}</b> {p.name}</span><button aria-label={`Remove ${p.name} from starting roster`} onClick={()=>setRoster(r=>r.filter(x=>x.id!==p.id))}><Trash2 size={15}/></button></div>)}</div>
           <div className="mt-4 pt-3 border-t border-white/10"><div className="text-[10px] text-[var(--bk-team-accent)] font-black tracking-wider mb-2">OPTIONAL FLEX BENCH — {bench.length}/2</div>{bench.length===0?<div className="text-xs text-zinc-600">After your 20 starters are complete, draft up to two backups under the same cap.</div>:bench.map(p=><div key={p.id} className="flex justify-between bg-[#151515] px-3 py-2 mb-1"><span><b>{p.position}</b> {p.name}</span><button aria-label={`Remove ${p.name} from bench`} onClick={()=>setBench(b=>b.filter(x=>x.id!==p.id))}><Trash2 size={15}/></button></div>)}</div><button disabled={!valid} onClick={start} className="mt-4 w-full py-4 bg-[var(--bk-team-accent)] disabled:bg-zinc-800 text-black font-black"><Play className="inline mr-2" size={17}/>START SEASON</button></div></div></>}

  {stage==='regular'&&<div className="grid lg:grid-cols-[1.4fr_.7fr] gap-6"><div><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"><Stat label="Week" value={`${weeks.length+1>17?'17':weeks.length+1}/17`}/><Stat label="Record" value={`${wins}-${losses}`}/><Stat label={weeks.length===17?'Playoff Status':'Projected Seed'} value={weeks.length===17?(finalPlayoffOdds===100?'CLINCHED':'OUT'):`#${weeks.at(-1)?.playoffSeed||'—'}`}/><Stat label="Playoff Odds" value={`${finalPlayoffOdds}%`}/><Stat label="Team OVR" value={`${ratings.overall}`}/></div>
   {weeks.length<17&&<GameDay week={weeks.length+1} opponent={makeSoloOpponent(weeks.length+1,settings.difficulty).userName} ratings={ratings} injuries={activeInjuries} onPlay={playWeek} disabled={isSimulating}/>}
   {weeks.length===17&&<button onClick={enterPlayoffs} className="w-full bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] py-5 font-black text-xl">SELECTION SUNDAY — CHECK PLAYOFF BRACKET <ChevronRight className="inline"/></button>}
   <div className="mt-6"><h3 className="font-black text-xl mb-3">SEASON LOG</h3><WeekList weeks={weeks}/></div></div>
   <aside className="space-y-5"><Panel title="INJURY REPORT" icon={<ShieldAlert size={18}/>}>{activeInjuries.length?activeInjuries.map(i=><div key={i.playerId} className="border-b border-white/5 py-2"><b>{i.playerName}</b><div className="text-xs text-zinc-500">{i.position} • {i.weeks} week(s) remaining • {i.severity}</div></div>):<p className="text-zinc-500 text-sm">Healthy roster.</p>}</Panel><Panel title="TEAM LEADERS" icon={<BarChart3 size={18}/>}>{leaders.map((l,i)=><div key={l.name} className="flex justify-between py-2 border-b border-white/5"><span>{i+1}. {l.name} <small className="text-zinc-500">{l.pos}</small></span><b>{l.score.toFixed(1)}</b></div>)}</Panel></aside></div>}

  {stage==='playoffs'&&<div className="max-w-4xl mx-auto"><div className="text-center mb-8"><Trophy className="mx-auto text-[var(--bk-team-accent)]" size={60}/><h3 className="text-5xl font-black mt-3">NFL PLAYOFFS</h3><p className="text-zinc-400">Wild Card → Divisional → Conference Championship → Super Bowl LXI.</p></div><PlayoffBracket results={playoffs} current={round}/>{round&&<button onClick={playRound} disabled={isSimulating} aria-busy={isSimulating} className="mt-6 w-full py-5 bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] font-black text-xl disabled:cursor-wait disabled:opacity-60">{isSimulating?'SIMULATING…':`PLAY ${round}`}</button>}</div>}

  {stage==='finished'&&<div className="max-w-5xl mx-auto"><div className="text-center border border-[var(--bk-team-accent)]/40 bg-[#111] p-8"><Crown className="mx-auto text-[var(--bk-team-accent)]" size={70}/><h3 className="text-5xl font-black mt-3">{message.includes('WORLD CHAMPION')?'SUPER BOWL CHAMPION':'RUN COMPLETE'}</h3><p className="text-xl text-zinc-300 mt-3">{message}</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6"><Stat label="Record" value={`${wins}-${losses}`}/><Stat label="Team OVR" value={`${ratings.overall}`}/><Stat label="Draft Grade" value={grade.letter}/><Stat label="BK Score" value={`${grade.score}`}/></div></div>
   <div className="grid md:grid-cols-2 gap-6 mt-6"><Panel title="SEASON AWARDS" icon={<Award size={18}/>}>{awards.map(a=><div key={a.award} className="py-3 border-b border-white/5"><div className="text-[10px] text-[var(--bk-team-accent)] font-black tracking-wider">{a.award}</div><div className="text-lg font-black">{a.winner}</div></div>)}</Panel><Panel title="ACHIEVEMENTS UNLOCKED" icon={<Trophy size={18}/>}>{achievementsForRun(wins,losses,message.includes('WORLD CHAMPION'),grade.score,roster).map(a=><div key={a} className="py-2 font-black">🏆 {a}</div>)}</Panel></div>
   <button onClick={share} className="mt-6 w-full py-4 border border-[var(--bk-team-accent)] text-[var(--bk-team-accent)] font-black"><Share2 className="inline mr-2"/>SHARE RESULT CARD</button></div>}
  <section className="mt-8 border border-white/10 bg-[#101010]/90 p-4"><div className="text-[10px] font-black tracking-[.25em] text-[var(--bk-team-accent)]">ROAD TO THE SUPER BOWL</div><p className="mt-1 text-sm text-zinc-400">Draft your 20, survive 17 weeks, earn a playoff seed, and win four playoff games.</p></section>
  <details className="mt-3 border border-white/10 bg-[#101010]/90"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-black"><span>CAREER STATS</span><span className="text-xs text-zinc-500">{career.runs} {career.runs===1?'RUN':'RUNS'} • {career.championships} {career.championships===1?'TITLE':'TITLES'}</span></summary><div className="grid grid-cols-2 md:grid-cols-6 gap-2 border-t border-white/10 p-3"><Stat label="Career Runs" value={`${career.runs}`}/><Stat label="Titles" value={`${career.championships}`}/><Stat label="Career W-L" value={`${career.regularWins}-${career.regularLosses}`}/><Stat label="Playoff Wins" value={`${career.playoffWins}`}/><Stat label="Best Record" value={career.bestRecord}/><Stat label="Best BK Score" value={`${career.bestScore}`}/></div></details>
 </div></div>
};

const DraftStat=({label,value,detail}:{label:string,value:string,detail?:string})=><div className="min-w-0 border border-white/10 bg-[#121212] p-3"><div className="text-[9px] font-black tracking-widest text-zinc-500">{label}</div><div className="truncate text-lg sm:text-2xl font-black leading-tight mt-1">{value}</div>{detail&&<div className="truncate text-[9px] font-black text-zinc-500">{detail}</div>}</div>;
const SoloModeLoading=()=> <div className="grid min-h-[60dvh] place-items-center px-6 text-center text-sm font-black tracking-widest text-[var(--bk-team-accent)]">LOADING FRANCHISE…</div>;
const Stat=({label,value}:{label:string,value:string})=><div className="bg-[#121212] border border-white/10 p-4"><div className="text-[10px] text-zinc-500 font-black tracking-widest">{label}</div><div className="text-2xl font-black mt-1">{value}</div></div>;
const PlayerPhoto=({player}:{player:Player})=>{const portrait=playerPortraitUrl(player);const initials=player.name.split(' ').map(part=>part[0]).slice(0,2).join('');return <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#222]"><span className="absolute inset-0 grid place-items-center text-xs font-black text-zinc-500">{initials}</span>{portrait&&<img src={portrait} alt={player.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none'}} className="relative h-full w-full object-cover"/>}</div>};
const Panel=({title,icon,children}:{title:string,icon:React.ReactNode,children:React.ReactNode})=><div className="bg-[#111] border border-white/10 p-4"><h4 className="flex items-center gap-2 font-black mb-3 text-[var(--bk-team-accent)]">{icon}{title}</h4>{children}</div>;
const GameDay=({week,opponent,ratings,injuries,onPlay,disabled}:{week:number,opponent:string,ratings:any,injuries:InjuryEvent[],onPlay:()=>void,disabled:boolean})=>{const opponentTeam=getTeamTheme(opponent);return <div className="bg-[#111] border border-[var(--bk-team-accent)]/30 p-4 sm:p-6"><div className="text-xs text-[var(--bk-team-accent)] font-black tracking-[.25em]">WEEK {week} • GAMEDAY</div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5 mt-6 text-center"><div><div className="text-3xl font-black">YOU</div><div className="text-zinc-500">{ratings.overall} OVR</div></div><div className="text-2xl font-black text-zinc-600">VS</div><div className="min-w-0"><img src={teamLogoUrl(opponentTeam.abbr)} alt="" aria-hidden="true" className="mx-auto mb-2 h-12 w-12 sm:h-16 sm:w-16 object-contain"/><div className="text-xl sm:text-2xl font-black leading-tight">{opponentTeam.name}</div><div className="text-zinc-500">CPU</div></div></div><div className="mt-5 border-t border-white/5 pt-4 text-sm text-zinc-400"><b className="text-white">Key storyline:</b> {injuries.length?`${injuries.length} starter(s) are limited by injury.`:'Your roster enters healthy.'} Every result is driven by roster matchups, rating balance, and controlled variance.</div><button onClick={onPlay} disabled={disabled} aria-busy={disabled} className="mt-5 w-full py-4 bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] font-black text-lg disabled:cursor-wait disabled:opacity-60"><Play className="inline mr-2"/>{disabled?'SIMULATING…':`SIMULATE WEEK ${week}`}</button></div>};
const WeekList=({weeks}:{weeks:SoloWeek[]})=><div className="space-y-2">{[...weeks].reverse().map(w=>{const home=w.game.homeMemberId==='solo-user',you=home?w.game.homeScore:w.game.awayScore,them=home?w.game.awayScore:w.game.homeScore;return <details key={w.week} className="bg-[#121212] border border-white/10 p-4"><summary className="cursor-pointer grid grid-cols-[auto_1fr_auto] gap-4"><b className={w.won?'text-green-400':'text-red-400'}>{w.won?'W':'L'}</b><span><b>WEEK {w.week}</b> vs {w.opponent} <small className="text-zinc-500">• {w.record}</small></span><b>{you}-{them}</b></summary><div className="mt-3 text-xs text-zinc-400">{w.game.keyMatchupFactor}</div><div className="mt-3 grid sm:grid-cols-2 gap-2">{(Array.isArray(w.playerLines)?w.playerLines:[]).slice(0,8).map(l=><div key={l.playerId} className="bg-[#181818] p-2"><b>{l.name}</b> <span className="text-zinc-500">{l.position}</span><div className="text-[11px]">{l.passYds!=null&&`${l.passYds} PASS YDS • ${l.passTD} TD`} {l.rushYds!=null&&`${l.rushYds} RUSH YDS`} {l.recYds!=null&&`${l.receptions} REC • ${l.recYds} YDS`} {l.sacks!=null&&`${l.tackles} TKL • ${l.sacks} SACK • ${l.picks} INT`} {l.fgMade!=null&&`${l.fgMade}/${l.fgAtt} FG`}</div></div>)}</div></details>})}</div>;
const PlayoffBracket=({results,current}:{results:PlayoffResult[],current:string|null})=><div className="grid md:grid-cols-4 gap-3">{['WILD CARD','DIVISIONAL','CONFERENCE CHAMPIONSHIP','SUPER BOWL'].map((r,i)=>{const x=results[i];return <div key={r} className={`p-4 border ${current===r?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10':'border-white/10 bg-[#111]'}`}><div className="text-[10px] text-[var(--bk-team-accent)] font-black">{r}</div>{x?<><div className="font-black mt-2">{x.won?'WIN':'LOSS'} {x.you}-{x.them}</div><div className="text-xs text-zinc-500">{x.opponent}</div></>:<div className="text-zinc-600 mt-3">TBD</div>}</div>})}</div>;
