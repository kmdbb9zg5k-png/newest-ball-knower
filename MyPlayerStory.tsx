import React, { useEffect, useState } from 'react';
import { ArrowLeft, Dumbbell, Play, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { buildRealTeamRoster, SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { getDraftPositionGroup } from './rosterRules';
import { TEAM_THEMES, teamLogoUrl } from './teamTheme';
import { Player, Position } from './types';
import { ensureOnlineSession, supabase } from './supabase';

type Props = { onBack: () => void };
type StoryStage = 'creator' | 'combine' | 'drafted' | 'season';
type UpgradeAttribute = 'speed' | 'power' | 'awareness';
type BodySliderKey = 'heightInches' | 'weightLbs' | 'bodyBuild' | 'shoulderWidth' | 'armSize' | 'legSize' | 'viewRotation';

type MyPlayerProfile = {
  version: 1;
  stage: StoryStage;
  name: string;
  position: Position;
  number: number;
  faceImage: string;
  presetFaceId: string;
  bodyPresetId: string;
  renderImage: string;
  appearancePrompt: string;
  teamAbbr: string;
  draftRound: number;
  draftPick: number;
  overall: number;
  xp: number;
  upgradePoints: number;
  gamesPlayed: number;
  speed: number;
  power: number;
  awareness: number;
  heightInches: number;
  weightLbs: number;
  bodyBuild: number;
  shoulderWidth: number;
  armSize: number;
  legSize: number;
  viewRotation: number;
};

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'EDGE', 'LB', 'CB', 'S'];

const FACE_PRESETS = [
  { id: 'mason', name: 'Mason', skin: '#f1c6a8', shadow: '#c98f6c', hair: '#3b2418', hairStyle: 'short' },
  { id: 'nico', name: 'Nico', skin: '#d99b72', shadow: '#aa6747', hair: '#211711', hairStyle: 'fade' },
  { id: 'malik', name: 'Malik', skin: '#9a5c3d', shadow: '#713d28', hair: '#16100d', hairStyle: 'twists' },
  { id: 'darius', name: 'Darius', skin: '#5d3528', shadow: '#3b211a', hair: '#100b09', hairStyle: 'waves' },
] as const;

const BODY_PRESETS = [
  { id: 'lean', label: 'LEAN', detail: 'Speed build', heightInches: 71, weightLbs: 185, bodyBuild: 28, shoulderWidth: 40, armSize: 34, legSize: 44 },
  { id: 'balanced', label: 'BALANCED', detail: 'All-around', heightInches: 72, weightLbs: 210, bodyBuild: 50, shoulderWidth: 54, armSize: 48, legSize: 52 },
  { id: 'power', label: 'POWER', detail: 'Strong frame', heightInches: 73, weightLbs: 240, bodyBuild: 72, shoulderWidth: 70, armSize: 68, legSize: 66 },
  { id: 'lineman', label: 'LINEMAN', detail: 'Trench build', heightInches: 76, weightLbs: 315, bodyBuild: 90, shoulderWidth: 88, armSize: 76, legSize: 82 },
] as const;

const EMPTY_PROFILE: MyPlayerProfile = {
  version: 1,
  stage: 'creator',
  name: '',
  position: 'WR',
  number: 17,
  faceImage: '',
  presetFaceId: 'malik',
  bodyPresetId: 'balanced',
  renderImage: '',
  appearancePrompt: '',
  teamAbbr: '',
  draftRound: 0,
  draftPick: 0,
  overall: 68,
  xp: 0,
  upgradePoints: 0,
  gamesPlayed: 0,
  speed: 78,
  power: 72,
  awareness: 65,
  heightInches: 72,
  weightLbs: 205,
  bodyBuild: 48,
  shoulderWidth: 52,
  armSize: 46,
  legSize: 50,
  viewRotation: 0,
};

function restoreProfile() {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.player);
    if (!raw) return EMPTY_PROFILE;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !POSITIONS.includes(saved.position) || !['creator', 'combine', 'drafted', 'season'].includes(saved.stage)) return EMPTY_PROFILE;
    if (['drafted', 'season'].includes(saved.stage) && !TEAM_THEMES.some(team => team.abbr === saved.teamAbbr)) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...saved } as MyPlayerProfile;
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
      const creatorCustomized = Boolean(
        profile.name ||
        profile.faceImage ||
        profile.presetFaceId !== EMPTY_PROFILE.presetFaceId ||
        profile.bodyPresetId !== EMPTY_PROFILE.bodyPresetId ||
        profile.renderImage ||
        profile.appearancePrompt ||
        profile.position !== EMPTY_PROFILE.position ||
        profile.number !== EMPTY_PROFILE.number ||
        profile.heightInches !== EMPTY_PROFILE.heightInches ||
        profile.weightLbs !== EMPTY_PROFILE.weightLbs ||
        profile.bodyBuild !== EMPTY_PROFILE.bodyBuild ||
        profile.shoulderWidth !== EMPTY_PROFILE.shoulderWidth ||
        profile.armSize !== EMPTY_PROFILE.armSize ||
        profile.legSize !== EMPTY_PROFILE.legSize ||
        profile.viewRotation !== EMPTY_PROFILE.viewRotation
      );
      const untouched = profile.stage === 'creator' && !creatorCustomized;
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
    setProfile(current => ({ ...current, [key]: value, bodyPresetId: key === 'viewRotation' ? current.bodyPresetId : 'custom', renderImage: key === 'viewRotation' ? current.renderImage : '' }));
  };

  const chooseBodyPreset = (preset: typeof BODY_PRESETS[number]) => {
    setProfile(current => ({ ...current, ...preset, bodyPresetId: preset.id, renderImage: '' }));
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
              <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-400"><strong className="text-white">What you do:</strong> pick a face and body, enter a name, then choose a position. A selfie is optional. When you are happy, enter the Combine and your career begins.</p>

              <div className="mt-5"><div className="flex items-end justify-between"><div><div className="text-[10px] font-black tracking-[.18em] text-[var(--bk-team-accent)]">CHOOSE A FACE</div><div className="mt-1 text-[10px] font-bold text-zinc-500">Four original Ball Knower rookies</div></div><span className="text-[9px] font-black text-zinc-600">REQUIRED</span></div>
                <div className="mt-3 grid grid-cols-4 gap-2">{FACE_PRESETS.map(face => <button key={face.id} type="button" aria-pressed={!profile.faceImage && profile.presetFaceId === face.id} onClick={() => setProfile(current => ({ ...current, presetFaceId: face.id, faceImage: '', renderImage: '' }))} className={`rounded-2xl border p-2 ${!profile.faceImage && profile.presetFaceId === face.id ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10' : 'border-white/10 bg-black/20'}`}><PresetFace face={face} small /><span className="mt-1 block text-[8px] font-black text-zinc-400">{face.name}</span></button>)}</div>
              </div>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[.03] text-xs font-black text-zinc-400"><Upload size={15} /> {profile.faceImage ? 'CHANGE YOUR SELFIE' : 'OPTIONAL: USE YOUR SELFIE'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={event => onFace(event.target.files?.[0])} className="sr-only" /></label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-[10px] font-black text-zinc-500">PLAYER NAME<input value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#151515] p-3 text-sm text-white outline-none" placeholder="Your name" /></label>
                <label className="text-[10px] font-black text-zinc-500">JERSEY NUMBER<input type="number" min="0" max="99" value={profile.number} onChange={event => setProfile(current => ({ ...current, number: Math.max(0, Math.min(99, Number(event.target.value) || 0)) }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#151515] p-3 text-sm text-white outline-none" /></label>
              </div>
              <div className="mt-4"><div className="text-[10px] font-black text-zinc-500">POSITION</div><div className="mt-2 flex flex-wrap gap-2">{POSITIONS.map(position => <button key={position} type="button" aria-pressed={profile.position===position} onClick={() => setProfile(current => ({ ...current, position, renderImage: '' }))} className={`min-h-10 rounded-xl border px-3 text-xs font-black ${profile.position === position ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]' : 'border-white/10 bg-[#151515] text-zinc-400'}`}>{position}</button>)}</div></div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-black tracking-[.18em] text-[var(--bk-team-accent)]">BODY BUILDER</span><span className="text-[10px] font-bold text-zinc-500">LIVE PREVIEW</span></div>
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{BODY_PRESETS.map(preset => <button type="button" key={preset.id} aria-pressed={profile.bodyPresetId === preset.id} onClick={() => chooseBodyPreset(preset)} className={`min-h-14 rounded-xl border px-2 text-left ${profile.bodyPresetId === preset.id ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10' : 'border-white/10 bg-[#111]'}`}><span className="block text-[9px] font-black text-white">{preset.label}</span><span className="mt-0.5 block text-[8px] font-bold text-zinc-500">{preset.detail}</span></button>)}</div>
                <BodySlider label="HEIGHT" value={profile.heightInches} min={66} max={80} display={feetAndInches(profile.heightInches)} onChange={value => updateSlider('heightInches', value)} />
                <BodySlider label="WEIGHT" value={profile.weightLbs} min={165} max={360} display={`${profile.weightLbs} LB`} onChange={value => updateSlider('weightLbs', value)} />
                <BodySlider label="BODY BUILD" value={profile.bodyBuild} min={0} max={100} display={profile.bodyBuild < 34 ? 'LEAN' : profile.bodyBuild < 67 ? 'ATHLETIC' : 'POWER'} onChange={value => updateSlider('bodyBuild', value)} />
                <BodySlider label="SHOULDERS" value={profile.shoulderWidth} min={0} max={100} display={`${profile.shoulderWidth}%`} onChange={value => updateSlider('shoulderWidth', value)} />
                <BodySlider label="ARMS" value={profile.armSize} min={0} max={100} display={`${profile.armSize}%`} onChange={value => updateSlider('armSize', value)} />
                <BodySlider label="LEGS" value={profile.legSize} min={0} max={100} display={`${profile.legSize}%`} onChange={value => updateSlider('legSize', value)} />
              </div>

              <label className="mt-4 block text-[10px] font-black text-zinc-500">DESCRIBE YOUR LOOK<textarea value={profile.appearancePrompt} onChange={event => setProfile(current => ({ ...current, appearancePrompt: event.target.value.slice(0, 280), renderImage: '' }))} className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-[#151515] p-3 text-sm text-white outline-none" placeholder="Add a tattoo sleeve, dark visor, white gloves…" /></label>
              <button type="button" disabled={isRendering || !profile.faceImage || aiAvailable === false} onClick={createRender} className="mt-3 w-full rounded-2xl border border-[var(--bk-team-accent)]/40 py-3 font-black text-[var(--bk-team-accent)] disabled:opacity-40"><Sparkles className="mr-2 inline" size={18} /> {isRendering ? 'CREATING RENDER…' : !profile.faceImage ? 'SELFIE RENDER (OPTIONAL)' : aiAvailable === false ? 'AI RENDER NEEDS CONNECTION' : 'CREATE AI PLAYER RENDER'}</button>
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

const PresetFace = ({ face, small = false }: { face: typeof FACE_PRESETS[number]; small?: boolean }) => (
  <div className={`relative mx-auto overflow-hidden rounded-[42%] bg-[#1c2531] ${small ? 'h-14 w-12' : 'h-full w-full'}`} aria-hidden="true">
    <div className="absolute bottom-[-5%] left-1/2 h-[86%] w-[72%] -translate-x-1/2 rounded-[46%_46%_42%_42%]" style={{ background: `linear-gradient(105deg,${face.shadow},${face.skin} 52%,${face.shadow})` }}>
      <div className="absolute left-[18%] top-[45%] h-[5%] w-[16%] rounded-full bg-[#17120f]" /><div className="absolute right-[18%] top-[45%] h-[5%] w-[16%] rounded-full bg-[#17120f]" />
      <div className="absolute left-1/2 top-[48%] h-[20%] w-[10%] -translate-x-1/2 rounded-full border-r border-black/20" />
      <div className="absolute bottom-[17%] left-1/2 h-[5%] w-[28%] -translate-x-1/2 rounded-b-full border-b-2 border-white/70" />
    </div>
    {face.hairStyle === 'twists' ? <div className="absolute left-[13%] top-[2%] h-[35%] w-[74%] rounded-t-[48%]" style={{ background: `radial-gradient(circle,${face.hair} 0 35%,transparent 40%) 0 0/12px 12px` }} /> : <div className={`absolute left-[14%] top-[3%] h-[29%] w-[72%] ${face.hairStyle === 'fade' ? 'rounded-[48%_48%_30%_30%]' : 'rounded-t-[50%]'}`} style={{ background: face.hair }} />}
  </div>
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
  const presetFace = FACE_PRESETS.find(face => face.id === profile.presetFaceId) ?? FACE_PRESETS[0];

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(ellipse_at_50%_105%,rgba(94,234,196,.18),transparent_48%),radial-gradient(circle_at_50%_15%,rgba(90,120,180,.3),transparent_30%),linear-gradient(160deg,#111827,#05070b)] ${compact ? 'min-h-[260px]' : 'min-h-[500px]'}`}>
      <div className="absolute inset-x-[12%] bottom-[7%] h-px bg-emerald-200/20 shadow-[0_0_35px_rgba(94,234,196,.25)]" />
      <div className="absolute inset-x-0 top-5 text-center text-[9px] font-black tracking-[.24em] text-white/35">INTERACTIVE PLAYER PREVIEW</div>
      <div className="absolute inset-x-0 bottom-4 top-12 flex items-end justify-center" style={{ perspective: '900px' }}>
        <div
          className="relative origin-bottom"
          style={{
            width: compact ? 160 : 245,
            height: compact ? 205 : 405,
            transform: `rotateY(${profile.viewRotation}deg) scaleY(${heightScale}) scaleX(${weightScale})`,
            transformStyle: 'preserve-3d',
            transition: 'transform 120ms ease-out',
          }}
        >
          <div className="absolute left-1/2 top-0 z-20 h-[20%] w-[35%] -translate-x-1/2 overflow-hidden rounded-[48%_48%_42%_42%] border-[4px] border-zinc-300 bg-zinc-900 shadow-[0_10px_30px_rgba(0,0,0,.7)]" style={{ transform: 'translateZ(20px)' }}>
            {profile.faceImage && !showingBack ? <img src={profile.faceImage} alt="Your uploaded face" className="h-full w-full object-cover" /> : !showingBack ? <PresetFace face={presetFace} /> : <div className="h-full w-full bg-gradient-to-b from-zinc-700 to-zinc-950" />}
          </div>
          <div className="absolute left-1/2 top-[15%] h-[15%] -translate-x-1/2 rounded-[50%_50%_30%_30%] border-t border-white/40 bg-gradient-to-b from-zinc-100 to-zinc-500 shadow-lg" style={{ width: `${76 * shoulderScale}%`, transform: 'translateZ(8px)' }} />
          <div className="absolute left-1/2 top-[18%] h-[45%] -translate-x-1/2 border-x border-white/10 bg-gradient-to-b from-[#46556a] via-[#1b2635] to-[#070a0e] shadow-2xl" style={{ width: `${52 * shoulderScale}%`, clipPath: 'polygon(12% 0,88% 0,100% 78%,82% 100%,18% 100%,0 78%)', borderRadius: `${torsoRadius}% ${torsoRadius}% 16% 16%`, transform: 'translateZ(12px)' }}>
            <div className="absolute left-1/2 top-0 h-[10%] w-[30%] -translate-x-1/2 rounded-b-full bg-black/65" />
            <div className="absolute inset-x-0 top-[22%] text-center font-black text-white/90" style={{ fontSize: compact ? 42 : 68 }}>{profile.number}</div>
            <div className="absolute inset-x-[10%] bottom-[8%] h-[4%] rounded-full bg-white/15" />
          </div>
          <div className="absolute left-[4%] top-[22%] h-[39%] origin-top rounded-full border-r border-white/10 bg-gradient-to-b from-zinc-400 via-zinc-600 to-zinc-950" style={{ width: `${14 * armScale}%`, transform: 'rotate(12deg) translateZ(5px)' }} />
          <div className="absolute right-[4%] top-[22%] h-[39%] origin-top rounded-full border-l border-white/10 bg-gradient-to-b from-zinc-400 via-zinc-600 to-zinc-950" style={{ width: `${14 * armScale}%`, transform: 'rotate(-12deg) translateZ(5px)' }} />
          <div className="absolute bottom-[35%] left-[20%] h-[13%] w-[60%] rounded-b-[38%] border-t-2 border-white/30 bg-gradient-to-b from-zinc-100 to-zinc-400" style={{ transform: 'translateZ(6px)' }} />
          <div className="absolute bottom-[4%] left-[23%] h-[41%] rounded-[38%_28%_24%_28%] bg-gradient-to-r from-zinc-500 via-zinc-100 to-zinc-500" style={{ width: `${19 * legScale}%`, transform: 'rotate(2deg) translateZ(4px)' }} />
          <div className="absolute bottom-[4%] right-[23%] h-[41%] rounded-[28%_38%_28%_24%] bg-gradient-to-l from-zinc-500 via-zinc-100 to-zinc-500" style={{ width: `${19 * legScale}%`, transform: 'rotate(-2deg) translateZ(4px)' }} />
          <div className="absolute bottom-0 left-[23%] h-[6%] w-[25%] skew-x-[-12deg] rounded bg-black shadow-lg" /><div className="absolute bottom-0 right-[23%] h-[6%] w-[25%] skew-x-[12deg] rounded bg-black shadow-lg" />
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
