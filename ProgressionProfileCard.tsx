import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBallKnower } from './BallKnowerContext';
import { fetchProgressionProfile, fetchPublicProgressionProfile, type Achievement, type ProgressEvent, type ProgressProfile } from './progressionCloud';
import { gradeVerifiedPredictionPicks, loadVerifiedPredictionPicks, type VerifiedPredictionPick } from './modeProgressionCloud';
import { ProfileLockerView } from './ProfileLockerView';

type Props = { targetUserId?: string; targetDisplayName?: string };

export const ProgressionProfileCard: React.FC<Props> = ({ targetUserId, targetDisplayName }) => {
  const { currentUser } = useBallKnower();
  // Remount on identity changes: never show another account's receipts while loading.
  return <AccountProgression key={targetUserId || currentUser?.id || 'guest'} displayName={targetDisplayName || currentUser?.name} targetUserId={targetUserId}/>;
};

function AccountProgression({ displayName, targetUserId }: { displayName?: string; targetUserId?: string }) {
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

  return <ProfileLockerView profile={profile} events={events} achievements={achievements} predictionPicks={predictionPicks} profileOwnerName={targetUserId ? displayName : undefined} error={error} loading={loading} onRefresh={() => void refresh()}/>;
}
