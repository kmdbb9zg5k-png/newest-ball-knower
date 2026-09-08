import {BroadcastStage} from './BroadcastScene';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bird, Brain, CalendarDays, CheckCircle2, ChevronRight, Film, Flame, Loader2, Medal, MessageSquare, Play, RotateCcw, ShieldCheck, Sparkles, Star, Target, Trophy, WifiOff, X, XCircle } from 'lucide-react';
import { beginTriviaSession, fetchTriviaQuestion, submitTriviaAnswer, TriviaAnswerResult, TriviaQuestion, TriviaSession } from './progressionCloud';
import { ModeGuide } from './ModeGuide';
import { ModalPortal } from './ModalPortal';
import { trackBallKnowerEvent } from './analytics';
import { useBallKnower } from './BallKnowerContext';
import { GauntletPlayModal } from './GauntletPlayModal';
import { buildDailyGauntlet,buildGauntletRound,compactGauntletProgressForCloud,GauntletMode,GauntletProgress,GauntletTier,loadGauntletProgress,mergeGauntletProgress,mergeGauntletProgressEvents,recordGauntletAnswer,recordGauntletRun,saveGauntletProgress,utcDateKey } from './gauntletEngine';
import { loadGauntletProgressEvents,loadUserState,saveGauntletProgressEvents,saveUserState } from './userStateCloud';
import './gauntlet.css';

type TriviaTier = GauntletTier;

const triviaTiers: { name: TriviaTier; desc: string; xp: string }[] = [
  { name: 'ROOKIE', desc: 'Rules, teams and football basics', xp: '15 XP' },
  { name: 'PRO', desc: 'Current NFL knowledge and concepts', xp: '25 XP' },
  { name: 'ALL-PRO', desc: 'Multi-clue football IQ and schemes', xp: '40 XP' },
  { name: 'HALL OF FAME', desc: 'Deep history, elimination and mastery', xp: '60 XP' },
];

type GauntletModeName='TRIVIA'|GauntletMode;
const gauntletModes:{name:GauntletModeName;description:string;icon:typeof Brain}[] = [
  {name:'TRIVIA',description:'Four difficulty levels with verified XP.',icon:Brain},
  {name:'FILM ROOM',description:'Read coverages and diagnose the play.',icon:Film},
  {name:'PREDICTIONS',description:'Call the result from game context.',icon:Target},
  {name:'DEBATES',description:'Choose the evidence that wins the argument.',icon:MessageSquare},
  {name:'SURVIVOR',description:'One wrong pick ends the run.',icon:ShieldCheck},
];

export const ChallengesHub: React.FC = () => {
  const {currentUser}=useBallKnower();
  const userId=currentUser?.id;
  const [tier, setTier] = useState<TriviaTier>('ROOKIE');
  const [triviaOpen, setTriviaOpen] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<TriviaAnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [progress,setProgress]=useState<GauntletProgress>(()=>loadGauntletProgress(userId));
  const [tierPickerMode,setTierPickerMode]=useState<GauntletModeName|null>(null);
  const [activeRun,setActiveRun]=useState<{mode:GauntletMode;tier:GauntletTier;nonce:number}|null>(null);
  const [dailyRun,setDailyRun]=useState(false);
  const advancingRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  const questionRequestRef = useRef(0);
  const triviaSessionRef = useRef(0);
  const serverSessionRef = useRef<TriviaSession | null>(null);
  const progressCloudQueueRef=useRef<Promise<void>>(Promise.resolve());
  const dailyDate=utcDateKey();
  const levelFloor=Math.max(0,(progress.level-1)*250);
  const levelProgress=Math.max(0,Math.min(100,((progress.xp-levelFloor)/250)*100));
  const accuracy=progress.totalAnswered?Math.round(progress.totalCorrect/progress.totalAnswered*100):0;
  const dailyScenarios=useMemo(()=>buildDailyGauntlet(dailyDate),[dailyDate]);
  const runScenarios=useMemo(()=>activeRun?buildGauntletRound(activeRun.mode,activeRun.tier,10,`${activeRun.nonce}:${Date.now()}`):[],[activeRun]);
  const applyProgress=useCallback((next:GauntletProgress)=>{
    const local=mergeGauntletProgress(loadGauntletProgress(userId),next);
    setProgress(local);saveGauntletProgress(local,userId);
    progressCloudQueueRef.current=progressCloudQueueRef.current.then(async()=>{
      const latestLocal=loadGauntletProgress(userId);
      const localEvents=Object.values(latestLocal.sync?.events||{});
      await saveGauntletProgressEvents(localEvents);
      const [v2,legacy,remoteEvents]=await Promise.all([
        loadUserState<GauntletProgress>('gauntlet_progress_v2'),
        loadUserState<GauntletProgress>('gauntlet_progress_v1'),
        loadGauntletProgressEvents(),
      ]);
      const cloud=v2||legacy;const withCloud=cloud?mergeGauntletProgress(latestLocal,cloud):latestLocal;
      const merged=mergeGauntletProgressEvents(withCloud,remoteEvents);
      saveGauntletProgress(merged,userId);setProgress(merged);
      await saveUserState('gauntlet_progress_v2',compactGauntletProgressForCloud(merged));
    }).catch(error=>console.warn('Gauntlet cloud merge failed',error));
  },[userId]);
  useEffect(()=>{const local=loadGauntletProgress(userId);setProgress(local);applyProgress(local);},[applyProgress,userId]);

  const loadQuestion = useCallback(async (nextTier: TriviaTier, session?: TriviaSession | null) => {
    // A previous RPC can finish after the user exits or switches tiers. Give every
    // request a generation token so stale responses can never replace the active tier.
    const requestId = ++questionRequestRef.current;
    setLoading(true);
    setError('');
    setSelected(null);
    setResult(null);
    try {
      const nextQuestion = await fetchTriviaQuestion(nextTier, session ?? serverSessionRef.current ?? undefined);
      if (requestId !== questionRequestRef.current) return;
      setQuestion(nextQuestion);
    } catch (err) {
      if (requestId !== questionRequestRef.current) return;
      setQuestion(null);
      setError(err instanceof Error ? err.message : 'Could not load trivia right now.');
    } finally {
      if (requestId === questionRequestRef.current) setLoading(false);
    }
  }, []);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const closeTrivia = useCallback(() => {
    clearAdvanceTimer();
    questionRequestRef.current += 1;
    triviaSessionRef.current += 1;
    serverSessionRef.current = null;
    advancingRef.current = false;
    setTriviaOpen(false);
    setLoading(false);
    setSubmitting(false);
    setQuestion(null);
    setSelected(null);
    setResult(null);
    setError('');
    setRoundComplete(false);
  }, [clearAdvanceTimer]);

  const openTrivia = (nextTier: TriviaTier) => {
    clearAdvanceTimer();
    questionRequestRef.current += 1;
    const sessionId = triviaSessionRef.current + 1;
    triviaSessionRef.current = sessionId;
    serverSessionRef.current = null;
    advancingRef.current = false;
    trackBallKnowerEvent('Trivia Started', { tier: nextTier });
    setTier(nextTier);
    setQuestionNumber(1);
    setScore(0);
    setRoundComplete(false);
    setTriviaOpen(true);
    setLoading(true);
    setSubmitting(false);
    setQuestion(null);
    setSelected(null);
    setResult(null);
    setError('');

    void beginTriviaSession().then(session => {
      if (sessionId !== triviaSessionRef.current) return;
      serverSessionRef.current = session;
      return loadQuestion(nextTier, session);
    }).catch(err => {
      if (sessionId !== triviaSessionRef.current) return;
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Could not start trivia right now.');
    });
  };

  const answer = async (index: number) => {
    if (!question || selected !== null || submitting) return;
    const sessionId = triviaSessionRef.current;
    const answeredQuestion = question;
    const answeredTier = tier;
    const answeredNumber = questionNumber;
    setSelected(index);
    setSubmitting(true);
    setError('');
    try {
      const receipt = await submitTriviaAnswer(answeredQuestion.attemptId, index);
      if (sessionId !== triviaSessionRef.current) return;
      trackBallKnowerEvent('Trivia Answered', {
        tier: answeredTier,
        correct: receipt.isCorrect,
        question_number: answeredNumber,
        progression_recorded: receipt.progressionRecorded,
        practice_only: Boolean(answeredQuestion.practiceOnly),
      });
      advancingRef.current = false;
      setResult(receipt);
      if (receipt.isCorrect) setScore(current => current + 1);
      const nextProgress=recordGauntletAnswer(loadGauntletProgress(userId),receipt.isCorrect,receipt.xpAwarded||({ROOKIE:15,PRO:25,'ALL-PRO':40,'HALL OF FAME':60}[answeredTier]));
      applyProgress(nextProgress);
    } catch (err) {
      if (sessionId !== triviaSessionRef.current) return;
      setSelected(null);
      setError(err instanceof Error ? err.message : 'Could not score that answer.');
    } finally {
      if (sessionId === triviaSessionRef.current) setSubmitting(false);
    }
  };

  const advanceQuestion = useCallback(() => {
    // The timeout and the manual button can fire in the same event window on mobile.
    // Claim this transition synchronously so one result creates exactly one next attempt.
    if (advancingRef.current) return;
    const sessionId = triviaSessionRef.current;
    const serverSession = serverSessionRef.current;
    advancingRef.current = true;
    clearAdvanceTimer();
    if (questionNumber >= 10) {
      const nextProgress=recordGauntletRun(loadGauntletProgress(userId),`TRIVIA:${tier}`,score,10);
      applyProgress(nextProgress);
      setRoundComplete(true);
      setQuestion(null);
      setSelected(null);
      setResult(null);
      advancingRef.current = false;
      trackBallKnowerEvent('Trivia Round Completed', { tier, score, questions: 10 });
      return;
    }
    setQuestionNumber(current => current + 1);
    void loadQuestion(tier, serverSession).finally(() => {
      if (sessionId === triviaSessionRef.current) advancingRef.current = false;
    });
  }, [applyProgress, clearAdvanceTimer, loadQuestion, questionNumber, score, tier, userId]);

  useEffect(() => {
    if (!result || !triviaOpen) {
      clearAdvanceTimer();
      return;
    }
    // Keep explanations readable by default while preserving an immediate manual fast path.
    advanceTimerRef.current = window.setTimeout(advanceQuestion, result.isCorrect ? 5000 : 7000);
    return clearAdvanceTimer;
  }, [result, triviaOpen, advanceQuestion, clearAdvanceTimer]);

  useEffect(() => () => {
    clearAdvanceTimer();
    questionRequestRef.current += 1;
    triviaSessionRef.current += 1;
    serverSessionRef.current = null;
  }, [clearAdvanceTimer]);

  useEffect(() => {
    if (!tierPickerMode) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTierPickerMode(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [tierPickerMode]);

  return (
    <BroadcastStage scene="studio" page="trivia" quiet={Boolean(triviaOpen||activeRun||dailyRun||tierPickerMode)} className="bk-gauntlet-screen mx-auto max-w-6xl px-2 pb-24 pt-2 sm:px-6 sm:pt-5">
      <section className="bk-gauntlet-frame" aria-labelledby="gauntlet-title" data-testid="gauntlet-arena">
        <div className="bk-gauntlet-date"><CalendarDays aria-hidden="true"/> Daily <span>•</span> {dailyDate}</div>
        <div className="bk-gauntlet-hero">
          <img src="/atmosphere/home-stadium.webp" alt="" aria-hidden="true"/>
          <div className="bk-gauntlet-hero-shade" aria-hidden="true"/>
          <div className="bk-gauntlet-arena-label">Football IQ Arena</div>
          <ModeGuide storageKey="bk-guide-the-gauntlet-v4" title="The Gauntlet" summary="Choose a challenge, select a difficulty, and build verified football IQ." steps={["Pick one of five challenge modes.","Choose Rookie, Pro, All-Pro, or Hall of Fame.","Finish the daily five to build your streak and XP."]}/>
          <div className="bk-gauntlet-crest" aria-hidden="true">
            <span className="bk-gauntlet-wing bk-gauntlet-wing-left"/><span className="bk-gauntlet-wing bk-gauntlet-wing-right"/>
            <div className="bk-gauntlet-eagle"><Bird/></div>
            <div className="bk-gauntlet-shield"><ShieldCheck/><span><Star/><Star/><Star/></span></div>
          </div>
          <div className="bk-gauntlet-title-lockup">
            <h1 id="gauntlet-title">The Gauntlet</h1>
            <p>Trivia. Decisions. Football IQ. Prove you know ball.</p>
          </div>
        </div>

        <section className="bk-gauntlet-stats" aria-label="Your Gauntlet progress">
          <ProgressStat label="Level" value={String(progress.level)} detail="UP-LEVELING" progress={levelProgress} icon={<Sparkles/>}/>
          <ProgressStat label="XP" value={String(progress.xp)} detail={`TO LVL ${progress.level+1}`} progress={levelProgress}/>
          <ProgressStat label="Current streak" value={String(progress.currentStreak)} detail={`MAX: ${progress.longestStreak}`} progress={progress.longestStreak?progress.currentStreak/progress.longestStreak*100:0} icon={<Flame/>}/>
          <ProgressStat label="Longest streak" value={String(progress.longestStreak)} detail="PERSONAL BEST" progress={Math.min(100,progress.longestStreak*10)} icon={<Medal/>}/>
          <ProgressStat label="Accuracy" value={progress.totalAnswered?`${accuracy}%`:'—'} detail={`${progress.totalAnswered} ANSWERED`} progress={accuracy}/>
        </section>

        <section className="bk-gauntlet-board" aria-label="Gauntlet challenge modes" data-testid="gauntlet-mode-grid">
          {gauntletModes.map(mode=>{
            const Icon=mode.icon;
            const best=Math.max(0,...triviaTiers.map(item=>progress.highScores[`${mode.name}:${item.name}`]||0));
            return <button type="button" key={mode.name} onClick={()=>setTierPickerMode(mode.name)} className="bk-gauntlet-mode-card">
              <span className="bk-gauntlet-mode-top"><Icon/><span>Best {best}/10</span></span>
              <strong>{mode.name==='TRIVIA'?'Classic Trivia':mode.name}</strong>
              <small>{mode.description}</small>
              <span className="bk-gauntlet-mode-action">Difficulty select <ChevronRight/></span>
            </button>;
          })}
          <div className="bk-gauntlet-mantra" aria-hidden="true">Same five<br/>challenges.</div>
        </section>

        <button type="button" onClick={()=>setDailyRun(true)} disabled={Boolean(progress.daily[dailyDate]?.completed)} className="bk-gauntlet-daily-cta" data-testid="gauntlet-daily-cta">
          <span aria-hidden="true">≡</span><span className="bk-gauntlet-daily-play"><Play/></span>
          <strong>{progress.daily[dailyDate]?.completed?`Daily complete · ${progress.daily[dailyDate].score}/5`:'Start daily challenge'}</strong><span aria-hidden="true">≡</span>
        </button>
      </section>

      {tierPickerMode&&<ModalPortal><div role="dialog" aria-modal="true" aria-label={`${tierPickerMode} difficulty`} className="bk-gauntlet-tier-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setTierPickerMode(null)}}><section className="bk-gauntlet-tier-sheet">
        <header><span><small>Difficulty select</small><strong>{tierPickerMode==='TRIVIA'?'Classic Trivia':tierPickerMode}</strong></span><button type="button" onClick={()=>setTierPickerMode(null)} aria-label="Close difficulty selector"><X/></button></header>
        <div className="bk-gauntlet-tier-list">{triviaTiers.map((item,index)=>{
          const highScore=progress.highScores[`${tierPickerMode}:${item.name}`]||0;
          return <button type="button" key={item.name} onClick={()=>{if(tierPickerMode==='TRIVIA')openTrivia(item.name);else setActiveRun({mode:tierPickerMode,tier:item.name,nonce:Date.now()});setTierPickerMode(null)}} className="bk-gauntlet-tier-card">
            <span className="bk-gauntlet-tier-medal">{index+1}</span><span className="bk-gauntlet-tier-copy"><strong>{item.name}</strong><small>{item.desc}</small></span>
            <span className="bk-gauntlet-tier-score"><b>{item.xp}</b><small>Best {highScore}/10</small></span>
          </button>;
        })}</div>
      </section></div></ModalPortal>}
      {activeRun&&<GauntletPlayModal key={activeRun.nonce} scenarios={runScenarios} title={`${activeRun.mode} · ${activeRun.tier}`} runKey={`${activeRun.mode}:${activeRun.tier}`} userId={userId} onClose={()=>setActiveRun(null)} onProgress={applyProgress} onReplay={()=>setActiveRun({...activeRun,nonce:Date.now()})}/>}
      {dailyRun&&<GauntletPlayModal scenarios={dailyScenarios} title={`Daily Gauntlet · ${dailyDate}`} runKey={`DAILY:${dailyDate}`} dailyDate={dailyDate} userId={userId} onClose={()=>setDailyRun(false)} onProgress={applyProgress}/>}
      {triviaOpen && <ModalPortal>
        <div role="dialog" aria-modal="true" aria-label={`${tier} Trivia`} className="bk-gauntlet-question-dialog fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-[#05070a] px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] text-white [-webkit-overflow-scrolling:touch] sm:px-4">
          <div className="mx-auto w-full max-w-2xl">
            <header className="flex min-h-12 items-center justify-between gap-3">
              <button onClick={closeTrivia} className="inline-flex min-h-11 items-center gap-2 px-1 text-[10px] font-black uppercase"><ArrowLeft className="h-4 w-4" /> Exit</button>
              <div className="text-center text-[10px] font-black uppercase tracking-wider text-fuchsia-400">{tier}</div>
              <div className="text-right text-[9px] font-black uppercase text-zinc-500">Score <span className="text-white">{score}</span></div>
            </header>

            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${Math.min(100, ((questionNumber - 1) % 10 + 1) * 10)}%` }} /></div>

            {roundComplete && (
              <section className="mt-5 rounded-2xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,.18),transparent_42%),#0b0e13] p-6 text-center sm:p-8">
                <Trophy className="mx-auto h-14 w-14 text-fuchsia-300" />
                <div className="mt-3 text-[10px] font-black uppercase tracking-[.24em] text-fuchsia-300">Round complete</div>
                <h2 className="mt-2 font-display text-4xl font-black uppercase">{score} / 10</h2>
                <p className="mt-2 text-sm font-semibold text-zinc-400">{score >= 9 ? 'Hall-of-Fame level round.' : score >= 7 ? 'Strong football IQ.' : score >= 5 ? 'Solid start—run it back.' : 'Hit another round and build the streak.'}</p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <button onClick={() => openTrivia(tier)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-fuchsia-400 px-4 text-sm font-black text-black"><RotateCcw className="h-4 w-4" /> Play another 10</button>
                  <button onClick={closeTrivia} className="min-h-12 rounded-xl border border-white/10 px-4 text-sm font-black">Back to Trivia</button>
                </div>
              </section>
            )}

            {!roundComplete && loading && <div className="flex min-h-56 items-center justify-center text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading challenge…</div>}
            {!loading && error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm font-semibold text-red-200">{error}<button onClick={() => void loadQuestion(tier, serverSessionRef.current)} className="ml-2 min-h-11 underline">Retry</button></div>}
            {!loading && question && (
              <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0e13] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">Question {questionNumber}</div>
                  {question.practiceOnly && <div className="inline-flex items-center gap-1 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-amber-200"><WifiOff className="h-3 w-3"/>Offline practice · no XP</div>}
                </div>
                <h2 className="mt-2 text-lg font-black leading-snug sm:text-2xl">{question.question}</h2>
                <div className="mt-4 grid gap-2">
                  {question.answers.map((choice, index) => {
                    const answered = Boolean(result);
                    const correct = answered && index === result?.correctIndex;
                    const chosen = index === selected;
                    return (
                      <button key={`${question.attemptId}-${index}`} disabled={selected !== null || submitting} onClick={() => void answer(index)} className={`flex min-h-14 items-center rounded-xl border px-3 text-left text-sm font-black disabled:cursor-default ${correct ? 'border-emerald-400 bg-emerald-400 text-black' : answered && chosen ? 'border-red-400 bg-red-400/12 text-red-200' : selected !== null && chosen ? 'border-fuchsia-400 bg-fuchsia-400/10' : 'border-white/10 bg-black/25 hover:border-fuchsia-400/45'}`}>
                        <span className={`mr-3 ${correct ? 'text-black' : 'text-fuchsia-400'}`}>{String.fromCharCode(65 + index)}.</span>
                        <span>{choice}</span>
                        {correct && <CheckCircle2 className="ml-auto h-5 w-5" />}
                        {answered && chosen && !correct && <XCircle className="ml-auto h-5 w-5" />}
                      </button>
                    );
                  })}
                </div>
                {submitting && <div className="mt-3 flex items-center text-xs font-bold text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Locking in your answer…</div>}
                {result && (
                  <div className="mt-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/[.05] p-3 text-xs leading-5 text-zinc-400">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`font-black uppercase ${result.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>{result.isCorrect ? 'Correct' : 'Missed'} {result.xpAwarded > 0 && `· +${result.xpAwarded} XP`}</div>
                      <button onClick={advanceQuestion} disabled={advancingRef.current} className="min-h-11 shrink-0 rounded-lg border border-fuchsia-400/25 px-3 text-[9px] font-black uppercase text-fuchsia-200 disabled:opacity-50">{questionNumber >= 10 ? 'See results' : 'Next now'}</button>
                    </div>
                    <div className="mt-1">{result.explanation}</div>
                    {question.practiceOnly ? <div className="mt-1 text-amber-200">Practice result only. Reconnect for verified XP and rating progress.</div> : result.progressionRecorded && <div className="mt-1 text-fuchsia-300">Saved to your BK Profile.</div>}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </ModalPortal>}
    </BroadcastStage>
  );
};

const ProgressStat=({label,value,detail,progress,icon}:{label:string;value:string;detail:string;progress?:number;icon?:React.ReactNode})=><div className="bk-gauntlet-stat"><span className="bk-gauntlet-stat-label">{label}{icon}</span><strong className="bk-gauntlet-stat-value">{value}</strong>{progress!==undefined&&<span className="bk-gauntlet-stat-bar" aria-hidden="true"><i style={{width:`${Math.max(3,progress)}%`}}/></span>}<small className="bk-gauntlet-stat-detail">{detail}</small></div>;
