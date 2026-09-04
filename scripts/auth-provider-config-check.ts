import { BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY, BALL_KNOWER_SUPABASE_URL } from '../supabaseDefaults';

const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),8_000);
try{
  const response=await fetch(`${BALL_KNOWER_SUPABASE_URL}/auth/v1/settings`,{
    headers:{apikey:BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY},
    signal:controller.signal,
  });
  if(!response.ok)throw new Error(`Supabase auth settings returned ${response.status}`);
  const settings=await response.json() as {external?:{google?:boolean;apple?:boolean}};
  const missing:string[]=[];
  if(settings.external?.apple!==true)missing.push('Apple');
  if(settings.external?.google!==true)missing.push('Google');
  if(missing.length){
    console.error(`Build 7 external auth configuration is incomplete: ${missing.join(' and ')} provider${missing.length>1?'s are':' is'} disabled in Supabase.`);
    console.error('Owner action: enable each provider in Supabase Auth Providers with its valid provider client ID/secret, then keep ballknower://auth/callback in the allowed redirect URLs.');
    process.exit(1);
  }
  console.log('Supabase reports Apple and Google social providers enabled.');
}catch(error){
  console.error('Could not verify live Supabase social provider configuration.');
  console.error(error instanceof Error?error.message:String(error));
  process.exit(1);
}finally{
  clearTimeout(timeout);
}
