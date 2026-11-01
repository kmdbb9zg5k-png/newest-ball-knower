import {nflverseCsv,attribution,readOnly} from '../lib/nflverse-csv';
const URL='https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv';
export function normalizeRosters(rows:Record<string,string>[]){return rows.flatMap(r=>{
 const id=String(r.gsis_id||r.player_id||'').trim(),name=String(r.full_name||r.player_name||'').trim();
 if(!id||!name)return[];
 return [{id,name,team:String(r.team||'').trim()||null,position:String(r.position||'').trim()||null,jerseyNumber:String(r.jersey_number||'').trim()||null}];
})}
export default async function handler(req:any,res:any){
 if(!readOnly(req,res))return;
 try{const data=await nflverseCsv(URL,normalizeRosters);return res.status(200).json({available:true,kind:'players',...attribution,updatedAt:data.updatedAt,items:data.items})}
 catch{return res.status(503).json({available:false,kind:'players',items:[],error:'roster_unavailable'})}
}
