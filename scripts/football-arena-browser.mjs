import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import Arena from '/CommunityFootballArena.tsx';import '/index.css';createRoot(document.getElementById('root')).render(React.createElement(Arena,{me:location.search.includes('guest')?'':'me',friends:[{userId:'friend',displayName:'Fourth Down Club'}],onOpenAuth:()=>{document.body.dataset.auth='requested'}}));`;
const server=await createServer({cacheDir:'/tmp/bk-football-vite',server:{host:'127.0.0.1',port:3059,strictPort:true,watch:null,hmr:false},plugins:[{name:'football-fixture',enforce:'pre',transform(code,id){if(id.endsWith('/footballArena.ts')){const a=code.indexOf('export async function footballArenaAction'),b=code.indexOf('export const footballTotal');return code.slice(0,a)+`export async function footballArenaAction(action,args={}){const r=await fetch('/__arena-rpc',{method:'POST',body:JSON.stringify({action,args})});const data=await r.json();if(!r.ok)throw new Error(data.message);return data;}\n`+code.slice(b);}},configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.startsWith('/football-qa.html')){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0;background:#06090d;color:white"><div id="root"></div><script type="module" src="/football-qa.tsx"></script></body></html>'));}else next();});},resolveId(id){if(id==='/football-qa.tsx')return '\0football-qa.tsx';},load(id){if(id==='\0football-qa.tsx')return fixture;}}]});
await server.listen();await mkdir('artifacts/football-arena',{recursive:true});
let browser;
try{
 for(const width of (process.env.WIDTHS?JSON.parse(process.env.WIDTHS):[320,390,1280])){
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});

  const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<768,isMobile:width<768});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let matches=[],calls=[],fail=true;
  await page.route('**/*.supabase.co/**',r=>r.abort());
  await page.route('**/__arena-rpc',async route=>{
    const {action,args}=route.request().postDataJSON();calls.push({action,args});let result={};const m=matches.find(m=>m.id===args.id);
    if(action==='home')result={matches,standings:matches.some(m=>m.status==='completed')?[{user_id:'friend',name:'Fourth Down Club',games:1,wins:1,losses:0,ties:0,rating:3},{user_id:'me',name:'You',games:1,wins:0,losses:1,ties:0,rating:0}]:[]};
    if(action==='create')matches=[{id:'football-test',challenger_id:'me',opponent_id:'friend',challenger_team:args.team,opponent_team:'BRK',challenger_name:'My very long player display name',opponent_name:'Fourth Down Club',status:'active',winner_id:null,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),drives:[1,2,3].map(ordinal=>({user_id:'friend',ordinal,points:3,yards:50,plays:6,finished_at:new Date().toISOString(),forfeited:false}))}];
    if(action==='begin'){m.drives.push({user_id:'me',ordinal:args.drive,points:null,yards:null,plays:null,finished_at:null,deadline:new Date(Date.now()+720000).toISOString()});result={token:'drive-token-'+args.drive,drive:args.drive,deadline:new Date(Date.now()+720000).toISOString(),seed:42+args.drive,team:m.challenger_team,opponent:m.opponent_team};}
    if(action==='submit'||action==='forfeit'){
      if(action==='submit'&&fail){fail=false;await route.fulfill({status:503,json:{message:'Connection interrupted. Retry saving this result.'}});return;}
      const drive=m.drives.find(d=>d.user_id==='me'&&d.ordinal===args.drive);Object.assign(drive,action==='submit'?args.stats:{points:0,yards:0,plays:0},{finished_at:new Date().toISOString(),forfeited:action==='forfeit'});
      if(m.drives.filter(d=>d.finished_at).length===6){m.status='completed';m.winner_id='friend';}result={saved:true,points:drive.points};
    }
    await route.fulfill({json:result});
  });
  await page.goto('http://127.0.0.1:3059/football-qa.html?guest');await page.getByRole('button',{name:'Sign in to play'}).click();assert.equal(await page.locator('body').getAttribute('data-auth'),'requested');assert.equal(calls.length,0);
  await page.goto('http://127.0.0.1:3059/football-qa.html');await page.getByLabel('Your team').selectOption('MIL');await page.getByLabel('Opponent',{exact:true}).selectOption('friend');await page.getByRole('button',{name:'Challenge friend'}).click();await page.getByRole('button',{name:'Play drive 1 of 3'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No overflow '+width);await page.screenshot({path:`artifacts/football-arena/lobby-${width}.png`,fullPage:true});
  if(width===390){
    for(let n=1;n<=3;n++){
      console.log(`Playing official drive ${n} through normal spike controls`);
      await page.setViewportSize({width:1000,height:500});await page.getByRole('button',{name:`Play drive ${n} of 3`}).click();const frame=await page.locator('iframe').elementHandle().then(e=>e.contentFrame());
      await frame.locator('#loading').waitFor({state:'hidden',timeout:120000});
      assert.equal(await frame.evaluate(()=>typeof window.bk3dTest),'undefined','Official frames have no QA game controls');assert.equal(await frame.locator('#restart').isVisible(),false,'No rematch button');
      assert.match(await frame.locator('.club.away').getAttribute('aria-label'),/Brooklyn/);
      await page.evaluate(({drive})=>window.postMessage({type:'bk-arena-result',matchId:'football-test',token:'drive-token-'+drive,drive,stats:{points:8,yards:75,plays:1}},location.origin),{drive:n});
      assert.equal(calls.filter(c=>c.action==='submit').length,n===1?0:n,'Parent spoof ignored');
      for(let down=1;down<=4;down++){await frame.locator('#breakHuddle').click();await frame.locator('#miniSpike').click();}
      if(n===1){await page.getByRole('alert').filter({hasText:'Connection interrupted'}).waitFor({timeout:120000});await page.getByRole('button',{name:'Retry saving result'}).click();}
      await page.getByRole('heading',{name:'0 POINTS'}).waitFor();console.log(`Drive ${n} result saved`);await page.getByRole('button',{name:'Back to match',exact:true}).click();await page.setViewportSize({width:390,height:844});
    }
    await page.getByRole('button',{name:'Match history',exact:true}).click();await page.getByText('OPPONENT WINS',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/Play drive/}).count(),0);await page.screenshot({path:'artifacts/football-arena/history.png',fullPage:true});
    await page.getByRole('button',{name:'Standings',exact:true}).click();await page.getByText('1W · 0L · 0T',{exact:true}).waitFor();await page.screenshot({path:'artifacts/football-arena/standings.png',fullPage:true});
    const submitted=calls.filter(c=>c.action==='submit');assert.deepEqual(submitted[0].args,submitted[1].args,'Failed save retries exact stats/token');assert(submitted.every(c=>c.args.stats.points===0&&c.args.stats.plays===4),'Real game bridge sent four-spike turnovers');
    await page.getByRole('button',{name:'Play football',exact:true}).click();await page.getByRole('button',{name:'Challenge friend'}).click();await page.setViewportSize({width:1000,height:500});await page.getByRole('button',{name:'Play drive 1 of 3'}).click();await page.getByRole('button',{name:'Close drive',exact:true}).click();await page.getByRole('heading',{name:'Leave this drive?'}).waitFor();await page.getByRole('button',{name:'Record 0 and return to match'}).click();await page.getByRole('button',{name:'Play drive 2 of 3'}).waitFor();
    await page.getByRole('button',{name:'Play drive 2 of 3'}).click();await page.reload();await page.getByRole('button',{name:'Record 0 for interrupted drive 2'}).click();await page.getByRole('button',{name:'Play drive 3 of 3'}).waitFor();
  }
  assert.deepEqual(errors,[]);await browser.close();
 }
 console.log('PASS browser: 320/390/1280 layouts, guests, friend challenge, real three-drive gameplay/bridge, no restart, source validation, save retry, history, standings, quit and reload forfeits.');
}finally{await browser.close();await server.close();}
