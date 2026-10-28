import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:3061,strictPort:true,watch:null,hmr:false}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
await mkdir('artifacts/athlete-creator',{recursive:true});
try{
  for(const width of [320,390,1280]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&/shader|WebGL|THREE/.test(message.text()))errors.push(message.text());});
    await page.goto('http://127.0.0.1:3061/combine.html?drill=dash');
    const preview=page.locator('[data-athlete-live-preview=true]');
    const capture=async path=>{
      await preview.scrollIntoViewIfNeeded();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      return preview.screenshot({path});
    };
    await page.locator('[data-render-state=ready]').waitFor({timeout:60000});
    assert.equal(await preview.locator('canvas').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const front=await preview.screenshot({path:`artifacts/athlete-creator/front-${width}.png`});
    await page.getByRole('button',{name:'Bald',exact:true}).click();
    const bald=await preview.screenshot({path:`artifacts/athlete-creator/bald-${width}.png`});
    assert(!front.equals(bald),'Hair choices visibly change the rendered athlete');
    await page.getByRole('button',{name:'Both Arms',exact:true}).click();
    const ink=await preview.screenshot({path:`artifacts/athlete-creator/ink-${width}.png`});
    assert(!bald.equals(ink),'Tattoo choices visibly change the rendered athlete');
    await page.getByRole('button',{name:'None',exact:true}).click();
    assert(bald.equals(await preview.screenshot()),'Removing tattoos restores clean arm skin');
    await page.getByLabel('ARMS',{exact:true}).press('End');
    await page.getByRole('button',{name:'Fair',exact:true}).click();
    await page.getByRole('button',{name:'Braids',exact:true}).click();
    await page.getByRole('button',{name:'Both Arms',exact:true}).click();
    await page.getByRole('button',{name:'Geometric',exact:true}).click();
    await preview.screenshot({path:`artifacts/athlete-creator/custom-${width}.png`});
    await page.getByLabel('Rotate athlete',{exact:true}).press('End');
    await preview.screenshot({path:`artifacts/athlete-creator/back-${width}.png`});
    await page.getByRole('button',{name:'Save & start 40-Yard Dash',exact:true}).click();
    await page.getByRole('heading',{name:'40-YARD DASH',exact:true}).waitFor();
    await page.reload();
    await page.locator('[data-render-state=ready]').waitFor({timeout:60000});
    assert.equal(await preview.getAttribute('data-arm-size'),'100');
    assert.equal(await preview.getAttribute('data-skin-tone'),'fair');
    assert.equal(await preview.getAttribute('data-hair-style'),'braids');
    if(width===390){
      await page.getByLabel('HEIGHT',{exact:true}).press('End');
      await page.getByLabel('WEIGHT',{exact:true}).press('End');
      await capture('artifacts/athlete-creator/largest-390.png');
      await page.getByLabel('HEIGHT',{exact:true}).press('Home');
      await page.getByLabel('WEIGHT',{exact:true}).press('Home');
      await capture('artifacts/athlete-creator/smallest-390.png');
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('PASS real 3D creator, mobile layout, customization, rotation, save and reload.');
}finally{await browser.close();await server.close();}
