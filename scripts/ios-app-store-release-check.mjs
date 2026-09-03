import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const failures=[];
const requireText=(path,needles)=>{
  if(!fs.existsSync(path)){failures.push(`${path} is missing`);return}
  const text=read(path);
  for(const needle of needles)if(!text.includes(needle))failures.push(`${path} is missing: ${needle}`);
};

const capacitor=JSON.parse(read('capacitor.config.json'));
if(capacitor.appId!=='com.ballknower.ios')failures.push('Capacitor appId must be com.ballknower.ios');
if(capacitor.appName!=='Ball Knower')failures.push('Capacitor appName must be Ball Knower');
if(capacitor.webDir!=='dist')failures.push('Capacitor webDir must be dist');
if(capacitor.plugins?.CapacitorHttp?.enabled!==true)failures.push('CapacitorHttp must be enabled for native API traffic');

requireText('codemagic.yaml',[
  'BUNDLE_ID: "com.ballknower.ios"',
  'MARKETING_VERSION: "1.0.0"',
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'CFBundleURLSchemes:0 string ballknower',
  'Build signed IPA',
  'submit_to_testflight: false',
  'submit_to_app_store: false',
]);
requireText('nativeRuntime.ts',['https://ballknower.com','/api/','Capacitor.isNativePlatform']);
requireText('nativeAuth.ts',['ballknower://auth/callback','appUrlOpen','getLaunchUrl','exchangeCodeForSession']);
requireText('main.tsx',['installNativeApiBridge();']);
requireText('api/account-delete.ts',['auth.admin.deleteUser','confirmation','Bearer ']);
requireText('LaunchCenter.tsx',['deleteBallKnowerAccount','Permanently delete account']);
requireText('migrations/20260903_account_deletion_cleanup.sql',['before delete on auth.users','ball_knower_cleanup_account_before_auth_delete']);
requireText('public/privacy.html',['Ball Knower Privacy Policy','Delete your account in the app']);
requireText('public/support.html',['Ball Knower Support']);
requireText('public/terms.html',['Ball Knower Terms of Use']);
requireText('public/ball-knower-icon.svg',['viewBox="0 0 512 512"']);

const trackedTextFiles=['.env.example','supabase.ts','codemagic.yaml','api/account-delete.ts'];
for(const path of trackedTextFiles){
  if(!fs.existsSync(path))continue;
  const text=read(path);
  if(/SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY\s*=\s*["']?[A-Za-z0-9._-]{20,}/.test(text))failures.push(`${path} appears to contain a Supabase server secret`);
}

if(failures.length){
  console.error('iOS App Store release gate failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('iOS App Store release gate passed.');
