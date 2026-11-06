import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

// Exercise the built application without a session. All backend traffic is isolated.
const base=process.env.BK_BROWSER_URL||'http://127.0.0.1:4173';
const server=process.env.BK_BROWSER_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
const userId='00000000-0000-4000-8000-000000000901';
const preview={leaderboard:[{user_id:userId,display_name:'Guest Browse Manager',bk_rating:82,level:4,h2h_rating:1048,h2h_wins:4,h2h_losses:1,h2h_ties:0,rank:1}],friends:[],matches:[],messages:[{id:'00000000-0000-4000-8000-000000000902',author_id:userId,display_name:'Guest Browse Manager',body:'Public football conversation for visitors.',created_at:new Date().toISOString()}]};
const privateCommunity=new Set(['ball_knower_football_arena','ball_knower_mini_challenges','get_ball_knower_community_home','get_ball_knower_global_messages','get_ball_knower_direct_messages','search_ball_knower_community_users','post_ball_knower_global_message','send_ball_knower_direct_message','send_ball_knower_friend_request','start_ball_knower_h2h']);
let browser;
async function checkSectionArt(page,container,label,width,minimumPhotos=1){
  await container.waitFor({state:'visible'});
  const photos=container.locator('img[src*="/community/"],img[src*="/profile/cinematic/"]');
  assert.ok(await photos.count()>=minimumPhotos,`${label} must include artwork for each featured card`);
  for(const photo of await photos.all()){
    await photo.scrollIntoViewIfNeeded();
    await photo.evaluate(image=>image.decode());
    assert.ok(await photo.evaluate(image=>image.complete&&image.naturalWidth>0),`${label} artwork must load at ${width}px`);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=1,`${label} overflows by ${overflow}px at ${width}px`);
  await page.screenshot({path:`artifacts/community-guest/${label}-${width}.png`});
}
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert.ok(ready,'Preview server must be ready');
  await mkdir('artifacts/community-guest',{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  for(const width of [320,390,430,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768});
    let currentPreview=structuredClone(preview);
    const calls=[];const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*.supabase.co/**',route=>{
      const path=new URL(route.request().url()).pathname;const rpc=path.split('/rpc/')[1];if(rpc)calls.push(rpc);
      return route.fulfill({status:rpc==='get_ball_knower_community_preview'?200:403,contentType:'application/json',body:JSON.stringify(rpc==='get_ball_knower_community_preview'?currentPreview:{message:'No session in guest regression'})});
    });
    await context.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:[],introUrl:null,available:false,games:[],articles:[]})}));
    await context.route('**/_vercel/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.addInitScript(()=>{localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-sound-v1','off');});
    await page.addInitScript(()=>{
      window.__communityShared=[];
      Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__communityShared.push(data);}});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('.bk-home-stadium').waitFor();
    for(const button of await page.getByRole('button',{name:'Community',exact:true}).all()){if(await button.isVisible()){await button.click();break;}}
    const arena=page.locator('.bk-screen[data-page="arena"]');await arena.waitFor();
    await arena.getByText('Browsing as a guest',{exact:true}).waitFor();
    await arena.getByRole('heading',{name:'YOUR PEOPLE. YOUR PROVING GROUND.'}).waitFor();
    assert.equal(await page.getByRole('dialog').count(),0,'Browsing must not open login');
    await arena.locator('.arena-feature-grid').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelectorAll('.arena-feature img')].every(image=>image.complete&&image.naturalWidth>0));
    assert.equal(await arena.locator('.arena-leader-name').innerText(),preview.leaderboard[0].display_name,'Rank preview must use the actual service response');
    assert.ok(await arena.getByRole('button',{name:'View leaderboard',exact:true}).isVisible());
    const featureOverflow=await arena.locator('.arena-feature-grid').evaluate(element=>element.scrollWidth-element.clientWidth);
    assert.ok(featureOverflow<=1,`Community cards overflow by ${featureOverflow}px at ${width}`);
    await page.screenshot({path:`artifacts/community-guest/cards-${width}.png`});
    await arena.getByRole('button',{name:'View leaderboard',exact:true}).click();
    await arena.getByRole('heading',{name:'Worldwide BK Rating',exact:true}).waitFor();
    await checkSectionArt(page,arena.locator('.arena-rankings-page'),'rankings',width);
    await arena.getByRole('button',{name:'Arena',exact:true}).click();
    await arena.getByRole('button',{name:'Find Ball Knowers',exact:true}).click();
    await arena.getByRole('heading',{name:'Build your football circle',exact:true}).waitFor();
    assert.equal(await page.getByRole('dialog').count(),0,'Friend discovery must preserve the guest participation screen');
    await arena.getByRole('button',{name:'Arena',exact:true}).click();
    await arena.getByRole('button',{name:'Invite friends',exact:true}).click();
    await page.waitForFunction(()=>window.__communityShared.length===1);
    assert.equal(await page.evaluate(()=>window.__communityShared[0].url),'https://ballknowerofficial.com/','Invites must share the public app, never a preview/session URL');
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError');}}));
    await arena.getByRole('button',{name:'Invite friends',exact:true}).click();
    assert.equal(await arena.locator('#arena-invite-link').count(),0,'Cancelling the share sheet must remain quiet');
    await page.evaluate(()=>{
      Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__communityCopied=value;}}});
    });
    await arena.getByRole('button',{name:'Invite friends',exact:true}).click();
    await page.waitForFunction(()=>window.__communityCopied==='https://ballknowerofficial.com/');
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard denied');}}}));
    await arena.getByRole('button',{name:'Invite friends',exact:true}).click();
    await arena.getByRole('textbox',{name:'Copy this link to invite your friends',exact:true}).waitFor();
    assert.equal(await arena.locator('#arena-invite-link').inputValue(),'https://ballknowerofficial.com/','Unavailable sharing must leave a copyable link');
    currentPreview={...preview,leaderboard:[]};
    await arena.getByRole('button',{name:'Refresh Community',exact:true}).click();
    await arena.getByText('No rankings yet. Start building your legacy.',{exact:true}).waitFor();
    assert.equal(await arena.locator('.arena-feature-leader').count(),0,'Empty rankings must not fabricate a leader');
    currentPreview=structuredClone(preview);currentPreview.leaderboard[0].display_name='A very long football manager name that must remain inside the rankings card';currentPreview.leaderboard[0].bk_rating=0;
    await arena.getByRole('button',{name:'Refresh Community',exact:true}).click();
    await arena.getByText(currentPreview.leaderboard[0].display_name,{exact:true}).waitFor();
    assert.equal(await arena.locator('.arena-feature-leader>strong').innerText(),'0BK','A real zero rating must remain zero');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'Long manager names must not widen the viewport');
    currentPreview=structuredClone(preview);
    await arena.getByRole('button',{name:'Refresh Community',exact:true}).click();
    await arena.getByText(preview.leaderboard[0].display_name,{exact:true}).waitFor();
    await arena.getByRole('button',{name:'Mini games',exact:true}).click();
    await arena.getByRole('heading',{name:'Pick your challenge',exact:true}).waitFor();
    await checkSectionArt(page,arena.locator('.bk-mini-arena-hero'),'mini-games',width);
    await checkSectionArt(page,arena.getByRole('region',{name:'More ways to play',exact:true}),'mini-world',width,2);
    assert.equal(await page.getByRole('dialog').count(),0,'Browsing mini games must not open login');
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
    await arena.getByRole('button',{name:'Football H2H',exact:true}).click();
    await arena.getByRole('heading',{name:/YOUR OFFENSE/}).waitFor();
    await checkSectionArt(page,arena.locator('.football-arena'),'football-h2h',width,3);
    await arena.getByRole('button',{name:'Pick your team',exact:true}).click();
    const selection=page.getByRole('dialog');
    await selection.getByRole('heading',{name:'Pick your team.'}).waitFor();
    assert.equal(await selection.locator('.bk-h2h-select-stars article').count(),3,'Team selection shows the top three players');
    assert.equal(await page.locator('.bk-auth-console').count(),0,'Guest football opens team selection without authentication');
    await selection.getByRole('button',{name:'‹ Back',exact:true}).click();
    assert.equal(await page.getByRole('dialog').count(),0,'Leaving selection returns to Community');
    assert.deepEqual(calls.filter(name=>privateCommunity.has(name)),[],'Guest football must not call private Community RPCs');
    await arena.getByRole('button',{name:'Keep records',exact:true}).click();
    await page.locator('.bk-auth-console').waitFor();
    await page.getByRole('button',{name:'Close sign in',exact:true}).click();
    await arena.getByRole('button',{name:'Trivia H2H',exact:true}).click();
    await checkSectionArt(page,arena.locator('.arena-trivia-lobby'),'trivia-h2h',width,2);
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
