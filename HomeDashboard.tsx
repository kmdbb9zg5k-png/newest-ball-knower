import React from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import {
  Shield,
  Trophy,
  Users,
  Play,
  Sparkles,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { League } from '../types';

interface HomeDashboardProps {
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onSelectLeague: (league: League, tab: 'lobby' | 'draft' | 'simulation') => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onOpenCreateLeague,
  onOpenJoinLeague,
  onSelectLeague,
}) => {
  const { leagues, currentUser, startDemoMode } = useBallKnower();

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-16 bg-[#0A0A0A] text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/5 bg-[#121212] py-14 sm:py-20">
        <div className="relative mx-auto max-w-5xl px-4 sm:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-sm border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1 text-[11px] font-black uppercase tracking-widest text-[#D4AF37] mb-6">
            <Trophy className="h-3.5 w-3.5" />
            <span>FANTASY DRAFT ORDER CAP SIMULATOR</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl font-black tracking-tighter text-white sm:text-7xl lg:text-8xl uppercase">
            PROVE YOU <span className="text-[#D4AF37]">KNOW BALL.</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base font-bold uppercase tracking-widest text-zinc-400 leading-relaxed">
            Build the best 20-man roster under the $301.2M cap. Survive the league season. Earn your fantasy draft order.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button
              id="hero-create-league-btn"
              onClick={onOpenCreateLeague}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] px-6 py-4 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-[#D4AF37]/20 hover:bg-amber-300 transition-colors cursor-pointer"
            >
              <Shield className="h-4 w-4 fill-black" />
              <span>CREATE LEAGUE</span>
            </button>

            <button
              id="hero-join-league-btn"
              onClick={onOpenJoinLeague}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-sm border border-white/10 bg-[#1A1A1A] px-6 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-800 hover:border-white/20 transition-colors cursor-pointer"
            >
              <Users className="h-4 w-4 text-[#D4AF37]" />
              <span>JOIN LEAGUE</span>
            </button>
          </div>

          {/* Demo Button */}
          <div className="mt-4">
            <button
              id="hero-try-demo-btn"
              onClick={startDemoMode}
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-500 hover:text-[#D4AF37] px-3 py-1.5 rounded-sm transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>TRY DEMO — Test drive without sign up</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Philosophy Banner */}
          <div className="mt-10 mx-auto max-w-2xl rounded-lg border border-white/5 bg-[#0F0F0F] p-4 text-xs text-zinc-400">
            <p className="leading-relaxed font-bold">
              <strong className="text-white uppercase tracking-wider">The Ball Knower Principle:</strong> Everyone gets the exact same NFL players. Everyone gets the exact same $301.2M salary cap. Your positional valuation, balance, and football IQ determine who earns Pick #1.
            </p>
          </div>
        </div>
      </section>

      {/* User's Leagues Section */}
      <section className="mx-auto max-w-5xl px-4 sm:px-8 pt-10">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
          <div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#D4AF37]" />
              <span>YOUR LEAGUES</span>
            </h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">
              Active draft-order tournaments & simulations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateLeague}
              className="rounded-sm border border-white/10 bg-[#1A1A1A] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              + Create
            </button>
            <button
              onClick={onOpenJoinLeague}
              className="rounded-sm border border-white/10 bg-[#1A1A1A] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Join Code
            </button>
          </div>
        </div>

        {leagues.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-[#121212] p-10 text-center">
            <Shield className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
            <h3 className="text-base font-black uppercase text-white mb-1 tracking-wider">No Leagues Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 font-medium">
              Create a league for your fantasy group or enter a league code to compete for draft positions.
            </p>
            <button
              onClick={onOpenCreateLeague}
              className="inline-flex items-center gap-2 rounded-sm bg-[#D4AF37] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition-colors"
            >
              Create Your First League
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {leagues.map(league => {
              const myMember = league.members.find(m => m.userId === currentUser?.id);
              const isReady = myMember?.status === 'ready';
              const submittedCount = league.members.filter(m => m.status === 'ready').length;
              const isCompleted = league.status === 'completed';
              const userDraftPick = isCompleted && league.seasonResult
                ? league.seasonResult.draftOrder.find(d => d.memberId === myMember?.id)?.pickNumber
                : null;

              return (
                <div
                  key={league.id}
                  id={`league-card-${league.id}`}
                  className="group relative flex flex-col justify-between rounded-lg border border-white/5 bg-[#121212] p-5 hover:border-[#D4AF37]/50 transition-all shadow-md"
                >
                  <div>
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#D4AF37] bg-zinc-800 px-2 py-0.5 rounded-sm">
                            {league.code}
                          </span>
                          {league.commissionerId === currentUser?.id && (
                            <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[9px] font-black text-zinc-300 uppercase tracking-wider border border-white/5">
                              COMMISSIONER
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-xl font-black uppercase tracking-tight text-white mt-2 group-hover:text-[#D4AF37] transition-colors">
                          {league.name}
                        </h3>
                      </div>

                      {/* Status Pill */}
                      {isCompleted ? (
                        <div className="flex items-center gap-1 rounded-sm bg-[#00FF00]/10 border border-[#00FF00]/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#00FF00]">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Complete</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 rounded-sm bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">
                          <Clock className="h-3 w-3" />
                          <span>Drafting</span>
                        </div>
                      )}
                    </div>

                    {/* Stats bar */}
                    <div className="grid grid-cols-3 gap-2 rounded-sm bg-[#0A0A0A] p-3 border border-white/5 my-3 text-center">
                      <div>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Members</p>
                        <p className="text-sm font-black text-zinc-200 mt-0.5 font-mono">
                          {league.members.length}/{league.maxMembers}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Submitted</p>
                        <p className="text-sm font-black text-[#D4AF37] mt-0.5 font-mono">
                          {submittedCount}/{league.members.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Salary Cap</p>
                        <p className="text-sm font-black text-zinc-200 mt-0.5 font-mono">
                          ${league.salaryCap}M
                        </p>
                      </div>
                    </div>

                    {/* Final Pick result if completed */}
                    {isCompleted && userDraftPick && (
                      <div className="rounded-sm bg-[#1A1A1A] border border-[#D4AF37]/40 p-3 mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="h-5 w-5 text-[#D4AF37]" />
                          <div>
                            <p className="text-[9px] text-[#D4AF37] font-black uppercase tracking-wider">Your Final Result</p>
                            <p className="text-sm font-black text-white uppercase tracking-tight">
                              FANTASY PICK #{userDraftPick}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-[#D4AF37] uppercase">
                          {userDraftPick === 1 ? '👑 1st Pick' : `#${userDraftPick} Pick`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                    {isCompleted ? (
                      <button
                        onClick={() => onSelectLeague(league, 'simulation')}
                        className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] py-2.5 text-xs font-black uppercase tracking-widest text-black hover:bg-amber-300 transition-all"
                      >
                        <Award className="h-3.5 w-3.5" />
                        <span>View Final Draft Order</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onSelectLeague(league, 'lobby')}
                          className="flex-1 rounded-sm border border-white/10 bg-[#1A1A1A] py-2 text-xs font-black uppercase tracking-wider text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                          Lobby ({submittedCount}/{league.members.length})
                        </button>
                        <button
                          onClick={() => onSelectLeague(league, 'draft')}
                          className="flex-1 flex items-center justify-center gap-1 rounded-sm bg-white text-black hover:bg-[#D4AF37] py-2 text-xs font-black uppercase tracking-wider transition-colors"
                        >
                          <Shield className="h-3 w-3" />
                          <span>{isReady ? 'Edit Roster' : 'Build Team'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* How It Works Explainer */}
      <section className="mx-auto max-w-5xl px-4 sm:px-8 pt-16">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white">HOW BALL KNOWER WORKS</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Simple, transparent, and built on real football logic</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/5 bg-[#121212] p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-zinc-800 text-[#D4AF37] font-black font-mono text-sm mb-3">
              01
            </div>
            <h3 className="font-display text-base font-black uppercase tracking-tight text-white mb-1.5">
              Build Under The Cap
            </h3>
            <p className="text-xs text-zinc-400 font-medium leading-relaxed">
              Every fantasy owner drafts a 20-man NFL team (10 offense, 10 defense) under the identical $301.2M salary cap from the active NFL player pool.
            </p>
          </div>

          <div className="rounded-lg border border-white/5 bg-[#121212] p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-zinc-800 text-[#D4AF37] font-black font-mono text-sm mb-3">
              02
            </div>
            <h3 className="font-display text-base font-black uppercase tracking-tight text-white mb-1.5">
              League Simulation
            </h3>
            <p className="text-xs text-zinc-400 font-medium leading-relaxed">
              The engine simulates a full league head-to-head season. It rewards pass protection, trench dominance, defensive synergy, and penalizes flaws.
            </p>
          </div>

          <div className="rounded-lg border border-white/5 bg-[#121212] p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-zinc-800 text-[#D4AF37] font-black font-mono text-sm mb-3">
              03
            </div>
            <h3 className="font-display text-base font-black uppercase tracking-tight text-white mb-1.5">
              Earn Draft Order
            </h3>
            <p className="text-xs text-zinc-400 font-medium leading-relaxed">
              The #1 team in Ball Knower standings earns the #1 overall pick in your real fantasy football draft. 2nd place gets Pick #2, and so on.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
