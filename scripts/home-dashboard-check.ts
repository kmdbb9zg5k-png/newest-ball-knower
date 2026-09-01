import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const home=read('HomeDashboard.tsx');
const navbar=read('Navbar.tsx');
const app=read('App.tsx');
const footer=read('LaunchCenter.tsx');

assert.ok(home.includes('activeLeague||leagues.find'), 'home must feature the selected league instead of a hard-coded personal league');
assert.ok(home.includes('teamTheme.name')&&home.includes('teamTheme.primary'), 'home atmosphere must come from the selected NFL team theme');
assert.ok(!home.includes('The Justice League')&&!home.includes('Philadelphia Eagles'), 'personal league and favorite-team copy must never be hard-coded');
assert.ok(home.includes("league.liveDraft?.status==='active'?'draft'")&&home.includes("league.settings?.fantasySeasonStarted?'View Matchup'"), 'the main action must follow authoritative league state');
assert.ok(home.includes('fetchSeasonOperations(primaryLeague.id)')&&home.includes('formatDraftSchedule(primaryLeague)'), 'league activity must use real operations and the saved draft schedule');
assert.ok(home.includes("item.kind==='announcement'||item.kind==='receipt'")&&home.includes("item.memberId===myMember?.id"), 'home activity must avoid unrelated private owner data');
assert.ok(home.includes('setActivityUnavailable(true)')&&!home.includes('Commissioner updated league settings'), 'failed activity requests must show unavailable instead of invented updates');
assert.ok(home.includes('Ball Knower Rating')&&home.includes('rating points to'), 'rating progress must use the verified rating and truthful next-tier distance');
assert.ok(home.includes('Create League')&&home.includes('Join League')&&home.includes('Cheat Sheet')&&home.includes('Solo Mode'), 'all approved home quick links must remain reachable');

assert.ok(navbar.includes('fixed inset-x-0 bottom-0')&&navbar.includes('pb-[env(safe-area-inset-bottom)]'), 'mobile navigation must be fixed above the iPhone home indicator');
assert.ok(navbar.includes("mobileTabClass('home')")&&navbar.includes("mobileTabClass('fantasy')")&&navbar.includes("mobileTabClass('sportsbook')")&&navbar.includes("mobileTabClass('challenges')")&&navbar.includes("mobileTabClass('locker')"), 'mobile navigation must expose the five approved primary destinations');
assert.ok(navbar.includes("setCurrentTab('solo')")&&navbar.includes("setCurrentTab('news')")&&navbar.includes("setCurrentTab('legacy')"), 'secondary Solo, News, and Hall of Fame destinations must remain available');
assert.ok(app.includes('teamTheme={favoriteTheme}')&&app.includes('pb-[calc(5rem+env(safe-area-inset-bottom))]'), 'the app must pass the selected team theme and reserve space for bottom navigation');
assert.ok(footer.includes('pb-[calc(5rem+env(safe-area-inset-bottom))]'), 'the fixed bottom navigation must not cover the final footer controls');

console.log('Home dashboard checks passed: personalized team atmosphere, dynamic league action, real activity, and iPhone-safe navigation.');
