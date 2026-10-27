import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:3074,strictPort:true,watch:null,hmr:false}});await server.listen();await mkdir('artifacts/control-settings',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 for(const viewport of [{width:320,height:844},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  console.log('CONTROL viewport',viewport);await page.goto('http://127.0.0.1:3074/combine.html?drill=routes');await page.getByText('Customize controls',{exact:true}).click();
  for(const selector of ['select','button'])for(const control of await page.locator('.bk-control-options '+selector).all()){
   await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'Each setting is reachable inside the viewport, including landscape');
  }
  console.log('CONTROL settings open');await page.getByLabel(/^Movement stick/).selectOption('right');await page.getByLabel(/^Control size/).selectOption('large');await page.getByLabel(/^Control height/).selectOption('raised');await page.getByLabel(/^Visual frame rate/).selectOption('30');
  assert.equal(await page.locator('.route-game').getAttribute('data-control-hand'),'right');assert.equal(await page.locator('.route-game').getAttribute('data-control-size'),'large');assert.equal(await page.locator('.route-game').getAttribute('data-control-height'),'raised');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Settings do not overflow');
  console.log('CONTROL reload preferences');await page.reload();await page.getByText('Customize controls',{exact:true}).click();assert.equal(await page.getByLabel(/^Movement stick/).inputValue(),'right');assert.equal(await page.getByLabel(/^Visual frame rate/).inputValue(),'30');
  await page.getByText('Customize controls',{exact:true}).click();console.log('CONTROL starting rep');await page.getByRole('button',{name:/^START ROUTE/}).click();await page.locator('.route-controls').waitFor();
  const stick=await page.locator('.route-stick').boundingBox(),action=await page.locator('.route-catch-slot').boundingBox();assert(stick&&action&&stick.x>action.x,'Handedness moves actual stick to the right');assert.equal(await page.getByText('Customize controls',{exact:true}).count(),0,'Settings are not changed during live rep');
  await page.screenshot({path:`artifacts/control-settings/right-large-${viewport.width}.png`});
  await page.getByRole('button',{name:'Hold to pause',exact:true}).focus();await page.keyboard.press('Enter');const pause=page.getByRole('dialog',{name:'Drill paused'});await pause.waitFor();await pause.getByText('Customize controls',{exact:true}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'BACK TO COMBINE','Closed settings do not trap focus on invisible reset control');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Customize controls');
  await page.reload();await page.getByText('Customize controls',{exact:true}).click();await page.getByRole('button',{name:'Reset controls',exact:true}).click();assert.equal(await page.getByLabel(/^Movement stick/).inputValue(),'left');assert.equal(await page.getByLabel(/^Control size/).inputValue(),'standard');assert.equal(await page.getByLabel(/^Visual frame rate/).inputValue(),'60');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS actual receiver controls: size/hand/height, saved reload, actual right-side joystick, live settings gate, reset and 320/390/landscape layouts. Software-rendered browser; not physical-device FPS certification.');
}finally{await browser.close();await server.close();}
