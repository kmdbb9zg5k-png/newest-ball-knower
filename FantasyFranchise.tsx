import { BroadcastStage } from './BroadcastScene';
import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, Play, RotateCcw, Search, Shuffle, Upload } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { playerPortraitFallbackUrl } from './playerPortraits';
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
import { SOLO_TEAM_THEMES } from './soloUniverse';
import { Player } from './types';

type Props = { onBack: () => void };
type FantasyIdentity = { leagueName: string; teamName: string; location: string; logoUrl: string };
type FantasySave = { version: 3; draft: FantasyDraftState; seasonStarted: boolean; identity: FantasyIdentity };

const STOCK_LOGOS = [
  { name: 'Flight Collective', url: '/solo-fantasy-logos/flight-collective.jpeg' },
  { name: 'Gridiron Shield', url: '/solo-fantasy-logos/gridiron-shield.jpeg' },
  { name: 'Champions Circle', url: '/solo-fantasy-logos/champions-circle.jpeg' },
  { name: 'Neon Guardians', url: '/solo-fantasy-logos/neon-guardians.jpeg' },
] as const;

function restoreFantasy(): FantasySave | null {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.fantasy);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const draft = saved?.draft;
    if (saved?.version !== 3 || typeof saved.seasonStarted !== 'boolean' || !saved.identity || ![saved.identity.leagueName, saved.identity.teamName, saved.identity.location, saved.identity.logoUrl].every((field: unknown) => typeof field === 'string' && field.trim()) || !isValidFantasyDraftState(draft, saved.seasonStarted)) return null;
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


function resizeLogo(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file for your logo.'));
    if (file.size > 12 * 1024 * 1024) return reject(new Error('Choose an image under 12 MB.'));
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('This device could not prepare the logo.');
        context.fillStyle = '#fff'; context.fillRect(0, 0, 512, 512);
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 512, 512);
        resolve(canvas.toDataURL('image/jpeg', .84));
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(objectUrl); }
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('That image format could not be opened on this device.')); };
    image.src = objectUrl;
  });
}

function LeagueCreator({ onBack, onCreate }: { onBack: () => void; onCreate: (identity: FantasyIdentity) => void }) {
  const [leagueName, setLeagueName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [location, setLocation] = useState('');
  const [logoUrl, setLogoUrl] = useState<string>(STOCK_LOGOS[0].url);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = leagueName.trim().length >= 3 && teamName.trim().length >= 2 && location.trim().length >= 2;
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError('');
    try { setLogoUrl(await resizeLogo(file)); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'The logo could not be prepared.'); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  return <BroadcastStage scene="tunnel" page="fantasy-franchise" quiet={true} className="min-h-[100dvh] bg-transparent px-4 pb-12 pt-4 text-white sm:px-8"><div className="mx-auto max-w-3xl">
    <button type="button" onClick={onBack} aria-label="Back to Solo Franchise Hub" className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]"><ArrowLeft size={19} /></button>
    <section className="mt-4 overflow-hidden rounded-[2rem] border border-[#D4AF37]/25 bg-[#0c1016]">
      <div className="border-b border-white/10 p-5 sm:p-8"><div className="flex items-center gap-2 text-[#D4AF37]"><Shuffle size={18} /><span className="text-[10px] font-black tracking-[.22em]">MADDEN-STYLE FANTASY FRANCHISE</span></div><h1 className="mt-3 text-4xl font-black uppercase">Create Your League</h1><p className="mt-3 text-sm font-semibold leading-6 text-zinc-400">Build a custom football team, draft a complete 53-man roster from the simulated player universe, then play the full season.</p></div>
      <div className="space-y-6 p-5 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="League name"><input value={leagueName} onChange={event => setLeagueName(event.target.value)} maxLength={40} placeholder="Lehigh Valley Football League" className="w-full border border-white/10 bg-black/30 px-3 py-3 font-bold outline-none" /></Field><Field label="Your team name"><input value={teamName} onChange={event => setTeamName(event.target.value)} maxLength={32} placeholder="Iron" className="w-full border border-white/10 bg-black/30 px-3 py-3 font-bold outline-none" /></Field><Field label="Team location"><div className="relative"><MapPin className="absolute left-3 top-3.5 h-4 w-4 text-[#D4AF37]" /><input value={location} onChange={event => setLocation(event.target.value)} maxLength={40} placeholder="Allentown, PA" className="w-full border border-white/10 bg-black/30 py-3 pl-10 pr-3 font-bold outline-none" /></div></Field><div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase text-zinc-500">League format</div><div className="mt-1 font-black">32 teams · 53 rounds</div></div></div>
        <div><div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-[#D4AF37]">Team logo</div><p className="mt-1 text-xs text-zinc-500">Choose a supplied logo or upload your own photo.</p></div><img src={logoUrl} alt="Selected team logo" className="h-16 w-16 rounded-2xl border border-[#D4AF37]/35 bg-white object-contain p-1" /></div><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{STOCK_LOGOS.map(option => <button key={option.url} type="button" aria-label={'Use ' + option.name + ' logo'} aria-pressed={logoUrl === option.url} onClick={() => setLogoUrl(option.url)} className={'aspect-square overflow-hidden rounded-2xl border bg-white p-1 ' + (logoUrl === option.url ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-white/10')}><img src={option.url} alt="" className="h-full w-full object-contain" /></button>)}<button type="button" onClick={() => inputRef.current?.click()} aria-label="Upload custom team logo" className="grid aspect-square place-items-center rounded-2xl border border-dashed border-white/20 bg-white/5 text-zinc-400">{uploading ? <span className="text-[9px] font-black">PREPARING…</span> : <span className="text-center text-[9px] font-black uppercase"><Upload className="mx-auto mb-1 h-5 w-5" />Upload<br />Photo</span>}</button><input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={event => void upload(event.target.files?.[0])} /></div></div>
        {error ? <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs font-bold text-red-200">{error}</p> : null}
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] p-4 text-xs font-semibold leading-5 text-emerald-100"><CheckCircle2 className="mr-2 inline h-4 w-4" />Full offense, defense and special teams · 17-game season · playoffs · Legacy Bowl · offseason rookie drafts</div>
        <button type="button" disabled={!valid || uploading} onClick={() => onCreate({ leagueName: leagueName.trim(), teamName: teamName.trim(), location: location.trim(), logoUrl })} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] text-sm font-black uppercase text-black disabled:opacity-35"><Play className="h-5 w-5" />Create League & Start Draft</button>
      </div>
    </section>
  </div></BroadcastStage>;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">{label}</span>{children}</label>;

export const FantasyFranchise: React.FC<Props> = ({ onBack }) => {
  const restored = useMemo(restoreFantasy, []);
  const selectedAbbr = restored?.draft.userTeamAbbr ?? SOLO_TEAM_THEMES[0].abbr;
  const [identity, setIdentity] = useState<FantasyIdentity | null>(() => restored?.identity ?? null);
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

  const startDraft = (nextIdentity: FantasyIdentity) => {
    const next = createFantasyDraft(selectedAbbr);
    const save: FantasySave = { version: 3, draft: next, seasonStarted: false, identity: nextIdentity };
    const saved = saveFantasy(save);
    removeFantasySave(`${SOLO_FRANCHISE_SAVE_KEYS.fantasy}:season`);
    setIdentity(nextIdentity);
    setDraft(next);
    setSeasonStarted(false);
    setMessage(saved ? `You have pick #${next.teamOrder.indexOf(next.userTeamAbbr) + 1}. You are on the clock.` : 'Draft started, but Safari could not save it. Keep this page open to continue.');
  };

  const selectPlayer = async (player: Player) => {
    if (!draft || isPicking || fantasyDraftTeamAt(draft) !== draft.userTeamAbbr) return;
    setIsPicking(true);
    setMessage(`${player.name} selected. CPU teams are drafting…`);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    try {
      const next = makeFantasyUserPick(draft, player.id);
      setDraft(next);
      const saved = saveFantasy({ version: 3, draft: next, seasonStarted: false, identity: identity! });
      setMessage(!saved ? 'Pick completed, but Safari could not save it. Keep this page open.' : fantasyDraftComplete(next) ? 'Fantasy Draft complete. Your franchise is ready.' : `Round ${Math.floor(next.pickIndex / 32) + 1}: you are back on the clock.`);
    } finally {
      setIsPicking(false);
    }
  };

  const beginSeason = () => {
    if (!draft || !fantasyDraftComplete(draft)) return;
    setSeasonStarted(true);
    if (!saveFantasy({ version: 3, draft, seasonStarted: true, identity: identity! })) setMessage('Season started, but Safari could not save it. Keep this page open.');
  };

  const newCareer = () => {
    removeFantasySave(SOLO_FRANCHISE_SAVE_KEYS.fantasy);
    removeFantasySave(`${SOLO_FRANCHISE_SAVE_KEYS.fantasy}:season`);
    setIdentity(null);
    setDraft(null);
    setSeasonStarted(false);
    setMessage('');
  };

  if (draft && seasonStarted && identity) {
    const opponentRosters = Object.fromEntries(SOLO_TEAM_THEMES.map(team => [team.abbr, fantasyRosterPlayers(draft, team.abbr)]));
    const customTeam = { ...fantasyTeam(draft.userTeamAbbr), name: identity.teamName };
    return (
      <BroadcastStage scene="tunnel" page="fantasy-franchise" quiet={true} className="relative">
        <button type="button" onClick={newCareer} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/90 px-4 text-xs font-black shadow-xl"><RotateCcw size={15} /> NEW LEAGUE</button>
        <FranchiseSeason title={identity.leagueName} userTeam={customTeam} userLogoUrl={identity.logoUrl} userLocation={identity.location} roster={userRoster} opponentRosters={opponentRosters} saveKey={SOLO_FRANCHISE_SAVE_KEYS.fantasy} onBack={onBack} />
      </BroadcastStage>
    );
  }

  if (!draft || !identity) {
    return <LeagueCreator onBack={onBack} onCreate={startDraft} />;
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
    <BroadcastStage scene="tunnel" page="fantasy-franchise" quiet={true} className="min-h-[100dvh] bg-transparent px-4 pb-12 pt-4 text-white sm:px-8">
      <div className="mx-auto min-w-0 max-w-7xl">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1"><div className="text-[10px] font-black tracking-[.2em] text-[var(--bk-team-accent)]">FANTASY DRAFT • ROUND {round}/{FANTASY_DRAFT_ROUNDS}</div><div className="truncate text-xl font-black">{identity.teamName} • PICK SLOT #{userSlot}</div></div>
          <button type="button" onClick={newCareer} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Start a new Fantasy Draft"><RotateCcw size={17} /></button>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-4 py-3 text-sm font-bold text-[var(--bk-team-accent)]">{message}</div> : null}

        {complete ? (
          <div className="mt-5 rounded-[2rem] border border-white/10 bg-[#10151d] p-6 text-center">
            <img src={identity.logoUrl} alt={`${identity.teamName} logo`} className="mx-auto h-24 w-24 rounded-3xl bg-white object-contain p-1" />
            <h2 className="mt-3 text-4xl font-black">DRAFT COMPLETE</h2>
            <p className="mt-2 text-zinc-400">Your full 53-man football roster is ready for a 17-game season.</p>
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
    </BroadcastStage>
  );
};

const DraftPlayer = ({ player, disabled, onSelect }: { key?: React.Key; player: Player; disabled: boolean; onSelect: () => void }) => {
  const portrait = playerPortraitFallbackUrl(player);
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
