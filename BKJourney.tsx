import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Coins, Crown, Flame, Gift, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, TrendingUp, Trophy, Gamepad2, BrainCircuit, Shirt, X } from 'lucide-react';
import type { AppTab } from './App';
import { ensureOnlineSession, supabase } from './supabase';
import './bkJourney.css';
import './bkJourneyVisual.css';

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
  { id: 'trivia', title: 'NFL TRIVIA', caption: 'Test your football knowledge. Answer 3 questions correctly.', category: 'challenges', label: 'Play Trivia', goal: 3, accent: 'purple', icon: BrainCircuit },
  { id: 'prediction', title: 'MAKE A PREDICTION', caption: 'Make a pick and see how you do when the game is graded.', category: 'sportsbook', label: 'Make Picks', goal: 1, accent: 'green', icon: TrendingUp },
  // Only H2H matches have an authoritative verified finish record today.
  // Other Mini Games can join this mission once server-side results are available.
  { id: 'h2h', title: 'PLAY A MINI GAME', caption: 'Complete an online Head-to-Head mini game.', category: 'football', label: 'Play H2H', goal: 1, accent: 'blue', icon: Gamepad2 },
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
  const completed = data ? missions.filter(m => data.today[m.id] >= m.goal).length : 0;
  const xp = data?.xp || 0;
  const nextMilestone = milestones.find(m => xp < m.xp) || milestones[milestones.length - 1];
  const previousMilestone = [...milestones].reverse().find(m => xp >= m.xp);
  const milestoneFloor = previousMilestone?.xp ?? 0;
  const milestoneTarget = xp >= milestones[milestones.length - 1].xp ? xp : nextMilestone.xp;
  const progressPercent = Math.round(Math.max(0,Math.min(100,100*(xp-milestoneFloor)/Math.max(1,milestoneTarget-milestoneFloor))));
  const nextClaimable = milestones.find(m => xp>=m.xp && !owned.has(m.id));
  const nextPrize = nextClaimable ?? nextMilestone;
  const quest = (tab: AppTab) => { onClose(); onNavigate(tab); };

  return <div className="bk-journey bk-journey-showcase" aria-label="BK Journey rewards" data-bk-journey>
    <header className="bk-journey-header">
      <div className="bk-journey-brand"><Crown aria-hidden="true"/><span>BALL<br/>KNOWER</span></div>
      <div className="bk-journey-level" aria-label={data ? `Level ${data.level}, ${number(xp)} verified XP` : 'Loading level and XP'}>
        <span className="bk-journey-level-badge"><Crown aria-hidden="true"/><b>BK</b></span>
        <div className="bk-journey-level-main"><span>LV {data?.level ?? '—'}</span><div className="bk-journey-level-track"><div className="bk-journey-level-fill" style={{ width: data ? progressPercent+'%' : '0%' }}/></div><small>{data ? number(xp)+' / '+number(milestoneTarget)+' XP' : 'VERIFIED XP'}</small></div>
      </div>
      <div className="bk-journey-wallet" aria-label={data ? number(data.coins) + ' BK Coins' : 'Coin balance loading'}><span className="bk-journey-coin-emblem"><Coins aria-hidden="true"/></span><span>BK COINS<strong>{data ? number(data.coins) : '—'}</strong></span><button type="button" className="bk-journey-wallet-more" aria-label="View BK coin rewards" onClick={() => setView('rewards')}>+</button></div>
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
      <div className="bk-journey-stadium-lights" aria-hidden="true"/>
      <div className="bk-journey-hero-copy">
        <p><Sparkles size={19} aria-hidden="true"/> PLAY · EARN · UNLOCK</p>
        <h2 id="bk-journey-title">{view === 'daily' ? <><span>DAILY</span><em>CHALLENGES</em></> : view === 'journey' ? <><span>BK</span><em>JOURNEY</em></> : <><span>MY</span><em>REWARDS</em></>}</h2>
        <span>{view === 'daily' ? 'Complete challenges to earn verified XP and unlock rewards.' : view === 'journey' ? 'Every verified play puts your next reward closer.' : 'Every claimed reward stays in your BK collection.'}</span>
      </div>
      <div className="bk-journey-hero-prize" aria-label="Next BK Journey reward"><span>{nextClaimable ? 'READY TO CLAIM' : 'NEXT REWARD'}</span><div><Coins aria-hidden="true"/><strong>{data ? nextPrize.coins ? number(nextPrize.coins) : 'GIFT' : '—'}</strong></div><small>{nextPrize.coins ? 'BK COINS' : nextPrize.gift || 'BK JOURNEY'}</small></div>
    </section>

    <div className="bk-journey-body">
      {busy && <p role="status" className="bk-journey-status">Checking your verified XP and rewards…</p>}
      {error && <div className="bk-journey-error" role="alert">{error}<button type="button" onClick={() => { setBusy(true); void refresh().catch(e => setError(e instanceof Error ? e.message : 'Try again.')).finally(() => setBusy(false)); }}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
      {notice && <p role="status" className="bk-journey-notice"><CheckCircle2 size={17} aria-hidden="true"/>{notice}</p>}
      {data && view === 'daily' && <>
        <div className="bk-journey-intro"><div><span>YOUR DAILY MISSIONS · UTC {data.todayDate}</span><h3>MAKE TODAY COUNT.</h3></div><div className="bk-journey-completed"><Flame aria-hidden="true"/><strong>{completed} / 3</strong><small>verified</small></div></div>
        <div className="bk-journey-missions">
          {missions.map(m => { const count=data.today[m.id]; const Icon=m.icon; const done=count>=m.goal; const percent=Math.min(100,100*count/m.goal); return <article key={m.id} className={'bk-journey-mission bk-journey-mission--'+m.accent+(done?' is-completed':'')} data-mission={m.id}>
            <div className="bk-journey-mission-icon"><Icon aria-hidden="true"/></div>
            <div className="bk-journey-mission-copy">
              <h4>{m.title}</h4><p>{m.caption}</p>
              <div className="bk-journey-mission-reward"><span><Sparkles size={15} aria-hidden="true"/> VERIFIED XP</span><i aria-hidden="true"/><span><Coins size={15} aria-hidden="true"/> BK JOURNEY COINS</span></div>
              <div className="bk-journey-progress-row"><div className="bk-journey-mission-track" role="progressbar" aria-label={m.title+' daily completion'} aria-valuenow={Math.min(count,m.goal)} aria-valuemin={0} aria-valuemax={m.goal}><div className="bk-journey-mission-progress" style={{width:percent+'%'}}/></div><b>{Math.min(count,m.goal)} / {m.goal}</b></div>
              <small className="bk-journey-verified"><ShieldCheck size={12} aria-hidden="true"/> {done ? 'VERIFIED COMPLETE' : 'Finish for mission completion. Coins unlock through XP milestones.'}</small>
            </div>
            <button type="button" className="bk-journey-play" onClick={() => quest(m.category)} aria-label={done ? 'Replay ' + m.title : m.label}>{done ? 'DONE' : 'PLAY'}<ArrowRight aria-hidden="true"/></button>
          </article>; })}
        </div>
      </>}

      {data && (view === 'journey' || view === 'daily') && <section className="bk-journey-milestones" aria-label="BK Journey reward path">
        <div className="bk-journey-section-title"><div><span>{view === 'daily' ? 'PLAY · EARN · CLAIM' : 'PERMANENT PROGRESSION'}</span><h3>YOUR REWARD JOURNEY</h3></div><span><ShieldCheck size={15} aria-hidden="true"/> Server-verified XP</span></div>
        <div className="bk-journey-rail-intro"><span>KEEP PLAYING<br/><b>UNLOCK REWARDS</b></span><small>Five permanent XP milestones</small></div>
        <div className="bk-journey-rail">
          {milestones.map(m => { const Icon=m.id===4?Shirt:m.icon; const claimed=owned.has(m.id); const eligible=xp>=m.xp; return <article key={m.id} className={'bk-journey-checkpoint' + (claimed?' is-claimed':eligible?' is-unlocked':' is-locked')}>
            <div className="bk-journey-checkpoint-medal">{claimed?<Check aria-label="Claimed"/>:<Icon aria-label={eligible?'Unlocked':'Locked'}/>}</div>
            <strong>{m.coins ? '+' + number(m.coins) + ' BK COINS' : m.gift}</strong><small>{number(m.xp)} XP · {m.title}</small>
            <button type="button" disabled={!eligible || claimed || claiming !== null} onClick={() => { void claim(m.id); }}>{claiming === m.id ? 'Claiming…' : claimed ? 'Claimed' : eligible ? 'Claim reward' : 'Locked'}</button>
          </article>; })}
        </div>
        <p className="bk-journey-legal">No purchase required. Milestone coins and gifts use verified account XP, not unverified local scores. BK Coins have no cash value and cannot be redeemed for money.</p>
      </section>}

      {data && view === 'daily' && <div className="bk-journey-momentum">
        <span className="bk-journey-momentum-label"><Flame aria-hidden="true"/> DAILY MOMENTUM</span>
        <span className="bk-journey-momentum-fires" aria-label={completed+' of 3 daily missions completed'}>{missions.map((m,i)=><Flame key={m.id} className={data.today[m.id]>=m.goal?'is-lit':''} aria-hidden="true"/>)}</span>
        <div><strong>{completed} / 3 COMPLETED TODAY</strong><small>Come back for fresh challenges. Missing a day won't erase your permanent XP.</small></div>
        <button type="button" aria-label="See BK Journey rewards" onClick={() => setView('journey')}><ArrowRight aria-hidden="true"/></button>
      </div>}
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
