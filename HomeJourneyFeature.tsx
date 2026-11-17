import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Coins, Gift, Trophy } from 'lucide-react';
import type { AppTab } from './App';
import './bkJourney.css';

const BKJourney = lazy(() => import('./BKJourney'));

export function HomeJourneyFeature({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  const close = () => { dialog.current?.close(); setOpen(false); };
  return <>
    <button type="button" className="bk-journey-card" aria-label="Open Daily Challenges and BK Journey rewards" onClick={() => setOpen(true)}>
      <img src="/profile/cinematic/player-hero.webp" alt="" loading="lazy" decoding="async"/>
      <span className="bk-journey-card-content">
        <span className="bk-journey-card-kicker"><CalendarDays size={14} aria-hidden="true"/> PLAY · EARN · UNLOCK</span>
        <strong>DAILY <em>CHALLENGES</em></strong>
        <span>Complete football missions. Earn BK Coins and unlock exclusive gifts.</span>
        <span className="bk-journey-card-rewards"><b><Coins size={14} aria-hidden="true"/>BK Coins</b><b><Gift size={14} aria-hidden="true"/>Rewards</b><b><Trophy size={14} aria-hidden="true"/>Journey</b></span>
        <span className="bk-journey-card-cta">View Daily Challenges <ArrowRight size={16} aria-hidden="true"/></span>
      </span>
    </button>
    <dialog className="bk-journey-dialog" ref={dialog} onClose={() => setOpen(false)} onClick={event => { if (event.target === dialog.current) close(); }} aria-label="BK Daily Challenges and Journey">
      {open && <Suspense fallback={<div role="status" style={{padding:30,color:'#f9d07d'}}>Loading BK Journey…</div>}>
        <BKJourney onClose={close} onNavigate={onNavigate}/>
      </Suspense>}
    </dialog>
  </>;
}
