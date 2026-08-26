import { League } from './types';

export const getDraftScheduledTime = (league: Pick<League, 'settings'>): number | null => {
  const value = league.settings?.draftScheduledAt;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export const canStartScheduledDraft = (league: Pick<League, 'settings'>, now = Date.now()): boolean => {
  const scheduledTime = getDraftScheduledTime(league);
  return scheduledTime === null || now >= scheduledTime;
};

export const formatDraftSchedule = (league: Pick<League, 'settings'>): string | null => {
  const scheduledTime = getDraftScheduledTime(league);
  if (scheduledTime === null) return null;
  const timezone = league.settings?.draftTimezone;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || undefined,
      timeZoneName: 'short',
    }).format(new Date(scheduledTime));
  } catch {
    return new Date(scheduledTime).toLocaleString();
  }
};

