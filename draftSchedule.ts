import { League } from './types';

export type DraftStartChoice = 'scheduled' | 'now';
export interface DraftSchedule {
  draftScheduledAt: string | null;
  draftTimezone: string;
}

/** Null is the existing server-supported, ready-to-draft flow, with no future date gate. */
export function buildDraftCreationSchedule(choice: DraftStartChoice, day: string, time: string, now = Date.now()): DraftSchedule {
  const draftTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  if (choice === 'now') return { draftScheduledAt: null, draftTimezone };
  const scheduled = new Date(`${day}T${time}`);
  const localDay = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, '0')}-${String(scheduled.getDate()).padStart(2, '0')}`;
  const localTime = `${String(scheduled.getHours()).padStart(2, '0')}:${String(scheduled.getMinutes()).padStart(2, '0')}`;
  // Reject invalid dates and local times that roll forward across a daylight-saving gap.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time) ||
      !Number.isFinite(scheduled.getTime()) || localDay !== day || localTime !== time || scheduled.getTime() <= now) {
    throw new Error('Choose a valid draft date and time in the future');
  }
  return { draftScheduledAt: scheduled.toISOString(), draftTimezone };
}

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

