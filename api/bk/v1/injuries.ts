import {nflverseCsv,attribution,readOnly} from '../lib/nflverse-csv';
const URL='https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_2026.csv';
export function normalizeInjuries(rows:Record<string,string>[]){return rows.flatMap(r=>{
 const id=String(r.gsis_id||'').trim(),name=String(r.full_name||'').trim();
 const status=String(r.report_status||r.practice_status||'').trim();
 if(!id||!status)return[];
 return [{id,player:name||null,team:String(r.team||'').trim()||null,week:Number(r.week)||null,status,detail:String(r.report_primary_injury||r.practice_primary_injury||'').trim()||null,updatedAt:String(r.date_modified||'').trim()||null}];
})}
export default async function handler(req:any,res:any){
 if(!readOnly(req,res))return;
 try{const data=await nflverseCsv(URL,normalizeInjuries);return res.status(200).json({available:true,kind:'injuries',...attribution,updatedAt:data.updatedAt,items:data.items})}
 catch{return res.status(503).json({available:false,kind:'injuries',items:[],error:'injury_feed_unavailable'})}
}
