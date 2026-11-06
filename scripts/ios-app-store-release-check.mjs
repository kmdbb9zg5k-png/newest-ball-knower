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
  'python3 scripts/configure-ios-project.py',
  'npx --no-install cap add ios --packagemanager SPM',
  'python3 scripts/verify-ios-ipa.py',
  'IOS_BUILD_NUMBER="$(python3 scripts/ios_build_number.py)"',
  'xcrun agvtool new-version -all "$IOS_BUILD_NUMBER"',
  'BK_APPROVED_UPLOAD_SHA',
  'Build signed IPA',
  'submit_to_testflight: false',
  'submit_to_app_store: false',
]);
requireText('scripts/configure-ios-project.py',[
  'NSCameraUsageDescription','NSPhotoLibraryUsageDescription','CFBundleURLSchemes','ballknower',
  'com.apple.developer.applesignin','CODE_SIGN_ENTITLEMENTS','App/App.entitlements',
  'aps-environment','$(APS_ENVIRONMENT)','"development" if config["name"] == "Debug" else "production"',
  '.capacitorDidRegisterForRemoteNotifications','.capacitorDidFailToRegisterForRemoteNotifications',
]);
requireText('scripts/verify-ios-ipa.py',['verify_ios_build_number(manifest["buildNumber"])']);
const codemagic=read('codemagic.yaml');
if(/npm install --no-save|--create\b/.test(codemagic))failures.push('Native builds must use locked dependencies and existing signing credentials');
const buildOnlyWorkflow=codemagic.split('\n  ios-app-store:\n')[1]?.split('\n  ios-app-store-upload:\n')[0];
if(!buildOnlyWorkflow||/\n    publishing:/.test(buildOnlyWorkflow))failures.push('The default signed-candidate workflow must not distribute or notify');
requireText('nativeRuntime.ts',['https://ballknowerofficial.com','/api/','Capacitor.isNativePlatform','nativeApiUrl']);
requireText('nativeAuth.ts',['ballknower://auth/callback','appUrlOpen','getLaunchUrl','exchangeCodeForSession','browserFinished','authorizeAppleForDeletion']);
if(read('nativeAuth.ts').includes('auth.setSession'))failures.push('Native callbacks must not accept unbound implicit-token sessions');
requireText('nativeAuth.ts',['NativeAuthSession.authenticate','AUTH_CANCELLED']);
requireText('packages/native-auth-session/ios/Sources/NativeAuthSessionPlugin/NativeAuthSessionPlugin.swift',[
  'ASWebAuthenticationSession(url:', 'presentationContextProvider = self',
  'viewController?.view.window', 'AUTH_START_FAILED', 'AUTH_CANCELLED',
]);
if(read('nativeAuth.ts').includes("presentationStyle:'popover'"))failures.push('iOS OAuth must not use a generic Safari popover');
requireText('SportsbookHub.tsx',['No entry fees, cash bets, payouts or prizes']);
requireText('main.tsx',['installNativeApiBridge();']);
requireText('supabase.ts',['persistSession: true','autoRefreshToken: true','providerRefreshToken']);
requireText('api/account-delete.ts',['auth.admin.deleteUser','confirmation','Bearer ','appleid.apple.com/auth/revoke','manualAppleRevokeRequired']);
requireText('LaunchCenter.tsx',['deleteBallKnowerAccount','Permanently delete account','Apple Account’s Sign in with Apple settings']);
requireText('migrations/20260903_account_deletion_cleanup.sql',['before delete on auth.users','ball_knower_cleanup_account_before_auth_delete']);
requireText('public/privacy.html',['Ball Knower Privacy Policy','Delete your account in the app']);
requireText('public/support.html',['Ball Knower Support']);
requireText('public/terms.html',['Ball Knower Terms of Use']);
requireText('public/ball-knower-icon.svg',['viewBox="0 0 512 512"']);

const deletion=read('api/account-delete.ts');
if(deletion.includes('APPLE_REAUTH_REQUIRED'))failures.push('Apple provider-token absence must not block account deletion');
if(!/manualAppleRevokeRequired=true[\s\S]*auth\.admin\.deleteUser/.test(deletion))failures.push('Apple manual-revocation fallback must still proceed to auth account deletion');

const trackedTextFiles=['.env.example','supabase.ts','codemagic.yaml','api/account-delete.ts'];
for(const path of trackedTextFiles){
  if(!fs.existsSync(path))continue;
  const text=read(path);
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY\s*=\s*["']?([^"'\s#]+)/);
    if(match){
      const value=match[1];
      const isPlaceholder=/^(?:YOUR_|USE_|REPLACE_|EXAMPLE_|CHANGEME)/i.test(value);
      if(!isPlaceholder && value.length>=20)failures.push(`${path} appears to contain a Supabase server secret`);
    }
    const appleClientSecret=line.match(/^\s*VITE_APPLE_(?:PRIVATE_KEY|KEY_ID|TEAM_ID|OAUTH_CLIENT_ID)\s*=/);
    if(appleClientSecret)failures.push(`${path} exposes an Apple provider secret/client configuration to the Vite bundle`);
  }
}

if(failures.length){
  console.error('iOS App Store release gate failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('iOS App Store release gate passed.');
