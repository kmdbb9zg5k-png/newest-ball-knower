import React, { useMemo } from 'react';
import type { Position } from '../types';
import type { Appearance, AppearancePlayer, BodyBuild, GloveStyle, SleeveStyle, TattooCoverage, TattooStyle } from './appearance';
import { appearanceSeed, defaultAppearance } from './appearance';
import { SoloCharacter } from './SoloPresentation';

type Profile = {
  name:string; position:Position; number:number; faceImage:string; presetFaceId:string; renderImage:string;
  appearancePrompt:string; teamAbbr:string; heightInches:number; weightLbs:number; bodyBuild:number;
  shoulderWidth:number; armSize:number; legSize:number; viewRotation:number;
};
const FACE_BY_PRESET:Record<string,number>={mason:0,nico:2,malik:5,darius:7};
export const myPlayerPresetPortrait=(presetId:string)=>`/solo-characters/v2/my-player-presets/${['mason','nico','malik','darius'].includes(presetId)?presetId:'malik'}/portrait.webp`;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const feetAndInches=(inches:number)=>`${Math.floor(inches/12)}'${inches%12}\"`;
function buildFor(profile:Profile):BodyBuild{const frame=profile.bodyBuild+Math.max(0,profile.weightLbs-205)*.22;return frame>=82?'heavy':frame>=61?'power':frame>=34?'athletic':'lean';}
function promptAppearance(value:string):Pick<Appearance,'sleeves'|'gloves'|'tattooCoverage'|'tattooStyle'>{
  const prompt=value.toLowerCase();
  const sleeves:SleeveStyle=/both.+sleeve|two.+sleeve/.test(prompt)?'both':/left.+sleeve/.test(prompt)?'left':/right.+sleeve|arm sleeve/.test(prompt)?'right':'none';
  const gloves:GloveStyle=/white|light/.test(prompt)&&/glove/.test(prompt)?'light':/glove/.test(prompt)?'dark':'none';
  const tattooCoverage:TattooCoverage=/both.+tattoo|two.+tattoo/.test(prompt)?'both-arms':/full.+sleeve|tattoo sleeve/.test(prompt)?'full-sleeve':/half.+sleeve/.test(prompt)?'half-sleeve':/forearm/.test(prompt)?'forearm':/tattoo/.test(prompt)?'upper-arm':'none';
  const tattooStyle:TattooStyle=/script/.test(prompt)?'script':/geometric/.test(prompt)?'geometric':/traditional/.test(prompt)?'traditional':/blackwork/.test(prompt)?'blackwork':'mixed';
  return{sleeves,gloves,tattooCoverage,tattooStyle};
}
function sharedPlayer(profile:Profile):AppearancePlayer{return{id:'my-player-user',name:profile.name||'My Player',position:profile.position,team:profile.teamAbbr||'BK',teamName:profile.teamAbbr?undefined:'Ball Knower Training',jerseyNumber:clamp(Math.round(profile.number),0,99),heightInches:profile.heightInches,weightLbs:profile.weightLbs,simulatedPortraitUrl:profile.faceImage||myPlayerPresetPortrait(profile.presetFaceId),simulatedFullBodyUrl:profile.renderImage||undefined};}
function sharedAppearance(profile:Profile,player:AppearancePlayer):Appearance{const base=defaultAppearance(player);return{...base,face:FACE_BY_PRESET[profile.presetFaceId]??base.face,build:buildFor(profile),number:clamp(Math.round(profile.number),0,99),...promptAppearance(profile.appearancePrompt),tattooSeed:appearanceSeed(`my-player:${profile.name}:${profile.presetFaceId}:${profile.appearancePrompt}`)&0x7fffffff};}
export function MyPlayerSharedRender({profile,compact=false}:{profile:Profile;compact?:boolean}){
  const player=useMemo(()=>sharedPlayer(profile),[profile.name,profile.position,profile.teamAbbr,profile.number,profile.heightInches,profile.weightLbs]);
  const look=useMemo(()=>sharedAppearance(profile,player),[player,profile.presetFaceId,profile.bodyBuild,profile.weightLbs,profile.appearancePrompt]);
  if(profile.renderImage)return <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111] ${compact?'h-[260px]':''}`} data-my-player-render="ai"><img src={profile.renderImage} alt={`${profile.name||'Created player'} render`} className={`${compact?'h-full':'aspect-[4/5] h-full'} w-full object-cover`} style={{transform:`perspective(900px) rotateY(${profile.viewRotation*.12}deg) scale(${compact?1.05:1})`,transition:'transform 120ms ease-out'}}/><div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[9px] font-black">{feetAndInches(profile.heightInches)} • {profile.weightLbs} LB</div></div>;
  return <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(ellipse_at_50%_105%,rgba(94,234,196,.18),transparent_48%),radial-gradient(circle_at_50%_15%,rgba(90,120,180,.3),transparent_30%),linear-gradient(160deg,#111827,#05070b)] ${compact?'min-h-[260px]':'min-h-[500px]'}`} data-my-player-render="shared"><div className="absolute inset-x-0 top-5 z-10 text-center text-[9px] font-black tracking-[.24em] text-white/35">PERSISTENT PLAYER IDENTITY</div><div className="absolute inset-x-0 bottom-9 top-10 flex items-end justify-center overflow-hidden"><div className="origin-bottom transition-transform duration-150" style={{width:compact?150:232,transform:`perspective(900px) rotateY(${profile.viewRotation*.18}deg)`}}><SoloCharacter player={player} look={look} customFaceSrc={profile.faceImage||myPlayerPresetPortrait(profile.presetFaceId)} className="bk-my-player-shared-character"/></div></div><div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[9px] font-black">{feetAndInches(profile.heightInches)} • {profile.weightLbs} LB</div><div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-[8px] font-black text-white/60">{look.build.toUpperCase()}</div></div>;
}
