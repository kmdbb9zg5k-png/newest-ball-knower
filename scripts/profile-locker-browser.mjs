import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium, webkit } from 'playwright';

const base = 'http://127.0.0.1:4186';
const output = 'artifacts/profile-locker';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4186', '--strictPort'], { stdio: 'inherit' });
const userId = '11111111-1111-4111-8111-111111111111';
const timestamp = '2026-09-08T12:00:00Z';
const rows = [
  ['dynasty', 'Dynasty', 'Stack championships across competitive seasons.', 'gold'],
  ['cap_wizard', 'Cap Wizard', 'Build a verified cap-compliant roster.', 'silver'],
  ['hof_scholar', 'Hall of Fame Scholar', 'Prove yourself on Hall of Fame trivia.', 'gold'],
  ['super_agent', 'Super Agent', 'Build an elite player-representation résumé.', 'silver'],
  ['first_receipt', 'First Receipt', 'Record your first verified progression event.', 'bronze'],
  ['peoples_owner', 'People’s Owner', 'Reach a verified ownership milestone.', 'diamond'],
];
const catalog = rows.map(([achievement_key, title, description, tier]) => ({ achievement_key, title, description, tier, category: 'gm', xp_reward: 100 }));
const results = [];
let browser, activePage;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw Error(`Preview exited ${server.exitCode}`);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Production preview must start');
  await mkdir(output, { recursive: true });
  for (const engine of process.env.PROFILE_CHROMIUM_ONLY ? ['chromium'] : ['chromium', 'webkit']) {
    browser = await (engine === 'chromium' ? chromium : webkit).launch({ headless: true, ...(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    for (const width of engine === 'chromium' ? [390, 430, 320, 1280] : [390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768, reducedMotion: 'reduce' });
      const page = await context.newPage();
      activePage = page;
      const crashes = [];
      page.on('pageerror', error => crashes.push(error.message));
      let mode = 'initial', failProfile = false, equipped = null, equipCalls = 0;
      const isGuest = width === 390;
      const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: isGuest ? undefined : 'profile-fixture@example.invalid', is_anonymous: isGuest, app_metadata: { provider: isGuest ? 'anonymous' : 'email', providers: [isGuest ? 'anonymous' : 'email'] }, user_metadata: isGuest ? {} : { name: width === 320 ? 'A Very Long Profile Display Name' : 'Profile Fixture GM', full_name: width === 320 ? 'A Very Long Profile Display Name' : 'Profile Fixture GM' }, created_at: timestamp };
      const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now()/1000)+86400, is_anonymous: isGuest })).toString('base64url'), 'test-fixture-only'].join('.');
      const session = { user, access_token: token, refresh_token: 'fixture-only', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now()/1000)+86400 };
      // Every hosted-data request is intercepted. These tests never mutate production.
      await page.route('**/*.supabase.co/**', async route => {
        const path = new URL(route.request().url()).pathname;
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
        if (route.request().method() === 'OPTIONS') return respond({});
        if (path === '/auth/v1/user') {
          if (route.request().method() === 'PUT') {
            const body = route.request().postDataJSON();
            if (body?.data) user.user_metadata = { ...user.user_metadata, ...body.data };
          }
          return respond(user);
        }
        if (path === '/auth/v1/settings') return respond({ external: { google: true, apple: true } });
        if (path.startsWith('/auth/')) return respond(session);
        if (path.endsWith('/rpc/ensure_ball_knower_progress_profile')) {
          if (failProfile) return respond({ message: 'Profile fixture outage', code: 'TEST_OUTAGE' }, 503);
          return respond([{ user_id: userId, display_name: user.user_metadata.name, bk_rating: mode === 'earned' ? 61 : 50, xp: mode === 'earned' ? 1450 : mode === 'zero' ? 0 : 550, level: mode === 'earned' ? 2 : 1, football_iq: 50, gm_rating: 52, prediction_rating: 48, trivia_rating: 50, agent_rating: 51, owner_rating: 49, championships: mode === 'earned' ? 3 : 0, current_streak: 0, longest_streak: 2, updated_at: timestamp }]);
        }
        if (path.endsWith('/ball_knower_progress_events')) return respond(mode === 'earned' ? Array.from({ length: 7 }, (_, index) => ({ id: index+1, event_type: index === 0 ? 'prediction_wrong' : 'trivia_correct', category: index === 0 ? 'prediction' : 'trivia', xp_awarded: index === 0 ? 2 : 20, rating_delta: index === 0 ? -1 : 1, occurred_at: timestamp, metadata: {} })) : []);
        if (path.endsWith('/ball_knower_achievement_catalog')) return respond(mode === 'extended' ? [...catalog, { achievement_key: 'seventh', title: 'Seventh Milestone', description: 'Additional verified catalog entry.', tier: 'gold', category: 'gm', xp_reward: 125 }] : catalog);
        if (path.endsWith('/ball_knower_user_achievements')) return respond(mode === 'earned' ? [{ achievement_key: 'dynasty', unlocked_at: timestamp }, { achievement_key: 'first_receipt', unlocked_at: timestamp }] : []);
        if (path.endsWith('/ball_knower_store_catalog')) return respond([{ sku: 'qa-frame', title: 'Fixture Gold Frame', description: 'An owned equippable fixture.', category: 'profile_cosmetic', rarity: 'rare', price_cents: null, currency: 'USD', metadata: { slot: 'profile_frame' }, active: true }, { sku: 'qa-card', title: 'Fixture Collectible', description: 'An owned collectible fixture.', category: 'collectible', rarity: 'rare', price_cents: null, currency: 'USD', metadata: {}, active: true }]);
        if (path.endsWith('/ball_knower_entitlements')) return respond(['qa-frame', 'qa-card'].map(sku => ({ sku, source: 'test', granted_at: timestamp, expires_at: null, auth_user_id: userId })));
        if (path.endsWith('/ball_knower_locker')) return respond({ auth_user_id: userId, equipped_profile_frame: equipped });
        if (path.endsWith('/ball_knower_pass_progress')) return respond({ auth_user_id: userId, season: '2026', xp: 321, level: 4, premium_unlocked: false, claimed_free: [], claimed_premium: [] });
        if (path.endsWith('/rpc/equip_ball_knower_locker_item')) { const body = route.request().postDataJSON(); assert.equal(body.p_slot, 'profile_frame'); assert.equal(body.p_sku, 'qa-frame'); equipped = body.p_sku; equipCalls++; return respond(null); }
        if (path.startsWith('/storage/')) return respond({ message: 'Storage writes disabled in this fixture' }, 403);
        if (path.includes('/rpc/')) return respond(null);
        if (path.endsWith('/ball_knower_user_profiles')) return respond(null);
        return respond([]);
      });
      if (typeof page.routeWebSocket === 'function') await page.routeWebSocket(/supabase\.co/, socket => socket.close());
      await page.route('**/_vercel/**', route => route.fulfill({ status: 200, body: '' }));
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        const body = path === '/api/media' ? { tracks: [], introUrl: null } : path === '/api/nfl-news' ? { available: true, fetchedAt: timestamp, provider: 'Explicit test fixture', articles: [{ id: 'fixture-news', url: 'https://example.invalid/news', headline: 'Profile visual regression news fixture', source: 'Test fixture', image: null }] } : { ok: true };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.addInitScript(({ session, user }) => {
        localStorage.setItem('sb-gpnboygoosrmeydwjpvk-auth-token', JSON.stringify(session));
        localStorage.setItem('ballknower_user_v1', JSON.stringify({ id: user.id, name: user.user_metadata.name, email: user.email || '', isAnonymous: user.is_anonymous, avatarUrl: '', createdAt: user.created_at }));
        localStorage.setItem('ball-knower-team-setup-v2', 'complete');
        localStorage.setItem('ball-knower-intro-completed-v1', '1');
        localStorage.setItem('ball-knower-favorite-team', 'Philadelphia Eagles');
        localStorage.setItem('ball-knower-intro-sound-v1', 'off');
      }, { session, user });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('.bk-home-stadium').waitFor();
      const homeBrandSize = await page.getByRole('button', { name: 'Ball Knower home', exact: true }).locator('h1').evaluate(element => getComputedStyle(element).fontSize);
      await page.getByRole('button', { name: 'Profile', exact: true }).first().waitFor({ state: 'attached' });
      for (const button of await page.getByRole('button', { name: 'Profile', exact: true }).all()) { if (await button.isVisible()) { await button.click(); break; } }
      const profile = page.getByTestId('locker-profile');
      await profile.waitFor();
      await page.waitForFunction(() => document.querySelector('[data-testid="bk-rating"]')?.textContent === '50');
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(async () => { const image = new Image(); image.src = '/profile/locker-reference-atlas.webp'; await image.decode(); });
      await page.waitForTimeout(250);
      assert.equal(await profile.locator('.bk-locker-hex').count(), 6);
      assert.equal(await profile.locator('.bk-locker-trophy').count(), 6);
      assert.equal(await profile.getByRole('img', { name: 'Rating: 50', exact: true }).count(), 1, 'The live rating must have an accessible value');
      const refreshBox = await profile.getByRole('button', { name: 'Refresh profile', exact: true }).boundingBox();
      assert.ok(refreshBox && refreshBox.width >= 44 && refreshBox.height >= 44, 'Refresh must retain a practical phone hit target');
      assert.match(await profile.innerText(), /0\/6 unlocked/i);
      assert.equal(await profile.getByRole('progressbar').getAttribute('aria-valuenow'), '550');
      assert.match(await profile.innerText(), /No verified progression receipts yet/);
      const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, profileWidth: document.querySelector('.bk-profile-page')?.getBoundingClientRect().width }));
      assert.ok(geometry.scrollWidth <= width + 1, `Profile overflow at ${engine} ${width}: ${JSON.stringify(geometry)}`);
      assert.ok(await profile.locator('.bk-locker-hex').evaluateAll(elements => elements.every(element => element.getBoundingClientRect().width >= 44 && element.getBoundingClientRect().height >= 44)));
      if (width < 768) assert.equal(await page.getByRole('navigation', { name: 'Primary navigation' }).locator('button').count(), 5);
      await page.screenshot({ path: `${output}/${engine}-${width}-profile.png` });
      await page.screenshot({ path: `${output}/${engine}-${width}-full.png`, fullPage: true });
      const visual = await page.evaluate(() => { const rect = selector => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box ? { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom } : null; }; return { receipts: rect('.bk-locker-receipts'), nav: rect('nav[aria-label="Primary navigation"]'), identity: rect('.bk-profile-identity'), heading: rect('.bk-locker-masthead'), trophyTargets: [...document.querySelectorAll('.bk-locker-trophy')].slice(0,6).map(element => {const b=element.getBoundingClientRect(); return {x:b.x,right:b.right,width:b.width,height:b.height};}), badges: [...document.querySelectorAll('.bk-locker-badge')].slice(0,6).map(element => {const b=element.getBoundingClientRect(); return {x:b.x,right:b.right,width:b.width,height:b.height};}) }; });
      if (width === 390 || width === 430) {
        assert.ok(visual.receipts && visual.nav && visual.receipts.bottom <= visual.nav.y, `The reference's receipts panel must be visible above navigation: ${JSON.stringify(visual)}`);
      }
      assert.equal(visual.badges.length, 6);
      assert.ok(visual.badges.every(b => b.x >= 0 && b.right <= width + 1 && b.width >= 44 && b.height >= 44), 'All six decorative badges must actually be visible');
      assert.ok(visual.trophyTargets.every(b => b.width >= 44 && b.height >= 44), 'All six trophy controls must remain tappable');
      if (width < 768) {
        const nav = page.getByRole('navigation', { name: 'Primary navigation' });
        assert.equal(await nav.getByRole('button', { name: 'Profile', exact: true }).locator('svg').evaluate(el => getComputedStyle(el).stroke), 'rgb(245, 212, 120)');
        assert.equal(await nav.getByRole('button', { name: 'Home', exact: true }).locator('svg').evaluate(el => getComputedStyle(el).stroke), 'rgb(180, 190, 198)');
      }
      assert.equal(await profile.locator('.bk-locker-trophy-arrows').count(), 0, 'Six badges need no extra toolbar');
      await profile.getByRole('button', { name: /^GM rating:/ }).click();
      assert.match(await profile.locator('.bk-locker-detail').innerText(), /general manager rating/);
      await profile.getByRole('button', { name: /^GM rating:/ }).click();
      const rail = profile.locator('.bk-locker-trophy-rail');
      assert.ok(await rail.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'The six-item catalog should fit without horizontal scrolling');
      await profile.locator('.bk-locker-trophy').first().click();
      assert.match(await profile.locator('.bk-locker-detail').innerText(), /Not yet unlocked/);
      await profile.locator('.bk-locker-trophy').first().click();
      const identity = page.getByTestId('locker-identity');
      if (isGuest) {
        assert.match(await identity.innerText(), /Guest GM 111111/);
        assert.ok(await identity.getByRole('button', { name: 'Save With Email', exact: true }).isVisible());
      }
      await identity.getByRole('button', { name: 'Add profile photo', exact: true }).click();
      const actions = page.getByRole('dialog', { name: 'Edit Ball Knower profile' });
      await actions.waitFor();
      if (isGuest) {
        await actions.getByLabel('GM Name', { exact: true }).fill('Eli Test GM');
        await actions.getByRole('button', { name: 'Save GM name', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="locker-identity"]')?.textContent?.includes('ELI TEST GM'));
      }
      assert.ok(await actions.getByRole('button', { name: 'Take Photo', exact: true }).isVisible());
      assert.ok(await actions.getByRole('button', { name: 'Choose From Photos', exact: true }).isVisible());
      const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 700; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#cfb875'; ctx.fillRect(0,0,900,700); return canvas.toDataURL('image/png').split(',')[1]; });
      await identity.locator('input[type="file"]').nth(1).setInputFiles({ name: 'profile-fixture.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
      const crop = page.getByRole('dialog', { name: 'Crop profile photo' });
      await crop.waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Crop profile photo"] button')].some(button => button.textContent.trim() === 'Save Photo' && !button.disabled));
      await crop.getByRole('slider', { name: 'Zoom', exact: true }).fill('150');
      await crop.getByRole('button', { name: 'Cancel profile photo edit', exact: true }).click();
      assert.equal(await crop.count(), 0);
      mode = 'zero';
      await profile.getByRole('button', { name: 'Refresh profile', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[role="progressbar"][aria-label="Progress to next profile level"]')?.getAttribute('aria-valuenow') === '0');
      failProfile = true;
      await profile.getByRole('button', { name: 'Refresh profile', exact: true }).click();
      await profile.getByRole('alert').waitFor();
      assert.equal(await profile.getByTestId('bk-rating').textContent(), '50', 'Refresh failure must not fabricate or discard the last synced score');
      failProfile = false; mode = 'earned';
      await profile.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid="bk-rating"]')?.textContent === '61');
      assert.equal(await profile.getByRole('progressbar').getAttribute('aria-valuenow'), '450');
      assert.match(await profile.innerText(), /2\/6 unlocked/i);
      assert.match(await profile.innerText(), /-1 RTG/);
      assert.equal(await profile.locator('.bk-locker-event-list>li').count(), 6);
      await profile.getByRole('button', { name: 'Show all 7 recent receipts', exact: true }).click();
      assert.equal(await profile.locator('.bk-locker-event-list>li').count(), 7);
      mode = 'extended';
      await profile.getByRole('button', { name: 'Refresh profile', exact: true }).click();
      await profile.getByRole('button', { name: 'Next trophies', exact: true }).waitFor();
      assert.equal(await profile.locator('.bk-locker-trophy').count(), 7);
      assert.ok(await profile.locator('.bk-locker-trophy-arrows button').evaluateAll(elements => elements.every(el => el.getBoundingClientRect().width >= 44 && el.getBoundingClientRect().height >= 44)), 'Extended catalog arrows need full phone targets');
      await profile.getByRole('button', { name: 'Next trophies', exact: true }).click();
      assert.ok(await rail.evaluate(element => element.scrollLeft > 0), 'Larger catalogs remain scrollable');
      await profile.getByRole('button', { name: /^Seventh Milestone:/ }).click();
      assert.match(await profile.locator('.bk-locker-detail').innerText(), /Additional verified catalog entry/);
      const accountBox = await page.locator('.bk-locker-account > summary').boundingBox();
      assert.ok(accountBox && accountBox.width >= 44 && accountBox.height >= 44, 'Account disclosure needs a practical phone target');
      await page.locator('.bk-locker-account > summary').click();
      assert.equal(await page.locator('.bk-locker-account code').innerText(), userId);
      await page.locator('.bk-locker-account > summary').click();
      await page.locator('.bk-profile-extras > summary').click();
      await page.getByRole('button', { name: 'Collection', exact: true }).click();
      assert.ok(await page.getByText('Fixture Collectible', { exact: true }).isVisible());
      await page.getByRole('button', { name: 'Locker', exact: true }).click();
      await page.getByRole('button', { name: 'Equip', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.bk-profile-extras')?.textContent.includes('qa-frame'));
      assert.equal(equipCalls, 1);
      await page.getByRole('button', { name: 'Ball Knower home', exact: true }).click();
      await page.locator('.bk-home-stadium').waitFor();
      // Home commits before the browser finishes invalidating the ancestor :has() rule.
      // Check the settled value, not the prior Profile style in that transition frame.
      await page.waitForFunction(expected => {
        const brand = document.querySelector('header button[aria-label="Ball Knower home"] h1');
        return document.querySelector('.bk-app-shell')?.getAttribute('data-tab') === 'home'
          && brand && getComputedStyle(brand).fontSize === expected;
      }, homeBrandSize, { timeout: 5000 });
      assert.equal(await page.getByRole('button', { name: 'Ball Knower home', exact: true }).locator('h1').evaluate(element => getComputedStyle(element).fontSize), homeBrandSize, 'Profile cosmetics must not leak into Home');
      assert.deepEqual(crashes, []);
      results.push({ engine, width, geometry, visual, ratings: 6, initialTrophies: 6, extendedTrophies: 7, photoCrop: 'passed', xpZeroAndRollover: 'passed', refreshRecovery: 'passed', collectionAndEquip: 'passed', source: 'isolated network fixtures', physicalIphone: false });
      await context.close();
      activePage = null;
    }
    await browser.close(); browser = null;
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log('Profile locker browser checks passed: Chromium 320/390/430/1280 and WebKit 390; loaded data, zero XP, earned/locked trophies, signed receipts, outage/retry, photo crop, collection and equip. No production writes.');
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${output}/failure.txt`, `${String(error)}\n\n${await activePage.locator('body').innerText().catch(() => '')}`);
  }
  throw error;
} finally { await browser?.close(); server.kill('SIGTERM'); }
