import React, { createContext, useContext, useEffect, useId, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import { supabase } from './supabase';
import './first1000Badge.css';

const BADGE_ART = '/profile/badges/first-1000.webp';
const BADGE_DESCRIPTION = 'One of the first 1,000 players to join Ball Knower.';

type BadgeState = 'unavailable' | 'pending' | 'claimed';
type BadgeContext = { status: BadgeState; openClaim: () => void };

const OwnBadge = createContext<BadgeContext | null>(null);

async function fetchBadge(userId: string): Promise<BadgeState> {
  if (!supabase) return 'unavailable';
  const { data, error } = await supabase.from('ball_knower_first_1000_badges')
    .select('claimed_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? (data.claimed_at ? 'claimed' : 'pending') : 'unavailable';
}

export function First1000BadgeProvider({ userId: profileUserId, canPrompt, children }: {
  userId?: string;
  canPrompt: boolean;
  children: React.ReactNode;
}) {
  const [sessionUserId, setSessionUserId] = useState<string>();
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session && !session.user.is_anonymous ? session.user.id : undefined);
    });
    return () => subscription.unsubscribe();
  }, []);

  const userId = sessionUserId === profileUserId ? sessionUserId : undefined;
  const [badge, setBadge] = useState<{ userId: string; status: BadgeState }>();
  const [deferredFor, setDeferredFor] = useState<string>();
  const status = userId && badge?.userId === userId ? badge.status : 'unavailable';

  useEffect(() => {
    setDeferredFor(undefined);
    setBadge(undefined);
    if (!userId) return;
    let active = true;
    const refresh = () => {
      void fetchBadge(userId).then(status => {
        if (!active) return;
        setBadge(previous => previous?.userId === userId && previous.status === 'claimed'
          ? previous : { userId, status });
      }).catch(() => { /* Retry on focus after a temporary network error. */ });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
    };
  }, [userId]);

  return <OwnBadge.Provider value={{ status, openClaim: () => setDeferredFor(undefined) }}>
    {children}
    {userId && canPrompt && status === 'pending' && deferredFor !== userId && <ClaimBadgeDialog
      key={userId}
      userId={userId}
      onLater={() => setDeferredFor(userId)}
      onClaimed={() => setBadge(previous => previous?.userId === userId ? { userId, status: 'claimed' } : previous)}
    />}
  </OwnBadge.Provider>;
}

function ClaimBadgeDialog({ userId, onLater, onClaimed }: {
  userId: string;
  onLater: () => void;
  onClaimed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const accept = async () => {
    if (busy || !supabase) return;
    setBusy(true);
    setError(false);
    try {
      const { data, error } = await supabase.rpc('bk_claim_first_1000_badge', { p_user_id: userId });
      if (error || data !== true) throw error || new Error('Badge could not be claimed.');
      onClaimed();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return <BadgeDialog title="You’re in the First 1,000" onClose={busy ? undefined : onLater}>
    <p>You’re one of the first 1,000 players to join Ball Knower. Accept your badge to display it on your profile.</p>
    {error && <p className="bk-first1000-error" role="alert">Couldn’t accept your badge. Try again.</p>}
    <button className="bk-first1000-accept" type="button" disabled={busy} onClick={() => void accept()}>{busy ? 'Accepting…' : 'Accept Badge'}</button>
    <button className="bk-first1000-later" type="button" disabled={busy} onClick={onLater}>Later</button>
  </BadgeDialog>;
}

function BadgeDialog({ title, onClose, children }: {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return <ModalPortal>
    <div className="bk-first1000-overlay">
      <section className="bk-first1000-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
        onKeyDown={event => { if (event.key === 'Escape') onClose?.(); }}>
        <img src={BADGE_ART} alt="" width="180" height="180"/>
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>
  </ModalPortal>;
}

function ClaimedBadge() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="bk-first1000-chip" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <img src={BADGE_ART} alt="" width="34" height="34"/> First 1,000
    </button>
    {open && <BadgeDialog title="First 1,000" onClose={() => setOpen(false)}>
      <p>{BADGE_DESCRIPTION}</p>
      <button className="bk-first1000-accept" type="button" onClick={() => setOpen(false)}>Close</button>
    </BadgeDialog>}
  </>;
}

export function OwnFirst1000Badge() {
  const badge = useContext(OwnBadge);
  if (badge?.status === 'claimed') return <ClaimedBadge/>;
  if (badge?.status !== 'pending') return null;
  return <button type="button" className="bk-first1000-chip" aria-haspopup="dialog" onClick={badge.openClaim}>
    Claim First 1,000 Badge
  </button>;
}

export function MemberFirst1000Badge({ userId }: { userId?: string }) {
  const [claimedBy, setClaimedBy] = useState<string>();
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void fetchBadge(userId).then(status => {
      if (active) setClaimedBy(status === 'claimed' ? userId : undefined);
    }).catch(() => { if (active) setClaimedBy(undefined); });
    return () => { active = false; };
  }, [userId]);

  return userId && claimedBy === userId ? <ClaimedBadge key={userId}/> : null;
}
