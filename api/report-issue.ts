const DESTINATION = 'BallKnowerOfficial@gmail.com';
const SAFE_FIELDS = ['id', 'kind', 'message', 'stack', 'componentStack', 'url', 'route', 'userAgent', 'viewport', 'occurredAt', 'note'] as const;
const SECRET_PATTERN = /(bearer\s+[a-z0-9._-]+|access[_-]?token|refresh[_-]?token|authorization|password|api[_-]?key|anon[_-]?key|secret)(\s*[:=]\s*|\s+)([^\s,;]+)/gi;

function clean(value: unknown, limit = 6000) {
  return String(value ?? '').replace(SECRET_PATTERN, '$1$2[REDACTED]').slice(0, limit);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
    });
    if (!response.ok) throw new Error(`Mail provider returned ${response.status}`);
    return res.status(200).json({ sent: true, id: report.id });
  } catch (error) {
    console.error('issue-report-email-failed', error);
    return res.status(202).json({ sent: false, fallback: true });
  }
}
