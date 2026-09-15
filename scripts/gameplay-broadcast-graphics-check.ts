import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('public/franchise-play-moment-v3.html','utf8');
const css=fs.readFileSync('public/franchise-play-moment-v3-broadcast.css','utf8');
const engine=fs.readFileSync('public/franchise-play-moment-v3.js','utf8');

assert.match(html,/bk-stadium-scene/,'Gameplay must render the broadcast stadium scene.');
assert.match(html,/id="pauseBtn"/,'Gameplay must expose a usable pause control.');
assert.match(html,/franchise-play-moment-v3-broadcast\.css/,'Broadcast styling must load after the existing gameplay layers.');
assert.match(css,/\.bk-crowd/,'Broadcast scene must include visible stadium depth.');
assert.match(css,/\.bk-goalpost/,'Broadcast scene must include football field landmarks.');
assert.match(css,/grid-template-columns:repeat\(4,minmax\(58px,1fr\)\)/,'Play calls must remain readable in landscape.');
assert.match(css,/env\(safe-area-inset-left\)/,'Landscape controls must respect iPhone safe areas.');
assert.match(engine,/function togglePause\(\)/,'Pause must be functional, not a decorative button.');
assert.match(engine,/state\.snapAt\+=Math\.max\(0,now-state\.pauseStarted\)/,'Resume must preserve the play clock.');
assert.match(engine,/35\+p\.y\*\.65/,'Gameplay coordinates must be projected onto the field below the stadium horizon.');

console.log('Gameplay broadcast graphics checks passed.');
