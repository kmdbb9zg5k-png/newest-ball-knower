export type AccountDeletionResult = {
  ok: true;
  appleAuthorizationRevoked: boolean | null;
  manualAppleRevokeRequired: boolean;
  sessionChanged?: boolean;
};

const NOTICE_KEY = 'ballknower_account_deletion_followup_v1';
export const ACCOUNT_DELETION_NOTICE_EVENT = 'ballknower:account-deletion-followup';

export function recordAccountDeletionResult(result: AccountDeletionResult): void {
  try {
    if (result.manualAppleRevokeRequired) localStorage.setItem(NOTICE_KEY, 'apple_removal_required');
  } catch {}
  window.dispatchEvent(new Event(ACCOUNT_DELETION_NOTICE_EVENT));
}

export function hasAccountDeletionFollowup(): boolean {
  try { return localStorage.getItem(NOTICE_KEY) === 'apple_removal_required'; } catch { return false; }
}

export function dismissAccountDeletionFollowup(): void {
  try { localStorage.removeItem(NOTICE_KEY); } catch {}
  window.dispatchEvent(new Event(ACCOUNT_DELETION_NOTICE_EVENT));
}
