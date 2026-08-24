export default function handler(req:any,res:any){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    ok:true,
    service:'ball-knower',
    release:'public-beta',
    checkedAt:new Date().toISOString(),
    integrations:{
      database:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY),
      nflData:Boolean(process.env.RAPIDAPI_KEY),
      issueEmail:Boolean(process.env.RESEND_API_KEY&&process.env.ERROR_REPORT_FROM_EMAIL),
    },
  });
}
