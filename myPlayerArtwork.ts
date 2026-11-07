import type {JourneyChapter} from './myPlayerJourney';
import type {CareerPerson} from './myPlayerCareer';
export const MY_PLAYER_SCENES = ['origin','training','agent','recovery','film','interview','visit','draft','camp','coach','rivalry','locker','gameday','contract','legacy','media'] as const;
export type MyPlayerScene = typeof MY_PLAYER_SCENES[number];
export const MY_PLAYER_JOURNEY_SCENES:Record<JourneyChapter,MyPlayerScene> = {roots:'origin',camp:'training',agent:'agent',recovery:'recovery',film:'film',interview:'interview',visit:'visit'};
export const MY_PLAYER_CONVERSATION_SCENES:Record<CareerPerson,MyPlayerScene> = {agent:'agent',headCoach:'coach',coach:'coach',trainer:'recovery',rival:'rivalry',teammate:'locker'};
export const myPlayerScenePath=(scene:MyPlayerScene)=>`/my-player-scenes/${scene}-v1.webp`;
export const myPlayerDraftScene=(revealed:boolean,kind:'drafted'|'undrafted'):MyPlayerScene=>revealed&&kind==='drafted'?'draft':'agent';
export const myPlayerPreparationScene=(selected:string,fallback:MyPlayerScene):MyPlayerScene=>selected==='recovery'?'recovery':selected==='film'?'film':selected==='extra'?'training':fallback;
