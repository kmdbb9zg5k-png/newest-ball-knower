import { createHash } from 'node:crypto';
import {
  BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY,
  BALL_KNOWER_SUPABASE_URL,
} from '../supabaseDefaults';

const MAX_BODY_BYTES = 2_000;
const REQUESTS_PER_MINUTE = 12;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function header(req: any, name: string): string {
  const value = req.headers?.[name];
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function cleanGeo(value: string, limit: number): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) || null;
  } catch {
    return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) || null;
  }
}

function isCrossSite(req: any): boolean {
  if (header(req, 'sec-fetch-site').toLowerCase() === 'cross-site') return true;
  const origin = header(req, 'origin');
  const host = header(req, 'host').toLowerCase();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() !== host;
  } catch {
    return true;
  }
}

function consumeRateLimit(req: any): boolean {
  const now = Date.now();
  for (const [key, value] of rateLimit) if (value.resetAt <= now) rateLimit.delete(key);

  // Used only in warm memory for abuse prevention; the address is never persisted.
  const key = header(req, 'x-forwarded-for').split(',')[0]?.trim() || 'unknown';
  const current = rateLimit.get(key);
  if (!current) {
    rateLimit.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= REQUESTS_PER_MINUTE) return false;
  current.count += 1;
  return true;
}

function parseBody(req: any): Record<string, unknown> {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function safePath(value: unknown): string {
  const raw = String(value || '/').slice(0, 300);
  try {
    return new URL(raw, 'https://ballknowerofficial.com').pathname.slice(0, 200) || '/';
  } catch {
    return '/';
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (isCrossSite(req)) return res.status(403).json({ error: 'Cross-site request blocked' });

  const contentLength = Number(header(req, 'content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request too large' });
  }
  if (!consumeRateLimit(req)) return res.status(429).json({ error: 'Too many requests' });

  const body = parseBody(req);
  const visitorId = String(body.visitorId || '');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(visitorId)) {
    return res.status(400).json({ error: 'Invalid anonymous visitor ID' });
  }

  const day = new Date().toISOString().slice(0, 10);
  const visitorKey = createHash('sha256').update(`ball-knower-location-v1:${day}:${visitorId}`).digest('hex');
  const country = cleanGeo(header(req, 'x-vercel-ip-country').toUpperCase(), 2);
  const region = cleanGeo(header(req, 'x-vercel-ip-country-region').toUpperCase(), 3);
  const city = cleanGeo(header(req, 'x-vercel-ip-city'), 120);
  const timezone = cleanGeo(header(req, 'x-vercel-ip-timezone'), 80);

  const supabaseUrl = process.env.SUPABASE_URL || BALL_KNOWER_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(202).json({ recorded: false });

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
      signal: AbortSignal.timeout(5_000),
    });
    // A duplicate means this browser was already counted today. Treat it as a
    // successful no-op without granting public SELECT/UPDATE access.
    if (!response.ok && response.status !== 409) throw new Error(`Supabase returned ${response.status}`);
    return res.status(204).end();
  } catch (error) {
    console.error('visitor-location-write-failed', error instanceof Error ? error.message : String(error));
    return res.status(202).json({ recorded: false });
  }
}
