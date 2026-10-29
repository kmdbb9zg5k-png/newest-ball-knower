import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:3096,strictPort:true,watch:null,hmr:false}});await server.listen();
await mkdir('artifacts/athlete-tattoos',{recursive:true});
const launch=()=>chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
let browser;
try{
 browser=await launch();const page=await browser.newPage({viewport:{width:600,height:800}});page.setDefaultTimeout(90000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 await page.route('**/tattoo-qa',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#15232c"><div id="host" style="width:600px;height:800px"></div></body>'}));
 await page.goto('http://127.0.0.1:3096/tattoo-qa');
 await page.evaluate(async()=>{
  const {createCreatorScene}=await import('/combine/creator-scene.ts');
  const {DEFAULT_ATHLETE_APPEARANCE}=await import('/athleteAppearance.ts');
  const profile={id:'tattoo-qa',name:'Tattoo Athlete',position:'WR',heightInches:72,weightLbs:205,athleteAppearance:{...DEFAULT_ATHLETE_APPEARANCE,hairStyle:'bald'}};
  const scene=await createCreatorScene(document.querySelector('#host'),profile);scene.rotate(0);
  const capture=(coverage,style,arms)=>{scene.update({...profile,athleteAppearance:{...profile.athleteAppearance,tattooCoverage:coverage,tattooStyle:style,tattooArms:arms}});const source=document.querySelector('canvas'),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);return{pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width};};
  const clean=capture('none','blackwork','right');
  window.checkInk=(coverage,style,arms)=>{const shot=capture(coverage,style,arms);let left=0,right=0;for(let i=0;i<shot.pixels.length;i+=4){const delta=Math.abs(shot.pixels[i]-clean.pixels[i])+Math.abs(shot.pixels[i+1]-clean.pixels[i+1])+Math.abs(shot.pixels[i+2]-clean.pixels[i+2]);if(delta>15){if((i/4)%shot.width<shot.width/2)left++;else right++;}}return{left,right};};
 });
 for(const style of ['blackwork','traditional','geometric','script','mixed'])for(const arms of ['left','right','both']){
  const diff=await page.evaluate(({style,arms})=>window.checkInk('full-sleeve',style,arms),{style,arms});
  assert(arms==='left'?diff.right>40&&diff.left===0:arms==='right'?diff.left>40&&diff.right===0:diff.left>40&&diff.right>40,`${style}/${arms}: actual ink pixels must change only the selected arms: ${JSON.stringify(diff)}`);
  if(style==='blackwork'||arms==='both')await page.screenshot({path:`artifacts/athlete-tattoos/${style}-${arms}.png`});
 }
 for(const coverage of ['minimal','upper-arm','forearm','half-sleeve','full-sleeve']){
  const diff=await page.evaluate(c=>window.checkInk(c,'blackwork','both'),coverage);assert(diff.left>5&&diff.right>5,`${coverage}: both arms receive ink`);
 }
 assert.deepEqual(await page.evaluate(()=>window.checkInk('none','blackwork','both')),{left:0,right:0});assert.deepEqual(errors,[]);await browser.close();browser=null;
 console.log('PASS actual rendered pixels: all five styles on left/right/both, all coverage levels on both, and clean removal.');
 for(const width of [320,390]){
  browser=await launch();const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});page.setDefaultTimeout(90000);
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:3096')return r.abort();if(u.pathname.startsWith('/api/'))return r.fulfill({json:{available:false}});return r.request().method()==='GET'?r.continue():r.abort();});
  await page.goto('http://127.0.0.1:3096/combine.html?drill=dash');await page.locator('[data-render-state=ready]').waitFor();await page.getByRole('tab',{name:'Tattoos',exact:true}).click();
  for(const arm of ['Left Arm','Right Arm','Both Arms']){await page.getByRole('button',{name:arm,exact:true}).click();assert.equal(await page.getByRole('button',{name:arm,exact:true}).getAttribute('aria-pressed'),'true');}
  await page.getByRole('button',{name:'Forearm',exact:true}).click();await page.getByRole('button',{name:'Traditional',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/athlete-tattoos/controls-${width}.png`});
  await page.getByRole('button',{name:'Save & start 40-Yard Dash',exact:true}).click();await page.reload();await page.locator('[data-render-state=ready]').waitFor();await page.getByRole('tab',{name:'Tattoos',exact:true}).click();
  for(const label of ['Both Arms','Forearm','Traditional'])assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
  await browser.close();browser=null;console.log(`PASS ${width}px placement controls, saved appearance and reload.`);
 }
}finally{await browser?.close();await server.close();}
