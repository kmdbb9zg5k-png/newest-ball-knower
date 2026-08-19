import React, { useState } from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import { X, Shield, Mail, ArrowRight, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { attachEmailToAnonymousUser, ensureOnlineSession, sendEmailMagicLink } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser, showToast } = useBallKnower();
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    resetMessages();
    const email = emailInput.trim().toLowerCase();
    const name = nameInput.trim() || email.split('@')[0] || 'Ball Knower GM';

    try {
      const authUser = await ensureOnlineSession();

      if (authUser.is_anonymous) {
        try {
          const upgraded = await attachEmailToAnonymousUser(email, name);
          setCurrentUser({
            id: upgraded.id,
            name: (upgraded.user_metadata?.full_name as string | undefined) || name,
            email: upgraded.email || email,
            avatarUrl: currentUser?.avatarUrl,
            createdAt: upgraded.created_at || currentUser?.createdAt || new Date().toISOString(),
          });
          const message = 'Verification email sent. Your guest identity stays the same, so your leagues and roster ownership are preserved.';
          setStatusMessage(message);
          showToast('Verification email sent — your Ball Knower identity is preserved.');
        } catch (upgradeError: any) {
          const raw = upgradeError?.message || '';
          if (!/already|registered|exists|taken|duplicate/i.test(raw)) throw upgradeError;

          await sendEmailMagicLink(email, name);
          const message = 'That email already has a Ball Knower account. A magic sign-in link was sent for that existing account. Guest-owned leagues are not transferred automatically.';
          setStatusMessage(message);
          showToast('Existing account found — magic sign-in link sent.');
        }
      } else {
        await sendEmailMagicLink(email, name);
        const message = 'Magic sign-in link sent. Open the email on this device to finish signing in.';
        setStatusMessage(message);
        showToast('Magic sign-in link sent.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not start email authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border border-white/10 bg-[#121212] p-6 sm:p-8 shadow-2xl">
        <button
          id="close-auth-modal-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-sm bg-[#D4AF37] shadow-lg">
            <Shield className="h-7 w-7 text-black fill-black" />
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white">BALL KNOWER</h2>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-bold">
            One account. One league identity.
          </p>
        </div>

        {!showEmailForm ? (
          <div className="space-y-3">
            <button
              id="auth-google-btn"
              type="button"
              disabled
              aria-disabled="true"
              className="w-full flex items-center justify-between gap-3 rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 cursor-not-allowed"
            >
              <span className="flex items-center gap-3">
                <svg className="h-4 w-4 opacity-60" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                  <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8 0-1 .1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
                </svg>
                <span>Google</span>
              </span>
              <span className="text-[9px] text-zinc-600">COMING SOON</span>
            </button>

            <button
              id="auth-apple-btn"
              type="button"
              disabled
              aria-disabled="true"
              className="w-full flex items-center justify-between gap-3 rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 cursor-not-allowed"
            >
              <span className="flex items-center gap-3">
                <svg className="h-4 w-4 fill-current opacity-60" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.94-12.04-14.59-6.3-9.58-11.35-20.67-15.15-33.26-3.8-12.59-5.7-24.32-5.7-35.18 0-14.16 3.65-25.96 10.95-35.4 7.3-9.45 16.59-14.28 27.87-14.5 4.35 0 9.53 1.25 15.54 3.75 6.01 2.5 9.94 3.79 11.78 3.86 1.41 0 5.48-1.37 12.21-4.11 6.73-2.74 12.6-3.88 17.62-3.41 13.29 1.08 23.36 6.34 30.21 15.78-11.52 6.96-17.18 16.32-16.98 28.09.21 9.13 3.69 16.85 10.43 23.16 6.74 6.31 14.89 9.89 24.45 10.76-2.17 6.74-4.89 13.37-8.15 19.88zM119.22 33.02c0-7.39 2.66-14.24 7.98-20.55 5.32-6.31 11.89-10.22 19.71-11.74.87 7.61-1.63 14.7-7.5 21.28-5.87 6.58-12.6 10.51-20.19 11.01z" />
                </svg>
                <span>Apple</span>
              </span>
              <span className="text-[9px] text-zinc-600">COMING SOON</span>
            </button>

            <button
              id="auth-email-btn"
              type="button"
              onClick={() => { resetMessages(); setShowEmailForm(true); }}
              className="w-full flex items-center justify-center gap-3 rounded-sm border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-[#D4AF37] hover:bg-[#D4AF37]/15 transition-all shadow-sm"
            >
              <Mail className="h-4 w-4" />
              <span>Continue with Email</span>
            </button>

            <div className="rounded-sm border border-white/10 bg-black/20 p-3 text-[10px] leading-relaxed text-zinc-400">
              <div className="mb-1 flex items-center gap-2 font-black uppercase tracking-wider text-zinc-300">
                <LockKeyhole className="h-3.5 w-3.5 text-[#D4AF37]" /> Guest access stays active
              </div>
              You can play as a guest. Adding a new email upgrades that same Supabase identity so existing league ownership is not replaced. If the email already belongs to an account, you can sign back into that account with a magic link.
            </div>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1">Your Name / GM Alias</label>
              <input
                type="text"
                placeholder="e.g. Mike McDaniel"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-sm border border-white/10 bg-[#1A1A1A] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-sm border border-white/10 bg-[#1A1A1A] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none disabled:opacity-60"
              />
            </div>

            {statusMessage && (
              <div className="flex gap-2 rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] px-4 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg hover:bg-amber-300 transition-all disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              <span>{isSubmitting ? 'CONNECTING...' : 'SEND VERIFICATION / SIGN-IN LINK'}</span>
            </button>

            <button
              type="button"
              onClick={() => { resetMessages(); setShowEmailForm(false); }}
              disabled={isSubmitting}
              className="w-full text-center text-xs font-bold uppercase text-zinc-400 hover:text-white py-1 tracking-wider disabled:opacity-60"
            >
              Back to all sign in options
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
          By continuing, you agree to fair NFL salary-cap competition rules.
        </p>
      </div>
    </div>
  );
};
