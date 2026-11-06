// Isolated real-mode fixture. It writes only browser-local test saves.
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
export const out='artifacts/career-depth';
export async function prepareCareerDepthFixture(){
 const styles=[...(await readFile('dist/index.html','utf8')).matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^\"]+\.css)"/g)].map(m=>`<link rel="stylesheet" href="/dist${m[1]}">`).join('');
 const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import{RealTeamFranchise}from'./RealTeamFranchise';import{PlayerAgentMode}from'./PlayerAgentMode';import{OwnerBusinessMode}from'./OwnerBusinessMode';import{buildSoloTeamRoster,SOLO_FRANCHISE_SAVE_KEYS}from'./soloFranchiseEngine';import{SOLO_TEAM_THEMES,SOLO_UNIVERSE_VERSION}from'./soloUniverse';import{createClientCareer}from'./agentClientCareer';
 const mode=new URLSearchParams(location.search).get('mode')||'gm',team=SOLO_TEAM_THEMES.find(t=>t.abbr==='AUS'),roster=buildSoloTeamRoster(team.abbr),player=roster.find(p=>p.position==='WR'),destination=SOLO_TEAM_THEMES.find(t=>t.abbr!==player.team).abbr;
 if(mode==='gm'&&!localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.real))localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.real,JSON.stringify({version:5,careerId:'qa-depth',teamAbbr:team.abbr,roster,draftPickAssets:[],gamePlan:'Balanced attack',opponentRosters:{}}));
 if(mode==='agent'&&!localStorage.getItem('ballknower_player_agent_v4'))localStorage.setItem('ballknower_player_agent_v4',JSON.stringify({universeVersion:SOLO_UNIVERSE_VERSION,profile:{name:'Agent depth QA',age:28,location:'Austin',portraitId:'agent-01'},reputation:40,negotiation:50,seasonYear:2029,seasonWeek:6,phase:'regular',simulatedDate:'2029-10-18',clients:[{playerId:player.id,currentTeam:destination,trust:75,signedAt:'2026-09-03',career:createClientCareer([],75),futureDeal:{annualM:10,totalM:30,guaranteedM:15,years:3,negotiatedAt:'2026-09-03',signingYear:2026,startYear:2027,endYear:2029}}],seasonHistory:[{year:2028,clients:1,deals:1,reputation:38,cashK:150,promisesKept:0,promisesBroken:0}]}));
 if(mode==='owner'&&!localStorage.getItem('ballknower_owner_career_v3'))localStorage.setItem('ballknower_owner_career_v3',JSON.stringify({universeVersion:SOLO_UNIVERSE_VERSION,ownerName:'Owner depth QA',abbr:team.abbr,season:2026,week:4,stage:'regular',cashM:350,seasonStaffCommitmentsM:17.5,seasonRevenueM:18,seasonExpensesM:5,history:[],usedDecisionIds:[],gm:{id:'cap',name:'Marcus Grant',costM:7.5,football:78,culture:70},coach:{id:'teacher',name:'Malik Hayes',costM:10,football:78,culture:91}}));
 window.qaDepthPlayer=player.id;window.qaDepthDestination=destination;
 createRoot(document.getElementById('root')).render(mode==='agent'?<PlayerAgentMode onBack={()=>{}}/>:mode==='owner'?<OwnerBusinessMode onBack={()=>{}}/>:<RealTeamFranchise onBack={()=>{}}/>);`;
 await mkdir(out,{recursive:true});
 await build({plugins:[{name:'exact-case',setup(b){b.onResolve({filter:/^\./},args=>{for(const ext of ['.ts','.tsx']){const path=resolve(args.resolveDir,args.path+ext);if(existsSync(path))return{path}}})}}],stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',outfile:out+'/fixture.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},loader:{'.png':'dataurl','.webp':'dataurl','.jpg':'dataurl','.svg':'dataurl'},logLevel:'error'});
 const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<link rel="stylesheet" href="/${out}/fixture.css"><style>body{margin:0;background:#0c1119;color:white}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/${out}/fixture.js"></script></body></html>`;
 await writeFile(out+'/index.html',html);return html;
}
if(process.argv[1]?.endsWith('career-depth-fixture.mjs'))await prepareCareerDepthFixture();
