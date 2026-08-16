import React, { useState, useEffect } from 'react';
import { League, SeasonResult, TeamReportAnalysis, SimulationGame } from '../types';
import { useBallKnower } from '../context/BallKnowerContext';
import { generateTeamReport } from '../utils/evaluation';
import { RosterComparisonModal } from './RosterComparisonModal';
import {
  Trophy,
  Award,
  Crown,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Flame,
  TrendingUp,
  Share2,
  Check,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SimulationViewProps {
  league: League;
  onBackToLobby: () => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({ league, onBackToLobby }) => {
  const { currentUser, showToast } = useBallKnower();
  const seasonResult = league.seasonResult;

  const [activeTab, setActiveTab] = useState<'draft_order' | 'standings' | 'report_card' | 'schedule'>('draft_order');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [copiedDraftOrder, setCopiedDraftOrder] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Trigger celebration confetti on mount
  useEffect(() => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FBBF24', '#F59E0B', '#10B981', '#FFFFFF'],
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  if (!seasonResult) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Trophy className="mx-auto h-12 w-12 text-gray-600 mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">No Simulation Data Available</h2>
        <p className="text-xs text-gray-400 mb-6">
          This league has not been simulated yet. Complete all rosters in the lobby and run the simulation.
        </p>
        <button
          onClick={onBackToLobby}
          className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-black hover:bg-amber-300"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  // Find user's member object & report card
  const myMember = league.members.find(m => m.userId === currentUser?.id);
  const myStanding = seasonResult.standings.find(s => s.memberId === myMember?.id);
  const myDraftPick = seasonResult.draftOrder.find(d => d.memberId === myMember?.id);

  const myReport: TeamReportAnalysis | null = myMember?.roster
    ? (seasonResult.teamReports[myMember.id] || generateTeamReport(myMember.id, myMember.userName, myMember.roster))
    : null;

  // Winner info
  const winner = seasonResult.standings[0];
  const winnerMember = league.members.find(m => m.id === winner.memberId);

  const handleCopyDraftOrder = () => {
    const text = `🏆 BALL KNOWER FANTASY DRAFT ORDER (${league.name})\n` +
      seasonResult.draftOrder
        .map(d => `Pick #${d.pickNumber}: ${d.memberName} (${d.record}, ${d.teamRating} OVR)`)
        .join('\n') +
      `\n\nSimulated via Ball Knower NFL Cap Engine`;

    navigator.clipboard.writeText(text);
    setCopiedDraftOrder(true);
    showToast('Copied fantasy draft order to clipboard!');
    setTimeout(() => setCopiedDraftOrder(false), 2500);
  };

  // Group games by week
  const weeklyGames = seasonResult.games.filter(g => g.week === selectedWeek);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 sm:px-8 bg-[#0A0A0A] text-white">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <button
          id="sim-back-to-lobby-btn"
          onClick={onBackToLobby}
          className="flex items-center gap-2 rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        >
          <span>← Back to Lobby</span>
        </button>
        <span className="font-mono text-xs font-black text-[#D4AF37] uppercase tracking-wider">
          {league.name} • League Results
        </span>
      </div>

      {/* 1. WINNER BANNER & PODIUM */}
      <div className="relative overflow-hidden rounded-lg border border-[#D4AF37]/40 bg-[#121212] p-6 sm:p-8 shadow-2xl mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-sm border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-[#D4AF37] mb-3">
              <Crown className="h-3.5 w-3.5" />
              <span>16-GAME SIMULATION CHAMPION & #1 OVERALL PICK</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-white">
              {winner.memberName} <span className="text-[#D4AF37]">WINS PICK #1!</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-mono uppercase tracking-wider font-bold">
              Record: {winner.wins}-{winner.losses} ({Math.round(winner.winPercentage * 100)}%) • {winner.pointDifferential > 0 ? `+${winner.pointDifferential}` : winner.pointDifferential} Point Diff • {winner.teamRating} OVR
            </p>
          </div>

          {/* Winner Avatar / Trophy Badge */}
          <div className="flex items-center gap-3 bg-[#0A0A0A] rounded-lg border border-[#D4AF37]/40 p-4 shadow-xl">
            <div className="relative">
              <img
                src={winnerMember?.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                alt={winner.memberName}
                className="h-16 w-16 rounded-sm object-cover border-2 border-[#D4AF37]"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-sm bg-[#D4AF37] text-black font-black text-xs shadow-md">
                👑
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-[#D4AF37] uppercase tracking-widest">Fantasy Draft</p>
              <p className="text-2xl font-black text-white font-mono">PICK #1</p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{winnerMember?.aiArchetype || 'League GM'}</p>
            </div>
          </div>
        </div>

        {/* Why Winner Won Explanations */}
        <div className="mt-6 pt-5 border-t border-white/5 grid gap-2 sm:grid-cols-3">
          {seasonResult.winnerAnalysis.keyFactors.slice(0, 3).map((factor, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-sm bg-[#1A1A1A] border border-white/5 p-3 text-xs text-zinc-300 font-medium"
            >
              <Sparkles className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <span>{factor}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. TAB CONTROLS & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-sm border border-white/5 bg-[#121212] p-1 w-full sm:w-auto overflow-x-auto">
          <button
            id="sim-tab-draft-order"
            onClick={() => setActiveTab('draft_order')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-sm px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'draft_order'
                ? 'bg-[#D4AF37] text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Draft Order</span>
          </button>

          <button
            id="sim-tab-standings"
            onClick={() => setActiveTab('standings')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-sm px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'standings'
                ? 'bg-[#D4AF37] text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Standings</span>
          </button>

          <button
            id="sim-tab-report-card"
            onClick={() => setActiveTab('report_card')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-sm px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'report_card'
                ? 'bg-[#D4AF37] text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>GM Report Card</span>
          </button>

          <button
            id="sim-tab-schedule"
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-sm px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'schedule'
                ? 'bg-[#D4AF37] text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Game Log</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            id="sim-compare-rosters-btn"
            onClick={() => setIsCompareModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-sm border border-white/10 bg-[#1A1A1A] px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <Layers className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>Compare Rosters</span>
          </button>

          <button
            id="sim-share-order-btn"
            onClick={handleCopyDraftOrder}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-sm bg-[#D4AF37] px-4 py-2 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition-colors"
          >
            {copiedDraftOrder ? <Check className="h-3.5 w-3.5 text-black" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copiedDraftOrder ? 'COPIED!' : 'SHARE ORDER'}</span>
          </button>
        </div>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: DRAFT ORDER BOARD */}
      {activeTab === 'draft_order' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-lg border border-white/5 bg-[#121212] p-6 shadow-xl">
            <h3 className="font-display text-2xl font-black uppercase tracking-tight text-white mb-1 flex items-center gap-2">
              <Award className="h-5 w-5 text-[#D4AF37]" />
              <span>OFFICIAL FANTASY DRAFT ORDER</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-6 font-medium">
              Use this exact order in your real fantasy football draft (ESPN, Sleeper, Yahoo).
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {seasonResult.draftOrder.map(pick => {
                const member = league.members.find(m => m.id === pick.memberId);
                const isMe = member?.userId === currentUser?.id;

                return (
                  <div
                    key={pick.pickNumber}
                    className={`flex items-center justify-between rounded-lg border p-4 transition-all ${
                      pick.pickNumber === 1
                        ? 'border-[#D4AF37] bg-[#1A1A1A]'
                        : isMe
                        ? 'border-[#D4AF37]/40 bg-[#1A1A1A]'
                        : 'border-white/5 bg-[#121212]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Pick Badge */}
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm font-mono text-base font-black ${
                          pick.pickNumber === 1
                            ? 'bg-[#D4AF37] text-black shadow-md'
                            : 'bg-[#0A0A0A] border border-white/10 text-white'
                        }`}
                      >
                        #{pick.pickNumber}
                      </div>

                      <img
                        src={member?.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80'}
                        alt={pick.memberName}
                        className="h-10 w-10 rounded-full object-cover border border-white/10"
                        referrerPolicy="no-referrer"
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black uppercase text-white">
                            {pick.memberName}
                          </p>
                          {isMe && (
                            <span className="rounded-sm bg-[#D4AF37]/20 px-1.5 py-0.2 text-[9px] font-black text-[#D4AF37] uppercase tracking-wider">
                              YOU
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5 font-bold uppercase">
                          {pick.record} • {pick.teamRating} OVR
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-mono text-sm font-black uppercase ${
                          pick.pickNumber === 1 ? 'text-[#D4AF37]' : 'text-zinc-400'
                        }`}
                      >
                        PICK #{pick.pickNumber}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STANDINGS */}
      {activeTab === 'standings' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-lg border border-white/5 bg-[#121212] shadow-xl overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <h3 className="font-display text-2xl font-black uppercase tracking-tight text-white">
                16-GAME REGULAR SEASON STANDINGS
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Sorted by Win Percentage, Point Differential (+/-), Points For, and Team Rating
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0A0A0A] text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-white/5">
                  <tr>
                    <th className="py-3.5 pl-5 pr-2">Rank</th>
                    <th className="py-3.5 px-3">Team / GM</th>
                    <th className="py-3.5 px-3 text-center">W-L</th>
                    <th className="py-3.5 px-3 text-center">Win %</th>
                    <th className="py-3.5 px-3 text-center">PF</th>
                    <th className="py-3.5 px-3 text-center">PA</th>
                    <th className="py-3.5 px-3 text-center">Diff</th>
                    <th className="py-3.5 px-3 text-center">Rating</th>
                    <th className="py-3.5 px-3 text-center">Ball Knower</th>
                    <th className="py-3.5 pr-5 text-right">Draft Pick</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {seasonResult.standings.map(row => {
                    const member = league.members.find(m => m.id === row.memberId);
                    const isMe = member?.userId === currentUser?.id;

                    return (
                      <tr
                        key={row.memberId}
                        className={`hover:bg-[#1A1A1A] transition-colors ${
                          isMe ? 'bg-[#1A1A1A]' : ''
                        }`}
                      >
                        <td className="py-3.5 pl-5 pr-2 font-mono font-black text-zinc-400">
                          {row.rank === 1 ? '👑 1' : row.rank}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={member?.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                              alt={row.memberName}
                              className="h-8 w-8 rounded-full object-cover border border-white/10"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <span className="font-black uppercase text-white block">
                                {row.memberName}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                {member?.aiArchetype || 'Fantasy GM'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-black text-white">
                          {row.wins}-{row.losses}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-zinc-300 font-bold">
                          .{Math.round(row.winPercentage * 1000)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-zinc-300 font-bold">
                          {row.pointsFor}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-zinc-400 font-bold">
                          {row.pointsAgainst}
                        </td>
                        <td
                          className={`py-3.5 px-3 text-center font-mono font-black ${
                            row.pointDifferential > 0 ? 'text-[#00FF00]' : 'text-red-400'
                          }`}
                        >
                          {row.pointDifferential > 0 ? `+${row.pointDifferential}` : row.pointDifferential}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-black text-[#D4AF37]">
                          {row.teamRating}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-black text-white">
                          {row.ballKnowerScore ?? '--'}
                        </td>
                        <td className="py-3.5 pr-5 text-right font-mono font-black text-white">
                          #{row.rank}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GM REPORT CARD */}
      {activeTab === 'report_card' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {myReport ? (
            <div className="space-y-6">
              {/* Overall Grade Card */}
              <div className="rounded-lg border border-white/5 bg-[#121212] p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">
                    Front-Office Evaluation
                  </span>
                  <h3 className="font-display text-3xl font-black uppercase tracking-tight text-white mt-1">
                    YOUR GM REPORT CARD
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1 max-w-lg font-medium leading-relaxed">
                    {myStanding?.rank === 1
                      ? 'Championship Construction: Your roster balanced trench dominance, secondary coverage, and passing execution to claim Pick #1!'
                      : `Finished #${myStanding?.rank} in the league simulation. Review your position group grades and cap analysis below.`}
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-[#0A0A0A] px-6 py-4 rounded-sm border border-white/5">
                  <div className="text-center">
                    <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Team OVR</p>
                    <p className="font-mono text-4xl font-black text-[#D4AF37]">{myReport.teamRatings.overall}</p>
                  </div>
                  <div className="border-l border-white/10 pl-4 text-center">
                    <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Fantasy Pick</p>
                    <p className="font-mono text-4xl font-black text-white">#{myDraftPick?.pickNumber || myStanding?.rank}</p>
                  </div>
                </div>
              </div>

              {/* Positional Group Grades */}
              <div className="rounded-lg border border-white/5 bg-[#121212] p-6 shadow-xl">
                <h4 className="font-display text-base font-black uppercase tracking-tight text-white mb-4">
                  Positional Group Breakdown
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {myReport.positionGrades.map((pg, i) => (
                    <div key={i} className="rounded-sm bg-[#0A0A0A] p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-400">{pg.position}</span>
                        <span className="font-mono text-xl font-black text-[#D4AF37]">{pg.grade}</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium leading-relaxed">{pg.comment}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best Value, Worst Value, What Cost You */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Best Value */}
                <div className="rounded-lg border border-[#00FF00]/30 bg-[#121212] p-5">
                  <div className="flex items-center gap-2 mb-2 text-[#00FF00] font-black text-xs uppercase tracking-wider">
                    <TrendingUp className="h-4 w-4" />
                    <span>BEST VALUE DRAFT PICK</span>
                  </div>
                  <p className="text-sm font-black uppercase text-white">{myReport.bestValuePick.player.name} (${myReport.bestValuePick.player.salary}M)</p>
                  <p className="text-xs text-zinc-400 mt-1 font-medium">{myReport.bestValuePick.reason}</p>
                </div>

                {/* Worst Value */}
                <div className="rounded-lg border border-[#D4AF37]/30 bg-[#121212] p-5">
                  <div className="flex items-center gap-2 mb-2 text-[#D4AF37] font-black text-xs uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4" />
                    <span>CAP OVERPAY ANALYSIS</span>
                  </div>
                  <p className="text-sm font-black uppercase text-white">{myReport.worstValuePick.player.name} (${myReport.worstValuePick.player.salary}M)</p>
                  <p className="text-xs text-zinc-400 mt-1 font-medium">{myReport.worstValuePick.reason}</p>
                </div>

                {/* What Cost You */}
                <div className="rounded-lg border border-red-500/30 bg-[#121212] p-5">
                  <div className="flex items-center gap-2 mb-2 text-red-400 font-black text-xs uppercase tracking-wider">
                    <Flame className="h-4 w-4" />
                    <span>CRITICAL ROSTER FACTOR</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    {myReport.whatCostYou.join(' ') || myReport.biggestWeakness}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/5 bg-[#121212] p-8 text-center text-zinc-400">
              Report card is available when you submit your own roster.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WEEKLY GAME LOG */}
      {activeTab === 'schedule' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-lg border border-white/5 bg-[#121212] p-6 shadow-xl">
            {/* Week Selector */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2 pb-3 border-b border-white/5">
              <h3 className="font-display text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#D4AF37]" />
                <span>16-WEEK SCHEDULE & MATCHUP LOGS</span>
              </h3>

              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 no-scrollbar">
                {Array.from({ length: 16 }, (_, i) => i + 1).map(wk => (
                  <button
                    key={wk}
                    onClick={() => setSelectedWeek(wk)}
                    className={`rounded-sm px-2.5 py-1 font-mono text-xs font-black uppercase transition-all ${
                      selectedWeek === wk
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#1A1A1A] text-zinc-400 hover:text-white'
                    }`}
                  >
                    W{wk}
                  </button>
                ))}
              </div>
            </div>

            {/* Games for Selected Week */}
            <div className="space-y-3">
              {weeklyGames.map(game => {
                const homeMember = league.members.find(m => m.id === game.homeMemberId);
                const awayMember = league.members.find(m => m.id === game.awayMemberId);

                return (
                  <div
                    key={game.id}
                    className="rounded-sm border border-white/5 bg-[#0A0A0A] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Home Team */}
                      <div className="flex items-center gap-2 min-w-[130px]">
                        <span className={`text-xs font-black uppercase ${game.winnerId === game.homeMemberId ? 'text-[#D4AF37]' : 'text-zinc-300'}`}>
                          {homeMember?.userName || 'Home'}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-2 bg-[#1A1A1A] px-3 py-1 rounded-sm border border-white/5 font-mono text-sm font-black text-white">
                        <span>{game.homeScore}</span>
                        <span className="text-zinc-500">-</span>
                        <span>{game.awayScore}</span>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center gap-2 min-w-[130px]">
                        <span className={`text-xs font-black uppercase ${game.winnerId === game.awayMemberId ? 'text-[#D4AF37]' : 'text-zinc-300'}`}>
                          {awayMember?.userName || 'Away'}
                        </span>
                      </div>
                    </div>

                    {/* Decisive Football Factor */}
                    <div className="text-xs text-zinc-400 sm:text-right max-w-sm">
                      <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block">Key Factor</span>
                      <span className="font-medium">{game.keyMatchupFactor}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Roster Comparison Modal */}
      <RosterComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        members={league.members}
        draftOrder={seasonResult.draftOrder}
      />
    </div>
  );
};
