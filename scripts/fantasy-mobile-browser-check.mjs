import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const baseURL=process.env.BK_BROWSER_BASE_URL||'http://127.0.0.1:4173';
const artifactDir=process.env.BK_BROWSER_ARTIFACT_DIR||'artifacts/fantasy-mobile-ui';
const sizes=[
  {width:375,height:812,label:'iphone-375'},
  {width:390,height:844,label:'iphone-390'},
  {width:392,height:852,label:'iphone-392'},
  {width:430,height:932,label:'iphone-430'},
];

const server=process.env.BK_BROWSER_BASE_URL?null:spawn(process.execPath,[
  './node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort',
],{stdio:['ignore','pipe','pipe'],env:{...process.env}});
let serverOutput='';
server?.stdout.on('data',chunk=>{serverOutput+=String(chunk);});
server?.stderr.on('data',chunk=>{serverOutput+=String(chunk);});

const waitForServer=async()=>{
  for(let attempt=0;attempt<60;attempt+=1){
    try{const response=await fetch(baseURL);if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`Ball Knower preview did not start.\n${serverOutput}`);
};

const layoutSnapshot=page=>page.evaluate(()=>{
  const primary=document.querySelector('nav[aria-label="Primary navigation"]');
  const header=document.querySelector('header');
  const shell=document.querySelector('.bk-app-shell');
  const main=document.querySelector('main');
  const primaryRect=primary?.getBoundingClientRect();
  const headerRect=header?.getBoundingClientRect();
  const horizontallyClippedMainContent=main?[...main.querySelectorAll('*')].flatMap(element=>{
    const style=getComputedStyle(element);
    const rect=element.getBoundingClientRect();
    if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||rect.width<1||rect.height<1||element.closest('[aria-hidden="true"]'))return[];
    let parent=element.parentElement;
    while(parent&&parent!==main){
      const parentStyle=getComputedStyle(parent);
      if((parentStyle.overflowX==='auto'||parentStyle.overflowX==='scroll')&&parent.scrollWidth>parent.clientWidth)return[];
      parent=parent.parentElement;
    }
    if(rect.left>=-1&&rect.right<=window.innerWidth+1)return[];
    return[`${element.tagName.toLowerCase()}.${[...element.classList].slice(0,2).join('.')} [${Math.round(rect.left)}, ${Math.round(rect.right)}]`];
  }).slice(0,12):[];
  return{
    viewport:{width:window.innerWidth,height:window.innerHeight},
    documentWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth,
    shellWidth:shell?.scrollWidth||0,
    mainWidth:main?.scrollWidth||0,
    horizontallyClippedMainContent,
    primaryButtons:primary?.querySelectorAll('button').length||0,
    primaryRect:primaryRect&&{left:primaryRect.left,right:primaryRect.right,top:primaryRect.top,bottom:primaryRect.bottom},
    headerRect:headerRect&&{left:headerRect.left,right:headerRect.right,top:headerRect.top,bottom:headerRect.bottom},
    tab:document.querySelector('.bk-app-shell')?.getAttribute('data-tab')||'',
  };
});

const assertContained=(snapshot,label)=>{
  const {width,height}=snapshot.viewport;
  assert.ok(snapshot.documentWidth<=width+1,`${label}: document overflows by ${snapshot.documentWidth-width}px`);
  assert.ok(snapshot.bodyWidth<=width+1,`${label}: body overflows by ${snapshot.bodyWidth-width}px`);
  assert.ok(snapshot.shellWidth<=width+1,`${label}: app shell clips ${snapshot.shellWidth-width}px of horizontal content`);
  assert.ok(snapshot.mainWidth<=width+1,`${label}: main content clips ${snapshot.mainWidth-width}px horizontally`);
  assert.deepEqual(snapshot.horizontallyClippedMainContent,[],`${label}: visible controls/content escape the viewport:\n${snapshot.horizontallyClippedMainContent.join('\n')}`);
  assert.equal(snapshot.primaryButtons,5,`${label}: mobile bottom navigation lost a destination`);
  assert.ok(snapshot.primaryRect,`${label}: mobile bottom navigation is missing`);
  assert.ok(snapshot.primaryRect.left>=-1&&snapshot.primaryRect.right<=width+1,`${label}: bottom navigation is clipped horizontally`);
  assert.ok(snapshot.primaryRect.top>=0&&snapshot.primaryRect.bottom<=height+1,`${label}: bottom navigation is outside the viewport`);
  assert.ok(snapshot.headerRect,`${label}: fixed header is missing`);
  assert.ok(snapshot.headerRect.left>=-1&&snapshot.headerRect.right<=width+1,`${label}: header is clipped horizontally`);
  assert.ok(snapshot.headerRect.top>=-1,`${label}: header is above the viewport`);
};

const assertDialogContained=async(page,label)=>{
  const dialog=page.getByRole('dialog').last();
  const box=await dialog.boundingBox();
  assert.ok(box,`${label}: dialog is missing`);
  assert.ok(box.x>=-1&&box.x+box.width<=page.viewportSize().width+1,`${label}: dialog is clipped horizontally`);
  assert.ok(box.y>=-1&&box.y+box.height<=page.viewportSize().height+1,`${label}: dialog is clipped vertically`);
};

await mkdir(artifactDir,{recursive:true});
let browser;
try{
  await waitForServer();
  browser=await chromium.launch({headless:true});
  for(const size of sizes){
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    const pageErrors=[];
    const consoleErrors=[];
    const failedFirstPartyResponses=[];
    const firstPartyOrigin=new URL(baseURL).origin;
    page.on('pageerror',error=>pageErrors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource:'))consoleErrors.push(message.text());});
    page.on('response',response=>{if(response.status()>=400&&new URL(response.url()).origin===firstPartyOrigin)failedFirstPartyResponses.push(`${response.status()} ${response.url()}`);});
    await page.route('**/api/**',async route=>{
      const pathname=new URL(route.request().url()).pathname;
      const body=pathname==='/api/media'?{tracks:[],introUrl:null}:{ok:true};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.route('**/_vercel/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.addInitScript(()=>{
      localStorage.setItem('ball-knower-team-setup-v2','complete');
      localStorage.setItem('ball-knower-intro-sound-v1','off');
      localStorage.setItem('bk-guide-fantasy-hq-v3','seen');
    });
    await page.goto(baseURL,{waitUntil:'domcontentloaded'});
    const skip=page.getByRole('button',{name:/skip/i});
    if(await skip.isVisible().catch(()=>false))await skip.click();
    await page.locator('.bk-app-shell[data-tab="home"]').waitFor({state:'visible'});
    const primary=page.getByRole('navigation',{name:'Primary navigation'});
    await primary.waitFor({state:'visible'});
    assertContained(await layoutSnapshot(page),`${size.label} home`);

    await primary.getByRole('button',{name:'Fantasy',exact:true}).click();
    await page.locator('.bk-app-shell[data-tab="fantasy"]').waitFor({state:'visible'});
    await page.getByRole('button',{name:'League HQ',exact:true}).waitFor({state:'visible'});
    assertContained(await layoutSnapshot(page),`${size.label} League HQ`);

    await page.getByRole('button',{name:'Cheat Sheet',exact:true}).click();
    await page.getByRole('heading',{name:'Player Cheat Sheet',exact:true}).waitFor({state:'visible'});
    assertContained(await layoutSnapshot(page),`${size.label} Cheat Sheet`);

    await primary.getByRole('button',{name:'Profile',exact:true}).click();
    await page.getByRole('heading',{name:'Ball Knower Profile',exact:true}).waitFor({state:'visible'});
    assertContained(await layoutSnapshot(page),`${size.label} Profile`);
    await page.getByRole('button',{name:'Add profile photo',exact:true}).click();
    await page.getByRole('button',{name:'Take Photo',exact:true}).waitFor({state:'visible'});
    await page.getByRole('button',{name:'Choose From Photos',exact:true}).waitFor({state:'visible'});
    await assertDialogContained(page,`${size.label} profile photo actions`);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMjDAGAC0KA/2BHvtYAAAAAElFTkSuQmCC','base64');
    await page.locator('input[type="file"]:not([capture])').setInputFiles({name:'profile.png',mimeType:'image/png',buffer:png});
    await page.getByRole('heading',{name:'Position Your Photo',exact:true}).waitFor({state:'visible'});
    await page.getByRole('button',{name:'Save Photo',exact:true}).waitFor({state:'visible'});
    await assertDialogContained(page,`${size.label} profile photo crop`);
    await page.screenshot({path:`${artifactDir}/${size.label}-profile-photo.png`,fullPage:true});
    assert.deepEqual(pageErrors,[],`${size.label}: uncaught page errors:\n${pageErrors.join('\n')}`);
    assert.deepEqual(failedFirstPartyResponses,[],`${size.label}: first-party request failures:\n${failedFirstPartyResponses.join('\n')}`);
    assert.deepEqual(consoleErrors,[],`${size.label}: browser console errors:\n${consoleErrors.join('\n')}`);
    await context.close();
  }
  console.log(`Fantasy mobile browser checks passed at ${sizes.map(size=>size.width).join(', ')}px.`);
}finally{
  await browser?.close();
  if(server){server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,1000);});}
}
