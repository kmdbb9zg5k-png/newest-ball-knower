import React, { useState } from 'react';
import { useBallKnower } from './BallKnowerContext';
import { X, Copy, Check, Shield, ArrowRight, CalendarClock, SlidersHorizontal } from 'lucide-react';
import { League, LeagueSettings } from './types';
import { formatDraftSchedule } from './draftSchedule';

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
  const defaultDraft = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(20, 0, 0, 0);
    return {
      day: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: '20:00',
    };
  };
  const initialDraft = defaultDraft();
  const [draftDay, setDraftDay] = useState(initialDraft.day);
  const [draftTime, setDraftTime] = useState(initialDraft.time);
  const [createdLeague, setCreatedLeague] = useState<League | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState<LeagueSettings>({
    scoringFormat:'ppr', regularSeasonWeeks:15, playoffTeams:6,
    playoffSeeding:'record_points', tradeReview:'commissioner', waiverType:'priority',
    freeAgentMode:'instant', waiverDays:2, waiverProcessHourUtc:9,
    irSlots:2, benchSlots:6, draftFormat:'live_snake',
  });

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueName.trim()) {
      showToast('Please enter a league name');
      return;
    }
    if(!onlineInvitesReady&&advanced.draftFormat==='autopick'){
      showToast('Autopick-only drafts require online league services.');
      return;
    }
    const scheduledDate = new Date(`${draftDay}T${draftTime}`);
    if (!draftDay || !draftTime || !Number.isFinite(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      showToast('Choose a draft date and time in the future');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const newLeague = await createLeague(leagueName.trim(), memberSize, {
        draftScheduledAt: scheduledDate.toISOString(),
        draftTimezone: timezone,
      }, undefined, advanced);
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
      const nextDefault = defaultDraft();
      setDraftDay(nextDefault.day);
      setDraftTime(nextDefault.time);
    }
  };

  const LEAGUE_SIZES = [6, 8, 10, 12, 14, 16];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-white/10 bg-[#121212] p-6 shadow-2xl sm:p-8">
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

              <details className="mb-5 rounded-xl border border-white/10 bg-black/20 p-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-black uppercase tracking-wider text-[#D4AF37]">
                  <SlidersHorizontal className="h-4 w-4"/>Advanced League Settings
                  <span className="ml-auto text-[9px] text-zinc-500">Optional</span>
                </summary>
                <p className="mb-3 text-[10px] font-semibold leading-4 text-zinc-500">Defaults match a quick 15-player Yahoo-style league. Advanced settings never add NFL salary-cap, OL, DL or IDP rules.</p>
                <div className="grid gap-3 min-[390px]:grid-cols-2">
                  <AdvancedSelect label="Scoring" value={advanced.scoringFormat||'ppr'} options={[["ppr","Full PPR"],["half_ppr","Half PPR"],["standard","Standard"]]} onChange={value=>setAdvanced(s=>({...s,scoringFormat:value as LeagueSettings['scoringFormat']}))}/>
                  <AdvancedSelect label="Draft Format" value={advanced.draftFormat||'live_snake'} options={[["live_snake","Live Snake"],["autopick","Autopick Only"],["offline","Offline Results"],["mock","Mock Draft"]]} onChange={value=>setAdvanced(s=>({...s,draftFormat:value as LeagueSettings['draftFormat']}))}/>
                  <AdvancedSelect label="Regular Season" value={String(advanced.regularSeasonWeeks||15)} options={[["13","13 Weeks"],["14","14 Weeks"],["15","15 Weeks"],["16","16 Weeks"]].filter(([value])=>Number(value)+(advanced.playoffTeams===4?2:3)<=18)} onChange={value=>setAdvanced(s=>({...s,regularSeasonWeeks:Number(value) as LeagueSettings['regularSeasonWeeks']}))}/>
                  <AdvancedSelect label="Playoff Teams" value={String(advanced.playoffTeams||6)} options={[["4","4 Teams"],["6","6 Teams"],["8","8 Teams"]].filter(([value])=>Number(value)<=memberSize)} onChange={value=>setAdvanced(s=>{const teams=Number(value) as LeagueSettings['playoffTeams'];return{...s,playoffTeams:teams,regularSeasonWeeks:Math.min(s.regularSeasonWeeks||15,18-(teams===4?2:3)) as LeagueSettings['regularSeasonWeeks']};})}/>
                  <AdvancedSelect label="Seeding" value={advanced.playoffSeeding||'record_points'} options={[["record_points","Record, then Points"],["record_head_to_head","Record, then H2H"],["division_winners","Division Winners"]]} onChange={value=>setAdvanced(s=>({...s,playoffSeeding:value as LeagueSettings['playoffSeeding']}))}/>
                  <AdvancedSelect label="Trade Review" value={advanced.tradeReview||'commissioner'} options={[["none","None"],["commissioner","Commissioner"],["league_vote","League Vote"]]} onChange={value=>setAdvanced(s=>({...s,tradeReview:value as LeagueSettings['tradeReview']}))}/>
                  <AdvancedSelect label="Waivers" value={advanced.waiverType||'priority'} options={[["priority","Rolling Priority"],["faab","FAAB"]]} onChange={value=>setAdvanced(s=>({...s,waiverType:value as LeagueSettings['waiverType']}))}/>
                  <AdvancedSelect label="Free Agents" value={advanced.freeAgentMode||'instant'} options={[["instant","Instant Adds"],["continuous","Continuous Waivers"]]} onChange={value=>setAdvanced(s=>({...s,freeAgentMode:value as LeagueSettings['freeAgentMode']}))}/>
                  <AdvancedNumber label="Bench Slots" value={advanced.benchSlots??6} min={6} max={11} onChange={value=>setAdvanced(s=>({...s,benchSlots:value,rosterSize:9+value}))}/>
                  <AdvancedNumber label="IR Slots" value={advanced.irSlots??2} min={0} max={5} onChange={value=>setAdvanced(s=>({...s,irSlots:value}))}/>
                  <AdvancedNumber label="Trade Deadline Week" value={advanced.tradeDeadlineWeek??11} min={1} max={17} onChange={value=>setAdvanced(s=>({...s,tradeDeadlineWeek:value}))}/>
                  <AdvancedNumber label="Max Adds / Week (0 = no cap)" value={advanced.maxAcquisitionsPerWeek??0} min={0} max={99} onChange={value=>setAdvanced(s=>({...s,maxAcquisitionsPerWeek:value||null}))}/>
                </div>
              </details>

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
                      onClick={() => {setMemberSize(size);setAdvanced(settings=>({...settings,playoffTeams:Math.min(settings.playoffTeams||6,size)>=8?8:Math.min(settings.playoffTeams||6,size)>=6?6:4}));}}
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

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-300 mb-2">
                  Draft Date & Time
                </label>
                <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
                  <input
                    aria-label="Draft date"
                    type="date"
                    required
                    min={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
                    value={draftDay}
                    onChange={event => setDraftDay(event.target.value)}
                    className="min-h-12 w-full rounded-sm border border-white/10 bg-[#1A1A1A] px-3 text-sm text-white [color-scheme:dark] focus:border-[#D4AF37] focus:outline-none"
                  />
                  <input
                    aria-label="Draft time"
                    type="time"
                    required
                    value={draftTime}
                    onChange={event => setDraftTime(event.target.value)}
                    className="min-h-12 w-full rounded-sm border border-white/10 bg-[#1A1A1A] px-3 text-sm text-white [color-scheme:dark] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}
                </p>
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

            <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/[.06] p-3 text-left">
              <CalendarClock className="h-5 w-5 shrink-0 text-[#D4AF37]" />
              <div><div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Scheduled Draft</div><div className="mt-0.5 text-xs font-black text-white">{formatDraftSchedule(createdLeague)}</div></div>
            </div>

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

const AdvancedSelect:React.FC<{label:string;value:string;options:string[][];onChange:(value:string)=>void}>=({label,value,options,onChange})=><label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{label}<select aria-label={label} value={value} onChange={event=>onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-2 text-xs font-bold text-white">{options.map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label>;
const AdvancedNumber:React.FC<{label:string;value:number;min:number;max:number;onChange:(value:number)=>void}>=({label,value,min,max,onChange})=><label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{label}<input aria-label={label} type="number" value={value} min={min} max={max} onChange={event=>onChange(Math.max(min,Math.min(max,Number(event.target.value)||0)))} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-xs font-bold text-white"/></label>;
