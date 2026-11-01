/** Delimited nflverse release reader, server-only. */
export function csvRecords(raw:string):Record<string,string>[]{
 const records:string[][]=[];let row:string[]=[],field='',inside=false;
 for(let i=0;i<raw.length;i++){const c=raw[i];
  if(c==='"'){if(inside&&raw[i+1]==='"'){field+='"';i++}else inside=!inside}
  else if(c===','&&!inside){row.push(field);field=''}
  else if((c==='\n'||c==='\r')&&!inside){if(c==='\r'&&raw[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))records.push(row);row=[];field=''}
  else field+=c
 }
 if(field||row.length){row.push(field);records.push(row)}
 const header=records.shift()??[];return records.map(values=>Object.fromEntries(header.map((key,i)=>[key.replace(/^\uFEFF/,'').trim(),values[i]??''])))
}
const snapshots=new Map<string,{until:number;items:unknown[];updatedAt:string}>();
const pending=new Map<string,Promise<{until:number;items:unknown[];updatedAt:string}>>();
export async function nflverseCsv<T>(url:string,parse:(rows:Record<string,string>[])=>T[],maxAge=86_400_000,fetchImpl:typeof fetch=fetch,now:()=>number=Date.now){
 const cached=snapshots.get(url);if(cached&&cached.until>now())return cached as {until:number;items:T[];updatedAt:string};
 const existing=pending.get(url);if(existing)return existing as Promise<{until:number;items:T[];updatedAt:string}>;
 const work=(async()=>{
  const response=await fetchImpl(url,{headers:{Accept:'text/csv'},signal:AbortSignal.timeout(12000),redirect:'follow'});
  if(!response.ok)throw new Error('source_unavailable');
  const body=await response.text();if(body.length>8_000_000)throw new Error('source_too_large');
  const items=parse(csvRecords(body));if(!items.length)throw new Error('empty_source');
  const result={until:now()+maxAge,items,updatedAt:new Date(now()).toISOString()};snapshots.set(url,result);return result;
 })();
 pending.set(url,work);try{return await work}finally{pending.delete(url)}
}
export const attribution={provider:'nflverse',attribution:'https://github.com/nflverse/nflverse-data',license:'CC BY 4.0',live:false};
export function readOnly(req:any,res:any){res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');if(req.method&&req.method!=='GET'){res.setHeader('Allow','GET');res.status(405).json({error:'method_not_allowed'});return false;}return true}
