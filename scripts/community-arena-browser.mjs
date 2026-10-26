import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

// Exercise the built application without a session. All backend traffic is isolated.
const base=process.env.BK_BROWSER_URL||'http://127.0.0.1:4173';
const server=process.env.BK_BROWSER_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
const userId='00000000-0000-4000-8000-000000000901';
const preview={leaderboard:[{user_id:userId,display_name:'Guest Browse Manager',bk_rating:82,level:4,h2h_rating:1048,h2h_wins:4,h2h_losses:1,h2h_ties:0,rank:1}],friends:[],matches:[],messages:[{id:'00000000-0000-4000-8000-000000000902',author_id:userId,display_name:'Guest Browse Manager',body:'Public football conversation for visitors.',created_at:new Date().toISOString()}]};
const privateCommunity=new Set(['get_ball_knower_community_home','get_ball_knower_global_messages','get_ball_knower_direct_messages','search_ball_knower_community_users','post_ball_knower_global_message','send_ball_knower_direct_message','send_ball_knower_friend_request','start_ball_knower_h2h']);
let browser;
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert.ok(ready,'Preview server must be ready');
  await mkdir('artifacts/community-guest',{recursive:true});
  browser=await chromium.launch({headless:true});
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768});
    const calls=[];const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*.supabase.co/**',route=>{
      const path=new URL(route.request().url()).pathname;const rpc=path.split('/rpc/')[1];if(rpc)calls.push(rpc);
      return route.fulfill({status:rpc==='get_ball_knower_community_preview'?200:403,contentType:'application/json',body:JSON.stringify(rpc==='get_ball_knower_community_preview'?preview:{message:'No session in guest regression'})});
    });
    await context.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:[],introUrl:null,available:false,games:[],articles:[]})}));
    await context.route('**/_vercel/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.addInitScript(()=>{localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-sound-v1','off');});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('.bk-home-stadium').waitFor();
    for(const button of await page.getByRole('button',{name:'Community',exact:true}).all()){if(await button.isVisible()){await button.click();break;}}
    const arena=page.locator('.bk-screen[data-page="arena"]');await arena.waitFor();
    await arena.getByText('Browsing as a guest',{exact:true}).waitFor();
    await arena.getByRole('heading',{name:'YOUR PEOPLE. YOUR PROVING GROUND.'}).waitFor();
    assert.equal(await page.getByRole('dialog').count(),0,'Browsing must not open login');
    await arena.getByRole('button',{name:'Rankings',exact:true}).click();
    await arena.getByRole('heading',{name:'Worldwide BK Rating',exact:true}).waitFor();
    await arena.getByRole('button',{name:'Guest Browse Manager H2H 4-1 · 1048 RTG',exact:true}).click();
    await page.getByRole('dialog',{name:'Community manager'}).waitFor();
    await page.getByRole('button',{name:'Close manager',exact:true}).click();
    await arena.getByRole('button',{name:'Global chat',exact:true}).click();
    await arena.getByText(preview.messages[0].body,{exact:true}).waitFor();
    assert.equal(await arena.getByRole('textbox',{name:'Global message',exact:true}).count(),0,'Guests must have a read-only chat');
    assert.equal(await page.getByRole('dialog').count(),0,'Reading chat must not open login');
    await page.screenshot({path:`artifacts/community-guest/chat-${width}.png`});
    await arena.getByRole('button',{name:'Sign in to post',exact:true}).click();
    await page.locator('.bk-auth-console').waitFor();
    await page.getByRole('button',{name:'Close sign in',exact:true}).click();
    await arena.getByRole('button',{name:'H2H',exact:true}).click();
    await arena.getByRole('button',{name:'Quick match',exact:true}).click();
    await page.locator('.bk-auth-console').waitFor();
    await page.getByRole('button',{name:'Close sign in',exact:true}).click();
    await arena.getByRole('button',{name:'Friends',exact:true}).click();
    await arena.getByRole('heading',{name:'Build your football circle',exact:true}).waitFor();
    await arena.getByRole('button',{name:'Messages',exact:true}).click();
    await arena.getByRole('heading',{name:'Private conversations',exact:true}).waitFor();
    assert.deepEqual(calls.filter(name=>privateCommunity.has(name)),[],'Guest browsing/actions must never call private Community RPCs');
    assert.ok(calls.includes('get_ball_knower_community_preview'),'Guest view must fetch actual public data');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=1,`Guest Community overflows by ${overflow}px at ${width}`);
    assert.deepEqual(errors,[]);await context.close();console.log(`Community guest browse and action gating passed at ${width}px`);
  }
}finally{await browser?.close();server?.kill('SIGTERM');}
