import {
  BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY,
  BALL_KNOWER_SUPABASE_URL,
} from '../supabaseDefaults';

export const config = { runtime: 'edge' };

const MAX_BODY_BYTES = 2_000;

function cleanGeo(value: string | null, limit: number): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) || null;
  } catch {
    return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) || null;
  }
}

function isCrossSite(request: Request): boolean {
  if (request.headers.get('sec-fetch-site')?.toLowerCase() === 'cross-site') return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host.toLowerCase() !== new URL(request.url).host.toLowerCase();
  } catch {
    return true;
  }
}

function safePath(value: unknown): string {
  const raw = String(value || '/').slice(0, 300);
  try {
    return new URL(raw, 'https://ballknowerofficial.com').pathname.slice(0, 200) || '/';
  } catch {
    return '/';
  }
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

async function dailyVisitorKey(day: string, visitorId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`ball-knower-location-v1:${day}:${visitorId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (isCrossSite(request)) return json({ error: 'Cross-site request blocked' }, 403);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Request too large' }, 413);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const visitorId = String(body.visitorId || '');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(visitorId)) {
    return json({ error: 'Invalid anonymous visitor ID' }, 400);
  }

  const day = new Date().toISOString().slice(0, 10);
  const visitorKey = await dailyVisitorKey(day, visitorId);
  const country = cleanGeo(request.headers.get('x-vercel-ip-country')?.toUpperCase() || null, 2);
  const region = cleanGeo(request.headers.get('x-vercel-ip-country-region')?.toUpperCase() || null, 3);
  const city = cleanGeo(request.headers.get('x-vercel-ip-city'), 120);
  const timezone = cleanGeo(request.headers.get('x-vercel-ip-timezone'), 80);

  const supabaseUrl = process.env.SUPABASE_URL || BALL_KNOWER_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return json({ recorded: false }, 202);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/ball_knower_visit_locations`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        visitor_key: visitorKey,
        country_code: country,
        region_code: region,
        city,
        timezone,
        path: safePath(body.path),
      }),
    });
    // A duplicate means this browser was already counted today. Treat it as a
    // successful no-op without granting public SELECT/UPDATE access.
    if (!response.ok && response.status !== 409) throw new Error(`Supabase returned ${response.status}`);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('visitor-location-write-failed', error instanceof Error ? error.message : String(error));
    return json({ recorded: false }, 202);
  }
}
