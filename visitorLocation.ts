const VISITOR_ID_KEY = 'bk_visitor_location_id_v1';
const SENT_DAY_KEY = 'bk_visitor_location_sent_day_v1';

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function getAnonymousVisitorId(): string {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const created = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(VISITOR_ID_KEY, created);
  return created;
}

/**
 * Records one privacy-safe, approximate location event per browser per UTC day.
 * Vercel resolves the location server-side; the browser never supplies it and
 * Ball Knower never stores the request IP address.
 */
export async function recordApproximateVisitorLocation(): Promise<void> {
  if (typeof window === 'undefined' || window.location.hostname === 'localhost') return;

  const day = utcDay();
  try {
    if (window.localStorage.getItem(SENT_DAY_KEY) === day) return;
    window.localStorage.setItem(SENT_DAY_KEY, day);

    const response = await fetch('/api/track-visitor-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: getAnonymousVisitorId(),
        path: window.location.pathname,
      }),
      keepalive: true,
    });

    if (!response.ok) window.localStorage.removeItem(SENT_DAY_KEY);
  } catch {
    try {
      window.localStorage.removeItem(SENT_DAY_KEY);
    } catch {
      // Location analytics must never interrupt the app.
    }
  }
}
