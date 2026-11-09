import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { assertAppNavigation, navigateFromExplore } from './assert-app-navigation.mjs';

const origin = 'http://127.0.0.1:4187';
const artifacts = 'artifacts/store';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4187', '--strictPort'], { stdio: 'inherit' });
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 100 && !ready; attempt++) {
    try { ready = (await fetch(origin)).ok; } catch { /* Vite is starting. */ }
    if (!ready) await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'Build the app before running the Store browser check');
  await mkdir(artifacts, { recursive: true });
  for (const width of [320, 390, 1280]) {
    browser = await chromium.launch({
      executablePath: process.env.BROWSER_PATH || undefined,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
    const mobile = width < 768;
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block',
      reducedMotion: 'reduce', deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*.supabase.co/**', route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { available: false, tracks: [] } }));
    await page.addInitScript(() => {
      localStorage.setItem('ball-knower-team-setup-v2', 'complete');
      localStorage.setItem('ball-knower-intro-completed-v1', '2');
      localStorage.setItem('bk-guide-the-gauntlet-v4', 'seen');
      if (!localStorage.getItem('ballknower_solo_my_player_v2')) {
        localStorage.setItem('ballknower_solo_my_player_v2', JSON.stringify({
          version: 1, stage: 'combine', name: 'Store Test Athlete', position: 'WR',
          number: 21, combineId: 'store-check-athlete', overall: 68,
        }));
      }
    });
    await page.goto(origin);
    const nav = page.getByRole('navigation', { name: mobile ? 'Primary navigation' : 'Desktop primary navigation', exact: true });
    const storeTab = nav.getByRole('button', { name: 'Store', exact: true });
    await storeTab.click();
    const store = page.getByRole('region', { name: 'Store', exact: true });
    await store.waitFor();
    assert.equal(await storeTab.getAttribute('aria-current'), 'page');
    await assertAppNavigation(page, { mobile });
    for (const button of await nav.getByRole('button').all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, 'Primary tab has a usable touch target');
    }
    const hero = store.locator('.bk-store-hero-art');
    await hero.evaluate(image => image.decode());
    assert.ok(await hero.evaluate(image => image.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: artifacts + '/featured-' + width + '.png' });

    for (const [label, price] of [['Profile Pack', '$1.99'], ['Founder’s Pack', '$7.99']]) {
      const card = store.getByRole('button', { name: new RegExp(label) });
      await card.click();
      const product = page.getByRole('dialog', { name: label, exact: true });
      await product.getByText(price, { exact: true }).waitFor();
      await product.getByText('Planned price', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await product.waitFor({ state: 'hidden' });
      assert.ok(await card.evaluate(element => element === document.activeElement), 'Closing the product returns focus to its card');
    }

    const readSave = () => page.evaluate(() => ({
      athlete: localStorage.getItem('ballknower_solo_my_player_v2'),
      outfit: localStorage.getItem('ballknower_player_wardrobe_v1'),
    }));
    const before = await readSave();
    if (width === 390) {
      await store.getByRole('button', { name: 'Try On', exact: true }).click();
      const product = page.getByRole('dialog', { name: 'Blackout Gear Kit', exact: true });
      await product.getByText('Store Test Athlete', { exact: true }).waitFor();
      const frame = product.frameLocator('iframe[title="Game gear 3D preview"]');
      await frame.locator('canvas').waitFor();
      await frame.locator('#status').waitFor({ state: 'hidden' });
      await product.getByRole('slider', { name: 'Rotate player', exact: true }).press('ArrowRight');
      await page.screenshot({ path: artifacts + '/try-on-' + width + '.png' });
      await product.getByRole('button', { name: 'Close product', exact: true }).click();
      await product.waitFor({ state: 'hidden' });
      assert.deepEqual(await readSave(), before, 'Try On must never save an outfit or alter the career');
    }

    await store.getByRole('button', { name: 'View All', exact: true }).click();
    const catalog = page.getByRole('region', { name: 'Shop the Store', exact: true });
    const categories = catalog.getByRole('group', { name: 'Shop categories', exact: true });
    const cards = catalog.locator('.bk-store-product');
    const counts = { All: 8, 'Game Gear': 3, 'Tunnel Fits': 2, Profile: 2, Celebrations: 1, Franchise: 1, Bundles: 5 };
    for (const [category, count] of Object.entries(counts)) {
      const filter = categories.getByRole('button', { name: category, exact: true });
      await filter.click();
      assert.equal(await filter.getAttribute('aria-pressed'), 'true');
      assert.equal(await cards.count(), count, category);
    }
    await categories.getByRole('button', { name: 'All', exact: true }).click();
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      await card.locator('img').evaluate(image => image.decode());
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: artifacts + '/catalog-' + width + '.png' });

    if (width === 1280) {
      await categories.getByRole('button', { name: 'Tunnel Fits', exact: true }).click();
      await catalog.getByRole('button', { name: /^Tunnel Fit Hoodie/ }).click();
      const tunnel = page.getByRole('dialog', { name: 'Tunnel Fit', exact: true });
      await tunnel.getByRole('button', { name: 'Try on', exact: true }).click();
      await tunnel.locator('[data-athlete-live-preview][data-render-state="ready"]').waitFor();
      await tunnel.getByRole('button', { name: 'Close product', exact: true }).click();
      assert.equal(await categories.getByRole('button', { name: 'Tunnel Fits', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await readSave(), before, 'Tunnel Fit preview must not save premium clothing');
    }

    await catalog.getByRole('button', { name: 'Back to Store', exact: true }).click();
    await store.getByRole('button', { name: 'Earn Free Gear Combine & Gauntlet rewards' }).click();
    const rewards = page.getByRole('region', { name: 'Earn Free Gear', exact: true });
    assert.equal(await rewards.getByRole('link', { name: 'Play Combine', exact: true }).getAttribute('href'), '/combine.html');
    assert.ok((await context.request.get(origin + '/combine.html')).ok());
    await rewards.getByRole('button', { name: 'Play Gauntlet', exact: true }).click();
    await page.getByRole('heading', { name: 'The Gauntlet', exact: true }).waitFor();
    await storeTab.click();
    const locker = page.getByRole('region', { name: 'Player clothing locker', exact: true });
    if (width === 390) {
      await page.evaluate(() => {
        localStorage.setItem('bk-combine-forty-v1', JSON.stringify([
          { context: 'standalone', playerId: 'store-check-athlete', name: 'Store Test Athlete', position: 'WR', splits: [1.6, 2.8, 4.6], date: Date.now() },
        ]));
        localStorage.setItem('ballknower_gauntlet_progress_v2:guest', JSON.stringify({
          daily: { '2026-11-08': { score: 7, completed: true } },
        }));
      });
      await store.getByRole('button', { name: 'Earn Free Gear Combine & Gauntlet rewards' }).click();
      await rewards.getByRole('button', { name: 'Claim Combine Practice Top', exact: true }).click();
      await rewards.getByRole('status').filter({ hasText: 'Combine Practice Top added to My Locker' }).waitFor();
      await rewards.getByRole('button', { name: 'Claim Gauntlet Wristbands', exact: true }).click();
      await rewards.getByRole('status').filter({ hasText: 'Gauntlet Wristbands added to My Locker' }).waitFor();
      await rewards.getByRole('button', { name: 'Open My Locker', exact: true }).click();
      await locker.getByRole('button', { name: 'Try on Combine Practice Top', exact: true }).click();
      await locker.getByRole('button', { name: 'Equip free item', exact: true }).click();
      await locker.getByRole('status').filter({ hasText: 'Combine Practice Top equipped' }).waitFor();
      assert.equal(JSON.parse((await readSave()).outfit).top, 'top-combine-reward');
    } else {
      await store.getByRole('button', { name: 'My Locker', exact: true }).click();
    }
    await locker.getByRole('button', { name: 'Try on Bone Training Top', exact: true }).click();
    await locker.getByRole('button', { name: 'Equip free item', exact: true }).click();
    await locker.getByRole('status').filter({ hasText: 'Bone Training Top equipped' }).waitFor();
    assert.equal(JSON.parse((await readSave()).outfit).top, 'top-bone');
    await locker.getByRole('button', { name: 'Shop Gear', exact: true }).click();
    await catalog.waitFor();
    assert.equal(await categories.getByRole('button', { name: 'Game Gear', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await cards.count(), 3);

    if (width === 390) {
      await navigateFromExplore(page, 'Solo careers', 'solo');
      await page.getByRole('button', { name: 'Choose Career', exact: true }).click();
      await page.getByRole('region', { name: 'Choose your career', exact: true }).getByRole('button', { name: /^My Player/ }).click();
      await page.getByRole('tab', { name: 'My Player', exact: true }).click();
      await page.getByRole('region', { name: 'Athlete locker', exact: true }).getByRole('button', { name: 'Shop Gear', exact: true }).click();
      await catalog.waitFor();
      assert.equal(await categories.getByRole('button', { name: 'Game Gear', exact: true }).getAttribute('aria-pressed'), 'true');
    }
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();
    browser = undefined;
    console.log('PASS Store at ' + width + 'px: navigation, catalog, previews, rewards and Locker.');
  }
} finally {
  await browser?.close();
  server.kill();
}
