import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const live=process.argv.includes('--live'),out='artifacts/all-screens',base='http://127.0.0.1:4180';
let news={available:true,provider:'Tank01',fetchedAt:new Date().toISOString(),articles:[{id:'https://publisher.example/story1',url:'https://publisher.example/story1',headline:'Example NFL headline for regression testing',source:'Test publisher',published:null,image:null,description:''},{id:'https://publisher.example/story2',url:'https://publisher.example/story2',headline:'Second example tests shared headline rotation',source:'Test publisher',published:null,image:null,description:''}]};
let picks={available:false,games:[]};
if(live){const r=await fetch('https://ballknowerofficial.com/api/nfl-news',{signal:AbortSignal.timeout(12000)});assert.equal(r.status,200);news=await r.json();assert.equal(news.available,true);assert.ok(news.articles.length>1);try{const p=await fetch('https://ballknowerofficial.com/api/nfl-sportsbook',{signal:AbortSignal.timeout(12000)});if(p.ok)picks=await p.json()}catch{}}
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4180','--strictPort'],{stdio:'inherit'});
let browser;const results=[];
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}assert.ok(ready);
 await mkdir(out,{recursive:true});browser=await chromium.launch({headless:true});
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:width===1280?900:844},deviceScaleFactor:2,isMobile:width<768,hasTouch:width<768,...(live&&width===390?{recordVideo:{dir:`${out}/video`,size:{width,height:844}}}:{})});
  const page=await context.newPage();const crashes=[];let calls=0;
  page.on('pageerror',e=>crashes.push(e.message));
  await page.route('**/*.supabase.co/**',r=>r.fulfill({status:403,contentType:'application/json',body:'{"message":"Isolated visual test; account access disabled"}'}));
  await page.route('**/_vercel/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;if(path==='/api/nfl-news')calls++;const data=path==='/api/nfl-news'?news:path==='/api/nfl-sportsbook'?picks:path==='/api/media'?{tracks:[],introUrl:null}:{ok:true};return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})});
  await page.addInitScript(()=>{
   localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');
   // Existing first-visit guides have separate coverage; don't cover screenshot content.
   for(const key of ['bk-guide-fantasy-hq-v3','bk-guide-picks-v3','bk-guide-the-gauntlet-v4','bk-guide-franchise-command-v1'])localStorage.setItem(key,'seen');
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.bk-home-stadium').waitFor();
  const home=async()=>{await page.getByRole('button',{name:'Ball Knower home',exact:true}).click();await page.locator('.bk-home-stadium').waitFor()};
  const primary=async name=>{const buttons=page.getByRole('button',{name,exact:true});for(const button of await buttons.all()){if(await button.isVisible()){await button.click();return}}throw Error('Missing visible navigation '+name)};
  const capture=async(name,scene,label=name)=>{
   const stage=page.locator(`.bk-screen[data-page="${name}"]`).first();await stage.waitFor();
   assert.equal(await stage.getAttribute('data-scene'),scene);
   assert.equal(await stage.locator('.bk-scene-motion').count(),0,`${name} must not render a motion button`);
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
   const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,headerBottom:document.querySelector('body>header')?.getBoundingClientRect().bottom??0,stageTop:document.querySelector('.bk-screen')?.getBoundingClientRect().top}));
   assert.ok(geometry.scroll<=width+1,`${name} overflow at ${width}: ${geometry.scroll}`);
   assert.ok(geometry.stageTop>=geometry.headerBottom-1,`${name} covered by fixed header`);
   if(width<768)assert.equal(await page.getByRole('navigation',{name:'Primary navigation'}).locator('button').count(),6);
   console.log('Captured',name,width);
   await page.screenshot({path:`${out}/${label}-${width}.png`,fullPage:false});results.push({screen:label,scene,width,...geometry});
  };
  await primary('Fantasy');await capture('fantasy','tunnel');
  await page.getByRole('button',{name:'Cheat Sheet',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.bk-home-news-strip'));
  assert.equal(await page.locator('.bk-screen[data-page="fantasy"]').getAttribute('data-motion'),'off');
  await page.getByRole('button',{name:'League HQ',exact:true}).click();await page.getByRole('region',{name:'NFL headlines'}).waitFor();
  await page.getByRole('button',{name:'Open NFL News',exact:true}).click();await capture('news','studio');
  assert.equal(await page.locator('.bk-news-story').count(),news.articles.length);assert.equal(await page.locator('.bk-news-story img').count(),0);
  if(width<768&&news.articles.length>10){
   await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
   const backdrop=await page.locator('.bk-scene-backdrop').boundingBox();
   if(backdrop&&backdrop.y+backdrop.height<=0)await page.waitForFunction(()=>document.querySelector('.bk-screen[data-page="news"]')?.getAttribute('data-motion')==='off');
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.waitForFunction(()=>document.querySelector('.bk-screen[data-page="news"]')?.getAttribute('data-motion')==='on');
  }

  await primary('Picks');await capture('picks','studio');
  await primary('Trivia');await capture('trivia','studio');
  await page.getByTestId('gauntlet-mode-grid').getByRole('button',{name:/Classic Trivia/i}).click();
  const difficulty=page.getByRole('dialog',{name:'TRIVIA difficulty',exact:true});
  await difficulty.waitFor();
  assert.equal(await difficulty.locator('.bk-gauntlet-tier-card').count(),4,'Trivia must retain all four difficulty levels');
  assert.equal(await page.locator('.bk-screen[data-page="trivia"]').getAttribute('data-motion'),'off');
  assert.equal(await page.locator('.bk-home-news-strip').count(),0);
  await difficulty.getByRole('button',{name:/ROOKIE/}).click();
  await page.getByRole('dialog',{name:'ROOKIE Trivia',exact:true}).waitFor();
  assert.equal(await page.locator('.bk-screen[data-page="trivia"]').getAttribute('data-motion'),'off');assert.equal(await page.locator('.bk-home-news-strip').count(),0);
  await page.getByRole('button',{name:'Exit',exact:true}).click();await page.getByRole('region',{name:'NFL headlines'}).waitFor();
  await primary('Ask BK');await page.getByRole('heading',{name:'Ask BK',exact:true}).waitFor();
  const askGeometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,headerBottom:document.querySelector('body>header')?.getBoundingClientRect().bottom??0,stageTop:document.querySelector('main section')?.getBoundingClientRect().top??0}));
  assert.ok(askGeometry.scroll<=width+1,`Ask BK overflow at ${width}: ${askGeometry.scroll}`);
  assert.ok(askGeometry.stageTop>=askGeometry.headerBottom-1,'Ask BK covered by fixed header');
  assert.equal(await page.getByText('Session only.',{exact:false}).count(),1,'Ask BK must show session-only privacy disclosure');
  await page.screenshot({path:`${out}/ask-${width}.png`,fullPage:false});results.push({screen:'ask',scene:'trophy',width,...askGeometry});
  await primary('Profile');await capture('profile','locker');
  await home();await page.getByRole('button',{name:'Solo Mode',exact:true}).click();await capture('solo','field');
  await page.locator('.bk-mode-card').filter({hasText:'Agent Mode'}).click();await capture('agent','office');
  await page.getByRole('button',{name:'BACK',exact:true}).click();await page.locator('.bk-mode-card').filter({hasText:'Owner Office'}).click();await capture('owner','suite');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.bk-screen')?.getAttribute('data-motion')==='off');
  assert.equal(await page.locator('.bk-scene-beam-left').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('button',{name:'BACK',exact:true}).click();await page.locator('.bk-mode-card').filter({hasText:'FRANCHISE COMMAND'}).click();await capture('franchise','suite');
  await page.getByRole('button',{name:'Back to Solo Franchise Hub',exact:true}).click();await page.locator('.bk-mode-card').filter({hasText:'MY PLAYER'}).click();await capture('my-player','locker');
  await home();
  // Reach secondary pages through the existing product controls; no test-only routes.
  await page.getByRole('button',{name:'Open league activity',exact:true}).click();
  await capture('league','tunnel');assert.equal(await page.locator('.bk-home-news-strip').count(),0);
  await home();
  const avatar=page.locator('body>header button').filter({has:page.locator('img[alt="Ball Knower Guest"]')});
  await avatar.click();await page.getByRole('button',{name:'Hall of Fame',exact:true}).click();await capture('legacy','legacy');
  await home();await page.getByRole('button',{name:'View All Partners',exact:true}).click();await capture('partners','studio');
  await home();await page.getByRole('button',{name:'Solo Mode',exact:true}).click();
  await page.locator('.bk-mode-card').filter({hasText:'FANTASY DRAFT'}).click();await capture('fantasy-franchise','tunnel');assert.equal(await page.locator('.bk-home-news-strip').count(),0);
  await page.getByRole('button',{name:'Back to Solo Franchise Hub',exact:true}).click();await page.locator('.bk-mode-card').filter({hasText:'CAP CHALLENGE'}).click();await capture('cap','tunnel');assert.equal(await page.locator('.bk-home-news-strip').count(),0);
  assert.deepEqual(crashes,[]);await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify({checkedAt:new Date().toISOString(),source:live?'Captured public provider responses; no protected accounts':'Explicit synthetic news fixture',screens:results,physicalIphoneTest:false,productionMutations:false},null,2));
 console.log('All-screen actual browser render, route access, readable geometry, shared motion and quiet-game checks passed.');
}finally{await browser?.close();server.kill('SIGTERM')}
