import {writeFileSync} from 'node:fs';
import {SOLO_TEAM_THEMES,SOLO_PLAYERS_DATABASE} from '../soloUniverse';
const slots=[['LT'],['LG'],['C'],['RG'],['RT'],['QB'],['RB'],['WR'],['WR'],['WR'],['TE'],['EDGE','DE'],['DT','NT'],['DT','NT'],['EDGE','DE'],['LB'],['LB'],['LB'],['CB'],['FS','SS'],['CB'],['FS','SS']];
const mean=(players:any[])=>Math.round(players.reduce((n,p)=>n+p.overall,0)/players.length);
const teams=SOLO_TEAM_THEMES.map(team=>{
 const roster=SOLO_PLAYERS_DATABASE.filter(p=>p.team===team.abbr).sort((a,b)=>(b.overall??0)-(a.overall??0)||a.id.localeCompare(b.id));
 const used=new Set<string>();
 const pick=(positions:string[])=>{const p=roster.find(p=>positions.includes(p.position)&&!used.has(p.id));if(!p)throw Error(team.abbr+positions);used.add(p.id);return {id:p.id,name:p.name,lastName:p.lastName,number:p.jerseyNumber,overall:p.overall,attributes:p.attributes,speed:p.speed};};
 const lineup=slots.map(pick),fullback=pick(['RB']);
 return {...team,overall:mean(lineup),offense:mean(lineup.slice(0,11)),defense:mean(lineup.slice(11)),lineup,fullback,kicker:pick(['K']),punter:pick(['P'])};
});
writeFileSync('public/play-moment-3d/mini-teams-data.js','// Generated from soloUniverse.ts by scripts/build-mini-teams.ts.\nexport const MINI_TEAMS = '+JSON.stringify(teams)+';\n');
console.log('Generated',teams.length,'Solo team lineups, OVR range',Math.min(...teams.map(t=>t.overall)),Math.max(...teams.map(t=>t.overall)));
