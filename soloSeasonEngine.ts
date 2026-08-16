import { Player, LeagueMember, SimulationGame, TeamRatings, DEFAULT_SALARY_CAP } from '../types';
import { calculateTeamRatings } from './evaluation';
import { simulateGame } from './simulation';
import { chooseSmartPick, GmPersonality, gradeDraft } from './smartDraft';
import { PLAYERS_DATABASE } from '../data/players';

export type SoloDifficulty='rookie'|'pro'|'all_pro'|'all_madden';
export type InjurySetting='off'|'normal'|'chaos';

export interface PlayerLine {
  playerId:string; name:string; position:string;
  passYds?:number; passTD?:number; interceptions?:number;
  rushYds?:number; rushTD?:number; receptions?:number; recYds?:number; recTD?:number;
  tackles?:number; sacks?:number; picks?:number;
  fgMade?:number; fgAtt?:number; puntsInside20?:number;
  fantasyScore:number;
}
export interface InjuryEvent { playerId:string; playerName:string; position:string; weeks:number; week:number; severity:string; }
export interface SoloWeek {
  week:number; opponent:string; game:SimulationGame; won:boolean; playerLines:PlayerLine[];
  injuries:InjuryEvent[]; playoffSeed:number; playoffOdds:number; record:string;
}
export interface CareerProfile {
  runs:number; championships:number; playoffWins:number; regularWins:number; regularLosses:number;
  bestRecord:string; bestScore:number; perfectSeasons:number; achievements:string[];
}
export interface SoloSettings { difficulty:SoloDifficulty; injuries:InjurySetting; }

const NAMES=[
 'Baltimore Blackbirds','Buffalo Blizzard','Miami Waves','Boston Minutemen','Cleveland Hounds','Cincinnati Kings',
 'Pittsburgh Iron','Houston Outlaws','Indianapolis Racers','Jacksonville Storm','Tennessee Copperheads','Denver Peaks',
 'Kansas City Monarchs','Las Vegas Aces','Los Angeles Bolts','New York Knights','Dallas Wranglers','Philadelphia Liberty',
 'Washington Generals','Chicago Grizzlies','Detroit Motors','Green Bay Northmen','Minnesota Valkyries','Atlanta Flight',
 'Carolina Reapers','New Orleans Krewe','Tampa Bay Corsairs','Arizona Scorpions','Los Angeles Gold','San Francisco Rush','Seattle Orcas'
];
const PERSONALITIES:GmPersonality[]=['balanced','star_hunter','value_hunter','trenches','defense_first','air_raid'];

function seeded(seed:number){ let x=seed|0; return ()=>{x=Math.imul(x^x>>>15,1|x);x^=x+Math.imul(x^x>>>7,61|x);return ((x^x>>>14)>>>0)/4294967296};}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

export function buildSoloAiRoster(seed:number):Player[]{
 const roster:Player[]=[];
 for(let i=0;i<60&&roster.length<20;i++){
  const p=chooseSmartPick(PLAYERS_DATABASE,roster,DEFAULT_SALARY_CAP,PERSONALITIES[(seed+i)%PERSONALITIES.length]);
  if(!p) break; roster.push(p);
 }
 return roster;
}
export function makeSoloOpponent(week:number,difficulty:SoloDifficulty):LeagueMember{
 let roster=buildSoloAiRoster(week*11+13);
 const bias={rookie:-4,pro:0,all_pro:2,all_madden:4}[difficulty];
 let ratings=calculateTeamRatings(roster);
 ratings={...ratings,
  overall:Math.max(65,Math.min(99,ratings.overall+bias)),
  offense:Math.max(65,Math.min(99,ratings.offense+bias)),
  defense:Math.max(65,Math.min(99,ratings.defense+bias)),
  passing:Math.max(65,Math.min(99,ratings.passing+bias)),
  rushing:Math.max(65,Math.min(99,ratings.rushing+bias)),
  passRush:Math.max(65,Math.min(99,ratings.passRush+bias)),
  runDefense:Math.max(65,Math.min(99,ratings.runDefense+bias)),
  coverage:Math.max(65,Math.min(99,ratings.coverage+bias)),
 } as TeamRatings;
 return {id:`solo-ai-${week}`,userId:`solo-ai-${week}`,userName:NAMES[(week-1)%NAMES.length],isCommissioner:false,isAi:true,status:'ready',roster,teamRatings:ratings};
}
export function ratingsWithInjuries(roster:Player[], active:InjuryEvent[], bench:Player[]=[]):TeamRatings{
 const base=calculateTeamRatings(roster); if(!active.length)return base;
 let off=0,def=0;
 for(const i of active){
  const p=roster.find(x=>x.id===i.playerId); if(!p)continue;
  const family=(pos:string)=>['OT','LT','RT','OG','LG','RG','C'].includes(pos)?'OL':['EDGE','DT','DE','NT'].includes(pos)?'DL':['S','FS','SS'].includes(pos)?'S':pos;
  const replacement=bench.filter(b=>family(b.position)===family(p.position)).sort((a,b)=>b.ovr-a.ovr)[0];
  const baseHit=Math.max(1,(p.ovr-70)*.08);
  const hit=replacement ? Math.max(.25, baseHit * Math.max(.2, (p.ovr-replacement.ovr+8)/18)) : baseHit;
  if(['QB','RB','WR','TE','OT','LT','RT','OG','LG','RG','C'].includes(p.position)) off+=hit; else def+=hit;
 }
 return {...base,overall:Math.round(base.overall-(off+def)*.3),offense:Math.round(base.offense-off),defense:Math.round(base.defense-def)};
}
export function simulateInjuries(roster:Player[],week:number,setting:InjurySetting,current:InjuryEvent[]):InjuryEvent[]{
 if(setting==='off')return[];
 const r=seeded(hash(`injury:${week}:${roster.map(p=>p.id).join('|')}`));
 const rate=setting==='chaos'?.18:.075;
 if(r()>rate)return[];
 const candidates=roster.filter(p=>!current.some(i=>i.playerId===p.id&&i.weeks>0));
 if(!candidates.length)return[];
 const p=candidates[Math.floor(r()*candidates.length)];
 const roll=r(); const weeks=roll<.58?1:roll<.86?2:roll<.97?3:5;
 return [{playerId:p.id,playerName:p.name,position:p.position,weeks,week,severity:weeks===1?'Minor':weeks<=3?'Moderate':'Major'}];
}
export function generatePlayerLines(roster:Player[],game:SimulationGame,userHome:boolean,week:number):PlayerLine[]{
 const pts=userHome?game.homeScore:game.awayScore; const r=seeded(hash(`stats:${week}:${game.id}`));
 const qb=roster.find(p=>p.position==='QB'), rb=roster.find(p=>['RB','FB'].includes(p.position));
 const wr=roster.filter(p=>p.position==='WR'), te=roster.find(p=>p.position==='TE');
 const def=roster.filter(p=>['EDGE','DT','DE','NT','LB','CB','S','FS','SS'].includes(p.position));
 const k=roster.find(p=>p.position==='K'), punter=roster.find(p=>p.position==='P');
 const lines:PlayerLine[]=[]; const totalTD=Math.max(1,Math.floor(pts/7)); const passTD=Math.max(0,Math.min(totalTD,Math.round(totalTD*(.55+r()*.25))));
 if(qb){const y=Math.round(190+(qb.ovr-75)*5+r()*85);lines.push({playerId:qb.id,name:qb.name,position:'QB',passYds:y,passTD,interceptions:r()<.55?0:r()<.85?1:2,rushYds:Math.round(r()*35),fantasyScore:Math.round((y/25+passTD*4)*10)/10})}
 if(rb){const y=Math.round(45+(rb.ovr-70)*2.2+r()*55);const td=Math.max(0,totalTD-passTD>0?Math.round(r()*(totalTD-passTD+1)):0);lines.push({playerId:rb.id,name:rb.name,position:'RB',rushYds:y,rushTD:td,receptions:Math.round(2+r()*4),recYds:Math.round(10+r()*45),fantasyScore:Math.round((y/10+td*6)*10)/10})}
 const targets=[...wr,...(te?[te]:[])];
 targets.forEach((p,i)=>{const y=Math.round(25+(p.ovr-70)*1.8+r()*70);const td=i<passTD?1:0;lines.push({playerId:p.id,name:p.name,position:p.position,receptions:Math.max(1,Math.round(2+r()*6)),recYds:y,recTD:td,fantasyScore:Math.round((y/10+td*6)*10)/10})});
 def.sort((a,b)=>b.ovr-a.ovr).slice(0,4).forEach((p,i)=>{const sacks=['EDGE','DT','DE','NT','LB'].includes(p.position)?Math.round(r()*2):0;const picks=['CB','S','FS','SS','LB'].includes(p.position)&&r()>.65?1:0;lines.push({playerId:p.id,name:p.name,position:p.position,tackles:Math.round(3+r()*7),sacks,picks,fantasyScore:sacks*4+picks*6})});
 if(k){const att=Math.max(1,Math.round(pts/10));const made=Math.max(0,att-(r()<.78?0:1));lines.push({playerId:k.id,name:k.name,position:'K',fgMade:made,fgAtt:att,fantasyScore:made*3})}
 if(punter) lines.push({playerId:punter.id,name:punter.name,position:'P',puntsInside20:Math.round(1+r()*3),fantasyScore:Math.round(r()*3)});
 return lines;
}
export function playoffSnapshot(wins:number,losses:number,week:number){
 const pct=wins/Math.max(1,wins+losses);
 const seed=Math.max(1,Math.min(12,Math.round(9-(pct-.5)*10+(17-week)*.05)));
 const odds=Math.max(1,Math.min(99,Math.round(8+pct*88+(week>10?(pct-.5)*20:0))));
 return {seed,odds};
}
export function buildAwards(lines:PlayerLine[]){
 const by=new Map<string,{name:string,pos:string,score:number,line:PlayerLine}>();
 for(const l of lines){const prev=by.get(l.playerId);by.set(l.playerId,{name:l.name,pos:l.position,score:(prev?.score||0)+l.fantasyScore,line:l})}
 const arr=[...by.values()].sort((a,b)=>b.score-a.score);
 const offense=arr.filter(x=>['QB','RB','WR','TE'].includes(x.pos));
 const defense=arr.filter(x=>['EDGE','DT','DE','NT','LB','CB','S','FS','SS'].includes(x.pos));
 return [
  {award:'TEAM MVP',winner:arr[0]?.name||'—',score:arr[0]?.score||0},
  {award:'OFFENSIVE PLAYER OF THE YEAR',winner:offense[0]?.name||'—',score:offense[0]?.score||0},
  {award:'DEFENSIVE PLAYER OF THE YEAR',winner:defense[0]?.name||'—',score:defense[0]?.score||0},
 ];
}
export function achievementsForRun(wins:number,losses:number,champ:boolean,grade:number,roster:Player[]){
 const a:string[]=[];
 if(wins>=12)a.push('DOUBLE-DIGIT DOMINANCE'); if(wins>=15)a.push('15-WIN MONSTER'); if(losses===0)a.push('PERFECT REGULAR SEASON');
 if(champ)a.push('SUPER BOWL CHAMPION'); if(champ&&losses===0)a.push('IMMORTAL SEASON'); if(grade>=95)a.push('CAP WIZARD');
 if(roster.filter(p=>p.ovr>=90).length>=5)a.push('STAR COLLECTOR'); if(roster.reduce((n,p)=>n+p.salary,0)<=DEFAULT_SALARY_CAP-10)a.push('MONEYBALL');
 return a;
}
export function defaultCareer():CareerProfile{return{runs:0,championships:0,playoffWins:0,regularWins:0,regularLosses:0,bestRecord:'0-0',bestScore:0,perfectSeasons:0,achievements:[]}}
export function updateCareer(c:CareerProfile,w:number,l:number,champ:boolean,playoffWins:number,score:number,ach:string[]):CareerProfile{
 const parse=(r:string)=>Number(r.split('-')[0]||0); const best=parse(c.bestRecord)>w?c.bestRecord:`${w}-${l}`;
 return {...c,runs:c.runs+1,championships:c.championships+(champ?1:0),playoffWins:c.playoffWins+playoffWins,regularWins:c.regularWins+w,regularLosses:c.regularLosses+l,bestRecord:best,bestScore:Math.max(c.bestScore,score),perfectSeasons:c.perfectSeasons+(l===0?1:0),achievements:[...new Set([...c.achievements,...ach])]};
}
