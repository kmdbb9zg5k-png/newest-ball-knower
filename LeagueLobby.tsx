import React, { useState } from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import {
  Trophy,
  Shield,
  Copy,
  Check,
  Play,
  UserPlus,
  Users,
  Settings,
  Trash2,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { League } from '../types';

interface LeagueLobbyProps {
  league: League;
  onGoToDraft: () => void;
  onGoToSimulation: () => void;
}

export const LeagueLobby: React.FC<LeagueLobbyProps> = ({
  league,
  onGoToDraft,
  onGoToSimulation,
}) => {
  const {
    currentUser,
    autoFillLeagueWithAi,
    removeMemberFromLeague,
    startSimulation,
    resetLeagueSimulation,
    updateSalaryCap,
    updateLeagueSettings,
    showToast,
  } = useBallKnower();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newCapInput, setNewCapInput] = useState(league.salaryCap);

  const isCommissioner = currentUser?.id === league.commissionerId;
  const myMember = league.members.find(m => m.userId === currentUser?.id);
  const isMyRosterReady = myMember?.status === 'ready';

  const readyCount = league.members.filter(m => m.status === 'ready').length;
  const totalCount = league.members.length;
  const isAllReady = readyCount === totalCount && totalCount >= 2;
  const slotsRemaining = league.maxMembers - league.members.length;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(league.code);
    setCopiedCode(true);
    showToast(`Copied code: ${league.code}`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}?join=${league.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Copied league invite link to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleStartSim = () => {
    if (!isAllReady) {
      showToast('All league members must submit a valid roster before simulation.');
      return;
    }
    startSimulation(league.id);
    onGoToSimulation();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 bg-[#0A0A0A] text-white">
      {/* Header Banner */}
      <div className="rounded-lg border border-white/5 bg-[#121212] p-6 shadow-xl mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-black text-[#D4AF37] bg-zinc-800 px-2.5 py-0.5 rounded-sm">
                CODE: {league.code}
              </span>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                COMMISSIONER: {league.commissionerName}
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
              {league.name}
            </h1>
          </div>

          {/* Share Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              id="lobby-copy-code-btn"
              onClick={handleCopyCode}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-[#00FF00]" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedCode ? 'COPIED' : 'COPY CODE'}</span>
            </button>

            <button
              id="lobby-copy-link-btn"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-sm bg-[#D4AF37] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition-colors"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-black" /> : <UserPlus className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'LINK COPIED' : 'INVITE FRIENDS'}</span>
            </button>
          </div>
        </div>

        {/* Progress & Cap summary */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-white/5 pt-5">
          <div className="rounded-sm bg-[#0A0A0A] p-3 border border-white/5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">League Progress</p>
            <p className="text-sm font-black text-white mt-0.5 font-mono">
              <span className="text-[#D4AF37]">{readyCount}</span> / {totalCount} READY
            </p>
          </div>

          <div className="rounded-sm bg-[#0A0A0A] p-3 border border-white/5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">League Size</p>
            <p className="text-sm font-black text-zinc-200 mt-0.5 font-mono">
              {league.members.length} / {league.maxMembers} TEAMS
            </p>
          </div>

          <div className="rounded-sm bg-[#0A0A0A] p-3 border border-white/5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Salary Cap</p>
            <p className="text-sm font-black text-zinc-200 mt-0.5 font-mono">
              ${league.salaryCap}M CAP
            </p>
          </div>

          <div className="rounded-sm bg-[#0A0A0A] p-3 border border-white/5">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Your Status</p>
            <p className={`text-xs font-black uppercase tracking-wider mt-0.5 flex items-center gap-1.5 ${isMyRosterReady ? 'text-[#00FF00]' : 'text-[#D4AF37]'}`}>
              {isMyRosterReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              <span>{isMyRosterReady ? 'ROSTER READY' : 'BUILDING ROSTER'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* User's Call to Action Banner if not ready */}
      {!isMyRosterReady && (
        <div className="rounded-lg border border-[#D4AF37]/40 bg-[#1A1A1A] p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#D4AF37]" />
              <span>YOUR ROSTER IS NOT YET SUBMITTED</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1 font-medium">
              Select your 20 NFL players under the ${league.salaryCap}M cap to mark yourself ready.
            </p>
          </div>
          <button
            id="lobby-enter-draft-btn"
            onClick={onGoToDraft}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] px-6 py-3 text-xs font-black uppercase tracking-widest text-black hover:bg-amber-300 transition-colors shadow-md cursor-pointer"
          >
            <span>ENTER DRAFT ROOM</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Members List (Left 2 Columns) */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h2 className="font-display text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-[#D4AF37]" />
              <span>LEAGUE MEMBERS ({league.members.length}/{league.maxMembers})</span>
            </h2>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-mono">
              {readyCount} of {totalCount} SUBMITTED
            </span>
          </div>

          <div className="rounded-lg border border-white/5 bg-[#121212] divide-y divide-white/5 overflow-hidden">
            {league.members.map((member, idx) => {
              const isMe = member.userId === currentUser?.id;
              const isReady = member.status === 'ready';

              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-4 transition-colors ${
                    isMe ? 'bg-[#1A1A1A]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-black text-zinc-500 w-5">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>

                    <img
                      src={member.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80'}
                      alt={member.userName}
                      className="h-10 w-10 rounded-full object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black uppercase text-white truncate">
                          {member.userName}
                        </p>
                        {isMe && (
                          <span className="rounded-sm bg-[#D4AF37]/20 px-1.5 py-0.2 text-[9px] font-black text-[#D4AF37] uppercase tracking-wider">
                            YOU
                          </span>
                        )}
                        {member.isCommissioner && (
                          <span className="rounded-sm bg-zinc-800 px-1.5 py-0.2 text-[9px] font-black text-zinc-300 border border-white/10 uppercase tracking-wider">
                            COMMISH
                          </span>
                        )}
                        {member.isAi && (
                          <span className="rounded-sm bg-zinc-800 px-1.5 py-0.2 text-[9px] font-black text-zinc-400 border border-white/10 uppercase tracking-wider">
                            AI GM
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold truncate">
                        {member.aiArchetype || (isMe ? 'Your Fantasy Team' : 'League Participant')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Pill */}
                    {isReady ? (
                      <div className="flex items-center gap-1 rounded-sm bg-[#00FF00]/10 border border-[#00FF00]/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#00FF00]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>READY</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 rounded-sm bg-[#1A1A1A] border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
                        <Clock className="h-3.5 w-3.5" />
                        <span>BUILDING</span>
                      </div>
                    )}

                    {/* Commissioner remove member button */}
                    {isCommissioner && !isMe && (
                      <button
                        onClick={() => removeMemberFromLeague(league.id, member.id)}
                        className="rounded-sm p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Privacy Note */}
          <div className="flex items-center gap-2 rounded-sm bg-[#121212] border border-white/5 px-4 py-3 text-xs text-zinc-400">
            <Lock className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" />
            <span className="font-medium">Rosters remain strictly private until the league season simulation begins.</span>
          </div>
        </div>

        {/* Action Panel / Commissioner Controls (Right Column) */}
        <div className="space-y-4">
          {/* Main Action Card */}
          <div className="rounded-lg border border-white/5 bg-[#121212] p-5 shadow-xl">
            <h3 className="font-display text-sm font-black uppercase tracking-wider text-white mb-3">
              Draft Competition Actions
            </h3>

            <div className="space-y-2.5">
              {/* Draft / View Roster Button */}
              <button
                id="lobby-view-draft-btn"
                onClick={onGoToDraft}
                className="w-full flex items-center justify-center gap-2 rounded-sm bg-white text-black hover:bg-[#D4AF37] py-3 text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                <Shield className="h-4 w-4 fill-black" />
                <span>{isMyRosterReady ? 'VIEW YOUR LOCKED ROSTER' : 'BUILD YOUR 20-MAN ROSTER'}</span>
              </button>

              {/* If League is Completed, show View Results button */}
              {league.status === 'completed' && (
                <button
                  id="lobby-view-results-btn"
                  onClick={onGoToSimulation}
                  className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] text-black hover:bg-amber-300 py-3.5 text-xs font-black uppercase tracking-widest shadow-lg transition-all cursor-pointer"
                >
                  <Trophy className="h-4 w-4" />
                  <span>VIEW DRAFT ORDER & RESULTS</span>
                </button>
              )}

              {/* Simulation Button (COMMISSIONER ONLY) */}
              {isCommissioner && league.status !== 'completed' && (
                <div>
                  <button
                    id="lobby-start-sim-btn"
                    onClick={handleStartSim}
                    disabled={!isAllReady}
                    className={`w-full flex items-center justify-center gap-2 rounded-sm py-3.5 text-xs font-black uppercase tracking-widest shadow-lg transition-all ${
                      isAllReady
                        ? 'bg-[#D4AF37] text-black hover:bg-amber-300 cursor-pointer shadow-[#D4AF37]/20'
                        : 'bg-[#1A1A1A] text-zinc-600 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>START {league.settings?.seasonGames || 16}-GAME SIMULATION</span>
                  </button>

                  {!isAllReady && (
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider text-center mt-2">
                      Waiting for {totalCount - readyCount} team(s) to submit their roster.
                    </p>
                  )}
                </div>
              )}

              {/* Non-Commissioner Simulation Status Notice */}
              {!isCommissioner && league.status !== 'completed' && (
                <div className="rounded-sm bg-[#1A1A1A] border border-white/10 p-3.5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    {isAllReady
                      ? `All rosters ready! Waiting for Commissioner ${league.commissionerName} to simulate the league season.`
                      : `Waiting for all ${totalCount} teams to submit rosters (${readyCount}/${totalCount} ready).`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Commissioner Tool Card */}
          {isCommissioner && (
            <div className="rounded-lg border border-white/5 bg-[#121212] p-5 shadow-xl">
              <h3 className="font-display text-sm font-black uppercase tracking-wider text-white mb-3 flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-[#D4AF37]" />
                <span>Commissioner Controls</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                {/* Auto-fill AI button if empty slots */}
                {slotsRemaining > 0 && (
                  <button
                    id="lobby-autofill-ai-btn"
                    onClick={() => autoFillLeagueWithAi(league.id)}
                    className="w-full flex items-center justify-center gap-2 rounded-sm border border-white/10 bg-[#1A1A1A] py-2.5 font-black uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>Auto-Fill {slotsRemaining} Empty Slots</span>
                  </button>
                )}

                {/* Change Cap */}
                <div className="rounded-sm bg-[#0A0A0A] p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Salary Cap</span>
                    <span className="font-black text-[#D4AF37] font-mono text-xs">${league.salaryCap}M</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={200}
                      max={400}
                      step={0.1}
                      value={newCapInput}
                      onChange={e => setNewCapInput(Number(e.target.value))}
                      className="w-20 rounded-sm border border-white/10 bg-[#1A1A1A] px-2 py-1 text-center font-mono text-xs text-white"
                    />
                    <button
                      onClick={() => updateSalaryCap(league.id, newCapInput)}
                      className="flex-1 rounded-sm bg-zinc-800 py-1 font-black uppercase tracking-wider text-zinc-200 hover:bg-zinc-700 text-[11px]"
                    >
                      Update Cap
                    </button>
                  </div>
                </div>

                <div className="rounded-sm bg-[#0A0A0A] p-3 border border-white/5 space-y-3">
                  <div className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Game Settings</div>
                  <label className="block">
                    <span className="text-[10px] text-zinc-400">League Season</span>
                    <select
                      value={league.settings?.seasonGames || 16}
                      onChange={e => updateLeagueSettings(league.id, { seasonGames: Number(e.target.value) as 16 | 17 })}
                      className="mt-1 w-full bg-[#1A1A1A] border border-white/10 p-2 text-xs"
                    >
                      <option value={16}>16 Games — Original Ball Knower</option>
                      <option value={17}>17 Games — NFL Length</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-zinc-400">Simulation Style</span>
                    <select
                      value={league.settings?.simulationStyle || 'realistic'}
                      onChange={e => updateLeagueSettings(league.id, { simulationStyle: e.target.value as any })}
                      className="mt-1 w-full bg-[#1A1A1A] border border-white/10 p-2 text-xs"
                    >
                      <option value="realistic">Realistic — Better roster wins more often</option>
                      <option value="balanced">Balanced — More upset potential</option>
                      <option value="chaos">Chaos — Maximum variance</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-zinc-400">AI Difficulty</span>
                    <select
                      value={league.settings?.aiDifficulty || 'all_pro'}
                      onChange={e => updateLeagueSettings(league.id, { aiDifficulty: e.target.value as any })}
                      className="mt-1 w-full bg-[#1A1A1A] border border-white/10 p-2 text-xs"
                    >
                      <option value="pro">Pro</option>
                      <option value="all_pro">All-Pro</option>
                      <option value="all_madden">All-Madden</option>
                    </select>
                  </label>
                </div>

                {/* Reset Simulation if previously simulated */}
                {league.status === 'completed' && (
                  <button
                    onClick={() => resetLeagueSimulation(league.id)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-sm border border-red-500/30 bg-red-500/10 py-2 text-red-400 hover:bg-red-500/20 transition-colors font-black uppercase tracking-wider text-[11px]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reset League & Re-Draft</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
