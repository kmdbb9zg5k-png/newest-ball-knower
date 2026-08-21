import { Player } from './types';
export function audit2026Data(players:Player[]) {
 const issues:string[]=[]; const ids=new Set<string>(); const identities=new Set<string>();
 for(const p of players){
  if(ids.has(p.id)) issues.push(`Duplicate ID: ${p.id}`); ids.add(p.id);
  // Different NFL players can legitimately share a name. Only flag the same
  // normalized name/team/position combination as a duplicated player record.
  const identity=`${p.name.toLowerCase().replace(/[^a-z0-9]/g,'')}|${p.team}|${p.position}`;
  if(identities.has(identity)) issues.push(`Duplicate player record: ${p.name} (${p.team} ${p.position})`);
  identities.add(identity);
  if(!p.team || !p.position) issues.push(`Missing team/position: ${p.name}`);
  if(p.ovr<40 || p.ovr>99) issues.push(`Invalid OVR: ${p.name}`);
  if(p.salary<0) issues.push(`Invalid cap hit: ${p.name}`);
 }
 const teams=new Set(players.filter(p=>p.active!==false).map(p=>p.team));
 const positions=['QB','RB','WR','TE','K','P'];
 for(const pos of positions) if(!players.some(p=>p.position===pos)) issues.push(`No active ${pos} records`);
 return {ok:issues.length===0, issues, playerCount:players.length, teamCount:teams.size,
   verifiedCapHits:players.filter(p=>p.salaryType==='cap_hit').length,
   estimatedCapHits:players.filter(p=>p.salaryType!=='cap_hit').length};
}
