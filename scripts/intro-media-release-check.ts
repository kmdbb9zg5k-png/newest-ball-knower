import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('App.tsx','utf8');
const intro=fs.readFileSync('CinematicIntro.tsx','utf8');
const soundtrack=fs.readFileSync('SoundtrackContext.tsx','utf8');

assert.match(app,/ball-knower-intro-completed-v1/,'intro completion must be persisted');
assert.match(app,/useState\(introEligible\)/,'fresh storage must control intro eligibility');
assert.match(app,/localStorage\.setItem\(INTRO_COMPLETED_KEY,'1'\)/,'skip/completion must remember the intro');
assert.match(app,/const openIntro=\(\)=>\{setIntroActive\(true\);setIsIntroOpen\(true\)\}/,'Replay Intro must remain available even after completion');

assert.match(intro,/playsInline/);
assert.match(intro,/autoPlay/);
assert.match(intro,/video\.play\(\)\.catch/,'intro must handle iOS autoplay rejection');
assert.match(intro,/video\.muted = true/,'intro must fall back to muted autoplay when sound autoplay is blocked');
assert.match(intro,/videoReady/,'intro must render a nonblank loading state while native media becomes ready');
assert.match(intro,/Ball Knower/);
assert.match(intro,/onCanPlay/);

assert.match(soundtrack,/appStateChange/,'native background/foreground lifecycle must be handled');
assert.match(soundtrack,/pointerdown/,'first meaningful interaction must retry blocked playback');
assert.match(soundtrack,/touchend/,'touch interaction must retry blocked playback on iPhone');
assert.match(soundtrack,/shouldPlayRef\.current = true/);
assert.match(soundtrack,/audioRef\.current\?\.pause\(\)/,'background/intro transitions must pause the single soundtrack element');
assert.match(soundtrack,/startIndex\(currentTrackIndexRef\.current\)/,'intro exit must try soundtrack playback immediately in the user gesture');
assert.doesNotMatch(soundtrack,/setTimeout\(\(\) => startIndex/,'intro exit must not lose an iOS user gesture by deferring play');
assert.match(soundtrack,/STORAGE_KEY_MUTED/,'saved mute preference must remain authoritative');
assert.match(soundtrack,/manualOnly/,'reserved/manual-only track policy must remain intact');
assert.equal((soundtrack.match(/new Audio\(\)/g)||[]).length,1,'only one soundtrack audio element may be created');

console.log('Intro and native soundtrack lifecycle regression gate passed.');
