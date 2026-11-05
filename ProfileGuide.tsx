import React, { useEffect, useId, useState } from 'react';
import { BookOpen, ChevronRight, X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';
import './profileGuide.css';

const STORAGE_KEY = 'bk-guide-profile-v1';
export const PROFILE_GUIDE_SECTIONS = [
  { id: 'identity', title: 'Your identity & account', body: 'Your GM name and photo represent you in leagues, drafts, matchups and community. Use Edit Name & Photo to change them. Guests can play and join leagues. To recover your account on another device, choose Save With Email and finish confirmation by opening the emailed link. Sending the email alone does not complete sign-in.' },
  { id: 'rating', title: 'BK Rating & your six skills', body: 'BK Rating starts at 0 and ranges from 0 to 99. It combines your six verified category ratings: Football IQ, GM, Predictions, Trivia, Agent and Owner. Tap any skill card for its explanation. Verified outcomes can raise or lower a rating; more XP does not always mean a higher rating.' },
  { id: 'level', title: 'XP & profile level', body: 'Your universal Profile begins at Level 1 and advances every 1,000 verified XP. The progress bar shows the XP needed for the next level. Only supported, verified events award Profile XP. Offline or local results do not automatically count. The Gauntlet mode level and cosmetic Pass level are separate progress systems.' },
  { id: 'trophies', title: 'Trophy case & championships', body: 'Locked trophies show what you can work toward. Tap a trophy to read its requirement, listed XP reward and unlock date when earned. Requirements differ by trophy. The championship count reflects verified league championship events; winning a title in another mode does not automatically increase it.' },
  { id: 'picks', title: 'Your pick record', body: 'When saved NFL picks are available, the Pick Record card opens your prediction history. Correct and Missed mean the game has been graded. Push means a tie against the locked line. Pending means the result has not been settled. A pending pick is not a verified win. Open Picks to choose teams and submit new selections before kickoff.' },
  { id: 'activity', title: 'Verified activity & receipts', body: 'This is your recent progression activity, not a complete lifetime ledger. Each receipt shows the event, date, XP awarded and any category rating change (RTG). A plus adds points; a minus removes them. Open Show all recent receipts to see more of the available events. No receipts yet means no activity is currently shown; it does not establish that a local game result earned an award.' },
  { id: 'head-to-head', title: 'Head-to-head trivia', body: 'H2H Trivia tracks wins, losses, ties, your best win streak and a separate competitive rating starting at 1,000. This rating is different from the 0–99 BK Rating. Football H2H has its own match history and standings in Community.' },
  { id: 'collection', title: 'Locker & collection extras', body: 'Open Locker & collection to see owned items and equipped cosmetics. Items with an Equip button can be used in their supported slot. Collection lists owned collectibles. Pass Level and Pass XP belong to the cosmetic pass, not your universal Profile level. Changing your appearance does not change your verified ratings.' },
  { id: 'sync', title: 'Refreshing & viewing other profiles', body: 'Use Refresh profile if recent activity has not appeared. During a sync error, your last synced values may stay visible; use Retry rather than assuming progress was erased. When viewing another manager, the profile is read-only and shows the verified details available to you. Their editing, account ID and equip controls stay private.' },
] as const;

export function ProfileGuide() {
  const id = useId();
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(STORAGE_KEY) !== 'seen'; } catch { return true; }
  });
  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, 'seen'); } catch { /* Help remains available without storage. */ }
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return <>
    <button type="button" className="bk-profile-help" aria-haspopup="dialog" onClick={() => setOpen(true)}><BookOpen aria-hidden="true"/><span>How it works</span></button>
    {open && <ModalPortal><div className="bk-profile-guide-backdrop">
      <section className="bk-profile-guide" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <header className="bk-profile-guide-header"><div><p>THE PROFILE PLAYBOOK</p><h2 id={`${id}-title`}>Make every game count.</h2></div><button type="button" aria-label="Close Profile guide" onClick={close}><X aria-hidden="true"/></button></header>
        <div className="bk-profile-guide-scroll">
          <p className="bk-profile-guide-intro">Your identity, your progress, your football résumé. Here’s what everything on your Profile means.</p>
          <nav aria-label="Profile guide topics">{PROFILE_GUIDE_SECTIONS.map((section, index) => <button type="button" key={section.id} onClick={() => { const topic = document.getElementById(`${id}-${section.id}`); topic?.scrollIntoView({ block: 'start', behavior: 'auto' }); topic?.focus({ preventScroll: true }); }}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}<ChevronRight aria-hidden="true"/></button>)}</nav>
          {PROFILE_GUIDE_SECTIONS.map((section, index) => <section key={section.id} id={`${id}-${section.id}`} className="bk-profile-guide-topic" tabIndex={-1}><p>CHAPTER {String(index + 1).padStart(2, '0')}</p><h3>{section.title}</h3><p>{section.body}</p></section>)}
          <button type="button" className="bk-profile-guide-done" onClick={close}>Got it — view Profile</button>
        </div>
      </section>
    </div></ModalPortal>}
  </>;
}
