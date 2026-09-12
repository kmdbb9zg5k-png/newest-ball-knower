import assert from 'node:assert/strict';
import fs from 'node:fs';

const supabase=fs.readFileSync('supabase.ts','utf8');
const authModal=fs.readFileSync('AuthModal.tsx','utf8');
const confirmation=fs.readFileSync('supabase/email-templates/confirmation.html','utf8');
const magicLink=fs.readFileSync('supabase/email-templates/magic-link.html','utf8');

assert.match(supabase,/BALL_KNOWER_PRODUCTION_ORIGIN='https:\/\/ballknowerofficial\.com'/);
assert.match(supabase,/updateUser\([\s\S]*emailRedirectTo:ballKnowerEmailRedirect\(\)/,'guest email upgrades must provide an explicit production redirect');
assert.match(supabase,/signInWithOtp\([\s\S]*emailRedirectTo: ballKnowerEmailRedirect\(\)/,'magic links must provide an explicit production redirect');
assert.match(supabase,/ballknower:\/\/auth\/callback/,'native email auth must retain the app deep link');
assert.match(authModal,/error sending email change email/,'guest upgrades must recognize hosted email-change delivery failures');
assert.match(authModal,/flow:existingAccount\?'existing_account':'guest_upgrade_fallback'/,'failed guest email upgrades must fall back to the merge-safe magic-link flow');

for(const [name,template] of [['confirmation',confirmation],['magic link',magicLink]]){
  assert.match(template,/BALL <span[^>]*>KNOWER<\/span>/,`${name} must be Ball Knower branded`);
  assert.match(template,/{{ \.ConfirmationURL }}/,`${name} must use the server-generated one-time confirmation URL`);
  assert.doesNotMatch(template,/supabase/i,`${name} must not expose Supabase branding`);
  assert.match(template,/ballknowerofficial\.com/,`${name} must link to the official domain`);
}

console.log('BK auth email check passed: production redirects and branded confirmation templates are covered.');
