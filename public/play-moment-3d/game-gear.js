// Cosmetic settings shared by the Locker and the shipped game renderer.
export const GAME_GEAR_DEFAULTS=Object.freeze({gloves:'standard',leftSleeve:'none',rightSleeve:'none',leftWrist:'none',rightWrist:'none',cleats:'standard',facemask:'standard'});
export const GAME_GEAR_OPTIONS=Object.freeze({gloves:['standard','white','black','team'],leftSleeve:['none','white','black','team'],rightSleeve:['none','white','black','team'],leftWrist:['none','white','black','team'],rightWrist:['none','white','black','team'],cleats:['standard','white','black','team'],facemask:['standard','white','black','team']});
export function sanitizeGameGear(raw){return Object.fromEntries(Object.entries(GAME_GEAR_DEFAULTS).map(([key,fallback])=>[key,GAME_GEAR_OPTIONS[key].includes(raw?.[key])?raw[key]:fallback]));}
export function gearColor(value,team='#ba9148'){
 if(value==='none'||value==='standard')return [0,0,0,0];
 const hex=value==='white'?'#eef0ef':value==='black'?'#171c23':/^#[0-9a-f]{6}$/i.test(team)?team:'#ba9148';
 return [...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),1];
}
// A roster identity stays fixed through possession changes and special teams.
// Equipment never follows the ball or changes any player's ratings.
export function gameGearRosterId(profile,home){
 const index={QB:5,RB:6,WR:7,TE:10,EDGE:11,LB:15,CB:18,S:21}[profile?.position];
 return profile?.version===1&&typeof profile.name==='string'&&profile.name.trim()&&Number.isInteger(index)?home?.lineup?.[index]?.id||null:null;
}
export function readGameGearProfile(storage){try{storage??=globalThis.localStorage;return JSON.parse(storage.getItem('ballknower_solo_my_player_v2')||'null');}catch{return null;}}
