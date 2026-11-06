import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';

if(process.env.BK_NATIVE_QA!=='1')throw new Error('BK_NATIVE_QA=1 is required for the isolated unsigned Simulator fixture');
const configPath='ios/App/App/capacitor.config.json';
const config=JSON.parse(await fs.readFile(configPath,'utf8'));
if(config.appId!=='com.ballknower.ios')throw new Error('Generate and configure the production wrapper first');
config.appId='com.ballknower.ios.nativeqa';
config.appName='Ball Knower Native QA';
config.server={...config.server,appStartPath:'__bk_native_qa.html'};
// Fixture requests are local; the plugin and AppDelegate stay exactly as built.
config.plugins.CapacitorHttp={enabled:false};
await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');
const app='ios/App/App';
const qaController=await fs.readFile('scripts/fixtures/NativeQAViewController.swift','utf8');
await fs.appendFile(`${app}/AppDelegate.swift`,'\n'+qaController);
// Capacitor 8.5 creates its root controller in SceneDelegate rather than loading
// Main.storyboard. Both entry points must select the fixture-only subclass.
const sceneDelegatePath=`${app}/SceneDelegate.swift`;
const sceneDelegate=await fs.readFile(sceneDelegatePath,'utf8');
if(!sceneDelegate.includes('rootViewController = CAPBridgeViewController()'))throw new Error('Expected the locked Capacitor SceneDelegate root controller');
await fs.writeFile(sceneDelegatePath,sceneDelegate.replace('rootViewController = CAPBridgeViewController()','rootViewController = NativeQAViewController()'));
const storyboardPath=`${app}/Base.lproj/Main.storyboard`;
const storyboard=await fs.readFile(storyboardPath,'utf8');
if(!storyboard.includes('customClass="CAPBridgeViewController"'))throw new Error('Expected the generated Capacitor storyboard');
await fs.writeFile(storyboardPath,storyboard.replace('customClass="CAPBridgeViewController" customModule="Capacitor"','customClass="NativeQAViewController" customModule="App"'));
execFileSync('python3',['scripts/configure-ios-native-qa.py'],{stdio:'inherit'});
await fs.writeFile(`${app}/public/__bk_native_qa.html`,'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ball Knower native QA</title><style>body{background:#050608;color:#f6f6f6;font:13px monospace;padding:30px 16px}pre{white-space:pre-wrap}</style></head><body><h1>Ball Knower native QA</h1><p id="phase-status" role="status">Native QA running</p><pre id="report">Starting real iOS bridge checks…</pre><script type="module" src="/__bk_native_qa.js"></script></body></html>');
await build({
  entryPoints:['scripts/fixtures/native-ios-qa.ts'],bundle:true,format:'esm',target:'safari17',outfile:`${app}/public/__bk_native_qa.js`,
  plugins:[{name:'native-qa-service-boundary',setup(builder){
    builder.onResolve({filter:/^\.\/supabase$/},()=>({path:'native-qa-offline-supabase',namespace:'native-qa'}));
    builder.onLoad({filter:/.*/,namespace:'native-qa'},()=>({contents:`export const supabase={auth:{exchangeCodeForSession:async()=>{window.__bkNativeQAExchange();return {error:new Error('Native QA never exchanges real authorization codes')}},startAutoRefresh(){},stopAutoRefresh(){}}};export async function ensureOnlineSession(){throw new Error('Native QA never opens an online account')}`,loader:'js'}));
  }}],
});
console.log('Prepared an isolated .nativeqa Debug Simulator fixture. Regenerate the wrapper before signing.');
