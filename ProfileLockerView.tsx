import React, { useId, useRef, useState } from 'react';
import { Brain, BriefcaseBusiness, Check, ClipboardList, ChevronLeft, ChevronRight, Crown, RefreshCcw, ShieldCheck, Swords, Target, Trophy } from 'lucide-react';
import type { Achievement, ProgressEvent, ProgressProfile } from './progressionCloud';
import type { VerifiedPredictionPick } from './modeProgressionCloud';
import { LockerTrophyBadge, LockerReceiptScene, LockerRatingNumeral } from './ProfileLockerArt';
import { profileDate, profileNumber, profileXpProgress, signedProfileDelta } from './profileLockerState';
import './profileLocker.css';

const CATEGORIES = [
  { key: 'footballIq', label: 'Football IQ', Icon: Brain, description: 'Your server-recorded Football IQ rating. Only verified progression changes this score.' },
  { key: 'gmRating', label: 'GM', Icon: Swords, description: 'Your server-recorded general manager rating, backed by verified league and roster events.' },
  { key: 'predictionRating', label: 'Predictions', Icon: Trophy, description: 'Your prediction rating reflects verified, graded picks. Unfinished games do not create receipts.' },
  { key: 'triviaRating', label: 'Trivia', Icon: Target, description: 'Your trivia rating reflects verified trivia outcomes, not a locally edited score.' },
  { key: 'agentRating', label: 'Agent', Icon: BriefcaseBusiness, description: 'Your server-recorded Agent rating. Verified career events appear in your receipts below.' },
  { key: 'ownerRating', label: 'Owner', Icon: Crown, description: 'Your server-recorded Owner rating. Verified career milestones contribute to this score.' },
] as const;

type Props = { profile: ProgressProfile | null; events: ProgressEvent[]; achievements: Achievement[]; predictionPicks: VerifiedPredictionPick[]; loading: boolean; error: string; onRefresh: () => void };

export function ProfileLockerView({ profile, events, achievements, predictionPicks, loading, error, onRefresh }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [selectedTrophy, setSelectedTrophy] = useState<string | null>(null);
  const [predictionHistoryOpen, setPredictionHistoryOpen] = useState(false);
  const [showAllReceipts, setShowAllReceipts] = useState(false);
  const trophyRail = useRef<HTMLUListElement>(null);
  const id = useId();
  const unlocked = achievements.filter(item => Boolean(item.unlockedAt)).length;
  const progress = profile ? profileXpProgress(profile.xp, profile.level) : null;
  const selectedCategory = CATEGORIES.find(item => item.key === category);
  const trophy = achievements.find(item => item.key === selectedTrophy);
  const correctPicks = predictionPicks.filter(item => item.result === 'win').length;
  const missedPicks = predictionPicks.filter(item => item.result === 'loss').length;
  const pushes = predictionPicks.filter(item => item.result === 'push').length;
  const pendingPicks = predictionPicks.filter(item => !item.result).length;
  const predictionHistory = [...predictionPicks].sort((a, b) => Date.parse(b.lockedAt || '') - Date.parse(a.lockedAt || ''));
  const scrollTrophies = (direction: number) => {
    const rail = trophyRail.current;
    if (!rail) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.scrollBy({ left: direction * Math.max(140, rail.clientWidth * .7), behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  const status = loading ? 'Syncing your profile…' : error ? (profile ? 'Showing your last synced profile.' : 'Profile data is unavailable.') : 'Server verified';

  return <div className="bk-locker-profile" data-testid="locker-profile" aria-busy={loading}>
    <section className="bk-locker-overview" aria-label="Universal Ball Knower Profile">
      <div className="bk-locker-progress-heading"><h2>Universal Ball Knower Profile</h2><div className="bk-locker-championships"><Trophy aria-hidden="true"/><span>Championships <strong>{profileNumber(profile?.championships)}</strong></span></div></div>
      {progress ? <div className="bk-locker-xp" role="progressbar" aria-label="Progress to next profile level" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={progress.earned} aria-valuetext={`${profile!.xp} total XP. ${progress.earned} of ${progress.required} XP toward level ${progress.nextLevel}.`}><span style={{ width: `${progress.percent}%` }}/></div> : <div className="bk-locker-xp bk-locker-xp-unavailable" aria-hidden="true"/>}
      <div className="bk-locker-levels"><strong>Level {profileNumber(profile?.level)}</strong><span>{profileNumber(profile?.xp)} XP</span><span>{progress ? `Level ${progress.nextLevel} at ${profileNumber(progress.nextTotal)} XP` : 'Verified XP progression'}</span></div>
      <div className="bk-locker-xp-scale" aria-hidden="true">{[0,20,40,60,80,100].map(value => <span key={value}>{value}%</span>)}</div>
      <div className="bk-locker-ratings-layout">
        <div className="bk-locker-hex-grid" aria-label="Profile ratings">{CATEGORIES.map(({ key, label, Icon }) => <button type="button" key={key} className="bk-locker-hex" aria-label={`${label} rating: ${profileNumber(profile?.[key])}. Show details`} aria-expanded={category === key} aria-controls={`${id}-category`} onClick={() => setCategory(category === key ? null : key)}>
          <svg className="bk-locker-hex-frame" viewBox="0 0 100 116" preserveAspectRatio="none" aria-hidden="true"><path d="M50 3 96 29V86L50 112 4 86V29Z"/><path d="M50 10 89 33V81L50 104 11 81V33Z"/></svg>
          <Icon className="bk-locker-hex-icon" aria-hidden="true"/><span>{label}</span><strong>{profileNumber(profile?.[key])}<small>/99</small></strong>
        </button>)}</div>
        <div className="bk-locker-rating-stack"><div className="bk-locker-rating" aria-label={`BK Rating ${profileNumber(profile?.bkRating)}`}><span>BK Rating:</span><strong data-testid="bk-rating"><LockerRatingNumeral value={profileNumber(profile?.bkRating)}/></strong><small>Server controlled</small></div><p className="bk-locker-motto">“Same game.<br/>Higher standards.”</p></div>
      </div>
      {selectedCategory && <div id={`${id}-category`} className="bk-locker-detail"><strong>{selectedCategory.label} · {profileNumber(profile?.[selectedCategory.key])}/99</strong><p>{selectedCategory.description}</p></div>}
      <div className="bk-locker-sync"><span role="status">{status}{!loading && !error && profileDate(profile?.updatedAt) ? ` · ${profileDate(profile?.updatedAt)}` : ''}</span><button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh profile"><RefreshCcw aria-hidden="true"/></button></div>
      {error && <div className="bk-locker-error" role="alert"><span>{error}</span><button type="button" disabled={loading} onClick={onRefresh}>Retry</button></div>}
    </section>

    <section className="bk-locker-trophies" aria-labelledby={`${id}-trophies`}>
      <div className="bk-locker-section-heading"><h2 id={`${id}-trophies`}><Trophy aria-hidden="true"/>Trophy case</h2><span>{correctPicks} correct picks · {profile ? `${unlocked}/${achievements.length} trophies unlocked` : 'Awaiting sync'}</span>{achievements.length > 5 && <div className="bk-locker-trophy-arrows"><button type="button" aria-label="Previous trophies" onClick={() => scrollTrophies(-1)}><ChevronLeft aria-hidden="true"/></button><button type="button" aria-label="Next trophies" onClick={() => scrollTrophies(1)}><ChevronRight aria-hidden="true"/></button></div>}</div>
      <div className="bk-locker-trophy-case">
        <ul ref={trophyRail} className="bk-locker-trophy-rail" aria-label="Trophies">
          <li><button type="button" className="bk-locker-trophy" data-unlocked="true" aria-label={`Prediction record: ${correctPicks} correct picks. Show pick history`} aria-expanded={predictionHistoryOpen} aria-controls={`${id}-prediction-history`} onClick={() => { setPredictionHistoryOpen(value => !value); setSelectedTrophy(null); }}><LockerTrophyBadge tier="gold" unlocked/><strong>Pick Record</strong><span className="bk-locker-trophy-description">{correctPicks} correct NFL {correctPicks === 1 ? 'pick' : 'picks'} all time</span><small><Check aria-hidden="true"/>{predictionPicks.length ? 'Verified history' : 'Ready for picks'}</small></button></li>
          {achievements.map(item => <li key={item.key}><button type="button" className="bk-locker-trophy" data-unlocked={Boolean(item.unlockedAt)} aria-label={`${item.title}: ${item.unlockedAt ? 'Unlocked' : 'Locked'}. ${item.description}`} aria-expanded={selectedTrophy === item.key} aria-controls={`${id}-trophy-detail`} onClick={() => { setPredictionHistoryOpen(false); setSelectedTrophy(selectedTrophy === item.key ? null : item.key); }}><LockerTrophyBadge tier={item.tier} unlocked={Boolean(item.unlockedAt)}/><strong>{item.title}</strong><span className="bk-locker-trophy-description">{item.description}</span><small>{item.unlockedAt ? <><Check aria-hidden="true"/>Unlocked</> : 'Locked'}</small></button></li>)}
        </ul>
        {predictionHistoryOpen && <div className="bk-locker-detail" id={`${id}-prediction-history`}>
          <strong>Pick Record · {correctPicks} correct</strong>
          <p>{correctPicks}-{missedPicks}{pushes ? `-${pushes} pushes` : ''}{pendingPicks ? ` · ${pendingPicks} pending` : ''}. Every entry below is a server-saved NFL prediction.</p>
          {predictionHistory.length ? <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1" aria-label="Prediction history">{predictionHistory.map(pick => {
            const resultLabel = pick.result === 'win' ? 'Correct' : pick.result === 'loss' ? 'Missed' : pick.result === 'push' ? 'Push' : 'Pending';
            const resultClass = pick.result === 'win' ? 'text-emerald-300' : pick.result === 'loss' ? 'text-red-300' : pick.result === 'push' ? 'text-amber-200' : 'text-zinc-400';
            const matchup = pick.awayTeam && pick.homeTeam ? `${pick.awayTeam} @ ${pick.homeTeam}` : pick.label;
            return <li key={pick.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-xs font-black uppercase text-white">{matchup}</div><div className="mt-1 text-[10px] font-bold text-zinc-400">Picked {pick.label}</div></div><span className={`shrink-0 text-[10px] font-black uppercase ${resultClass}`}>{resultLabel}</span></div>
              <div className="mt-2 text-[9px] font-bold uppercase tracking-wide text-zinc-600">{pick.kickoffAt ? profileDate(pick.kickoffAt) : profileDate(pick.lockedAt)}{pick.gradedAt ? ` · graded ${profileDate(pick.gradedAt)}` : ''}</div>
            </li>;
          })}</ul> : <p className="mt-3 rounded-xl border border-white/10 bg-black/25 p-4 text-zinc-400">No submitted picks yet. Open Predictions in The Gauntlet and make your first call.</p>}
        </div>}
        {trophy && <div className="bk-locker-detail" id={`${id}-trophy-detail`}><strong>{trophy.title}</strong><p>{trophy.description}</p><span>{trophy.unlockedAt ? `Unlocked ${profileDate(trophy.unlockedAt)}` : 'Not yet unlocked'} · {profileNumber(trophy.xpReward)} XP reward</span></div>}
      </div>
    </section>

    <section className="bk-locker-receipts" aria-labelledby={`${id}-receipts`}>
      <LockerReceiptScene/>
      <div className="bk-locker-section-heading"><h2 id={`${id}-receipts`}><ClipboardList aria-hidden="true"/>Verified receipts</h2><span className="bk-locker-receipt-tagline">Trust builds legacies</span></div>
      <div className="bk-locker-receipt-rail" aria-hidden="true" data-empty={events.length === 0}>{Array.from({length:17},(_,index)=><i key={index}/>)}</div>
      {events.length > 0 ? <><ul className="bk-locker-event-list">{events.slice(0, showAllReceipts ? events.length : 6).map(event => <li key={event.id}><ShieldCheck aria-hidden="true"/><div><strong>{event.eventType.replaceAll('_', ' ')}</strong><span>{event.category.replaceAll('_', ' ')}{profileDate(event.occurredAt) ? ` · ${profileDate(event.occurredAt)}` : ''}</span></div><p>{signedProfileDelta(event.xpAwarded)} XP{event.ratingDelta !== 0 && <small>{signedProfileDelta(event.ratingDelta)} RTG</small>}</p></li>)}</ul>{events.length > 6 && <button type="button" className="bk-locker-receipts-more" aria-expanded={showAllReceipts} onClick={() => setShowAllReceipts(!showAllReceipts)}>{showAllReceipts ? 'Show fewer receipts' : `Show all ${events.length} recent receipts`}</button>}</> : <div className="bk-locker-receipts-empty"><BriefcaseBusiness aria-hidden="true"/><p>{loading ? 'Loading verified progression receipts…' : error ? 'Verified receipts are temporarily unavailable. Retry profile sync above.' : 'No verified progression receipts yet. Your trusted Trivia, League, Agent, Owner and Prediction events will appear here.'}</p><small>Only server-verified events count toward your profile.</small></div>}
    </section>
  </div>;
}