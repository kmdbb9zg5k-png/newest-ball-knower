export type TerminalGuestMergeFailure = 'expired' | 'invalid' | 'already_claimed';

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error || '');
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  return [candidate.code, candidate.message, candidate.details, candidate.hint]
    .filter(value => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

export function terminalGuestMergeFailure(error: unknown): TerminalGuestMergeFailure | null {
  const text = errorText(error);
  if (text.includes('guest merge token expired')) return 'expired';
  if (text.includes('guest merge token is invalid')) return 'invalid';
  if (text.includes('guest progress was already claimed by another account')) return 'already_claimed';
  return null;
}

export function recoverTerminalGuestMerge(
  error: unknown,
  clearPending: () => void,
): TerminalGuestMergeFailure | null {
  const failure = terminalGuestMergeFailure(error);
  if (failure) clearPending();
  return failure;
}
