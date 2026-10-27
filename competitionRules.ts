import type {MiniGameId,MiniStats} from './miniChallenges';
export const COMPETITION_GAMES = ['dash','shuttle','bench','broad-jump','routes','one-on-one','rb','db'] as const;
export type CompetitionGame=typeof COMPETITION_GAMES[number];
export const COMPETITION_DURATIONS=[1,3,24,72] as const;
export function validCompetitionGames(games:unknown):games is CompetitionGame[]{return Array.isArray(games)&&games.length===3&&new Set(games).size===3&&games.every(g=>COMPETITION_GAMES.includes(g));}
export function competitionScorePreview(game:MiniGameId,stats:MiniStats):number|null{
 let raw:number;
 switch(game){case 'dash':if(stats.dnf===1)return 0;raw=(8-stats.time)*25;break;case 'shuttle':raw=(10-stats.time)*20;break;case 'bench':raw=stats.reps*2;break;case 'broad-jump':raw=stats.distance*25;break;case 'routes':case 'one-on-one':case 'rb':case 'db':raw=stats.score;break;default:return null;}
 return Number.isFinite(raw)?Math.round(Math.max(0,Math.min(100,raw))*1000)/1000:null;
}
export function competitionWeek(now:Date){const start=new Date(now);start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));return {start:start.toISOString(),end:new Date(start.getTime()+7*86400000).toISOString()};}
export function competitionRankings(rows:{userId:string;points:number;completed:number}[]){const sorted=rows.filter(r=>r.completed===3).sort((a,b)=>b.points-a.points||a.userId.localeCompare(b.userId));return sorted.map((row,i)=>({...row,rank:sorted.findIndex(r=>r.points===row.points)+1,badge:row.points===sorted[0]?.points?'champion':'finisher'}));}
