import {GAME_GEAR_CHANGED} from './playerGameGear';
import {readAthletePassport} from './athletePassport';
import {CareerTabs,CareerSection} from './CareerTabs';
import AthleteLocker from './AthleteLocker';
import {ATHLETE_CHANGED,athletePortrait,usesPresetAthletePortrait} from './athletePassport';
import {CareerScheme,CareerFilm,CareerLegacy} from './MyPlayerDecisions';
import {chooseCoach,chooseFilm,recordFilmMoment,counterOffer,type CoachChoice,type CounterRequest} from './myPlayerDecisions';
import {CareerRivalry,CareerOffseason} from './MyPlayerArc';
import {createCareerArc,cleanCareerArc,chooseRival,completeArcWeek,finishArcSeason,type CareerArc,type RivalChoice} from './myPlayerArc';
import {CareerCamp,CareerWeek} from './MyPlayerCareer';
import {createCareerLife,cleanCareerLife,chooseCamp,campScore,finishCamp,chooseWeek,weekReady,completeCareerWeek,careerGameBoost,type CareerLife} from './myPlayerCareer';
import {MyPlayerJourney,MyPlayerDraftNight} from './MyPlayerJourney';
import {journeyMetrics,chooseJourney,cleanJourney,journeyOptions,nextJourneyChapter,resolveJourneyDraft,type JourneyChapter,type JourneyState} from './myPlayerJourney';
import {currentCareerRole,type MyPlayerRole} from './myPlayerOpportunity';
import {calculatePlayedCombine,cleanDraftCombine,recordOfficialDraftDrill,type DraftCombinePerformance,type DraftDrill} from './myPlayerDraftCombine';
export {calculateCombineResults} from './myPlayerCombine';
import {BroadcastStage,BroadcastMasthead} from './BroadcastScene';
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Play, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { buildSoloTeamRoster, SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { getDraftPositionGroup } from './rosterRules';
import { SOLO_TEAM_THEMES, soloTeamLogoUrl } from './soloUniverse';
import { Player, Position } from './types';
import { ensureOnlineSession, supabase } from './supabase';
import { AiPhotoConsent, AI_PHOTO_CONSENT_VERSION } from './AiPhotoConsent';
import { MyPlayerSharedRender as PlayerRender, myPlayerPresetPortrait } from './solo/MyPlayerSharedRender';
import AthleteCreatorStudio from './AthleteCreatorStudio';
import AthleteLivePreview from './AthleteLivePreview';
import {applyCareerBuild} from './careerAthleteBuild';
import CareerCreatorDialog from './CareerCreatorDialog';
import {ATHLETE_POSITIONS,feetAndInches,sanitizeAthleteBuild} from './athleteBuild';
import {DEFAULT_ATHLETE_APPEARANCE,sanitizeAthleteAppearance,type AthleteAppearance} from './athleteAppearance';

type Props = { onBack: () => void };
type StoryStage = 'creator' | 'combine' | 'drafted' | 'camp' | 'season';
type UpgradeAttribute = 'speed' | 'power' | 'awareness';
type BodySliderKey = 'viewRotation';

type MyPlayerProfile = {
  version: 1;
  combineId?: string;
  combinePerformance?: DraftCombinePerformance;
  draftJourney?: JourneyState;
  rookieRole?: MyPlayerRole;
  careerLife?: CareerLife;
  careerArc?: CareerArc;
  stage: StoryStage;
  name: string;
  position: Position;
  number: number;
  faceImage: string;
  presetFaceId: string;
  athletePortrait?: string;
  portraitSource?: string;
  buildMovementApplied?: boolean;
  bodyPresetId: string;
  renderImage: string;
  appearancePrompt: string;
  teamAbbr: string;
  draftRound: number;
  draftPick: number;
  combineScore: number;
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
} & AthleteAppearance;


const FACE_PRESETS = [
  { id: 'mason', name: 'Mason' },
  { id: 'nico', name: 'Nico' },
  { id: 'malik', name: 'Malik' },
  { id: 'darius', name: 'Darius' },
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
  combineScore: 0,
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
  ...DEFAULT_ATHLETE_APPEARANCE,
};

function restoreProfile() {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.player);
    if (!raw) return {...EMPTY_PROFILE,combineId:crypto.randomUUID()};
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !ATHLETE_POSITIONS.includes(saved.position) || !['creator', 'combine', 'drafted', 'camp', 'season'].includes(saved.stage)) return {...EMPTY_PROFILE,combineId:crypto.randomUUID()};
    if (['drafted', 'camp', 'season'].includes(saved.stage) && !SOLO_TEAM_THEMES.some(team => team.abbr === saved.teamAbbr)) return {...EMPTY_PROFILE,combineId:crypto.randomUUID()};
    return { ...EMPTY_PROFILE, ...saved, combineId:saved.combineId||crypto.randomUUID(), ...sanitizeAthleteBuild(saved),...sanitizeAthleteAppearance(saved), careerArc:cleanCareerArc(saved.careerArc,{...EMPTY_PROFILE,...saved}),careerLife:cleanCareerLife(saved.careerLife,{...EMPTY_PROFILE,...saved},saved.draftJourney),combinePerformance:cleanDraftCombine(saved.combinePerformance),draftJourney:saved.draftJourney?cleanJourney(saved.draftJourney,{...EMPTY_PROFILE,...saved}):undefined,rookieRole:['starter','rotation','development'].includes(saved.rookieRole)?saved.rookieRole:undefined } as MyPlayerProfile;
  } catch {
    return {...EMPTY_PROFILE,combineId:crypto.randomUUID()};
  }
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
  const team = SOLO_TEAM_THEMES.find(item => item.abbr === profile.teamAbbr) ?? SOLO_TEAM_THEMES[0];
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
    heightInches: profile.heightInches,
    weightLbs: profile.weightLbs,
    simulatedPortraitUrl: athletePortrait(profile) || undefined,
    simulatedFullBodyUrl: profile.renderImage || undefined,
    starter: profile.careerLife ? profile.careerLife.role==='starter' : profile.rookieRole ? currentCareerRole(profile.rookieRole,profile.overall,profile.gamesPlayed)==='starter' : true,
    active: true,
    ovr: profile.overall,
    overall: profile.overall,
    overallRating: profile.overall,
    ratingSource: 'Ball Knower Career',
    ratingSeason: profile.careerArc?.year||2026,
    salary: profile.careerArc?.contract.annual??1.1,
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
  const roster = buildSoloTeamRoster(profile.teamAbbr);
  const group = getDraftPositionGroup(created);
  const replaceable = roster
    .map((player, index) => ({ player, index }))
    .filter(item => getDraftPositionGroup(item.player) === group)
    .sort((first, second) => profile.careerLife ? Number(second.player.id===profile.careerLife.rosterSlotId)-Number(first.player.id===profile.careerLife.rosterSlotId)||first.player.ovr-second.player.ovr : created.starter&&profile.rookieRole ? Number(Boolean(second.player.starter))-Number(Boolean(first.player.starter))||first.player.ovr-second.player.ovr : first.player.ovr-second.player.ovr)[0];
  if (replaceable) roster[replaceable.index] = created;
  else roster[roster.length - 1] = created;
  return profile.careerLife||profile.rookieRole&&created.starter?[created,...roster.filter(player=>player.id!==created.id)]:roster;
}

export const MyPlayerStory: React.FC<Props> = ({ onBack }) => {
  const [profile, setProfile] = useState<MyPlayerProfile>(restoreProfile);
  useEffect(()=>{const syncGear=()=>{const athlete=readAthletePassport();setProfile(current=>athlete&&athlete.id===(current.combineId||`legacy:${current.name}:${current.position}`)?{...current,gameGear:athlete.gameGear}:current);};window.addEventListener(GAME_GEAR_CHANGED,syncGear);return()=>window.removeEventListener(GAME_GEAR_CHANGED,syncGear);},[]);
  const previousStage=useRef(profile.stage);
  useEffect(()=>{if(previousStage.current!==profile.stage){previousStage.current=profile.stage;window.scrollTo({top:0,behavior:'instant'});}},[profile.stage]);
  const [editing,setEditing]=useState(false);
  const savePortrait=useCallback((athletePortrait:string)=>setProfile(current=>current.athletePortrait===athletePortrait?current:{...current,athletePortrait}),[]);
  const [message, setMessage] = useState('');
  const [saveError,setSaveError]=useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const draftOutcome=useMemo(()=>profile.draftJourney?.draftBaseGrade!==undefined?resolveJourneyDraft(profile.draftJourney,profile,profile.draftJourney.draftBaseGrade):null,[profile.draftJourney?.draftBaseGrade,profile.draftJourney?.seed,JSON.stringify(profile.draftJourney?.choices),profile.name,profile.position,profile.combineId]);
  const draftedTeam = SOLO_TEAM_THEMES.find(team => team.abbr === profile.teamAbbr) ?? null;

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
        profile.viewRotation !== EMPTY_PROFILE.viewRotation ||
        (Object.keys(DEFAULT_ATHLETE_APPEARANCE) as (keyof AthleteAppearance)[]).some(key=>profile[key]!==DEFAULT_ATHLETE_APPEARANCE[key])
      );
      const untouched = profile.stage === 'creator' && !creatorCustomized;
      if (untouched) localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.player);
      else localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.player, JSON.stringify(profile));
      window.dispatchEvent(new Event(ATHLETE_CHANGED));
      setSaveError('');
    } catch (error) {
      console.warn('Unable to save My Player career', error);
      setSaveError('Your career could not be saved on this device. Keep this page open until storage is available.');
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


  const onFace = async (file?: File) => {
    setAiConsent(false);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMessage('Choose a photo from your camera or photo library.');
    try {
      const faceImage = await compressImage(file, 512, 0.78);
      setProfile(current => ({ ...current, faceImage, renderImage: '' }));
      setMessage('Selfie uploaded for your optional career portrait. Your 3D athlete stays as customized above.');
    } catch {
      setMessage('That photo could not be opened. Try a clear selfie.');
    }
  };

  const createRender = async () => {
    if (isRendering) return;
    if (!aiConsent) return setMessage('Read and accept the optional Google Gemini photo-sharing permission first.');
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
        body: JSON.stringify({ aiPhotoConsent: AI_PHOTO_CONSENT_VERSION, image: profile.faceImage, prompt: profile.appearancePrompt, bodyDescription, position: profile.position, number: profile.number, team: 'a future pro team' }),
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
      setAiConsent(false);
      setIsRendering(false);
    }
  };

  const enterCombine = () => {
    if (!profile.name.trim()) return setMessage('Give your player a name.');
    const next:MyPlayerProfile={...applyCareerBuild(profile),name:profile.name.trim(),stage:'combine',combineId:profile.combineId||crypto.randomUUID()};
    try{localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.player,JSON.stringify(next));}catch{setSaveError('Your player could not be saved. Free some browser storage and try again.');return;}
    setProfile(next);
    setEditing(false);
    setMessage(editing?'Your player is updated. Continue your road to draft night.':'You have been invited to the Ball Knower Combine.');
  };

  const chooseStory=(chapter:JourneyChapter,id:string)=>setProfile(current=>{
    if(current.stage!=='combine')return current;
    const before=cleanJourney(current.draftJourney,current),complete=Boolean(calculatePlayedCombine(current.position,current.combinePerformance));
    const next=chooseJourney(before,current,chapter,id,complete);
    if(next.choices[chapter]===before.choices[chapter])return current;
    const attributes=journeyOptions(chapter,current).find(option=>option.id===id)?.attributes||{};
    return {...current,draftJourney:next,speed:Math.max(45,Math.min(99,current.speed+(attributes.speed||0))),power:Math.max(45,Math.min(99,current.power+(attributes.power||0))),awareness:Math.max(45,Math.min(99,current.awareness+(attributes.awareness||0)))};
  });
  const enterDraft = () => {
    const combine=calculatePlayedCombine(profile.position,profile.combinePerformance);
    const journey=cleanJourney(profile.draftJourney,profile);
    if(profile.stage!=='combine'||!combine||nextJourneyChapter(journey,true)!=='ready'){setMessage('Finish your workouts and draft-story decisions first.');return;}
    const locked={...journey,draftBaseGrade:combine.score,cursor:0};const outcome=resolveJourneyDraft(locked,profile,combine.score);
    setProfile(current=>current.stage!=='combine'?current:({...current,stage:'drafted',draftJourney:locked,teamAbbr:outcome.team,draftRound:outcome.round,draftPick:outcome.pick,combineScore:outcome.grade,overall:Math.max(60,Math.min(99,current.overall+combine.overallChange)),rookieRole:outcome.role==='Starter candidate'?'starter':outcome.role==='Rotation prospect'?'rotation':'development'}));
    setMessage('Draft night is live. Your work is on the board.');
  };
  const advanceDraft=(cursor:number)=>setProfile(current=>{
    if(current.stage!=='drafted'||!current.draftJourney||!draftOutcome||!Number.isFinite(cursor))return current;
    const limit=Math.min(224,draftOutcome.overall);return {...current,draftJourney:{...current.draftJourney,cursor:Math.max(current.draftJourney.cursor,Math.min(limit,Math.floor(cursor)))}};
  });
  const signOffer=(team:string)=>setProfile(current=>{
    if(current.stage!=='drafted'||!current.draftJourney||!draftOutcome||draftOutcome.kind!=='undrafted'||current.draftJourney.cursor<224)return current;
    if(draftOutcome.offers.some(o=>o.team===current.draftJourney?.signedTeam))return current;
    const offer=draftOutcome.offers.find(o=>o.team===team);if(!offer)return current;
    return {...current,teamAbbr:team,rookieRole:offer.role==='Starter candidate'?'starter':offer.role==='Rotation prospect'?'rotation':'development',draftJourney:{...current.draftJourney,signedTeam:team}};
  });

  const recordCombineResult=(drill:DraftDrill,stats:Record<string,number>)=>setProfile(current=>current.stage==='combine'?{...current,combinePerformance:recordOfficialDraftDrill(current.combinePerformance,drill,stats)}:current);

  const beginSeason = () => {
    if(profile.stage!=='drafted')return;
    if(draftOutcome&&(profile.draftJourney!.cursor<Math.min(224,draftOutcome.overall)||draftOutcome.kind==='undrafted'&&!draftOutcome.offers.some(o=>o.team===profile.draftJourney?.signedTeam))){setMessage('Finish draft night and choose your camp offer first.');return;}
    try { localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.player}:season`); } catch (error) { console.warn('Unable to clear My Player season', error); }
    setProfile(current=>current.stage!=='drafted'?current:({...current,stage:draftOutcome?'camp':'season',careerLife:draftOutcome?createCareerLife(current,current.draftJourney,current.rookieRole):undefined,upgradePoints:current.upgradePoints+(draftOutcome?.developmentPoints||0)}));
  };

  const awardXp = (fantasyScore: number, won: boolean,progress?:Player,careerKey?:string,opponentAbbr?:string) => {
    setProfile(current => {
      if(current.careerLife&&careerKey&&!weekReady(current.careerLife,careerKey))return current;
      let careerLife=current.careerLife&&careerKey?completeCareerWeek(current.careerLife,careerKey,won):current.careerLife;
      let careerArc=current.careerArc;if(careerLife&&careerKey){const result=completeArcWeek(careerArc||createCareerArc(current,Number(careerKey.split(':')[0])),careerLife,careerKey,won,opponentAbbr||'');careerArc=result.arc;careerLife=result.life;}
      const earned = Math.max(12, Math.round(fantasyScore * 4) + (won ? 10 : 0))+(current.careerLife?.turn?.score!==undefined?Math.round(current.careerLife.turn.score/5):0);
      const total = current.xp + earned;
      const points = Math.floor(total / 100);
      return { ...current, careerLife,careerArc,rookieRole:careerLife?.role||current.rookieRole, ...(current.rookieRole&&progress?{overall:Math.max(current.overall,progress.ovr),speed:Math.max(current.speed,progress.speed||0),power:Math.max(current.power,progress.strength||0),awareness:Math.max(current.awareness,progress.awareness||0)}:{}), xp: total % 100, upgradePoints: current.upgradePoints + points, gamesPlayed: current.gamesPlayed + 1 };
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
    setEditing(false);
    setProfile({...EMPTY_PROFILE,combineId:crypto.randomUUID()});
    setMessage('');
  };

  const initialArcYear=useMemo(()=>{try{const year=JSON.parse(localStorage.getItem(`${SOLO_FRANCHISE_SAVE_KEYS.player}:season`)||'null')?.year;return Number.isInteger(year)&&year>=2026?year:2026;}catch{return 2026;}},[]);
  const arc=useMemo(()=>profile.careerArc||createCareerArc(profile,profile.careerLife?.camp.legacy||profile.gamesPlayed>0?initialArcYear:2026),[profile.careerArc,profile.combineId,profile.name,profile.teamAbbr,profile.draftRound,profile.draftPick,profile.draftJourney,initialArcYear,Boolean(profile.careerLife?.camp.legacy||profile.gamesPlayed>0)]);
  const commitRival=(key:string,id:RivalChoice)=>setProfile(current=>{if(!current.careerLife)return current;const result=chooseRival(current.careerArc||createCareerArc(current,Number(key.split(':')[0])),current.careerLife,key,id);return {...current,careerArc:result.arc,careerLife:result.life};});
  const advanceLock=useRef(false);
  const commitCoach=(id:CoachChoice)=>setProfile(current=>{if(!current.careerLife)return current;const result=chooseCoach(current.careerArc||arc,current.careerLife,current,id);return {...current,careerArc:result.arc,careerLife:result.life,rookieRole:result.life.role};});
  const commitFilm=(key:string,answer:number)=>setProfile(current=>!current.careerLife?current:{...current,careerArc:chooseFilm(current.careerArc||arc,current.careerLife,current.position,key,answer)});
  const commitCounter=(id:string,request:CounterRequest)=>setProfile(current=>!current.careerLife?current:{...current,careerArc:counterOffer(current.careerArc||arc,current.careerLife,id,request)});
  const advanceCareer=(year:number,wins:number,champion:boolean,offerId?:string)=>{if(advanceLock.current||!profile.careerLife)return;const result=finishArcSeason(profile.careerArc||createCareerArc(profile,year),profile.careerLife,profile,year,wins,champion,offerId);if(!result)return;const next={...profile,teamAbbr:result.team,careerArc:result.arc,careerLife:result.life,rookieRole:result.life.role};try{localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.player,JSON.stringify(next));advanceLock.current=true;setProfile(next);window.scrollTo({top:0,behavior:'instant'});}catch{setSaveError('Your next season could not be saved. Free up device storage and try again; your current season is still here.');}};
  useEffect(()=>{advanceLock.current=false;},[profile.careerArc?.year]);
  const campLife=profile.careerLife||createCareerLife(profile,profile.draftJourney,profile.rookieRole);
  const commitCamp=(kind:'prep'|'response',id:string)=>setProfile(current=>current.stage!=='camp'?current:{...current,careerLife:chooseCamp(current.careerLife||createCareerLife(current,current.draftJourney,current.rookieRole),kind,id)});
  const recordCamp=(index:number,score:number)=>setProfile(current=>current.stage!=='camp'?current:{...current,careerLife:campScore(current.careerLife||createCareerLife(current,current.draftJourney,current.rookieRole),index,score)});
  const enterRookie=()=>setProfile(current=>{if(current.stage!=='camp'||!current.careerLife||current.careerLife.camp.scores.length!==3)return current;const life=finishCamp(current.careerLife);return {...current,stage:'season',careerLife:life,rookieRole:life.role};});
  const commitWeek=(key:string,kind:'prep'|'response',id:string)=>setProfile(current=>current.stage!=='season'||!current.careerLife?current:{...current,careerLife:chooseWeek(current.careerLife,key,kind,id)});
  const recordMoment=(key:string,score:number)=>setProfile(current=>current.stage!=='season'||!current.careerLife?current:{...current,careerLife:recordFilmMoment(current.careerArc||arc,current.careerLife,key,score)});
  const storyStep=JSON.stringify([profile.stage,campLife.camp.plan,campLife.camp.response,campLife.camp.scores.length,campLife.turn?.key,campLife.turn?.prep,campLife.turn?.response,campLife.turn?.score,profile.draftJourney?.choices]);
  const playerStats=<section className="life-metrics" aria-label="Player attributes">{[['Overall',profile.overall],['Speed',profile.speed],['Power',profile.power],['Awareness',profile.awareness],['Height',feetAndInches(profile.heightInches)],['Weight',`${profile.weightLbs} lb`],['XP',profile.xp],['Upgrade points',profile.upgradePoints]].map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}</section>;
  const relationshipMetrics:[string,number][]=[['Coach trust',campLife.trust],['Chemistry',campLife.chemistry],['Agent',campLife.agent],['Fatigue',campLife.fatigue]];
  if(profile.stage==='camp')return <BroadcastStage scene="locker" page="my-player" quiet>{saveError&&<p role="alert">{saveError}</p>}<CareerTabs stepKey={storyStep} title="Training camp" onBack={onBack} metrics={relationshipMetrics}><CareerSection tab="player">{playerStats}<PlayerRender profile={profile} onPortrait={savePortrait} compact/><AthleteLocker profile={profile}/></CareerSection><CareerCamp life={campLife} profile={profile} onChoice={commitCamp} onScore={recordCamp} onFinish={enterRookie} onBack={onBack}/></CareerTabs></BroadcastStage>;

  if (profile.stage === 'season' && draftedTeam) {
    const roster = rosterWithMyPlayer(profile);
    return (
      <BroadcastStage scene="locker" page="my-player" quiet className="relative pb-20">
        {saveError&&<p role="alert" className="mx-auto max-w-5xl p-4 text-red-300">{saveError}</p>}<CareerTabs stepKey={storyStep} title="My Player · Season" onBack={onBack} metrics={relationshipMetrics}><CareerSection tab="player">{playerStats}<div className="px-4 pt-4 sm:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-black/25 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
              <PlayerRender onPortrait={savePortrait} profile={profile} compact />
              <div className="px-2 pb-2 sm:pb-0">
                <div className="text-[10px] font-black tracking-[.2em] text-[var(--bk-team-accent)]">YOUR ROOKIE</div>
                <div className="mt-1 text-2xl font-black">{profile.name} • #{profile.number} • {profile.position}</div>
                <div className="mt-1 text-xs font-bold text-zinc-500">{feetAndInches(profile.heightInches)} • {profile.weightLbs} LB • {profile.overall} OVR • {draftedTeam.name}</div>
                <ViewSlider value={profile.viewRotation} onChange={value => updateSlider('viewRotation', value)} />
                {!profile.careerLife&&profile.rookieRole&&<p className="mt-3 text-xs text-[var(--bk-team-accent)]">Career role: {currentCareerRole(profile.rookieRole,profile.overall,profile.gamesPlayed)} · Baseline featured reps: rotation in odd weeks, development every fourth week. Coach promises can create extra opportunities. Reach 70 OVR after 3 games for rotation, or 78 OVR after 4 games for a starting opportunity.</p>}
              </div>
            </div>
          </div>
        </div>
        {!profile.careerLife&&<div className="mx-auto max-w-5xl p-4"><button className="career-primary" onClick={()=>setProfile(current=>{if(current.careerLife)return current;const life=createCareerLife(current,current.draftJourney,current.rookieRole?currentCareerRole(current.rookieRole,current.overall,current.gamesPlayed):'starter');const ids=new Set(rosterWithMyPlayer(current).map(p=>p.id));const rosterSlotId=buildSoloTeamRoster(current.teamAbbr).find(p=>!ids.has(p.id))?.id;return {...current,careerLife:{...life,rosterSlotId,camp:{scores:[],complete:true,legacy:true},games:current.gamesPlayed}};})}>ENABLE LIVING CAREER</button><p className="career-note">Keep your season and add weekly conversations, playable moments and evolving relationships. No training-camp replay required.</p></div>}
        <AthleteLocker profile={profile}/>
        </CareerSection><FranchiseSeason careerTabbed key={profile.careerLife?`${arc.year}:${profile.teamAbbr}`:'legacy'} careerStartYear={profile.careerLife?arc.year:undefined} onCareerSeasonYearChange={profile.careerLife?year=>setProfile(current=>{if(!current.careerLife||current.careerArc&&current.careerArc.year>=year)return current;const previous=current.careerArc||createCareerArc(current,year-1);return {...current,careerArc:{...previous,year,seasonOwn:0,seasonRival:0,seasonGames:0}};}):undefined} careerOffseason={profile.careerLife?(year,wins,champion)=><CareerOffseason arc={arc} life={profile.careerLife!} profile={profile} year={year} wins={wins} champion={champion} onAdvance={advanceCareer} onCounter={commitCounter}/>:undefined} title="MY PLAYER STORY" userTeam={draftedTeam} roster={roster} saveKey={SOLO_FRANCHISE_SAVE_KEYS.player} onBack={onBack} myPlayerId="my-player-user" myPlayerProgress={profile.rookieRole?{ovr:profile.overall,speed:profile.speed,strength:profile.power,awareness:profile.awareness}:undefined} myPlayerRole={profile.careerLife?.role||(profile.rookieRole?currentCareerRole(profile.rookieRole,profile.overall,profile.gamesPlayed):undefined)} careerPanel={profile.careerLife?context=><><CareerSection tab="career"><CareerLegacy arc={arc} profile={profile}/><CareerScheme arc={arc} life={profile.careerLife!} profile={profile} onChoice={commitCoach}/><CareerRivalry arc={arc} life={profile.careerLife!} name={profile.name} context={context} onChoice={commitRival}/></CareerSection><CareerWeek life={profile.careerLife!} profile={profile} context={context} onChoice={commitWeek} onMoment={recordMoment} filmRoom={<CareerFilm arc={arc} life={profile.careerLife!} position={profile.position} weekKey={context.key} onAnswer={answer=>commitFilm(context.key,answer)}/>}/></>:undefined} careerReady={profile.careerLife?key=>weekReady(profile.careerLife,key):undefined} careerBoost={profile.careerLife?key=>careerGameBoost(profile.careerLife,key):undefined} onMyPlayerGame={awardXp} />
        <CareerSection tab="player"><button type="button" onClick={newCareer} style={{ bottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 4.5rem)' }} className="my-player-restart fixed right-4 z-30 flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-black/95 px-3 text-[10px] font-black shadow-xl"><RotateCcw size={14} /> NEW PLAYER</button>
        <div className="my-player-upgrades fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-black/95 p-2 shadow-2xl">
          <div className="min-w-0 flex-1 px-2"><div className="truncate text-xs font-black">{profile.name} • {profile.overall} OVR</div><div className="text-[10px] text-zinc-500">XP {profile.xp}/100 • {profile.upgradePoints} UPGRADE POINT{profile.upgradePoints === 1 ? '' : 'S'}</div></div>
          {(['speed', 'power', 'awareness'] as UpgradeAttribute[]).map(attribute => <button key={attribute} type="button" disabled={!profile.upgradePoints || profile.overall >= 99} onClick={() => upgrade(attribute)} className="min-h-10 rounded-xl border border-[var(--bk-team-accent)]/30 px-2 text-[9px] font-black uppercase text-[var(--bk-team-accent)] disabled:opacity-30">+ {attribute}</button>)}
        </div>
      </CareerSection></CareerTabs></BroadcastStage>
    );
  }

  if(profile.stage==='creator'||editing)return <BroadcastStage scene="locker" page="my-player" quiet>
    <CareerCreatorDialog onBack={editing?()=>setEditing(false):onBack} onReset={newCareer}>
      <AthleteCreatorStudio profile={profile} onPortrait={savePortrait} positionLocked={profile.stage!=='creator'} buildNote={editing?'Completed Combine results stay locked when you edit your player.':undefined} onChange={patch=>{setMessage('');setProfile(current=>applyCareerBuild<MyPlayerProfile>(current,patch));}} onSave={enterCombine} actionLabel={editing?"Save & return to Combine":"Save & enter the Combine"} ariaLabel="Career athlete builder" nameLabel="Career player name" jerseyLabel="Career jersey number" error={saveError} message={message} note={editing?"Adjust your athlete before draft night. Completed Combine results and story choices stay saved.":"Create your athlete, then earn your draft spot in the Combine. Changing position keeps your custom build, speed and appearance."} faceExtras={
        <details className="bk-career-portrait"><summary>Optional career portrait</summary>
          <p>Choose a portrait or use a selfie for your career cards. Your 3D athlete uses the appearance controls above.</p>
          <button type="button" className="career-secondary" onClick={()=>setProfile(current=>({...current,portraitSource:'created',faceImage:'',renderImage:''}))}>Use my created athlete</button><div className="bk-portrait-options">{FACE_PRESETS.map(face=><button key={face.id} type="button" aria-label={`${face.name} career portrait`} aria-pressed={usesPresetAthletePortrait(profile)&&!profile.faceImage&&profile.presetFaceId===face.id} onClick={()=>setProfile(current=>({...current,presetFaceId:face.id,portraitSource:'preset',faceImage:'',renderImage:''}))}><PresetFace face={face} small/><span>{face.name}</span></button>)}</div>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-3"><Upload size={15}/>{profile.faceImage?'CHANGE YOUR SELFIE':'OPTIONAL: USE YOUR SELFIE'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={event=>onFace(event.target.files?.[0])} className="sr-only"/></label>
          <label className="mt-4 block">Describe your portrait<textarea value={profile.appearancePrompt} onChange={event=>setProfile(current=>({...current,appearancePrompt:event.target.value.slice(0,280),renderImage:''}))} className="mt-1 rounded-xl border border-white/10 bg-[#151515] p-3" placeholder="Describe the outfit and details for your career portrait…"/></label>
          <AiPhotoConsent checked={aiConsent} onChange={setAiConsent} disabled={isRendering}/>
          <button type="button" disabled={isRendering||!aiConsent||!profile.faceImage||aiAvailable===false} onClick={createRender} className="mt-3 min-h-11 w-full rounded-xl border border-white/20 p-3 text-sm font-bold disabled:opacity-40"><Sparkles className="mr-2 inline" size={18}/>{isRendering?'CREATING PORTRAIT…':!profile.faceImage?'SELFIE PORTRAIT (OPTIONAL)':aiAvailable===false?'AI PORTRAIT NEEDS CONNECTION':'CREATE AI PLAYER PORTRAIT'}</button>
          {aiAvailable===false&&<p>Your 3D athlete and career work without the optional portrait service.</p>}
          {(profile.faceImage||profile.renderImage||usesPresetAthletePortrait(profile))&&<><PlayerRender profile={profile} portraitPreview/><ViewSlider value={profile.viewRotation} onChange={value=>updateSlider('viewRotation',value)}/></>}
        </details>
      }/>
    </CareerCreatorDialog>
  </BroadcastStage>;

  const draftMetrics=journeyMetrics(cleanJourney(profile.draftJourney,profile),profile);
  const stageTitle = profile.stage === 'combine' ? 'PRO COMBINE' : 'DRAFT NIGHT';

  return (
    <BroadcastStage scene="locker" page="my-player" quiet className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
      <CareerTabs stepKey={storyStep} title={stageTitle} onBack={onBack} metrics={[["Coach trust",draftMetrics.trust],["Preparation",draftMetrics.readiness],["Exposure",draftMetrics.visibility],["Recovery",draftMetrics.medical]]}><div className="mx-auto max-w-5xl">
        <CareerSection tab="player">{playerStats}<AthleteLocker profile={profile}/>
        </CareerSection><CareerSection tab="career"><BroadcastMasthead eyebrow="My Player story" title="Your Career Starts Here" subtitle="Create your player. Earn your place." compact/>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft size={19} /></button>
          <div className="text-center"><div className="text-[10px] font-black tracking-[.22em] text-[var(--bk-team-accent)]">MY PLAYER STORY</div><div className="text-sm font-black">{stageTitle}</div></div>
          <button type="button" onClick={newCareer} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Create a new player"><RotateCcw size={17} /></button>
        </div>

        </CareerSection>{saveError&&<div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{saveError}</div>}
        {message ? <div className="mt-4 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-4 py-3 text-sm font-bold text-[var(--bk-team-accent)]">{message}</div> : null}

        <CareerSection tab="player">{profile.stage==='combine'&&<button type="button" className="career-primary mt-4" onClick={()=>setEditing(true)}>Edit player · height, weight & appearance</button>}</CareerSection>
        {profile.stage === 'combine' ? (
          <div className="mt-5 grid gap-5">
            <CareerSection tab="player"><AthleteLivePreview profile={profile} onPortrait={savePortrait}/></CareerSection>
            <div className="order-1 min-w-0 lg:order-2"><MyPlayerJourney profile={profile} onChoice={chooseStory} onDraft={enterDraft} onResult={recordCombineResult} /></div>
          </div>
        ) : null}

        {profile.stage === 'drafted' && draftedTeam ? (
          <div className="mt-5 grid gap-5">
            <CareerSection tab="player"><AthleteLivePreview profile={profile} onPortrait={savePortrait}/></CareerSection>
            <CareerSection tab="story"><div className="min-w-0">{draftOutcome?<MyPlayerDraftNight profile={profile} outcome={draftOutcome} onAdvance={advanceDraft} onSign={signOffer} onBegin={beginSeason}/>:<div className="rounded-[2rem] border border-white/10 bg-[#10151d] p-7 text-center">
              <div className="text-[10px] font-black tracking-[.25em] text-[var(--bk-team-accent)]">WITH THE #{profile.draftPick} PICK IN ROUND {profile.draftRound}</div>
              <img src={soloTeamLogoUrl(draftedTeam.abbr)} alt="" aria-hidden="true" className="mx-auto mt-5 h-28 w-28 object-contain" />
              <h2 className="mt-4 text-4xl font-black">{draftedTeam.name}</h2>
              <p className="mt-2 text-zinc-400">The selection is {profile.name}, {profile.position}, {feetAndInches(profile.heightInches)}, {profile.weightLbs} lbs. Your Ball Knower League story starts now.</p>
              <button type="button" onClick={beginSeason} className="mt-6 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"><Play className="mr-2 inline" /> BEGIN ROOKIE SEASON</button>
            </div>}</div></CareerSection>
          </div>
        ) : null}
      </div></CareerTabs>
    </BroadcastStage>
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
  <img src={myPlayerPresetPortrait(face.id)} width="640" height="800" loading="lazy" decoding="async" alt="" className={`mx-auto rounded-[42%] object-cover ${small ? 'h-14 w-12' : 'h-full w-full'}`} aria-hidden="true" />
);
