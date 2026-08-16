import React, { useState } from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import { X, Shield, Mail, ArrowRight, User, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithProvider, currentUser } = useBallKnower();
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  if (!isOpen) return null;

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    const name = nameInput.trim() || emailInput.split('@')[0];
    loginWithProvider('email', name, emailInput.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-lg border border-white/10 bg-[#121212] p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          id="close-auth-modal-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-sm bg-[#D4AF37] shadow-lg">
            <Shield className="h-7 w-7 text-black fill-black" />
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white">
            BALL KNOWER
          </h2>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-bold">
            Prove you know ball. Earn your draft position.
          </p>
        </div>

        {/* Auth Buttons */}
        {!showEmailForm ? (
          <div className="space-y-3">
            {/* Google Sign In */}
            <button
              id="auth-google-btn"
              onClick={() => {
                loginWithProvider('google');
                onClose();
              }}
              className="w-full flex items-center justify-center gap-3 rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-zinc-800 transition-all shadow-sm"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8 0-1 .1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Apple Sign In */}
            <button
              id="auth-apple-btn"
              onClick={() => {
                loginWithProvider('apple');
                onClose();
              }}
              className="w-full flex items-center justify-center gap-3 rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-zinc-800 transition-all shadow-sm"
            >
              <svg className="h-4 w-4 fill-white" viewBox="0 0 170 170">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.94-12.04-14.59-6.3-9.58-11.35-20.67-15.15-33.26-3.8-12.59-5.7-24.32-5.7-35.18 0-14.16 3.65-25.96 10.95-35.4 7.3-9.45 16.59-14.28 27.87-14.5 4.35 0 9.53 1.25 15.54 3.75 6.01 2.5 9.94 3.79 11.78 3.86 1.41 0 5.48-1.37 12.21-4.11 6.73-2.74 12.6-3.88 17.62-3.41 13.29 1.08 23.36 6.34 30.21 15.78-11.52 6.96-17.18 16.32-16.98 28.09.21 9.13 3.69 16.85 10.43 23.16 6.74 6.31 14.89 9.89 24.45 10.76-2.17 6.74-4.89 13.37-8.15 19.88zM119.22 33.02c0-7.39 2.66-14.24 7.98-20.55 5.32-6.31 11.89-10.22 19.71-11.74.87 7.61-1.63 14.7-7.5 21.28-5.87 6.58-12.6 10.51-20.19 11.01z" />
              </svg>
              <span>Continue with Apple</span>
            </button>

            {/* Email Sign In */}
            <button
              id="auth-email-btn"
              onClick={() => setShowEmailForm(true)}
              className="w-full flex items-center justify-center gap-3 rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-zinc-800 transition-all shadow-sm"
            >
              <Mail className="h-4 w-4 text-[#D4AF37]" />
              <span>Continue with Email</span>
            </button>

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-white/10"></div>
              <span className="absolute bg-[#121212] px-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Quick Test GMs
              </span>
            </div>

            {/* 1-Click Fast Switch Personas */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  loginWithProvider('email', 'Elijah Davis', 'elijah@ballknower.com');
                  onClose();
                }}
                className="flex items-center gap-2 rounded-sm border border-white/5 bg-[#1A1A1A] p-2 text-left hover:border-[#D4AF37]/40 transition-colors"
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80"
                  alt="Elijah"
                  className="h-7 w-7 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-white truncate">Elijah</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#D4AF37]">Commissioner</p>
                </div>
              </button>

              <button
                onClick={() => {
                  loginWithProvider('email', 'Tyler Vance', 'tyler@ballknower.com');
                  onClose();
                }}
                className="flex items-center gap-2 rounded-sm border border-white/5 bg-[#1A1A1A] p-2 text-left hover:border-[#D4AF37]/40 transition-colors"
              >
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80"
                  alt="Tyler"
                  className="h-7 w-7 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-white truncate">Tyler</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">League Member</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1">
                Your Name / GM Alias
              </label>
              <input
                type="text"
                placeholder="e.g. Mike McDaniel"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                className="w-full rounded-sm border border-white/10 bg-[#1A1A1A] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full rounded-sm border border-white/10 bg-[#1A1A1A] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] px-4 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg hover:bg-amber-300 transition-all"
            >
              <span>SIGN IN & CONTINUE</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="w-full text-center text-xs font-bold uppercase text-zinc-400 hover:text-white py-1 tracking-wider"
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
