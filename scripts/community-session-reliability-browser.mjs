import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createCommunityReliabilityFixture} from './community-reliability-fixture.mjs';

// For the approved remote CI browser runner. Do not treat mocked API/frame
// exchanges as two real users or game-engine validation.
const server=await createCommunityReliabilityFixture(3066);
const output='artifacts/community-session-reliability';await mkdir(output,{recursive:true});
let browser;const checks=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox']});
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  const base='http://127.0.0.1:3066/community-reliability-qa.html';
  const state=()=>page.evaluate(async()=>{const r=await fetch('/__community-reliability/state',{headers:{'x-fixture-id':sessionStorage.getItem('bk-reliability-fixture')}});return r.json();});
  const fresh=async(query='')=>{await page.goto(base+query);await page.evaluate(()=>sessionStorage.removeItem('bk-reliability-fixture'));await page.reload();};
  const fits=async(label)=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' fits '+width);
  const complete=async(n)=>{const iframe=page.locator(`iframe[src*="drive=${n}"]`);await iframe.waitFor();await assert.doesNotReject(()=>iframe.evaluate(el=>new Promise((resolve,reject)=>{const until=Date.now()+10000;const check=()=>{if(!el.inert)return resolve();if(Date.now()>until)return reject(Error('Arena readiness handshake never cleared iframe inert state'));setTimeout(check,50);};check();})));const handle=await iframe.elementHandle();assert(handle,'Drive '+n+' frame exists');const frame=await handle.contentFrame();await frame.locator('#fixture-result').click();};

  await fresh();await page.getByRole('button',{name:'Play drive 1 of 3',exact:true}).click();
  await page.locator('iframe[src*="drive=1"]').waitFor();
  await page.evaluate(()=>window.postMessage({type:'bk-arena-result',matchId:'fixture-match',token:'fixture-token-1',drive:1,stats:{points:8,yards:75,plays:1}},location.origin));
  assert.equal((await state()).calls.filter(c=>c.action==='submit').length,0,'Wrong-source result rejected');
  await complete(1);await page.getByRole('alert').filter({hasText:'connection interrupted'}).waitFor();
  const first=(await state()).calls.find(c=>c.action==='submit');
  await page.getByRole('button',{name:'Exit',exact:true}).click();await page.getByRole('button',{name:'Leave match',exact:true}).click();
  await page.getByRole('button',{name:'Retry saved drive 1',exact:true}).click();
  await page.locator('iframe[src*="drive=2"]').waitFor();
  const recovered=await state();assert.deepEqual(recovered.calls.filter(c=>c.action==='submit')[1].args,first.args,'Recovery resends exact token/stats');
  assert.equal(recovered.calls.filter(c=>c.action==='begin'&&c.args.drive===1).length,1,'Recovery does not restart the completed drive');
  await complete(2);await page.locator('iframe[src*="drive=3"]').waitFor();await complete(3);
  await page.getByRole('heading',{name:'You win!',exact:true}).waitFor();
  assert.match(await page.locator('.football-session-fine').innerText(),/Online player/);
  await fits('Online result');await page.screenshot({path:`${output}/online-results-${width}.png`});
  await page.getByRole('button',{name:'Challenge to rematch',exact:true}).click();await page.getByRole('button',{name:'Rematch challenge sent',exact:true}).waitFor();
  const rematched=await state();assert.equal(rematched.matches.length,2);assert.equal(rematched.matches.find(m=>m.id==='fixture-match').status,'completed','A new challenge preserves the previous result');
  await page.getByRole('button',{name:'Back to main screen',exact:true}).last().click();

  await fresh('?scenario=late-cancel');await page.getByRole('button',{name:'Pick your team',exact:true}).click();
  const queue=page.waitForRequest(r=>r.url().endsWith('/football')&&r.postDataJSON().action==='quick_match');
  await page.getByRole('button',{name:'Find online player',exact:true}).click();await queue;
  await page.getByRole('button',{name:'Cancel search',exact:true}).click();await page.getByRole('heading',{name:'Pick your team.',exact:true}).waitFor();
  assert.equal((await state()).matches.find(m=>m.id==='fixture-search').status,'cancelled','A late queue creation is still cancelled');
  assert.equal(await page.locator('iframe').count(),0);

  await fresh('?scenario=search-error');await page.getByRole('button',{name:'Pick your team',exact:true}).click();await page.getByRole('button',{name:'Find online player',exact:true}).click();
  await page.getByRole('heading',{name:'Search interrupted',exact:true}).waitFor();await fits('Search error');
  await page.getByRole('button',{name:'Play automated practice',exact:true}).click();await page.locator('iframe[src*="drive=1"]').waitFor();
  assert.match(await page.locator('.football-session-score').innerText(),/CPU · automated practice/);

  await fresh('?guest');const before=Date.now();await page.getByRole('button',{name:'Pick your team',exact:true}).click();await page.getByRole('button',{name:'Start quick practice',exact:true}).click();
  await page.getByRole('heading',{name:'Preparing automated practice',exact:true}).waitFor();await fits('Guest countdown');
  await page.locator('iframe[src*="drive=1"]').waitFor({timeout:40000});assert(Date.now()-before>=29000,'Automatic guest fallback retains its 30-second countdown');
  assert.match(await page.locator('.football-session-score').innerText(),/CPU · automated practice/);
  for(let n=1;n<=3;n++){if(n>1)await page.locator(`iframe[src*="drive=${n}"]`).waitFor();await complete(n);}
  await page.locator('.football-session-results').waitFor();assert.match(await page.locator('.football-session-fine').innerText(),/CPU scores are simulated/);
  await page.getByRole('button',{name:'Play automated rematch',exact:true}).click();await page.locator('iframe[src*="drive=1"]').waitFor();
  assert.match(await page.locator('.football-session-score').innerText(),/You 0/);assert.equal((await state()).calls.length,0,'Guest CPU matches and rematches never call private APIs');

  await fresh('?mode=competition&scenario=load-error');await page.getByRole('button',{name:'Retry competitions',exact:true}).click();
  await page.getByRole('button',{name:/Fixture Three-Drill Cup/}).click();await page.getByRole('button',{name:'Retry event',exact:true}).waitFor();
  assert.equal(await page.getByText('Loading event…',{exact:true}).count(),0,'A failed event is not labelled as still loading');
  await page.getByRole('button',{name:'Retry event',exact:true}).click();await page.getByRole('button',{name:'Play event drill',exact:true}).first().click();
  const eventFrame=await page.locator('.competition-play iframe').elementHandle().then(e=>e.contentFrame());await eventFrame.locator('#fixture-result').click();
  await page.getByRole('button',{name:'Retry event result',exact:true}).waitFor();const eventFirst=(await state()).calls.find(c=>c.action==='submit');
  await page.getByRole('button',{name:'Back to event',exact:true}).click();await page.getByRole('button',{name:'Retry result save',exact:true}).click();
  assert.equal(await page.locator('.competition-play iframe').count(),0,'Restoring a completed drill never replays the game');
  await page.getByRole('button',{name:'Retry event result',exact:true}).click();await page.getByRole('heading',{name:'Event result locked',exact:true}).waitFor();
  const cup=await state();assert.deepEqual(cup.calls.filter(c=>c.action==='submit')[1].args,eventFirst.args);assert.equal(cup.calls.filter(c=>c.action==='begin').length,1);
  await page.getByRole('button',{name:'Back to event',exact:true}).click();await page.getByRole('button',{name:'Result locked',exact:true}).waitFor();await fits('Competition result');
  await page.screenshot({path:`${output}/competition-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);checks.push({width,status:'PASS'});await context.close();
 }
 await writeFile(`${output}/report.json`,JSON.stringify({status:'PASS',checks,scope:'Mock API and iframe session orchestration only; no real users, live backend writes, game engine performance or physical-device certification.'},null,2));
 console.log('PASS 320/390 session recovery, source validation, late cancel, error fallback, 30s CPU disclosure, rematch preservation and competition retries. Mocked API/frame proof only.');
}finally{await browser?.close();await server.close();}
