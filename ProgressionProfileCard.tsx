import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBallKnower } from './BallKnowerContext';
import { fetchProgressionProfile, type Achievement, type ProgressEvent, type ProgressProfile } from './progressionCloud';
import { ProfileLockerView } from './ProfileLockerView';

export const ProgressionProfileCard: React.FC = () => {
  const { currentUser } = useBallKnower();
  // Remount on identity changes: never show another account's receipts while loading.
  return <AccountProgression key={currentUser?.id || 'guest'} displayName={currentUser?.name}/>;
};

function AccountProgression({ displayName }: { displayName?: string }) {
  const [profile, setProfile] = useState<ProgressProfile | null>(null);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const data = await fetchProgressionProfile(displayName);
      if (version !== requestVersion.current) return;
      setProfile(data.profile);
      setEvents(data.events);
      setAchievements(data.achievements);
      setError('');
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setError(cause instanceof Error ? cause.message : 'Could not load Ball Knower profile.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [displayName]);
  useEffect(() => {
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  return <ProfileLockerView profile={profile} events={events} achievements={achievements} error={error} loading={loading} onRefresh={() => void refresh()}/>;
}
