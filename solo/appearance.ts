import type { Player } from '../types';
import { SOLO_TEAM_THEMES } from '../soloUniverse';

export const SOLO_ART_VERSION = 1 as const;
export const SOLO_ART_ROOT = '/solo-characters/v1';
export const FACE_COUNT = 9;
export const FACE_SKIN = ['#8f634d','#4d3024','#94624b','#7a4e3a','#5a3523','#a97455','#40261b','#a16b52','#815239'];
export const APPEARANCE_PREFIX = 'ball-knower-solo-appearance-v1:';
export type UniformVariant = 'home' | 'away' | 'alternate';
export type BodyBuild = 'lean' | 'athletic' | 'power';
export type Appearance = {
  version: 1;
  face: number;
  build: BodyBuild;
  number: number;
  sleeves: 'right' | 'both';
};
export type AppearancePlayer = Pick<Player,'id'|'name'|'team'> & {position:string} & Partial<Pick<Player,'jerseyNumber'|'teamName'>>;
export type Uniform = { name: string; abbr: string; jersey: string; pants: string; trim: string; ink: string; pattern: number };
type Store = Pick<Storage,'getItem'|'setItem'|'removeItem'>;

/** Identity deliberately excludes team, name, rating, age, season and array index. */
export function appearanceSeed(id: string): number {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function defaultAppearance(player: AppearancePlayer): Appearance {
  const seed = appearanceSeed(player.id);
  const power = ['LT','RT','LG','RG','C','OT','OG','DT','NT'].includes(player.position);
  const athletic = ['TE','LB','EDGE','DE','FB'].includes(player.position);
  const number = player.jerseyNumber;
  return {
    version: 1, face: seed % FACE_COUNT,
    build: power ? 'power' : athletic ? 'athletic' : 'lean',
    number: Number.isInteger(number) && number! >= 0 && number! <= 99 ? number! : (seed >>> 8) % 100,
    sleeves: seed & 1 ? 'right' : 'both',
  };
}

export function normalizeAppearance(player: AppearancePlayer, input: unknown): Appearance {
  const base = defaultAppearance(player);
  if (!input || typeof input !== 'object' || (input as {version?:unknown}).version !== 1) return base;
  const value = input as Record<string,unknown>;
  return {
    version: 1,
    face: Number.isInteger(value.face) && Number(value.face) >= 0 && Number(value.face) < FACE_COUNT ? Number(value.face) : base.face,
    build: ['lean','athletic','power'].includes(String(value.build)) ? value.build as BodyBuild : base.build,
    number: Number.isInteger(value.number) && Number(value.number) >= 0 && Number(value.number) <= 99 ? Number(value.number) : base.number,
    sleeves: value.sleeves === 'right' || value.sleeves === 'both' ? value.sleeves : base.sleeves,
  };
}

function browserStore(): Store | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}
export const appearanceKey = (id: string) => APPEARANCE_PREFIX + encodeURIComponent(id);

export function readAppearance(player: AppearancePlayer, store: Store | null = browserStore()): Appearance {
  try {
    const raw = store?.getItem(appearanceKey(player.id));
    return normalizeAppearance(player, raw ? JSON.parse(raw) : null);
  } catch { return defaultAppearance(player); }
}

/** Persist before notifying subscribers. Failure never destroys the previous appearance. */
export function saveAppearance(player: AppearancePlayer, value: Appearance, store: Store | null = browserStore()): boolean {
  if (!store) return false;
  const normalized = normalizeAppearance(player,value);
  try { store.setItem(appearanceKey(player.id),JSON.stringify(normalized)); }
  catch { return false; }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bk-solo-appearance',{detail:player.id}));
  return true;
}

export function uniformFor(player: AppearancePlayer, variant: UniformVariant = 'home'): Uniform {
  const team = SOLO_TEAM_THEMES.find(item => item.abbr === player.team);
  // Unassigned prospects/free agents never silently acquire the first team's identity.
  const primary = team?.primary ?? '#252c38';
  const secondary = team?.secondary ?? '#d4af37';
  return {
    name: team?.name ?? (player.teamName && player.team !== 'FA' ? player.teamName : 'BK Training Kit'),
    abbr: team?.abbr ?? 'BK',
    jersey: variant === 'away' ? '#f0f0e9' : variant === 'alternate' ? '#171b24' : primary,
    pants: variant === 'away' ? primary : '#1a1e27',
    trim: secondary,
    ink: variant === 'away' ? primary : '#fff6d7',
    pattern: appearanceSeed(team?.abbr ?? 'BK') % 4,
  };
}

export const ATTRIBUTE_LABELS: Record<string,string> = {
  athleticism:'Athleticism',footballIQ:'Football IQ',passing:'Passing',rushing:'Rushing',receiving:'Receiving',
  passBlocking:'Pass blocking',runBlocking:'Run blocking',passRush:'Pass rush',runDefense:'Run defense',
  coverage:'Coverage',kicking:'Kicking',throwPower:'Throw power',shortAccuracy:'Short accuracy',
  mediumAccuracy:'Medium accuracy',deepAccuracy:'Deep accuracy',pocketPresence:'Pocket presence',
  decisionMaking:'Decision making',mobility:'Mobility',playAction:'Play action',throwUnderPressure:'Under pressure',
};
export function playerAttributes(player: Player): Array<{key:string;label:string;value:number}> {
  const fields: Array<[string,unknown]> = [['speed',player.speed],['strength',player.strength],['awareness',player.awareness],...Object.entries(player.attributes ?? {})];
  return fields.filter(([,value])=>typeof value === 'number' && Number.isFinite(value))
    .map(([key,value])=>({key,label:ATTRIBUTE_LABELS[key] ?? key.charAt(0).toUpperCase()+key.slice(1),value:Number(value)}));
}
