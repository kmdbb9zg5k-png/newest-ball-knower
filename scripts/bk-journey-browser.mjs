import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4189';
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4189','--strictPort'],{stdio:'inherit'});
const userId = '481933bb-1f73-4475-aabb-cdb9e3a77a91';
const user = { id:userId,aud:'authenticated',role:'authenticated',email:null,phone:'',is_anonymous:true,app_metadata:{provider:'anonymous',providers:['anonymous']},user_metadata:{},created_at:'2026-11-10T00:00:00.000Z',updated_at:'2026-11-10T00:00:00.000Z' };
const tokenPart = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = tokenPart({alg:'HS256',typ:'JWT'}) + '.' + tokenPart({sub:userId,role:'authenticated',aud:'authenticated',exp:2070000000,iat:1794355200}) + '.mock';
const session = {access_token:token,token_type:'bearer',expires_in:3600,expires_at:2070000000,refresh_token:'test-anon-refresh',user};
let browser;
try {
  let ready=false;
  for(let i=0;i<100;i++){
    try {ready=(await fetch(origin)).ok;}catch{}
    if(ready) break;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  assert.ok(ready,'Vite preview must start before browser checks');
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH || undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,deviceScaleFactor:1});
    page.setDefaultTimeout(30000);
    let claimCalls=0;
    let coins=50;
    let claims=[{checkpoint:1,coins:50,gift:null,claimedAt:'2026-11-10T00:00:00Z'}];
    await page.route('**/*.supabase.co/**',async route=>{
      const url=new URL(route.request().url());
      const path=url.pathname;
      if(path.includes('/auth/v1/signup') || path.includes('/auth/v1/token')) return route.fulfill({status:200,json:{...session,user}});
      if(path.includes('/auth/v1/user')) return route.fulfill({status:200,json:user});
      if(path.endsWith('/rest/v1/rpc/bk_journey_state')) return route.fulfill({status:200,json:{xp:133,level:2,coins,claims,today:{trivia:2,prediction:0,h2h:0},todayDate:'2026-11-10',source:'verified'}});
      if(path.endsWith('/rest/v1/rpc/bk_journey_claim')){
        const args=JSON.parse(route.request().postData()||'{}');
        assert.equal(args.p_checkpoint,2,'Only the 100 XP milestone should be claimable in this fixture');
        claimCalls++;
        if(!claims.some(c=>c.checkpoint===2)){coins+=100;claims=[...claims,{checkpoint:2,coins:100,gift:null,claimedAt:'2026-11-10T00:10:00Z'}];}
        return route.fulfill({status:200,json:{claimed:claimCalls===1,alreadyOwned:claimCalls>1,checkpoint:2,coinsAwarded:claimCalls===1?100:0,gift:null}});
      }
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    });
    await page.addInitScript(()=>{
      localStorage.setItem('ball-knower-team-setup-v2','complete');
      localStorage.setItem('ball-knower-intro-completed-v1','2');
    });
    await page.goto(origin);
    const home=page.getByRole('region',{name:'Store',exact:true});
    const card=page.getByRole('button',{name:'Open Daily Challenges and BK Journey rewards'});
    await card.waitFor();
    assert.ok(await card.evaluate(button=>Boolean(button.closest('.bk-home-dashboard'))),'Daily Challenges lives on Home');
    const order=await page.evaluate(()=>{
      const mini=document.querySelector('.bk-home-mini-games');
      const journey=document.querySelector('.bk-journey-card');
      return !!mini&&!!journey&&!!(mini.compareDocumentPosition(journey)&Node.DOCUMENT_POSITION_FOLLOWING);
    });
    assert.ok(order,'Daily Challenges must follow the Mini Games feature');
    await card.click();
    const dialog=page.getByRole('dialog',{name:'BK Daily Challenges and Journey'});
    await dialog.waitFor();
    await dialog.getByRole('heading',{name:'DAILY CHALLENGES'}).waitFor();
    const screen=dialog.locator('[data-bk-journey]');
    await screen.getByText('133 XP').waitFor();
    await screen.getByText('50',{exact:true}).first().waitFor();
    assert.equal(await screen.locator('.bk-journey-mission').count(),3);
    assert.equal(await screen.getByText('1 / 3', {exact:true}).count(),1,'Only the verified trivia activity is completed');
    await screen.getByRole('button',{name:'BK Journey'}).click();
    assert.equal(await screen.locator('.bk-journey-checkpoint').count(),5);
    const claim=screen.getByRole('button',{name:'Claim reward'});
    assert.equal(await claim.count(),1,'The 100 XP checkpoint is eligible for a single claim');
    await claim.click();
    await screen.getByText('150',{exact:true}).first().waitFor();
    assert.equal(claimCalls,1,'One server-side reward claim per tap');
    await screen.getByRole('button',{name:'My Rewards'}).click();
    await screen.getByText('2 / 5 milestones').waitFor();
    await screen.getByText('Golden BK Nameplate').waitFor();
    assert.ok(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+2),'Dialog does not overflow horizontally');
    await dialog.getByRole('button',{name:'Close BK Journey'}).click();
    await dialog.waitFor({state:'hidden'});
    console.log('PASS BK Journey at '+width+'px: Home placement, authenticated dashboard, claim, balance, rewards, mobile overflow');
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
