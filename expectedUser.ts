/** Bind queued work to the account that created it, not the account active later. */
export function requireExpectedUser(actualUserId: string, expectedUserId?: string): string {
  if (expectedUserId !== undefined && actualUserId !== expectedUserId) {
    throw new Error('Your account changed. Reopen this screen to continue.');
  }
  return expectedUserId ?? actualUserId;
}
