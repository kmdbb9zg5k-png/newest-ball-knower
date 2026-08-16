import React, { useState } from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import { X, Users, ArrowRight, Shield } from 'lucide-react';
import { League } from '../types';

interface JoinLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeagueJoined: (league: League) => void;
}

export const JoinLeagueModal: React.FC<JoinLeagueModalProps> = ({
  isOpen,
  onClose,
  onLeagueJoined,
}) => {
  const { joinLeague, showToast, onlineInvitesReady } = useBallKnower();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError('Please enter a league code');
      return;
    }

    setIsJoining(true);
    const result = await joinLeague(code.trim());
    setIsJoining(false);
    if (result.success && result.league) {
      onLeagueJoined(result.league);
      onClose();
      setCode('');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-lg border border-white/10 bg-[#121212] p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          id="close-join-league-modal-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#D4AF37] text-black">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">JOIN LEAGUE</h2>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Enter your commissioner's league code</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`rounded-sm border px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${
            onlineInvitesReady ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          }`}>
            {onlineInvitesReady ? 'ONLINE — enter a code from any device' : 'ONLINE BACKEND NOT CONFIGURED'}
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1.5">
              League Code
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. BK-92741"
                value={code}
                onChange={e => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                className="w-full rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-3 text-xl font-mono font-black text-[#D4AF37] placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none uppercase tracking-widest text-center"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-red-400 mt-2 font-bold uppercase bg-red-500/10 border border-red-500/20 rounded-sm p-2">
                {error}
              </p>
            )}
          </div>

          <button
            id="submit-join-league-btn"
            type="submit"
            disabled={isJoining}
            className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-lg hover:bg-amber-300 transition-all cursor-pointer"
          >
            <span>{isJoining ? "FINDING LEAGUE..." : "JOIN LEAGUE LOBBY"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
