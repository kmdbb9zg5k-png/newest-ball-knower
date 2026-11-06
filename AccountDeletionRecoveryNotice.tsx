import React, { useEffect, useState } from 'react';
import { ACCOUNT_DELETION_NOTICE_EVENT, dismissAccountDeletionFollowup, hasAccountDeletionFollowup } from './accountDeletionRecovery';

export function AccountDeletionRecoveryNotice() {
  const [visible, setVisible] = useState(hasAccountDeletionFollowup);
  useEffect(() => {
    const update = () => setVisible(hasAccountDeletionFollowup());
    window.addEventListener(ACCOUNT_DELETION_NOTICE_EVENT, update);
    return () => window.removeEventListener(ACCOUNT_DELETION_NOTICE_EVENT, update);
  }, []);
  if (!visible) return null;
  return <aside role="alert" aria-label="Apple authorization removal required" className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[9999] mx-auto max-w-lg rounded-2xl border border-amber-300/40 bg-[#11151c] p-4 text-sm text-white shadow-2xl">
    <p className="font-bold">Your Ball Knower account was deleted. Apple authorization still needs removal.</p>
    <p className="mt-2 text-zinc-300">Open your Apple Account’s Sign in with Apple settings, choose Ball Knower, and remove its authorization. Ball Knower could not confirm automatic revocation.</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <a href="https://account.apple.com" target="_blank" rel="noopener noreferrer" className="grid min-h-11 place-items-center rounded-lg bg-amber-300 px-4 font-bold text-black">Open Apple Account</a>
      <button type="button" onClick={dismissAccountDeletionFollowup} className="min-h-11 rounded-lg border border-white/20 px-4">Dismiss</button>
    </div>
  </aside>;
}
