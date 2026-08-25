import { Player, TeamRatings } from './types';

const fantasyPositions = new Set(['QB','RB','WR','TE','K','DST']);
const avg = (players: Player[], fallback = 65) => players.length ? players.reduce((sum,p)=>sum+p.ovr,0)/players.length : fallback;
const topAvg = (players: Player[], count: number, fallback = 65) => avg([...players].sort((a,b)=>b.ovr-a.ovr).slice(0,count),fallback);
const clamp = (value:number) => Math.round(Math.max(40,Math.min(99,value)));

export const isFantasyRoster = (roster: Player[]) => roster.length > 0 && roster.every(player=>fantasyPositions.has(player.position));

export function calculateFantasyTeamRatings(roster: Player[]): TeamRatings {
  const at=(position:string)=>roster.filter(player=>player.position===position);
  const qb=topAvg(at('QB'),1), rb=topAvg(at('RB'),2), wr=topAvg(at('WR'),3), te=topAvg(at('TE'),1);
  const flex=topAvg(roster.filter(player=>['RB','WR','TE'].includes(player.position)),6);
  const kicker=topAvg(at('K'),1,60), dst=topAvg(at('DST'),1,60), depth=topAvg(roster,12);
  const offense=clamp(qb*.24+rb*.22+wr*.27+te*.10+flex*.12+depth*.05);
  const defense=clamp(dst*.72+kicker*.08+depth*.20);
  const overall=clamp(offense*.78+defense*.10+depth*.12);
  const groups=[at('QB'),at('RB'),at('WR'),at('TE'),at('K'),at('DST')].filter(group=>group.length).map(group=>topAvg(group,Math.min(2,group.length)));
  const spread=groups.length ? Math.max(...groups)-Math.min(...groups) : 30;
  const balanceScore=clamp(100-spread*1.8);
  const penalties:string[]=[];
  if(!at('QB').length) penalties.push('No quarterback');
  if(at('RB').length<2) penalties.push('Thin running back room');
  if(at('WR').length<3) penalties.push('Thin wide receiver room');
  if(!at('TE').length) penalties.push('No tight end');
  if(!at('K').length) penalties.push('No kicker');
  if(!at('DST').length) penalties.push('No D/ST');
  const strengths=[
    ...(qb>=85?['Elite quarterback ceiling']:[]),
    ...(rb>=84?['High-end running backs']:[]),
    ...(wr>=84?['Deep receiving corps']:[]),
    ...(depth>=82?['Strong fantasy depth']:[]),
  ];
  return {overall,offense,defense,passing:clamp(qb*.55+wr*.32+te*.13),rushing:clamp(rb*.78+flex*.22),passProtection:clamp(depth),runBlocking:clamp(flex),passRush:clamp(dst),runDefense:clamp(dst),coverage:clamp(dst),balanceScore,efficiencyRating:clamp(overall*.7+balanceScore*.3),penalties,strengths};
}
