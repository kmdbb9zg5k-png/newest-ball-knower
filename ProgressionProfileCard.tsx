import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBallKnower } from './BallKnowerContext';
import { fetchProgressionProfile, fetchPublicProgressionProfile, type Achievement, type ProgressEvent, type ProgressProfile } from './progressionCloud';
import { gradeVerifiedPredictionPicks, loadVerifiedPredictionPicks, type VerifiedPredictionPick } from './modeProgressionCloud';
import { readAthletePassport } from './athletePassport';
import { supabase } from './supabase';
import { ProfileAthleteShowcase } from './ProfileAthleteShowcase';
import { ProfileLockerView } from './ProfileLockerView';

type Props = { targetUserId?: string; targetDisplayName?: string; identity?: React.ReactNode };

export const ProgressionProfileCard: React.FC<Props> = ({ targetUserId, targetDisplayName, identity }) => {
  const { currentUser } = useBallKnower();
  // Remount on identity changes: never show another account's receipts while loading.
  if (targetUserId) return <AccountProgression key={targetUserId} displayName={targetDisplayName} targetUserId={targetUserId} identity={identity}/>;
  return <AccountProgression key={currentUser?.id || 'guest'} displayName={currentUser?.name} ownerId={currentUser?.id} canShare={Boolean(currentUser && !currentUser.isAnonymous)} identity={identity}/>;
};

function AccountProgression({ displayName, targetUserId, ownerId, canShare = false, identity }: { displayName?: string; targetUserId?: string; ownerId?: string; canShare?: boolean; identity?: React.ReactNode }) {
  const [coins, setCoins] = useState<number>();
  useEffect(() => {
    if (targetUserId || !ownerId || !supabase) return;
    let current = true;
    void (async () => {
      const { data, error } = await supabase.rpc('bk_journey_state');
      if (current && !error && Number.isSafeInteger(data?.coins) && data.coins >= 0) setCoins(data.coins);
    })();
    return () => { current = false; };
  }, [ownerId, targetUserId]);
  const [profile, setProfile] = useState<ProgressProfile | null>(null);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [predictionPicks, setPredictionPicks] = useState<VerifiedPredictionPick[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const isPublicView = Boolean(targetUserId);
      const [data, picks] = isPublicView
        ? await fetchPublicProgressionProfile(targetUserId!)
          .then(result => [result, result.predictionPicks] as const)
        : await Promise.all([
          fetchProgressionProfile(displayName),
          gradeVerifiedPredictionPicks().catch(() => loadVerifiedPredictionPicks()).catch(() => [] as VerifiedPredictionPick[]),
        ]);
      if (version !== requestVersion.current) return;
      setProfile(data.profile);
      setEvents(data.events);
      setAchievements(data.achievements);
      setPredictionPicks(picks);
      setError('');
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setError(cause instanceof Error ? cause.message : 'Could not load Ball Knower profile.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [displayName, targetUserId]);
  useEffect(() => {
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  return <ProfileLockerView showcaseStats={targetUserId ? undefined : { overall: readAthletePassport()?.overall, coins }} showcase={<ProfileAthleteShowcase userId={targetUserId || ownerId} visitor={Boolean(targetUserId)} canShare={canShare} displayName={displayName} publicProfileReady={Boolean(profile && !error)}/>} identity={identity} profile={profile} events={events} achievements={achievements} predictionPicks={predictionPicks} profileOwnerName={targetUserId ? displayName : undefined} error={error} loading={loading} onRefresh={() => void refresh()}/>;
}
