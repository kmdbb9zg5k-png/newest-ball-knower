import { track } from '@vercel/analytics';
import type { BeforeSendEvent } from '@vercel/analytics/react';

type AnalyticsValue = string | number | boolean | null;
type AnalyticsData = Record<string, AnalyticsValue>;

const SAFE_CAMPAIGN_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
]);

/**
 * Records product usage without sending names, emails, league codes, user IDs,
 * or any other personally identifying values to analytics.
 */
export function trackBallKnowerEvent(name: string, data: AnalyticsData = {}): void {
  if (typeof window === 'undefined') return;
  try {
    track(name, data);
  } catch {
    // Analytics must never interrupt gameplay, authentication, or navigation.
  }
}

/**
 * Invite codes and spectator slugs live in the query string. Keep useful UTM
 * campaign attribution while removing product-sensitive query parameters.
 */
export function redactAnalyticsUrl(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    for (const key of [...url.searchParams.keys()]) {
      if (!SAFE_CAMPAIGN_PARAMS.has(key)) url.searchParams.delete(key);
    }
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}
