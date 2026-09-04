import assert from 'node:assert/strict';
import fs from 'node:fs';

const nativeAuth=fs.readFileSync('nativeAuth.ts','utf8');
const supabase=fs.readFileSync('supabase.ts','utf8');
const modal=fs.readFileSync('AuthModal.tsx','utf8');
const identity=fs.readFileSync('accountIdentity.ts','utf8');
const deletion=fs.readFileSync('api/account-delete.ts','utf8');
const codemagic=fs.readFileSync('codemagic.yaml','utf8');
const envExample=fs.readFileSync('.env.example','utf8');

assert.match(nativeAuth,/ballknower:\/\/auth\/callback/);
assert.match(nativeAuth,/appUrlOpen/);
assert.match(nativeAuth,/getLaunchUrl/);
assert.match(nativeAuth,/exchangeCodeForSession/);
assert.match(nativeAuth,/setSession/);
assert.match(nativeAuth,/browserFinished/,'native browser cancellation must be handled');
assert.match(nativeAuth,/status:'cancelled'/);
assert.match(nativeAuth,/status:'failed'/);

assert.match(supabase,/persistSession:\s*true/);
assert.match(supabase,/autoRefreshToken:\s*true/);
assert.match(supabase,/detectSessionInUrl:\s*true/);
assert.match(supabase,/google:\s*null,\s*apple:\s*null/,'settings lookup failures must be unknown rather than falsely disabled');
assert.match(supabase,/providerRefreshToken/,'account deletion must send a server-side revocation token when Supabase provides one');

assert.match(modal,/SETUP REQUIRED/);
assert.match(modal,/TRY SIGN-IN/,'unknown provider state must not be mislabeled setup-required');
assert.match(modal,/NATIVE_AUTH_RESULT_EVENT/);
assert.doesNotMatch(modal,/setErrorMessage\([^\n]*(err|error)\?\.message[^\n]*(Google|Apple)/i,'native OAuth must not render raw provider exceptions');

assert.match(identity,/prepareGuestAccountMerge/,'existing guest-to-account ownership merge must remain wired');
assert.match(identity,/signInWithOAuth/);
assert.match(identity,/skipBrowserRedirect/);

assert.match(codemagic,/com\.apple\.developer\.applesignin/,'signed iOS project must request the Sign in with Apple entitlement');
assert.match(codemagic,/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements/);
assert.match(codemagic,/CFBundleURLSchemes:0 string ballknower/);

assert.match(deletion,/appleid\.apple\.com\/auth\/revoke/,'Apple authorization must be revoked before deleting an Apple-backed account');
assert.match(deletion,/APPLE_REAUTH_REQUIRED/);
assert.match(deletion,/auth\.admin\.deleteUser/);
assert.ok(deletion.indexOf("revokeAppleAuthorization")<deletion.indexOf("auth.admin.deleteUser"),'Apple revocation must be attempted before auth identity deletion');

for(const secretName of ['APPLE_PRIVATE_KEY','APPLE_KEY_ID','APPLE_TEAM_ID']){
  assert.match(envExample,new RegExp(secretName));
  assert.doesNotMatch(envExample,new RegExp(`VITE_${secretName}`),'Apple signing secrets must never be client-exposed');
  assert.doesNotMatch(supabase,new RegExp(secretName),'Apple signing secrets must not enter the browser Supabase module');
}

console.log('Native Apple/Google authentication release gate passed.');
