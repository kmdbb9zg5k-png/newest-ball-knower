import React, { useState, useEffect } from 'react';
import { League, TeamReportAnalysis } from './types';
import { useBallKnower } from './BallKnowerContext';
import { generateTeamReport } from './evaluation';
import { RosterComparisonModal } from './RosterComparisonModal';
import {
  Trophy,
  Award,
  Crown,
  Shield,
  AlertTriangle,
  Flame,
  TrendingUp,
  Share2,
  Check,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  Play,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getLeagueCommissionerName, isLeagueCommissioner } from './leaguePermissions';
import { displayLeagueMemberName, resolveMyLeagueMember } from './leagueMemberDisplay';
import { canStartScheduledDraft, formatDraftSchedule } from './draftSchedule';
import { FantasyDraftFormatWorkspace } from './FantasyDraftFormatWorkspace';

interface SimulationViewProps {
  league: League;
  onBackToLobby: () => void;
  onOpenDraft: () => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({ league, onBackToLobby, onOpenDraft }) => {
  const { currentUser, startLiveFantasyDraft, showToast } = useBallKnower();
  const seasonResult = league.seasonResult;

  const [activeTab, setActiveTab] = useState<'draft_order' | 'standings' | 'report_card' | 'schedule'>('draft_order');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [copiedDraftOrder, setCopiedDraftOrder] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [openingDraft, setOpeningDraft] = useState(false);
  const scheduledDraftLabel = formatDraftSchedule(league);
  const draftStartOpen = canStartScheduledDraft(league);
  const specialDraftFormat=['offline','mock','auction'].includes(league.settings?.draftFormat||'');

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
  const myMember = resolveMyLeagueMember(league, currentUser);
  const myStanding = seasonResult.standings.find(s => s.memberId === myMember?.id);
  const myDraftPick = seasonResult.draftOrder.find(d => d.memberId === myMember?.id);

  const myReport: TeamReportAnalysis | null = myMember?.roster
    ? (seasonResult.teamReports[myMember.id] || generateTeamReport(myMember.id, myMember.userName, myMember.roster))
    : null;

  const handleCopyDraftOrder = () => {
    const orderOnly=seasonResult.orderMethod==='random'||seasonResult.orderMethod==='commissioner';
    const text = `🏆 BALL KNOWER FANTASY DRAFT ORDER (${league.name})\n` +
      seasonResult.draftOrder
        .map((d,index) => {
          const member=league.members.find(item=>item.id===d.memberId);
          const name=displayLeagueMemberName(member,member?.id===myMember?.id,currentUser,index);
          return orderOnly?`Pick #${d.pickNumber}: ${name}`:`Pick #${d.pickNumber}: ${name} (${d.record}, ${d.teamRating} OVR)`;
        })
        .join('\n') +
      `\n\nSet with Ball Knower · ${seasonResult.orderMethod==='random'?'Random Draw':seasonResult.orderMethod==='commissioner'?'Commissioner Assignment':'Draft Order Game'}`;

    navigator.clipboard.writeText(text);
    setCopiedDraftOrder(true);
    showToast('Copied fantasy draft order to clipboard!');
    setTimeout(() => setCopiedDraftOrder(false), 2500);
  };

  const handleOpenDraft=async()=>{
    if(league.liveDraft?.status==='completed'){
      showToast('This fantasy draft is complete. Your roster is already saved.');
      onBackToLobby();
      return;
    }
    if(league.liveDraft){onOpenDraft();return;}
    if(openingDraft)return;
    setOpeningDraft(true);
    const started=await startLiveFantasyDraft(league.id);
    if(started)onOpenDraft();
    else setOpeningDraft(false);
  };

  if(seasonResult.orderMethod==='random'||seasonResult.orderMethod==='commissioner'){
    const random=seasonResult.orderMethod==='random';
    const canManageDraft=isLeagueCommissioner(league,currentUser?.id);
    const commissionerName=getLeagueCommissionerName(league);
    return <div className="min-h-[calc(100dvh-7rem)] bg-[#0A0A0A] px-3 py-4 text-white sm:px-8 sm:py-8"><div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between gap-3"><button onClick={onBackToLobby} className="min-h-10 rounded-xl border border-white/10 px-3 text-[10px] font-black uppercase">← League HQ</button><div className="truncate text-right text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">{league.name}</div></div>
      <section className="rounded-2xl border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_85%_10%,rgba(212,175,55,.18),transparent_30%),#101318] p-4 sm:p-7"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#D4AF37] text-black">{random?<RotateCcw className="h-5 w-5"/>:<Award className="h-5 w-5"/>}</div><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Official Fantasy Draft Order</div><h1 className="mt-1 font-display text-3xl font-black uppercase sm:text-5xl">{random?'Random Draw Complete':'Commissioner Order Locked'}</h1><p className="mt-2 text-xs leading-5 text-zinc-400 sm:text-sm">{random?'Every team received one equal chance. This locked order determines where each manager drafts NFL players.':'The commissioner assigned every team exactly one slot. This locked order determines where each manager drafts NFL players.'}</p></div></div>
        <div className="mt-4 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">{seasonResult.draftOrder.map((pick,index)=>{const member=league.members.find(item=>item.id===pick.memberId);const mine=member?.id===myMember?.id;const role=mine?(member?.isCommissioner?'You · Commissioner':'You'):member?.isAi?'CPU':member?.isCommissioner?'Commissioner':'Manager';const displayName=displayLeagueMemberName(member,mine,currentUser,index);return <div key={pick.memberId} className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 ${pick.pickNumber===1?'border-[#D4AF37] bg-[#D4AF37]/10':mine?'border-[#D4AF37]/40 bg-[#D4AF37]/5':'border-white/10 bg-black/30'}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black ${pick.pickNumber===1?'bg-[#D4AF37] text-black':'border border-white/10 bg-[#0A0A0A]'}`}>#{pick.pickNumber}</div><div className="min-w-0"><div className="truncate text-xs font-black uppercase">{displayName}</div><div className="text-[9px] font-bold uppercase text-zinc-500">{role}</div></div></div>})}</div>
        {scheduledDraftLabel&&<div className="mt-4 flex items-center gap-3 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[.06] p-3"><Calendar className="h-5 w-5 shrink-0 text-[#D4AF37]"/><div><div className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Scheduled Draft</div><div className="mt-1 text-xs font-black text-white">{scheduledDraftLabel}</div></div></div>}
        {!league.liveDraft&&!canManageDraft&&<p className="mt-4 text-center text-[10px] font-bold text-zinc-500">Waiting for {commissionerName} to start the NFL player draft.</p>}
        {!specialDraftFormat&&<div className="mt-2 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2"><button onClick={()=>void handleOpenDraft()} disabled={openingDraft||(!league.liveDraft&&!canManageDraft)} className="min-h-12 rounded-xl bg-[#D4AF37] px-3 text-[10px] font-black uppercase tracking-wider text-black disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-white/[.04] disabled:text-zinc-500"><Play className="mr-1 inline h-4 w-4"/>{openingDraft?'Opening Draft…':league.liveDraft?.status==='completed'?'Continue to Season':league.liveDraft?'Resume NFL Player Draft':canManageDraft?(draftStartOpen?'Continue to NFL Player Draft':'Draft Scheduled'):`Waiting for ${commissionerName}`}</button><button onClick={handleCopyDraftOrder} className="min-h-12 rounded-xl border border-white/10 px-3 text-[10px] font-black uppercase tracking-wider">{copiedDraftOrder?<Check className="mr-1 inline h-4 w-4"/>:<Share2 className="mr-1 inline h-4 w-4"/>}{copiedDraftOrder?'Order Copied':'Share Order'}</button></div>}
        {specialDraftFormat&&(league.settings?.draftFormat==='mock'||canManageDraft)&&<FantasyDraftFormatWorkspace league={league} onImported={onBackToLobby}/>}
      </section>
    </div></div>;
  }

  // Winner info for the Draft Order Game.
  const winner = seasonResult.standings[0];
  const winnerMember = league.members.find(m => m.id === winner.memberId);

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
        <span className="font-mono text-xs font-black text-[var(--bk-team-accent)] uppercase tracking-wider">
          {league.name} • League Results
        </span>
      </div>

      {/* 1. WINNER BANNER & PODIUM */}
      <div className="relative mb-4 overflow-hidden rounded-xl border border-[var(--bk-team-accent)]/40 bg-[#121212] p-4 shadow-2xl sm:mb-8 sm:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-sm border border-[var(--bk-team-accent)]/30 bg-[var(--bk-team-accent)]/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-[var(--bk-team-accent)] mb-3">
              <Crown className="h-3.5 w-3.5" />
              <span>{league.settings?.seasonGames||17}-GAME SIMULATION CHAMPION & #1 OVERALL PICK</span>
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
              {winner.memberName} <span className="text-[var(--bk-team-accent)]">WINS PICK #1!</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-mono uppercase tracking-wider font-bold">
              Record: {winner.wins}-{winner.losses} ({Math.round(winner.winPercentage * 100)}%) • {winner.pointDifferential > 0 ? `+${winner.pointDifferential}` : winner.pointDifferential} Point Diff • {winner.teamRating} OVR
            </p>
          </div>

          {/* Winner Avatar / Trophy Badge */}
          <div className="flex items-center gap-3 bg-[#0A0A0A] rounded-lg border border-[var(--bk-team-accent)]/40 p-4 shadow-xl">
            <div className="relative">
              <img
                src={winnerMember?.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                alt={winner.memberName}
                className="h-16 w-16 rounded-sm object-cover border-2 border-[var(--bk-team-accent)]"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-sm bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] font-black text-xs shadow-md">
                👑
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-[var(--bk-team-accent)] uppercase tracking-widest">Fantasy Draft</p>
              <p className="text-2xl font-black text-white font-mono">PICK #1</p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{winnerMember?.aiArchetype || 'League GM'}</p>
            </div>
          </div>
        </div>

        {/* Why Winner Won Explanations */}
        <details className="mt-4 border-t border-white/5 pt-3"><summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-[var(--bk-team-accent)]">Why this roster won</summary><div className="mt-3 grid gap-2 sm:grid-cols-3">{seasonResult.winnerAnalysis.keyFactors.slice(0,3).map((factor,idx)=><div key={idx} className="flex items-start gap-2 rounded-lg border border-white/5 bg-[#1A1A1A] p-3 text-xs text-zinc-300"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bk-team-accent)]"/><span>{factor}</span></div>)}</div></details>
      </div>

      {/* 2. TAB CONTROLS & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        {/* Navigation Tabs */}
        <div className="grid w-full grid-cols-4 gap-1 rounded-xl border border-white/5 bg-[#121212] p-1 sm:flex sm:w-auto">
          <button
            id="sim-tab-draft-order"
            onClick={() => setActiveTab('draft_order')}
            className={`min-w-0 flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-[9px] font-black uppercase tracking-wide transition-all sm:gap-1.5 sm:px-4 sm:text-xs sm:tracking-wider ${
              activeTab === 'draft_order'
                ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Draft Order</span>
          </button>

          <button
            id="sim-tab-standings"
            onClick={() => setActiveTab('standings')}
            className={`min-w-0 flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-[9px] font-black uppercase tracking-wide transition-all sm:gap-1.5 sm:px-4 sm:text-xs sm:tracking-wider ${
              activeTab === 'standings'
                ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Standings</span>
          </button>

          <button
            id="sim-tab-report-card"
            onClick={() => setActiveTab('report_card')}
            className={`min-w-0 flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-[9px] font-black uppercase tracking-wide transition-all sm:gap-1.5 sm:px-4 sm:text-xs sm:tracking-wider ${
              activeTab === 'report_card'
                ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="sm:hidden">GM Card</span><span className="hidden sm:inline">GM Report Card</span>
          </button>

          <button
            id="sim-tab-schedule"
            onClick={() => setActiveTab('schedule')}
            className={`min-w-0 flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-[9px] font-black uppercase tracking-wide transition-all sm:gap-1.5 sm:px-4 sm:text-xs sm:tracking-wider ${
              activeTab === 'schedule'
                ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span className="sm:hidden">Games</span><span className="hidden sm:inline">Game Log</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
          {!specialDraftFormat && <button
            id="sim-open-draft-btn"
            onClick={() => void handleOpenDraft()}
            disabled={!league.liveDraft && !isLeagueCommissioner(league,currentUser?.id)}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-sm bg-[var(--bk-team-accent)] px-2 py-2 text-[10px] font-black uppercase tracking-wide text-[var(--bk-on-accent)] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-xs sm:tracking-wider"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{league.liveDraft ? 'Open Draft' : isLeagueCommissioner(league,currentUser?.id) ? 'Start Draft' : 'Waiting'}</span>
          </button>}

          <button
            id="sim-compare-rosters-btn"
            onClick={() => setIsCompareModalOpen(true)}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-sm border border-white/10 bg-[#1A1A1A] px-2 py-2 text-[10px] font-black uppercase tracking-wide text-zinc-200 transition-colors hover:bg-zinc-800 sm:px-4 sm:text-xs sm:tracking-wider"
          >
            <Layers className="h-3.5 w-3.5 text-[var(--bk-team-accent)]" />
            <span>Rosters</span>
          </button>

          <button
            id="sim-share-order-btn"
            onClick={handleCopyDraftOrder}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-sm border border-white/10 bg-[#1A1A1A] px-2 py-2 text-[10px] font-black uppercase tracking-wide text-zinc-200 transition-colors hover:bg-zinc-800 sm:px-4 sm:text-xs sm:tracking-wider"
          >
            {copiedDraftOrder ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copiedDraftOrder ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      {specialDraftFormat&&(league.settings?.draftFormat==='mock'||isLeagueCommissioner(league,currentUser?.id))&&<FantasyDraftFormatWorkspace league={league} onImported={onBackToLobby}/>}

      {/* 3. TAB CONTENT */}

      {/* TAB 1: DRAFT ORDER BOARD */}
      {activeTab === 'draft_order' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-lg border border-white/5 bg-[#121212] p-6 shadow-xl">
            <h3 className="font-display text-2xl font-black uppercase tracking-tight text-white mb-1 flex items-center gap-2">
              <Award className="h-5 w-5 text-[var(--bk-team-accent)]" />
              <span>OFFICIAL FANTASY DRAFT ORDER</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-6 font-medium">
              Use this exact order in your real fantasy football draft (ESPN, Sleeper, Yahoo).
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {seasonResult.draftOrder.map((pick,index) => {
                const member = league.members.find(m => m.id === pick.memberId);
                const isMe = member?.id === myMember?.id;
                const displayName = displayLeagueMemberName(member, isMe, currentUser, index);

                return (
                  <div
                    key={pick.pickNumber}
                    className={`flex items-center justify-between rounded-lg border p-4 transition-all ${
                      pick.pickNumber === 1
                        ? 'border-[var(--bk-team-accent)] bg-[#1A1A1A]'
                        : isMe
                        ? 'border-[var(--bk-team-accent)]/40 bg-[#1A1A1A]'
                        : 'border-white/5 bg-[#121212]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Pick Badge */}
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm font-mono text-base font-black ${
                          pick.pickNumber === 1
                            ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)] shadow-md'
                            : 'bg-[#0A0A0A] border border-white/10 text-white'
                        }`}
                      >
                        #{pick.pickNumber}
                      </div>

                      <img
                        src={member?.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80'}
                        alt={displayName}
                        className="h-10 w-10 rounded-full object-cover border border-white/10"
                        referrerPolicy="no-referrer"
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black uppercase text-white">
                            {displayName}
                          </p>
                          {isMe && (
                            <span className="rounded-sm bg-[var(--bk-team-accent)]/20 px-1.5 py-0.2 text-[9px] font-black text-[var(--bk-team-accent)] uppercase tracking-wider">
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
                          pick.pickNumber === 1 ? 'text-[var(--bk-team-accent)]' : 'text-zinc-400'
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
                {league.settings?.seasonGames||17}-GAME REGULAR SEASON STANDINGS
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
                        <td className="py-3.5 px-3 text-center font-mono font-black text-[var(--bk-team-accent)]">
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
                  <span className="text-[10px] font-black text-[var(--bk-team-accent)] uppercase tracking-widest">
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
                    <p className="font-mono text-4xl font-black text-[var(--bk-team-accent)]">{myReport.teamRatings.overall}</p>
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
                        <span className="font-mono text-xl font-black text-[var(--bk-team-accent)]">{pg.grade}</span>
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
                <div className="rounded-lg border border-[var(--bk-team-accent)]/30 bg-[#121212] p-5">
                  <div className="flex items-center gap-2 mb-2 text-[var(--bk-team-accent)] font-black text-xs uppercase tracking-wider">
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
                <Calendar className="h-4 w-4 text-[var(--bk-team-accent)]" />
                <span>{league.settings?.seasonGames||17}-WEEK SCHEDULE & MATCHUP LOGS</span>
              </h3>

              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 no-scrollbar">
                {Array.from({ length: league.settings?.seasonGames||17 }, (_, i) => i + 1).map(wk => (
                  <button
                    key={wk}
                    onClick={() => setSelectedWeek(wk)}
                    className={`rounded-sm px-2.5 py-1 font-mono text-xs font-black uppercase transition-all ${
                      selectedWeek === wk
                        ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]'
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
                        <span className={`text-xs font-black uppercase ${game.winnerId === game.homeMemberId ? 'text-[var(--bk-team-accent)]' : 'text-zinc-300'}`}>
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
                        <span className={`text-xs font-black uppercase ${game.winnerId === game.awayMemberId ? 'text-[var(--bk-team-accent)]' : 'text-zinc-300'}`}>
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
