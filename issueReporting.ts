export type IssueDiagnostic = {
  id: string;
  kind: 'crash' | 'handled-error' | 'user-report';
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  route: string;
  userAgent: string;
  viewport: string;
  occurredAt: string;
  note?: string;
};

const CONTACT_EMAIL = 'BallKnowerOfficial@gmail.com';
const SECRET_PATTERN = /(bearer\s+[a-z0-9._-]+|access[_-]?token|refresh[_-]?token|authorization|password|api[_-]?key|anon[_-]?key|secret)(\s*[:=]\s*|\s+)([^\s,;]+)/gi;

export function redactDiagnostic(value: unknown, maxLength = 6000) {
  return String(value ?? '')
    .replace(SECRET_PATTERN, '$1$2[REDACTED]')
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{20,}/g, '[REDACTED_TOKEN]')
    .slice(0, maxLength);
}

export function createIssueDiagnostic(error: unknown, kind: IssueDiagnostic['kind'], extra: Partial<IssueDiagnostic> = {}): IssueDiagnostic {
  const normalized = error instanceof Error ? error : new Error(redactDiagnostic(error) || 'Unknown error');
  const id = `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return {
    id,
    kind,
    message: redactDiagnostic(normalized.message, 1200),
    stack: redactDiagnostic(normalized.stack),
    componentStack: redactDiagnostic(extra.componentStack),
    url: typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`,
    route: typeof location === 'undefined' ? '' : location.pathname,
    userAgent: typeof navigator === 'undefined' ? '' : redactDiagnostic(navigator.userAgent, 800),
    viewport: typeof window === 'undefined' ? '' : `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    occurredAt: new Date().toISOString(),
    note: redactDiagnostic(extra.note, 1000),
  };
}

function mailtoUrl(report: IssueDiagnostic) {
  const subject = `[BALL KNOWER BUG] ${report.route || 'App'} — ${report.id}`;
  const body = [
    `Report ID: ${report.id}`,
    `Time: ${report.occurredAt}`,
    `Screen: ${report.route}`,
    `Device: ${report.userAgent}`,
    `Viewport: ${report.viewport}`,
    `Message: ${report.message}`,
    report.note ? `User note: ${report.note}` : '',
    '',
    'Please describe what you tapped right before this happened:',
  ].filter(Boolean).join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function submitIssueReport(report: IssueDiagnostic) {
  try {
    const response = await fetch('/api/report-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.sent) return { sent: true, fallback: false };
  } catch {}
  window.location.href = mailtoUrl(report);
  return { sent: false, fallback: true };
}

export function captureHandledError(error: unknown, note?: string) {
  if (typeof window === 'undefined') return;
  const report = createIssueDiagnostic(error, 'handled-error', { note });
  window.dispatchEvent(new CustomEvent<IssueDiagnostic>('ball-knower:issue', { detail: report }));
}
