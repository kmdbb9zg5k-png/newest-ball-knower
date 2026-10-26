import type {Player} from './types';
export type MyPlayerRole='starter'|'rotation'|'development';
export function currentCareerRole(initial:MyPlayerRole,overall:number,games:number):MyPlayerRole{
 if(initial==='starter'||overall>=78&&games>=4)return 'starter';
 if(initial==='rotation'||overall>=70&&games>=3)return 'rotation';
 return 'development';
}
/** Career choices govern stat opportunities; legacy franchise callers are unchanged. */
export function myPlayerStatOpportunity(roster:Player[],id:string|undefined,role:MyPlayerRole|undefined,week:number){
 if(!id||!role)return {roster,focusPlayerId:undefined};
 const player=roster.find(p=>p.id===id);if(!player)return {roster,focusPlayerId:undefined};
 const available=role==='starter'||role==='rotation'&&week%2===1||role==='development'&&week%4===0;
 return {roster:available?[player,...roster.filter(p=>p.id!==id)]:roster.filter(p=>p.id!==id),focusPlayerId:available?id:undefined};
}
export function mergeMyPlayerProgress(roster:Player[],id:string|undefined,progress:Pick<Player,'ovr'|'speed'|'strength'|'awareness'>|undefined){
 if(!id||!progress)return roster;
 return roster.map(player=>player.id!==id?player:{...player,ovr:Math.max(player.ovr,progress.ovr),overall:Math.max(player.ovr,progress.ovr),overallRating:Math.max(player.ovr,progress.ovr),speed:Math.max(player.speed||0,progress.speed||0),strength:Math.max(player.strength||0,progress.strength||0),awareness:Math.max(player.awareness||0,progress.awareness||0),attributes:{...player.attributes,athleticism:Math.max(player.attributes?.athleticism||0,Math.round(((progress.speed||0)+(progress.strength||0))/2)),footballIQ:Math.max(player.attributes?.footballIQ||0,progress.awareness||0)}});
}
