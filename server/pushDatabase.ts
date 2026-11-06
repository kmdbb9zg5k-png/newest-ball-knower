import {createClient} from '@supabase/supabase-js';

export type PushDatabase={auth:{getUser:(token:string)=>PromiseLike<{data:{user:{id:string;is_anonymous?:boolean}|null};error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:any;error:any}>};
export function createPushDatabase():PushDatabase|null{
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return null;
  return createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'https://gpnboygoosrmeydwjpvk.supabase.co',key,{
    auth:{persistSession:false,autoRefreshToken:false},
    // Claims and receipts own idempotency. Do not serialize distinct queue rows
    // behind a browser mutation wrapper or retry an unknown database commit here.
    global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(8000)])})},
  }) as unknown as PushDatabase;
}

export async function pushRpc(database:PushDatabase,name:string,args:Record<string,unknown>){
  const result=await database.rpc(name,args);
  if(result.error)throw result.error;
  return result.data;
}
