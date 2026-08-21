const DESTINATION = 'BallKnowerOfficial@gmail.com';
const SAFE_FIELDS = ['id', 'kind', 'message', 'stack', 'componentStack', 'url', 'route', 'userAgent', 'viewport', 'occurredAt', 'note'] as const;
const SECRET_PATTERN = /(bearer\s+[a-z0-9._-]+|access[_-]?token|refresh[_-]?token|authorization|password|api[_-]?key|anon[_-]?key|secret)(\s*[:=]\s*|\s+)([^\s,;]+)/gi;
const MAX_BODY_BYTES = 32_000;
const REPORT_WINDOW_MS = 60_000;
const REPORTS_PER_WINDOW = 3;
const RESEND_TIMEOUT_MS = 8_000;

type RateEntry = { count: number; resetAt: number };
const rateLimit = new Map<string, RateEntry>();

function clean(value: unknown, limit = 6000) {
  return String(value ?? '').replace(SECRET_PATTERN, '$1$2[REDACTED]').slice(0, limit);
}

function requestKey(req: any) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwarded || String(req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

function consumeRateLimit(key: string) {
  const now = Date.now();
  const current = rateLimit.get(key);
  if (!current || current.resetAt <= now) {
    rateLimit.set(key, { count: 1, resetAt: now + REPORT_WINDOW_MS });
    return true;
  }
  if (current.count >= REPORTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

function isCrossSiteBrowserRequest(req: any) {
  const fetchSite = String(req.headers?.['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') return true;

  const origin = String(req.headers?.origin || '').trim();
  const host = String(req.headers?.host || '').trim().toLowerCase();
  if (!origin || !host) return false;

  try {
    return new URL(origin).host.toLowerCase() !== host;
  } catch {
    return true;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (isCrossSiteBrowserRequest(req)) return res.status(403).json({ error: 'Cross-site reports are not allowed' });

  const contentLength = Number(req.headers?.['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Report too large' });
  }

  if (!consumeRateLimit(requestKey(req))) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many reports' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const report = Object.fromEntries(SAFE_FIELDS.map(field => [field, clean(body[field], field === 'message' ? 1200 : 6000)]));
  if (!report.id || !report.message) return res.status(400).json({ error: 'Missing report details' });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ERROR_REPORT_FROM_EMAIL;
  if (!apiKey || !from) return res.status(202).json({ sent: false, fallback: true });

  const text = SAFE_FIELDS.map(field => `${field}:\n${report[field] || '—'}`).join('\n\n');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [DESTINATION],
        subject: `[BALL KNOWER BUG] ${report.route || 'App'} — ${report.id}`,
        text,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Mail provider returned ${response.status}`);
    return res.status(200).json({ sent: true, id: report.id });
  } catch (error) {
    console.error('issue-report-email-failed', error);
    return res.status(202).json({ sent: false, fallback: true });
  }
}
