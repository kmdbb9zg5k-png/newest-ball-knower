import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, Eye, Film, Loader2, MessageSquare, RotateCcw, ShieldCheck, Target, Trophy, WifiOff, XCircle } from 'lucide-react';
import { beginTriviaSession, fetchTriviaQuestion, submitTriviaAnswer, TriviaAnswerResult, TriviaQuestion, TriviaSession } from './progressionCloud';
import { ModeGuide } from './ModeGuide';
import { ModalPortal } from './ModalPortal';
import { trackBallKnowerEvent } from './analytics';

type TriviaTier = 'ROOKIE' | 'PRO' | 'ALL-PRO' | 'HALL OF FAME';

const triviaTiers: { name: TriviaTier; desc: string; xp: string }[] = [
  { name: 'ROOKIE', desc: 'Rules, teams and football basics', xp: '15 XP' },
  { name: 'PRO', desc: 'Current NFL knowledge and concepts', xp: '25 XP' },
  { name: 'ALL-PRO', desc: 'Multi-clue football IQ and schemes', xp: '40 XP' },
  { name: 'HALL OF FAME', desc: 'Deep history, elimination and mastery', xp: '60 XP' },
];

type GauntletModeName='TRIVIA'|'FILM ROOM'|'PREDICTIONS'|'DEBATES'|'SURVIVOR';
type MiniChallenge={prompt:string;context:string;options:string[];correct:number;explanation:string};
const gauntletModes:{name:GauntletModeName;description:string;icon:typeof Brain}[] = [
  {name:'TRIVIA',description:'Four difficulty levels with verified XP.',icon:Brain},
  {name:'FILM ROOM',description:'Read coverages and diagnose the play.',icon:Film},
  {name:'PREDICTIONS',description:'Call the result from game context.',icon:Target},
  {name:'DEBATES',description:'Choose the evidence that wins the argument.',icon:MessageSquare},
  {name:'SURVIVOR',description:'One wrong pick ends the run.',icon:ShieldCheck},
];
const miniChallenges:Record<Exclude<GauntletModeName,'TRIVIA'>,MiniChallenge[]>={
  'FILM ROOM':[
    {context:'3rd & 8 · Defense shows two high safeties. The nickel trails the slot and both safeties stay deep.',prompt:'What coverage did the defense most likely rotate into?',options:['Cover 0','Cover 2 Man','Cover 3 Buzz','Goal-line bracket'],correct:1,explanation:'Two deep safeties with underneath defenders playing trail technique points to Cover 2 Man.'},
    {context:'Red zone · The edge crashes hard on the running back while the linebacker widens with the tight end.',prompt:'What should the quarterback read next on zone read?',options:['Hand it off','Keep outside the crashing edge','Throw the ball away immediately','Audible to a punt'],correct:1,explanation:'A crashing read defender gives the quarterback space to keep around the edge.'},
    {context:'2-minute drill · Defense sends six and leaves the middle vacant.',prompt:'Which answer beats the pressure fastest?',options:['Seven-step comeback','Quick slant or hot route','Slow play-action shot','Quarterback sneak'],correct:1,explanation:'A hot slant attacks the vacated middle before the free rusher arrives.'},
  ],
  'PREDICTIONS':[
    {context:'Favorite leads by 4 with 2:20 left. Opponent has no timeouts and the favorite has 1st & 10.',prompt:'What is the most likely result?',options:['Favorite closes it out','Opponent gets two more possessions','Game automatically goes to overtime','Favorite must attempt a field goal now'],correct:0,explanation:'Three productive runs can nearly drain the remaining clock, making a closeout most likely.'},
    {context:'Underdog is +3 in turnovers but trails by 2 entering the fourth quarter.',prompt:'Which warning matters most?',options:['Turnover luck may regress','The underdog cannot score again','Possession no longer matters','The favorite must bench its quarterback'],correct:0,explanation:'A team already benefiting from three turnovers may not keep receiving short fields.'},
    {context:'Heavy rain, 25 mph wind, two run-first teams and a low total.',prompt:'Which game script is most likely?',options:['Fast, pass-heavy shootout','Lower scoring with longer drives','Every drive ends in a turnover','No team attempts a field goal'],correct:1,explanation:'Wind and run-heavy offenses usually reduce explosive passing and keep the clock moving.'},
  ],
  'DEBATES':[
    {context:'Claim: “Quarterback wins are the best way to rank quarterbacks.”',prompt:'Which response uses the strongest evidence?',options:['Wins are all that matter because football is a team sport','Compare efficiency, pressure response and supporting cast alongside wins','The quarterback with the coolest highlights is best','Ignore playoff performance completely'],correct:1,explanation:'The strongest case separates individual quarterback play from team context without ignoring results.'},
    {context:'Claim: “A running back with more rushing yards was automatically better.”',prompt:'Which rebuttal wins the argument?',options:['Volume, efficiency, receiving and blocking context all matter','Yards never matter','Only touchdowns count','Use fan voting'],correct:0,explanation:'Total yards alone can hide workload and efficiency differences.'},
    {context:'Claim: “The defense allowed 30 points, so it played badly.”',prompt:'What context should be checked first?',options:['Uniform color','Field position, turnovers and defensive points allowed','Ticket prices','Pregame music'],correct:1,explanation:'Short fields and opponent defensive scores can make the scoreboard misrepresent defensive performance.'},
  ],
  'SURVIVOR':[
    {context:'Round 1 · PHI at home against a backup quarterback; KC travels to a division rival; BUF is on a short week.',prompt:'Pick the safest survivor choice.',options:['PHI','KC','BUF'],correct:0,explanation:'The home favorite facing a backup quarterback carries the fewest listed risk factors.'},
    {context:'Round 2 · BAL is a large home favorite; DAL lost both starting tackles; MIA faces an elite pass rush.',prompt:'Stay alive. Who is safest?',options:['DAL','MIA','BAL'],correct:2,explanation:'BAL combines the strongest favorite profile with home field and no listed lineup warning.'},
    {context:'Round 3 · SF is rested after a bye; GB plays its third road game; NYJ starts a rookie quarterback.',prompt:'Make the final pick.',options:['GB','NYJ','SF'],correct:2,explanation:'Rest and stability make SF the safest of these three choices.'},
  ],
};

const MiniGauntlet:React.FC<{mode:Exclude<GauntletModeName,'TRIVIA'>;onClose:()=>void}>=({mode,onClose})=>{
  const challenges=miniChallenges[mode];
  const[index,setIndex]=useState(0);
  const[score,setScore]=useState(0);
  const[selected,setSelected]=useState<number|null>(null);
  const[eliminated,setEliminated]=useState(false);
  const complete=index>=challenges.length;
  const challenge=challenges[Math.min(index,challenges.length-1)];
  const choose=(choice:number)=>{if(selected!==null)return;setSelected(choice);if(choice===challenge.correct)setScore(value=>value+1);else if(mode==='SURVIVOR')setEliminated(true);};
  const next=()=>{if(eliminated){setIndex(challenges.length);return;}setIndex(value=>value+1);setSelected(null);};
  return <ModalPortal><div role="dialog" aria-modal="true" aria-label={mode} className="fixed inset-0 z-[9999] overflow-y-auto bg-[#05070a] px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] text-white"><div className="mx-auto max-w-2xl"><header className="flex min-h-12 items-center justify-between"><button onClick={onClose} className="inline-flex min-h-11 items-center gap-2 text-[10px] font-black"><ArrowLeft size={16}/> EXIT</button><div className="text-[10px] font-black tracking-widest text-fuchsia-300">{mode}</div><div className="text-[10px] font-black">{score} PTS</div></header>{complete?<section className="mt-5 rounded-3xl border border-fuchsia-400/25 bg-[#0b0e13] p-7 text-center"><Trophy className="mx-auto h-14 w-14 text-fuchsia-300"/><div className="mt-3 text-[10px] font-black tracking-widest text-fuchsia-300">{eliminated?'RUN ENDED':'GAUNTLET CLEARED'}</div><h2 className="mt-2 text-4xl font-black">{score} / {challenges.length}</h2><p className="mt-2 text-sm text-zinc-400">{eliminated?'One miss ends Survivor. Study the risk and run it back.':'Your result is saved for this run.'}</p><button onClick={onClose} className="mt-5 min-h-12 w-full rounded-xl bg-fuchsia-400 font-black text-black">BACK TO THE GAUNTLET</button></section>:<><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-fuchsia-400" style={{width:`${((index+1)/challenges.length)*100}%`}}/></div><section className="mt-4 rounded-3xl border border-white/10 bg-[#0b0e13] p-5"><div className="text-[9px] font-black tracking-widest text-fuchsia-300">CHALLENGE {index+1} OF {challenges.length}</div><div className="mt-3 rounded-xl bg-fuchsia-400/[.06] p-3 text-xs font-bold leading-5 text-zinc-300">{challenge.context}</div><h2 className="mt-4 text-2xl font-black leading-tight">{challenge.prompt}</h2><div className="mt-4 grid gap-2">{challenge.options.map((option,choice)=>{const answered=selected!==null;const correct=answered&&choice===challenge.correct;const wrong=answered&&choice===selected&&!correct;return <button key={option} disabled={answered} onClick={()=>choose(choice)} className={`min-h-14 rounded-xl border px-4 text-left text-sm font-black ${correct?'border-emerald-400 bg-emerald-400 text-black':wrong?'border-red-400 bg-red-400/10 text-red-200':'border-white/10 bg-black/25'}`}>{option}</button>})}</div>{selected!==null&&<div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/[.05] p-4 text-xs leading-5 text-zinc-300"><b className={selected===challenge.correct?'text-emerald-300':'text-red-300'}>{selected===challenge.correct?'CORRECT':'MISSED'}</b><p className="mt-1">{challenge.explanation}</p><button onClick={next} className="mt-3 min-h-11 w-full rounded-xl bg-fuchsia-400 font-black text-black">{eliminated?'SEE RESULT':index===challenges.length-1?'FINISH':'NEXT CHALLENGE'}</button></div>}</section></>}</div></div></ModalPortal>;
};

export const ChallengesHub: React.FC = () => {
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
  const [miniMode,setMiniMode]=useState<Exclude<GauntletModeName,'TRIVIA'>|null>(null);
  const advancingRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  const questionRequestRef = useRef(0);
  const triviaSessionRef = useRef(0);
  const serverSessionRef = useRef<TriviaSession | null>(null);

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
  }, [clearAdvanceTimer, loadQuestion, questionNumber, score, tier]);

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

  return (
    <div className="mx-auto max-w-6xl px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
      <section className="relative min-h-[22rem] overflow-hidden rounded-[2rem] border border-fuchsia-400/30 bg-[#08070d] shadow-[0_24px_80px_rgba(88,28,135,.25)]">
        <img src="/team-cinematic/purple-receiver.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08070d] via-[#08070d]/80 to-fuchsia-950/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08070d] via-transparent to-black/20" />
        <div className="relative z-10 flex min-h-[22rem] flex-col justify-between p-6 sm:p-9 md:w-2/3">
          <header className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[.3em] text-fuchsia-300"><Eye className="h-4 w-4"/>Football IQ Arena</div>
            <ModeGuide storageKey="bk-guide-the-gauntlet-v4" title="The Gauntlet" summary="Choose a difficulty and answer football questions. Correct verified answers feed your Ball Knower progression." steps={["Choose Trivia.", "Pick a level.", "Answer and build verified XP."]} />
          </header>
          <div className="py-8">
            <div className="text-[10px] font-black uppercase tracking-[.25em] text-fuchsia-300">Trivia · Decisions · Football IQ</div>
            <h1 className="mt-3 font-display text-5xl font-black uppercase leading-[.82] tracking-[-.045em] sm:text-7xl">The<br/>Gauntlet.</h1>
            <p className="mt-5 max-w-lg text-sm font-semibold leading-relaxed text-zinc-300">Prove you know ball under pressure. Every challenge is built to test recognition, judgment and nerve.</p>
          </div>
          <button onClick={()=>openTrivia('ROOKIE')} className="min-h-12 w-fit rounded-full bg-fuchsia-400 px-6 text-[10px] font-black uppercase tracking-widest text-black">Enter Trivia</button>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {gauntletModes.map(mode=>{const Icon=mode.icon;return <button key={mode.name} onClick={()=>mode.name==='TRIVIA'?openTrivia('ROOKIE'):setMiniMode(mode.name)} className="min-h-40 rounded-2xl border border-fuchsia-400/30 bg-[#101318] p-4 text-left"><Icon className="text-fuchsia-300"/><div className="mt-6 text-sm font-black uppercase">{mode.name}</div><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{mode.description}</p><div className="mt-3 text-[8px] font-black uppercase tracking-widest text-fuchsia-300">Play now</div></button>})}
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_88%_8%,rgba(168,85,247,.18),transparent_34%),#0b0e13] p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-fuchsia-300"><Brain className="h-4 w-4"/>Choose difficulty</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {triviaTiers.map(item => (
            <button key={item.name} onClick={() => openTrivia(item.name)} className="group flex min-h-16 items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-left hover:border-fuchsia-400/45 hover:bg-fuchsia-400/[.06]">
              <span className="min-w-0">
                <span className="block font-display text-xl font-black uppercase">{item.name}</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-zinc-500">{item.desc}</span>
              </span>
              <span className="ml-3 shrink-0 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/10 px-2 py-1 text-[9px] font-black text-fuchsia-300">{item.xp}</span>
            </button>
          ))}
        </div>
      </section>

      {miniMode&&<MiniGauntlet mode={miniMode} onClose={()=>setMiniMode(null)}/>}
      {triviaOpen && <ModalPortal>
        <div role="dialog" aria-modal="true" aria-label={`${tier} Trivia`} className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-[#05070a] px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] text-white [-webkit-overflow-scrolling:touch] sm:px-4">
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
    </div>
  );
};
