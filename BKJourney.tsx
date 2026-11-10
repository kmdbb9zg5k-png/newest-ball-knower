import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, CircleHelp, Coins, Crown, Flame, Gift, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Target, Trophy, X } from 'lucide-react';
import type { AppTab } from './App';
import { ensureOnlineSession, supabase } from './supabase';
import './bkJourney.css';

type Claim = { checkpoint: number; coins: number; gift: string | null; claimedAt: string };
type State = { xp: number; level: number; coins: number; claims: Claim[]; today: { trivia: number; prediction: number; h2h: number }; todayDate: string; source: 'verified' };
type View = 'daily' | 'journey' | 'rewards';
type Props = { onClose: () => void; onNavigate: (tab: AppTab) => void };

const milestones = [
  { id: 1, xp: 25, coins: 50, title: 'FIRST DOWN', gift: '', icon: Coins },
  { id: 2, xp: 100, coins: 100, title: 'PLAYMAKER', gift: '', icon: Coins },
  { id: 3, xp: 250, coins: 0, title: 'ROOKIE CROWN', gift: 'Rookie Crown Badge', icon: Gift },
  { id: 4, xp: 500, coins: 200, title: 'ALL-PRO', gift: '', icon: Coins },
  { id: 5, xp: 1000, coins: 100, title: 'GOLDEN LEGACY', gift: 'Golden BK Nameplate', icon: Crown },
] as const;

const missions = [
  { id: 'trivia', title: 'NFL TRIVIA', caption: 'Answer a verified trivia question correctly', category: 'challenges', label: 'Play Trivia', xp: 'Verified XP', coin: 'XP progress', icon: CircleHelp },
  { id: 'prediction', title: 'MAKE A PREDICTION', caption: 'Get a completed NFL pick graded', category: 'sportsbook', label: 'Make Picks', xp: 'Verified XP', coin: 'XP progress', icon: Target },
  { id: 'h2h', title: 'PLAY HEAD-TO-HEAD', caption: 'Finish a verified H2H game', category: 'football', label: 'Play H2H', xp: 'Verified XP', coin: 'XP progress', icon: Trophy },
] as const;

const number = (n: number) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US');
const sanitize = (raw: unknown): State => {
  if (!raw || typeof raw !== 'object' || (raw as any).source !== 'verified') throw new Error('Verified rewards are temporarily unavailable.');
  const v = raw as any;
  const safe = (n: any) => Math.max(0, Number.isFinite(Number(n)) ? Math.floor(Number(n)) : 0);
  return {
    xp: safe(v.xp), level: Math.max(1, safe(v.level)), coins: safe(v.coins),
    claims: Array.isArray(v.claims) ? v.claims.filter((c: any) => Number.isInteger(c?.checkpoint) && c.checkpoint >= 1 && c.checkpoint <= 5).map((c: any) => ({ checkpoint: c.checkpoint, coins: safe(c.coins), gift: typeof c.gift === 'string' ? c.gift : null, claimedAt: String(c.claimedAt || '') })) : [],
    today: { trivia: safe(v.today?.trivia), prediction: safe(v.today?.prediction), h2h: safe(v.today?.h2h) },
    todayDate: String(v.todayDate || ''), source: 'verified',
  };
};

export default function BKJourney({ onClose, onNavigate }: Props) {
  const [view, setView] = useState<View>('daily');
  const [data, setData] = useState<State | null>(null);
  const [busy, setBusy] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) throw new Error('Online rewards are not configured.');
    await ensureOnlineSession();
    const { data: result, error: problem } = await supabase.rpc('bk_journey_state');
    if (problem) throw new Error('Your reward progress could not be verified. Please retry.');
    setData(sanitize(result));
    setError('');
  }, []);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    void refresh().catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Rewards unavailable.'); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [refresh]);

  const claim = async (checkpoint: number) => {
    if (!data || claiming !== null || !supabase) return;
    setClaiming(checkpoint); setNotice(''); setError('');
    try {
      const { data: result, error: problem } = await supabase.rpc('bk_journey_claim', { p_checkpoint: checkpoint });
      if (problem) throw new Error('That reward could not be confirmed. Refresh and try again.');
      await refresh();
      setNotice(result?.claimed === true ? 'Reward claimed and saved to your BK Journey collection!' : 'This reward is already in your collection.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Claim failed.'); }
    finally { setClaiming(null); }
  };
  const owned = useMemo(() => new Set(data?.claims.map(c => c.checkpoint) || []), [data]);
  const completed = data ? missions.filter(m => data.today[m.id] > 0).length : 0;
  const xp = data?.xp || 0;
  const nextMilestone = milestones.find(m => xp < m.xp) || milestones[milestones.length - 1];
  const quest = (tab: AppTab) => { onClose(); onNavigate(tab); };

  return <div className="bk-journey" aria-label="BK Journey rewards" data-bk-journey>
    <header className="bk-journey-header">
      <div className="bk-journey-brand"><Crown aria-hidden="true"/><span>BALL<br/>KNOWER</span></div>
      <div className="bk-journey-wallet" aria-label={data ? number(data.coins) + ' BK Coins' : 'Coin balance loading'}><Coins aria-hidden="true"/><span>BK COINS<strong>{data ? number(data.coins) : '—'}</strong></span></div>
      <button type="button" className="bk-journey-dismiss" aria-label="Close BK Journey" onClick={onClose}><X aria-hidden="true"/></button>
    </header>
    <nav aria-label="BK Journey views" className="bk-journey-tabs">
      <button type="button" aria-pressed={view === 'daily'} onClick={() => setView('daily')}><CalendarDays aria-hidden="true"/>Daily Challenges</button>
      <button type="button" aria-pressed={view === 'journey'} onClick={() => setView('journey')}><Trophy aria-hidden="true"/>BK Journey</button>
      <button type="button" aria-pressed={view === 'rewards'} onClick={() => setView('rewards')}><Gift aria-hidden="true"/>My Rewards</button>
      <button type="button" onClick={() => quest('store')}><Coins aria-hidden="true"/>BK Store</button>
    </nav>

    <section className="bk-journey-hero" aria-labelledby="bk-journey-title">
      <img src="/profile/cinematic/player-hero.webp" alt="" loading="lazy"/>
      <div className="bk-journey-hero-copy"><p><Sparkles size={15} aria-hidden="true"/> PLAY · EARN · UNLOCK</p><h2 id="bk-journey-title">{view === 'daily' ? 'DAILY CHALLENGES' : view === 'journey' ? 'BK JOURNEY' : 'YOUR REWARDS'}</h2><span>{view === 'daily' ? 'Complete real football challenges. Make every play count.' : view === 'journey' ? 'Your verified XP unlocks a path of coins and gifts.' : 'Every claimed reward stays in your BK collection.'}</span></div>
      <div className="bk-journey-hero-stat"><span>LEVEL {data?.level ?? '—'}</span><strong>{data ? number(xp) : '—'} XP</strong><small>{data ? number(nextMilestone.xp) + ' XP next milestone' : 'Verified progression'}</small></div>
    </section>

    <div className="bk-journey-body">
      {busy && <p role="status" className="bk-journey-status">Checking your verified XP and rewards…</p>}
      {error && <div className="bk-journey-error" role="alert">{error}<button type="button" onClick={() => { setBusy(true); void refresh().catch(e => setError(e instanceof Error ? e.message : 'Try again.')).finally(() => setBusy(false)); }}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
      {notice && <p role="status" className="bk-journey-notice"><CheckCircle2 size={17} aria-hidden="true"/>{notice}</p>}
      {data && view === 'daily' && <>
        <div className="bk-journey-intro"><div><span>YOUR DAILY MISSIONS · UTC {data.todayDate}</span><h3>MAKE TODAY COUNT.</h3></div><div className="bk-journey-completed"><Flame aria-hidden="true"/><strong>{completed} / 3</strong><small>verified</small></div></div>
        <div className="bk-journey-missions">
          {missions.map(m => { const count = data.today[m.id]; const Icon=m.icon; return <article key={m.id} className="bk-journey-mission" data-mission={m.id}>
            <div className="bk-journey-mission-icon"><Icon aria-hidden="true"/></div>
            <div className="bk-journey-mission-copy"><h4>{m.title}</h4><p>{m.caption}</p><small><ShieldCheck size={13} aria-hidden="true"/> {m.xp} · {count > 0 ? 'Completed' : 'Not yet recorded'}</small></div>
            <button type="button" onClick={() => quest(m.category)} aria-label={count > 0 ? 'Replay ' + m.title : m.label}>{count > 0 ? <Check aria-hidden="true"/> : <ArrowRight aria-hidden="true"/>}<span>{count > 0 ? 'Done' : 'Play'}</span></button>
          </article>; })}
        </div>
        <div className="bk-journey-next"><div><b>REWARDS COME FROM VERIFIED XP</b><span>Milestone coins and gifts unlock as your account XP increases. Claims are recorded once per account.</span></div><button type="button" onClick={() => setView('journey')}>View Journey <ArrowRight size={17} aria-hidden="true"/></button></div>
      </>}

      {data && (view === 'journey' || view === 'daily') && <section className="bk-journey-milestones" aria-label="BK Journey reward path">
        <div className="bk-journey-section-title"><div><span>{view === 'daily' ? 'YOUR NEXT REWARDS' : 'PERMANENT PROGRESSION'}</span><h3>THE REWARD JOURNEY</h3></div><span><ShieldCheck size={15} aria-hidden="true"/> Server-verified XP</span></div>
        <div className="bk-journey-rail">
          {milestones.map(m => { const Icon = m.icon; const claimed=owned.has(m.id); const eligible=xp>=m.xp; return <article key={m.id} className={'bk-journey-checkpoint' + (claimed?' is-claimed':eligible?' is-unlocked':' is-locked')}>
            <div className="bk-journey-checkpoint-medal">{claimed?<Check aria-label="Claimed"/>:eligible?<Icon aria-label="Unlocked"/>:<LockKeyhole aria-label="Locked"/>}</div>
            <strong>{m.title}</strong><small>{number(m.xp)} XP</small>
            <span>{m.coins ? '+' + number(m.coins) + ' BK Coins' : m.gift}</span>
            <button type="button" disabled={!eligible || claimed || claiming !== null} onClick={() => { void claim(m.id); }}>{claiming === m.id ? 'Claiming…' : claimed ? 'Claimed' : eligible ? 'Claim reward' : 'Locked'}</button>
          </article>; })}
        </div>
        <p className="bk-journey-legal">No purchase required. These rewards use verified account XP, not unverified local game scores. BK Coins have no cash value and cannot be redeemed for money.</p>
      </section>}

      {data && view === 'rewards' && <section className="bk-journey-collection" aria-label="My claimed gifts">
        <div className="bk-journey-section-title"><div><span>OWNED REWARDS</span><h3>THE BK COLLECTION</h3></div><div className="bk-journey-owned-count">{data.claims.length} / {milestones.length} milestones</div></div>
        <div className="bk-journey-coin-total"><Coins aria-hidden="true"/><div><strong>{number(data.coins)} BK Coins</strong><p>Earned through verified milestone claims. Store spending is not enabled yet.</p></div></div>
        <div className="bk-journey-gifts">
          {milestones.filter(m => m.gift).map(m => {const isOwned=owned.has(m.id);return <div key={m.id} className={'bk-journey-gift'+(isOwned?' is-owned':'')}><Gift aria-hidden="true"/><strong>{m.gift}</strong><span>{isOwned ? 'OWNED IN BK JOURNEY' : 'LOCKED · '+number(m.xp)+' XP'}</span></div>;})}
        </div>
        <p className="bk-journey-legal">Gift receipts are saved to your account. Equipping these new badges and nameplates from My Locker will be enabled when the cosmetic inventory integration is complete.</p>
        <button type="button" className="bk-journey-secondary" onClick={() => setView('journey')}>See all journey milestones <ArrowRight size={16} aria-hidden="true"/></button>
      </section>}
      <footer className="bk-journey-footer"><button type="button" onClick={onClose}><ArrowLeft aria-hidden="true"/> Back to Home</button><span><ShieldCheck aria-hidden="true"/> Verified progress only</span></footer>
    </div>
  </div>;
}
