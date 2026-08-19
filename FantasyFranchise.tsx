import React, { useMemo, useState } from 'react';
import { ArrowLeft, Play, RotateCcw, Search, Shuffle } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { playerPortraitUrl } from './playerPortraits';
import { getDraftPositionGroup } from './rosterRules';
import {
  createFantasyDraft,
  fantasyAvailablePlayers,
  fantasyDraftComplete,
  fantasyDraftTeamAt,
  FantasyDraftState,
  fantasyPickPlayer,
  fantasyRosterPlayers,
  fantasyTeam,
  FANTASY_DRAFT_ROUNDS,
  FANTASY_ROSTER_REQUIREMENTS,
  makeFantasyUserPick,
  isValidFantasyDraftState,
  SOLO_FRANCHISE_SAVE_KEYS,
} from './soloFranchiseEngine';
import { SoloTeamPicker } from './SoloTeamPicker';
import { getSavedTeamTheme, TEAM_THEMES, teamLogoUrl } from './teamTheme';
import { Player } from './types';

type Props = { onBack: () => void };
type FantasySave = { version: 1; draft: FantasyDraftState; seasonStarted: boolean };

function restoreFantasy(): FantasySave | null {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.fantasy);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const draft = saved?.draft;
    if (saved?.version !== 1 || typeof saved.seasonStarted !== 'boolean' || !isValidFantasyDraftState(draft, saved.seasonStarted)) return null;
    return saved;
  } catch {
    return null;
  }
}

function saveFantasy(save: FantasySave) {
  try {
    localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.fantasy, JSON.stringify(save));
    return true;
  } catch (error) {
    console.warn('Unable to save Fantasy Franchise', error);
    return false;
  }
}

function removeFantasySave(key: string) {
  try { localStorage.removeItem(key); } catch (error) { console.warn('Unable to clear Fantasy Franchise save', error); }
}

export const FantasyFranchise: React.FC<Props> = ({ onBack }) => {
  const restored = useMemo(restoreFantasy, []);
  const [selectedAbbr, setSelectedAbbr] = useState(() => restored?.draft.userTeamAbbr ?? getSavedTeamTheme().abbr);
  const [draft, setDraft] = useState<FantasyDraftState | null>(() => restored?.draft ?? null);
  const [seasonStarted, setSeasonStarted] = useState(() => restored?.seasonStarted ?? false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [isPicking, setIsPicking] = useState(false);
  const [message, setMessage] = useState('');

  const userRoster = useMemo(() => draft ? fantasyRosterPlayers(draft, draft.userTeamAbbr) : [], [draft]);
  const available = useMemo(() => {
    if (!draft) return [];
    return fantasyAvailablePlayers(draft).filter(player => {
      if (position !== 'ALL' && getDraftPositionGroup(player) !== position && player.position !== position) return false;
      if (query && !`${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    }).slice(0, 80);
  }, [draft, position, query]);

  const startDraft = () => {
    const next = createFantasyDraft(selectedAbbr);
    const save: FantasySave = { version: 1, draft: next, seasonStarted: false };
    const saved = saveFantasy(save);
    removeFantasySave(`${SOLO_FRANCHISE_SAVE_KEYS.fantasy}:season`);
    setDraft(next);
    setSeasonStarted(false);
    setMessage(saved ? `You have pick #${next.teamOrder.indexOf(selectedAbbr) + 1}. You are on the clock.` : 'Draft started, but Safari could not save it. Keep this page open to continue.');
  };

  const selectPlayer = async (player: Player) => {
    if (!draft || isPicking || fantasyDraftTeamAt(draft) !== draft.userTeamAbbr) return;
    setIsPicking(true);
    setMessage(`${player.name} selected. CPU teams are drafting…`);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    try {
      const next = makeFantasyUserPick(draft, player.id);
      setDraft(next);
      const saved = saveFantasy({ version: 1, draft: next, seasonStarted: false });
      setMessage(!saved ? 'Pick completed, but Safari could not save it. Keep this page open.' : fantasyDraftComplete(next) ? 'Fantasy Draft complete. Your franchise is ready.' : `Round ${Math.floor(next.pickIndex / 32) + 1}: you are back on the clock.`);
    } finally {
      setIsPicking(false);
    }
  };

  const beginSeason = () => {
    if (!draft || !fantasyDraftComplete(draft)) return;
    setSeasonStarted(true);
    if (!saveFantasy({ version: 1, draft, seasonStarted: true })) setMessage('Season started, but Safari could not save it. Keep this page open.');
  };

  const newCareer = () => {
    removeFantasySave(SOLO_FRANCHISE_SAVE_KEYS.fantasy);
    removeFantasySave(`${SOLO_FRANCHISE_SAVE_KEYS.fantasy}:season`);
    setDraft(null);
    setSeasonStarted(false);
    setMessage('');
  };

  if (draft && seasonStarted) {
    const opponentRosters = Object.fromEntries(TEAM_THEMES.map(team => [team.abbr, fantasyRosterPlayers(draft, team.abbr)]));
    return (
      <div className="relative">
        <button type="button" onClick={newCareer} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/90 px-4 text-xs font-black shadow-xl"><RotateCcw size={15} /> NEW DRAFT</button>
        <FranchiseSeason title="FANTASY FRANCHISE" userTeam={fantasyTeam(draft.userTeamAbbr)} roster={userRoster} opponentRosters={opponentRosters} saveKey={SOLO_FRANCHISE_SAVE_KEYS.fantasy} onBack={onBack} />
      </div>
    );
  }

  if (!draft) {
    const selectedTeam = fantasyTeam(selectedAbbr);
    return (
      <div className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
        <div className="mx-auto max-w-5xl">
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft size={19} /></button>
          <div className="mt-5 rounded-[2rem] border border-white/10 bg-[#10151d] p-5 sm:p-8">
            <div className="flex items-center gap-2 text-[var(--bk-team-accent)]"><Shuffle size={18} /><span className="text-[10px] font-black tracking-[.25em]">32-TEAM SNAKE DRAFT</span></div>
            <h2 className="mt-3 text-4xl font-black leading-none">FANTASY FRANCHISE</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-zinc-400">Choose your franchise. Every NFL player enters one shared pool, and every CPU team drafts between your picks.</p>
            <div className="mt-6"><SoloTeamPicker selectedAbbr={selectedAbbr} onSelect={setSelectedAbbr} /></div>
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-[2rem] border border-white/10 bg-[#111] p-5">
            <img src={teamLogoUrl(selectedTeam.abbr)} alt="" aria-hidden="true" className="h-16 w-16 object-contain" />
            <div className="min-w-0 flex-1"><div className="truncate text-2xl font-black">{selectedTeam.name}</div><div className="text-xs text-zinc-500">53 ROUNDS • FULL NFL ROSTER • SNAKE ORDER</div></div>
            <button type="button" onClick={startDraft} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]" aria-label="Start Fantasy Draft"><Play /></button>
          </div>
        </div>
      </div>
    );
  }

  const complete = fantasyDraftComplete(draft);
  const round = Math.min(FANTASY_DRAFT_ROUNDS, Math.floor(draft.pickIndex / 32) + 1);
  const userSlot = draft.teamOrder.indexOf(draft.userTeamAbbr) + 1;
  const counts = userRoster.reduce<Record<string, number>>((result, player) => {
    const group = getDraftPositionGroup(player);
    result[group] = (result[group] ?? 0) + 1;
    return result;
  }, {});

  return (
    <div className="min-h-[100dvh] bg-transparent px-4 pb-12 pt-4 text-white sm:px-8">
      <div className="mx-auto min-w-0 max-w-7xl">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1"><div className="text-[10px] font-black tracking-[.2em] text-[var(--bk-team-accent)]">FANTASY DRAFT • ROUND {round}/{FANTASY_DRAFT_ROUNDS}</div><div className="truncate text-xl font-black">{fantasyTeam(draft.userTeamAbbr).name} • PICK SLOT #{userSlot}</div></div>
          <button type="button" onClick={newCareer} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Start a new Fantasy Draft"><RotateCcw size={17} /></button>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-4 py-3 text-sm font-bold text-[var(--bk-team-accent)]">{message}</div> : null}

        {complete ? (
          <div className="mt-5 rounded-[2rem] border border-white/10 bg-[#10151d] p-6 text-center">
            <img src={teamLogoUrl(draft.userTeamAbbr)} alt="" aria-hidden="true" className="mx-auto h-24 w-24 object-contain" />
            <h2 className="mt-3 text-4xl font-black">DRAFT COMPLETE</h2>
            <p className="mt-2 text-zinc-400">Your full 53-man fantasy roster is ready for Week 1.</p>
            <button type="button" onClick={beginSeason} className="mt-5 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"><Play className="mr-2 inline" /> START SEASON</button>
          </div>
        ) : (
          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[1.45fr_.55fr]">
            <div className="min-w-0">
              <div className="mb-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-[#111] px-3"><Search size={16} className="shrink-0" /><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search fantasy draft players" placeholder="Search draft pool…" className="min-w-0 flex-1 bg-transparent py-3 outline-none" /></div>
                <button type="button" disabled={isPicking || !available[0]} onClick={() => available[0] && selectPlayer(available[0])} className="shrink-0 rounded-2xl bg-[var(--bk-team-accent)] px-3 text-[10px] font-black text-[var(--bk-on-accent)] disabled:opacity-40 sm:px-4 sm:text-xs">AUTO PICK</button>
              </div>
              <div className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0"><div className="flex w-max gap-2">{['ALL', ...Object.keys(FANTASY_ROSTER_REQUIREMENTS)].map(group => <button key={group} type="button" aria-pressed={position===group} onClick={() => setPosition(group)} className={`min-h-10 rounded-xl border px-3 text-xs font-black ${position === group ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]' : 'border-white/10 bg-[#111] text-zinc-400'}`}>{group}</button>)}</div></div>
              <div className="max-h-[65dvh] min-w-0 space-y-2 overflow-y-auto overscroll-contain">
                {available.map(player => <DraftPlayer key={player.id} player={player} disabled={isPicking} onSelect={() => selectPlayer(player)} />)}
              </div>
            </div>

            <aside className="min-w-0 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#111] p-4"><div className="text-xs font-black tracking-widest text-[var(--bk-team-accent)]">YOUR ROSTER • {userRoster.length}/{FANTASY_DRAFT_ROUNDS}</div><div className="mt-2 text-sm leading-relaxed text-zinc-400">{Object.entries(FANTASY_ROSTER_REQUIREMENTS).map(([group, required]) => `${group} ${counts[group] ?? 0}/${required}`).join(' • ')}</div><div className="mt-3 max-h-[65dvh] space-y-1 overflow-y-auto overscroll-contain pr-1">{userRoster.map(player => <div key={player.id} className="flex justify-between rounded-xl bg-white/5 px-3 py-2 text-xs"><span className="truncate"><b>{player.position}</b> {player.name}</span><b>{player.ovr}</b></div>)}</div></div>
              <div className="rounded-2xl border border-white/10 bg-[#111] p-4"><div className="text-xs font-black tracking-widest text-[var(--bk-team-accent)]">RECENT PICKS</div><div className="mt-2 space-y-2">{draft.picks.slice(-8).reverse().map(pick => {const player = fantasyPickPlayer(pick); return <div key={pick.overall} className="text-xs"><b>#{pick.overall} {fantasyTeam(pick.teamAbbr).abbr}</b><div className="truncate text-zinc-500">{player?.name ?? 'Unknown'} • {player?.position}</div></div>;})}</div></div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

const DraftPlayer = ({ player, disabled, onSelect }: { key?: React.Key; player: Player; disabled: boolean; onSelect: () => void }) => {
  const portrait = playerPortraitUrl(player);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label={`Draft ${player.name}, ${player.position}, ${player.ovr} overall`}
      className="grid w-full min-w-0 grid-cols-[48px_minmax(0,1fr)_72px] items-center gap-3 rounded-2xl border border-white/10 bg-[#111] p-3 text-left transition hover:border-[var(--bk-team-accent)]/45 hover:bg-white/[.06] disabled:cursor-wait disabled:opacity-50 active:scale-[.99]"
    >
      <div className="h-12 w-12 overflow-hidden rounded-full bg-white/5">{portrait ? <img src={portrait} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}</div>
      <div className="min-w-0"><div className="truncate font-black">{player.name}</div><div className="truncate text-xs text-zinc-500">{player.team} • {player.position}</div></div>
      <span className="grid min-h-11 place-items-center rounded-xl bg-[var(--bk-team-accent)] px-2 text-center text-[10px] font-black leading-tight text-[var(--bk-on-accent)]">DRAFT<br />{player.ovr}</span>
    </button>
  );
};
