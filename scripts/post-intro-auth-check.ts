import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('App.tsx','utf8');
const auth=fs.readFileSync('AuthModal.tsx','utf8');
const styles=fs.readFileSync('authExperience.css','utf8');

assert.match(app,/shouldLaunchAuthAfterIntroRef/,'first-launch intro must own the automatic auth handoff');
assert.match(app,/setIsLaunchAuth\(true\);setIsAuthOpen\(true\)/,'intro completion must open the launch auth experience');
assert.match(app,/showFavoriteTeam&&!isIntroOpen&&!isLaunchAuth/,'favorite-team setup must wait for launch auth');
assert.match(app,/presentation=\{isLaunchAuth\?'launch':'modal'\}/,'automatic and manual auth presentations must stay distinct');
assert.match(auth,/Continue with Google/);
assert.match(auth,/Continue with Apple/);
assert.match(auth,/Continue with Email/);
assert.match(auth,/Keep Playing As Guest/);
assert.match(auth,/Signing in is optional/);
assert.match(styles,/min-height: 100dvh/,'launch auth must use the dynamic mobile viewport');
assert.match(styles,/env\(safe-area-inset-top\)/,'launch auth must respect the iPhone top safe area');
assert.match(styles,/env\(safe-area-inset-bottom\)/,'launch auth must respect the iPhone bottom safe area');

console.log('Post-intro premium auth gate passed: sequence, guest escape hatch, provider choices, and mobile safe areas are covered.');
