// Kept local so this serverless function does not depend on a module outside
// api/, which the production function packager has failed to include.
const BALL_KNOWER_SUPABASE_URL='https://gpnboygoosrmeydwjpvk.supabase.co';
const BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY='sb_publishable_tgnOH0RUtswLI58isL5Qfw_Pq3xaV9h';

export default function handler(req:any,res:any){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||BALL_KNOWER_SUPABASE_URL;
  const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY||BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY;

  return res.status(200).json({
    ok:true,
    service:'ball-knower',
    release:'public-beta',
    checkedAt:new Date().toISOString(),
    integrations:{
      // The browser app intentionally ships a publishable Supabase credential as
      // a safe fallback, with RLS providing the authorization boundary.
      database:Boolean(supabaseUrl&&supabaseKey),
      // Picks now uses the verified public nfldata.org feed and no longer depends
      // on the old RapidAPI/Tank01 environment variable.
      nflData:true,
      issueEmail:Boolean(process.env.RESEND_API_KEY&&process.env.ERROR_REPORT_FROM_EMAIL),
    },
  });
}
