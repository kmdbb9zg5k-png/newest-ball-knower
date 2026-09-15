import vm from 'node:vm';

export default async function handler(req:any,res:any){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');
  try{
    const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
    const host=String(req.headers.host||'');
    if(!host)throw new Error('Missing host');
    const origin=`${proto}://${host}`;
    const [gameRes,bridgeRes,htmlRes,cssRes]=await Promise.all([
      fetch(`${origin}/franchise-play-moment-v3.js`,{cache:'no-store'}),
      fetch(`${origin}/franchise-play-moment-bridge.js`,{cache:'no-store'}),
      fetch(`${origin}/franchise-play-moment-v3.html`,{cache:'no-store'}),
      fetch(`${origin}/franchise-play-moment-v3.css`,{cache:'no-store'}),
    ]);
    if(!gameRes.ok||!bridgeRes.ok||!htmlRes.ok||!cssRes.ok)throw new Error(`Static asset fetch failed: ${gameRes.status}/${bridgeRes.status}/${htmlRes.status}/${cssRes.status}`);
    const [game,bridge,html,css]=await Promise.all([gameRes.text(),bridgeRes.text(),htmlRes.text(),cssRes.text()]);
    new vm.Script(game,{filename:'franchise-play-moment-v3.js'});
    new vm.Script(bridge,{filename:'franchise-play-moment-bridge.js'});
    const requiredIds=['manualBtn','assistBtn','passMode','runMode','joystick','joyKnob','snapBtn','playbook','field','result'];
    const missingIds=requiredIds.filter(id=>!html.includes(`id="${id}"`));
    const requiredTokens=['HB STRETCH','INSIDE ZONE','COUNTER','HB TOSS','rushers','joystick','sprinting','triggerSkill'];
    const missingTokens=requiredTokens.filter(token=>!game.includes(token));
    const bridgeTokens=['franchise-play-moment-v3.html','result?.rushers','rushYds','rushTD'];
    const missingBridge=bridgeTokens.filter(token=>!bridge.includes(token));
    return res.status(missingIds.length||missingTokens.length||missingBridge.length?500:200).json({ok:!missingIds.length&&!missingTokens.length&&!missingBridge.length,bytes:{game:game.length,bridge:bridge.length,html:html.length,css:css.length},missingIds,missingTokens,missingBridge});
  }catch(error:any){
    return res.status(500).json({ok:false,error:String(error?.stack||error?.message||error)});
  }
}
