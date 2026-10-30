import assert from 'node:assert/strict';
import {GAME_GEAR_DEFAULTS,sanitizeGameGear,gameGearRosterId,gearColor} from '../public/play-moment-3d/game-gear.js';
import {athletePassport,ATHLETE_SAVE_KEY} from '../athletePassport';
import {savePlayerGameGear} from '../playerGameGear';
import {MINI_TEAMS} from '../public/play-moment-3d/mini-teams.js';
assert.deepEqual(sanitizeGameGear(null),GAME_GEAR_DEFAULTS);
assert.deepEqual(sanitizeGameGear({gloves:'javascript:bad',leftSleeve:'red',cleats:42,extra:true}),GAME_GEAR_DEFAULTS);
assert.equal(sanitizeGameGear({leftSleeve:'white',rightSleeve:'black'}).rightSleeve,'black');
const gear=sanitizeGameGear({gloves:'team',leftWrist:'white',rightSleeve:'black'});
const original={version:1,combineId:'gear-test',name:'Game Athlete',position:'WR',stage:'season',speed:84,overall:77,number:4,tattooArms:'both',careerLife:{games:17},gameGear:gear};
const items=new Map([[ATHLETE_SAVE_KEY,JSON.stringify(original)]]),events:string[]=[];
Object.assign(globalThis,{localStorage:{getItem:(k:string)=>items.get(k)||null,setItem:(k:string,v:string)=>items.set(k,v)},window:{dispatchEvent:(e:Event)=>events.push(e.type)}});
const next=savePlayerGameGear('gear-test',{...gear,leftSleeve:'white'});assert.deepEqual(JSON.parse(items.get(ATHLETE_SAVE_KEY)!),{...original,gameGear:next});assert.deepEqual(athletePassport(JSON.parse(items.get(ATHLETE_SAVE_KEY)!))?.gameGear,next);assert(events.includes('ballknower:athlete-changed'));
assert.throws(()=>savePlayerGameGear('other-player',gear));
for(const home of MINI_TEAMS)for(const position of ['QB','RB','WR','TE','EDGE','LB','CB','S']){const id=gameGearRosterId({...original,position},home);assert(home.lineup.some(p=>p.id===id));}
assert.equal(gameGearRosterId({...original,position:'invalid'},MINI_TEAMS[0]),null);assert.equal(gameGearRosterId(null,MINI_TEAMS[0]),null);
assert.deepEqual(gearColor('team','#112233'),[17/255,34/255,51/255,1]);assert.deepEqual(gearColor('none'),[0,0,0,0]);
console.log('PASS gear migration, malformed input, independent arms, same-player persistence, unchanged career/ratings, all 32 team position mappings and team colors.');
