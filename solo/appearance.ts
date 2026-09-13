import type { Player } from '../types';
import { SOLO_TEAM_THEMES } from '../soloUniverse';

export const SOLO_ART_VERSION = 3 as const;
export const SOLO_ART_ROOT = '/solo-characters/v1';
export const FACE_COUNT = 9;
export const HAIR_COUNT = 10;
export const FACIAL_HAIR_COUNT = 6;
export const EYE_BLACK_COUNT = 4;
export const FACE_SKIN = ['#8f634d','#4d3024','#94624b','#7a4e3a','#5a3523','#a97455','#40261b','#a16b52','#815239'];
export const APPEARANCE_PREFIX = 'ball-knower-solo-appearance-v1:';
export const CREATOR_EASTER_EGG_ID = 'bk-001-eli-rodriguez';
export type UniformVariant = 'home' | 'away' | 'alternate';
export type BodyBuild = 'lean' | 'athletic' | 'power' | 'heavy';
export type SleeveStyle = 'none' | 'right' | 'left' | 'both';
export type GloveStyle = 'none' | 'light' | 'dark';
export type TattooCoverage = 'none' | 'minimal' | 'upper-arm' | 'forearm' | 'half-sleeve' | 'full-sleeve' | 'both-arms';
export type TattooStyle = 'blackwork' | 'geometric' | 'script' | 'traditional' | 'mixed';
export type Appearance = {
  version: 3;
  face: number; hair: number; facialHair: number; eyeBlack: number; build: BodyBuild; number: number;
  sleeves: SleeveStyle; gloves: GloveStyle; tattooCoverage: TattooCoverage; tattooStyle: TattooStyle; tattooSeed: number;
};
export type AppearancePlayer = Pick<Player,'id'|'name'|'team'> & {position:string} & Partial<Pick<Player,'jerseyNumber'|'teamName'>>;
export type Uniform = { name: string; abbr: string; jersey: string; pants: string; trim: string; ink: string; pattern: number };
type Store = Pick<Storage,'getItem'|'setItem'|'removeItem'>;

/** Identity deliberately excludes team, name, rating, age, season and array index. */
export function appearanceSeed(id: string): number { let hash=2166136261; for(const c of id) hash=Math.imul(hash^c.charCodeAt(0),16777619); return hash>>>0; }
const chooseBuild=(position:string,seed:number):BodyBuild=>{if(['LT','RT','LG','RG','C','OT','OG','NT'].includes(position))return seed%4===0?'power':'heavy';if(['DT','DE','EDGE','LB','FB','TE'].includes(position))return seed%3===0?'power':'athletic';if(['RB','SS','FS','S','QB'].includes(position))return seed%4===0?'power':'athletic';return seed%5===0?'athletic':'lean';};
const tattooCoverageFor=(seed:number):TattooCoverage=>{if(seed%2!==0)return'none';const pool:TattooCoverage[]=['minimal','upper-arm','forearm','half-sleeve','full-sleeve','both-arms'];return pool[(seed>>>5)%pool.length];};
const tattooStyleFor=(seed:number):TattooStyle=>(['blackwork','geometric','script','traditional','mixed'] as TattooStyle[])[(seed>>>9)%5];

export function defaultAppearance(player:AppearancePlayer):Appearance{
 const seed=appearanceSeed(player.id),number=player.jerseyNumber;
 if(player.id===CREATOR_EASTER_EGG_ID)return{version:3,face:5,hair:2,facialHair:4,eyeBlack:1,build:'athletic',number:11,sleeves:'none',gloves:'dark',tattooCoverage:'full-sleeve',tattooStyle:'mixed',tattooSeed:appearanceSeed('eli-rodriguez-tattoos')};
 return{version:3,face:seed%FACE_COUNT,hair:(seed>>>3)%HAIR_COUNT,facialHair:(seed>>>7)%FACIAL_HAIR_COUNT,eyeBlack:(seed>>>11)%EYE_BLACK_COUNT,build:chooseBuild(player.position,seed>>>13),number:Number.isInteger(number)&&number!>=0&&number!<=99?number!:(seed>>>8)%100,sleeves:(['none','right','left','both']as SleeveStyle[])[(seed>>>17)%4],gloves:(['none','light','dark']as GloveStyle[])[(seed>>>21)%3],tattooCoverage:tattooCoverageFor(seed),tattooStyle:tattooStyleFor(seed),tattooSeed:seed>>>1};
}
const intIn=(value:unknown,min:number,max:number,fallback:number)=>Number.isInteger(value)&&Number(value)>=min&&Number(value)<=max?Number(value):fallback;
export function normalizeAppearance(player:AppearancePlayer,input:unknown):Appearance{
 const base=defaultAppearance(player);if(!input||typeof input!=='object')return base;const v=input as Record<string,unknown>;if(![1,2,3].includes(Number(v.version)))return base;const current=Number(v.version)>=2, tattooed=Number(v.version)>=3;
 return{version:3,face:intIn(v.face,0,FACE_COUNT-1,base.face),hair:current?intIn(v.hair,0,HAIR_COUNT-1,base.hair):base.hair,facialHair:current?intIn(v.facialHair,0,FACIAL_HAIR_COUNT-1,base.facialHair):base.facialHair,eyeBlack:current?intIn(v.eyeBlack,0,EYE_BLACK_COUNT-1,base.eyeBlack):base.eyeBlack,build:['lean','athletic','power','heavy'].includes(String(v.build))?v.build as BodyBuild:base.build,number:intIn(v.number,0,99,base.number),sleeves:['none','right','left','both'].includes(String(v.sleeves))?v.sleeves as SleeveStyle:base.sleeves,gloves:current&&['none','light','dark'].includes(String(v.gloves))?v.gloves as GloveStyle:base.gloves,tattooCoverage:tattooed&&['none','minimal','upper-arm','forearm','half-sleeve','full-sleeve','both-arms'].includes(String(v.tattooCoverage))?v.tattooCoverage as TattooCoverage:base.tattooCoverage,tattooStyle:tattooed&&['blackwork','geometric','script','traditional','mixed'].includes(String(v.tattooStyle))?v.tattooStyle as TattooStyle:base.tattooStyle,tattooSeed:tattooed?intIn(v.tattooSeed,0,0x7fffffff,base.tattooSeed):base.tattooSeed};
}
function browserStore():Store|null{try{return typeof window==='undefined'?null:window.localStorage}catch{return null}}
export const appearanceKey=(id:string)=>APPEARANCE_PREFIX+encodeURIComponent(id);
export function readAppearance(player:AppearancePlayer,store:Store|null=browserStore()):Appearance{try{const raw=store?.getItem(appearanceKey(player.id));return normalizeAppearance(player,raw?JSON.parse(raw):null)}catch{return defaultAppearance(player)}}
export function saveAppearance(player:AppearancePlayer,value:Appearance,store:Store|null=browserStore()):boolean{if(!store)return false;const normalized=normalizeAppearance(player,value);try{store.setItem(appearanceKey(player.id),JSON.stringify(normalized))}catch{return false}if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('bk-solo-appearance',{detail:player.id}));return true;}
export function appearanceSignature(player:AppearancePlayer):string{const l=defaultAppearance(player);return[l.face,l.hair,l.facialHair,l.eyeBlack,l.build,l.sleeves,l.gloves,l.tattooCoverage,l.tattooStyle].join(':');}
export function uniformFor(player:AppearancePlayer,variant:UniformVariant='home'):Uniform{const team=SOLO_TEAM_THEMES.find(i=>i.abbr===player.team),primary=team?.primary??'#252c38',secondary=team?.secondary??'#d4af37';return{name:team?.name??(player.teamName&&player.team!=='FA'?player.teamName:'BK Training Kit'),abbr:team?.abbr??'BK',jersey:variant==='away'?'#f0f0e9':variant==='alternate'?'#171b24':primary,pants:variant==='away'?primary:variant==='alternate'?secondary:'#1a1e27',trim:secondary,ink:variant==='away'?primary:'#fff6d7',pattern:appearanceSeed(team?.abbr??'BK')%4};}
export const ATTRIBUTE_LABELS:Record<string,string>={athleticism:'Athleticism',footballIQ:'Football IQ',passing:'Passing',rushing:'Rushing',receiving:'Receiving',passBlocking:'Pass blocking',runBlocking:'Run blocking',passRush:'Pass rush',runDefense:'Run defense',coverage:'Coverage',kicking:'Kicking',throwPower:'Throw power',shortAccuracy:'Short accuracy',mediumAccuracy:'Medium accuracy',deepAccuracy:'Deep accuracy',pocketPresence:'Pocket presence',decisionMaking:'Decision making',mobility:'Mobility',playAction:'Play action',throwUnderPressure:'Under pressure'};
export function playerAttributes(player:Player):Array<{key:string;label:string;value:number}>{const fields:Array<[string,unknown]>=[['speed',player.speed],['strength',player.strength],['awareness',player.awareness],...Object.entries(player.attributes??{})];return fields.filter(([,v])=>typeof v==='number'&&Number.isFinite(v)).map(([key,v])=>({key,label:ATTRIBUTE_LABELS[key]??key.charAt(0).toUpperCase()+key.slice(1),value:Number(v)}));}

/** Shared identity for save detection and render invalidation, including tattoo-only edits. */
export function appearanceRenderKey(look: Appearance): string {
  return JSON.stringify(Object.keys(look).sort().map(key => [key, look[key as keyof Appearance]]));
}
export function sameAppearance(first: Appearance, second: Appearance): boolean {
  return appearanceRenderKey(first) === appearanceRenderKey(second);
}
