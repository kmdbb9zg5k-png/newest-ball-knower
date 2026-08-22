const DESTINATION = 'BallKnowerOfficial@gmail.com';
const SAFE_FIELDS = ['id', 'kind', 'message', 'stack', 'componentStack', 'url', 'route', 'userAgent', 'viewport', 'occurredAt', 'note'] as const;
const SECRET_PATTERN = /(bearer\s+[a-z0-9._-]+|access[_-]?token|refresh[_-]?token|authorization|password|api[_-]?key|anon[_-]?key|secret)(\s*[:=]\s*|\s+)([^\s,;]+)/gi;
const MAX_BODY_BYTES = 32_000;
const REPORT_WINDOW_MS = 60_000;
const REPORTS_PER_WINDOW = 3;
const MAX_RATE_KEYS = 1_000;
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

  // Keep the warm-instance cache bounded even when callers rotate source IPs.
  for (const [storedKey, entry] of rateLimit) {
    if (entry.resetAt <= now) rateLimit.delete(storedKey);
  }

  // Preserve an active caller's counter even when it is the oldest Map entry.
  const current = rateLimit.get(key);
  if (current) {
    if (current.count >= REPORTS_PER_WINDOW) return false;
    current.count += 1;
    return true;
  }

  while (rateLimit.size >= MAX_RATE_KEYS) {
    const oldestKey = rateLimit.keys().next().value as string | undefined;
    if (!oldestKey) break;
    rateLimit.delete(oldestKey);
  }

  rateLimit.set(key, { count: 1, resetAt: now + REPORT_WINDOW_MS });
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

async function readJsonBody(req: any) {
  let total = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('Report too large');
      (error as any).statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    const error = new Error('Invalid JSON body');
    (error as any).statusCode = 400;
    throw error;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (isCrossSiteBrowserRequest(req)) return res.status(403).json({ error: 'Cross-site reports are not allowed' });

  const contentLengthHeader = req.headers?.['content-length'];
  if (contentLengthHeader != null && contentLengthHeader !== '') {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return res.status(400).json({ error: 'Invalid content length' });
    }
    if (contentLength > MAX_BODY_BYTES) return res.status(413).json({ error: 'Report too large' });
  }

  if (!consumeRateLimit(requestKey(req))) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many reports' });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await readJsonBody(req);
  } catch (error: any) {
    const status = Number(error?.statusCode) === 413 ? 413 : 400;
    return res.status(status).json({ error: status === 413 ? 'Report too large' : 'Invalid JSON body' });
  }

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
