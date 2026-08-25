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

/** Redacts common secret-shaped values and bounds user supplied report fields. */
function clean(value: unknown, limit = 6000) {
  return String(value ?? '').replace(SECRET_PATTERN, '$1$2[REDACTED]').slice(0, limit);
}

/** Resolves the best available caller key from Vercel's trusted forwarding headers. */
function requestKey(req: any) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwarded || String(req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

/** Applies a best-effort warm-instance limit without evicting still-active counters. */
function consumeRateLimit(key: string) {
  const now = Date.now();

  for (const [storedKey, entry] of rateLimit) {
    if (entry.resetAt <= now) rateLimit.delete(storedKey);
  }

  const current = rateLimit.get(key);
  if (current) {
    if (current.count >= REPORTS_PER_WINDOW) return false;
    current.count += 1;
    return true;
  }

  // If a warm instance already has the maximum number of active source keys,
  // fail closed for new keys until one of those windows expires. Evicting an
  // unexpired key would reset that caller's counter and weaken the limit.
  if (rateLimit.size >= MAX_RATE_KEYS) return false;

  rateLimit.set(key, { count: 1, resetAt: now + REPORT_WINDOW_MS });
  return true;
}

/** Rejects browser submissions that originate from a different site/host. */
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

const bodyError = (message: string, statusCode: number) => {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
};

/** Reads and parses the request while enforcing the byte ceiling for both raw and pre-parsed Vercel bodies. */
async function readJsonBody(req: any) {
  let total = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw bodyError('Report too large', 413);
    chunks.push(buffer);
  }

  if (!chunks.length) {
    const parsedBody = req.body;
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) return {};
    let serialized: string;
    try {
      serialized = JSON.stringify(parsedBody);
    } catch {
      throw bodyError('Invalid JSON body', 400);
    }
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) throw bodyError('Report too large', 413);
    return parsedBody;
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw bodyError('Invalid JSON body', 400);
  }
}

/** Accepts a sanitized issue report and optionally relays it through Resend. */
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
