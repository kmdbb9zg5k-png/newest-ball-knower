import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ATHLETE_CHANGED, ATHLETE_SAVE_KEY, readAthletePassport } from './athletePassport';
import { refreshLocker } from './lockerCommerceClient';
import { CLOTHING, CLOTHING_SLOTS } from './playerWardrobe';
import { usePlayerOutfit } from './usePlayerOutfit';
import { sanitizeShowcaseFit, type ShowcaseFit } from './profileAthleteShowcase';
import { supabase } from './supabase';
import './profileAthleteShowcase.css';

const AthleteLivePreview = lazy(() => import('./AthleteLivePreview'));
const poster = '/profile/cinematic/player-hero.webp';

export function ProfileAthleteShowcase({ userId, visitor, canShare, displayName, publicProfileReady }: {
  userId?: string; visitor: boolean; canShare: boolean; displayName?: string; publicProfileReady: boolean;
}) {
  const [athlete, setAthlete] = useState(() => visitor ? null : readAthletePassport());
  const outfit = usePlayerOutfit();
  const [shared, setShared] = useState<ShowcaseFit | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visitor) return;
    const update = () => setAthlete(readAthletePassport());
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === ATHLETE_SAVE_KEY) update(); };
    window.addEventListener(ATHLETE_CHANGED, update);
    window.addEventListener('storage', onStorage);
    if (canShare) void refreshLocker();
    return () => {
      window.removeEventListener(ATHLETE_CHANGED, update);
      window.removeEventListener('storage', onStorage);
    };
  }, [visitor, canShare]);

  useEffect(() => {
    if (!supabase || !userId || (visitor ? !publicProfileReady : !canShare)) return;
    let current = true;
    void (async () => {
      const { data, error } = await supabase.from('ball_knower_profile_showcases').select('fit').eq('user_id', userId).maybeSingle();
      if (!current) return;
      if (error) {
        if (!visitor) setMessage('Outfit sharing is unavailable right now.');
        return;
      }
      setShared(sanitizeShowcaseFit(data?.fit));
      setLoaded(true);
    })();
    return () => { current = false; };
  }, [userId, visitor, canShare, publicProfileReady]);

  const personalFit = athlete ? sanitizeShowcaseFit({ ...athlete.build, ...athlete.appearance, number: athlete.number, wardrobe: outfit }) : null;
  const fit = visitor ? shared : personalFit;
  const previewOutfit = fit ? { ...fit.wardrobe } : undefined;
  if (!visitor && previewOutfit) {
    for (const slot of CLOTHING_SLOTS) {
      if (CLOTHING.some(item => item.slot === slot && item.id === outfit[slot] && item.retailPreview)) {
        previewOutfit[slot] = outfit[slot];
      }
    }
  }
  const changed = JSON.stringify(personalFit) !== JSON.stringify(shared);

  async function share(next: ShowcaseFit | null) {
    if (!supabase || !userId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.id !== userId || session.user.is_anonymous) throw new Error('Sign in again to share your fit.');
      const { error } = next
        ? await supabase.from('ball_knower_profile_showcases').upsert({ user_id: userId, fit: next })
        : await supabase.from('ball_knower_profile_showcases').delete().eq('user_id', userId);
      if (error) throw new Error('Could not update your shared fit. Try again.');
      setShared(next);
      setMessage(next ? 'Your fit is visible to signed-in profile visitors.' : 'Your fit is now private.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update your shared fit.');
    } finally { setBusy(false); }
  }

  if (!fit && (visitor || !shared)) return null;
  return <section className="bk-profile-athlete" aria-label="Player showcase">
    {fit && <Suspense fallback={<img className="bk-profile-athlete-poster" src={poster} alt="" />}>
      <AthleteLivePreview profile={{ ...fit, name: visitor ? displayName || 'Featured athlete' : athlete?.name || 'Your athlete',
        combineId: visitor ? userId : athlete?.id }} previewOutfit={previewOutfit} profileShowcase
        fallbackImage={visitor ? poster : athlete?.portrait || poster}/>
    </Suspense>}
    {!visitor && canShare && <div className="bk-profile-athlete-sharing">
      {loaded && personalFit && (!shared || changed) && <button type="button" disabled={busy} onClick={() => void share(personalFit)}>{shared ? 'Update shared fit' : 'Show equipped fit'}</button>}
      {loaded && shared && <button type="button" disabled={busy} onClick={() => void share(null)}>Hide shared fit</button>}
      {loaded && !shared && <small>Share your current outfit and created athlete on your profile.</small>}
      {message && <small role="status">{message}</small>}
    </div>}
  </section>;
}
