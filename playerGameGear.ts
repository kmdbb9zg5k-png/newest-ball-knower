import {ATHLETE_CHANGED,ATHLETE_SAVE_KEY,athletePassport} from './athletePassport';
import {sanitizeGameGear,type GameGear} from './public/play-moment-3d/game-gear.js';
export {sanitizeGameGear,GAME_GEAR_DEFAULTS,GAME_GEAR_OPTIONS,type GameGear,type GearColor} from './public/play-moment-3d/game-gear.js';
export const GAME_GEAR_CHANGED='ballknower:game-gear-changed';
export function savePlayerGameGear(id:string,gear:GameGear){
 const raw=JSON.parse(localStorage.getItem(ATHLETE_SAVE_KEY)||'null');
 if(athletePassport(raw)?.id!==id)throw new Error('Your active player changed. Reopen the Locker before equipping gear.');
 const next=sanitizeGameGear(gear);
 localStorage.setItem(ATHLETE_SAVE_KEY,JSON.stringify({...raw,gameGear:next}));
 window.dispatchEvent(new Event(GAME_GEAR_CHANGED));
 window.dispatchEvent(new Event(ATHLETE_CHANGED));
 return next;
}
