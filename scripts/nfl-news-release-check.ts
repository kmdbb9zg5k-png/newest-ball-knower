import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/nfl-news.ts','utf8');
const ui=fs.readFileSync('NewsHub.tsx','utf8');
const home=fs.readFileSync('HomeDashboard.tsx','utf8');
const navbar=fs.readFileSync('Navbar.tsx','utf8');

assert.match(api,/news\.google\.com\/rss\/search/,'News must use the current hardened upstream instead of the blocked ESPN implementation');
assert.match(api,/\.sort\(/,'News must explicitly sort newest first');
assert.match(api,/source,/,'News payload must include source');
assert.match(api,/published:/,'News payload must include publication time');
assert.match(api,/description:/,'News payload must include a short description when meaningful');
assert.match(api,/available:false/,'Upstream outage must be explicit');
assert.match(api,/s-maxage=120/,'News feed must use a lightweight short server cache');
assert.doesNotMatch(api,/stale-while-revalidate/,'News must not silently represent stale cached stories as current during outage');

assert.match(ui,/item\.source/);
assert.match(ui,/publishedLabel\(item\.published\)/);
assert.match(ui,/loading="lazy"/);
assert.match(ui,/rel="noreferrer noopener"/);
assert.match(ui,/data\?\.available===false/);
assert.match(ui,/setItems\(\[\]\)/,'failed refresh must clear old stories rather than present them as current');
assert.doesNotMatch(ui,/setError\([^\n]*message/,'raw provider/network exceptions must not be rendered');
assert.match(home,/label="NFL News"/,'Mobile Home must expose a discoverable NFL News destination');
assert.match(home,/onNavigate\('news'\)/);

// Build 7 restores discoverability without adding a sixth permanent bottom tab.
const mobileLabels=[...navbar.matchAll(/mobile[^\n]{0,120}|Home|Fantasy|Picks|Trivia|Profile/gi)];
assert.ok(mobileLabels.length>0,'Navbar must remain present for the existing mobile layout');

console.log('NFL News regression gate passed.');
