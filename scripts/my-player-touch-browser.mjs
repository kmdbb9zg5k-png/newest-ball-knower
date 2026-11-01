import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {createCareerLife} from '../myPlayerCareer.ts';
const key='ballknower_solo_my_player_v2';
await mkdir('artifacts/my-player-career',{recursive:true});
const base=process.env.BK_TEST_URL||'http://127.0.0.1:4193';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
// A real 320px career choice previously sat beneath the fixed relationship footer.
try {
 const context=await browser.newContext({viewport:{width:320,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*.supabase.co/**',r=>r.abort());await context.route('**/api/**',r=>r.fulfill({json:{available:false}}));
 const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const profile={version:1,stage:'season',name:'Touch Prospect',position:'WR',speed:82,power:80,awareness:72,overall:72,number:17,heightInches:72,weightLbs:210,teamAbbr:'JCY',rookieRole:'rotation',combineId:'touch-audit',upgradePoints:2};
 const life=createCareerLife(profile);profile.careerLife={...life,camp:{scores:[],complete:true,legacy:true}};
 await page.addInitScript(({key,profile})=>{
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(profile));
 localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');
 },{key,profile});
 await page.goto(base);
 await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();
 await page.locator('.bk-mode-card').filter({hasText:/My Player/i}).click();
 const continueButton=page.getByRole('button',{name:'CONTINUE',exact:true});
 await continueButton.or(page.getByRole('region',{name:'Weekly career story',exact:true})).first().waitFor();
 if(await continueButton.isVisible())await continueButton.click();
 await page.getByRole('region',{name:'Weekly career story',exact:true}).waitFor();
 await page.getByRole('button',{name:/^Protect your recovery day/}).click();
 await page.getByRole('button',{name:'Lock in preparation',exact:true}).click();
 assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).careerLife.turn.prep,key),'recovery');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'artifacts/my-player-career/weekly-touch-320.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: 320px weekly recovery choice receives touch/click, commits and persists without footer interception or page overflow.');
 await context.close();
}finally{await browser.close();}
