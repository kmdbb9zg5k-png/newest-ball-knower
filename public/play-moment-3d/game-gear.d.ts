export type GearColor='standard'|'none'|'white'|'black'|'team';
export type GameGear={gloves:GearColor;leftSleeve:GearColor;rightSleeve:GearColor;leftWrist:GearColor;rightWrist:GearColor;cleats:GearColor;facemask:GearColor};
export const GAME_GEAR_DEFAULTS:Readonly<GameGear>;
export const GAME_GEAR_OPTIONS:Record<keyof GameGear,readonly GearColor[]>;
export function sanitizeGameGear(raw:unknown):GameGear;
export function gearColor(value:GearColor,team?:string):number[];
export function gameGearRosterId(profile:unknown,home:unknown):string|null;
export function readGameGearProfile(storage:Storage):Record<string,unknown>|null;
