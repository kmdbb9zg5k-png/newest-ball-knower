/** Free schedules and periodically refreshed scores from nflverse (CC BY 4.0).
 * Source: https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv
 * Attribution required: https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md
 * This is NOT a live-play scoring feed.
 */
export const NFLVERSE_SCHEDULE_URL='https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
const TTL=300_000;
type Game={id:string;season:number;week:number;home:string;away:string;startTime:string|null;status:'scheduled'|'final'|'unknown';homeScore:number|null;awayScore:number|null};
let cache:{until:number;items:Game[];updatedAt:string}|null=null;
let pending:Promise<{until:number;items:Game[];updatedAt:string}>|null=null;
function parseCSV(raw:string):Record<string,string>[]{
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
  for(let i=0;i<raw.length;i++){const c=raw[i];
    if(c==='"'){if(quoted&&raw[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&raw[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const headers=rows.shift()??[];
  return rows.map(values=>Object.fromEntries(headers.map((key,i)=>[key,values[i]??''])));
}
const score=(v:string)=>v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
export function normalizeNflverseSchedule(csv:string,season=2026):Game[]{
  return parseCSV(csv).flatMap(r=>{
    if(Number(r.season)!==season||!r.game_id||!r.home_team||!r.away_team)return[];
    const homeScore=score(r.home_score??''),awayScore=score(r.away_score??'');
    const date=r.gameday||'',time=r.gametime||'';
    const startTime=/^\d{4}-\d{2}-\d{2}$/.test(date)?date+( /^\d{2}:\d{2}$/.test(time)?'T'+time+':00':''):null;
    return [{id:r.game_id,season,week:Number(r.week)||0,home:r.home_team,away:r.away_team,startTime,status:homeScore!==null&&awayScore!==null?'final' as const:'scheduled' as const,homeScore,awayScore}];
  }).sort((a,b)=>a.week-b.week||a.id.localeCompare(b.id));
}
export async function getNflverseGames(fetchImpl:typeof fetch=fetch,now:()=>number=Date.now){
  if(cache&&cache.until>now())return cache;
  if(pending)return pending;
  pending=(async()=>{
    const response=await fetchImpl(NFLVERSE_SCHEDULE_URL,{signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:'text/csv'}});
    if(!response.ok)throw new Error('nflverse_unavailable');
    const data=await response.text();
    if(data.length>4_000_000)throw new Error('nflverse_response_too_large');
    const items=normalizeNflverseSchedule(data);
    if(items.length<200)throw new Error('nflverse_incomplete_schedule');
    cache={until:now()+TTL,items,updatedAt:new Date(now()).toISOString()};return cache;
  })();
  try{return await pending}finally{pending=null;}
}
export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
  if(req.method&&req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
  try{
    const data=await getNflverseGames();
    return res.status(200).json({available:true,kind:'games',provider:'nflverse',license:'CC BY 4.0',attribution:'https://github.com/nflverse/nflverse-data',updatedAt:data.updatedAt,live:false,items:data.items});
  }catch{
    return res.status(503).json({available:false,kind:'games',items:[],error:'schedule_unavailable'});
  }
}
