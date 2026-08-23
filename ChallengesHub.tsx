import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { fetchTriviaQuestion, submitTriviaAnswer, TriviaAnswerResult, TriviaQuestion } from './progressionCloud';
import { ModeGuide } from './ModeGuide';
import { ModalPortal } from './ModalPortal';
import { trackBallKnowerEvent } from './analytics';

type TriviaTier = 'ROOKIE' | 'PRO' | 'ALL-PRO' | 'HALL OF FAME';

const triviaTiers: { name: TriviaTier; desc: string; xp: string }[] = [
  { name: 'ROOKIE', desc: 'Stars, teams and basic records', xp: '15 XP' },
  { name: 'PRO', desc: 'Draft history and tougher stats', xp: '25 XP' },
  { name: 'ALL-PRO', desc: 'Advanced football comparisons', xp: '40 XP' },
  { name: 'HALL OF FAME', desc: 'Rare records and brutal history', xp: '60 XP' },
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

  const loadQuestion = useCallback(async (nextTier: TriviaTier) => {
    setLoading(true);
    setError('');
    setSelected(null);
    setResult(null);
    try {
      setQuestion(await fetchTriviaQuestion(nextTier));
    } catch (err) {
      setQuestion(null);
      setError(err instanceof Error ? err.message : 'Could not load trivia right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openTrivia = (nextTier: TriviaTier) => {
    trackBallKnowerEvent('Trivia Started', { tier: nextTier });
    setTier(nextTier);
    setQuestionNumber(1);
    setScore(0);
    setTriviaOpen(true);
    void loadQuestion(nextTier);
  };

  const answer = async (index: number) => {
    if (!question || selected !== null || submitting) return;
    setSelected(index);
    setSubmitting(true);
    setError('');
    try {
      const receipt = await submitTriviaAnswer(question.attemptId, index);
      trackBallKnowerEvent('Trivia Answered', {
        tier,
        correct: receipt.isCorrect,
        question_number: questionNumber,
        progression_recorded: receipt.progressionRecorded,
      });
      setResult(receipt);
      if (receipt.isCorrect) setScore(current => current + 1);
    } catch (err) {
      setSelected(null);
      setError(err instanceof Error ? err.message : 'Could not score that answer.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!result || !triviaOpen) return;
    const timer = window.setTimeout(() => {
      setQuestionNumber(current => current + 1);
      void loadQuestion(tier);
    }, result.isCorrect ? 1500 : 2300);
    return () => window.clearTimeout(timer);
  }, [result, triviaOpen, tier, loadQuestion]);

  return (
    <div className="mx-auto max-w-5xl px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[.24em] text-fuchsia-400">Football IQ</div>
          <h1 className="mt-1 font-display text-3xl font-black uppercase sm:text-5xl">Trivia</h1>
          <p className="mt-1 max-w-xl text-xs font-semibold text-zinc-500">Pick a level, answer fast, and build your Ball Knower profile.</p>
        </div>
        <ModeGuide storageKey="bk-guide-the-gauntlet-v4" title="Trivia" summary="Choose a difficulty and answer football questions. Correct answers feed your Ball Knower progression." steps={["Pick a level.", "Answer the question.", "The next question loads automatically."]} />
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
              <button onClick={() => setTriviaOpen(false)} className="inline-flex min-h-10 items-center gap-2 px-1 text-[10px] font-black uppercase"><ArrowLeft className="h-4 w-4" /> Exit</button>
              <div className="text-center text-[10px] font-black uppercase tracking-wider text-fuchsia-400">{tier}</div>
              <div className="text-right text-[9px] font-black uppercase text-zinc-500">Score <span className="text-white">{score}</span></div>
            </header>

            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${Math.min(100, ((questionNumber - 1) % 10 + 1) * 10)}%` }} /></div>

            {loading && <div className="flex min-h-56 items-center justify-center text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading challenge…</div>}
            {!loading && error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm font-semibold text-red-200">{error}<button onClick={() => void loadQuestion(tier)} className="ml-2 underline">Retry</button></div>}
            {!loading && question && (
              <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0e13] p-4 sm:p-5">
                <div className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">Question {questionNumber}</div>
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
                    <div className={`font-black uppercase ${result.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>{result.isCorrect ? 'Correct · next question' : 'Missed · next question'} {result.xpAwarded > 0 && `· +${result.xpAwarded} XP`}</div>
                    <div className="mt-1">{result.explanation}</div>
                    {result.progressionRecorded && <div className="mt-1 text-fuchsia-300">Saved to your BK Profile.</div>}
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
