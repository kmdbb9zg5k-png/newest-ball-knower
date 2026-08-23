import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Play, Share2, Sparkles, Timer, Trophy, UserRound } from 'lucide-react';
import { League } from './types';
import { useBallKnower } from './BallKnowerContext';
import { ensureOnlineSession, supabase } from './supabase';

interface Props {
  league: League;
  onGoToDraft: () => void;
  onViewResults: () => void;
}

const PUBLIC_APP_ORIGIN = 'https://ballknowerofficial.com';
const COUNTDOWN_SECONDS = 30;

const cleanCpuName = (name: string, index: number) => {
  const cleaned = name.replace(/\s+CPU(?:\s+\d+)?$/i, '').trim();
  return cleaned || `CPU ${index + 1}`;
};

export const LockedDraftOrderView: React.FC<Props> = ({ league, onGoToDraft, onViewResults }) => {
  const { currentUser, startLiveFantasyDraft, showToast } = useBallKnower();
  const result = league.seasonResult!;
  const random = result.orderMethod === 'random';
  const [starting, setStarting] = useState(false);
  const [readying, setReadying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myReady, setMyReady] = useState(false);
  const [humanReadyCount, setHumanReadyCount] = useState(0);
  const [humanTotal, setHumanTotal] = useState(() => league.members.filter(member => !member.isAi).length);
  const [readyMemberIds, setReadyMemberIds] = useState<Set<string>>(new Set());
  const [countdownStartedAt, setCountdownStartedAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const autoStartAttempted = useRef(false);
  const picks = result.draftOrder || [];
  const humanCount = picks.filter(pick => !pick.isAi).length;
  const cpuCount = picks.length - humanCount;
  const filledSlots = picks.length;
  const inviteUrl = `${PUBLIC_APP_ORIGIN}?join=${encodeURIComponent(league.code)}`;

  const myPick = useMemo(() => picks.find(pick =>
    pick.memberId === currentUser?.id || (!pick.isAi && pick.memberName === currentUser?.name)
  ), [picks, currentUser?.id, currentUser?.name]);

  const loadReadyState = async () => {
    if (!supabase) return;
    try {
      const auth = await ensureOnlineSession();
      const [{ data: members, error: membersError }, { data: leagueRow, error: leagueError }] = await Promise.all([
        supabase.from('ball_knower_league_members').select('id,auth_user_id,is_ai,live_draft_ready').eq('league_id', league.id),
        supabase.from('ball_knower_leagues').select('draft_countdown_started_at').eq('id', league.id).single(),
      ]);
      if (membersError) throw membersError;
      if (leagueError) throw leagueError;
      const humanRows = (members || []).filter((member: any) => !member.is_ai);
      const readyRows = humanRows.filter((member: any) => member.live_draft_ready);
      setHumanTotal(humanRows.length);
      setHumanReadyCount(readyRows.length);
      setReadyMemberIds(new Set((members || []).filter((member: any) => member.is_ai || member.live_draft_ready).map((member: any) => member.id)));
      setMyReady(Boolean(humanRows.find((member: any) => member.auth_user_id === auth.id)?.live_draft_ready));
      setCountdownStartedAt(leagueRow?.draft_countdown_started_at || null);
    } catch (error) {
      console.warn('Draft ready state could not be refreshed', error);
    }
  };

  useEffect(() => {
    void loadReadyState();
    if (!supabase) return;
    const channel = supabase.channel(`bk-draft-ready-${league.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_knower_league_members', filter: `league_id=eq.${league.id}` }, () => void loadReadyState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_knower_leagues', filter: `id=eq.${league.id}` }, () => void loadReadyState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_knower_live_drafts', filter: `league_id=eq.${league.id}` }, () => void loadReadyState())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [league.id]);

  useEffect(() => {
    if (!countdownStartedAt || league.liveDraft) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [countdownStartedAt, league.liveDraft]);

  const countdownRemaining = countdownStartedAt
    ? Math.max(0, Math.ceil((new Date(countdownStartedAt).getTime() + COUNTDOWN_SECONDS * 1000 - now) / 1000))
    : null;

  useEffect(() => {
    if (league.liveDraft || countdownRemaining !== 0 || autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    setStarting(true);
    void startLiveFantasyDraft(league.id)
      .then(started => {
        if (started) onGoToDraft();
        else {
          autoStartAttempted.current = false;
          showToast('Draft start is syncing. Try again in a moment.');
        }
      })
      .catch((error: any) => {
        autoStartAttempted.current = false;
        showToast(error?.message || 'The fantasy draft could not start.');
      })
      .finally(() => setStarting(false));
  }, [countdownRemaining, league.id, league.liveDraft]);

  const copyCode = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(league.code);
      setCopied(true);
      showToast('League code copied.');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast(`League code: ${league.code}`);
    }
  };

  const shareLeague = async () => {
    if (!navigator.share) {
      await copyCode();
      return;
    }
    try {
      await navigator.share({ title: league.name, text: `Ball Knower league ${league.code}`, url: inviteUrl });
    } catch (error: any) {
      if (error?.name !== 'AbortError') await copyCode();
    }
  };

  const toggleReady = async () => {
    if (!supabase || readying || countdownStartedAt || league.liveDraft) return;
    setReadying(true);
    try {
      await ensureOnlineSession();
      const { data, error } = await supabase.rpc('set_my_ball_knower_live_draft_ready', {
        p_league_id: league.id,
        p_ready: !myReady,
      });
      if (error) throw error;
      setMyReady(Boolean(data?.ready));
      if (data?.countdownStartedAt) setCountdownStartedAt(data.countdownStartedAt);
      showToast(data?.countdownStartedAt ? 'Everybody is ready. Draft starts in 30 seconds.' : (!myReady ? 'You are ready.' : 'You are no longer ready.'));
      await loadReadyState();
    } catch (error: any) {
      showToast(error?.message || 'Could not update your ready status.');
    } finally {
      setReadying(false);
    }
  };

  const openDraft = async () => {
    if (starting) return;
    if (league.liveDraft) {
      onGoToDraft();
      return;
    }
    if (!countdownStartedAt || countdownRemaining !== 0) return;
    setStarting(true);
    try {
      const started = await startLiveFantasyDraft(league.id);
      if (started) onGoToDraft();
      else showToast('The fantasy draft could not start. Try again.');
    } catch (error: any) {
      showToast(error?.message || 'The fantasy draft could not start.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-7rem)] bg-[#07090c] px-3 pb-6 pt-3 text-white sm:px-6">
      <div className="mx-auto max-w-3xl space-y-3">
        <header className="rounded-2xl border border-white/10 bg-[#0d1015] p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-xl font-black uppercase sm:text-2xl">{league.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase text-zinc-500">
                <span>{humanCount} human{humanCount === 1 ? '' : 's'}</span><span>•</span>
                <span>{cpuCount} CPU</span><span>•</span>
                <span>{filledSlots}/{league.maxMembers} filled</span>
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-emerald-400/25 bg-emerald-400/[.07] px-2.5 py-2 text-[9px] font-black uppercase text-emerald-300"><Check className="mr-1 inline h-3.5 w-3.5"/>Order Locked</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={copyCode} className="flex min-h-11 min-w-0 flex-1 items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 text-left" aria-label="Copy league code">
              <span><span className="block text-[8px] font-black uppercase tracking-widest text-zinc-600">League Code</span><span className="mt-0.5 block font-mono text-xs font-black text-[#D4AF37]">{league.code}</span></span>
              {copied ? <Check className="h-4 w-4 text-emerald-400"/> : <Copy className="h-4 w-4 text-zinc-500"/>}
            </button>
            <button onClick={shareLeague} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/30" aria-label="Share league"><Share2 className="h-4 w-4 text-zinc-300"/></button>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-[radial-gradient(circle_at_90%_0%,rgba(212,175,55,.14),transparent_32%),#101318]">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#D4AF37] text-black">{random ? <Sparkles className="h-5 w-5"/> : <Trophy className="h-5 w-5"/>}</div>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Official Fantasy Draft Order</div>
                <h1 className="mt-0.5 font-display text-2xl font-black uppercase sm:text-3xl">Draft Order Locked</h1>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Managers Ready</div>
                <div className="mt-1 text-xs font-black text-emerald-300">{humanReadyCount}/{humanTotal}</div>
              </div>
              <div className={`rounded-xl border p-3 ${myPick ? 'border-[#D4AF37]/35 bg-[#D4AF37]/10' : 'border-white/10 bg-black/25'}`}>
                <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Your Pick</div>
                <div className={`mt-1 text-xs font-black ${myPick ? 'text-[#D4AF37]' : 'text-zinc-400'}`}>{myPick ? `#${myPick.pickNumber}` : '—'}</div>
              </div>
            </div>

            {league.liveDraft ? (
              <button onClick={() => void openDraft()} className="mt-3 min-h-13 w-full rounded-xl bg-[#D4AF37] px-4 py-3.5 text-sm font-black uppercase tracking-wider text-black"><Play className="mr-2 inline h-4 w-4"/>Enter Fantasy Draft</button>
            ) : countdownStartedAt ? (
              <div className="mt-3 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-4 text-center">
                <div className="text-[9px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Everybody Is Ready</div>
                <div className="mt-1 flex items-center justify-center gap-2 font-display text-4xl font-black text-white"><Timer className="h-6 w-6 text-[#D4AF37]"/>0:{String(countdownRemaining ?? 0).padStart(2, '0')}</div>
                <div className="mt-1 text-[10px] font-black uppercase text-zinc-400">Draft room opens automatically</div>
              </div>
            ) : (
              <button onClick={() => void toggleReady()} disabled={readying} className={`mt-3 min-h-14 w-full rounded-xl px-4 text-sm font-black uppercase tracking-wider transition active:scale-[.99] disabled:opacity-50 ${myReady ? 'border border-emerald-400/35 bg-emerald-400/10 text-emerald-300' : 'bg-[#D4AF37] text-black'}`}>
                <Check className="mr-2 inline h-4 w-4"/>{readying ? 'Updating…' : myReady ? `Ready ✓ · Waiting for ${Math.max(0, humanTotal-humanReadyCount)} Manager${Math.max(0,humanTotal-humanReadyCount)===1?'':'s'}` : 'Ready Up'}
              </button>
            )}

            <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-wider text-zinc-600">Every human manager must ready up. CPU managers are automatically ready.</p>
            <button onClick={onViewResults} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-400"><Trophy className="mr-2 inline h-4 w-4"/>View & Share Official Order</button>
          </div>

          <div className="border-t border-white/10 bg-black/20 px-3 py-2.5 sm:px-4">
            <div className="mb-2 flex items-center justify-between px-1"><div className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500">Draft Board</div><div className="text-[9px] font-bold text-zinc-600">{filledSlots} PICKS</div></div>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#090b0e]">
              {picks.map((pick, index) => {
                const mine = pick.memberId === currentUser?.id || (!pick.isAi && pick.memberName === currentUser?.name);
                const displayName = pick.isAi ? cleanCpuName(pick.memberName, index) : pick.memberName;
                const memberReady = pick.isAi || readyMemberIds.has(pick.memberId);
                return <div key={pick.memberId} className={`grid min-h-12 grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[.06] px-2.5 py-2 last:border-b-0 ${mine ? 'bg-[#D4AF37]/10' : ''}`}>
                  <div className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black ${mine ? 'bg-[#D4AF37] text-black' : 'bg-white/[.05] text-zinc-400'}`}>#{pick.pickNumber}</div>
                  <div className="min-w-0"><div className="truncate text-xs font-black uppercase">{displayName}</div><div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-zinc-600">{mine ? 'Your Draft Slot' : pick.isAi ? 'CPU Manager · Auto Ready' : memberReady ? 'Human Manager · Ready' : 'Human Manager · Not Ready'}</div></div>
                  <div className={`rounded-md px-2 py-1 text-[8px] font-black uppercase ${mine ? 'bg-[#D4AF37] text-black' : memberReady ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[.05] text-zinc-500'}`}>{mine ? (myReady ? 'READY' : 'YOU') : memberReady ? 'READY' : <><UserRound className="mr-1 inline h-3 w-3"/>WAIT</>}</div>
                </div>;
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
