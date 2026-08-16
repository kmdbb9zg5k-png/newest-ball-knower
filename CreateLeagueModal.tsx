import React, { useState } from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import { X, Copy, Check, Users, Shield, DollarSign, ArrowRight } from 'lucide-react';
import { League } from '../types';

interface CreateLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeagueCreated: (league: League) => void;
}

export const CreateLeagueModal: React.FC<CreateLeagueModalProps> = ({
  isOpen,
  onClose,
  onLeagueCreated,
}) => {
  const { createLeague, showToast, onlineInvitesReady, cloudSyncError } = useBallKnower();
  const [leagueName, setLeagueName] = useState('');
  const [memberSize, setMemberSize] = useState<number>(10);
  const [salaryCap, setSalaryCap] = useState<number>(301.2);
  const [createdLeague, setCreatedLeague] = useState<League | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueName.trim()) {
      showToast('Please enter a league name');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const newLeague = await createLeague(leagueName.trim(), memberSize, salaryCap);
      setCreatedLeague(newLeague);
    } catch (err:any) {
      setCreateError(err?.message || 'Could not create league');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (!createdLeague) return;
    navigator.clipboard.writeText(createdLeague.code);
    setCopiedCode(true);
    showToast(`Copied code: ${createdLeague.code}`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!createdLeague) return;
    const url = `${window.location.origin}?join=${createdLeague.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Copied league invite link to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleFinishAndEnter = () => {
    if (createdLeague) {
      onLeagueCreated(createdLeague);
      onClose();
      // Reset state for next time
      setCreatedLeague(null);
      setLeagueName('');
    }
  };

  const LEAGUE_SIZES = [6, 8, 10, 12, 14, 16];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-lg border border-white/10 bg-[#121212] p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          id="close-create-league-modal-btn"
          onClick={() => {
            onClose();
            setCreatedLeague(null);
          }}
          className="absolute right-4 top-4 rounded-sm p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {!createdLeague ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#D4AF37] text-black">
                <Shield className="h-5 w-5 fill-black" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">CREATE LEAGUE</h2>
                <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Set up your draft competition in 30 seconds</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-5">
              <div className={`rounded-sm border px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${
                onlineInvitesReady ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}>
                {onlineInvitesReady ? 'ONLINE INVITES ACTIVE — codes work across devices' : 'LOCAL MODE — connect Supabase to activate cross-device invites'}
              </div>
              {(createError || cloudSyncError) && <div className="text-xs text-red-400">{createError || cloudSyncError}</div>}
              {/* League Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-1.5">
                  League Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunday Gridiron Champions"
                  value={leagueName}
                  onChange={e => setLeagueName(e.target.value)}
                  className="w-full rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Number of Players */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-2">
                  Number of Fantasy Teams ({memberSize} Teams)
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {LEAGUE_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setMemberSize(size)}
                      className={`rounded-sm border py-2.5 font-mono text-sm font-black transition-all ${
                        memberSize === size
                          ? 'border-[#D4AF37] bg-[#D4AF37] text-black shadow-sm'
                          : 'border-white/10 bg-[#1A1A1A] text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Salary Cap */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-300">
                    Salary Cap Per Team
                  </label>
                  <span className="text-xs font-mono font-black text-[#D4AF37]">
                    ${salaryCap} MILLION
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={200}
                    max={400}
                    step={0.1}
                    value={salaryCap}
                    onChange={e => setSalaryCap(Number(e.target.value))}
                    className="w-full h-2 bg-[#1A1A1A] rounded-sm appearance-none cursor-pointer accent-[#D4AF37]"
                  />
                </div>
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mt-1">Official 2026 NFL salary cap is $301.2M</p>
              </div>

              {/* Submit */}
              <button
                id="submit-create-league-btn"
                type="submit"
                disabled={isCreating}
                className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-lg hover:bg-amber-300 transition-all cursor-pointer"
              >
                <span>{isCreating ? "CREATING ONLINE LEAGUE..." : "CREATE LEAGUE"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center py-2 animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm bg-[#00FF00]/10 border border-[#00FF00]/30 text-[#00FF00] shadow-lg">
              <Check className="h-7 w-7" />
            </div>

            <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white mb-1">
              LEAGUE CREATED!
            </h2>
            <p className="text-sm font-black uppercase tracking-wider text-[#D4AF37] mb-6">
              {createdLeague.name}
            </p>

            {/* League Code Box */}
            <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4 mb-4">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                Shareable League Code
              </p>
              <div className="flex items-center justify-between gap-3 bg-[#0A0A0A] rounded-sm px-4 py-2.5 border border-white/10">
                <span className="font-mono text-2xl font-black text-[#D4AF37] tracking-wider">
                  {createdLeague.code}
                </span>
                <button
                  id="copy-league-code-btn"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 rounded-sm bg-[#D4AF37] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition-colors"
                >
                  {copiedCode ? <Check className="h-4 w-4 text-black" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedCode ? 'COPIED!' : 'COPY CODE'}</span>
                </button>
              </div>
            </div>

            {/* Share Link */}
            <div className="mb-6">
              <button
                id="copy-league-link-btn"
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 rounded-sm border border-white/10 bg-[#1A1A1A] py-2.5 text-xs font-black uppercase tracking-wider text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                {copiedLink ? <Check className="h-4 w-4 text-[#00FF00]" /> : <Copy className="h-4 w-4 text-zinc-400" />}
                <span>{copiedLink ? 'LINK COPIED!' : 'COPY DIRECT INVITE LINK'}</span>
              </button>
            </div>

            {/* Action to Enter Lobby */}
            <button
              id="enter-league-lobby-btn"
              onClick={handleFinishAndEnter}
              className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-lg hover:bg-amber-300 transition-all"
            >
              <span>ENTER LEAGUE LOBBY</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
