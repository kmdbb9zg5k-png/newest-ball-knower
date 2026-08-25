import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, Loader2, WifiOff, XCircle } from 'lucide-react';
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

export const ChallengesHub: React.FC = () => {
  const [tier, setTier] = useState<TriviaTier>('ROOKIE');
  const [triviaOpen, setTriviaOpen] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<TriviaAnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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
    setQuestionNumber(current => current + 1);
    void loadQuestion(tier, serverSession).finally(() => {
      if (sessionId === triviaSessionRef.current) advancingRef.current = false;
    });
  }, [clearAdvanceTimer, loadQuestion, tier]);

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
    <div className="mx-auto max-w-5xl px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[.24em] text-fuchsia-400">Football IQ</div>
          <h1 className="mt-1 font-display text-3xl font-black uppercase sm:text-5xl">Trivia</h1>
          <p className="mt-1 max-w-xl text-xs font-semibold text-zinc-500">Pick a level, answer fast, and build your Ball Knower profile.</p>
        </div>
        <ModeGuide storageKey="bk-guide-the-gauntlet-v4" title="Trivia" summary="Choose a difficulty and answer football questions. Correct verified answers feed your Ball Knower progression." steps={["Pick a level.", "Answer the question.", "Read the result or tap Next now to keep moving."]} />
      </header>

      <section className="mt-3 overflow-hidden rounded-2xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_88%_8%,rgba(168,85,247,.18),transparent_34%),#0b0e13] p-3 sm:p-4">
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

      {triviaOpen && <ModalPortal>
        <div role="dialog" aria-modal="true" aria-label={`${tier} Trivia`} className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-[#05070a] px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] text-white [-webkit-overflow-scrolling:touch] sm:px-4">
          <div className="mx-auto w-full max-w-2xl">
            <header className="flex min-h-12 items-center justify-between gap-3">
              <button onClick={closeTrivia} className="inline-flex min-h-11 items-center gap-2 px-1 text-[10px] font-black uppercase"><ArrowLeft className="h-4 w-4" /> Exit</button>
              <div className="text-center text-[10px] font-black uppercase tracking-wider text-fuchsia-400">{tier}</div>
              <div className="text-right text-[9px] font-black uppercase text-zinc-500">Score <span className="text-white">{score}</span></div>
            </header>

            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${Math.min(100, ((questionNumber - 1) % 10 + 1) * 10)}%` }} /></div>

            {loading && <div className="flex min-h-56 items-center justify-center text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading challenge…</div>}
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
                      <button onClick={advanceQuestion} disabled={advancingRef.current} className="min-h-11 shrink-0 rounded-lg border border-fuchsia-400/25 px-3 text-[9px] font-black uppercase text-fuchsia-200 disabled:opacity-50">Next now</button>
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