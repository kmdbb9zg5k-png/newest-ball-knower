import { BroadcastStage } from './BroadcastScene';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Ban, CheckCircle2, ChevronDown, ChevronUp, Clock3, ListPlus, MapPin, Play, RotateCcw, Search, Star, Trophy, Upload, Users } from 'lucide-react';
import { LIVE_FANTASY_ROSTER_REQUIREMENTS, type LiveFantasyDraftGroup } from './liveFantasyRules';
import { SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import {
  SOLO_FANTASY_GROUPS, SOLO_FANTASY_PLAYER_BY_ID, SOLO_FANTASY_PLAYER_POOL,
  createSoloFantasyDraft, isSoloFantasyDraftState, makeSoloFantasyPick,
  soloFantasyAutopickSelection, soloFantasyAvailable, soloFantasyCounts,
  soloFantasyCpuSelection, soloFantasyManagerAt, soloFantasyManagerScore,
  soloFantasyProjection, soloFantasyRoster, soloFantasyUpcoming,
  type SoloFantasyDraftState, type SoloFantasyLeagueSetup, type SoloFantasyManager,
} from './soloFantasyDraftEngine';
import { soloTeamLogoUrl } from './soloUniverse';
import type { Player } from './types';

type Props = { onBack: () => void };
type DraftPreferences = { queue: string[]; favorites: string[]; avoid: string[]; preRankings: string[] };
type Save = { version: 2; draft: SoloFantasyDraftState; view: 'draft' | 'league'; preferences: DraftPreferences };
type LeagueTab = 'overview' | 'roster' | 'results';

const EMPTY_PREFERENCES: DraftPreferences = { queue: [], favorites: [], avoid: [], preRankings: [] };
const GROUP_LABELS: Record<LiveFantasyDraftGroup, string> = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', K: 'K', DST: 'D/ST' };
const STOCK_LOGOS = [
  { name: 'Flight Collective', url: '/solo-fantasy-logos/flight-collective.jpeg' },
  { name: 'Gridiron Shield', url: '/solo-fantasy-logos/gridiron-shield.jpeg' },
  { name: 'Champions Circle', url: '/solo-fantasy-logos/champions-circle.jpeg' },
  { name: 'Neon Guardians', url: '/solo-fantasy-logos/neon-guardians.jpeg' },
] as const;
const PLAYER_RANK = new Map(SOLO_FANTASY_PLAYER_POOL.map((player, index) => [player.id, index + 1]));

function loadSave(): Save | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.fantasy) ?? 'null');
    if (parsed?.version !== 2 || !isSoloFantasyDraftState(parsed.draft)) return null;
    const preferences = parsed.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : EMPTY_PREFERENCES;
    return { version: 2, draft: parsed.draft, view: parsed.view === 'league' ? 'league' : 'draft', preferences: { ...EMPTY_PREFERENCES, ...preferences } };
  } catch { return null; }
}

function storeSave(save: Save) {
  try { localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.fantasy, JSON.stringify(save)); }
  catch (error) { console.warn('Unable to save Solo Fantasy League', error); }
}
function removeSave() {
  try { localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.fantasy); }
  catch (error) { console.warn('Unable to clear Solo Fantasy League', error); }
}

function resizeLogo(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file for your logo.'));
    if (file.size > 12 * 1024 * 1024) return reject(new Error('That image is too large. Choose one under 12 MB.'));
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('This device could not prepare the logo.');
        context.fillStyle = '#fff'; context.fillRect(0, 0, 512, 512);
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(image, (image.naturalWidth - sourceSize) / 2, (image.naturalHeight - sourceSize) / 2, sourceSize, sourceSize, 0, 0, 512, 512);
        resolve(canvas.toDataURL('image/jpeg', .84));
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(objectUrl); }
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('That image format could not be opened on this device.')); };
    image.src = objectUrl;
  });
}

export const FantasyFranchise: React.FC<Props> = ({ onBack }) => {
  const restored = useMemo(loadSave, []);
  const [draft, setDraft] = useState<SoloFantasyDraftState | null>(() => restored?.draft ?? null);
  const [view, setView] = useState<'draft' | 'league'>(() => restored?.view ?? 'draft');
  const [preferences, setPreferences] = useState<DraftPreferences>(() => restored?.preferences ?? EMPTY_PREFERENCES);
  useEffect(() => { if (draft) storeSave({ version: 2, draft, view, preferences }); }, [draft, view, preferences]);
  const reset = () => { removeSave(); setDraft(null); setView('draft'); setPreferences(EMPTY_PREFERENCES); };

  if (!draft) return <LeagueCreator onBack={onBack} onCreate={setup => { setDraft(createSoloFantasyDraft(setup)); setView('draft'); setPreferences(EMPTY_PREFERENCES); }} />;
  if (view === 'league') return <SoloLeagueHome draft={draft} onBack={onBack} onNewLeague={reset} />;
  return <SoloLiveDraftRoom draft={draft} setDraft={setDraft} preferences={preferences} setPreferences={setPreferences} onBack={onBack} onEnterLeague={() => setView('league')} onNewLeague={reset} />;
};

function LeagueCreator({ onBack, onCreate }: { onBack: () => void; onCreate: (setup: SoloFantasyLeagueSetup) => void }) {
  const [leagueName, setLeagueName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [location, setLocation] = useState('');
  const [leagueSize, setLeagueSize] = useState<8 | 10 | 12>(10);
  const [logoUrl, setLogoUrl] = useState<string>(STOCK_LOGOS[0].url);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = leagueName.trim().length >= 3 && teamName.trim().length >= 2 && location.trim().length >= 2 && Boolean(logoUrl);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError('');
    try { setLogoUrl(await resizeLogo(file)); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'The logo could not be prepared.'); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  return <BroadcastStage scene="tunnel" page="fantasy-franchise" quiet className="min-h-[100dvh] bg-transparent px-4 pb-12 pt-4 text-white sm:px-8"><div className="mx-auto max-w-3xl">
    <button type="button" onClick={onBack} aria-label="Back to Solo Franchise Hub" className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]"><ArrowLeft className="h-5 w-5" /></button>
    <section className="mt-4 overflow-hidden rounded-[2rem] border border-[#D4AF37]/25 bg-[#0c1016] shadow-2xl">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,.2),transparent_52%)] p-5 sm:p-8"><div className="text-[10px] font-black uppercase tracking-[.24em] text-[#D4AF37]">Solo Fantasy · Create League</div><h1 className="mt-2 text-4xl font-black uppercase leading-none sm:text-5xl">Build Your League</h1><p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-zinc-400">Create your identity, then draft against CPU GMs in the same live snake-draft format used by Online Fantasy.</p></div>
      <div className="space-y-6 p-5 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="League name"><input value={leagueName} onChange={event => setLeagueName(event.target.value)} maxLength={40} placeholder="Lehigh Valley Legends League" className="w-full border border-white/10 bg-black/30 px-3 text-base font-bold outline-none focus:border-[#D4AF37]/60" /></Field>
          <Field label="Your team name"><input value={teamName} onChange={event => setTeamName(event.target.value)} maxLength={32} placeholder="Allentown Iron" className="w-full border border-white/10 bg-black/30 px-3 text-base font-bold outline-none focus:border-[#D4AF37]/60" /></Field>
          <Field label="Team location"><div className="relative"><MapPin className="absolute left-3 top-3.5 h-4 w-4 text-[#D4AF37]" /><input value={location} onChange={event => setLocation(event.target.value)} maxLength={40} placeholder="Allentown, PA" className="w-full border border-white/10 bg-black/30 pl-10 pr-3 text-base font-bold outline-none focus:border-[#D4AF37]/60" /></div></Field>
          <Field label="League size"><select value={leagueSize} onChange={event => setLeagueSize(Number(event.target.value) as 8 | 10 | 12)} className="w-full border border-white/10 bg-[#11151b] px-3 text-base font-bold outline-none"><option value={8}>8 teams</option><option value={10}>10 teams</option><option value={12}>12 teams</option></select></Field>
        </div>
        <div><div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-[#D4AF37]">Choose your team logo</div><p className="mt-1 text-xs font-semibold text-zinc-500">Use one of your stock logos or upload your own photo.</p></div><img src={logoUrl} alt="Selected team logo" className="h-16 w-16 rounded-2xl border border-[#D4AF37]/35 bg-white object-contain p-1" /></div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{STOCK_LOGOS.map(option => <button key={option.url} type="button" aria-label={`Use ${option.name} logo`} aria-pressed={logoUrl === option.url} onClick={() => { setLogoUrl(option.url); setError(''); }} className={`aspect-square overflow-hidden rounded-2xl border bg-white p-1 ${logoUrl === option.url ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-white/10'}`}><img src={option.url} alt="" className="h-full w-full object-contain" /></button>)}<button type="button" onClick={() => inputRef.current?.click()} aria-label="Upload custom team logo" className={`grid aspect-square place-items-center rounded-2xl border border-dashed bg-white/5 ${logoUrl.startsWith('data:') ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-white/20 text-zinc-400'}`}>{uploading ? <span className="text-[9px] font-black uppercase">Preparing…</span> : <span className="text-center text-[9px] font-black uppercase"><Upload className="mx-auto mb-1 h-5 w-5" />Upload<br />Photo</span>}</button><input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={event => void upload(event.target.files?.[0])} /></div>
        </div>
        {error ? <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs font-bold text-red-200">{error}</p> : null}
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] p-4 text-xs font-semibold leading-5 text-emerald-100"><CheckCircle2 className="mr-2 inline h-4 w-4" />15-round snake draft · QB, RB, WR, TE, K and D/ST · simulated players · automatic CPU GMs</div>
        <button type="button" disabled={!valid || uploading} onClick={() => onCreate({ leagueName: leagueName.trim(), teamName: teamName.trim(), location: location.trim(), logoUrl, leagueSize })} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] text-sm font-black uppercase tracking-wider text-black disabled:opacity-35"><Play className="h-5 w-5" />Create League & Enter Draft</button>
      </div>
    </section>
  </div></BroadcastStage>;
}

function SoloLiveDraftRoom({ draft, setDraft, preferences, setPreferences, onBack, onEnterLeague, onNewLeague }: { draft: SoloFantasyDraftState; setDraft: React.Dispatch<React.SetStateAction<SoloFantasyDraftState | null>>; preferences: DraftPreferences; setPreferences: React.Dispatch<React.SetStateAction<DraftPreferences>>; onBack: () => void; onEnterLeague: () => void; onNewLeague: () => void }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<LiveFantasyDraftGroup | 'ALL'>('ALL');
  const [showMyPicks, setShowMyPicks] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const currentManagerId = draft.status === 'active' ? soloFantasyManagerAt(draft) : '';
  const currentManager = draft.managers.find(manager => manager.id === currentManagerId);
  const user = draft.managers.find(manager => manager.isUser)!;
  const canPick = draft.status === 'active' && currentManager?.isUser;
  const myPicks = draft.picks.filter(pick => pick.managerId === user.id);
  const myRoster = soloFantasyRoster(draft, user.id);
  const myCounts = soloFantasyCounts(draft, user.id);
  const available = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return soloFantasyAvailable(draft, currentManagerId || user.id, !currentManager?.isUser).filter(player => (group === 'ALL' || player.position === group) && (!clean || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(clean))).slice(0, 100);
  }, [draft, currentManagerId, currentManager?.isUser, group, query, user.id]);

  useEffect(() => {
    if (draft.status !== 'active' || currentManager?.isUser) return;
    const pickIndex = draft.pickIndex;
    const timer = window.setTimeout(() => setDraft(current => {
      if (!current || current.status !== 'active' || current.pickIndex !== pickIndex) return current;
      const player = soloFantasyCpuSelection(current, soloFantasyManagerAt(current));
      return player ? makeSoloFantasyPick(current, player.id, 'cpu') : current;
    }), 260);
    return () => window.clearTimeout(timer);
  }, [draft.pickIndex, draft.status, currentManager?.isUser, setDraft]);
  useEffect(() => { setSecondsLeft(60); if (!canPick) return; const timer = window.setInterval(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [draft.pickIndex, canPick]);
  useEffect(() => {
    if (!canPick || secondsLeft !== 0) return;
    setDraft(current => {
      if (!current || current.status !== 'active' || soloFantasyManagerAt(current) !== user.id) return current;
      const player = soloFantasyAutopickSelection(current, user.id, [...preferences.queue, ...preferences.preRankings, ...preferences.favorites]);
      return player ? makeSoloFantasyPick(current, player.id, 'autopick') : current;
    });
  }, [canPick, preferences.favorites, preferences.preRankings, preferences.queue, secondsLeft, setDraft, user.id]);

  const selectPlayer = (player: Player) => {
    if (!canPick || preferences.avoid.includes(player.id)) return;
    setDraft(current => current && current.pickIndex === draft.pickIndex ? makeSoloFantasyPick(current, player.id, 'manual') : current);
    setPreferences(value => ({ ...value, queue: value.queue.filter(id => id !== player.id) }));
  };
  const toggle = (key: keyof DraftPreferences, playerId: string) => setPreferences(value => ({ ...value, [key]: value[key].includes(playerId) ? value[key].filter(id => id !== playerId) : [...value[key], playerId] }));
  const moveQueue = (playerId: string, direction: -1 | 1) => setPreferences(value => { const queue = [...value.queue]; const from = queue.indexOf(playerId); const to = from + direction; if (from < 0 || to < 0 || to >= queue.length) return value; [queue[from], queue[to]] = [queue[to], queue[from]]; return { ...value, queue }; });
  if (draft.status === 'completed') return <DraftComplete draft={draft} user={user} onEnterLeague={onEnterLeague} onNewLeague={onNewLeague} />;

  const totalPicks = draft.managers.length * draft.rounds;
  const round = Math.floor(draft.pickIndex / draft.managers.length) + 1;
  const upcoming = soloFantasyUpcoming(draft, 12);
  const nextMine = soloFantasyUpcoming(draft, draft.managers.length * 2).find(item => item.managerId === user.id);
  const picksAway = nextMine ? nextMine.pickIndex - draft.pickIndex : null;
  const openNeeds = SOLO_FANTASY_GROUPS.filter(item => (myCounts[item] ?? 0) < LIVE_FANTASY_ROSTER_REQUIREMENTS[item]);

  return <BroadcastStage scene="tunnel" page="fantasy-franchise" quiet className="bk-fantasy-shell min-h-[100dvh] bg-[#07090c] px-2 pt-0 text-white sm:px-6 sm:pt-3"><div className="mx-auto max-w-7xl">
    <div className="mb-2 flex items-center gap-2 px-1 pt-1"><img src={draft.setup.logoUrl} alt="" className="h-9 w-9 rounded-lg border border-[#D4AF37]/30 bg-white object-contain p-0.5" /><div className="min-w-0"><div className="truncate text-xs font-black uppercase">{draft.setup.leagueName}</div><div className="truncate text-[9px] font-bold text-zinc-500"><MapPin className="mr-1 inline h-3 w-3" />{user.location}</div></div></div>
    <div className="bk-fantasy-sticky-nav -mx-2 border-b border-white/10 bg-[#07090c]/[.98] px-2 py-2 shadow-[0_12px_28px_rgba(0,0,0,.46)] sm:mx-0 sm:rounded-lg sm:border">
      <div className="grid grid-cols-[34px_minmax(0,1fr)_34px_54px] items-center gap-2"><button onClick={onBack} className="grid h-8 w-8 place-items-center border border-white/10" aria-label="Back to Solo Franchise Hub"><ArrowLeft className="h-4 w-4" /></button><div className="flex min-w-0 items-center gap-2"><ManagerLogo manager={currentManager} /><div className="min-w-0"><div className="text-[8px] font-black uppercase tracking-[.14em] text-[#D4AF37]">Round {round} · Pick {draft.pickIndex + 1}/{totalPicks}</div><div className="truncate text-xs font-black uppercase sm:text-lg">{currentManager?.name} Is On The Clock</div></div></div><div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white"><img src={draft.setup.logoUrl} alt="" className="h-full w-full object-contain" /></div><div className={`rounded-lg px-1.5 py-1 text-center ${canPick && secondsLeft <= 10 ? 'bg-red-500/10 text-red-300' : 'bg-black/25'}`}><div className="text-[7px] font-black uppercase opacity-60">Clock</div><div className="font-mono text-sm font-black sm:text-2xl">{currentManager?.isUser ? `${secondsLeft}s` : 'CPU'}</div></div></div>
      <div className="mt-2 border-t border-white/10 pt-1.5"><div className="flex justify-between gap-2"><div className="text-[8px] font-black uppercase tracking-[.16em] text-zinc-500">Upcoming draft order</div><div className={`truncate text-right text-[8px] font-black uppercase ${picksAway === 0 ? 'text-emerald-300' : 'text-[#E7C75A]'}`}>{picksAway === 0 ? "You're up now" : nextMine ? `Your next: #${nextMine.overall} · ${picksAway} picks away` : 'Your draft is complete'}</div></div><ol aria-label="Upcoming draft order" className="bk-fantasy-scroll-shadow no-scrollbar mt-1 flex gap-1.5 overflow-x-auto pb-0.5">{upcoming.map((item, index) => { const manager = draft.managers.find(candidate => candidate.id === item.managerId); return <li key={item.pickIndex} className={`grid min-w-[74px] grid-cols-[24px_minmax(0,1fr)] items-center gap-1 rounded-md border px-1.5 py-1 ${index === 0 ? 'border-[#D4AF37]/70 bg-[#D4AF37]/15' : manager?.isUser ? 'border-emerald-300/35 bg-emerald-300/[.07]' : 'border-white/10 bg-black/30'}`}><ManagerLogo manager={manager} small /><div className="min-w-0"><div className={`truncate text-[7px] font-black uppercase ${index === 0 ? 'text-[#E7C75A]' : manager?.isUser ? 'text-emerald-300' : 'text-zinc-500'}`}>{index === 0 ? 'On clock' : `#${item.overall} · R${item.round}`}</div><div className="truncate text-[8px] font-black uppercase">{manager?.name}</div></div></li>; })}</ol></div>
    </div>
    <section className="bk-fantasy-card mt-2 border-[#D4AF37]/20 p-2 sm:p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-[#D4AF37]">Your roster needs</div><div className="text-[10px] font-bold text-zinc-500">Counts update after every pick</div></div><button onClick={() => setShowMyPicks(value => !value)} className="flex min-h-10 items-center gap-1 border border-white/10 px-3 text-[9px] font-black uppercase">My picks ({myPicks.length}) {showMyPicks ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button></div><div className="mt-2 grid grid-cols-6 gap-1">{SOLO_FANTASY_GROUPS.map(item => { const count = myCounts[item] ?? 0; const required = LIVE_FANTASY_ROSTER_REQUIREMENTS[item]; const filled = count >= required; return <button key={item} onClick={() => setGroup(item)} className={`min-w-0 rounded-md border px-0.5 py-1 ${filled ? 'border-emerald-400/20 bg-emerald-400/[.07]' : 'border-amber-300/25 bg-amber-300/[.07]'}`}><div className="truncate text-[7px] font-black text-zinc-400">{GROUP_LABELS[item]}</div><div className={`text-xs font-black ${filled ? 'text-emerald-300' : 'text-amber-200'}`}>{count}</div><div className="text-[6px] font-black uppercase text-zinc-600">{filled ? 'Set' : `+${required - count}`}</div></button>; })}</div>{showMyPicks ? <div className="mt-2 grid gap-1 border-t border-white/10 pt-2 sm:grid-cols-2 lg:grid-cols-4">{myPicks.map(pick => <PlayerChip key={pick.overall} player={SOLO_FANTASY_PLAYER_BY_ID.get(pick.playerId)} label={`#${pick.overall}`} />)}</div> : <div className="mt-2 text-[9px] font-bold uppercase text-zinc-600">Starter needs: {openNeeds.length ? openNeeds.map(item => `${LIVE_FANTASY_ROSTER_REQUIREMENTS[item] - (myCounts[item] ?? 0)} ${GROUP_LABELS[item]}`).join(' · ') : 'Set — draft the best bench value'}</div>}</section>
    <div className="mt-2 grid gap-3 lg:grid-cols-[1.5fr_.65fr]"><section className="min-w-0"><div className={`rounded-lg border px-2 py-1.5 text-center text-[9px] font-black uppercase ${canPick ? 'border-emerald-400/30 bg-emerald-400/[.08] text-emerald-300' : 'border-white/10 bg-[#101318] text-zinc-400'}`}>{canPick ? 'You are on the clock—select one player.' : `${currentManager?.name} is selecting automatically…`}</div><div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5"><div className="relative"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search simulated players…" className="min-h-9 w-full border border-white/10 bg-[#101318] pl-9 pr-3 text-xs font-bold outline-none" /></div><select aria-label="Position group" value={group} onChange={event => setGroup(event.target.value as LiveFantasyDraftGroup | 'ALL')} className="min-h-9 max-w-[7rem] border border-white/10 bg-[#101318] px-2 text-[9px] font-black"><option value="ALL">All</option>{SOLO_FANTASY_GROUPS.map(item => <option key={item} value={item}>{GROUP_LABELS[item]}</option>)}</select></div>
      <div className="mt-2 space-y-1">{available.map((player, index) => { const queued = preferences.queue.includes(player.id); const favorite = preferences.favorites.includes(player.id); const avoided = preferences.avoid.includes(player.id); const preRanked = preferences.preRankings.includes(player.id); return <div key={player.id} className={`rounded-lg border bg-[#101318] p-1.5 ${avoided ? 'border-red-400/25 opacity-60' : queued ? 'border-[#D4AF37]/50' : 'border-white/10'}`}><div className="grid grid-cols-[36px_minmax(0,1fr)_58px] items-center gap-2 sm:grid-cols-[48px_minmax(0,1fr)_88px]"><PlayerAvatar player={player} /><div className="min-w-0"><div className="flex gap-2"><div className="truncate font-black">{player.name}</div>{index === 0 && group === 'ALL' ? <span className="hidden shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[7px] font-black uppercase text-emerald-300 min-[390px]:inline">Top Available</span> : null}</div><div className="truncate text-xs font-semibold text-zinc-500">{player.position} · {player.team} · Draft Rank {PLAYER_RANK.get(player.id)}</div></div><button onClick={() => selectPlayer(player)} disabled={!canPick || avoided} className="min-h-9 rounded-md bg-[#D4AF37] px-1 text-black disabled:opacity-40"><div className="text-sm font-black sm:text-lg">{soloFantasyProjection(player).toFixed(1)}</div><div className="text-[6px] font-black">{canPick ? 'DRAFT' : 'PROJ'}</div></button></div><div className="mt-1 grid grid-cols-4 gap-1 border-t border-white/5 pt-1"><Preference active={queued} label="Queue" onClick={() => toggle('queue', player.id)}><ListPlus /></Preference><Preference active={favorite} label="Favorite" onClick={() => toggle('favorites', player.id)}><Star /></Preference><Preference active={preRanked} label="Pre-rank" onClick={() => toggle('preRankings', player.id)}><Trophy /></Preference><Preference active={avoided} danger label="Avoid" onClick={() => toggle('avoid', player.id)}><Ban /></Preference></div></div>; })}</div></section>
      <aside className="space-y-3"><QueuePanel draft={draft} preferences={preferences} moveQueue={moveQueue} /><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex justify-between"><div className="text-xs font-black uppercase text-[#D4AF37]">Your Roster</div><div className="text-xs font-black">{myRoster.length}/{draft.rounds}</div></div><div className="mt-2 text-[10px] leading-5 text-zinc-500">{SOLO_FANTASY_GROUPS.map(item => `${GROUP_LABELS[item]} ${myCounts[item] ?? 0}`).join(' · ')}</div><div className="mt-3 space-y-1">{myPicks.map(pick => <PlayerChip key={pick.overall} player={SOLO_FANTASY_PLAYER_BY_ID.get(pick.playerId)} label={`#${pick.overall}`} />)}</div></div><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#D4AF37]"><Clock3 className="h-4 w-4" />Recent Picks</div><div className="mt-3 space-y-2">{draft.picks.slice(-10).reverse().map(pick => <div key={pick.overall} className="text-xs"><div className="font-black">#{pick.overall} · {draft.managers.find(item => item.id === pick.managerId)?.name}{pick.source === 'autopick' ? ' · AUTO' : ''}</div><div className="truncate text-zinc-500">{SOLO_FANTASY_PLAYER_BY_ID.get(pick.playerId)?.name} · {pick.group}</div></div>)}</div></div></aside></div>
  </div></BroadcastStage>;
}

function QueuePanel({ draft, preferences, moveQueue }: { draft: SoloFantasyDraftState; preferences: DraftPreferences; moveQueue: (id: string, direction: -1 | 1) => void }) {
  const queue = preferences.queue.filter(id => !draft.picks.some(pick => pick.playerId === id));
  return <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#101318] p-4"><div className="flex justify-between"><div className="text-xs font-black uppercase text-[#D4AF37]">Auto-pick Queue</div><div className="text-[9px] font-black uppercase text-zinc-500">Saved</div></div><p className="mt-1 text-[10px] leading-4 text-zinc-500">When your clock expires, the first available player here is selected.</p><div className="mt-3 space-y-1.5">{queue.map((id, index) => { const player = SOLO_FANTASY_PLAYER_BY_ID.get(id); return player ? <div key={id} className="grid grid-cols-[22px_32px_minmax(0,1fr)_28px_28px] items-center gap-1 rounded-lg bg-black/30 px-2 py-1.5 text-xs"><b className="text-[#D4AF37]">{index + 1}</b><PlayerAvatar player={player} small /><span className="truncate"><b>{player.position}</b> {player.name}</span><button aria-label={`Move ${player.name} up`} onClick={() => moveQueue(id, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></button><button aria-label={`Move ${player.name} down`} onClick={() => moveQueue(id, 1)} disabled={index === queue.length - 1}><ArrowDown className="h-3.5 w-3.5" /></button></div> : null; })}{queue.length ? null : <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-[10px] font-bold text-zinc-600">Tap Queue on players you want next.</div>}</div></div>;
}

function DraftComplete({ draft, user, onEnterLeague, onNewLeague }: { draft: SoloFantasyDraftState; user: SoloFantasyManager; onEnterLeague: () => void; onNewLeague: () => void }) {
  const ranked = draft.managers.map(manager => ({ manager, score: soloFantasyManagerScore(draft, manager.id) })).sort((a, b) => b.score - a.score);
  const place = ranked.findIndex(item => item.manager.id === user.id) + 1;
  const score = ranked.find(item => item.manager.id === user.id)?.score ?? 0;
  const grade = place <= 2 ? 'A' : place <= Math.ceil(draft.managers.length * .45) ? 'B+' : place <= Math.ceil(draft.managers.length * .7) ? 'B' : 'C+';
  const wins = Math.max(5, Math.min(11, Math.round(10 - (place - 1) * 5 / Math.max(1, draft.managers.length - 1))));
  return <BroadcastStage scene="tunnel" page="fantasy-franchise" quiet className="min-h-[100dvh] bg-[#07090c] px-4 py-6 text-white"><div className="mx-auto max-w-3xl"><section className="rounded-[2rem] border border-[#D4AF37]/30 bg-[#101318] p-6 text-center"><img src={draft.setup.logoUrl} alt={`${user.name} logo`} className="mx-auto h-24 w-24 rounded-3xl border border-[#D4AF37]/30 bg-white object-contain p-1" /><div className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-[#D4AF37]">{draft.setup.leagueName}</div><h1 className="mt-1 text-4xl font-black uppercase">Draft Complete</h1><p className="mt-2 text-sm text-zinc-400">{user.location} · {user.name}</p><div className="mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-black/30 p-4"><Stat label="Draft Grade" value={grade} /><Stat label="Projected" value={`${wins}-${14 - wins}`} /><Stat label="League Rank" value={`#${place}`} /></div><p className="mt-4 text-xs font-semibold leading-5 text-zinc-400">Your roster scored {score} in the preseason model based on simulated projections, positional balance, and draft value.</p><button onClick={onEnterLeague} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] text-sm font-black uppercase text-black"><Trophy className="h-5 w-5" />Enter League HQ</button><button onClick={onNewLeague} className="mt-2 min-h-11 w-full text-xs font-black uppercase text-zinc-500"><RotateCcw className="mr-2 inline h-4 w-4" />Create New League</button></section></div></BroadcastStage>;
}

function SoloLeagueHome({ draft, onBack, onNewLeague }: { draft: SoloFantasyDraftState; onBack: () => void; onNewLeague: () => void }) {
  const [tab, setTab] = useState<LeagueTab>('overview');
  const user = draft.managers.find(manager => manager.isUser)!;
  const roster = soloFantasyRoster(draft, user.id);
  const standings = draft.managers.map(manager => ({ manager, score: soloFantasyManagerScore(draft, manager.id) })).sort((a, b) => b.score - a.score);
  const opponent = standings.find(item => !item.manager.isUser)?.manager ?? standings[1].manager;
  return <BroadcastStage scene="field" page="fantasy-franchise" quiet className="min-h-[100dvh] bg-[#07090c] px-3 pb-12 pt-4 text-white sm:px-6"><div className="mx-auto max-w-5xl"><header className="flex items-center gap-3"><button onClick={onBack} aria-label="Back to Solo Franchise Hub" className="grid h-11 w-11 place-items-center border border-white/10"><ArrowLeft /></button><img src={draft.setup.logoUrl} alt="" className="h-14 w-14 rounded-2xl border border-[#D4AF37]/30 bg-white object-contain p-1" /><div className="min-w-0 flex-1"><div className="truncate text-2xl font-black uppercase">{draft.setup.leagueName}</div><div className="truncate text-xs font-bold text-zinc-500"><MapPin className="mr-1 inline h-3.5 w-3.5" />{user.location} · {draft.managers.length} teams</div></div><button onClick={onNewLeague} aria-label="Create new Solo fantasy league" className="grid h-11 w-11 place-items-center border border-white/10"><RotateCcw className="h-4 w-4" /></button></header><nav aria-label="Solo fantasy league" className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-[#101318] p-1">{(['overview', 'roster', 'results'] as LeagueTab[]).map(item => <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)} className={`min-h-11 text-[10px] font-black uppercase ${tab === item ? 'bg-[#D4AF37] text-black' : 'text-zinc-500'}`}>{item === 'roster' ? 'My Team' : item === 'results' ? 'Draft Results' : 'Overview'}</button>)}</nav>
    {tab === 'overview' ? <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-[#D4AF37]/20 bg-[#101318] p-5"><div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Week 1</div><h2 className="mt-1 text-2xl font-black uppercase">League Ready</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Your custom league and every CPU roster are saved. The live-style draft is complete and your lineup is ready for opening week.</p><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><TeamBlock manager={user} /><b className="text-zinc-600">VS</b><TeamBlock manager={opponent} /></div></section><section className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex justify-between"><h2 className="text-sm font-black uppercase text-[#D4AF37]">Preseason Power Rankings</h2><Users className="h-4 w-4 text-zinc-600" /></div><div className="mt-3 space-y-2">{standings.map((item, index) => <div key={item.manager.id} className="grid grid-cols-[24px_32px_minmax(0,1fr)_40px] items-center gap-2 rounded-lg bg-black/30 p-2 text-xs"><b className="text-[#D4AF37]">{index + 1}</b><ManagerLogo manager={item.manager} small /><span className="truncate font-black">{item.manager.name}</span><b>{item.score}</b></div>)}</div></section></div> : null}
    {tab === 'roster' ? <section className="mt-4 rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center gap-3"><img src={user.logoUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-contain" /><div><h2 className="text-xl font-black uppercase">{user.name}</h2><div className="text-xs text-zinc-500">{roster.length} players · {user.location}</div></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{roster.map(player => <PlayerChip key={player.id} player={player} label={`${soloFantasyProjection(player).toFixed(1)} proj`} />)}</div></section> : null}
    {tab === 'results' ? <section className="mt-4 rounded-2xl border border-white/10 bg-[#101318] p-4"><h2 className="text-sm font-black uppercase text-[#D4AF37]">Complete Draft Results</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{draft.picks.map(pick => <div key={pick.overall} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-black/30 p-2 text-xs"><b className="text-[#D4AF37]">#{pick.overall}</b><div className="min-w-0"><div className="truncate font-black">{SOLO_FANTASY_PLAYER_BY_ID.get(pick.playerId)?.name}</div><div className="truncate text-[10px] text-zinc-600">{draft.managers.find(manager => manager.id === pick.managerId)?.name}</div></div><b>{pick.group}</b></div>)}</div></section> : null}
  </div></BroadcastStage>;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">{label}</span>{children}</label>;
const ManagerLogo = ({ manager, small = false }: { manager?: SoloFantasyManager; small?: boolean }) => <div className={`${small ? 'h-6 w-6' : 'h-7 w-7'} shrink-0 overflow-hidden rounded-md border border-white/10 bg-white`}><img src={manager?.logoUrl} alt="" className="h-full w-full object-contain" /></div>;
const PlayerAvatar = ({ player, small = false }: { player: Player; small?: boolean }) => player.position === 'DST' ? <div className={`${small ? 'h-8 w-8' : 'h-9 w-9 sm:h-12 sm:w-12'} overflow-hidden rounded-lg bg-white p-0.5`}><img src={soloTeamLogoUrl(player.team)} alt="" className="h-full w-full object-contain" /></div> : <div className={`${small ? 'h-8 w-8 text-[9px]' : 'h-9 w-9 text-[10px] sm:h-12 sm:w-12 sm:text-xs'} grid shrink-0 place-items-center rounded-lg border border-[#D4AF37]/25 bg-[#181d25] font-black text-[#D4AF37]`}>{player.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div>;
const PlayerChip = ({ player, label }: { player?: Player; label: string }) => player ? <div className="flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5 text-xs"><PlayerAvatar player={player} small /><span className="min-w-0 flex-1 truncate"><b>{player.position}</b> {player.name}</span><b className="shrink-0 text-[10px] text-[#D4AF37]">{label}</b></div> : null;
const Preference = ({ active, danger = false, label, onClick, children }: { active: boolean; danger?: boolean; label: string; onClick: () => void; children: React.ReactElement<{ className?: string }> }) => <button type="button" aria-pressed={active} onClick={onClick} className={`bk-fantasy-compact-button flex items-center justify-center gap-1 border px-1 text-[8px] font-black uppercase ${active ? danger ? 'border-red-400/40 bg-red-400/10 text-red-300' : 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-zinc-500'}`}>{React.cloneElement(children, { className: 'h-3.5 w-3.5' })}{label}</button>;
const Stat = ({ label, value }: { label: string; value: string }) => <div><div className="text-[8px] font-black uppercase tracking-wider text-zinc-600">{label}</div><div className="mt-1 text-2xl font-black text-[#D4AF37]">{value}</div></div>;
const TeamBlock = ({ manager }: { manager: SoloFantasyManager }) => <div className="min-w-0"><img src={manager.logoUrl} alt="" className="mx-auto h-16 w-16 rounded-2xl bg-white object-contain p-1" /><div className="mt-2 truncate text-sm font-black uppercase">{manager.name}</div><div className="truncate text-[9px] text-zinc-600">{manager.location}</div></div>;
