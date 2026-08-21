import React, { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Dumbbell, Play, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { buildRealTeamRoster, SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { getDraftPositionGroup } from './rosterRules';
import { TEAM_THEMES, teamLogoUrl } from './teamTheme';
import { Player } from './types';
import { ensureOnlineSession, supabase } from './supabase';
import {
  isMyPlayerProfileCustomized,
  MY_PLAYER_EMPTY_PROFILE,
  MY_PLAYER_POSITIONS,
  MyPlayerProfile,
  parseMyPlayerSave,
} from './myPlayerSave';

type Props = { onBack: () => void };
type UpgradeAttribute = 'speed' | 'power' | 'awareness';
type BodySliderKey = 'heightInches' | 'weightLbs' | 'bodyBuild' | 'shoulderWidth' | 'armSize' | 'legSize' | 'viewRotation';

const POSITIONS = MY_PLAYER_POSITIONS;
const EMPTY_PROFILE = MY_PLAYER_EMPTY_PROFILE;

function restoreProfile(): MyPlayerProfile {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.player);
    if (!raw) return EMPTY_PROFILE;
    const saved = parseMyPlayerSave(raw);
    if (!saved) {
      localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.player);
      return EMPTY_PROFILE;
    }
    return saved;
  } catch {
    return EMPTY_PROFILE;
  }
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

async function compressImage(source: File | string, maxSize = 640, quality = 0.76) {
  const dataUrl = typeof source === 'string' ? source : await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(source);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function playerFromProfile(profile: MyPlayerProfile): Player {
  const team = TEAM_THEMES.find(item => item.abbr === profile.teamAbbr) ?? TEAM_THEMES[0];
  return {
    id: 'my-player-user',
    playerId: 'my-player-user',
    teamId: team.abbr,
    team: team.abbr,
    teamAbbreviation: team.abbr,
    teamCity: team.name.split(' ').slice(0, -1).join(' '),
    teamName: team.name,
    name: profile.name || 'My Player',
    fullName: profile.name || 'My Player',
    position: profile.position,
    jerseyNumber: profile.number,
    starter: true,
    active: true,
    ovr: profile.overall,
    overall: profile.overall,
    overallRating: profile.overall,
    ratingSource: 'Ball Knower Career',
    ratingSeason: 2026,
    salary: 1.1,
    salaryType: 'estimated',
    archetype: 'Created Player',
    speed: profile.speed,
    strength: profile.power,
    awareness: profile.awareness,
    attributes: {
      athleticism: Math.round((profile.speed + profile.power) / 2),
      footballIQ: profile.awareness,
      passing: profile.position === 'QB' ? profile.overall : undefined,
      rushing: ['QB', 'RB'].includes(profile.position) ? profile.overall : undefined,
      receiving: ['WR', 'TE', 'RB'].includes(profile.position) ? profile.overall : undefined,
      passRush: profile.position === 'EDGE' ? profile.overall : undefined,
      runDefense: ['EDGE', 'LB'].includes(profile.position) ? profile.overall : undefined,
      coverage: ['LB', 'CB', 'S'].includes(profile.position) ? profile.overall : undefined,
    },
  };
}

function rosterWithMyPlayer(profile: MyPlayerProfile) {
  const created = playerFromProfile(profile);
  const roster = buildRealTeamRoster(profile.teamAbbr);
  const group = getDraftPositionGroup(created);
  const replaceable = roster
    .map((player, index) => ({ player, index }))
    .filter(item => getDraftPositionGroup(item.player) === group)
    .sort((first, second) => first.player.ovr - second.player.ovr)[0];
  if (replaceable) roster[replaceable.index] = created;
  else roster[roster.length - 1] = created;
  return roster;
}

const feetAndInches = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}\"`;

export const MyPlayerStory: React.FC<Props> = ({ onBack }) => {
  const [profile, setProfile] = useState<MyPlayerProfile>(restoreProfile);
  const [message, setMessage] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const draftedTeam = TEAM_THEMES.find(team => team.abbr === profile.teamAbbr) ?? null;

  useEffect(() => {
    try {
      const untouched = profile.stage === 'creator' && !isMyPlayerProfileCustomized(profile);
      if (untouched) localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.player);
      else localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.player, JSON.stringify(profile));
    } catch (error) {
      console.warn('Unable to save My Player career', error);
    }
  }, [profile]);

  useEffect(() => {
    let active = true;
    fetch('/api/my-player-art')
      .then(response => response.json())
      .then(result => { if (active) setAiAvailable(Boolean(result.available)); })
      .catch(() => { if (active) setAiAvailable(false); });
    return () => { active = false; };
  }, []);

  const updateSlider = (key: BodySliderKey, value: number) => {
    setProfile(current => ({ ...current, [key]: value, renderImage: key === 'viewRotation' ? current.renderImage : '' }));
  };

  const onFace = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMessage('Choose a photo from your camera or photo library.');
    try {
      const faceImage = await compressImage(file, 512, 0.78);
      setProfile(current => ({ ...current, faceImage, renderImage: '' }));
      setMessage('Face uploaded. Shape your player with the sliders, then describe the details you want.');
    } catch {
      setMessage('That photo could not be opened. Try a clear selfie.');
    }
  };

  const createRender = async () => {
    if (!profile.faceImage) return setMessage('Upload a selfie first.');
    setIsRendering(true);
    setMessage('Creating your player render…');
    try {
      await ensureOnlineSession();
      const { data: authData } = await supabase!.auth.getSession();
      const accessToken = authData.session?.access_token;
      if (!accessToken) throw new Error('Sign in before creating a player render.');
      const bodyDescription = `${feetAndInches(profile.heightInches)}, ${profile.weightLbs} pounds, body build ${profile.bodyBuild}/100, shoulder width ${profile.shoulderWidth}/100, arm size ${profile.armSize}/100, leg size ${profile.legSize}/100`;
      const response = await fetch('/api/my-player-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ image: profile.faceImage, prompt: profile.appearancePrompt, bodyDescription, position: profile.position, number: profile.number, team: 'a future pro team' }),
      });
      const result = await response.json();
      if (!response.ok || !result.image) throw new Error(result.error || 'Render unavailable');
      const renderImage = await compressImage(result.image, 720, 0.78);
      setProfile(current => ({ ...current, renderImage }));
      setMessage('Player render created. You can keep changing sliders or the description.');
    } catch (error: any) {
      const detail = String(error?.message || '');
      if (detail.includes('configured')) setMessage('Your creator is ready. Photorealistic AI rendering will activate when the image service is connected.');
      else if (detail.includes('four player renders')) setMessage('You used today’s four AI player renders. Your career and current preview still work; try another render tomorrow.');
      else if (detail.includes('session expired') || detail.includes('Sign in')) setMessage('Your sign-in needs to be refreshed before another AI render. Your current player is safe.');
      else if (detail.includes('Please wait')) setMessage('The renderer needs a short breather. Wait a minute, then try again.');
      else setMessage('The AI render is unavailable right now, but your third-person player preview and career still work.');
    } finally {
      setIsRendering(false);
    }
  };

  const enterCombine = () => {
    if (!profile.name.trim()) return setMessage('Give your player a name.');
    if (!profile.faceImage) return setMessage('Upload a selfie so the career belongs to you.');
    setProfile(current => ({ ...current, name: current.name.trim(), stage: 'combine' }));
    setMessage('You have been invited to the Ball Knower Combine.');
  };

  const enterDraft = () => {
    const value = hash(`${profile.name}:${profile.position}:${profile.number}:${profile.heightInches}:${profile.weightLbs}`);
    const team = TEAM_THEMES[value % TEAM_THEMES.length];
    const draftRound = 1 + (value % 4);
    const draftPick = 1 + ((value >>> 5) % 32);
    setProfile(current => ({ ...current, stage: 'drafted', teamAbbr: team.abbr, draftRound, draftPick }));
    setMessage(`${team.name} selected you in Round ${draftRound}.`);
  };

  const beginSeason = () => {
    try { localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.player}:season`); } catch (error) { console.warn('Unable to clear My Player season', error); }
    setProfile(current => ({ ...current, stage: 'season' }));
  };

  const awardXp = (fantasyScore: number, won: boolean) => {
    setProfile(current => {
      const earned = Math.max(12, Math.round(fantasyScore * 4) + (won ? 10 : 0));
      const total = current.xp + earned;
      const points = Math.floor(total / 100);
      return { ...current, xp: total % 100, upgradePoints: current.upgradePoints + points, gamesPlayed: current.gamesPlayed + 1 };
    });
  };

  const upgrade = (attribute: UpgradeAttribute) => {
    if (profile.upgradePoints < 1 || profile.overall >= 99) return;
    setProfile(current => ({
      ...current,
      upgradePoints: current.upgradePoints - 1,
      overall: Math.min(99, current.overall + 1),
      [attribute]: Math.min(99, current[attribute] + 2),
    }));
  };

  const newCareer = () => {
    try {
      localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.player);
      localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.player}:season`);
    } catch (error) {
      console.warn('Unable to clear My Player career', error);
    }
    setProfile(EMPTY_PROFILE);
    setMessage('');
  };

  if (profile.stage === 'season' && draftedTeam) {
    const roster = rosterWithMyPlayer(profile);
    return (
      <div className="relative pb-20">
        <div className="px-4 pt-4 sm:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-black/25 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
              <PlayerRender profile={profile} compact />
              <div className="px-2 pb-2 sm:pb-0">
                <div className="text-[10px] font-black tracking-[.2em] text-[var(--bk-team-accent)]">YOUR ROOKIE</div>
                <div className="mt-1 text-2xl font-black">{profile.name} • #{profile.number} • {profile.position}</div>
                <div className="mt-1 text-xs font-bold text-zinc-500">{feetAndInches(profile.heightInches)} • {profile.weightLbs} LB • {profile.overall} OVR • {draftedTeam.name}</div>
                <ViewSlider value={profile.viewRotation} onChange={value => updateSlider('viewRotation', value)} />
              </div>
            </div>
          </div>
        </div>
        <FranchiseSeason title="MY PLAYER STORY" userTeam={draftedTeam} roster={roster} saveKey={SOLO_FRANCHISE_SAVE_KEYS.player} onBack={onBack} myPlayerId="my-player-user" onMyPlayerGame={awardXp} />
        <button type="button" onClick={newCareer} style={{ bottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 4.5rem)' }} className="fixed right-4 z-30 flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-black/95 px-3 text-[10px] font-black shadow-xl"><RotateCcw size={14} /> NEW PLAYER</button>
        <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-black/95 p-2 shadow-2xl">
          <div className="min-w-0 flex-1 px-2"><div className="truncate text-xs font-black">{profile.name} • {profile.overall} OVR</div><div className="text-[10px] text-zinc-500">XP {profile.xp}/100 • {profile.upgradePoints} UPGRADE POINT{profile.upgradePoints === 1 ? '' : 'S'}</div></div>
          {(['speed', 'power', 'awareness'] as UpgradeAttribute[]).map(attribute => <button key={attribute} type="button" disabled={!profile.upgradePoints || profile.overall >= 99} onClick={() => upgrade(attribute)} className="min-h-10 rounded-xl border border-[var(--bk-team-accent)]/30 px-2 text-[9px] font-black uppercase text-[var(--bk-team-accent)] disabled:opacity-30">+ {attribute}</button>)}
        </div>
      </div>
    );
  }

  const stageTitle = profile.stage === 'creator' ? 'CREATE' : profile.stage === 'combine' ? 'NFL COMBINE' : 'DRAFT NIGHT';

  return (
    <div className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft size={19} /></button>
          <div className="text-center"><div className="text-[10px] font-black tracking-[.22em] text-[var(--bk-team-accent)]">MY PLAYER STORY</div><div className="text-sm font-black">{stageTitle}</div></div>
          <button type="button" onClick={newCareer} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Create a new player"><RotateCcw size={17} /></button>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-4 py-3 text-sm font-bold text-[var(--bk-team-accent)]">{message}</div> : null}

        {profile.stage === 'creator' ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <PlayerRender profile={profile} />
              <ViewSlider value={profile.viewRotation} onChange={value => updateSlider('viewRotation', value)} />
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-[#10151d] p-5 sm:p-7">
              <h2 className="text-3xl font-black">BUILD YOUR PLAYER</h2>
              <p className="mt-2 text-sm font-semibold text-zinc-400">Upload a clear selfie, choose your position, shape the body with sliders, then describe details like tattoos, visor and gloves.</p>
              <label className="mt-5 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 font-black"><Upload size={18} /> {profile.faceImage ? 'CHANGE SELFIE' : 'UPLOAD SELFIE'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={event => onFace(event.target.files?.[0])} className="sr-only" /></label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-[10px] font-black text-zinc-500">PLAYER NAME<input value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#151515] p-3 text-sm text-white outline-none" placeholder="Your name" /></label>
                <label className="text-[10px] font-black text-zinc-500">JERSEY NUMBER<input type="number" min="0" max="99" value={profile.number} onChange={event => setProfile(current => ({ ...current, number: Math.max(0, Math.min(99, Number(event.target.value) || 0)) }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#151515] p-3 text-sm text-white outline-none" /></label>
              </div>
              <div className="mt-4"><div className="text-[10px] font-black text-zinc-500">POSITION</div><div className="mt-2 flex flex-wrap gap-2">{POSITIONS.map(position => <button key={position} type="button" aria-pressed={profile.position===position} onClick={() => setProfile(current => ({ ...current, position, renderImage: '' }))} className={`min-h-10 rounded-xl border px-3 text-xs font-black ${profile.position === position ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]' : 'border-white/10 bg-[#151515] text-zinc-400'}`}>{position}</button>)}</div></div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-black tracking-[.18em] text-[var(--bk-team-accent)]">BODY BUILDER</span><span className="text-[10px] font-bold text-zinc-500">LIVE PREVIEW</span></div>
                <BodySlider label="HEIGHT" value={profile.heightInches} min={66} max={80} display={feetAndInches(profile.heightInches)} onChange={value => updateSlider('heightInches', value)} />
                <BodySlider label="WEIGHT" value={profile.weightLbs} min={165} max={360} display={`${profile.weightLbs} LB`} onChange={value => updateSlider('weightLbs', value)} />
                <BodySlider label="BODY BUILD" value={profile.bodyBuild} min={0} max={100} display={profile.bodyBuild < 34 ? 'LEAN' : profile.bodyBuild < 67 ? 'ATHLETIC' : 'POWER'} onChange={value => updateSlider('bodyBuild', value)} />
                <BodySlider label="SHOULDERS" value={profile.shoulderWidth} min={0} max={100} display={`${profile.shoulderWidth}%`} onChange={value => updateSlider('shoulderWidth', value)} />
                <BodySlider label="ARMS" value={profile.armSize} min={0} max={100} display={`${profile.armSize}%`} onChange={value => updateSlider('armSize', value)} />
                <BodySlider label="LEGS" value={profile.legSize} min={0} max={100} display={`${profile.legSize}%`} onChange={value => updateSlider('legSize', value)} />
              </div>

              <label className="mt-4 block text-[10px] font-black text-zinc-500">DESCRIBE YOUR LOOK<textarea value={profile.appearancePrompt} onChange={event => setProfile(current => ({ ...current, appearancePrompt: event.target.value.slice(0, 280), renderImage: '' }))} className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-[#151515] p-3 text-sm text-white outline-none" placeholder="Add a tattoo sleeve, dark visor, white gloves…" /></label>
              <button type="button" disabled={isRendering || !profile.faceImage || aiAvailable === false} onClick={createRender} className="mt-3 w-full rounded-2xl border border-[var(--bk-team-accent)]/40 py-3 font-black text-[var(--bk-team-accent)] disabled:opacity-40"><Sparkles className="mr-2 inline" size={18} /> {isRendering ? 'CREATING RENDER…' : aiAvailable === false ? 'AI RENDER NEEDS CONNECTION' : 'CREATE AI PLAYER RENDER'}</button>
              {aiAvailable === false ? <p className="mt-2 text-center text-[10px] font-bold text-zinc-500">The built-in third-person preview and full career still work while the photorealistic image service is offline.</p> : null}
              <button type="button" onClick={enterCombine} className="mt-3 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"><Play className="mr-2 inline" /> ENTER THE COMBINE</button>
            </div>
          </div>
        ) : null}

        {profile.stage === 'combine' ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <div><PlayerRender profile={profile} /><ViewSlider value={profile.viewRotation} onChange={value => updateSlider('viewRotation', value)} /></div>
            <Combine profile={profile} onDraft={enterDraft} />
          </div>
        ) : null}

        {profile.stage === 'drafted' && draftedTeam ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <div><PlayerRender profile={profile} /><ViewSlider value={profile.viewRotation} onChange={value => updateSlider('viewRotation', value)} /></div>
            <div className="rounded-[2rem] border border-white/10 bg-[#10151d] p-7 text-center">
              <div className="text-[10px] font-black tracking-[.25em] text-[var(--bk-team-accent)]">WITH THE #{profile.draftPick} PICK IN ROUND {profile.draftRound}</div>
              <img src={teamLogoUrl(draftedTeam.abbr)} alt="" aria-hidden="true" className="mx-auto mt-5 h-28 w-28 object-contain" />
              <h2 className="mt-4 text-4xl font-black">{draftedTeam.name}</h2>
              <p className="mt-2 text-zinc-400">select {profile.name}, {profile.position}, {feetAndInches(profile.heightInches)}, {profile.weightLbs} lbs. Your NFL story starts now.</p>
              <button type="button" onClick={beginSeason} className="mt-6 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"><Play className="mr-2 inline" /> BEGIN ROOKIE SEASON</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const BodySlider = ({ label, value, min, max, display, onChange }: { label: string; value: number; min: number; max: number; display: string; onChange: (value: number) => void }) => (
  <label className="mt-3 block">
    <div className="mb-1.5 flex items-center justify-between text-[10px] font-black"><span className="text-zinc-500">{label}</span><span className="text-white">{display}</span></div>
    <div className="flex min-h-11 items-center">
      <input aria-label={label} type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer accent-[var(--bk-team-accent)]" />
    </div>
  </label>
);

const ViewSlider = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
  <label className="mt-3 block rounded-2xl border border-white/10 bg-[#111] p-3">
    <div className="mb-2 flex items-center justify-between text-[10px] font-black"><span className="text-zinc-500">ROTATE PLAYER</span><span className="text-[var(--bk-team-accent)]">{value}°</span></div>
    <div className="flex min-h-11 items-center">
      <input aria-label="Rotate player view" type="range" min="-180" max="180" step="5" value={value} onChange={event => onChange(Number(event.target.value))} className="h-11 w-full cursor-grab accent-[var(--bk-team-accent)] active:cursor-grabbing" />
    </div>
    <div className="mt-1 flex justify-between text-[8px] font-bold text-zinc-600"><span>BACK</span><span>FRONT</span><span>BACK</span></div>
  </label>
);

const PlayerRender = ({ profile, compact = false }: { profile: MyPlayerProfile; compact?: boolean }) => {
  const prompt = profile.appearancePrompt.toLowerCase();
  const tags = [
    /tattoo/.test(prompt) ? 'TATTOO SLEEVE' : '',
    /visor/.test(prompt) ? 'VISOR' : '',
    /glove/.test(prompt) ? 'GLOVES' : '',
    /arm sleeve/.test(prompt) ? 'ARM SLEEVE' : '',
  ].filter(Boolean);

  if (profile.renderImage) return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111] ${compact ? 'h-[260px]' : ''}`}>
      <img src={profile.renderImage} alt={`${profile.name || 'Created player'} render`} className={`${compact ? 'h-full' : 'aspect-[4/5] h-full'} w-full object-cover`} style={{ transform: `perspective(900px) rotateY(${profile.viewRotation * 0.12}deg) scale(${compact ? 1.05 : 1})`, transition: 'transform 120ms ease-out' }} />
      <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[9px] font-black">{feetAndInches(profile.heightInches)} • {profile.weightLbs} LB</div>
    </div>
  );

  const heightScale = 0.88 + ((profile.heightInches - 66) / 14) * 0.18;
  const weightScale = 0.88 + ((profile.weightLbs - 165) / 195) * 0.3;
  const shoulderScale = 0.88 + profile.shoulderWidth / 100 * 0.34;
  const armScale = 0.82 + profile.armSize / 100 * 0.34;
  const legScale = 0.86 + profile.legSize / 100 * 0.32;
  const torsoRadius = 34 + Math.round(profile.bodyBuild * 0.12);
  const showingBack = Math.abs(profile.viewRotation) > 95;

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(90,120,180,.35),transparent_32%),linear-gradient(160deg,#111827,#05070b)] ${compact ? 'min-h-[260px]' : 'min-h-[500px]'}`}>
      <div className="absolute inset-x-0 top-5 text-center text-[9px] font-black tracking-[.24em] text-white/35">THIRD-PERSON PLAYER VIEW</div>
      <div className="absolute inset-x-0 bottom-4 top-12 flex items-end justify-center" style={{ perspective: '900px' }}>
        <div
          className="relative origin-bottom"
          style={{
            width: compact ? 140 : 210,
            height: compact ? 190 : 390,
            transform: `rotateY(${profile.viewRotation}deg) scaleY(${heightScale}) scaleX(${weightScale})`,
            transformStyle: 'preserve-3d',
            transition: 'transform 120ms ease-out',
          }}
        >
          <div className="absolute left-1/2 top-0 h-[19%] w-[38%] -translate-x-1/2 overflow-hidden rounded-[46%] border-4 border-zinc-400 bg-zinc-900 shadow-xl" style={{ transform: 'translateZ(18px)' }}>
            {profile.faceImage && !showingBack ? <img src={profile.faceImage} alt="Your uploaded face" className="h-full w-full object-cover" /> : <Camera className="m-auto mt-[28%] text-zinc-600" size={compact ? 24 : 34} />}
          </div>
          <div className="absolute left-1/2 top-[17%] h-[46%] -translate-x-1/2 bg-gradient-to-b from-zinc-500 via-zinc-800 to-black shadow-2xl" style={{ width: `${50 * shoulderScale}%`, borderRadius: `${torsoRadius}% ${torsoRadius}% 20% 20%`, transform: 'translateZ(10px)' }}>
            <div className="absolute inset-x-0 top-[22%] text-center font-black text-white/90" style={{ fontSize: compact ? 42 : 68 }}>{profile.number}</div>
          </div>
          <div className="absolute left-[5%] top-[20%] h-[42%] rounded-full bg-zinc-700" style={{ width: `${13 * armScale}%`, transform: 'rotate(7deg) translateZ(4px)' }} />
          <div className="absolute right-[5%] top-[20%] h-[42%] rounded-full bg-zinc-700" style={{ width: `${13 * armScale}%`, transform: 'rotate(-7deg) translateZ(4px)' }} />
          <div className="absolute bottom-0 left-[28%] h-[43%] rounded-b-[40%] bg-zinc-800" style={{ width: `${15 * legScale}%`, transform: 'translateZ(3px)' }} />
          <div className="absolute bottom-0 right-[28%] h-[43%] rounded-b-[40%] bg-zinc-800" style={{ width: `${15 * legScale}%`, transform: 'translateZ(3px)' }} />
          <div className="absolute inset-x-0 bottom-[5%] flex flex-wrap justify-center gap-1" style={{ transform: 'translateZ(24px)' }}>{tags.map(tag => <span key={tag} className="rounded-full bg-black/65 px-2 py-1 text-[7px] font-black text-white/70">{tag}</span>)}</div>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[9px] font-black">{feetAndInches(profile.heightInches)} • {profile.weightLbs} LB</div>
    </div>
  );
};

const Combine = ({ profile, onDraft }: { profile: MyPlayerProfile; onDraft: () => void }) => {
  const base = hash(`${profile.name}:${profile.position}:${profile.heightInches}:${profile.weightLbs}`);
  const sizePenalty = Math.max(0, profile.weightLbs - 215) / 180;
  const athleticBonus = (profile.bodyBuild < 60 ? 0.05 : 0) + (profile.legSize - 50) / 1800;
  const forty = Math.max(4.25, 4.34 + (base % 42) / 100 + sizePenalty - athleticBonus).toFixed(2);
  const bench = Math.max(8, 12 + ((base >>> 4) % 18) + Math.round((profile.armSize + profile.bodyBuild - 90) / 12));
  const vertical = Math.max(27, 31 + ((base >>> 7) % 10) + Math.round((profile.legSize - 50) / 18));
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#10151d] p-6 sm:p-8">
      <div className="flex items-center gap-3 text-[var(--bk-team-accent)]"><Dumbbell /><span className="text-[10px] font-black tracking-[.25em]">BALL KNOWER COMBINE</span></div>
      <h2 className="mt-3 text-4xl font-black">PROVE YOU BELONG</h2>
      <div className="mt-2 text-xs font-bold text-zinc-500">{feetAndInches(profile.heightInches)} • {profile.weightLbs} LB • {profile.position}</div>
      <div className="mt-6 grid grid-cols-3 gap-2"><CombineStat label="40-YARD" value={`${forty}s`} /><CombineStat label="BENCH" value={`${bench}`} /><CombineStat label="VERTICAL" value={`${vertical}”`} /></div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs font-black text-[var(--bk-team-accent)]">SCOUTING REPORT</div><p className="mt-2 text-sm leading-relaxed text-zinc-400">Explosive {profile.position} prospect with a {profile.overall} OVR foundation. At {feetAndInches(profile.heightInches)} and {profile.weightLbs} pounds, scouts see immediate upside, but every snap will determine how quickly the ratings climb.</p></div>
      <button type="button" onClick={onDraft} className="mt-6 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"><Sparkles className="mr-2 inline" /> ENTER THE NFL DRAFT</button>
    </div>
  );
};

const CombineStat = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl border border-white/10 bg-[#111] p-4 text-center"><div className="text-[9px] font-black tracking-widest text-zinc-500">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>;
