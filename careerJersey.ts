import {SOLO_TEAM_THEMES} from './soloUniverse';
export type CareerJersey={team:string;teamName:string;color:string;accent:string;playerName:string;number:number};
export function careerJersey(raw?:unknown):CareerJersey {
 if(raw===undefined){try{raw=JSON.parse(localStorage.getItem('ballknower_solo_my_player_v2')||'null');}catch{raw=null;}}
 const p=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>;
 const team=p.version===1&&['drafted','camp','season'].includes(String(p.stage))?SOLO_TEAM_THEMES.find(t=>t.abbr===p.teamAbbr):undefined;
 return {team:team?.abbr||'BK',teamName:team?.name||'BK Prospect',color:team?.primary||'#242a30',accent:team?.secondary||'#d7b877',playerName:typeof p.name==='string'?p.name.trim().split(/\s+/).pop()!.slice(0,24).toUpperCase():'PLAYER',number:typeof p.number==='number'&&Number.isInteger(p.number)&&p.number>=0&&p.number<=99?p.number:0};
}
