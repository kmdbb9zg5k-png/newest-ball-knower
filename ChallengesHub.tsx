import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react';
import { fetchTriviaQuestion, submitTriviaAnswer, TriviaAnswerResult, TriviaQuestion } from './progressionCloud';
import { ModeGuide } from './ModeGuide';
import { ModalPortal } from './ModalPortal';

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
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-[2rem] border border-fuchsia-400/25 bg-[radial-gradient(circle_at_80%_10%,rgba(168,85,247,.22),transparent_32%),#090c11] p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.28em] text-fuchsia-400">Trivia · decisions · football IQ</div>
            <h1 className="mt-2 font-display text-4xl font-black uppercase sm:text-6xl">The Gauntlet</h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold text-zinc-400">One football challenge hub. Pick an experience, then play it full screen.</p>
          </div>
          <ModeGuide storageKey="bk-guide-the-gauntlet-v3" title="Trivia" summary="Test your football knowledge across four levels." steps={["Choose a level inside the Trivia box.", "Answer the full-screen question.", "The next question loads automatically after every answer."]} />
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-fuchsia-400/45 bg-[radial-gradient(circle_at_10%_0%,rgba(217,70,239,.16),transparent_35%),#0c1016] p-5 sm:p-8">
          <div className="mb-5 flex items-start gap-4">
            <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 p-3 text-fuchsia-400"><Brain className="h-7 w-7" /></div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-400">Choose your level</div>
              <h2 className="mt-1 font-display text-4xl font-black uppercase sm:text-5xl">Trivia</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-zinc-400">One Trivia game with four difficulty levels. Pick a level below—the next question loads automatically after every answer.</p>
            </div>
          </div>
          <div className="grid gap-2">
            {triviaTiers.map(item => (
              <button key={item.name} onClick={() => openTrivia(item.name)} className="group flex min-h-24 items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-left hover:border-fuchsia-400/45 hover:bg-fuchsia-400/[.06]">
                <span>
                  <span className="block font-display text-2xl font-black uppercase">{item.name}</span>
                  <span className="mt-1 block text-xs font-semibold text-zinc-400">{item.desc}</span>
                </span>
                <span className="ml-3 shrink-0 text-xs font-black text-fuchsia-400">{item.xp}</span>
              </button>
            ))}
          </div>
      </section>

      {triviaOpen && <ModalPortal>
        <div role="dialog" aria-modal="true" aria-label={`${tier} Trivia`} className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-[#05070a] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-white [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto w-full max-w-3xl">
            <header className="flex min-h-14 items-center justify-between gap-3">
              <button onClick={() => setTriviaOpen(false)} className="inline-flex min-h-11 items-center gap-2 px-2 text-[10px] font-black uppercase"><ArrowLeft className="h-4 w-4" /> Exit</button>
              <div className="text-center text-[10px] font-black uppercase tracking-wider text-fuchsia-400">{tier} Level</div>
              <div className="text-right text-[9px] font-black uppercase text-zinc-400">Score<br /><span className="text-white">{score}</span></div>
            </header>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${Math.min(100, ((questionNumber - 1) % 10 + 1) * 10)}%` }} /></div>

            <section className="relative mt-3 min-h-48 overflow-hidden rounded-[1.5rem] border border-fuchsia-400/70 bg-[#0b0712]">
              <img src="/team-cinematic/purple-receiver.jpg" alt="Football player making a catch under stadium lights" className="absolute inset-0 h-full w-full object-cover object-[center_34%] opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/95" />
              <div className="relative flex min-h-48 flex-col justify-end p-4 sm:p-6">
                <div className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">Question {questionNumber}</div>
                <h1 className="mt-2 max-w-xl font-display text-3xl font-black uppercase leading-[.92] sm:text-5xl">Prove you know ball.</h1>
              </div>
            </section>

            {loading && <div className="flex min-h-64 items-center justify-center text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading challenge…</div>}
            {!loading && error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm font-semibold text-red-200">{error}<button onClick={() => void loadQuestion(tier)} className="ml-2 underline">Retry</button></div>}
            {!loading && question && (
              <div className="pb-8">
                <h2 className="mt-4 text-lg font-black leading-snug sm:text-2xl">{question.question}</h2>
                <div className="mt-4 grid gap-2">
                  {question.answers.map((choice, index) => {
                    const answered = Boolean(result);
                    const correct = answered && index === result?.correctIndex;
                    const chosen = index === selected;
                    return (
                      <button key={`${question.attemptId}-${index}`} disabled={selected !== null || submitting} onClick={() => void answer(index)} className={`flex min-h-16 items-center rounded-xl border px-4 text-left text-sm font-black disabled:cursor-default ${correct ? 'border-emerald-400 bg-emerald-400 text-black' : answered && chosen ? 'border-red-400 bg-red-400/12 text-red-200' : selected !== null && chosen ? 'border-fuchsia-400 bg-fuchsia-400/10' : 'border-white/10 bg-[#0d1219] hover:border-fuchsia-400/45'}`}>
                        <span className={`mr-3 ${correct ? 'text-black' : 'text-fuchsia-400'}`}>{String.fromCharCode(65 + index)}.</span>
                        <span>{choice}</span>
                        {correct && <CheckCircle2 className="ml-auto h-5 w-5" />}
                        {answered && chosen && !correct && <XCircle className="ml-auto h-5 w-5" />}
                      </button>
                    );
                  })}
                </div>
                {submitting && <div className="mt-4 flex items-center text-xs font-bold text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Locking in your answer…</div>}
                {result && (
                  <div className="mt-3 rounded-xl border border-fuchsia-400/45 bg-fuchsia-400/[.06] p-3 text-xs leading-5 text-zinc-400">
                    <div className={`font-black uppercase ${result.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>{result.isCorrect ? 'Correct · auto-advancing' : 'Missed it · next question loading'} {result.xpAwarded > 0 && `· +${result.xpAwarded} XP`}</div>
                    <div className="mt-1">{result.explanation}</div>
                    {result.progressionRecorded && <div className="mt-1 text-fuchsia-300">Verified result saved to your BK Profile.</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ModalPortal>}
    </div>
  );
};
